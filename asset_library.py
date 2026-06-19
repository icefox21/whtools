import os
import json
import shutil
import urllib.parse
import base64
import uuid
import time
import hashlib
import folder_paths
from server import PromptServer
from aiohttp import web

# 获取数据目录路径
DATA_DIRECTORY = os.path.join(os.path.dirname(__file__), "data")
CONFIG_FILE = os.path.join(DATA_DIRECTORY, "asset_config.json")
HISTORY_DIR = os.path.join(DATA_DIRECTORY, "history_images")
THUMB_DIR = os.path.join(DATA_DIRECTORY, "asset_thumbs")
IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp')
ASSET_LIST_CACHE_MAX_AGE = 5.0
_ASSET_LIST_CACHE = {}

def clear_asset_list_cache():
    _ASSET_LIST_CACHE.clear()

def list_asset_files(path, force=False):
    if not path or not os.path.isdir(path):
        return []

    cache_key = os.path.normcase(os.path.abspath(path))
    try:
        stat = os.stat(path)
    except OSError:
        return []

    fingerprint = (
        getattr(stat, "st_mtime_ns", int(stat.st_mtime * 1_000_000_000)),
        getattr(stat, "st_ctime_ns", int(stat.st_ctime * 1_000_000_000)),
    )
    now = time.monotonic()
    cached = _ASSET_LIST_CACHE.get(cache_key)
    if (
        not force
        and cached
        and cached.get("fingerprint") == fingerprint
        and now - cached.get("time", 0) < ASSET_LIST_CACHE_MAX_AGE
    ):
        return list(cached.get("files", []))

    files = []
    try:
        with os.scandir(path) as entries:
            for entry in entries:
                try:
                    if entry.is_file() and entry.name.lower().endswith(IMAGE_EXTENSIONS):
                        files.append(entry.name)
                except OSError:
                    continue
    except OSError:
        files = []

    files.sort(reverse=True)
    _ASSET_LIST_CACHE[cache_key] = {
        "fingerprint": fingerprint,
        "time": now,
        "files": files,
    }
    return list(files)

def build_asset_thumbnail(filepath, max_size=320):
    from PIL import Image, ImageOps

    stat = os.stat(filepath)
    cache_key = f"{os.path.abspath(filepath)}|{stat.st_mtime_ns}|{stat.st_size}"
    thumb_name = hashlib.sha1(cache_key.encode("utf-8", "surrogatepass")).hexdigest() + ".png"
    thumb_path = os.path.join(THUMB_DIR, thumb_name)
    if os.path.exists(thumb_path):
        return thumb_path

    os.makedirs(THUMB_DIR, exist_ok=True)
    with Image.open(filepath) as img:
        try:
            if getattr(img, "is_animated", False):
                img.seek(0)
        except EOFError:
            pass
        img = ImageOps.exif_transpose(img)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
        resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)
        img.thumbnail((max_size, max_size), resample)
        img.save(thumb_path, "PNG", optimize=True)
    return thumb_path

def get_config():
    """读取自定义目录配置"""
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except:
            pass
    return {"directories": []}

def save_config(config):
    """保存配置"""
    os.makedirs(DATA_DIRECTORY, exist_ok=True)
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    clear_asset_list_cache()

def ensure_config():
    """初始化默认配置"""
    config = get_config()
    # 强制注入预览+历史目录（如果不存在的话）
    has_history = any(d.get("name") == "预览+历史记录" for d in config.get("directories", []))
    if not has_history:
        os.makedirs(HISTORY_DIR, exist_ok=True)
        config["directories"].insert(0, {
            "name": "预览+历史记录",
            "path": HISTORY_DIR
        })
        save_config(config)
    return config

