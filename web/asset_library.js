import { app } from "../../scripts/app.js";

const asyncPromptPassword = (message) => {
    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0"; overlay.style.left = "0"; overlay.style.width = "100%"; overlay.style.height = "100%";
        overlay.style.background = "rgba(0,0,0,0.8)";
        overlay.style.zIndex = "10005";
        overlay.style.display = "flex";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";

        const box = document.createElement("div");
        box.style.background = "#222";
        box.style.padding = "20px";
        box.style.borderRadius = "8px";
        box.style.color = "#fff";
        box.style.boxShadow = "0 4px 15px rgba(0,0,0,0.5)";

        const msg = document.createElement("div");
        msg.textContent = message;
        msg.style.marginBottom = "15px";

        const input = document.createElement("input");
        input.type = "password";
        input.style.width = "200px";
        input.style.padding = "8px";
        input.style.marginBottom = "15px";
        input.style.background = "#111";
        input.style.border = "1px solid #555";
        input.style.color = "#fff";
        input.style.borderRadius = "4px";

        const btnRow = document.createElement("div");
        btnRow.style.display = "flex";
        btnRow.style.justifyContent = "flex-end";
        btnRow.style.gap = "10px";

        const cancel = document.createElement("button");
        cancel.textContent = "取消";
        cancel.style.padding = "6px 12px";
        cancel.style.cursor = "pointer";
        cancel.onclick = () => { document.body.removeChild(overlay); resolve(null); };

        const ok = document.createElement("button");
        ok.textContent = "确定";
        ok.style.padding = "6px 12px";
        ok.style.cursor = "pointer";
        ok.style.background = "#4CAF50";
        ok.style.color = "#fff";
        ok.style.border = "none";
        ok.style.borderRadius = "4px";
        ok.onclick = () => { document.body.removeChild(overlay); resolve(input.value); };

        input.onkeydown = (e) => { 
            if (e.key === "Enter") ok.onclick(); 
            if (e.key === "Escape") cancel.onclick(); 
        };

        btnRow.append(cancel, ok);
        box.append(msg, input, btnRow);
        overlay.append(box);
        document.body.appendChild(overlay);
        input.focus();
    });
};

class AssetLibrary {
    constructor() {
        this.modal = null;
        this.categories = [];
        this.currentCategory = "全部";
        this.searchQuery = "";
        this.isBuilt = false;
    }

