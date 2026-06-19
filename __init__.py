# Copyright (c) 2024-2026 icefox21
# This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
# Project Link: https://github.com/icefox21/whtools

import os
import asyncio

CATEGORY = "wuhuo"

try:
    from .switch_any import WuhuoSwitchAny, WuhuoSelectorAny
    from .simple_math import WuhuoSimpleMath
except Exception as e:
    WuhuoSwitchAny = None
    WuhuoSelectorAny = None
    WuhuoSimpleMath = None
    print(f"[whtools] 鍩虹鑺傜偣妯″潡鍔犺浇澶辫触: {e}")

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
NODE_DISPLAY_NAME_MAPPINGS = {"jdsc": "鏀惰棌+"}

WEB_DIRECTORY = os.path.join(os.path.dirname(__file__), "web")
DATA_DIRECTORY = os.path.join(os.path.dirname(__file__), "data")
FAV_FILE = os.path.join(DATA_DIRECTORY, "favorites.json")
FRAG_FILE = os.path.join(DATA_DIRECTORY, "frags.json")
SETTINGS_FILE = os.path.join(DATA_DIRECTORY, "settings.json")
NODES_FILE = os.path.join(DATA_DIRECTORY, "nodes.json")
ENHANCE_PRESETS_FILE = os.path.join(DATA_DIRECTORY, "enhance_presets.json")

ENHANCE_PRESETS_TXT = os.path.join(DATA_DIRECTORY, "enhance_presets.txt")

