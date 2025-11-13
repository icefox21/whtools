import os

CATEGORY = "wuhuo"

class jdsc:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = False
    CATEGORY = CATEGORY

    def run(self):
        return ()

NODE_CLASS_MAPPINGS = {"jdsc": jdsc}
NODE_DISPLAY_NAME_MAPPINGS = {"jdsc": "收藏+"}

WEB_DIRECTORY = os.path.join(os.path.dirname(__file__), "web")
