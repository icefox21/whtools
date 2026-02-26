# Copyright (c) 2024-2026 icefox21
# This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
# Project Link: https://github.com/icefox21/whtools

class AnyType(str):
    """A special class that is always equal in not equal comparisons."""
    def __eq__(self, _) -> bool:
        return True
    def __ne__(self, __value: object) -> bool:
        return False

any_type = AnyType("*")

class WuhuoSwitchAny:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "boolean": ("BOOLEAN", {"default": True}),
                "options": ("STRING", {"multiline": True, "default": "on_true\non_false"}),
            },
            "optional": {
                "on_true": (any_type, {"lazy": True}),
                "on_false": (any_type, {"lazy": True}),
            }
        }

    RETURN_TYPES = (any_type,)
    FUNCTION = "execute"
    CATEGORY = "wuhuo/switch"

    def check_lazy_status(self, boolean, options, on_true=None, on_false=None):
        # 只请求需要的输入
        needed = "on_true" if boolean else "on_false"
        return [needed]

    def execute(self, boolean, options, on_true=None, on_false=None):
        if boolean:
            return (on_true,)
        else:
            return (on_false,)

class WuhuoSelectorAny:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "select": ("INT", {"default": 1, "min": 1, "max": 10, "step": 1}),
                "options": ("STRING", {"multiline": True, "default": "input_1\ninput_2\ninput_3\ninput_4\ninput_5"}),
            },
            "optional": {
                "input_1": (any_type, {"lazy": True}),
                "input_2": (any_type, {"lazy": True}),
                "input_3": (any_type, {"lazy": True}),
                "input_4": (any_type, {"lazy": True}),
                "input_5": (any_type, {"lazy": True}),
                "input_6": (any_type, {"lazy": True}),
                "input_7": (any_type, {"lazy": True}),
                "input_8": (any_type, {"lazy": True}),
                "input_9": (any_type, {"lazy": True}),
                "input_10": (any_type, {"lazy": True}),
            }
        }

    RETURN_TYPES = (any_type,)
    FUNCTION = "execute"
    CATEGORY = "wuhuo/switch"

    def check_lazy_status(self, select, options, **kwargs):
        # 只请求选中的那个输入
        idx = max(1, min(select, 10))
        needed = f"input_{idx}"
        return [needed]

    def execute(self, select, options, **kwargs):
        idx = max(1, min(select, 10))
        key = f"input_{idx}"
        val = kwargs.get(key, None)
        return (val,)
