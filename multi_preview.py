# Copyright (c) 2024-2026 icefox21
# This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
# Project Link: https://github.com/icefox21/whtools

# ==========================================================================
# 多图预览节点 - 独立模块（最小化版本）
# ==========================================================================
# 说明：
# - 这是一个完全独立的模块，不会影响现有功能
# - 如果出现任何问题，删除此文件或删除 __init__.py 中的 import 即可恢复
# ==========================================================================

import os
import json

# 获取数据目录路径
DATA_DIRECTORY = os.path.join(os.path.dirname(__file__), "data")
HISTORY_DIR = os.path.join(DATA_DIRECTORY, "history_images")
HISTORY_MAP_FILE = os.path.join(DATA_DIRECTORY, "history_map.json")


class WuhuoMultiPreview:
    """
    多图预览节点
    功能：接收 IMAGE 输入，保存到历史记录，并原样输出
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "enable_images": ("BOOLEAN", {"default": True, "label_on": "images 开", "label_off": "images 关"}),
                "enable_images_opt": ("BOOLEAN", {"default": True, "label_on": "images_opt 开", "label_off": "images_opt 关"}),
            },
            "optional": {
                "images": ("IMAGE", {"lazy": True}),
                "images_opt": ("IMAGE", {"lazy": True}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "node_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "run"
    OUTPUT_NODE = True
    CATEGORY = "wuhuo"

    def check_lazy_status(self, enable_images, enable_images_opt, images=None, images_opt=None, prompt=None, node_id=None, **kwargs):
        """根据开关状态和实际连线情况决定是否请求输入"""
        needed = []
        
        # 获取当前节点实际连接的输入名称列表
        connected_inputs = []
        if prompt and node_id and str(node_id) in prompt:
            connected_inputs = prompt[str(node_id)].get("inputs", {})
            
        # 如果开关打开，并且该接口确定有连线，再去请求 lazy 评估
        if enable_images and "images" in connected_inputs and images is None:
            needed.append("images")
        if enable_images_opt and "images_opt" in connected_inputs and images_opt is None:
            needed.append("images_opt")
            
        return needed

    def run(self, enable_images=True, enable_images_opt=True, images=None, images_opt=None, prompt=None, extra_pnginfo=None, node_id=None):
        """
        节点主逻辑：保存图片到历史记录，并原样输出
        """
        try:
            import torch
            import numpy as np
            from PIL import Image
            import time
            import random
            
            # 确保目录存在
            os.makedirs(HISTORY_DIR, exist_ok=True)
            
            # 生成批次ID
            batch_id = f"{int(time.time())}_{random.randint(1000, 9999)}"
            saved_files = []
            
            # 合并两组图片输入
            all_images = []
            if images is not None:
                all_images.extend(list(images))
            if images_opt is not None:
                all_images.extend(list(images_opt))
            
            # 保存每张图片
            for i, img_tensor in enumerate(all_images):
                # 转换张量为 PIL Image
                i_np = 255. * img_tensor.cpu().numpy()
                img = Image.fromarray(np.clip(i_np, 0, 255).astype(np.uint8))
                
                # 保存
                filename = f"{batch_id}_{i}.png"
                filepath = os.path.join(HISTORY_DIR, filename)
                img.save(filepath, optimize=True)
                saved_files.append(filename)
            
            # 更新历史记录
            if saved_files:
                self._update_history(node_id, batch_id, saved_files)
                
                # 通过 WebSocket 通知前端刷新（关键：确保在文件保存完成后发送）
                try:
                    from server import PromptServer
                    if PromptServer is not None:
                        PromptServer.instance.send_sync(
                            "jdsc.multipreview.update",
                            {"node_id": str(node_id), "files": saved_files}
                        )
                except Exception as e:
                    print(f"[多图预览] WebSocket通知失败: {e}")
                        
        except Exception as e:
            print(f"[多图预览] 保存图片时出错: {e}")
            
        # 每次保存后，触发全局瘦身，确保硬盘不会被撑爆
        self._cleanup_history_directory()
        
        return ()
    
    def _update_history(self, node_id, batch_id, saved_files):
        """更新历史记录映射表"""
        try:
            import time
            
            # 读取现有记录
            history_data = {}
            if os.path.exists(HISTORY_MAP_FILE):
                try:
                    with open(HISTORY_MAP_FILE, "r", encoding="utf-8") as f:
                        history_data = json.load(f)
                except:
                    history_data = {}
            
            # 更新记录
            node_key = str(node_id) if node_id else "unknown"
            if node_key not in history_data:
                history_data[node_key] = []
            
            history_data[node_key].insert(0, {
                "batch_id": batch_id,
                "timestamp": int(time.time()),
                "files": saved_files
            })
            
            # 限制单节点历史记录：基于图片总数而不是批次数，最高 1000 张
            total_images = 0
            keep_batches = 0
            for batch in history_data[node_key]:
                total_images += len(batch.get("files", []))
                keep_batches += 1
                if total_images > 1000:
                    break
            history_data[node_key] = history_data[node_key][:keep_batches]
            
            # 保存
            with open(HISTORY_MAP_FILE, "w", encoding="utf-8") as f:
                json.dump(history_data, f, ensure_ascii=False, indent=2)
                
        except Exception as e:
            print(f"[多图预览] 更新历史记录时出错: {e}")

    def _cleanup_history_directory(self):
        """自动清理历史文件夹，确保总文件数不超过上限，基于 FIFO (先进先出) 规则
        第一性原理：硬盘文件和JSON映射必须是强一致性的事务，不能只删物理文件不删JSON。
        """
        try:
            if not os.path.exists(HISTORY_DIR):
                return
            
            MAX_HISTORY_FILES = 1000 # 最大允许的物理文件总数
            
            files = []
            for f in os.listdir(HISTORY_DIR):
                path = os.path.join(HISTORY_DIR, f)
                if os.path.isfile(path):
                    files.append((path, os.path.getmtime(path), f))
            
            # 如果文件数超过上限，则按修改时间升序（最老的在前）
            if len(files) > MAX_HISTORY_FILES:
                files.sort(key=lambda x: x[1])
                num_to_delete = len(files) - MAX_HISTORY_FILES
                
                deleted_filenames = set()
                for i in range(num_to_delete):
                    try:
                        os.remove(files[i][0])
                        deleted_filenames.add(files[i][2])
                    except:
                        pass
                
                # 防御性编程：同步清理 history_map.json 中对应的记录，防止前端加载出“死链”
                if deleted_filenames and os.path.exists(HISTORY_MAP_FILE):
                    try:
                        with open(HISTORY_MAP_FILE, "r", encoding="utf-8") as f:
                            history_data = json.load(f)
                        
                        modified = False
                        for n_id, batches in history_data.items():
                            for batch in batches:
                                original_files = batch.get("files", [])
                                new_files = [img for img in original_files if img not in deleted_filenames]
                                if len(new_files) != len(original_files):
                                    batch["files"] = new_files
                                    modified = True
                        
                        if modified:
                            with open(HISTORY_MAP_FILE, "w", encoding="utf-8") as f:
                                json.dump(history_data, f, ensure_ascii=False, indent=2)
                    except Exception as map_err:
                        print(f"[多图预览] 同步清理 JSON 映射表失败: {map_err}")
                
                print(f"[Wuhuo 素材库] 历史记录瘦身触发: 自动清理了 {len(deleted_filenames)} 个老旧文件。")
        except Exception as e:
            print(f"[Wuhuo 素材库] 清理历史文件出错: {e}")


# 节点注册信息
NODE_CLASS_MAPPINGS = {
    "WuhuoMultiPreview": WuhuoMultiPreview
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WuhuoMultiPreview": "🖼️预览+"
}


# ==========================================================================
# API 路由（供前端调用）
# ==========================================================================

def register_routes():
    """注册历史记录管理的 API 路由"""
    try:
        from server import PromptServer
        from aiohttp import web
    except ImportError:
        return
    
    if PromptServer is None:
        return
    
    # 获取指定节点的历史记录
    @PromptServer.instance.routes.post("/jdsc/history/get")
    async def jdsc_get_history(request):
        try:
            payload = await request.json()
            node_id = str(payload.get("node_id", ""))
            if not node_id:
                return web.json_response({"history": []})
            
            history_data = {}
            if os.path.exists(HISTORY_MAP_FILE):
                with open(HISTORY_MAP_FILE, "r", encoding="utf-8") as f:
                    history_data = json.load(f)
            
            return web.json_response({"history": history_data.get(node_id, [])})
        except Exception as e:
            return web.json_response({"history": [], "error": str(e)})

    # 清空指定节点的历史记录
    @PromptServer.instance.routes.post("/jdsc/history/clear")
    async def jdsc_clear_history(request):
        try:
            payload = await request.json()
            node_id = str(payload.get("node_id", ""))
            if not node_id:
                return web.json_response({"success": False})
            
            if os.path.exists(HISTORY_MAP_FILE):
                with open(HISTORY_MAP_FILE, "r", encoding="utf-8") as f:
                    history_data = json.load(f)
                
                if node_id in history_data:
                    del history_data[node_id]
                    with open(HISTORY_MAP_FILE, "w", encoding="utf-8") as f:
                        json.dump(history_data, f, ensure_ascii=False, indent=2)
            
            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

    # 获取历史图片文件
    @PromptServer.instance.routes.get("/jdsc/history/image")
    async def jdsc_get_history_image(request):
        try:
            filename = request.query.get("filename", "")
            if not filename:
                return web.Response(status=404)
            
            # 安全检查：防止路径遍历攻击
            if ".." in filename or "/" in filename or "\\" in filename:
                return web.Response(status=403)
            
            filepath = os.path.join(HISTORY_DIR, filename)
            if not os.path.exists(filepath):
                return web.Response(status=404)
            
            with open(filepath, "rb") as f:
                return web.Response(body=f.read(), content_type="image/png")
        except Exception:
            return web.Response(status=500)

    # 删除历史图片文件
    @PromptServer.instance.routes.post("/jdsc/history/delete_image")
    async def jdsc_delete_history_image(request):
        try:
            payload = await request.json()
            filename = payload.get("filename", "")
            node_id = str(payload.get("node_id", ""))
            
            if not filename:
                return web.json_response({"success": False, "error": "No filename provided"})
                
            # 安全检查：防止路径遍历攻击
            if ".." in filename or "/" in filename or "\\" in filename:
                return web.json_response({"success": False, "error": "Invalid filename"})
                
            filepath = os.path.join(HISTORY_DIR, filename)
            if os.path.exists(filepath):
                os.remove(filepath)
                
            # 同步清理 history_map.json 里的记录
            if node_id and os.path.exists(HISTORY_MAP_FILE):
                try:
                    with open(HISTORY_MAP_FILE, "r", encoding="utf-8") as f:
                        history_data = json.load(f)
                        
                    if node_id in history_data:
                        modified = False
                        for batch in history_data[node_id]:
                            if filename in batch.get("files", []):
                                batch["files"].remove(filename)
                                modified = True
                        
                        if modified:
                            with open(HISTORY_MAP_FILE, "w", encoding="utf-8") as f:
                                json.dump(history_data, f, ensure_ascii=False, indent=2)
                except Exception as map_err:
                    print(f"[多图预览] 清理 history_map 时出错: {map_err}")

            return web.json_response({"success": True})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

    # 打开历史图片保存目录
    @PromptServer.instance.routes.post("/jdsc/history/open_folder")
    async def jdsc_open_history_folder(request):
        try:
            import subprocess
            import sys
            
            # 确保目录存在
            os.makedirs(HISTORY_DIR, exist_ok=True)
            
            # 跨平台打开文件夹
            if sys.platform == 'win32':
                os.startfile(HISTORY_DIR)
            elif sys.platform == 'darwin':
                subprocess.call(['open', HISTORY_DIR])
            else:
                subprocess.call(['xdg-open', HISTORY_DIR])
            
            return web.json_response({"success": True, "path": HISTORY_DIR})
        except Exception as e:
            return web.json_response({"success": False, "error": str(e)})

