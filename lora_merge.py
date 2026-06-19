# Copyright (c) 2024-2026 icefox21
# This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
# Project Link: https://github.com/icefox21/whtools

import os
import re
import time

import torch

DOWN_SUFFIX = ".lora_down.weight"
UP_SUFFIX = ".lora_up.weight"
ALPHA_SUFFIX = ".alpha"

LORA_PAIR_FORMATS = (
    (".lora_up.weight", ".lora_down.weight", ".lora_mid.weight"),
    ("_lora.up.weight", "_lora.down.weight", None),
    (".lora_B.weight", ".lora_A.weight", None),
    (".lora.up.weight", ".lora.down.weight", None),
    (".lora_B", ".lora_A", None),
    (".lora_linear_layer.up.weight", ".lora_linear_layer.down.weight", None),
    (".lora_B.default.weight", ".lora_A.default.weight", None),
)


def _get_lora_files():
    try:
        import folder_paths
        files = folder_paths.get_filename_list("loras")
        return files if files else ["None"]
    except Exception:
        return ["None"]


def _get_optional_lora_files():
    files = _get_lora_files()
    return ["None"] + [name for name in files if name not in ("None", "", None)]


def _safe_filename(name):
    name = (name or "").strip()
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    name = name.strip(" .")
    return name or "whtools_merged_lora"


def _is_clip_key(key):
    key_lower = key.lower()
    return (
        "lora_te" in key_lower
        or "text_encoder" in key_lower
        or "clip" in key_lower
    )


def _parse_weight_list(text):
    if not text:
        return []
    values = []
    for part in re.split(r"[\s,;]+", str(text).strip()):
        if not part:
            continue
        try:
            values.append(float(part))
        except ValueError:
            raise ValueError(f"Invalid layer weight value: {part}")
    return values


def _block_index(key):
    patterns = (
        r"(?:blocks?|layers?|transformer_blocks?|double_blocks?|single_blocks?)[._](\d+)",
        r"(?:blocks?|layers?|transformer_blocks?|double_blocks?|single_blocks?)(\d+)",
    )
    for pattern in patterns:
        match = re.search(pattern, key, re.IGNORECASE)
        if match:
            return int(match.group(1))
    return None


def _part_multiplier(key, block_weights, attention_weight, ff_weight, adaln_weight):
    key_lower = key.lower()
    weight = 1.0
    block_id = _block_index(key)
    if block_id is not None and block_id < len(block_weights):
        weight *= block_weights[block_id]

    if any(token in key_lower for token in ("attn", "attention", "to_q", "to_k", "to_v", "to_out", "q_proj", "k_proj", "v_proj", "out_proj")):
        weight *= attention_weight
    if any(token in key_lower for token in ("ff", "feed_forward", "mlp", "fc1", "fc2")):
        weight *= ff_weight
    if any(token in key_lower for token in ("adaln", "ada_ln", "ada_norm", "modulation")):
        weight *= adaln_weight

    return weight


def _pad_to_shape(tensor, shape):
    src = tensor.detach().cpu().float()
    if src.dim() != len(shape):
        return None
    out = torch.zeros(tuple(shape), dtype=torch.float32)
    slices = tuple(slice(0, min(src.shape[i], shape[i])) for i in range(src.dim()))
    out[slices] = src[slices]
    return out


def _scalar_float(value, default):
    if value is None:
        return default
    if torch.is_tensor(value):
        if value.numel() == 0:
            return default
        return float(value.detach().cpu().reshape(-1)[0])
    try:
        return float(value)
    except Exception:
        return default


def _lora_pair_bases(state_dict):
    down_bases = {key[:-len(DOWN_SUFFIX)] for key in state_dict if key.endswith(DOWN_SUFFIX)}
    up_bases = {key[:-len(UP_SUFFIX)] for key in state_dict if key.endswith(UP_SUFFIX)}
    return down_bases & up_bases


