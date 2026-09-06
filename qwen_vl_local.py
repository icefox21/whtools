import os
import sys
import time
import json
import urllib.request
import base64
import subprocess
import io
import re
import hashlib
import numpy as np
import torch
from PIL import Image

def _compute_tensor_fingerprint(tensor):
    if tensor is None:
        return "none"
    if not isinstance(tensor, torch.Tensor):
        return str(type(tensor))
    shape = tuple(tensor.shape)
    numel = tensor.numel()
    if numel == 0:
        return f"{shape}_empty"
    step = max(1, numel // 512)
    sample = tensor.detach().reshape(-1)[::step].cpu().numpy()
    return f"{shape}_{hashlib.md5(sample.tobytes()).hexdigest()[:16]}"

# 全局提示词反推缓存 (用于种子固定或相同输入时秒级复用)
_PROMPT_CACHE = {}
_LAST_GENERATED_RESULT = {}

def ensure_gateway_running(host="http://127.0.0.1:8080"):
    for _ in range(2):
        try:
            req = urllib.request.Request(f"{host}/v1/models")
            with urllib.request.urlopen(req, timeout=1.5) as res:
                if res.status == 200:
                    return True
        except Exception:
            vbs_path = r"O:\AI\runtime\start_gateway.vbs"
            if os.path.exists(vbs_path):
                subprocess.Popen(["wscript.exe", vbs_path])
            time.sleep(2.0)
    return False

def tensor_to_base64_jpeg(tensor_img, max_side=1536, quality=90):
    # tensor_img: [H, W, C], float32 (0.0 - 1.0)
    np_img = (tensor_img.detach().cpu().numpy() * 255.0).clip(0, 255).astype(np.uint8)
    pil_img = Image.fromarray(np_img)
    if pil_img.mode in ("RGBA", "LA", "P"):
        # 兼容透明通道与调色板图片，安全转为纯白底 RGB，防止 JPEG 格式报错
        bg = Image.new("RGB", pil_img.size, (255, 255, 255))
        if pil_img.mode == "RGBA":
            bg.paste(pil_img, mask=pil_img.split()[3])
            pil_img = bg
        else:
            pil_img = pil_img.convert("RGB")
    elif pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")

    w, h = pil_img.size
    if max(w, h) > max_side:
        scale = max_side / max(w, h)
        pil_img = pil_img.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=quality)
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/jpeg;base64,{b64}"

PRESETS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "qwen_vl_presets")

# ---- 本地可用模型列表 ----
# key = 显示名称 (下拉框里展示给用户)
# value = 传给 llama-server 的 model 字段
MODEL_OPTIONS = {
    "YMQ-M 32K 极道甜点版   (Qwen3.8-27B-YMQ-M)":           "qwen3.8-27b-ymq-m",
    "M-TI 72K 靶向绝缘版   (Qwen3.8-27B-YMQ-M-TI)":        "qwen3.8-27b-ymq-m-ti",
    "XS-Pro 64K 满血旗舰版 (Qwen3.8-27B-YMQ-XS-Pro)":      "qwen3.8-27b-ymq-xs-pro",
    "RVN-IQ3_M 64K 多语言旗舰版 (Qwen3.8-27B-RVN-IQ3_M-MTP)": "qwen3.8-27b-rvn-iq3-m",
    # 兼容历史已保存工作流
    "M-TI 64K 靶向绝缘版   (Qwen3.8-27B-YMQ-M-TI)":        "qwen3.8-27b-ymq-m-ti",
    "XS-Pro 128K 满血旗舰版 (Qwen3.8-27B-YMQ-XS-Pro)":     "qwen3.8-27b-ymq-xs-pro",
}
_MODEL_DISPLAY_NAMES = [
    "YMQ-M 32K 极道甜点版   (Qwen3.8-27B-YMQ-M)",
    "M-TI 72K 靶向绝缘版   (Qwen3.8-27B-YMQ-M-TI)",
    "XS-Pro 64K 满血旗舰版 (Qwen3.8-27B-YMQ-XS-Pro)",
    "RVN-IQ3_M 64K 多语言旗舰版 (Qwen3.8-27B-RVN-IQ3_M-MTP)",
]

