import os
import asyncio

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
DATA_DIRECTORY = os.path.join(os.path.dirname(__file__), "data")
FAV_FILE = os.path.join(DATA_DIRECTORY, "favorites.json")
FRAG_FILE = os.path.join(DATA_DIRECTORY, "frags.json")
SETTINGS_FILE = os.path.join(DATA_DIRECTORY, "settings.json")
NODES_FILE = os.path.join(DATA_DIRECTORY, "nodes.json")
ENHANCE_PRESETS_FILE = os.path.join(DATA_DIRECTORY, "enhance_presets.json")

ENHANCE_PRESETS_TXT = os.path.join(DATA_DIRECTORY, "enhance_presets.txt")

# 加载强化词预设
def _load_enhance_presets():
    # 优先加载 TXT 格式（方便用户编辑）
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
                        # 保存上一个
                        if current_key:
                            presets[current_key] = ", ".join(current_lines)
                        
                        # 开始新的
                        current_key = line[1:-1].strip()
                        current_lines = []
                    else:
                        if current_key is not None:
                            current_lines.append(line)
                            
                # 保存最后一个
                if current_key:
                    presets[current_key] = ", ".join(current_lines)
            
            if presets:
                # 确保"无"选项存在
                if "无" not in presets:
                    presets = {"无": "", **presets}
                return presets
        except Exception as e:
            print(f"[whtools] Error loading enhance_presets.txt: {e}")

    # 降级加载 JSON 格式
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
    # 修复模块冲突：如果 comfy.utils 被错误地加载为顶层 utils 模块，会导致 server 导入失败
    # 步骤1：清理 sys.modules 中错误的 utils 模块
    if 'utils' in sys.modules:
        try:
            m = sys.modules['utils']
            if hasattr(m, '__file__') and m.__file__ and 'comfy' in m.__file__.replace('\\', '/').lower():
                if 'utils.py' in m.__file__.lower() or m.__file__.lower().endswith('utils'):
                    print(f"[whtools] 检测到错误的 utils 模块 ({m.__file__})，正在修复...")
                    del sys.modules['utils']
        except Exception:
            pass
    
    # 步骤2：清理 sys.path 中指向 comfy 子目录的错误路径
    # 这防止 server 导入时再次加载错误的 utils
    paths_to_remove = []
    for p in sys.path:
        try:
            normalized = p.replace('\\', '/').rstrip('/')
            # 只移除以 /comfy 结尾且不在 custom_nodes 中的路径
            if normalized.lower().endswith('/comfy') and 'custom_nodes' not in normalized.lower():
                paths_to_remove.append(p)
        except Exception:
            pass
    for p in paths_to_remove:
        try:
            sys.path.remove(p)
            print(f"[whtools] 已从 sys.path 移除错误路径: {p}")
        except Exception:
            pass

    from server import PromptServer
    from aiohttp import web
    import json
    from .switch_any import WuhuoSwitchAny, WuhuoSelectorAny

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
    # 写入 JSON 文件（带容错）
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

    @PromptServer.instance.routes.post("/jdsc/favorites")
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

    @PromptServer.instance.routes.post("/jdsc/frags")
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

    @PromptServer.instance.routes.post("/jdsc/settings")
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
                "enhance_mode": (list(_load_enhance_presets().keys()), {"default": "无"}),
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
        # 先添加 key_word
        if key_word and isinstance(key_word, str) and key_word.strip():
            user_prefix = key_word.strip()
        # 再添加 enhance_mode 对应的提示词
        if enhance_mode and enhance_mode != "无":
            presets = _load_enhance_presets()
            enhance_text = presets.get(enhance_mode, "")
            if enhance_text and enhance_text.strip():
                if user_prefix:
                    user_prefix = user_prefix + "," + enhance_text.strip()
                else:
                    user_prefix = enhance_text.strip()

        import random
        import json
        
        # 处理随机 SFW 抽取逻辑
        if random_sfw:
            sfw_text = ""
            try:
                # 直接获取收藏文件路径
                favs_path = os.path.join(DATA_DIRECTORY, "text_favorites.json")
                if os.path.exists(favs_path):
                    with open(favs_path, "r", encoding="utf-8") as f:
                        favs_data = json.load(f)
                    # 筛选分类为 SFW 的提示词
                    sfw_items = [v["content"] for k, v in favs_data.items() if isinstance(v, dict) and v.get("category") == "SFW" and v.get("content")]
                    if sfw_items:
                        sfw_text = random.choice(sfw_items)
            except Exception as e:
                print(f"[whtools] 随机抽取SFW失败: {e}")
            
            final_out = sfw_text
            if user_prefix:
                final_out = (user_prefix + "," + final_out) if final_out else user_prefix
            
            # 告诉前端保持继续状态，并更新提示词框内容
            try:
                if PromptServer is not None:
                    PromptServer.instance.send_sync("jdsc.textgate.update_text", {"node": node_id, "text": sfw_text})
                    PromptServer.instance.send_sync("jdsc.textgate.status", {"node": node_id, "passing": True, "received": received, "manual": True, "free": bool(free_pass), "edit": bool(enable_edit)})
            except Exception:
                pass
                
            return (final_out,)

        if free_pass:
            # Free pass mode - 直通模式
            # 上游有输入 → 传递上游内容
            # 上游无输入 → 使用 enhance_mode + edit_text
            try:
                if PromptServer is not None:
                    PromptServer.instance.send_sync("jdsc.textgate.status", {"node": node_id, "passing": True, "received": received, "manual": False, "free": bool(free_pass), "edit": bool(enable_edit)})
            except Exception:
                pass
            
            if received:
                # 上游有输入，传递上游内容
                final_out = in_text
                if user_prefix:
                    final_out = (user_prefix + "," + final_out) if final_out else user_prefix
            else:
                # 上游无输入，使用 manual_input + edit_text
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
        # 将节点的运行状态持久化到 jdsc/nodes.json，确保即使重启也能保留记录（对新手友好）
        try:
            # 读取已有状态
            try:
                import json
                with open(NODES_FILE, "r", encoding="utf-8") as f:
                    nodes_data = json.load(f)
            except Exception:
                nodes_data = {}
            # 更新当前节点状态
            nodes_data[str(node_id or "")] = {
                "type": "WuhuoTextGate",
                "enable_edit": bool(enable_edit),
                "free_pass": bool(free_pass),
                "received": bool(received),
                "manual": bool(manual_pass),
                "captured_text": self._captured_text or "",
                "last_in_text": in_text or "",
            }
            # 写回文件
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
        # 持久化忽略选择框的启用状态
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
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoTextGate": "📝文本+"})
NODE_CLASS_MAPPINGS.update({"WuhuoIgnoreGroup": WuhuoIgnoreGroup})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoIgnoreGroup": "忽略选择框"})
NODE_CLASS_MAPPINGS.pop("WuhuoEcho", None)
NODE_DISPLAY_NAME_MAPPINGS.pop("WuhuoEcho", None)