# 鍔犺浇寮哄寲璇嶉璁?
def _load_enhance_presets():
    # 浼樺厛鍔犺浇 TXT 鏍煎紡锛堟柟渚跨敤鎴风紪杈戯級
    if os.path.exists(ENHANCE_PRESETS_TXT):
        try:
            presets = {}
            current_key = None
            current_lines = []
            
            with open(ENHANCE_PRESETS_TXT, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or line.startswith("//"):
                        continue
                        
                    if line.startswith("[") and line.endswith("]"):
                        # 淇濆瓨涓婁竴涓?
                        if current_key:
                            presets[current_key] = ", ".join(current_lines)
                        
                        # 寮€濮嬫柊鐨?
                        current_key = line[1:-1].strip()
                        current_lines = []
                    else:
                        if current_key is not None:
                            current_lines.append(line)
                            
                # 淇濆瓨鏈€鍚庝竴涓?
                if current_key:
                    presets[current_key] = ", ".join(current_lines)
            
            if presets:
                # 确保"无"选项存在
                if "无" not in presets:
                    presets = {"无": "", **presets}
                return presets
        except Exception as e:
            print(f"[whtools] Error loading enhance_presets.txt: {e}")

    # 闄嶇骇鍔犺浇 JSON 鏍煎紡
    try:
        if os.path.exists(ENHANCE_PRESETS_FILE):
            with open(ENHANCE_PRESETS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, dict) and len(data) > 0:
                    return data
    except Exception as e:
        print(f"[whtools] Error loading enhance presets: {e}")
    return {"无": ""}
try:
    import sys
    # 淇妯″潡鍐茬獊锛氬鏋?comfy.utils 琚敊璇湴鍔犺浇涓洪《灞?utils 妯″潡锛屼細瀵艰嚧 server 瀵煎叆澶辫触
    # 姝ラ1锛氭竻鐞?sys.modules 涓敊璇殑 utils 妯″潡
    if 'utils' in sys.modules:
        try:
            m = sys.modules['utils']
            if hasattr(m, '__file__') and m.__file__ and 'comfy' in m.__file__.replace('\\', '/').lower():
                if 'utils.py' in m.__file__.lower() or m.__file__.lower().endswith('utils'):
                    print(f"[whtools] 妫€娴嬪埌閿欒鐨?utils 妯″潡 ({m.__file__})锛屾鍦ㄤ慨澶?..")
                    del sys.modules['utils']
        except Exception:
            pass
    
    # 姝ラ2锛氭竻鐞?sys.path 涓寚鍚?comfy 瀛愮洰褰曠殑閿欒璺緞
    # 杩欓槻姝?server 瀵煎叆鏃跺啀娆″姞杞介敊璇殑 utils
    paths_to_remove = []
    for p in sys.path:
        try:
            normalized = p.replace('\\', '/').rstrip('/')
            # 鍙Щ闄や互 /comfy 缁撳熬涓斾笉鍦?custom_nodes 涓殑璺緞
            if normalized.lower().endswith('/comfy') and 'custom_nodes' not in normalized.lower():
                paths_to_remove.append(p)
        except Exception:
            pass
    for p in paths_to_remove:
        try:
            sys.path.remove(p)
            print(f"[whtools] 宸蹭粠 sys.path 绉婚櫎閿欒璺緞: {p}")
        except Exception:
            pass

    from server import PromptServer
    from aiohttp import web
    import json

except Exception as e:
    import traceback
    import sys
    error_log = os.path.join(os.path.dirname(__file__), "jdsc_error.log")
    with open(error_log, "w", encoding="utf-8") as f:
        f.write(f"Error importing server: {e}\n")
        if 'utils' in sys.modules:
            f.write(f"sys.modules['utils']: {sys.modules['utils']}\n")
            if hasattr(sys.modules['utils'], '__file__'):
                f.write(f"utils file: {sys.modules['utils'].__file__}\n")
        f.write(traceback.format_exc())
    PromptServer = None
    web = None

def _ensure_data():
    try:
        os.makedirs(DATA_DIRECTORY, exist_ok=True)
        if not os.path.exists(FAV_FILE):
            with open(FAV_FILE, "w", encoding="utf-8") as f:
                f.write("{}")
        if not os.path.exists(FRAG_FILE):
            with open(FRAG_FILE, "w", encoding="utf-8") as f:
                f.write("[]")
        if not os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                f.write("{}")
        if not os.path.exists(NODES_FILE):
            with open(NODES_FILE, "w", encoding="utf-8") as f:
                f.write("{}")
    except Exception:
        pass

_ensure_data()

if PromptServer is not None and web is not None:
    # 鍐欏叆 JSON 鏂囦欢锛堝甫瀹归敊锛?
    def _write_json(path, data):
        try:
            with open(path, "w", encoding="utf-8") as f:
                __import__('json').dump(data, f, ensure_ascii=False, indent=2)
            return True
        except Exception:
            return False

    @PromptServer.instance.routes.get("/jdsc/favorites")
    async def jdsc_get_favorites(request):
        try:
            with open(FAV_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {}
        return web.Response(text=json.dumps(data, ensure_ascii=False), content_type='application/json')

    @PromptServer.instance.routes.post("/jdsc/favorites_save")
    async def jdsc_set_favorites(request):
        try:
            payload = await request.json()
        except Exception as e:
            return web.json_response({"ok": False, "error": f"Invalid JSON: {e}"}, status=400)
        
        if not isinstance(payload, dict):
            return web.json_response({"ok": False, "error": "Invalid data format: expected dict"}, status=400)
        try:
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            with open(FAV_FILE, "w", encoding="utf-8") as f:
                json.dump(payload if isinstance(payload, dict) else {}, f, ensure_ascii=False, indent=2)
            return web.json_response({"ok": True})
        except Exception as e:
            return web.json_response({"ok": False, "error": str(e)}, status=500)

    @PromptServer.instance.routes.get("/jdsc/frags")
    async def jdsc_get_frags(request):
        try:
            with open(FRAG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, list):
                data = []
        except Exception:
            data = []
        return web.Response(text=json.dumps(data, ensure_ascii=False), content_type='application/json')

    @PromptServer.instance.routes.post("/jdsc/frags_save")
    async def jdsc_set_frags(request):
        try:
            payload = await request.json()
        except Exception as e:
            return web.json_response({"ok": False, "error": f"Invalid JSON: {e}"}, status=400)
            
        if not isinstance(payload, list):
            return web.json_response({"ok": False, "error": "Invalid data format: expected list"}, status=400)
        try:
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            with open(FRAG_FILE, "w", encoding="utf-8") as f:
                json.dump(payload if isinstance(payload, list) else [], f, ensure_ascii=False, indent=2)
            return web.json_response({"ok": True})
        except Exception as e:
            return web.json_response({"ok": False, "error": str(e)}, status=500)

    @PromptServer.instance.routes.get("/jdsc/enhance_presets")
    async def jdsc_get_enhance_presets(request):
        try:
            presets = _load_enhance_presets()
        except Exception:
            presets = {"无": ""}
        return web.json_response(presets)

    @PromptServer.instance.routes.get("/jdsc/settings")
    async def jdsc_get_settings(request):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                data = {}
        except Exception:
            data = {}
        return web.Response(text=json.dumps(data, ensure_ascii=False), content_type='application/json')

    @PromptServer.instance.routes.post("/jdsc/settings_save")
    async def jdsc_set_settings(request):
        try:
            payload = await request.json()
        except Exception as e:
            return web.json_response({"ok": False, "error": f"Invalid JSON: {e}"}, status=400)

        if not isinstance(payload, dict):
            return web.json_response({"ok": False, "error": "Invalid data format: expected dict"}, status=400)
        try:
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(payload if isinstance(payload, dict) else {}, f, ensure_ascii=False, indent=2)
            return web.json_response({"ok": True})
        except Exception as e:
            return web.json_response({"ok": False, "error": str(e)}, status=500)
class WuhuoTextGate:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_edit": ("BOOLEAN", {"default": False}),
                "free_pass": ("BOOLEAN", {"default": True}),
                "random_sfw": ("BOOLEAN", {"default": False}),
            },
            "optional": {
                "in_text": ("STRING", {"forceInput": True}),
                "edit_text": ("STRING", {"multiline": True, "default": ""}),
                "key_word": ("STRING", {"multiline": False, "default": ""}),
                "enhance_mode": ("STRING", {"multiline": False, "default": ""}),
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("text",)
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = CATEGORY

    def __init__(self):
        self._captured_text = None
        
    def run(self, enable_edit, free_pass, random_sfw, in_text=None, key_word=None, edit_text=None, enhance_mode=None, node_id=None):
        if in_text is None:
            in_text = ""
        elif not isinstance(in_text, str):
            try:
                in_text = str(in_text)
            except Exception:
                in_text = ""
        try:
            from server import PromptServer
        except Exception:
            PromptServer = None
        passing_free = bool(free_pass) and bool(in_text)
        received = bool(in_text)
        manual_pass = False
        
        # Always prefill text first, regardless of mode
        if received:
            try:
                if PromptServer is not None:
                    PromptServer.instance.send_sync("jdsc.textgate.prefill", {"node": node_id, "text": in_text or ""})
            except Exception:
                pass
        
        # Prepare user input (prefix) - combine key_word and enhance_mode
        user_prefix = ""
        # 鍏堟坊鍔?key_word
        if key_word and isinstance(key_word, str) and key_word.strip():
            user_prefix = key_word.strip()
        # 鍐嶆坊鍔?enhance_mode 瀵瑰簲鐨勬彁绀鸿瘝 (鏀寔澶氫釜锛岄€楀彿鍒嗛殧)
        if enhance_mode and isinstance(enhance_mode, str) and enhance_mode.strip() and enhance_mode != "无":
            presets = _load_enhance_presets()
            enhance_parts = [p.strip() for p in enhance_mode.split(",") if p.strip()]
            combined_enhance = []
            for part in enhance_parts:
                if part in presets:
                    t = presets.get(part, "")
                    if t and t.strip():
                        combined_enhance.append(t.strip())
            
            if combined_enhance:
                final_enhance_text = ",".join(combined_enhance)
                if user_prefix:
                    user_prefix = user_prefix + "," + final_enhance_text
                else:
                    user_prefix = final_enhance_text

        import random
        import json
        
        # 澶勭悊闅忔満 SFW 鎶藉彇閫昏緫
        if random_sfw:
            sfw_text = ""
            chosen_name = ""
            try:
                # 鐩存帴鑾峰彇鏀惰棌鏂囦欢璺緞
                favs_path = os.path.join(DATA_DIRECTORY, "text_favorites.json")
                if os.path.exists(favs_path):
                    with open(favs_path, "r", encoding="utf-8") as f:
                        favs_data = json.load(f)
                    # 绛涢€夊垎绫讳负 SFW 鐨勬彁绀鸿瘝
                    sfw_items = [(k, v["content"]) for k, v in favs_data.items() if isinstance(v, dict) and v.get("category") == "SFW" and v.get("content")]
                    if sfw_items:
                        chosen_name, sfw_text = random.choice(sfw_items)
            except Exception as e:
                print(f"[whtools] 闅忔満鎶藉彇SFW澶辫触: {e}")
            
            final_out = sfw_text
            if user_prefix:
                final_out = (user_prefix + "," + final_out) if final_out else user_prefix
            
            # 鍛婅瘔鍓嶇淇濇寔缁х画鐘舵€侊紝骞舵洿鏂版彁绀鸿瘝妗嗗唴瀹?
            try:
                if PromptServer is not None:
                    PromptServer.instance.send_sync("jdsc.textgate.update_text", {"node": node_id, "text": sfw_text, "name": chosen_name})
                    PromptServer.instance.send_sync("jdsc.textgate.status", {"node": node_id, "passing": True, "received": received, "manual": True, "free": bool(free_pass), "edit": bool(enable_edit)})
            except Exception:
                pass
                
            return (final_out,)

        if free_pass:
            # Free pass mode - 鐩撮€氭ā寮?
            # 涓婃父鏈夎緭鍏?鈫?浼犻€掍笂娓稿唴瀹?
            # 涓婃父鏃犺緭鍏?鈫?浣跨敤 enhance_mode + edit_text
            try:
                if PromptServer is not None:
                    PromptServer.instance.send_sync("jdsc.textgate.status", {"node": node_id, "passing": True, "received": received, "manual": False, "free": bool(free_pass), "edit": bool(enable_edit)})
            except Exception:
                pass
            
            if received:
                # 涓婃父鏈夎緭鍏ワ紝浼犻€掍笂娓稿唴瀹?
                final_out = in_text
                if user_prefix:
                    final_out = (user_prefix + "," + final_out) if final_out else user_prefix
            else:
                # 涓婃父鏃犺緭鍏ワ紝浣跨敤 manual_input + edit_text
                final_out = ""
                if user_prefix:
                    final_out = user_prefix
                if edit_text is not None and edit_text != "":
                    if final_out:
                        final_out = final_out + "," + edit_text
                    else:
                        final_out = edit_text
            return (final_out,)
        
        if enable_edit:
            # Edit mode - stop workflow but capture text for later use
            try:
                if PromptServer is not None:
                    PromptServer.instance.send_sync("jdsc.textgate.status", {"node": node_id, "passing": False, "received": received, "manual": False, "free": bool(free_pass), "edit": bool(enable_edit)})
            except Exception:
                pass
            
            # Capture the input text for later use when switching to yellow mode
            if received:
                self._captured_text = in_text
                try:
                    if PromptServer is not None and hasattr(PromptServer.instance, 'prompt_queue') and hasattr(PromptServer.instance.prompt_queue, 'interrupt'):
                        PromptServer.instance.prompt_queue.interrupt()
                except Exception as e:
                    # Fallback: try the old interrupt method if prompt_queue doesn't exist
                    try:
                        if PromptServer is not None and hasattr(PromptServer.instance, 'interrupt'):
                            PromptServer.instance.interrupt()
                    except Exception:
                        pass
                # Return empty string to stop workflow
                return ("",)
            else:
                # No input text, just return empty but don't interrupt
                return ("",)
        
        # Neither mode (yellow) - handle text flow
        # New rule: prioritize manual edited text when provided
        if edit_text is not None and edit_text != "":
            out = edit_text
            # Using manual text cancels any previously captured text
            self._captured_text = None
        elif received:
            # Otherwise, if we have new upstream input, use it and clear any captured text
            out = in_text
            self._captured_text = None
        elif self._captured_text is not None:
            # If we have captured text from previous red state, use it
            out = self._captured_text
        else:
            # Fallback to empty string
            out = ""
        
        # Prepend user input prefix if present
        if user_prefix:
            out = (user_prefix + "," + out) if out else user_prefix
        
        manual_pass = bool(out)
        # 灏嗚妭鐐圭殑杩愯鐘舵€佹寔涔呭寲鍒?jdsc/nodes.json锛岀‘淇濆嵆浣块噸鍚篃鑳戒繚鐣欒褰曪紙瀵规柊鎵嬪弸濂斤級
        try:
            # 璇诲彇宸叉湁鐘舵€?
            try:
                import json
                with open(NODES_FILE, "r", encoding="utf-8") as f:
                    nodes_data = json.load(f)
            except Exception:
                nodes_data = {}
            # 鏇存柊褰撳墠鑺傜偣鐘舵€?
            nodes_data[str(node_id or "")] = {
                "type": "WuhuoTextGate",
                "enable_edit": bool(enable_edit),
                "free_pass": bool(free_pass),
                "received": bool(received),
                "manual": bool(manual_pass),
                "captured_text": self._captured_text or "",
                "last_in_text": in_text or "",
            }
            # 鍐欏洖鏂囦欢
            with open(NODES_FILE, "w", encoding="utf-8") as f:
                json.dump(nodes_data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        try:
            if PromptServer is not None:
                PromptServer.instance.send_sync("jdsc.textgate.status", {"node": node_id, "passing": False, "received": received, "manual": manual_pass, "free": bool(free_pass), "edit": bool(enable_edit)})
        except Exception:
            pass
        return (out,)

class WuhuoTextGatePro(WuhuoTextGate):
    pass

class WuhuoIgnoreGroup:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable": ("BOOLEAN", {"default": True}),
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = False
    CATEGORY = CATEGORY

    def run(self, enable, node_id=None):
        # 鎸佷箙鍖栧拷鐣ラ€夋嫨妗嗙殑鍚敤鐘舵€?
        try:
            import json
            try:
                with open(NODES_FILE, "r", encoding="utf-8") as f:
                    nodes_data = json.load(f)
            except Exception:
                nodes_data = {}
            nodes_data[str(node_id or "")] = {
                "type": "WuhuoIgnoreGroup",
                "enable": bool(enable),
            }
            with open(NODES_FILE, "w", encoding="utf-8") as f:
                json.dump(nodes_data, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
        return ()

NODE_CLASS_MAPPINGS.update({"WuhuoTextGate": WuhuoTextGate})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoTextGate": "馃摑鏂囨湰+"})
NODE_CLASS_MAPPINGS.update({"WuhuoTextGatePro": WuhuoTextGatePro})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoTextGatePro": "馃摑鏂囨湰++"})
NODE_CLASS_MAPPINGS.update({"WuhuoIgnoreGroup": WuhuoIgnoreGroup})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoIgnoreGroup": "忽略选择框"})
NODE_CLASS_MAPPINGS.pop("WuhuoEcho", None)
NODE_DISPLAY_NAME_MAPPINGS.pop("WuhuoEcho", None)

# 鏂板鑺傜偣锛氱┖Latent瑙嗛锛堟贩鍏冿級
# 璇存槑锛?
# - 鍙緭鍑轰竴涓?LATENT锛堢┖鐨勬綔绌洪棿寮犻噺锛夛紝涓嶄緷璧栦换浣曡緭鍏?
# - 鏀寔甯歌姣斾緥锛?:3 / 5:4 / 16:9 / 16:10锛変笌妯睆/绔栧睆閫夋嫨锛涗篃鍙嚜瀹氫箟瀹介珮
# - 杈撳叆瑙嗛鏃堕暱锛堢锛夛紝鑷姩鎹㈢畻涓哄抚鏁帮細frames = a*16 + 1
# - 涓轰簡鍏煎 VAE/UNet 鐨勭┖闂翠笅閲囨牱锛屽楂樹細鑷姩瀵归綈鍒?8 鐨勫€嶆暟
class WuhuoEmptyLatentVideo:
    @classmethod
    def _load_last(cls):
        try:
            import json
            if os.path.exists(SETTINGS_FILE):
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f) or {}
            else:
                data = {}
            return data.get("empty_latent", {})
        except Exception:
            return {}

    @classmethod
    def _save_last(cls, values):
        try:
            import json
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            base = {}
            if os.path.exists(SETTINGS_FILE):
                try:
                    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                        base = json.load(f) or {}
                except Exception:
                    base = {}
            base["empty_latent"] = {
                "size_mode": values.get("size_mode"),
                "orientation": values.get("orientation"),
                "width": int(values.get("width", 720)),
                "height": int(values.get("height", 960)),
                "seconds": int(values.get("seconds", 5)),
            }
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(base, f, ensure_ascii=False, indent=2)
        except Exception:
            pass
    @classmethod
    def INPUT_TYPES(cls):
        last = cls._load_last()
        d_mode = last.get("size_mode", "16:9")
        d_ori = last.get("orientation", "横屏")
        d_w = int(last.get("width", 720))
        d_h = int(last.get("height", 960))
        d_seconds = int(last.get("seconds", 5))
        return {
            "required": {
                # 灏哄妯″紡锛氬浐瀹氭瘮渚嬫垨鑷畾涔夛紙涓嬫媺锛屽惈妯?绔栦袱鍚戯級
                "size_mode": (["4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "16:10", "10:16", "custom"], {"default": d_mode}),
                # 灞忓箷鏂瑰悜锛氭í灞?绔栧睆锛堜笅鎷夛級锛涘垏鎹㈠悗浣跨敤缈昏浆姣斾緥锛堝 5:4 鈫?4:5锛?
                "orientation": (["横屏", "竖屏"], {"default": d_ori}),
                # 瀹介珮锛氬湪鍥哄畾姣斾緥涓嬩細鑷姩鑱斿姩锛涘湪鑷畾涔夋ā寮忎笅鎸夌敤鎴峰€间娇鐢?
                "width": ("INT", {"default": d_w, "min": 64, "max": 8192}),
                "height": ("INT", {"default": d_h, "min": 64, "max": 8192}),
                # 鐩存帴杈撳叆绉掓暟锛堟寜鍚堝苟瑙嗛 fps=16 涓庡綋鍓嶉摼璺?R=4,O=3 鍏紡鎹㈢畻锛?
                "seconds": ("INT", {"default": d_seconds, "min": 0, "max": 3600}),
            },
            "optional": {},
            "hidden": {
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "run"
    OUTPUT_NODE = False
    CATEGORY = CATEGORY

    def _ratio_from_mode(self, mode):
        # 鐩存帴浠?size_mode 鏂囨湰瑙ｆ瀽姣斾緥锛屼緥濡?"16:9" 鎴?"9:16"
        try:
            if mode == "custom":
                return (1,1)
            parts = str(mode).split(":")
            if len(parts) == 2:
                return (max(1,int(parts[0])), max(1,int(parts[1])))
        except Exception:
            pass
        return (1,1)

    def _align8(self, x):
        # 瀵归綈鍒?8 鐨勫€嶆暟锛岄伩鍏嶄笅娓告ā鍨嬫姤閿?
        try:
            x = int(x)
            if x < 8:
                return 8
            return (x // 8) * 8
        except Exception:
            return 8

    def _calc_size(self, size_mode, orientation, width_in, height_in):
        # 鏍规嵁妯″紡璁＄畻鏈€缁堢殑瀹介珮锛堝儚绱狅級锛屽苟鍋?8 瀵归綈
        if size_mode == "custom":
            w = self._align8(width_in)
            h = self._align8(height_in)
            return w, h
        rw, rh = self._ratio_from_mode(size_mode)
        # 璁＄畻涓ょ鑱斿姩鍊欓€夛細
        w1 = self._align8(width_in)
        h1 = self._align8(round(w1 * rh / rw))
        h2 = self._align8(height_in)
        w2 = self._align8(round(h2 * rw / rh))
        # 閫夋嫨鏇存帴杩戠敤鎴疯緭鍏ョ殑涓€缁勶紙灏介噺璐磋繎鈥滀綘鏇存敼鐨勯偅涓€杈光€濓級
        d1 = abs(h1 - self._align8(height_in))
        d2 = abs(w2 - self._align8(width_in))
        if d1 <= d2:
            return w1, h1
        else:
            return w2, h2

    def _frames_from_seconds(self, seconds_in):
        # 鏍规嵁绉掓暟鎹㈢畻 frames锛歠rames 鈮?(seconds * fps + O) / R锛屽彇鏁?
        # 褰撳墠閾捐矾缁忛獙锛歠ps=16锛孯=4锛孫=3
        try:
            s = int(seconds_in)
            fps = 16
            R = 4
            O = 3
            frames = int(round((s * fps + O) / R))
            return max(1, frames)
        except Exception:
            return 1

    def run(self, size_mode, orientation, width, height, seconds, node_id=None):
        # 璁＄畻瀹介珮涓庡抚鏁?
        w, h = self._calc_size(size_mode, orientation, width, height)
        frames = self._frames_from_seconds(seconds)

        # 鐢熸垚绌?latent锛氬舰鐘朵负 [frames, 4, h//8, w//8]
        try:
            import torch
            try:
                from comfy.model_management import get_torch_device
                device = get_torch_device()
            except Exception:
                device = torch.device("cpu")
            # 杈撳嚭涓?缁磋棰憀atent锛歔B=1, C=16, T=frames, H//8, W//8]
            latent = torch.zeros((1, 16, frames, h // 8, w // 8), dtype=torch.float32, device=device)
            # 鍓嶇鑱斿姩灞曠ず锛氭牴鎹?orientation 缈昏浆鏄剧ず姣斾緥鏂囨湰
            try:
                from server import PromptServer
                if PromptServer is not None:
                    PromptServer.instance.send_sync("jdsc.emptylatent.update", {"node": node_id, "size_mode": size_mode, "orientation": orientation, "width": int(w), "height": int(h), "frames": int(frames), "seconds": int(seconds)})
                # 璁板繂褰撳墠鍙傛暟鍒?settings.json
                self._save_last({"size_mode": size_mode, "orientation": orientation, "width": int(w), "height": int(h), "seconds": int(seconds)})
            except Exception:
                pass
            return ({"samples": latent},)
        except Exception:
            # 鍏滃簳锛氳繑鍥?CPU 寮犻噺锛岄伩鍏嶅洜璁惧闂瀵艰嚧鑺傜偣涓嶅彲鐢?
            try:
                import torch
                # CPU 鍏滃簳锛氬悓鏍疯緭鍑?缁?
                latent = torch.zeros((1, 16, frames, h // 8, w // 8), dtype=torch.float32)
                return ({"samples": latent},)
            except Exception:
                # 鏋佺鎯呭喌锛氭棤娉曞鍏?torch锛屽垯杩斿洖绌虹粨鏋勶紙涓嬫父鍙兘浼氭姤閿欙級
                return ({"samples": None},)


# 鏂板鑺傜偣锛氱┖Latent Qwen锛堟枃鐢熷浘/Flux绛夛級
# 璇存槑锛?
# - 绫讳技绌篖atent瑙嗛锛屼絾鏈€鍚庝竴椤规敼涓?batch_size
# - 杈撳嚭褰㈢姸锛歔batch_size, 4, h//8, w//8]
class WuhuoEmptyLatentQwen:
    @classmethod
    def _load_last(cls):
        try:
            import json
            if os.path.exists(SETTINGS_FILE):
                with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f) or {}
            else:
                data = {}
            return data.get("empty_latent_qwen", {})
        except Exception:
            return {}

    @classmethod
    def _save_last(cls, values):
        try:
            import json
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            base = {}
            if os.path.exists(SETTINGS_FILE):
                try:
                    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                        base = json.load(f) or {}
                except Exception:
                    base = {}
            base["empty_latent_qwen"] = {
                "size_mode": values.get("size_mode"),
                "orientation": values.get("orientation"),
                "width": int(values.get("width", 1024)),
                "height": int(values.get("height", 1024)),
                "batch_size": int(values.get("batch_size", 1)),
            }
            with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
                json.dump(base, f, ensure_ascii=False, indent=2)
        except Exception:
            pass

    @classmethod
    def INPUT_TYPES(cls):
        last = cls._load_last()
        d_mode = last.get("size_mode", "1024x1024") # Default for Qwen/Flux usually square or standard ratios
        # Use same ratios as Video node for consistency, or maybe just standard ones? 
        # User asked for "similar to our jdsc empty latent", so keep same list.
        d_mode = last.get("size_mode", "16:9") 
        d_ori = last.get("orientation", "横屏")
        d_w = int(last.get("width", 1024))
        d_h = int(last.get("height", 1024)) # Qwen/Flux usually higher res defaults
        d_batch = int(last.get("batch_size", 1))
        
        return {
            "required": {
                "size_mode": (["4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "16:10", "10:16", "1:1", "custom"], {"default": d_mode}),
                "orientation": (["横屏", "竖屏"], {"default": d_ori}),
                "width": ("INT", {"default": d_w, "min": 64, "max": 8192}),
                "height": ("INT", {"default": d_h, "min": 64, "max": 8192}),
                "batch_size": ("INT", {"default": d_batch, "min": 1, "max": 64}),
            },
            "hidden": {
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("LATENT",)
    FUNCTION = "run"
    OUTPUT_NODE = False
    CATEGORY = CATEGORY

    def _ratio_from_mode(self, mode):
        try:
            if mode == "custom":
                return (1,1)
            parts = str(mode).split(":")
            if len(parts) == 2:
                return (max(1,int(parts[0])), max(1,int(parts[1])))
        except Exception:
            pass
        return (1,1)

    def _align8(self, x):
        try:
            x = int(x)
            if x < 8:
                return 8
            return (x // 8) * 8
        except Exception:
            return 8

    def _calc_size(self, size_mode, orientation, width_in, height_in):
        if size_mode == "custom":
            w = self._align8(width_in)
            h = self._align8(height_in)
            return w, h
        rw, rh = self._ratio_from_mode(size_mode)
        w1 = self._align8(width_in)
        h1 = self._align8(round(w1 * rh / rw))
        h2 = self._align8(height_in)
        w2 = self._align8(round(h2 * rw / rh))
        d1 = abs(h1 - self._align8(height_in))
        d2 = abs(w2 - self._align8(width_in))
        if d1 <= d2:
            return w1, h1
        else:
            return w2, h2

    def run(self, size_mode, orientation, width, height, batch_size, node_id=None):
        w, h = self._calc_size(size_mode, orientation, width, height)
        
        try:
            import torch
            try:
                from comfy.model_management import get_torch_device
                device = get_torch_device()
            except Exception:
                device = torch.device("cpu")
            
            # Output: [batch_size, 4, h//8, w//8]
            latent = torch.zeros((batch_size, 4, h // 8, w // 8), dtype=torch.float32, device=device)
            
            try:
                from server import PromptServer
                if PromptServer is not None:
                    # Reuse update message or create new? Reusing might be confusing if fields differ.
                    # But frontend logic for update is mostly about showing info? 
                    # Actually the frontend logic in jdsc.js is about INPUT WIDGETS linkage.
                    # The send_sync here is for... maybe updating some display? 
                    # WuhuoEmptyLatentVideo sends "jdsc.emptylatent.update".
                    # Let's send a similar one but maybe with batch_size?
                    PromptServer.instance.send_sync("jdsc.emptylatent.update", {"node": node_id, "size_mode": size_mode, "orientation": orientation, "width": int(w), "height": int(h), "batch_size": int(batch_size)})
                
                self._save_last({"size_mode": size_mode, "orientation": orientation, "width": int(w), "height": int(h), "batch_size": int(batch_size)})
            except Exception:
                pass
            return ({"samples": latent},)
        except Exception:
            try:
                import torch
                latent = torch.zeros((batch_size, 4, h // 8, w // 8), dtype=torch.float32)
                return ({"samples": latent},)
            except Exception:
                return ({"samples": None},)


# 娉ㄥ唽鏂拌妭鐐?
NODE_CLASS_MAPPINGS.update({"WuhuoEmptyLatentVideo": WuhuoEmptyLatentVideo})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoEmptyLatentVideo": "空Latent+"})
NODE_CLASS_MAPPINGS.update({"WuhuoEmptyLatentQwen": WuhuoEmptyLatentQwen})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoEmptyLatentQwen": "空Latent+Qwen"})

if WuhuoSwitchAny is not None:
    NODE_CLASS_MAPPINGS.update({"WuhuoSwitchAny": WuhuoSwitchAny})
    NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoSwitchAny": "任意切换 (布尔)"})

if WuhuoSelectorAny is not None:
    NODE_CLASS_MAPPINGS.update({"WuhuoSelectorAny": WuhuoSelectorAny})
    NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoSelectorAny": "任意选择 (多路)"})

if WuhuoSimpleMath is not None:
    NODE_CLASS_MAPPINGS.update({"WuhuoSimpleMath": WuhuoSimpleMath})
    NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoSimpleMath": "简易运算 (Wuhuo)"})

# ============================================================
# 宸ヤ綔娴佺鐞嗗姛鑳斤紙鏂板锛屼笉褰卞搷鐜版湁鑺傜偣锛?
# ============================================================

# 宸ヤ綔娴佹枃浠跺す閰嶇疆鏂囦欢璺緞
WF_FOLDERS_FILE = os.path.join(DATA_DIRECTORY, "workflow_folders.json")
# 宸ヤ綔娴佹敹钘忛厤缃枃浠惰矾寰?
WF_FAVS_FILE = os.path.join(DATA_DIRECTORY, "workflow_favorites.json")
# 宸ヤ綔娴佸巻鍙茶褰曢厤缃枃浠惰矾寰?
WF_HISTORY_FILE = os.path.join(DATA_DIRECTORY, "workflow_history.json")

# 纭繚宸ヤ綔娴佺浉鍏虫暟鎹枃浠跺瓨鍦?
def _ensure_workflow_data():
    try:
        os.makedirs(DATA_DIRECTORY, exist_ok=True)
        if not os.path.exists(WF_FOLDERS_FILE):
            with open(WF_FOLDERS_FILE, "w", encoding="utf-8") as f:
                f.write("[]")
        if not os.path.exists(WF_FAVS_FILE):
            with open(WF_FAVS_FILE, "w", encoding="utf-8") as f:
                f.write("{}")
        if not os.path.exists(WF_HISTORY_FILE):
            with open(WF_HISTORY_FILE, "w", encoding="utf-8") as f:
                f.write("[]")
    except Exception:
        pass

_ensure_workflow_data()

def _get_comfy_root():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    return os.path.dirname(os.path.dirname(current_dir))

def _resolve_workflow_path(path):
    if not path:
        return ""
    path = os.path.expanduser(str(path))
    if not os.path.isabs(path):
        path = os.path.join(_get_comfy_root(), path)
    return os.path.realpath(os.path.abspath(path))

def _get_allowed_workflow_dirs():
    allowed = [_resolve_workflow_path("user/default/workflows")]
    try:
        with open(WF_FOLDERS_FILE, "r", encoding="utf-8") as f:
            folders = json.load(f)
        if isinstance(folders, list):
            for folder in folders:
                if not isinstance(folder, dict):
                    continue
                p = folder.get("path")
                if p:
                    allowed.append(_resolve_workflow_path(p))
    except Exception:
        pass

    unique = []
    seen = set()
    for p in allowed:
        key = os.path.normcase(p)
        if p and key not in seen:
            seen.add(key)
            unique.append(p)
    return unique

def _path_is_inside(path, parent):
    try:
        return os.path.commonpath([os.path.normcase(path), os.path.normcase(parent)]) == os.path.normcase(parent)
    except Exception:
        return False

def _validate_workflow_file_path(file_path):
    resolved = _resolve_workflow_path(file_path)
    if not resolved:
        return None, "未提供文件路径"
    if not resolved.lower().endswith(".json"):
        return None, "鍙兘鎿嶄綔.json鏂囦欢"
    if not any(_path_is_inside(resolved, d) for d in _get_allowed_workflow_dirs()):
        return None, "璺緞涓嶅湪宸ヤ綔娴?鍏佽鐨勭洰褰曚腑"
    return resolved, None

def _validate_workflow_folder_path(folder_path):
    resolved = _resolve_workflow_path(folder_path)
    if not resolved:
        return None, "鏈彁渚涙枃浠跺す璺緞"
    if not any(_path_is_inside(resolved, d) for d in _get_allowed_workflow_dirs()):
        return None, "璺緞涓嶅湪宸ヤ綔娴?鍏佽鐨勭洰褰曚腑"
    return resolved, None

def _find_workflow_file_by_basename(file_path):
    name = os.path.basename(str(file_path or "").replace("\\", os.sep).replace("/", os.sep))
    if not name:
        return None
    target = os.path.normcase(name)
    for folder in _get_allowed_workflow_dirs():
        try:
            if not os.path.isdir(folder):
                continue
            direct = os.path.join(folder, name)
            if os.path.isfile(direct):
                return os.path.realpath(os.path.abspath(direct))
            for root, _dirs, files in os.walk(folder):
                for filename in files:
                    if os.path.normcase(filename) == target and filename.lower().endswith(".json"):
                        return os.path.realpath(os.path.abspath(os.path.join(root, filename)))
        except Exception:
            continue
    return None

# 宸ヤ綔娴佺鐞嗙殑鍚庣璺敱锛堜粎鍦≒romptServer鍙敤鏃舵坊鍔狅級
if PromptServer is not None and web is not None:
    # 鑾峰彇鏂囦欢澶归厤缃?
    @PromptServer.instance.routes.get("/jdsc/workflow_folders")
    async def jdsc_get_workflow_folders(request):
        try:
            with open(WF_FOLDERS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, list):
                data = []
        except Exception:
            data = []
        return web.Response(text=json.dumps(data, ensure_ascii=False), content_type='application/json')
    
    # 淇濆瓨鏂囦欢澶归厤缃?
    @PromptServer.instance.routes.post("/jdsc/workflow_folders_save")
    async def jdsc_set_workflow_folders(request):
        try:
            payload = await request.json()
        except Exception as e:
            return web.json_response({"ok": False, "error": f"Invalid JSON: {e}"}, status=400)
            
        if not isinstance(payload, list):
            return web.json_response({"ok": False, "error": "Invalid data format: expected list"}, status=400)
        try:
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            with open(WF_FOLDERS_FILE, "w", encoding="utf-8") as f:
                json.dump(payload if isinstance(payload, list) else [], f, ensure_ascii=False, indent=2)
            return web.json_response({"ok": True})
        except Exception as e:
            return web.json_response({"ok": False, "error": str(e)}, status=500)
    
    # 鑾峰彇鎸囧畾鏂囦欢澶逛笅鐨勫伐浣滄祦鍒楄〃锛堣繑鍥炴枃浠跺す鏍戠粨鏋勶級
    @PromptServer.instance.routes.post("/jdsc/workflow_list")
    async def jdsc_get_workflow_list(request):
        try:
            payload = await request.json()
            folder_path = payload.get("path", "")
            if not folder_path:
                return web.json_response({"files": [], "subfolders": []})
            
            # 澶勭悊鐩稿璺緞锛氱浉瀵逛簬ComfyUI鏍圭洰褰?
            if not os.path.isabs(folder_path):
                # 鑾峰彇ComfyUI鏍圭洰褰曪紙__init__.py鎵€鍦ㄧ洰褰曠殑涓婁笂绾э級
                current_dir = os.path.dirname(os.path.abspath(__file__))
                comfy_root = os.path.dirname(os.path.dirname(current_dir))
                folder_path = os.path.join(comfy_root, folder_path)
            
            # 妫€鏌ユ枃浠跺す鏄惁瀛樺湪
            if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
                return web.json_response({"files": [], "subfolders": []})
            
            # 鑾峰彇褰撳墠鏂囦欢澶圭殑.json鏂囦欢鍜屽瓙鏂囦欢澶?
            files = []
            subfolders = []
            try:
                items = os.listdir(folder_path)
                for item in items:
                    item_path = os.path.join(folder_path, item)
                    if os.path.isfile(item_path) and item.lower().endswith('.json'):
                        files.append({
                            "name": item,
                            "path": item_path
                        })
                    elif os.path.isdir(item_path):
                        # 妫€鏌ュ瓙鏂囦欢澶逛腑鏄惁鏈?json鏂囦欢锛堥€掑綊妫€鏌ワ級
                        has_workflows = False
                        for root, dirs, filenames in os.walk(item_path):
                            if any(f.lower().endswith('.json') for f in filenames):
                                has_workflows = True
                                break
                        if has_workflows:
                            subfolders.append({
                                "name": item,
                                "path": item_path
                            })
            except Exception:
                pass
            
            return web.json_response({"files": files, "subfolders": subfolders})
        except Exception as e:
            return web.json_response({"files": [], "subfolders": [], "error": str(e)})
    
    # 鑾峰彇宸ヤ綔娴佹敹钘?
    @PromptServer.instance.routes.get("/jdsc/workflow_favorites")
    async def jdsc_get_workflow_favorites(request):
        try:
            with open(WF_FAVS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                data = {}
        except Exception:
            data = {}
        return web.Response(text=json.dumps(data, ensure_ascii=False), content_type='application/json')
    
    # 淇濆瓨宸ヤ綔娴佹敹钘?
    @PromptServer.instance.routes.post("/jdsc/workflow_favorites_save")
    async def jdsc_set_workflow_favorites(request):
        try:
            payload = await request.json()
        except Exception as e:
            return web.json_response({"ok": False, "error": f"Invalid JSON: {e}"}, status=400)

        if not isinstance(payload, dict):
            return web.json_response({"ok": False, "error": "Invalid data format: expected dict"}, status=400)
        try:
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            with open(WF_FAVS_FILE, "w", encoding="utf-8") as f:
                json.dump(payload if isinstance(payload, dict) else {}, f, ensure_ascii=False, indent=2)
            return web.json_response({"ok": True})
        except Exception as e:
            return web.json_response({"ok": False, "error": str(e)}, status=500)

    # 鑾峰彇宸ヤ綔娴佸巻鍙?
    @PromptServer.instance.routes.get("/jdsc/workflow_history")
    async def jdsc_get_workflow_history(request):
        try:
            with open(WF_HISTORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, list):
                data = []
        except Exception:
            data = []
        return web.Response(text=json.dumps(data, ensure_ascii=False), content_type='application/json')
    
    # 淇濆瓨宸ヤ綔娴佸巻鍙?
    @PromptServer.instance.routes.post("/jdsc/workflow_history_save")
    async def jdsc_set_workflow_history(request):
        try:
            payload = await request.json()
        except Exception as e:
            return web.json_response({"ok": False, "error": f"Invalid JSON: {e}"}, status=400)

        if not isinstance(payload, list):
            return web.json_response({"ok": False, "error": "Invalid data format: expected list"}, status=400)
        try:
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            with open(WF_HISTORY_FILE, "w", encoding="utf-8") as f:
                json.dump(payload if isinstance(payload, list) else [], f, ensure_ascii=False, indent=2)
            return web.json_response({"ok": True})
        except Exception as e:
            return web.json_response({"ok": False, "error": str(e)}, status=500)
    
    # 鍒犻櫎宸ヤ綔娴佹枃浠?
    @PromptServer.instance.routes.post("/jdsc/workflow_delete")
    async def jdsc_delete_workflow(request):
        try:
            payload = await request.json()
            file_path = payload.get("path", "")
            if not file_path:
                return web.json_response({"success": False, "error": "未提供文件路径"})

            file_path, err = _validate_workflow_file_path(file_path)
            if err:
                return web.json_response({"success": False, "error": err})
            
            # 瀹夊叏妫€鏌ワ細纭繚鏂囦欢瀛樺湪涓旀槸.json鏂囦欢
            if not os.path.exists(file_path):
                return web.json_response({"success": False, "error": "文件不存在"})
            
            if not file_path.lower().endswith('.json'):
                return web.json_response({"success": False, "error": "鍙兘鍒犻櫎.json鏂囦欢"})
            
            # 鍒犻櫎鏂囦欢
            os.remove(file_path)
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    # 鍔犺浇宸ヤ綔娴佹枃浠跺唴瀹?
    @PromptServer.instance.routes.post("/jdsc/workflow_load")
    async def jdsc_load_workflow(request):
        try:
            payload = await request.json()
            file_path = payload.get("path", "")
            if not file_path:
                return web.json_response({"content": None, "error": "未提供文件路径"})

            file_path, err = _validate_workflow_file_path(file_path)
            if err:
                found = _find_workflow_file_by_basename(payload.get("path", ""))
                if found:
                    file_path = found
                else:
                    return web.json_response({"content": None, "error": err})
            
            # 妫€鏌ユ枃浠舵槸鍚﹀瓨鍦?
            if not os.path.exists(file_path):
                found = _find_workflow_file_by_basename(payload.get("path", ""))
                if found:
                    file_path = found
                else:
                    return web.json_response({"content": None, "error": "文件不存在"})
            
            # 璇诲彇鏂囦欢鍐呭
            with open(file_path, "r", encoding="utf-8") as f:
                content = json.load(f)
            
            return web.json_response({"content": content, "path": file_path})
        except Exception as e:
            return web.json_response({"content": None, "error": str(e)})
    
    # 淇濆瓨宸ヤ綔娴佹枃浠跺埌鎸囧畾璺緞
    @PromptServer.instance.routes.post("/jdsc/workflow_save")
    async def jdsc_save_workflow(request):
        try:
            payload = await request.json()
            file_path = payload.get("path", "")
            content = payload.get("content", "")
            overwrite = bool(payload.get("overwrite", False))
            
            if not file_path:
                return web.json_response({"success": False, "error": "未提供文件路径"})
            
            if not content:
                return web.json_response({"success": False, "error": "未提供文件内容"})
            
            file_path, err = _validate_workflow_file_path(file_path)
            if err:
                return web.json_response({"success": False, "error": err})

            if os.path.exists(file_path) and not overwrite:
                return web.json_response({"success": False, "error": "文件已存在"})
            
            # 纭繚鐩綍瀛樺湪
            dir_path = os.path.dirname(file_path)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            
            # 淇濆瓨鏂囦欢
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    # ============================================================
    # 鏂囨湰鏀惰棌鍔熻兘 API (鐙珛鎵╁睍鏀寔)
    # ============================================================
    TEXT_FAVS_FILE = os.path.join(DATA_DIRECTORY, "text_favorites.json")

    def _ensure_text_favs():
        try:
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            if not os.path.exists(TEXT_FAVS_FILE):
                with open(TEXT_FAVS_FILE, "w", encoding="utf-8") as f:
                    f.write("{}")
        except Exception:
            pass
    
    _ensure_text_favs()

    @PromptServer.instance.routes.get("/jdsc/text_favorites")
    async def jdsc_get_text_favorites(request):
        try:
            with open(TEXT_FAVS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            if not isinstance(data, dict):
                data = {}
        except Exception:
            data = {}
        return web.Response(text=json.dumps(data, ensure_ascii=False), content_type='application/json')

    @PromptServer.instance.routes.post("/jdsc/text_favorites_save")
    async def jdsc_set_text_favorites(request):
        try:
            payload = await request.json()
        except Exception as e:
            return web.json_response({"ok": False, "error": f"Invalid JSON: {e}"}, status=400)
            
        if not isinstance(payload, dict):
            return web.json_response({"ok": False, "error": "Invalid data format: expected dict"}, status=400)
        try:
            os.makedirs(DATA_DIRECTORY, exist_ok=True)
            with open(TEXT_FAVS_FILE, "w", encoding="utf-8") as f:
                json.dump(payload if isinstance(payload, dict) else {}, f, ensure_ascii=False, indent=2)
            return web.json_response({"ok": True})
        except Exception as e:
            return web.json_response({"ok": False, "error": str(e)}, status=500)

# 宸ヤ綔娴佺鐞嗚妭鐐癸紙浠呯敤浜庢敞鍐岋紝瀹為檯鍔熻兘鍦ㄥ墠绔級
class WuhuoWorkflowManager:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}
    
    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = False
    CATEGORY = CATEGORY
    
    def run(self):
        return ()

# 娉ㄥ唽宸ヤ綔娴佺鐞嗚妭鐐?
NODE_CLASS_MAPPINGS.update({"WuhuoWorkflowManager": WuhuoWorkflowManager})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoWorkflowManager": "宸ヤ綔娴?"})

# ==========================================================================
# 澶氬浘棰勮鑺傜偣锛堢嫭绔嬫ā鍧楋紝濡傞渶绂佺敤鍙垹闄や互涓嬩唬鐮佸潡锛?
# ==========================================================================
try:
    from . import multi_preview
    NODE_CLASS_MAPPINGS.update(multi_preview.NODE_CLASS_MAPPINGS)
    NODE_DISPLAY_NAME_MAPPINGS.update(multi_preview.NODE_DISPLAY_NAME_MAPPINGS)
    # 娉ㄥ唽 API 璺敱锛堜緵鍓嶇璋冪敤锛?
    multi_preview.register_routes()
except Exception as e:
    print(f"[whtools] 澶氬浘棰勮妯″潡鍔犺浇澶辫触: {e}")

try:
    from . import image_compare
    NODE_CLASS_MAPPINGS.update(image_compare.NODE_CLASS_MAPPINGS)
    NODE_DISPLAY_NAME_MAPPINGS.update(image_compare.NODE_DISPLAY_NAME_MAPPINGS)
except Exception as e:
    print(f"[whtools] 图像对比模块加载失败: {e}")

try:
    from . import asset_library
    # 娉ㄥ唽鏋佺畝璧勪骇搴?API 璺敱
    asset_library.register_routes()
    NODE_CLASS_MAPPINGS.update(asset_library.NODE_CLASS_MAPPINGS)
    NODE_DISPLAY_NAME_MAPPINGS.update(asset_library.NODE_DISPLAY_NAME_MAPPINGS)
except Exception as e:
    print(f"[whtools] 璧勪骇绱犳潗搴撴ā鍧楀姞杞藉け璐? {e}")


# ==========================================================================
# WuhuoShowText - 鏄剧ず鏂囨湰鑺傜偣锛堝熀浜?pysssss 鐨?ShowText锛?
# ==========================================================================
class WuhuoShowText:
    """????????????"""
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "text": ("STRING", {"forceInput": True}),
            },
            "hidden": {
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    INPUT_IS_LIST = True
    RETURN_TYPES = ("STRING",)
    FUNCTION = "notify"
    OUTPUT_NODE = True
    OUTPUT_IS_LIST = (True,)
    CATEGORY = CATEGORY

    def notify(self, text, unique_id=None, extra_pnginfo=None):
        if unique_id is not None and extra_pnginfo is not None:
            if not isinstance(extra_pnginfo, list):
                print("Error: extra_pnginfo is not a list")
            elif (
                not isinstance(extra_pnginfo[0], dict)
                or "workflow" not in extra_pnginfo[0]
            ):
                print("Error: extra_pnginfo[0] is not a dict or missing 'workflow' key")
            else:
                workflow = extra_pnginfo[0]["workflow"]
                node = next(
                    (x for x in workflow["nodes"] if str(x["id"]) == str(unique_id[0])),
                    None,
                )
                if node:
                    node["widgets_values"] = [text]

        return {"ui": {"text": text}, "result": (text,)}


NODE_CLASS_MAPPINGS.update({"鏄剧ず鏂囨湰": WuhuoShowText})
NODE_DISPLAY_NAME_MAPPINGS.update({"鏄剧ず鏂囨湰": "鏄剧ず鏂囨湰"})


# ==========================================================================
# JDSC Patch: Fix AudioVAE instantiation error in ComfyUI-KJNodes VAELoaderKJ
# ==========================================================================
def patch_kjnodes_vae_loader():
    import sys
    import logging
    
    VAELoaderKJ = None
    
    # 1. Search sys.modules first (shallow copy to prevent dictionary changed size error)
    for name, module in list(sys.modules.items()):
        if "KJNodes" in name or "kjnodes" in name.lower():
            if hasattr(module, "VAELoaderKJ"):
                VAELoaderKJ = getattr(module, "VAELoaderKJ")
                break
                
    # 2. If not found in loaded modules, try dynamic import
    if VAELoaderKJ is None:
        try:
            import importlib
            for folder in ["ComfyUI-KJNodes", "ComfyUI_KJNodes"]:
                try:
                    mod = importlib.import_module(f"custom_nodes.{folder}.nodes.nodes")
                    if hasattr(mod, "VAELoaderKJ"):
                        VAELoaderKJ = getattr(mod, "VAELoaderKJ")
                        break
                except ImportError:
                    continue
        except Exception:
            pass

    if VAELoaderKJ is not None:
        try:
            original_load_vae = VAELoaderKJ.load_vae
            
            def patched_load_vae(self, vae_name, device, weight_dtype):
                try:
                    from comfy.sd import VAE
                    import torch
                    import os
                    import folder_paths
                    from comfy.utils import load_torch_file
                    from comfy import model_management
                    
                    logging.info(f"[JDSC Patch] Running patched load_vae in VAELoaderKJ for: {vae_name}")
                    metadata = None
                    dtype = {"bf16": torch.bfloat16, "fp16": torch.float16, "fp32": torch.float32}[weight_dtype]
                    if device == "main_device":
                        device = model_management.get_torch_device()
                    elif device == "cpu":
                        device = torch.device("cpu")

                    if vae_name == "pixel_space":
                        sd = {}
                        sd["pixel_space_vae"] = torch.tensor(1.0)
                    elif vae_name in self.image_taes:
                        sd = self.load_taesd(vae_name)
                    else:
                        if os.path.splitext(vae_name)[0] in self.video_taes:
                            vae_path = folder_paths.get_full_path_or_raise("vae_approx", vae_name)
                        else:
                            vae_path = folder_paths.get_full_path_or_raise("vae", vae_name)
                        sd, metadata = load_torch_file(vae_path, return_metadata=True)

                    # Delegate to ComfyUI Core's standard VAE loader to natively support AudioVAE with VRAM management
                    vae = VAE(sd=sd, device=device, dtype=dtype, metadata=metadata)
                    vae.throw_exception_if_invalid()
                    return (vae,)
                except Exception as e:
                    logging.error(f"[JDSC Patch] Patched load_vae failed with error: {e}. Falling back to original.")
                    return original_load_vae(self, vae_name, device, weight_dtype)
            
            VAELoaderKJ.load_vae = patched_load_vae
            logging.info("[JDSC Patch] Successfully patched VAELoaderKJ.load_vae to prevent AudioVAE.__init__ TypeError.")
        except Exception as e:
            logging.error(f"[JDSC Patch] Failed to apply monkey patch to VAELoaderKJ: {e}")
    else:
        logging.warning("[JDSC Patch] VAELoaderKJ class could not be found. Monkey patch skipped.")

# Run the patch immediately during jdsc import
patch_kjnodes_vae_loader()