def resolve_model_id(model_name):
    if not model_name:
        return "qwen3.8-27b-ymq-m"
    if model_name in MODEL_OPTIONS:
        return MODEL_OPTIONS[model_name]
    m_lower = str(model_name).lower()
    if "m-ti" in m_lower or "72k" in m_lower or ("64k" in m_lower and "rvn" not in m_lower and "xs" not in m_lower):
        return "qwen3.8-27b-ymq-m-ti"
    elif "xs-pro" in m_lower:
        return "qwen3.8-27b-ymq-xs-pro"
    elif "rvn" in m_lower:
        return "qwen3.8-27b-rvn-iq3-m"
    elif "ymq-m" in m_lower:
        return "qwen3.8-27b-ymq-m"
    return "qwen3.8-27b-ymq-m"


def get_preset_list():
    default_order = [
        "单人写真专用诱惑姿势 (可变数量)",
        "双人多人做爱专用姿势 (可变数量)",
        "写真专用诱惑姿势可变数量",
        "写真专用诱惑姿势",
        "喵呜套系写真专用 (8K多图分段)",
        "通用高画质视觉反推",
        "简短自然语言提示词",
        "人物肖像细节精修",
    ]
    found = []
    if os.path.exists(PRESETS_DIR):
        for f in sorted(os.listdir(PRESETS_DIR)):
            if f.endswith((".txt", ".md")) and not f.startswith(("_", ".")) and f.lower() not in ("agents.md", "readme.md"):
                name = os.path.splitext(f)[0]
                if name not in found:
                    found.append(name)
    
    # 按照优先列表排序，并保留用户额外新增的预设
    ordered = [p for p in default_order if p in found]
    for f in found:
        if f not in ordered:
            ordered.append(f)
    
    ordered.append("无 (None)")
    return ordered

def load_preset_text(preset_name):
    if not preset_name or preset_name == "无 (None)":
        return ""
    if not os.path.exists(PRESETS_DIR):
        return ""
    for ext in [".txt", ".md", ""]:
        p = os.path.join(PRESETS_DIR, preset_name + ext)
        if os.path.exists(p):
            try:
                with open(p, "r", encoding="utf-8", errors="ignore") as f:
                    return f.read().strip()
            except Exception as e:
                print(f"[QwenVL Preset Error]: {e}", file=sys.stderr)
    return ""


class PromptProtocolError(ValueError):
    """Raised when Qwen did not return a clean prompt protocol."""


def _message_text(value):
    """Normalize OpenAI-compatible content/reasoning fields to plain text."""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        chunks = []
        for item in value:
            if isinstance(item, str):
                chunks.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                chunks.append(item["text"])
        return "".join(chunks)
    return ""


def _requested_prompt_count(custom_prompt, default=4):
    """Read the count inserted by the workflow's '[数字]：X' wrapper."""
    text = custom_prompt or ""
    # Primary: workflow格式 '[数字]：N' (by CR Text Replace node)
    m = re.search(r'\[数字\][：:]\s*(\d+)', text)
    if not m:
        # Fallback: 行首裸数字
        m = re.match(r'^\s*(\d+)', text)
    if not m:
        return default
    return max(1, int(m.group(1)))