def register_routes():
    """注册资产素材库的 API 路由"""
    ensure_config()

    if PromptServer is None:
        return
        
    @PromptServer.instance.routes.get("/jdsc/assets/list")
    async def get_assets_list(request):
        """返回所有配置目录及其下的文件列表"""
        try:
            force = request.query.get("force", "").lower() in ("1", "true", "yes")
            config = ensure_config()
            categories = []
            
            for d in config.get("directories", []):
                name = d.get("name")
                path = d.get("path")
                categories.append({
                    "name": name,
                    "path": path,
                    "files": list_asset_files(path, force=force) # 按文件名倒序，方便看到最新的图
                })
                    
            return web.json_response({"success": True, "categories": categories})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

    @PromptServer.instance.routes.get("/jdsc/assets/image")
    async def get_asset_image(request):
        """获取具体的图片文件 (根据绝对路径)"""
        try:
            category_name = request.query.get("category", "")
            filename = request.query.get("filename", "")
            
            if not category_name or not filename:
                return web.Response(status=404)
                
            if ".." in filename or "/" in filename or "\\" in filename:
                return web.Response(status=403)
                
            config = get_config()
            target_path = None
            for d in config.get("directories", []):
                if d.get("name") == category_name:
                    target_path = d.get("path")
                    break
                    
            if not target_path or not os.path.exists(target_path):
                return web.Response(status=404)
                
            filepath = os.path.join(target_path, filename)
            if not os.path.exists(filepath):
                return web.Response(status=404)
                
            ext = os.path.splitext(filename)[1].lower()
            content_type = "image/png"
            if ext in [".jpg", ".jpeg"]:
                content_type = "image/jpeg"
            elif ext == ".webp":
                content_type = "image/webp"
            elif ext == ".gif":
                content_type = "image/gif"

            response = web.FileResponse(filepath)
            response.content_type = content_type
            response.headers["Cache-Control"] = "public, max-age=3600"
            response.headers["X-Accel-Buffering"] = "no"
            return response
        except Exception:
            return web.Response(status=500)

    @PromptServer.instance.routes.get("/jdsc/assets/thumb")
    async def get_asset_thumb(request):
        """获取素材缩略图，用于素材库网格预览"""
        try:
            category_name = request.query.get("category", "")
            filename = request.query.get("filename", "")

            if not category_name or not filename:
                return web.Response(status=404)

            if ".." in filename or "/" in filename or "\\" in filename:
                return web.Response(status=403)

            config = get_config()
            target_path = None
            for d in config.get("directories", []):
                if d.get("name") == category_name:
                    target_path = d.get("path")
                    break

            if not target_path or not os.path.exists(target_path):
                return web.Response(status=404)

            filepath = os.path.join(target_path, filename)
            if not os.path.exists(filepath):
                return web.Response(status=404)

            try:
                thumb_path = build_asset_thumbnail(filepath)
                response = web.FileResponse(thumb_path)
                response.content_type = "image/png"
                response.headers["Cache-Control"] = "public, max-age=86400"
                return response
            except Exception:
                response = web.FileResponse(filepath)
                response.headers["Cache-Control"] = "public, max-age=3600"
                return response
        except Exception:
            return web.Response(status=500)

    @PromptServer.instance.routes.post("/jdsc/assets/delete")
    async def delete_asset_image(request):
        """删除指定的图片文件"""
        try:
            payload = await request.json()
            category_name = payload.get("category", "")
            filename = payload.get("filename", "")
            
            if not category_name or not filename:
                return web.json_response({"success": False, "error": "Missing parameters"})
                
            if ".." in filename or "/" in filename or "\\" in filename:
                return web.json_response({"success": False, "error": "Invalid filename"})
                
            config = get_config()
            target_path = None
            for d in config.get("directories", []):
                if d.get("name") == category_name:
                    target_path = d.get("path")
                    break
                    
            if not target_path or not os.path.exists(target_path):
                return web.json_response({"success": False, "error": "Category path not found"})
                
            filepath = os.path.join(target_path, filename)
            if os.path.exists(filepath):
                os.remove(filepath)
                clear_asset_list_cache()
                return web.json_response({"success": True})
            else:
                return web.json_response({"success": False, "error": "File not found"})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

    @PromptServer.instance.routes.post("/jdsc/assets/move_asset")
    async def move_asset_image(request):
        """移动图片到另一个分类"""
        try:
            payload = await request.json()
            source_category = payload.get("source_category", "")
            filename = payload.get("filename", "")
            target_category = payload.get("target_category", "")
            
            if not source_category or not filename or not target_category:
                return web.json_response({"success": False, "error": "Missing parameters"})
                
            if ".." in filename or "/" in filename or "\\" in filename:
                return web.json_response({"success": False, "error": "Invalid filename"})
                
            config = get_config()
            source_path = None
            target_path = None
            
            for d in config.get("directories", []):
                if d.get("name") == source_category:
                    source_path = d.get("path")
                if d.get("name") == target_category:
                    target_path = d.get("path")
                    
            if not source_path or not os.path.exists(source_path):
                return web.json_response({"success": False, "error": "Source category path not found"})
                
            if not target_path or not os.path.exists(target_path):
                return web.json_response({"success": False, "error": "Target category path not found"})
                
            source_filepath = os.path.join(source_path, filename)
            if not os.path.exists(source_filepath):
                return web.json_response({"success": False, "error": "File not found"})
                
            target_filepath = os.path.join(target_path, filename)
            if os.path.exists(target_filepath):
                import time
                base, ext = os.path.splitext(filename)
                target_filepath = os.path.join(target_path, f"{base}_{int(time.time())}{ext}")
                
            # 第一性原理：避免跨盘移动抛出OSError。先尝试rename，失败则降级为shutil.move
            try:
                os.rename(source_filepath, target_filepath)
            except OSError:
                shutil.move(source_filepath, target_filepath)
            clear_asset_list_cache()
                
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

    @PromptServer.instance.routes.post("/jdsc/assets/open_folder")
    async def open_assets_folder(request):
        """跨平台打开指定的物理文件夹"""
        try:
            import subprocess
            import sys
            
            payload = await request.json()
            category_name = payload.get("category", "")
            
            config = get_config()
            target_path = None
            for d in config.get("directories", []):
                if d.get("name") == category_name:
                    target_path = d.get("path")
                    break
                    
            if not target_path or not os.path.exists(target_path):
                return web.json_response({"success": False, "error": "Path not found"})
            
            if sys.platform == 'win32':
                os.startfile(target_path)
            elif sys.platform == 'darwin':
                subprocess.call(['open', target_path])
            else:
                subprocess.call(['xdg-open', target_path])
                
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
            
    @PromptServer.instance.routes.post("/jdsc/assets/add_dir")
    async def add_asset_dir(request):
        """新增自定义目录映射"""
        try:
            payload = await request.json()
            name = payload.get("name", "").strip()
            path = payload.get("path", "").strip()
            
            if not name or not path:
                return web.json_response({"success": False, "error": "名称和路径不能为空"})
            
            if not os.path.exists(path) or not os.path.isdir(path):
                return web.json_response({"success": False, "error": "该物理路径不存在或不是文件夹"})
                
            config = get_config()
            for d in config.get("directories", []):
                if d.get("name") == name:
                    return web.json_response({"success": False, "error": "分类名称已存在"})
            
            config["directories"].append({"name": name, "path": path})
            save_config(config)
            
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

    @PromptServer.instance.routes.post("/jdsc/assets/remove_dir")
    async def remove_asset_dir(request):
        """移除目录映射（不删物理文件）"""
        try:
            payload = await request.json()
            name = payload.get("name", "").strip()
            
            if not name or name == "预览+历史记录":
                return web.json_response({"success": False, "error": "该目录无法移除"})
                
            config = get_config()
            config["directories"] = [d for d in config["directories"] if d.get("name") != name]
            save_config(config)
            
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})
            
    @PromptServer.instance.routes.post("/jdsc/assets/save_to")
    async def save_asset_to_dir(request):
        """将图片复制/保存到素材库特定目录"""
        try:
            payload = await request.json()
            source_filename = payload.get("source_filename", "") # 例如从 history_images 过来的文件名
            target_category = payload.get("target_category", "")
            
            if not source_filename or not target_category:
                return web.json_response({"success": False, "error": "缺少参数"})
                
            if ".." in source_filename or "/" in source_filename or "\\" in source_filename:
                return web.json_response({"success": False, "error": "非法的源文件名"})
                
            config = get_config()
            target_path = None
            for d in config.get("directories", []):
                if d.get("name") == target_category:
                    target_path = d.get("path")
                    break
                    
            if not target_path or not os.path.exists(target_path):
                return web.json_response({"success": False, "error": "目标分类目录不存在"})
                
            source_filepath = os.path.join(HISTORY_DIR, source_filename)
            if not os.path.exists(source_filepath):
                return web.json_response({"success": False, "error": "源图片不存在"})
                
            target_filepath = os.path.join(target_path, source_filename)
            # 为了防止重名覆盖，可以在文件名后加个小后缀
            if os.path.exists(target_filepath):
                import time
                base, ext = os.path.splitext(source_filename)
                target_filepath = os.path.join(target_path, f"{base}_{int(time.time())}{ext}")
                
            # 第一性原理：使用操作系统的硬链接(Hard Link)指向同一Inode
            # 零空间占用，同时保留两端独立的文件系统入口
            try:
                os.link(source_filepath, target_filepath)
            except OSError:
                # 防御性编程：跨盘或不支持硬链接的环境降级为复制
                shutil.copy2(source_filepath, target_filepath)
            clear_asset_list_cache()
            
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

    @PromptServer.instance.routes.post("/jdsc/assets/save_media")
    async def save_media(request):
        """解析给定的 URL 或 Base64 并将其真实物理文件拷贝至素材库的指定分类目录"""
        try:
            payload = await request.json()
            url = payload.get("url", "")
            target_category = payload.get("target_category", "")
            
            if not url or not target_category:
                return web.json_response({"success": False, "error": "缺少 URL 或目标分类参数"})
                
            config = get_config()
            target_path = None
            for d in config.get("directories", []):
                if d.get("name") == target_category:
                    target_path = d.get("path")
                    break
                    
            if target_category == "预览+历史记录":
                target_path = HISTORY_DIR
                
            if not target_path or not os.path.exists(target_path):
                return web.json_response({"success": False, "error": "目标分类目录不存在"})

            import time
            
            # 处理 Base64 内联图片
            if url.startswith("data:"):
                header, encoded = url.split(",", 1)
                file_ext = ".png"
                if "image/jpeg" in header: file_ext = ".jpg"
                elif "image/webp" in header: file_ext = ".webp"
                elif "video/mp4" in header: file_ext = ".mp4"
                
                target_filename = f"snip_{int(time.time())}_{uuid.uuid4().hex[:6]}{file_ext}"
                target_filepath = os.path.join(target_path, target_filename)
                
                with open(target_filepath, "wb") as f:
                    f.write(base64.b64decode(encoded))
                clear_asset_list_cache()
                return web.json_response({"success": True, "saved_as": target_filename})
                
            # 解析 ComfyUI 本地路由 (e.g. /view?filename=x.png&type=output&subfolder=y) 或 JDSC 自有路由
            parsed = urllib.parse.urlparse(url)
            query = urllib.parse.parse_qs(parsed.query)
            
            filename = query.get("filename", [""])[0]
            if not filename:
                return web.json_response({"success": False, "error": "无法从 URL 提取 filename"})
                
            is_history = False
            # 判断是否为 JDSC 自带的历史记录预览图
            if parsed.path.startswith("/jdsc/history/image"):
                source_filepath = os.path.join(HISTORY_DIR, filename)
                is_history = True
            else:
                file_type = query.get("type", ["output"])[0]
                subfolder = query.get("subfolder", [""])[0]
                
                # 利用 folder_paths 还原真实路径
                source_dir = folder_paths.get_directory_by_type(file_type)
                if not source_dir:
                    return web.json_response({"success": False, "error": f"未知的目录类型: {file_type}"})
                    
                source_filepath = os.path.join(source_dir, subfolder, filename)
            
            if not os.path.exists(source_filepath):
                return web.json_response({"success": False, "error": f"源文件不存在: {source_filepath}"})
                
            # 拷贝或剪切文件并处理重名
            target_filepath = os.path.join(target_path, filename)
            if os.path.exists(target_filepath):
                base, ext = os.path.splitext(filename)
                target_filepath = os.path.join(target_path, f"{base}_{int(time.time())}{ext}")
                
            # 第一性原理：避免移动文件导致原处失效。直接通过硬链接绑定同一份数据。
            try:
                os.link(source_filepath, target_filepath)
            except OSError:
                # 防御性编程：跨盘不支持硬链接时降级为复制，确保“继续显示”不被破坏
                shutil.copy2(source_filepath, target_filepath)
            clear_asset_list_cache()
            
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

