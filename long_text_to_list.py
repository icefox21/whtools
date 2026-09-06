# Copyright (c) 2024-2026 icefox21
# This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
# Ported from ComfyUI_Lam (yanlang0123/ComfyUI_Lam)

class WuhuoLongTextToList:
    """
    将长文本按指定分隔符（默认换行符 \\n）分割为字符串列表，
    并支持按索引提取指定位置的文本，同时输出列表总长度。
    兼容 ComfyUI_Lam 的 LongTextToList 节点。
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "text": ("STRING", {"multiline": True, "default": "", "dynamicPrompts": False}),
                "i": ("INT", {"default": 0, "min": 0, "max": 99999, "step": 1}),
                "delimiter": ("STRING", {"default": "\\n", "multiline": False}),
            }
        }

    RETURN_TYPES = ("STRING", "LIST", "INT",)
    RETURN_NAMES = ("下标i文本", "数组", "数组长度",)
    FUNCTION = "text_to_list"
    CATEGORY = "wuhuo/文本"

    def text_to_list(self, text, i, delimiter):
        # 兼容转义换行、制表符等
        if delimiter is None or delimiter == "":
            sep = "\n"
        else:
            sep = delimiter.replace("\\n", "\n").replace("\\r", "\r").replace("\\t", "\t")

        # 文本分割
        if not text:
            str_list = [""]
        else:
            str_list = text.split(sep)

        # 安全获取第 i 个下标的元素
        if isinstance(i, (list, tuple)):
            idx = int(i[0]) if len(i) > 0 else 0
        else:
            try:
                idx = int(i)
            except Exception:
                idx = 0

        if 0 <= idx < len(str_list):
            selected = str_list[idx]
        elif len(str_list) > 0 and -len(str_list) <= idx < 0:
            selected = str_list[idx]
        else:
            selected = ""

        return (selected, str_list, len(str_list))


class WuhuoTextListSelect:
    """
    从字符串列表中按索引选取元素。
    兼容 ComfyUI_Lam 的 TextListSelelct 节点。
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "i": ("INT", {"default": 0, "min": 0, "max": 99999, "step": 1}),
                "text_list": ("LIST", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("文本",)
    FUNCTION = "text_list_select"
    CATEGORY = "wuhuo/文本"

    def text_list_select(self, i, text_list):
        if text_list and 0 <= i < len(text_list):
            return (text_list[i],)
        elif text_list and -len(text_list) <= i < 0:
            return (text_list[i],)
        return ("",)


class WuhuoPrimitiveString:
    """
    通用字符串输入/传递原语节点。
    兼容各工作流中的 PrimitiveString 节点。
    """
    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "value": ("STRING", {"multiline": True, "default": "", "dynamicPrompts": False}),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("STRING",)
    FUNCTION = "execute"
    CATEGORY = "wuhuo/文本"

    def execute(self, value=""):
        return (value,)


class WuhuoSeedList:
    """Generate one deterministic, distinct seed for each loop item."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "base_seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "count": ("INT", {"default": 4, "min": 1, "max": 99999}),
            }
        }

    RETURN_TYPES = ("INT",)
    RETURN_NAMES = ("seed",)
    OUTPUT_IS_LIST = (True,)
    FUNCTION = "make_seed_list"
    CATEGORY = "wuhuo/文本"

    def make_seed_list(self, base_seed=0, count=4):
        base = int(base_seed) & 0xffffffffffffffff
        total = max(1, int(count))
        return ([((base + i) & 0xffffffffffffffff) for i in range(total)],)


NODE_CLASS_MAPPINGS = {
    "LongTextToList": WuhuoLongTextToList,
    "WuhuoLongTextToList": WuhuoLongTextToList,
    "TextListSelect": WuhuoTextListSelect,
    "TextListSelelct": WuhuoTextListSelect,
    "WuhuoTextListSelect": WuhuoTextListSelect,
    "PrimitiveString": WuhuoPrimitiveString,
    "WuhuoPrimitiveString": WuhuoPrimitiveString,
    "WuhuoSeedList": WuhuoSeedList,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "LongTextToList": "长文本分割转列表 (LongTextToList)",
    "WuhuoLongTextToList": "长文本分割转列表+",
    "TextListSelect": "文本列表选择 (TextListSelect)",
    "TextListSelelct": "文本列表选择 (Lam兼容)",
    "WuhuoTextListSelect": "文本列表选择+",
    "PrimitiveString": "字符串原语 (PrimitiveString)",
    "WuhuoPrimitiveString": "字符串原语+",
    "WuhuoSeedList": "独立种子列表+",
}