def extract_prompt_protocol(raw_text, expected_count=4):
    """Extract only the final prompt protocol from a reasoning-heavy reply.

    The workflow consumes exactly one global prompt and N difference prompts.
    Any prose before the final block, Markdown headings, or self-review text
    must never reach the image model. The @END@ sentinel is preferred, but a
    complete response ending at the final difference prompt is also accepted
    after strict marker/count/content validation.
    """
    raw = _message_text(raw_text).replace(chr(13) + chr(10), chr(10)).replace(chr(13), chr(10))
    if not raw.strip():
        return ""

    body = raw
    if "</think>" in body:
        body = body.split("</think>")[-1].strip()

    m_matches = list(re.finditer(r"@M@", body))
    if not m_matches:
        return ""

    # Try from right to left so protocol examples in reasoning are ignored.
    for m_match in reversed(m_matches):
        prefix = body[:m_match.start()]
        starts = list(re.finditer(r"(?i)\bconsistent\s+", prefix))
        start = starts[0].start() if starts else 0
        end_marker = body.find("@END@", m_match.end())
        # Prefer the explicit sentinel. If the model ran out of output space,
        # use the response end only after the strict validation below passes.
        end = end_marker if end_marker >= 0 else len(body)
        candidate = body[start:end].strip().strip('`"\'')
        parts = candidate.split("@M@", 1)
        if len(parts) != 2:
            continue

        global_prompt, differences_text = parts
        differences = differences_text.split("@.@")
        while differences and not differences[-1].strip():
            differences.pop()
        if expected_count and len(differences) != expected_count:
            continue

        cleaned = [" ".join(x.strip().strip('`\"\'').split()) for x in [global_prompt] + differences]
        if not cleaned[0] or any(not x for x in cleaned[1:]):
            continue

        # Strong indicators that the selected block is still model analysis.
        joined = " ".join(cleaned).lower()
        if any(token in joined for token in (
            "let me", "i reviewed", "i'll", "i will", "i need to", "i should",
            "let's check", "actually, re-reading", "final answer:", "self-check", "output format:",
            "step 1:", "step 2:", "step 3:", "step 4:",
            "now i need", "in summary, i"
        )):
            continue

        return "@M@".join([cleaned[0], "@.@".join(cleaned[1:])])

    return ""