def _lora_pair_specs(state_dict):
    specs = {}
    for up_suffix, down_suffix, mid_suffix in LORA_PAIR_FORMATS:
        for key in state_dict:
            if not key.endswith(up_suffix):
                continue
            base = key[:-len(up_suffix)]
            down_key = base + down_suffix
            if down_key not in state_dict:
                continue
            mid_key = base + mid_suffix if mid_suffix else None
            specs[base] = {
                "up_key": key,
                "down_key": down_key,
                "mid_key": mid_key if mid_key in state_dict else None,
                "alpha_key": base + ALPHA_SUFFIX,
            }
    return specs


def _pair_compatible(down_a, up_a, down_b, up_b):
    if down_a.dim() != down_b.dim() or up_a.dim() != up_b.dim():
        return False
    if down_a.shape[1:] != down_b.shape[1:]:
        return False
    if up_a.shape[:1] != up_b.shape[:1]:
        return False
    if up_a.shape[2:] != up_b.shape[2:]:
        return False
    return True


def _resolve_lora_path(lora_name):
    import folder_paths

    try:
        return folder_paths.get_full_path_or_raise("loras", lora_name)
    except AttributeError:
        path = folder_paths.get_full_path("loras", lora_name)
        if path is None:
            raise FileNotFoundError(f"LoRA not found: {lora_name}")
        return path


def _first_lora_root():
    import folder_paths

    roots = None
    try:
        roots = folder_paths.get_folder_paths("loras")
    except Exception:
        roots = None

    if not roots:
        roots = folder_paths.folder_names_and_paths.get("loras", ([], set()))[0]

    if not roots:
        raise RuntimeError("No LoRA folder is configured in ComfyUI.")

    return os.path.abspath(roots[0])


def _output_path(output_name, output_subfolder):
    root = _first_lora_root()
    subfolder = _safe_filename(output_subfolder).replace("\\", os.sep).replace("/", os.sep)
    out_dir = os.path.abspath(os.path.join(root, subfolder)) if subfolder else root

    root_cmp = os.path.normcase(root)
    out_cmp = os.path.normcase(out_dir)
    if out_cmp != root_cmp and not out_cmp.startswith(root_cmp + os.sep):
        raise ValueError("Output folder must stay inside the ComfyUI LoRA directory.")

    os.makedirs(out_dir, exist_ok=True)

    filename = _safe_filename(output_name)
    if not filename.lower().endswith(".safetensors"):
        filename += ".safetensors"

    full_path = os.path.join(out_dir, filename)
    rel_name = os.path.relpath(full_path, root).replace("\\", "/")
    return full_path, rel_name


def _load_lora(path):
    try:
        from comfy.utils import load_torch_file
        return load_torch_file(path, safe_load=True)
    except TypeError:
        from comfy.utils import load_torch_file
        return load_torch_file(path)


def _save_lora(tensors, path, metadata):
    try:
        from safetensors.torch import save_file
    except Exception as exc:
        raise RuntimeError("safetensors is required to save merged LoRA files.") from exc

    save_file(tensors, path, metadata=metadata)