# ==========================================================================
# 节点注册 (供前端调用入口)
# ==========================================================================
class WuhuoAssetLibrary:
    """提供一个打开素材库面板的入口节点"""
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}
    
    RETURN_TYPES = ()
    FUNCTION = "noop"
    OUTPUT_NODE = True
    CATEGORY = "wuhuo"

    def noop(self):
        return ()

class WuhuoLoadAsset:
    """素材库加载器：从素材库分类中读取图片或视频"""
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "category": ("STRING", {"default": ""}),
                "image": ("STRING", {"default": ""}),
            }
        }
    
    RETURN_TYPES = ("IMAGE", "MASK")
    FUNCTION = "load_asset"
    CATEGORY = "wuhuo"

    def load_asset(self, category, image):
        import torch
        import numpy as np
        from PIL import Image, ImageOps, ImageSequence

        if not category or not image:
            empty_image = torch.zeros((1, 64, 64, 3), dtype=torch.float32)
            empty_mask = torch.zeros((1, 64, 64), dtype=torch.float32)
            return (empty_image, empty_mask)

        if ".." in image or "/" in image or "\\" in image:
            raise ValueError("非法的素材文件名")

        config = get_config()
        target_path = None
        for d in config.get("directories", []):
            if d.get("name") == category:
                target_path = d.get("path")
                break
        
        if category == "预览+历史记录":
            target_path = HISTORY_DIR

        if not target_path or not os.path.exists(target_path):
            raise FileNotFoundError(f"分类目录不存在: {category}")

        filepath = os.path.join(target_path, image)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"素材文件不存在: {filepath}")

        try:
            img = Image.open(filepath)
        except Exception as e:
            raise IOError(f"无法打开素材图片: {e}")
        
        output_images = []
        output_masks = []
        for i in ImageSequence.Iterator(img):
            i = ImageOps.exif_transpose(i)
            if i.mode == 'I':
                i = i.point(lambda val: val * (1/255))
            image_data = i.convert("RGB")
            image_data = np.array(image_data).astype(np.float32) / 255.0
            image_tensor = torch.from_numpy(image_data)[None,]
            
            if 'A' in i.getbands():
                mask_data = np.array(i.getchannel('A')).astype(np.float32) / 255.0
                mask_tensor = 1.0 - torch.from_numpy(mask_data)
            else:
                mask_tensor = torch.zeros((64, 64), dtype=torch.float32)
                
            output_images.append(image_tensor)
            output_masks.append(mask_tensor)

        if len(output_images) > 1:
            output_image = torch.cat(output_images, dim=0)
            output_mask = torch.stack(output_masks, dim=0)
        else:
            output_image = output_images[0]
            output_mask = output_masks[0]

        if len(output_mask.shape) == 2:
            output_mask = output_mask[None,]

        # 复制到 ComfyUI 临时目录以供前端进行图片预览展示
        try:
            temp_dir = folder_paths.get_temp_directory()
            os.makedirs(temp_dir, exist_ok=True)
            temp_filename = f"asset_load_{uuid.uuid4().hex[:8]}_{image}"
            temp_filepath = os.path.join(temp_dir, temp_filename)
            try:
                os.link(filepath, temp_filepath)
            except OSError:
                shutil.copy2(filepath, temp_filepath)
        except Exception as e:
            print(f"[Wuhuo素材库] 创建预览文件失败: {e}")
            temp_filename = ""

        result = (output_image, output_mask)
        if temp_filename:
            return {
                "ui": {
                    "images": [{
                        "filename": temp_filename,
                        "subfolder": "",
                        "type": "temp"
                    }]
                },
                "result": result
            }
        return result

NODE_CLASS_MAPPINGS = {
    "WuhuoAssetLibrary": WuhuoAssetLibrary,
    "WuhuoLoadAsset": WuhuoLoadAsset
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WuhuoAssetLibrary": "🖼️ 资产素材库",
    "WuhuoLoadAsset": "🖼️ 素材库加载器"
}