    async fetchAssets() {
        try {
            const res = await fetch("/jdsc/assets/list");
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    this.categories = data.categories || [];
                    
                    // 默认分类逻辑优化
                    if (this.currentCategory === "全部" || this.currentCategory === "预览+历史记录") {
                        const personCat = this.categories.find(c => c.name === "人物");
                        if (personCat) {
                            this.currentCategory = "人物";
                        } else {
                            const firstNormal = this.categories.find(c => c.name !== "预览+历史记录" && c.name !== "全部");
                            if (firstNormal) {
                                this.currentCategory = firstNormal.name;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch assets:", e);
        }
    }

    async deleteAsset(category, filename) {
        if (!confirm(`确定要彻底删除素材 [${filename}] 吗？`)) return;
        try {
            const res = await fetch("/jdsc/assets/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category, filename })
            });
            const data = await res.json();
            if (data.success) {
                await this.refresh();
            } else {
                alert("删除失败: " + data.error);
            }
        } catch (e) {
            console.error("Delete asset error:", e);
        }
    }

    async openPhysicalFolder() {
        if (this.currentCategory === "全部") {
            alert("请先选择一个具体的分类再打开目录！");
            return;
        }
        try {
            await fetch("/jdsc/assets/open_folder", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ category: this.currentCategory })
            });
        } catch (e) {
            console.error("Open folder error:", e);
        }
    }

    buildUI() {
        if (this.isBuilt) return;
        this.isBuilt = true;

        this.modal = document.createElement("div");
        this.modal.className = "jdsc-asset-modal";
        this.modal.style.display = "none";

        // Header
        const header = document.createElement("div");
        header.className = "jdsc-asset-header";
        
        // Draggable Modal Logic
        let modalIsDragging = false;
        let modalStartX = 0, modalStartY = 0;
        let modalInitialLeft = 0, modalInitialTop = 0;
        
        header.onmousedown = (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
            modalIsDragging = true;
            modalStartX = e.clientX;
            modalStartY = e.clientY;
            const rect = this.modal.getBoundingClientRect();
            this.modal.style.transform = "none";
            this.modal.style.left = rect.left + "px";
            this.modal.style.top = rect.top + "px";
            modalInitialLeft = rect.left;
            modalInitialTop = rect.top;
        };
        
        window.addEventListener("mousemove", (e) => {
            if (modalIsDragging) {
                const dx = e.clientX - modalStartX;
                const dy = e.clientY - modalStartY;
                this.modal.style.left = (modalInitialLeft + dx) + "px";
                this.modal.style.top = (modalInitialTop + dy) + "px";
            }
        });
        
        window.addEventListener("mouseup", () => {
            modalIsDragging = false;
        });
        
        // 标题栏右键关闭
        header.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.hide();
        });

        const headerLeft = document.createElement("div");
        headerLeft.className = "jdsc-asset-header-left";
        const title = document.createElement("div");
        title.className = "jdsc-asset-title";
        title.textContent = "🖼️ 资产素材库";
        
        const searchInput = document.createElement("input");
        searchInput.className = "jdsc-asset-search";
        searchInput.placeholder = "搜索当前分类...";
        searchInput.oninput = (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.renderGrid();
        };

        headerLeft.append(title, searchInput);

        const headerRight = document.createElement("div");
        headerRight.className = "jdsc-asset-header-right";

        const openBtn = document.createElement("button");
        openBtn.className = "jdsc-asset-btn";
        openBtn.textContent = "📂 打开硬盘目录";
        openBtn.onclick = () => this.openPhysicalFolder();

        const refreshBtn = document.createElement("button");
        refreshBtn.className = "jdsc-asset-btn";
        refreshBtn.textContent = "🔄 刷新";
        refreshBtn.onclick = () => this.refresh();

        const closeBtn = document.createElement("button");
        closeBtn.className = "jdsc-asset-close";
        closeBtn.innerHTML = "×";
        closeBtn.onclick = () => this.hide();

        headerRight.append(openBtn, refreshBtn, closeBtn);
        header.append(headerLeft, headerRight);

        // Body
        const body = document.createElement("div");
        body.className = "jdsc-asset-body";

        this.sidebar = document.createElement("div");
        this.sidebar.className = "jdsc-asset-sidebar";

        this.content = document.createElement("div");
        this.content.className = "jdsc-asset-content";
        
        this.grid = document.createElement("div");
        this.grid.className = "jdsc-asset-grid";

        this.content.append(this.grid);
        body.append(this.sidebar, this.content);
        this.modal.append(header, body);

        document.body.appendChild(this.modal);

        // Lightbox (高级画廊)
        this.lightbox = document.createElement("div");
        this.lightbox.className = "jdsc-asset-lightbox";
        this.lightbox.style.display = "none";
        
        // 关闭按钮
        const lightboxCloseBtn = document.createElement("button");
        lightboxCloseBtn.innerHTML = "✖";
        lightboxCloseBtn.style.position = "absolute";
        lightboxCloseBtn.style.top = "20px";
        lightboxCloseBtn.style.right = "20px";
        lightboxCloseBtn.style.background = "rgba(0,0,0,0.5)";
        lightboxCloseBtn.style.color = "#fff";
        lightboxCloseBtn.style.border = "none";
        lightboxCloseBtn.style.borderRadius = "50%";
        lightboxCloseBtn.style.width = "40px";
        lightboxCloseBtn.style.height = "40px";
        lightboxCloseBtn.style.fontSize = "20px";
        lightboxCloseBtn.style.cursor = "pointer";
        lightboxCloseBtn.style.zIndex = "10001";
        lightboxCloseBtn.onclick = () => {
            this.lightbox.style.display = "none";
        };
        
        this.lightboxImg = document.createElement("img");
        this.lightboxImg.style.transition = "transform 0.1s ease-out";
        this.lightboxImg.style.transformOrigin = "center center";
        // 允许图片超过屏幕
        this.lightboxImg.style.maxWidth = "none";
        this.lightboxImg.style.maxHeight = "none";
        
        // 缩放和平移状态
        let scale = 1;
        let posX = 0;
        let posY = 0;
        let imgIsDragging = false;
        let imgStartX = 0;
        let imgStartY = 0;

        const updateTransform = () => {
            this.lightboxImg.style.transform = `translate(${posX}px, ${posY}px) scale(${scale})`;
        };

        // 每次打开画廊时重置状态
        this.resetLightbox = () => {
            scale = 1;
            posX = 0;
            posY = 0;
            updateTransform();
            
            // 自动缩放到适合屏幕大小
            this.lightboxImg.onload = () => {
                const padding = 40;
                const winW = window.innerWidth - padding;
                const winH = window.innerHeight - padding;
                const imgW = this.lightboxImg.naturalWidth || winW;
                const imgH = this.lightboxImg.naturalHeight || winH;
                const ratio = Math.min(winW / imgW, winH / imgH);
                if (ratio < 1) {
                    scale = ratio;
                    updateTransform();
                }
            };
        };

        // 滚轮无极缩放
        this.lightbox.addEventListener("wheel", (e) => {
            e.preventDefault();
            const zoomAmount = 0.1;
            if (e.deltaY < 0) {
                scale *= (1 + zoomAmount);
            } else {
                scale *= (1 - zoomAmount);
            }
            scale = Math.max(0.1, Math.min(scale, 10)); // 限制缩放比例 (10% ~ 1000%)
            updateTransform();
        });

        // 拖拽平移
        this.lightbox.addEventListener("mousedown", (e) => {
            if (e.target === lightboxCloseBtn) return;
            imgIsDragging = true;
            imgStartX = e.clientX - posX;
            imgStartY = e.clientY - posY;
            e.preventDefault();
        });

        window.addEventListener("mousemove", (e) => {
            if (imgIsDragging && this.lightbox.style.display === "flex") {
                posX = e.clientX - imgStartX;
                posY = e.clientY - imgStartY;
                updateTransform();
            }
        });

        window.addEventListener("mouseup", () => {
            imgIsDragging = false;
        });

        // 点击背景关闭预览
        this.lightbox.addEventListener("click", (e) => {
            if (e.target === this.lightbox) {
                this.lightbox.style.display = "none";
            }
        });

        this.lightbox.append(this.lightboxImg, lightboxCloseBtn);
        document.body.appendChild(this.lightbox);

        // Global ESC to close
        window.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                if (this.lightbox.style.display === "flex") {
                    this.lightbox.style.display = "none";
                } else if (this.modal.style.display === "flex") {
                    this.hide();
                }
            }
        });
    }

    async refresh() {
        await this.fetchAssets();
        this.renderSidebar();
        this.renderGrid();
    }

    renderSidebar() {
        this.sidebar.innerHTML = "";
        
        // 计算全部总数 (排除历史记录)
        let totalCount = 0;
        this.categories.forEach(cat => {
            if (cat.name !== "预览+历史记录") {
                totalCount += cat.files.length;
            }
        });

        const createCatItem = (name, count, appendTo) => {
            const item = document.createElement("div");
            item.className = "jdsc-asset-cat-item";
            if (this.currentCategory === name) {
                item.classList.add("active");
            }
            
            const labelContainer = document.createElement("div");
            labelContainer.style.display = "flex";
            labelContainer.style.alignItems = "center";
            labelContainer.style.gap = "5px";
            
            const label = document.createElement("span");
            label.textContent = name;
            
            labelContainer.append(label);
            
            // 允许删除自定义分类
            if (name !== "全部" && name !== "预览+历史记录") {
                const removeBtn = document.createElement("span");
                removeBtn.innerHTML = "✖";
                removeBtn.style.color = "#ff4444";
                removeBtn.style.cursor = "pointer";
                removeBtn.style.fontSize = "12px";
                removeBtn.style.display = "none";
                removeBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (!confirm(`确定要移除分类 [${name}] 吗？(仅移除配置，不删物理文件)`)) return;
                    const res = await fetch("/jdsc/assets/remove_dir", {
                        method: "POST",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({ name })
                    });
                    const data = await res.json();
                    if(data.success) {
                        if(this.currentCategory === name) this.currentCategory = "全部";
                        this.refresh();
                    } else {
                        alert(data.error);
                    }
                };
                item.onmouseenter = () => removeBtn.style.display = "inline";
                item.onmouseleave = () => removeBtn.style.display = "none";
                labelContainer.append(removeBtn);
            }
            
            const badge = document.createElement("span");
            badge.className = "jdsc-asset-cat-badge";
            badge.textContent = count;
            
            item.append(labelContainer, badge);
            item.onclick = () => {
                this.currentCategory = name;
                this.renderSidebar();
                this.renderGrid();
            };
            appendTo.append(item);
        };

        // 渲染常规分类
        this.categories.forEach(cat => {
            if (cat.name !== "预览+历史记录") {
                createCatItem(cat.name, cat.files.length, this.sidebar);
            }
        });

        createCatItem("全部", totalCount, this.sidebar);

        // 渲染折叠的隐私/历史记录
        const historyCat = this.categories.find(c => c.name === "预览+历史记录");
        if (historyCat) {
            const folderGroup = document.createElement("div");
            folderGroup.style.marginTop = "10px";
            folderGroup.style.borderTop = "1px solid rgba(255,255,255,0.05)";
            
            const folderTitle = document.createElement("div");
            folderTitle.className = "jdsc-asset-cat-item";
            folderTitle.style.color = "#aaa";
            folderTitle.style.fontWeight = "bold";
            folderTitle.innerHTML = "<span>🔒 内部历史记录</span><span style='font-size:12px;'>▼</span>";
            
            const folderContent = document.createElement("div");
            // 默认折叠，除非当前正选中历史记录
            let isFolded = (this.currentCategory !== "预览+历史记录");
            folderContent.style.display = isFolded ? "none" : "block";
            folderContent.style.paddingLeft = "5px";
            folderTitle.querySelector("span:last-child").textContent = isFolded ? "▼" : "▲";
            
            folderTitle.onclick = async () => {
                if (isFolded) {
                    let pwd = localStorage.getItem("jdsc_history_pwd");
                    if (pwd === null || pwd === undefined) {
                        pwd = await asyncPromptPassword("首次进入，请设置一个查看历史记录的密码（留空则不设密码）：");
                        if (pwd === null) return; // 取消
                        localStorage.setItem("jdsc_history_pwd", pwd);
                    } else if (pwd !== "") {
                        const input = await asyncPromptPassword("🔐 请输入密码查看历史记录：");
                        if (input !== pwd) {
                            if (input !== null) alert("密码错误！");
                            return;
                        }
                    }
                }
                isFolded = !isFolded;
                folderContent.style.display = isFolded ? "none" : "block";
                folderTitle.querySelector("span:last-child").textContent = isFolded ? "▼" : "▲";
            };
            
            createCatItem(historyCat.name, historyCat.files.length, folderContent);
            
            folderGroup.append(folderTitle, folderContent);
            this.sidebar.append(folderGroup);
        }

        // 增加“添加目录”按钮
        const addBtn = document.createElement("div");
        addBtn.className = "jdsc-asset-cat-item";
        addBtn.style.color = "#4CAF50";
        addBtn.style.marginTop = "10px";
        addBtn.style.borderTop = "1px solid rgba(255,255,255,0.05)";
        addBtn.innerHTML = "<span>[+ 添加目录]</span>";
        addBtn.onclick = async () => {
            const name = prompt("请输入分类名称 (例如: 动漫背景):");
            if (!name) return;
            const path = prompt("请输入本地物理文件夹的绝对路径 (例如: D:\\MyImages):");
            if (!path) return;
            
            try {
                const res = await fetch("/jdsc/assets/add_dir", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ name, path })
                });
                const data = await res.json();
                if (data.success) {
                    this.refresh();
                } else {
                    alert("添加失败: " + data.error);
                }
            } catch(e) {
                console.error(e);
            }
        };
        this.sidebar.append(addBtn);
    }

    renderGrid() {
        this.grid.innerHTML = "";
        
        let displayItems = [];
        
        if (this.currentCategory === "全部") {
            this.categories.forEach(cat => {
                if (cat.name !== "预览+历史记录") {
                    cat.files.forEach(file => {
                        displayItems.push({ category: cat.name, filename: file });
                    });
                }
            });
        } else {
            const cat = this.categories.find(c => c.name === this.currentCategory);
            if (cat) {
                cat.files.forEach(file => {
                    displayItems.push({ category: cat.name, filename: file });
                });
            }
        }

        // Apply search
        if (this.searchQuery) {
            displayItems = displayItems.filter(item => item.filename.toLowerCase().includes(this.searchQuery));
        }

        if (displayItems.length === 0) {
            this.grid.innerHTML = '<div class="jdsc-asset-empty">没有找到素材。请点击右上角"打开硬盘目录"添加图片。</div>';
            return;
        }

        displayItems.forEach(item => {
            const url = `/jdsc/assets/image?category=${encodeURIComponent(item.category)}&filename=${encodeURIComponent(item.filename)}`;
            
            const box = document.createElement("div");
            box.className = "jdsc-asset-item";
            
            const img = document.createElement("img");
            img.src = url;
            img.loading = "lazy";
            img.draggable = true;
            
            // Drag and drop into canvas
            img.ondragstart = (e) => {
                // Set data to allow ComfyUI or browser to handle it
                e.dataTransfer.setData("text/plain", url);
                e.dataTransfer.setData("text/uri-list", window.location.origin + url);
                // Also pass the filename for potential custom node parsers
                e.dataTransfer.setData("jdsc/asset", item.filename);
            };
            
            const title = document.createElement("div");
            title.className = "jdsc-asset-item-title";
            title.textContent = item.filename;
            
            const delBtn = document.createElement("button");
            delBtn.className = "jdsc-asset-item-delete";
            delBtn.innerHTML = "🗑️";
            delBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteAsset(item.category, item.filename);
            };
            
            box.onclick = () => {
                this.lightboxImg.src = url;
                this.lightbox.style.display = "flex";
                if (this.resetLightbox) {
                    this.resetLightbox();
                }
            };
            
            box.append(img, title, delBtn);
            this.grid.append(box);
        });
    }

    async show() {
        this.buildUI();
        await this.refresh();
        this.modal.style.display = "flex";
    }

    hide() {
        if (this.modal) {
            this.modal.style.display = "none";
        }
    }
}