TOOLTIPS = {
    "lora_a": "第一个 LoRA。通常放主要脸、主要角色，或你更想保留特征的 LoRA。",
    "lora_b": "第二个 LoRA。通常放补充脸、表情、身体、服装或另一个版本的角色 LoRA。",
    "model_weight_a": "LoRA A 对模型/画面主体的强度。接近普通 LoRA Loader 的 model strength。",
    "model_weight_b": "LoRA B 对模型/画面主体的强度。效果弱就提高，互相打架就降低。",
    "clip_weight_a": "LoRA A 对提示词理解的强度。角色触发词、概念绑定通常和这里有关。",
    "clip_weight_b": "LoRA B 对提示词理解的强度。两个角色词混乱时，可以先降低这个值。",
    "attention_weight_a": "LoRA A 的注意力层倍率。更影响脸部结构、五官关系、身份识别。",
    "attention_weight_b": "LoRA B 的注意力层倍率。合并两个脸时通常保留 0.8 到 1.0。",
    "ff_weight_a": "LoRA A 的前馈层倍率。更容易带出画风、质感、服装、身体等整体变化。",
    "ff_weight_b": "LoRA B 的前馈层倍率。只想合脸时建议降低到 0.2 到 0.5。",
    "adaln_weight_a": "LoRA A 的调制/归一化相关倍率。会影响整体调性、光影、风格稳定性。",
    "adaln_weight_b": "LoRA B 的调制/归一化相关倍率。只想保脸时不要太高，可先用 0.5。",
    "block_weights_a": "LoRA A 的分层权重。可填一串数字，如 1,1,0.8,0.6；空着表示所有层都用 1。",
    "block_weights_b": "LoRA B 的分层权重。用于细调某些层的影响；看不懂时留空即可。",
    "merge_strategy": "合并策略。rank_concat 更接近同时加载两个 LoRA；tensor_blend 是旧式张量混合，通常不推荐。",
    "overlap_mode": "两个 LoRA 命中同一层时怎么处理。add 最像同时加载；weighted_average 更柔和；keep_a/keep_b 只保留一边。",
    "shape_mode": "遇到不同 rank 或形状时怎么处理。pad_to_larger 会补零对齐，兼容性最好。",
    "include_unique_keys": "是否保留只存在于其中一个 LoRA 的权重。一般保持开启。",
    "save_dtype": "保存精度。fp16 文件小、加载快；fp32 更精确但文件更大；keep 保持原始类型。",
    "output_name": "输出 LoRA 文件名。不写后缀也可以，会自动保存为 .safetensors。",
    "output_subfolder": "输出到 LoRA 目录下的子文件夹。默认 whtools_merged，方便和原始 LoRA 分开。",
    "overwrite": "如果输出文件已存在，是否覆盖。关闭时可防止误覆盖旧结果。",
}


def _with_tooltip(options, name):
    options = dict(options or {})
    options["tooltip"] = TOOLTIPS.get(name, "")
    return options


