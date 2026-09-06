"""Deterministic profile and shot prompt nodes for Z-Image workflows."""

from __future__ import annotations

from dataclasses import dataclass, asdict
import hashlib
from pathlib import Path
import re
from typing import Any, Dict, Iterable, List


PROFILE_TYPE = "ZIMAGE_FEATURE_LOCK"


def _lines(value: str) -> List[str]:
    return [line.strip() for line in (value or "").splitlines() if line.strip()]


def _section(title: str, values: Iterable[str]) -> List[str]:
    items = [value for value in values if value]
    return [f"【{title}】", *items] if items else []


@dataclass
class FeatureLock:
    always: List[str]
    front: List[str]
    three_quarter: List[str]
    side: List[str]
    back: List[str]
    closeup: List[str]
    fullbody: List[str]
    scene_fixed: List[str]
    scene_local: List[str]
    imaging_style: List[str]

    def as_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result["_type"] = PROFILE_TYPE
        return result


class ZImageCharacterFeatureLock:
    """Store one reusable, view-aware character and scene profile."""

    @classmethod
    def INPUT_TYPES(cls):
        multiline = {"multiline": True, "dynamicPrompts": False}
        return {
            "required": {
                "always_keep": ("STRING", {**multiline, "default": ""}),
                "front_visible": ("STRING", {**multiline, "default": ""}),
                "three_quarter_visible": ("STRING", {**multiline, "default": ""}),
                "side_visible": ("STRING", {**multiline, "default": ""}),
                "back_visible": ("STRING", {**multiline, "default": ""}),
                "closeup_visible": ("STRING", {**multiline, "default": ""}),
                "fullbody_visible": ("STRING", {**multiline, "default": ""}),
                "scene_fixed": ("STRING", {**multiline, "default": ""}),
                "scene_local": ("STRING", {**multiline, "default": ""}),
                "imaging_style": ("STRING", {**multiline, "default": ""}),
            }
        }

    RETURN_TYPES = (PROFILE_TYPE, "STRING")
    RETURN_NAMES = ("feature_lock", "profile_preview")
    FUNCTION = "build"
    CATEGORY = "wuhuo/Z-Image"

    def build(
        self,
        always_keep: str,
        front_visible: str,
        three_quarter_visible: str,
        side_visible: str,
        back_visible: str,
        closeup_visible: str,
        fullbody_visible: str,
        scene_fixed: str,
        scene_local: str,
        imaging_style: str,
    ):
        profile = FeatureLock(
            always=_lines(always_keep),
            front=_lines(front_visible),
            three_quarter=_lines(three_quarter_visible),
            side=_lines(side_visible),
            back=_lines(back_visible),
            closeup=_lines(closeup_visible),
            fullbody=_lines(fullbody_visible),
            scene_fixed=_lines(scene_fixed),
            scene_local=_lines(scene_local),
            imaging_style=_lines(imaging_style),
        )
        preview = "\n".join(
            _section("始终保留", profile.always)
            + _section("正面可见", profile.front)
            + _section("三分之二侧面可见", profile.three_quarter)
            + _section("侧面可见", profile.side)
            + _section("背面可见", profile.back)
            + _section("近景可见", profile.closeup)
            + _section("全身可见", profile.fullbody)
            + _section("场景固定", profile.scene_fixed)
            + _section("场景局部", profile.scene_local)
            + _section("固定成像风格", profile.imaging_style)
        )
        return (profile.as_dict(), preview)


ANGLE_LABELS = {
    "front": "正面",
    "front_three_quarter_left": "左前方三分之二",
    "front_three_quarter_right": "右前方三分之二",
    "side_left": "左侧面",
    "side_right": "右侧面",
    "back_three_quarter_left": "左后方三分之二",
    "back_three_quarter_right": "右后方三分之二",
    "back": "纯背面",
    "back_turn": "背面回头",
}

FRAMING_LABELS = {
    "closeup": "脸部或物件极近景",
    "bust": "胸像或半身近景",
    "medium": "中景",
    "full": "全身景",
    "wide": "远景",
}

HEIGHT_LABELS = {"eye": "平视", "high": "轻微俯拍", "low": "轻微仰拍", "top": "高位俯拍"}