const manager = new AssetLibrary();

app.registerExtension({
    name: "jdsc.AssetLibrary",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // 当新建 WuhuoAssetLibrary 节点时，为其注入一个占满整个节点的大按钮
        if (nodeData.name === "WuhuoAssetLibrary") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) {
                    onNodeCreated.apply(this, arguments);
                }
                
                this.addWidget("button", "🖼️ 打开素材库", null, () => {
                    manager.show();
                });
                
                // 固定节点大小，使其看起来就像一个按钮
                this.size = [200, 60];
            };
        }

        // 全局右键菜单拦截，用于“收藏媒体到素材库”
        const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function(canvas, options) {
            if (origGetExtraMenuOptions) {
                origGetExtraMenuOptions.apply(this, arguments);
            }
            
            let targetUrl = null;
            
            // 嗅探 1: 常规预览图
            if (this.imgs && this.imgs.length > 0) {
                const idx = this.imageIndex || 0;
                if (this.imgs[idx] && this.imgs[idx].src) {
                    targetUrl = this.imgs[idx].src;
                }
            } 
            // 嗅探 2: 视频节点 (如 VHS_VideoCombine)
            if (!targetUrl && this.animatedImages && this.animatedImages.length > 0) {
                const idx = this.imageIndex || 0;
                if (this.animatedImages[idx] && this.animatedImages[idx].src) {
                    targetUrl = this.animatedImages[idx].src;
                } else if (this.animatedImages[idx] && this.animatedImages[idx].videoEl && this.animatedImages[idx].videoEl.src) {
                     targetUrl = this.animatedImages[idx].videoEl.src;
                }
            }
            // 嗅探 3: 带有 image / video widget 的加载节点
            if (!targetUrl && this.widgets) {
                const mediaWidget = this.widgets.find(w => w.name === "image" || w.name === "video");
                if (mediaWidget && mediaWidget.value && typeof mediaWidget.value === "string") {
                    targetUrl = `/view?filename=${encodeURIComponent(mediaWidget.value)}&type=input&subfolder=`;
                }
            }
            
            if (targetUrl) {
                options.push(null); // 分隔线
                options.push({
                    content: "⭐ 收藏媒体到素材库",
                    has_submenu: true,
                    callback: (value, menuOptions, e, menu, node) => {
                        fetch("/jdsc/assets/list")
                            .then(res => res.json())
                            .then(data => {
                                if (!data.success) { alert("获取分类失败: " + data.error); return; }
                                
                                const menuItems = [];
                                data.categories.forEach(cat => {
                                    if (cat.name === "预览+历史记录") return;
                                    menuItems.push({
                                        content: "📁 " + cat.name,
                                        callback: () => {
                                            fetch("/jdsc/assets/save_media", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    url: targetUrl,
                                                    target_category: cat.name
                                                })
                                            }).then(res => res.json()).then(saveData => {
                                                if (saveData.success) {
                                                    console.log("已成功收藏到:", cat.name);
                                                    // 给出轻微提示
                                                    const tip = document.createElement("div");
                                                    tip.textContent = "✅ 已收藏到: " + cat.name;
                                                    tip.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(76,175,80,0.9); color:#fff; padding:10px 20px; border-radius:8px; z-index:10000; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.3); transition:opacity 0.5s;";
                                                    document.body.appendChild(tip);
                                                    setTimeout(() => { tip.style.opacity = "0"; setTimeout(() => document.body.removeChild(tip), 500); }, 2000);
                                                } else {
                                                    alert("保存失败: " + saveData.error);
                                                }
                                            });
                                        }
                                    });
                                });
                                
                                LiteGraph.closeAllContextMenus();
                                new LiteGraph.ContextMenu(
                                    menuItems,
                                    { event: e, left: e.clientX, top: e.clientY, node: node }
                                );
                            });
                    }
                });
            }
        };
    },
    async setup() {
        // 1. 动态注入 CSS，防止部分 ComfyUI 版本不自动加载 CSS 导致样式丢失
        const style = document.createElement("style");
        style.textContent = `
        .jdsc-asset-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 80vw; height: 80vh; background: rgba(30, 30, 35, 0.95); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8); border-radius: 12px; z-index: 9999; display: flex; flex-direction: column; color: #eee; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; overflow: hidden; }
        .jdsc-asset-header { height: 50px; background: rgba(0, 0, 0, 0.2); border-bottom: 1px solid rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: space-between; padding: 0 20px; flex-shrink: 0; }
        .jdsc-asset-header-left { display: flex; align-items: center; gap: 15px; }
        .jdsc-asset-title { font-size: 16px; font-weight: 600; }
        .jdsc-asset-search { background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; padding: 6px 12px; border-radius: 6px; width: 200px; outline: none; transition: border-color 0.2s; }
        .jdsc-asset-search:focus { border-color: rgba(255, 255, 255, 0.3); }
        .jdsc-asset-header-right { display: flex; align-items: center; gap: 10px; }
        .jdsc-asset-btn { background: rgba(255, 255, 255, 0.1); border: none; color: #ddd; padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s; font-size: 14px; }
        .jdsc-asset-btn:hover { background: rgba(255, 255, 255, 0.2); color: #fff; }
        .jdsc-asset-close { background: transparent; border: none; color: #aaa; font-size: 20px; cursor: pointer; padding: 0 5px; }
        .jdsc-asset-close:hover { color: #ff5555; }
        .jdsc-asset-body { display: flex; flex: 1; overflow: hidden; }
        .jdsc-asset-sidebar { width: 200px; background: rgba(0, 0, 0, 0.2); border-right: 1px solid rgba(255, 255, 255, 0.05); display: flex; flex-direction: column; padding: 10px 0; overflow-y: auto; }
        .jdsc-asset-cat-item { padding: 10px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s; }
        .jdsc-asset-cat-item:hover { background: rgba(255, 255, 255, 0.05); }
        .jdsc-asset-cat-item.active { background: rgba(255, 255, 255, 0.1); font-weight: 600; }
        .jdsc-asset-cat-badge { background: rgba(0, 0, 0, 0.4); padding: 2px 8px; border-radius: 10px; font-size: 12px; color: #aaa; }
        .jdsc-asset-content { flex: 1; padding: 20px; overflow-y: auto; }
        .jdsc-asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 15px; }
        .jdsc-asset-empty { width: 100%; height: 100%; display: flex; justify-content: center; align-items: center; color: #777; font-size: 14px; }
        .jdsc-asset-item { position: relative; border-radius: 8px; overflow: hidden; background: rgba(0, 0, 0, 0.2); aspect-ratio: 1; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; }
        .jdsc-asset-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5); }
        .jdsc-asset-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .jdsc-asset-item-title { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.8)); padding: 20px 10px 8px; font-size: 12px; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: 0; transition: opacity 0.2s; }
        .jdsc-asset-item:hover .jdsc-asset-item-title { opacity: 1; }
        .jdsc-asset-item-delete { position: absolute; top: 5px; right: 5px; background: rgba(0, 0, 0, 0.6); color: #fff; border: none; border-radius: 4px; padding: 4px 6px; font-size: 12px; cursor: pointer; opacity: 0; transition: opacity 0.2s, background 0.2s; }
        .jdsc-asset-item-delete:hover { background: #ff4444; }
        .jdsc-asset-item:hover .jdsc-asset-item-delete { opacity: 1; }
        .jdsc-asset-lightbox { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.9); z-index: 10000; display: flex; justify-content: center; align-items: center; cursor: zoom-out; }
        .jdsc-asset-lightbox img { max-width: 90vw; max-height: 90vh; object-fit: contain; }
        `;
        document.head.appendChild(style);

        // 2. 提供一个全局悬浮按钮，支持自由拖拽移动
        const globalBtn = document.createElement("button");
        globalBtn.textContent = "🖼️ 资产库";
        globalBtn.style.position = "fixed";
        globalBtn.style.right = "20px";
        globalBtn.style.bottom = "80px"; // 避开新的底部菜单
        globalBtn.style.zIndex = "9999";
        globalBtn.style.padding = "8px 16px";
        globalBtn.style.background = "var(--comfy-menu-bg, rgba(30, 30, 30, 0.9))";
        globalBtn.style.color = "var(--error-text, #fff)";
        globalBtn.style.border = "1px solid var(--border-color, #555)";
        globalBtn.style.borderRadius = "8px";
        globalBtn.style.cursor = "pointer";
        globalBtn.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)";
        globalBtn.style.fontWeight = "bold";
        globalBtn.style.transition = "transform 0.2s, background 0.2s";
        
        globalBtn.onmouseenter = () => {
            globalBtn.style.transform = "scale(1.05)";
            globalBtn.style.background = "rgba(50, 50, 50, 0.95)";
        };
        globalBtn.onmouseleave = () => {
            globalBtn.style.transform = "scale(1)";
            globalBtn.style.background = "var(--comfy-menu-bg, rgba(30, 30, 30, 0.9))";
        };
        let isDragging = false;
        let hasMoved = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;

        globalBtn.onmousedown = (e) => {
            isDragging = true;
            hasMoved = false;
            startX = e.clientX;
            startY = e.clientY;
            const rect = globalBtn.getBoundingClientRect();
            // 切换为基于左上角的绝对定位以支持拖拽
            globalBtn.style.right = "auto";
            globalBtn.style.bottom = "auto";
            globalBtn.style.left = rect.left + "px";
            globalBtn.style.top = rect.top + "px";
            initialLeft = rect.left;
            initialTop = rect.top;
            
            e.preventDefault(); // 防止选中文本
        };

        window.addEventListener("mousemove", (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                hasMoved = true;
            }
            if (hasMoved) {
                globalBtn.style.left = (initialLeft + dx) + "px";
                globalBtn.style.top = (initialTop + dy) + "px";
            }
        });

        window.addEventListener("mouseup", () => {
            if (isDragging && hasMoved) {
                // 保存位置到 localStorage
                localStorage.setItem("jdsc_asset_btn_pos", JSON.stringify({
                    left: globalBtn.style.left,
                    top: globalBtn.style.top
                }));
            }
            isDragging = false;
        });

        globalBtn.onclick = (e) => {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            manager.show();
        };

        // 读取历史位置
        try {
            const savedPos = localStorage.getItem("jdsc_asset_btn_pos");
            if (savedPos) {
                const pos = JSON.parse(savedPos);
                globalBtn.style.right = "auto";
                globalBtn.style.bottom = "auto";
                globalBtn.style.left = pos.left;
                globalBtn.style.top = pos.top;
            }
        } catch(e) {}

        document.body.appendChild(globalBtn);
    }
});