class WuhuoLoraMerge:
    @classmethod
    def INPUT_TYPES(cls):
        loras = _get_lora_files()
        return {
            "required": {
                "lora_a": (loras, _with_tooltip({}, "lora_a")),
                "lora_b": (loras, _with_tooltip({}, "lora_b")),
                "model_weight_a": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "model_weight_a")),
                "model_weight_b": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "model_weight_b")),
                "clip_weight_a": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "clip_weight_a")),
                "clip_weight_b": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "clip_weight_b")),
                "attention_weight_a": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "attention_weight_a")),
                "attention_weight_b": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "attention_weight_b")),
                "ff_weight_a": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "ff_weight_a")),
                "ff_weight_b": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "ff_weight_b")),
                "adaln_weight_a": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "adaln_weight_a")),
                "adaln_weight_b": ("FLOAT", _with_tooltip({"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05}, "adaln_weight_b")),
                "block_weights_a": ("STRING", _with_tooltip({"multiline": True, "default": ""}, "block_weights_a")),
                "block_weights_b": ("STRING", _with_tooltip({"multiline": True, "default": ""}, "block_weights_b")),
                "merge_strategy": (["rank_concat", "tensor_blend"], _with_tooltip({"default": "rank_concat"}, "merge_strategy")),
                "overlap_mode": (["add", "weighted_average", "keep_a", "keep_b"], _with_tooltip({"default": "add"}, "overlap_mode")),
                "shape_mode": (["pad_to_larger", "keep_a_on_mismatch", "skip_mismatch"], _with_tooltip({"default": "pad_to_larger"}, "shape_mode")),
                "include_unique_keys": ("BOOLEAN", _with_tooltip({"default": True}, "include_unique_keys")),
                "save_dtype": (["fp16", "fp32", "keep"], _with_tooltip({"default": "fp16"}, "save_dtype")),
                "output_name": ("STRING", _with_tooltip({"default": "whtools_merged_lora"}, "output_name")),
                "output_subfolder": ("STRING", _with_tooltip({"default": "whtools_merged"}, "output_subfolder")),
                "overwrite": ("BOOLEAN", _with_tooltip({"default": True}, "overwrite")),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("lora_name", "lora_path", "info")
    FUNCTION = "merge"
    CATEGORY = "wuhuo/LoRA"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return time.time()

    def _weight_for_key(self, key, model_weight, clip_weight, block_weights, attention_weight, ff_weight, adaln_weight):
        base_weight = clip_weight if _is_clip_key(key) else model_weight
        return base_weight * _part_multiplier(key, block_weights, attention_weight, ff_weight, adaln_weight)

    def _convert_dtype(self, tensor, save_dtype):
        if not torch.is_floating_point(tensor):
            return tensor
        if save_dtype == "fp16":
            return tensor.to(torch.float16)
        if save_dtype == "fp32":
            return tensor.to(torch.float32)
        return tensor

    def _merge_tensor(self, key, tensor_a, tensor_b, weight_a, weight_b, overlap_mode, shape_mode):
        if tensor_a is None:
            return tensor_b.detach().cpu().float() * weight_b
        if tensor_b is None:
            return tensor_a.detach().cpu().float() * weight_a

        if tuple(tensor_a.shape) != tuple(tensor_b.shape):
            if shape_mode == "skip_mismatch":
                return None
            if shape_mode == "keep_a_on_mismatch":
                return tensor_a.detach().cpu().float() * weight_a
            if tensor_a.dim() != tensor_b.dim():
                return tensor_a.detach().cpu().float() * weight_a
            target_shape = [max(tensor_a.shape[i], tensor_b.shape[i]) for i in range(tensor_a.dim())]
            a = _pad_to_shape(tensor_a, target_shape)
            b = _pad_to_shape(tensor_b, target_shape)
            if a is None or b is None:
                return tensor_a.detach().cpu().float() * weight_a
        else:
            a = tensor_a.detach().cpu().float()
            b = tensor_b.detach().cpu().float()

        if overlap_mode == "keep_a":
            return a * weight_a
        if overlap_mode == "keep_b":
            return b * weight_b
        if overlap_mode == "weighted_average":
            denom = abs(weight_a) + abs(weight_b)
            if denom == 0:
                return torch.zeros_like(a)
            return (a * weight_a + b * weight_b) / denom
        return a * weight_a + b * weight_b

    def _rank_concat_pair(self, base, sd, model_weight, clip_weight, block_weights, attention_weight, ff_weight, adaln_weight, side_scale=1.0):
        down_key = base + DOWN_SUFFIX
        up_key = base + UP_SUFFIX
        down = sd[down_key].detach().cpu().float()
        up = sd[up_key].detach().cpu().float()

        if down.dim() == 0 or up.dim() < 2:
            return None

        rank = int(down.shape[0])
        if rank <= 0 or int(up.shape[1]) <= 0:
            return None

        alpha = _scalar_float(sd.get(base + ALPHA_SUFFIX), float(rank))
        weight = self._weight_for_key(base, model_weight, clip_weight, block_weights, attention_weight, ff_weight, adaln_weight)

        # Set merged alpha to merged rank later. Folding alpha/rank into up preserves
        # the runtime LoRA delta much better than adding raw up/down tensors.
        scale = side_scale * weight * (alpha / float(rank))
        return down, up * scale

    def _merge_rank_concat(
        self,
        sd_a,
        sd_b,
        keys,
        model_weight_a,
        model_weight_b,
        clip_weight_a,
        clip_weight_b,
        attention_weight_a,
        attention_weight_b,
        ff_weight_a,
        ff_weight_b,
        adaln_weight_a,
        adaln_weight_b,
        block_weights_a,
        block_weights_b,
        overlap_mode,
        shape_mode,
        include_unique_keys,
        save_dtype,
    ):
        bases_a = _lora_pair_bases(sd_a)
        bases_b = _lora_pair_bases(sd_b)
        bases = bases_a | bases_b if include_unique_keys else bases_a & bases_b
        processed = set()
        merged = {}
        exact_pairs = 0
        incompatible_pairs = 0

        for base in sorted(bases):
            has_a = base in bases_a
            has_b = base in bases_b
            if not has_a and not has_b:
                continue

            if has_a:
                processed.update({base + DOWN_SUFFIX, base + UP_SUFFIX, base + ALPHA_SUFFIX})
            if has_b:
                processed.update({base + DOWN_SUFFIX, base + UP_SUFFIX, base + ALPHA_SUFFIX})

            if has_a and has_b:
                if not _pair_compatible(
                    sd_a[base + DOWN_SUFFIX],
                    sd_a[base + UP_SUFFIX],
                    sd_b[base + DOWN_SUFFIX],
                    sd_b[base + UP_SUFFIX],
                ):
                    incompatible_pairs += 1
                    if shape_mode == "skip_mismatch":
                        continue
                    has_b = overlap_mode == "keep_b"
                    has_a = not has_b

            side_scale_a = 1.0
            side_scale_b = 1.0
            if has_a and has_b and overlap_mode == "keep_a":
                has_b = False
            elif has_a and has_b and overlap_mode == "keep_b":
                has_a = False
            elif has_a and has_b and overlap_mode == "weighted_average":
                wa = abs(self._weight_for_key(base, model_weight_a, clip_weight_a, block_weights_a, attention_weight_a, ff_weight_a, adaln_weight_a))
                wb = abs(self._weight_for_key(base, model_weight_b, clip_weight_b, block_weights_b, attention_weight_b, ff_weight_b, adaln_weight_b))
                denom = wa + wb
                if denom > 0:
                    side_scale_a = wa / denom
                    side_scale_b = wb / denom

            parts_down = []
            parts_up = []
            if has_a:
                pair = self._rank_concat_pair(base, sd_a, model_weight_a, clip_weight_a, block_weights_a, attention_weight_a, ff_weight_a, adaln_weight_a, side_scale_a)
                if pair is not None:
                    parts_down.append(pair[0])
                    parts_up.append(pair[1])
            if has_b:
                pair = self._rank_concat_pair(base, sd_b, model_weight_b, clip_weight_b, block_weights_b, attention_weight_b, ff_weight_b, adaln_weight_b, side_scale_b)
                if pair is not None:
                    parts_down.append(pair[0])
                    parts_up.append(pair[1])

            if not parts_down or not parts_up:
                continue

            down = torch.cat(parts_down, dim=0)
            up = torch.cat(parts_up, dim=1)
            total_rank = int(down.shape[0])
            merged[base + DOWN_SUFFIX] = self._convert_dtype(down, save_dtype)
            merged[base + UP_SUFFIX] = self._convert_dtype(up, save_dtype)
            merged[base + ALPHA_SUFFIX] = torch.tensor(float(total_rank), dtype=torch.float32)
            exact_pairs += 1

        shape_conflicts = incompatible_pairs
        skipped_mismatch = 0
        remaining_keys = sorted(keys - processed)
        for key in remaining_keys:
            tensor_a = sd_a.get(key)
            tensor_b = sd_b.get(key)
            if tensor_a is None and tensor_b is None:
                continue
            if tensor_a is not None and tensor_b is not None and tuple(tensor_a.shape) != tuple(tensor_b.shape):
                shape_conflicts += 1

            wa = self._weight_for_key(key, model_weight_a, clip_weight_a, block_weights_a, attention_weight_a, ff_weight_a, adaln_weight_a)
            wb = self._weight_for_key(key, model_weight_b, clip_weight_b, block_weights_b, attention_weight_b, ff_weight_b, adaln_weight_b)
            tensor = self._merge_tensor(key, tensor_a, tensor_b, wa, wb, overlap_mode, shape_mode)
            if tensor is None:
                skipped_mismatch += 1
                continue
            merged[key] = self._convert_dtype(tensor, save_dtype)

        return merged, {
            "exact_pairs": exact_pairs,
            "shape_conflicts": shape_conflicts,
            "skipped_mismatch": skipped_mismatch,
            "fallback_tensors": len(remaining_keys),
        }

    def merge(
        self,
        lora_a,
        lora_b,
        model_weight_a,
        model_weight_b,
        clip_weight_a,
        clip_weight_b,
        attention_weight_a,
        attention_weight_b,
        ff_weight_a,
        ff_weight_b,
        adaln_weight_a,
        adaln_weight_b,
        block_weights_a,
        block_weights_b,
        merge_strategy,
        overlap_mode,
        shape_mode,
        include_unique_keys,
        save_dtype,
        output_name,
        output_subfolder,
        overwrite,
    ):
        if lora_a in ("None", "", None) or lora_b in ("None", "", None):
            raise ValueError("Please select two LoRA files.")
        if lora_a == lora_b:
            raise ValueError("Please select two different LoRA files.")

        path_a = _resolve_lora_path(lora_a)
        path_b = _resolve_lora_path(lora_b)
        sd_a = _load_lora(path_a)
        sd_b = _load_lora(path_b)

        out_path, rel_name = _output_path(output_name, output_subfolder)
        if os.path.exists(out_path) and not overwrite:
            raise FileExistsError(f"Output LoRA already exists: {out_path}")

        keys_a = set(sd_a.keys())
        keys_b = set(sd_b.keys())
        keys = keys_a | keys_b if include_unique_keys else keys_a & keys_b
        parsed_block_weights_a = _parse_weight_list(block_weights_a)
        parsed_block_weights_b = _parse_weight_list(block_weights_b)

        if merge_strategy == "rank_concat":
            merged, stats = self._merge_rank_concat(
                sd_a,
                sd_b,
                keys,
                model_weight_a,
                model_weight_b,
                clip_weight_a,
                clip_weight_b,
                attention_weight_a,
                attention_weight_b,
                ff_weight_a,
                ff_weight_b,
                adaln_weight_a,
                adaln_weight_b,
                parsed_block_weights_a,
                parsed_block_weights_b,
                overlap_mode,
                shape_mode,
                include_unique_keys,
                save_dtype,
            )
        else:
            merged = {}
            shape_conflicts = 0
            skipped_mismatch = 0
            for key in sorted(keys):
                tensor_a = sd_a.get(key)
                tensor_b = sd_b.get(key)
                if tensor_a is None and tensor_b is None:
                    continue
                if tensor_a is not None and tensor_b is not None and tuple(tensor_a.shape) != tuple(tensor_b.shape):
                    shape_conflicts += 1

                wa = self._weight_for_key(key, model_weight_a, clip_weight_a, parsed_block_weights_a, attention_weight_a, ff_weight_a, adaln_weight_a)
                wb = self._weight_for_key(key, model_weight_b, clip_weight_b, parsed_block_weights_b, attention_weight_b, ff_weight_b, adaln_weight_b)
                tensor = self._merge_tensor(key, tensor_a, tensor_b, wa, wb, overlap_mode, shape_mode)
                if tensor is None:
                    skipped_mismatch += 1
                    continue
                merged[key] = self._convert_dtype(tensor, save_dtype)
            stats = {
                "exact_pairs": 0,
                "shape_conflicts": shape_conflicts,
                "skipped_mismatch": skipped_mismatch,
                "fallback_tensors": len(keys),
            }

        if not merged:
            raise RuntimeError("No tensors were merged. Check include_unique_keys or selected LoRAs.")

        metadata = {
            "whtools": "LoRA merged by WuhuoLoraMerge",
            "lora_a": str(lora_a),
            "lora_b": str(lora_b),
            "model_weight_a": str(model_weight_a),
            "model_weight_b": str(model_weight_b),
            "clip_weight_a": str(clip_weight_a),
            "clip_weight_b": str(clip_weight_b),
            "attention_weight_a": str(attention_weight_a),
            "attention_weight_b": str(attention_weight_b),
            "ff_weight_a": str(ff_weight_a),
            "ff_weight_b": str(ff_weight_b),
            "adaln_weight_a": str(adaln_weight_a),
            "adaln_weight_b": str(adaln_weight_b),
            "block_weights_a": str(block_weights_a),
            "block_weights_b": str(block_weights_b),
            "merge_strategy": str(merge_strategy),
            "overlap_mode": str(overlap_mode),
            "shape_mode": str(shape_mode),
        }
        _save_lora(merged, out_path, metadata)

        info = (
            f"Saved {rel_name} | tensors: {len(merged)} | "
            f"strategy: {merge_strategy} | exact pairs: {stats['exact_pairs']} | "
            f"unique A: {len(keys_a - keys_b)} | unique B: {len(keys_b - keys_a)} | "
            f"overlap: {len(keys_a & keys_b)} | shape conflicts: {stats['shape_conflicts']} | "
            f"skipped mismatch: {stats['skipped_mismatch']}"
        )
        return {"ui": {"text": [info]}, "result": (rel_name, out_path, info)}


class WuhuoLoraSimpleMerge(WuhuoLoraMerge):
    @classmethod
    def INPUT_TYPES(cls):
        loras = _get_lora_files()
        optional_loras = _get_optional_lora_files()
        return {
            "required": {
                "lora_1": (loras, {"tooltip": "第一个 LoRA。权重会被直接烘焙进输出 LoRA。"}),
                "weight_1": ("FLOAT", {"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05, "tooltip": "第一个 LoRA 的权重。效果等价于串联加载时的强度。"}),
                "lora_2": (optional_loras, {"tooltip": "第二个 LoRA。可选 None。"}),
                "weight_2": ("FLOAT", {"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05, "tooltip": "第二个 LoRA 的权重。"}),
                "lora_3": (optional_loras, {"tooltip": "第三个 LoRA。可选 None。"}),
                "weight_3": ("FLOAT", {"default": 1.0, "min": -5.0, "max": 5.0, "step": 0.05, "tooltip": "第三个 LoRA 的权重。"}),
                "save_dtype": (["fp16", "fp32"], {"default": "fp16", "tooltip": "输出精度。fp16 文件更小，fp32 更精确但更大。"}),
                "output_name": ("STRING", {"default": "whtools_simple_merged_lora", "tooltip": "输出 LoRA 文件名。不写后缀会自动保存为 .safetensors。"}),
                "output_subfolder": ("STRING", {"default": "whtools_merged", "tooltip": "输出到 LoRA 目录下的子文件夹。"}),
                "overwrite": ("BOOLEAN", {"default": True, "tooltip": "输出文件已存在时是否覆盖。"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("lora_name", "lora_path", "info")
    FUNCTION = "merge_simple"
    CATEGORY = "wuhuo/LoRA"
    OUTPUT_NODE = True

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return time.time()

    def _selected_loras(self, lora_1, weight_1, lora_2, weight_2, lora_3, weight_3):
        selected = []
        for index, (name, weight) in enumerate(((lora_1, weight_1), (lora_2, weight_2), (lora_3, weight_3)), start=1):
            if name in ("None", "", None):
                continue
            weight = float(weight)
            if weight == 0:
                continue
            selected.append({
                "index": index,
                "name": name,
                "weight": weight,
                "path": _resolve_lora_path(name),
            })
        return selected

    def _merge_simple_states(self, entries, save_dtype):
        spec_sets = [set(entry["pair_specs"].keys()) for entry in entries]
        bases = set().union(*spec_sets) if spec_sets else set()
        merged = {}
        exact_pairs = 0
        shape_conflicts = 0
        skipped_layers = 0

        for base in sorted(bases):
            parts_down = []
            parts_up = []
            ref_down = None
            ref_up = None
            for entry in entries:
                spec = entry["pair_specs"].get(base)
                if spec is None:
                    continue
                if spec.get("mid_key"):
                    shape_conflicts += 1
                    skipped_layers += 1
                    continue

                down = entry["state"][spec["down_key"]].detach().cpu().float()
                up = entry["state"][spec["up_key"]].detach().cpu().float()
                if down.dim() == 0 or up.dim() < 2:
                    skipped_layers += 1
                    continue

                if ref_down is not None and not _pair_compatible(ref_down, ref_up, down, up):
                    shape_conflicts += 1
                    skipped_layers += 1
                    continue

                rank = int(down.shape[0])
                if rank <= 0 or int(up.shape[1]) <= 0:
                    skipped_layers += 1
                    continue

                alpha = _scalar_float(entry["state"].get(spec["alpha_key"]), float(rank))
                scale = float(entry["weight"]) * (alpha / float(rank))

                if ref_down is None:
                    ref_down = down
                    ref_up = up

                parts_down.append(down)
                parts_up.append(up * scale)
            if not parts_down:
                continue

            down = torch.cat(parts_down, dim=0)
            up = torch.cat(parts_up, dim=1)
            total_rank = int(down.shape[0])
            merged[base + DOWN_SUFFIX] = self._convert_dtype(down, save_dtype)
            merged[base + UP_SUFFIX] = self._convert_dtype(up, save_dtype)
            merged[base + ALPHA_SUFFIX] = torch.tensor(float(total_rank), dtype=torch.float32)
            exact_pairs += 1

        return merged, {
            "exact_pairs": exact_pairs,
            "shape_conflicts": shape_conflicts,
            "skipped_layers": skipped_layers,
        }

    def merge_simple(
        self,
        lora_1,
        weight_1,
        lora_2,
        weight_2,
        lora_3,
        weight_3,
        save_dtype,
        output_name,
        output_subfolder,
        overwrite,
    ):
        selected = self._selected_loras(lora_1, weight_1, lora_2, weight_2, lora_3, weight_3)
        if len(selected) < 2:
            raise ValueError("请至少选择两个权重不为 0 的 LoRA。")

        out_path, rel_name = _output_path(output_name, output_subfolder)
        if os.path.exists(out_path) and not overwrite:
            raise FileExistsError(f"Output LoRA already exists: {out_path}")

        entries = []
        for item in selected:
            state = _load_lora(item["path"])
            pair_specs = _lora_pair_specs(state)
            if not pair_specs:
                raise ValueError(f"Unsupported LoRA format or no standard LoRA layers found: {item['name']}")
            entries.append({
                **item,
                "state": state,
                "pair_specs": pair_specs,
            })

        merged, stats = self._merge_simple_states(entries, save_dtype)
        if not merged:
            raise RuntimeError("没有可合并的 LoRA 权重，请检查选择的 LoRA 文件。")

        estimated_bytes = sum(t.numel() * t.element_size() for t in merged.values() if torch.is_tensor(t))
        max_bytes = 4 * 1024 * 1024 * 1024
        if estimated_bytes > max_bytes:
            raise RuntimeError(
                f"Refusing to save an unusually large merged LoRA ({estimated_bytes / (1024 ** 3):.2f} GB). "
                "Please lower ranks/select fewer LoRAs or use the original LoRAs chained at runtime."
            )

        metadata = {
            "whtools": "LoRA simple merged by WuhuoLoraSimpleMerge",
            "merge_strategy": "rank_concat_compact",
            "note": "Load the merged LoRA at strength 1.0. Weights are folded into lora_up and kept in compact low-rank format.",
        }
        for entry in entries:
            metadata[f"lora_{entry['index']}"] = str(entry["name"])
            metadata[f"weight_{entry['index']}"] = str(entry["weight"])

        _save_lora(merged, out_path, metadata)

        selected_text = ", ".join(f"{entry['name']}@{entry['weight']}" for entry in entries)
        info = (
            f"Saved {rel_name} | compact rank-concat merge | "
            f"LoRAs: {selected_text} | tensors: {len(merged)} | "
            f"merged layers: {stats['exact_pairs']} | "
            f"shape conflicts: {stats['shape_conflicts']} | skipped layers: {stats['skipped_layers']}"
        )
        return {"ui": {"text": [info]}, "result": (rel_name, out_path, info)}


NODE_CLASS_MAPPINGS = {
    "WuhuoLoraMerge": WuhuoLoraMerge,
    "WuhuoLoraSimpleMerge": WuhuoLoraSimpleMerge,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WuhuoLoraMerge": "LoRA 混合保存",
    "WuhuoLoraSimpleMerge": "LoRA 简单合并",
}