class WuhuoQwenVLLocalFast:
    """
    wuhuo Qwen-VL 本地极速多模态 API 节点 (5070Ti)
    - 直连本地 Buun-llama.cpp 8080 端口
    - 支持提示词预设模板库 (qwen_vl_presets 目录)
    - 支持运行完毕后立即 100% 彻底释放显存
    - 兼容单图、多图、视频帧与提示词输入
    """
    @classmethod
    def INPUT_TYPES(cls):
        presets = get_preset_list()
        default_preset = presets[0] if presets else "无 (None)"
        return {
            "required": {
                "preset": (presets, {"default": default_preset}),
            },
            "optional": {
                "image": ("IMAGE",),
                "video": ("IMAGE",),
                "custom_prompt": ("STRING", {"multiline": True, "default": "", "dynamicPrompts": False}),
                "frame_count": ("INT", {"default": 16, "min": 1, "max": 64, "step": 1}),
                "max_tokens": ("INT", {"default": 4096, "min": 64, "max": 8192, "step": 64}),
                "temperature": ("FLOAT", {"default": 0.1, "min": 0.0, "max": 2.0, "step": 0.05}),
                "top_p": ("FLOAT", {"default": 0.9, "min": 0.0, "max": 1.0, "step": 0.05}),
                "api_host": ("STRING", {"default": "http://127.0.0.1:8080"}),
                "model": (_MODEL_DISPLAY_NAMES, {"default": _MODEL_DISPLAY_NAMES[0]}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "unload_after_run": ("BOOLEAN", {"default": True, "label_on": "清理显存 (推荐)", "label_off": "保持常驻"}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("RESPONSE", "RAW_TRACE")
    FUNCTION = "generate"
    CATEGORY = "wuhuo"

    @classmethod
    def IS_CHANGED(cls, preset="", seed=0, custom_prompt="", model=None, image=None, video=None, **kwargs):
        img_fp = _compute_tensor_fingerprint(image) if image is not None else ""
        vid_fp = _compute_tensor_fingerprint(video) if video is not None else ""
        return f"{preset}_{seed}_{custom_prompt}_{model}_{img_fp}_{vid_fp}"

    def generate(self, preset="喵呜套系写真专用 (8K多图分段)", image=None, video=None, custom_prompt="", frame_count=16, max_tokens=4096, temperature=0.1, top_p=0.9, api_host="http://127.0.0.1:8080", model=None, seed=0, unload_after_run=True, unique_id=None, **kwargs):
        node_key = str(unique_id) if unique_id is not None else "default"
        resolved_model = resolve_model_id(model)
        user_input = custom_prompt.strip() if custom_prompt else ""
        img_fp = _compute_tensor_fingerprint(image)
        vid_fp = _compute_tensor_fingerprint(video)

        cache_key = (node_key, resolved_model, preset, user_input, seed, img_fp, vid_fp)
        last_state = _LAST_GENERATED_RESULT.get(node_key)

        should_use_cache = False
        cached_reply = None
        cached_trace = None

        # 只要种子不变（fixed）且输入一致，自动秒级复用上次反推结果
        if cache_key in _PROMPT_CACHE:
            should_use_cache = True
            cached_reply, cached_trace = _PROMPT_CACHE[cache_key]
        elif (
            last_state
            and last_state.get("seed") == seed
            and last_state.get("img_fp") == img_fp
            and last_state.get("vid_fp") == vid_fp
            and last_state.get("preset") == preset
            and last_state.get("user_input") == user_input
            and last_state.get("model") == resolved_model
            and last_state.get("reply")
        ):
            should_use_cache = True
            cached_reply = last_state["reply"]
            cached_trace = last_state["raw_trace"]

        if should_use_cache and cached_reply:
            print(f"[QwenVL] >>> 种子固定 (Seed: {seed}) 命中提示词缓存，直接复用上次反推结果！(跳过模型调用)", flush=True)
            return (cached_reply, cached_trace)

        # 1. 运行前清空 ComfyUI 驻留显存，确保 Qwen-VL 独占 100% 满血显存
        try:
            import comfy.model_management as mm
            mm.unload_all_models()
            mm.soft_empty_cache()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass

        ensure_gateway_running(api_host)

        # 解析模型显示名 → llama-server model ID
        print(f"[QwenVL] 使用模型: {model or '默认'} → {resolved_model}", flush=True)

        # 2. 组合预设模板与用户自定义提示词
        template_text = load_preset_text(preset)
        user_input = custom_prompt.strip() if custom_prompt else ""
        
        if template_text:
            if user_input:
                prompt_text = f"<|think_off|>{template_text}\n\n### 用户具体输入与补充要求\n{user_input}"
            else:
                prompt_text = f"<|think_off|>{template_text}"
        else:
            prompt_text = f"<|think_off|>{user_input if user_input else 'Describe the image or video in detail.'}"
            
        content = [{"type": "text", "text": prompt_text}]
        
        # 3. 提取视频连续帧 (按标准 512px 抽取，确保 16 帧在 30 秒内秒级完成计算)
        if video is not None and isinstance(video, torch.Tensor) and len(video.shape) == 4:
            b_size = video.shape[0]
            if b_size > 0:
                sample_indices = np.linspace(0, b_size - 1, min(b_size, frame_count), dtype=int)
                for idx in sample_indices:
                    frame_b64 = tensor_to_base64_jpeg(video[idx], max_side=512, quality=85)
                    content.append({"type": "image_url", "image_url": {"url": frame_b64}})
        
        # 4. 提取单张/多张图片
        elif image is not None and isinstance(image, torch.Tensor):
            if len(image.shape) == 3:
                image = image.unsqueeze(0)
            if len(image.shape) == 4:
                b_size = image.shape[0]
                for idx in range(b_size):
                    max_side = 2048 if b_size == 1 else 1024
                    img_b64 = tensor_to_base64_jpeg(image[idx], max_side=max_side, quality=95)
                    content.append({"type": "image_url", "image_url": {"url": img_b64}})
        
        payload = {
            "model": resolved_model,

            "messages": [{"role": "user", "content": content}],
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": top_p,
            "seed": seed,
            "stream": False,
            "cache_prompt": False,
            "enable_thinking": False
        }
        
        req = urllib.request.Request(
            f"{api_host}/v1/chat/completions",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        
        reply = ""
        raw_trace = ""
        try:
            with urllib.request.urlopen(req, timeout=360) as res:
                data = json.loads(res.read().decode("utf-8"))
                choice = data.get("choices", [{}])[0]
                msg = choice.get("message", {})
                raw_trace = json.dumps(data, ensure_ascii=False)

                # Never pass chain-of-thought or a malformed response to the
                # image model. Prefer the final content channel; only inspect
                # reasoning_content as a fallback if it contains a valid final
                # protocol block with the required separators.
                is_protocol_required = ("@M@" in template_text) or ("@M@" in user_input)
                expected_count = _requested_prompt_count(user_input, default=4)
                reply = ""
                source_used = ""
                
                if is_protocol_required:
                    for source_name, source_value in (
                        ("content", msg.get("content")),
                        ("reasoning_content", msg.get("reasoning_content")),
                    ):
                        candidate = extract_prompt_protocol(source_value, expected_count)
                        if candidate:
                            reply = candidate
                            source_used = source_name
                            break

                    if not reply:
                        c_preview = (msg.get("content") or "")[:200].replace("\n", " ")
                        r_preview = (msg.get("reasoning_content") or "")[:200].replace("\n", " ")
                        print(f"[QwenVL Debug] Raw content: {c_preview}", file=sys.stderr, flush=True)
                        print(f"[QwenVL Debug] Raw reasoning: {r_preview}", file=sys.stderr, flush=True)
                        raise PromptProtocolError(
                            f"Qwen response is not a valid final prompt protocol "
                            f"(expected {expected_count} difference prompts); "
                            "raw reasoning was blocked from the image model"
                        )

                    print(
                        f"[QwenVL] extracted final prompt protocol from {source_used}; "
                        f"difference_count={expected_count}",
                        flush=True,
                    )
                else:
                    reply = (msg.get("content") or "").strip()
                    if not reply:
                        reply = (msg.get("reasoning_content") or "").strip()
                    if not reply:
                        raise RuntimeError("Qwen returned an empty response.")
                    print("[QwenVL] direct content extracted (freeform prompt mode)", flush=True)
                _PROMPT_CACHE[cache_key] = (reply, raw_trace)
                _LAST_GENERATED_RESULT[node_key] = {
                    "seed": seed,
                    "preset": preset,
                    "user_input": user_input,
                    "model": resolved_model,
                    "img_fp": img_fp,
                    "vid_fp": vid_fp,
                    "reply": reply,
                    "raw_trace": raw_trace,
                }
                return (reply, raw_trace)
        except PromptProtocolError as e:
            print(f"[QwenVL Protocol Error]: {e}", file=sys.stderr, flush=True)
            raise
        except Exception as e:
            err_msg = f"[WuhuoQwenVLLocalFast Error]: {e}"
            print(err_msg, file=sys.stderr, flush=True)
            raise RuntimeError(err_msg) from e
        finally:
            if unload_after_run:
                try:
                    unload_req = urllib.request.Request(f"{api_host}/v1/unload", method="POST")
                    with urllib.request.urlopen(unload_req, timeout=3.0) as u_res:
                        pass
                except Exception:
                    pass
                
                # 给 Windows WDDM 驱动 300ms 回收显存页面，确保后续节点加载显存不冲突
                time.sleep(0.3)
                if torch.cuda.is_available():
                    try:
                        torch.cuda.empty_cache()
                    except Exception:
                        pass


class WuhuoQwenVLImageFast(WuhuoQwenVLLocalFast):
    """wuhuo Qwen-VL 单图极速反推 (5070Ti)"""
    pass

class WuhuoQwenVLVideoFast(WuhuoQwenVLLocalFast):
    """wuhuo Qwen-VL 视频极速反推 (5070Ti)"""
    pass

NODE_CLASS_MAPPINGS = {
    "WuhuoQwenVLLocalFast": WuhuoQwenVLLocalFast,
    "WuhuoQwenVLImageFast": WuhuoQwenVLImageFast,
    "WuhuoQwenVLVideoFast": WuhuoQwenVLVideoFast,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WuhuoQwenVLLocalFast": "wuhuo Qwen-VL 本地极速反推 (5070Ti)",
    "WuhuoQwenVLImageFast": "wuhuo Qwen-VL 单图极速反推 (5070Ti)",
    "WuhuoQwenVLVideoFast": "wuhuo Qwen-VL 视频极速反推 (5070Ti)",
}