# 新增节点：空Latent视频（混元）
# 说明：
# - 只输出一个 LATENT（空的潜空间张量），不依赖任何输入
# - 支持常见比例（4:3 / 5:4 / 16:9 / 16:10）与横屏/竖屏选择；也可自定义宽高
# - 输入视频时长（秒），自动换算为帧数：frames = a*16 + 1
# - 为了兼容 VAE/UNet 的空间下采样，宽高会自动对齐到 8 的倍数
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
                # 尺寸模式：固定比例或自定义（下拉，含横/竖两向）
                "size_mode": (["4:3", "3:4", "5:4", "4:5", "16:9", "9:16", "16:10", "10:16", "custom"], {"default": d_mode}),
                # 屏幕方向：横屏/竖屏（下拉）；切换后使用翻转比例（如 5:4 → 4:5）
                "orientation": (["横屏", "竖屏"], {"default": d_ori}),
                # 宽高：在固定比例下会自动联动；在自定义模式下按用户值使用
                "width": ("INT", {"default": d_w, "min": 64, "max": 8192}),
                "height": ("INT", {"default": d_h, "min": 64, "max": 8192}),
                # 直接输入秒数（按合并视频 fps=16 与当前链路 R=4,O=3 公式换算）
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
        # 直接从 size_mode 文本解析比例，例如 "16:9" 或 "9:16"
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
        # 对齐到 8 的倍数，避免下游模型报错
        try:
            x = int(x)
            if x < 8:
                return 8
            return (x // 8) * 8
        except Exception:
            return 8

    def _calc_size(self, size_mode, orientation, width_in, height_in):
        # 根据模式计算最终的宽高（像素），并做 8 对齐
        if size_mode == "custom":
            w = self._align8(width_in)
            h = self._align8(height_in)
            return w, h
        rw, rh = self._ratio_from_mode(size_mode)
        # 计算两种联动候选：
        w1 = self._align8(width_in)
        h1 = self._align8(round(w1 * rh / rw))
        h2 = self._align8(height_in)
        w2 = self._align8(round(h2 * rw / rh))
        # 选择更接近用户输入的一组（尽量贴近“你更改的那一边”）
        d1 = abs(h1 - self._align8(height_in))
        d2 = abs(w2 - self._align8(width_in))
        if d1 <= d2:
            return w1, h1
        else:
            return w2, h2

    def _frames_from_seconds(self, seconds_in):
        # 根据秒数换算 frames：frames ≈ (seconds * fps + O) / R，取整
        # 当前链路经验：fps=16，R=4，O=3
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
        # 计算宽高与帧数
        w, h = self._calc_size(size_mode, orientation, width, height)
        frames = self._frames_from_seconds(seconds)

        # 生成空 latent：形状为 [frames, 4, h//8, w//8]
        try:
            import torch
            try:
                from comfy.model_management import get_torch_device
                device = get_torch_device()
            except Exception:
                device = torch.device("cpu")
            # 输出为5维视频latent：[B=1, C=16, T=frames, H//8, W//8]
            latent = torch.zeros((1, 16, frames, h // 8, w // 8), dtype=torch.float32, device=device)
            # 前端联动展示：根据 orientation 翻转显示比例文本
            try:
                from server import PromptServer
                if PromptServer is not None:
                    PromptServer.instance.send_sync("jdsc.emptylatent.update", {"node": node_id, "size_mode": size_mode, "orientation": orientation, "width": int(w), "height": int(h), "frames": int(frames), "seconds": int(seconds)})
                # 记忆当前参数到 settings.json
                self._save_last({"size_mode": size_mode, "orientation": orientation, "width": int(w), "height": int(h), "seconds": int(seconds)})
            except Exception:
                pass
            return ({"samples": latent},)
        except Exception:
            # 兜底：返回 CPU 张量，避免因设备问题导致节点不可用
            try:
                import torch
                # CPU 兜底：同样输出5维
                latent = torch.zeros((1, 16, frames, h // 8, w // 8), dtype=torch.float32)
                return ({"samples": latent},)
            except Exception:
                # 极端情况：无法导入 torch，则返回空结构（下游可能会报错）
                return ({"samples": None},)


# 新增节点：空Latent Qwen（文生图/Flux等）
# 说明：
# - 类似空Latent视频，但最后一项改为 batch_size
# - 输出形状：[batch_size, 4, h//8, w//8]
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


# 注册新节点
NODE_CLASS_MAPPINGS.update({"WuhuoEmptyLatentVideo": WuhuoEmptyLatentVideo})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoEmptyLatentVideo": "空latent+"})
NODE_CLASS_MAPPINGS.update({"WuhuoEmptyLatentQwen": WuhuoEmptyLatentQwen})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoEmptyLatentQwen": "空latent+Qwen"})

NODE_CLASS_MAPPINGS.update({"WuhuoSwitchAny": WuhuoSwitchAny})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoSwitchAny": "任意切换 (布尔)"})

NODE_CLASS_MAPPINGS.update({"WuhuoSelectorAny": WuhuoSelectorAny})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoSelectorAny": "任意选择 (多路)"})

# ============================================================
# 工作流管理功能（新增，不影响现有节点）
# ============================================================

# 工作流文件夹配置文件路径
WF_FOLDERS_FILE = os.path.join(DATA_DIRECTORY, "workflow_folders.json")
# 工作流收藏配置文件路径
WF_FAVS_FILE = os.path.join(DATA_DIRECTORY, "workflow_favorites.json")

# 确保工作流相关数据文件存在
def _ensure_workflow_data():
    try:
        os.makedirs(DATA_DIRECTORY, exist_ok=True)
        if not os.path.exists(WF_FOLDERS_FILE):
            with open(WF_FOLDERS_FILE, "w", encoding="utf-8") as f:
                f.write("[]")
        if not os.path.exists(WF_FAVS_FILE):
            with open(WF_FAVS_FILE, "w", encoding="utf-8") as f:
                f.write("{}")
    except Exception:
        pass

_ensure_workflow_data()

# 工作流管理的后端路由（仅在PromptServer可用时添加）
if PromptServer is not None and web is not None:
    # 获取文件夹配置
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
    
    # 保存文件夹配置
    @PromptServer.instance.routes.post("/jdsc/workflow_folders")
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
    
    # 获取指定文件夹下的工作流列表（返回文件夹树结构）
    @PromptServer.instance.routes.post("/jdsc/workflow_list")
    async def jdsc_get_workflow_list(request):
        try:
            payload = await request.json()
            folder_path = payload.get("path", "")
            if not folder_path:
                return web.json_response({"files": [], "subfolders": []})
            
            # 处理相对路径：相对于ComfyUI根目录
            if not os.path.isabs(folder_path):
                # 获取ComfyUI根目录（__init__.py所在目录的上上级）
                current_dir = os.path.dirname(os.path.abspath(__file__))
                comfy_root = os.path.dirname(os.path.dirname(current_dir))
                folder_path = os.path.join(comfy_root, folder_path)
            
            # 检查文件夹是否存在
            if not os.path.exists(folder_path) or not os.path.isdir(folder_path):
                return web.json_response({"files": [], "subfolders": []})
            
            # 获取当前文件夹的.json文件和子文件夹
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
                        # 检查子文件夹中是否有.json文件（递归检查）
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
    
    # 获取工作流收藏
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
    
    # 保存工作流收藏
    @PromptServer.instance.routes.post("/jdsc/workflow_favorites")
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
    
    # 删除工作流文件
    @PromptServer.instance.routes.post("/jdsc/workflow_delete")
    async def jdsc_delete_workflow(request):
        try:
            payload = await request.json()
            file_path = payload.get("path", "")
            if not file_path:
                return web.json_response({"success": False, "error": "未提供文件路径"})
            
            # 安全检查：确保文件存在且是.json文件
            if not os.path.exists(file_path):
                return web.json_response({"success": False, "error": "文件不存在"})
            
            if not file_path.lower().endswith('.json'):
                return web.json_response({"success": False, "error": "只能删除.json文件"})
            
            # 删除文件
            os.remove(file_path)
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    # 加载工作流文件内容
    @PromptServer.instance.routes.post("/jdsc/workflow_load")
    async def jdsc_load_workflow(request):
        try:
            payload = await request.json()
            file_path = payload.get("path", "")
            if not file_path:
                return web.json_response({"content": None, "error": "未提供文件路径"})
            
            # 检查文件是否存在
            if not os.path.exists(file_path):
                return web.json_response({"content": None, "error": "文件不存在"})
            
            # 读取文件内容
            with open(file_path, "r", encoding="utf-8") as f:
                content = json.load(f)
            
            return web.json_response({"content": content})
        except Exception as e:
            return web.json_response({"content": None, "error": str(e)})
    
    # 保存工作流文件到指定路径
    @PromptServer.instance.routes.post("/jdsc/workflow_save")
    async def jdsc_save_workflow(request):
        try:
            payload = await request.json()
            file_path = payload.get("path", "")
            content = payload.get("content", "")
            
            if not file_path:
                return web.json_response({"success": False, "error": "未提供文件路径"})
            
            if not content:
                return web.json_response({"success": False, "error": "未提供文件内容"})
            
            # 安全检查：确保是.json文件
            if not file_path.lower().endswith('.json'):
                return web.json_response({"success": False, "error": "只能保存.json文件"})
            
            # 确保目录存在
            dir_path = os.path.dirname(file_path)
            if dir_path:
                os.makedirs(dir_path, exist_ok=True)
            
            # 保存文件
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
    
    # ============================================================
    # 文本收藏功能 API (独立扩展支持)
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

    @PromptServer.instance.routes.post("/jdsc/text_favorites")
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

# 工作流管理节点（仅用于注册，实际功能在前端）
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

# 注册工作流管理节点
NODE_CLASS_MAPPINGS.update({"WuhuoWorkflowManager": WuhuoWorkflowManager})
NODE_DISPLAY_NAME_MAPPINGS.update({"WuhuoWorkflowManager": "工作流+"})

# ==========================================================================
# 多图预览节点（独立模块，如需禁用可删除以下代码块）
# ==========================================================================
try:
    from . import multi_preview
    NODE_CLASS_MAPPINGS.update(multi_preview.NODE_CLASS_MAPPINGS)
    NODE_DISPLAY_NAME_MAPPINGS.update(multi_preview.NODE_DISPLAY_NAME_MAPPINGS)
    # 注册 API 路由（供前端调用）
    multi_preview.register_routes()
except Exception as e:
    print(f"[whtools] 多图预览模块加载失败: {e}")


# ==========================================================================
# WuhuoShowText - 显示文本节点（基于 pysssss 的 ShowText）
# ==========================================================================
class WuhuoShowText:
    """显示输入文本并传递输出"""
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


NODE_CLASS_MAPPINGS.update({"显示文本": WuhuoShowText})
NODE_DISPLAY_NAME_MAPPINGS.update({"显示文本": "显示文本"})