class ZImageShotCompiler:
    """Compile a view-aware prompt without changing the fixed profile."""

    @classmethod
    def INPUT_TYPES(cls):
        multiline = {"multiline": True, "dynamicPrompts": False}
        return {
            "required": {
                "feature_lock": (PROFILE_TYPE,),
                "angle": (list(ANGLE_LABELS.keys()), {"default": "front"}),
                "framing": (list(FRAMING_LABELS.keys()), {"default": "medium"}),
                "camera_height": (list(HEIGHT_LABELS.keys()), {"default": "eye"}),
                "action": ("STRING", {**multiline, "default": ""}),
                "expression": ("STRING", {"default": ""}),
                "gaze": ("STRING", {"default": ""}),
                "shot_details": ("STRING", {**multiline, "default": ""}),
                "visibility_override": ("STRING", {**multiline, "default": ""}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("prompt", "included_features", "omitted_features")
    FUNCTION = "compile"
    CATEGORY = "wuhuo/Z-Image"

    def compile(
        self,
        feature_lock: Dict[str, Any],
        angle: str,
        framing: str,
        camera_height: str,
        action: str,
        expression: str,
        gaze: str,
        shot_details: str,
        visibility_override: str,
    ):
        profile = {key: list(value) for key, value in feature_lock.items() if isinstance(value, list)}
        angle_group = self._angle_group(angle)
        framing_group = self._framing_group(framing)

        included: List[str] = []
        omitted: List[str] = []

        def include(group: str, enabled: bool = True):
            values = profile.get(group, [])
            if enabled:
                included.extend(values)
            else:
                omitted.extend(values)

        include("always")
        include(angle_group)
        for group in {"front", "three_quarter", "side", "back"} - {angle_group, "always"}:
            include(group, False)
        include("closeup", framing in {"closeup", "bust"})
        include("fullbody", framing in {"full", "wide"})
        include("scene_fixed")
        include("scene_local", framing in {"medium", "full", "wide"})
        include("imaging_style")

        prompt_parts = [
            "同一人物与同一场景。",
            *included,
            f"当前镜头：{ANGLE_LABELS.get(angle, angle)}，{FRAMING_LABELS.get(framing, framing)}，{HEIGHT_LABELS.get(camera_height, camera_height)}。",
        ]
        if action.strip():
            prompt_parts.append(f"当前动作：{action.strip()}")
        if expression.strip():
            prompt_parts.append(f"当前表情：{expression.strip()}")
        if gaze.strip():
            prompt_parts.append(f"当前视线：{gaze.strip()}")
        if shot_details.strip():
            prompt_parts.append(f"当前镜头细节：{shot_details.strip()}")
        if visibility_override.strip():
            prompt_parts.append(f"可见性修正：{visibility_override.strip()}")
        prompt_parts.append("只改变当前镜头的角度、景别、动作、表情和视线；不要改变固定人物特征、服装、配饰设计和场景身份。")

        return (
            "\n".join(part for part in prompt_parts if part),
            "\n".join(included),
            "\n".join(omitted),
        )

    @staticmethod
    def _angle_group(angle: str) -> str:
        if angle == "front":
            return "front"
        if angle.startswith("front_three_quarter"):
            return "three_quarter"
        if angle.startswith("side"):
            return "side"
        return "back"

    @staticmethod
    def _framing_group(framing: str) -> str:
        return framing


ANGLE_ALIASES = {
    "正面": "front",
    "左前方三分之二": "front_three_quarter_left",
    "右前方三分之二": "front_three_quarter_right",
    "左侧面": "side_left",
    "右侧面": "side_right",
    "左后方三分之二": "back_three_quarter_left",
    "右后方三分之二": "back_three_quarter_right",
    "纯背面": "back",
    "背面": "back",
    "背面回头": "back_turn",
}

FRAMING_ALIASES = {
    "脸部特写": "closeup",
    "脸部或物件极近景": "closeup",
    "极近景": "closeup",
    "半身": "bust",
    "胸像": "bust",
    "中景": "medium",
    "全身": "full",
    "全身景": "full",
    "远景": "wide",
}

HEIGHT_ALIASES = {"平视": "eye", "俯拍": "high", "轻微俯拍": "high", "仰拍": "low", "轻微仰拍": "low", "高位俯拍": "top"}

GLOBAL_KEYS = {
    "始终保留": "always",
    "always": "always",
    "正面可见": "front",
    "front": "front",
    "三分之二侧面可见": "three_quarter",
    "three_quarter": "three_quarter",
    "侧面可见": "side",
    "side": "side",
    "背面可见": "back",
    "back": "back",
    "近景可见": "closeup",
    "closeup": "closeup",
    "全身可见": "fullbody",
    "fullbody": "fullbody",
    "场景固定": "scene_fixed",
    "scene_fixed": "scene_fixed",
    "场景局部": "scene_local",
    "scene_local": "scene_local",
    "固定成像风格": "imaging_style",
    "imaging_style": "imaging_style",
}

SHOT_KEYS = {
    "角度": "angle",
    "angle": "angle",
    "景别": "framing",
    "framing": "framing",
    "机位": "camera_height",
    "相机高度": "camera_height",
    "camera_height": "camera_height",
    "动作": "action",
    "action": "action",
    "表情": "expression",
    "expression": "expression",
    "视线": "gaze",
    "gaze": "gaze",
    "镜头细节": "shot_details",
    "当前镜头细节": "shot_details",
    "shot_details": "shot_details",
    "可见性修正": "visibility_override",
    "visibility_override": "visibility_override",
}


def _roman_or_arabic(value: str) -> int:
    value = value.strip().lower()
    if value.isdigit():
        return int(value)
    numerals = {"一": 1, "二": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10}
    if value in numerals:
        return numerals[value]
    if value.startswith("十"):
        return 10 + numerals.get(value[1:], 0)
    if value.endswith("十"):
        return numerals.get(value[:-1], 1) * 10
    return 1


def _heading(line: str) -> str:
    value = line.strip().strip("[]【】")
    return re.sub(r"^(?:shot|镜头)\s*", "", value, flags=re.IGNORECASE).strip()


class ZImageStoryboard:
    """Accept one ComfyUI story package and compile the selected shot."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "story_package": ("STRING", {"multiline": True, "dynamicPrompts": False, "default": ""}),
                "shot_index": (["1", "2", "3", "4", "5", "6"], {"default": "1"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("prompt", "package_preview", "available_shots")
    FUNCTION = "compile_story"
    CATEGORY = "wuhuo/Z-Image"

    def compile_story(self, story_package: str, shot_index: str):
        profile, shots = self._parse(story_package)
        index = int(shot_index)
        shot = shots.get(index, {})
        compiler = ZImageShotCompiler()
        lock = FeatureLock(**{key: profile.get(key, []) for key in FeatureLock.__dataclass_fields__}).as_dict()
        prompt, _, _ = compiler.compile(
            lock,
            ANGLE_ALIASES.get(shot.get("angle", "正面"), shot.get("angle", "front")),
            FRAMING_ALIASES.get(shot.get("framing", "中景"), shot.get("framing", "medium")),
            HEIGHT_ALIASES.get(shot.get("camera_height", "平视"), shot.get("camera_height", "eye")),
            shot.get("action", ""),
            shot.get("expression", ""),
            shot.get("gaze", ""),
            shot.get("shot_details", ""),
            shot.get("visibility_override", ""),
        )
        preview = "固定档案已解析；当前选择镜头：" + str(index)
        available = ", ".join(str(number) for number in sorted(shots)) or "未找到镜头"
        return prompt, preview, available

    @staticmethod
    def _parse(text: str):
        profile = {key: [] for key in FeatureLock.__dataclass_fields__}
        shots: Dict[int, Dict[str, str]] = {}
        section = "global"
        current_shot = None
        current_key = None
        for raw_line in (text or "").replace("```", "").splitlines():
            line = raw_line.strip()
            if not line:
                continue
            heading = _heading(line) if line.startswith(("[", "【")) else ""
            shot_match = re.match(r"^(\d+|[一二三四五六七八九十]+)$", heading)
            if shot_match:
                current_shot = _roman_or_arabic(shot_match.group(1))
                shots.setdefault(current_shot, {})
                section = "shot"
                current_key = None
                continue
            if heading:
                normalized = GLOBAL_KEYS.get(heading)
                if normalized:
                    section = "global"
                    current_shot = None
                    current_key = normalized
                    continue
                if heading in {"固定档案", "角色固定", "global", "story"}:
                    section = "global"
                    current_shot = None
                    current_key = None
                    continue
                if heading.startswith("镜头") or heading.lower().startswith("shot"):
                    current_shot = _roman_or_arabic(heading.split()[-1].replace("镜头", ""))
                    shots.setdefault(current_shot, {})
                    section = "shot"
                    current_key = None
                    continue
            field_match = re.match(r"^([^:：]{1,20})\s*[:：]\s*(.*)$", line)
            if field_match:
                key = field_match.group(1).strip()
                value = field_match.group(2).strip()
                if section == "shot" and current_shot is not None and key in SHOT_KEYS:
                    current_key = SHOT_KEYS[key]
                    shots[current_shot][current_key] = value
                    continue
                if section == "global" and key in GLOBAL_KEYS:
                    current_key = GLOBAL_KEYS[key]
                    if value:
                        profile[current_key].append(value)
                    continue
            if section == "shot" and current_shot is not None and current_key in SHOT_KEYS.values():
                shots[current_shot][current_key] = (shots[current_shot].get(current_key, "") + " " + line).strip()
            elif section == "global" and current_key in profile:
                profile[current_key].append(line)
        return profile, shots


def _default_story_file() -> str:
    comfy_root = Path(__file__).resolve().parents[2]
    return str(comfy_root / "user" / "default" / "whtools" / "zimage_story.txt")


class ZImageStoryboardFile:
    """Read a story package from disk so external tools can update it without pasting."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "story_file": ("STRING", {"default": _default_story_file()}),
                "shot_index": (["1", "2", "3", "4", "5", "6"], {"default": "1"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("prompt", "package_preview", "available_shots")
    FUNCTION = "compile_file"
    CATEGORY = "wuhuo/Z-Image"

    @classmethod
    def IS_CHANGED(cls, story_file: str, shot_index: str):
        path = Path(story_file).expanduser()
        try:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            return f"{shot_index}:{digest}"
        except OSError:
            return f"{shot_index}:missing:{path}"

    def compile_file(self, story_file: str, shot_index: str):
        path = Path(story_file).expanduser()
        if not path.is_file():
            raise FileNotFoundError(f"Z-Image story package not found: {path}")
        text = path.read_text(encoding="utf-8-sig")
        prompt, preview, available = ZImageStoryboard().compile_story(text, shot_index)
        return prompt, f"故事文件：{path}\n{preview}", available


class ZImageStoryboardSource:
    """Compile pasted AI output by default, with file loading as an optional source."""

    PASTE_MODE = "粘贴故事包"
    FILE_MODE = "读取故事文件"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "source_mode": ([cls.PASTE_MODE, cls.FILE_MODE], {"default": cls.PASTE_MODE}),
                "story_package": ("STRING", {"multiline": True, "dynamicPrompts": False, "default": ""}),
                "story_file": ("STRING", {"default": _default_story_file()}),
                "lora_trigger": ("STRING", {"default": "", "tooltip": "Raw LoRA trigger keyword(s), kept at the beginning of every shot prompt."}),
                "character_age": ("INT", {"default": 0, "min": 0, "max": 120, "step": 1, "tooltip": "Override character age for every shot; 0 keeps the story package age."}),
                "shot_count": (["自动全部", "1", "2", "3", "4"], {"default": "自动全部"}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING", "STRING")
    RETURN_NAMES = ("prompt", "source_preview", "available_shots")
    OUTPUT_IS_LIST = (True, False, False)
    FUNCTION = "compile_source"
    CATEGORY = "wuhuo/Z-Image"

    @classmethod
    def IS_CHANGED(cls, source_mode: str, story_package: str, story_file: str, lora_trigger: str, character_age: int, shot_count: str):
        override_digest = hashlib.sha256(f"{lora_trigger}\0{character_age}".encode("utf-8")).hexdigest()
        if source_mode == cls.FILE_MODE:
            return f"{ZImageStoryboardFile.IS_CHANGED(story_file, shot_count)}:{override_digest}"
        digest = hashlib.sha256((story_package or "").encode("utf-8")).hexdigest()
        return f"{shot_count}:{digest}:{override_digest}"

    def compile_source(self, source_mode: str, story_package: str, story_file: str, lora_trigger: str, character_age: int, shot_count: str):
        if source_mode == self.FILE_MODE:
            path = Path(story_file).expanduser()
            if not path.is_file():
                raise FileNotFoundError(f"Z-Image story package not found: {path}")
            text = path.read_text(encoding="utf-8-sig")
            source_label = f"故事文件：{path}"
        else:
            if not story_package.strip():
                raise ValueError("故事包为空：请粘贴任意 AI 生成的完整故事包，或切换到读取故事文件。")
            text = story_package
            source_label = "来源：粘贴故事包"

        profile, shots = ZImageStoryboard._parse(text)
        if shot_count == "自动全部":
            shot_numbers = sorted(shots)[:4]
            if not shot_numbers:
                raise ValueError("故事包中没有找到镜头；请检查 [镜头1]、[镜头2] 等标题。")
        else:
            selected = int(shot_count)
            if selected not in shots:
                raise ValueError(f"故事包没有镜头 {selected}；可用镜头为 {', '.join(map(str, sorted(shots)))}。")
            shot_numbers = [selected]

        compiler = ZImageShotCompiler()
        lock = FeatureLock(**{key: profile.get(key, []) for key in FeatureLock.__dataclass_fields__}).as_dict()
        prompts = []
        for number in shot_numbers:
            shot = shots[number]
            prompt, _, _ = compiler.compile(
                lock,
                ANGLE_ALIASES.get(shot.get("angle", "正面"), shot.get("angle", "front")),
                FRAMING_ALIASES.get(shot.get("framing", "中景"), shot.get("framing", "medium")),
                HEIGHT_ALIASES.get(shot.get("camera_height", "平视"), shot.get("camera_height", "eye")),
                shot.get("action", ""),
                shot.get("expression", ""),
                shot.get("gaze", ""),
                shot.get("shot_details", ""),
                shot.get("visibility_override", ""),
            )
            prompt = self._apply_overrides(prompt, lora_trigger, character_age)
            prompts.append(prompt)

        override_lines = []
        if lora_trigger.strip():
            override_lines.append(f"LoRA 触发词：{lora_trigger.strip()}")
        if character_age > 0:
            override_lines.append(f"角色年龄覆盖：{character_age}岁")
        preview = f"{source_label}\n一次输出镜头：{', '.join(map(str, shot_numbers))}"
        if override_lines:
            preview += "\n" + "\n".join(override_lines)
        available = ", ".join(str(number) for number in sorted(shots)) or "未找到镜头"
        return prompts, preview, available

    @staticmethod
    def _apply_overrides(prompt: str, lora_trigger: str, character_age: int) -> str:
        prefix = []
        if lora_trigger.strip():
            prefix.append(lora_trigger.strip())
        if character_age > 0:
            prefix.append(f"角色年龄固定为{character_age}岁，所有镜头保持同一年龄。")
        return "\n".join(prefix + [prompt]) if prefix else prompt


NODE_CLASS_MAPPINGS = {
    "ZImageCharacterFeatureLock": ZImageCharacterFeatureLock,
    "ZImageShotCompiler": ZImageShotCompiler,
    "ZImageStoryboard": ZImageStoryboard,
    "ZImageStoryboardFile": ZImageStoryboardFile,
    "ZImageStoryboardSource": ZImageStoryboardSource,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ZImageCharacterFeatureLock": "Z-Image 角色固定档案",
    "ZImageShotCompiler": "Z-Image 镜头条件编译",
    "ZImageStoryboard": "Z-Image 故事包导入",
    "ZImageStoryboardFile": "Z-Image 故事文件导入",
    "ZImageStoryboardSource": "Z-Image 故事来源导入（可批量）",
}
