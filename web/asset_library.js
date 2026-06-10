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
        
        // Navigation state for lightbox
        this.currentDisplayItems = [];
        this.currentLightboxIndex = -1;
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
        // 幻灯片核心状态引擎
        this.isSlideshowActive = false;
        this.slideshowTimer = null;
        this.slideshowInterval = 3000;
        this.stopSlideshow = () => {
            if (this.slideshowTimer) clearTimeout(this.slideshowTimer);
            this.isSlideshowActive = false;
            if (this.playBtn) this.playBtn.innerHTML = "▶ 播放幻灯片";
            this.updateSlideshowBarState();
        };
        this.startSlideshow = () => {
            if (this.currentDisplayItems.length <= 1) return;
            this.isSlideshowActive = true;
            if (this.playBtn) this.playBtn.innerHTML = "⏸ 暂停幻灯片";
            this.nextLightboxImage();
            this.updateSlideshowBarState();
        };
        this.toggleSlideshow = () => {
            if (this.isSlideshowActive) this.stopSlideshow();
            else this.startSlideshow();
        };
        this.updateSlideshowBarState = () => {
            if (!this.slideshowBar) return;
            if (this.isSlideshowActive) {
                this.slideshowBar.style.opacity = "0";
            } else {
                this.slideshowBar.style.opacity = "0.5";
            }
        };

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
            this.stopSlideshow(); // 强行阻断幻灯片，防内存泄漏
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
                
                // 幻灯片引擎：图片完全加载并渲染后，才开始安全的倒计时
                if (this.slideshowTimer) clearTimeout(this.slideshowTimer);
                if (this.isSlideshowActive) {
                    this.slideshowTimer = setTimeout(() => {
                        // 双重安全校验：确保在倒计时结束时，用户没有关闭弹窗或手动停止
                        if (this.isSlideshowActive && this.lightbox.style.display === "flex") {
                            this.nextLightboxImage();
                        }
                    }, this.slideshowInterval);
                }
            };
        };

        let wheelLock = false;
        // 滚轮空间感知：图片上缩放，背景上翻页
        this.lightbox.addEventListener("wheel", (e) => {
            e.preventDefault();
            
            if (e.target === this.lightboxImg) {
                // 实体空间：缩放图片
                const zoomAmount = 0.1;
                if (e.deltaY < 0) {
                    scale *= (1 + zoomAmount);
                } else {
                    scale *= (1 - zoomAmount);
                }
                scale = Math.max(0.1, Math.min(scale, 10)); // 限制缩放比例 (10% ~ 1000%)
                updateTransform();
            } else if (e.target === this.lightbox) {
                // 虚空背景：滚动翻页
                if (wheelLock) return;
                wheelLock = true;
                
                this.stopSlideshow(); // 手动接管，夺回控制权
                
                if (e.deltaY > 0) {
                    this.nextLightboxImage();
                } else {
                    this.prevLightboxImage();
                }
                
                // 强制冷却锁，防抖 (300ms)
                setTimeout(() => { wheelLock = false; }, 300);
            }
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
                this.stopSlideshow();
                this.lightbox.style.display = "none";
            }
        });

        // 左右切换按钮
        const prevBtn = document.createElement("button");
        prevBtn.innerHTML = "◀";
        prevBtn.style.cssText = "position:absolute; left:20px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:50px; height:50px; font-size:24px; cursor:pointer; z-index:10001; display:flex; justify-content:center; align-items:center; transition:background 0.2s;";
        prevBtn.onmouseenter = () => prevBtn.style.background = "rgba(0,0,0,0.8)";
        prevBtn.onmouseleave = () => prevBtn.style.background = "rgba(0,0,0,0.5)";
        prevBtn.onclick = (e) => {
            e.stopPropagation();
            this.stopSlideshow(); // 手动翻页打断轮播
            this.prevLightboxImage();
        };

        const nextBtn = document.createElement("button");
        nextBtn.innerHTML = "▶";
        nextBtn.style.cssText = "position:absolute; right:20px; top:50%; transform:translateY(-50%); background:rgba(0,0,0,0.5); color:#fff; border:none; border-radius:50%; width:50px; height:50px; font-size:24px; cursor:pointer; z-index:10001; display:flex; justify-content:center; align-items:center; transition:background 0.2s;";
        nextBtn.onmouseenter = () => nextBtn.style.background = "rgba(0,0,0,0.8)";
        nextBtn.onmouseleave = () => nextBtn.style.background = "rgba(0,0,0,0.5)";
        nextBtn.onclick = (e) => {
            e.stopPropagation();
            this.stopSlideshow(); // 手动翻页打断轮播
            this.nextLightboxImage();
        };

        // 幻灯片底部控制台 (UI 最下方最中间)
        const slideshowBar = document.createElement("div");
        this.slideshowBar = slideshowBar;
        slideshowBar.style.cssText = "position:absolute; bottom:30px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.75); padding:8px 20px; border-radius:30px; display:flex; gap:15px; align-items:center; z-index:10001; backdrop-filter:blur(8px); box-shadow:0 4px 15px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1); transition: opacity 0.3s ease; opacity: 0.5;";
        
        // 关键修复：阻止控制台的 mousedown 事件向上冒泡，防止被外层拖拽逻辑的 preventDefault() 拦截，导致原生下拉菜单无法弹出
        slideshowBar.addEventListener("mousedown", (e) => e.stopPropagation());

        // 鼠标悬停显示/隐藏控制
        slideshowBar.onmouseenter = () => {
            if (this.isSlideshowActive) {
                slideshowBar.style.opacity = "0.3";
            } else {
                slideshowBar.style.opacity = "1.0";
            }
        };
        slideshowBar.onmouseleave = () => {
            this.updateSlideshowBarState();
        };
        
        this.playBtn = document.createElement("button");
        this.playBtn.innerHTML = "▶ 播放幻灯片";
        this.playBtn.style.cssText = "background:transparent; color:#fff; border:none; cursor:pointer; font-size:15px; display:flex; align-items:center; gap:5px; font-weight:bold; padding:0;";
        this.playBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleSlideshow();
        };

        const speedSelect = document.createElement("select");
        speedSelect.style.cssText = "background:rgba(255,255,255,0.1); color:#fff; border:1px solid rgba(255,255,255,0.2); border-radius:6px; padding:3px 8px; outline:none; cursor:pointer; font-size:13px;";
        [1, 2, 3, 5, 8, 10].forEach(sec => {
            const opt = document.createElement("option");
            opt.value = sec * 1000;
            opt.textContent = `${sec} 秒`;
            if (sec === 3) opt.selected = true;
            opt.style.color = "#000";
            speedSelect.appendChild(opt);
        });
        speedSelect.onchange = (e) => {
            this.slideshowInterval = parseInt(e.target.value);
        };
        speedSelect.onclick = (e) => e.stopPropagation();

        slideshowBar.appendChild(this.playBtn);
        slideshowBar.appendChild(speedSelect);

        this.lightbox.append(this.lightboxImg, lightboxCloseBtn, prevBtn, nextBtn, slideshowBar);
        document.body.appendChild(this.lightbox);

        // Global ESC and Arrow Keys
        window.addEventListener("keydown", (e) => {
            if (this.lightbox.style.display === "flex") {
                if (e.key === "Escape") {
                    this.stopSlideshow();
                    this.lightbox.style.display = "none";
                } else if (e.key === "ArrowLeft") {
                    this.stopSlideshow();
                    this.prevLightboxImage();
                } else if (e.key === "ArrowRight") {
                    this.stopSlideshow();
                    this.nextLightboxImage();
                }
            } else if (e.key === "Escape" && this.modal.style.display === "flex") {
                this.hide();
            }
        });
    }

    showLightboxImage() {
        if (this.currentLightboxIndex < 0 || this.currentLightboxIndex >= this.currentDisplayItems.length) return;
        const item = this.currentDisplayItems[this.currentLightboxIndex];
        const url = `/jdsc/assets/image?category=${encodeURIComponent(item.category)}&filename=${encodeURIComponent(item.filename)}`;
        this.lightboxImg.src = url;
        this.lightbox.style.display = "flex";
        if (this.resetLightbox) {
            this.resetLightbox(); // This will reset the zoom to fit the screen
        }
        this.updateSlideshowBarState();
    }
    
    prevLightboxImage() {
        if (this.currentDisplayItems.length <= 1) return;
        this.currentLightboxIndex--;
        if (this.currentLightboxIndex < 0) this.currentLightboxIndex = this.currentDisplayItems.length - 1;
        this.showLightboxImage();
    }

    nextLightboxImage() {
        if (this.currentDisplayItems.length <= 1) return;
        this.currentLightboxIndex++;
        if (this.currentLightboxIndex >= this.currentDisplayItems.length) this.currentLightboxIndex = 0;
        this.showLightboxImage();
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
            
            const rightContainer = document.createElement("div");
            rightContainer.style.display = "flex";
            rightContainer.style.alignItems = "center";
            rightContainer.style.gap = "10px"; // 拉开 X 与数字标签的距离
            
            let removeBtn = null;
            
            // 允许删除自定义分类
            if (name !== "全部" && name !== "预览+历史记录") {
                removeBtn = document.createElement("span");
                removeBtn.innerHTML = "✖";
                removeBtn.style.color = "#8a9199";
                removeBtn.style.cursor = "pointer";
                removeBtn.style.fontSize = "12px";
                removeBtn.style.opacity = "0"; // 使用透明度过渡，防止宽度突变导致排版跳跃
                removeBtn.style.transition = "all 0.2s ease";
                removeBtn.style.padding = "4px 6px"; // 增大安全点击热区
                removeBtn.style.borderRadius = "4px";
                
                removeBtn.onmouseenter = () => {
                    removeBtn.style.color = "#ff4d4f";
                    removeBtn.style.background = "rgba(255, 77, 79, 0.1)";
                };
                removeBtn.onmouseleave = () => {
                    removeBtn.style.color = "#8a9199";
                    removeBtn.style.background = "transparent";
                };

                removeBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (!confirm(`确定要移除分类 [${name}] 吗？\n(此操作仅移除侧边栏快捷入口，绝对不会删除您的本地物理文件！)`)) return;
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
                item.onmouseenter = () => removeBtn.style.opacity = "1";
                item.onmouseleave = () => removeBtn.style.opacity = "0";
            }
            
            const badge = document.createElement("span");
            badge.className = "jdsc-asset-cat-badge";
            badge.textContent = count;
            
            if (removeBtn) {
                rightContainer.append(removeBtn);
            }
            rightContainer.append(badge);
            
            item.append(labelContainer, rightContainer);
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

        this.currentDisplayItems = displayItems;

        if (displayItems.length === 0) {
            this.grid.innerHTML = '<div class="jdsc-asset-empty">没有找到素材。请点击右上角"打开硬盘目录"添加图片。</div>';
            return;
        }

        displayItems.forEach((item, index) => {
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
            
            box.onclick = () => {
                this.currentLightboxIndex = index;
                this.showLightboxImage();
            };

            // 完全重构右键菜单
            box.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                e.stopPropagation();

                const existingMenu = document.getElementById("jdsc-asset-context-menu");
                if (existingMenu) existingMenu.remove();

                const menu = document.createElement("div");
                menu.id = "jdsc-asset-context-menu";
                menu.style.position = "fixed";
                // 防御性编程：确保菜单不超出屏幕右侧和底部边界
                const menuWidth = 120;
                const menuHeight = 80;
                let left = e.clientX;
                let top = e.clientY;
                if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth;
                if (top + menuHeight > window.innerHeight) top = window.innerHeight - menuHeight;
                menu.style.left = left + "px";
                menu.style.top = top + "px";
                menu.style.background = "#2a2a2a";
                menu.style.border = "1px solid #444";
                menu.style.borderRadius = "5px";
                menu.style.padding = "5px 0";
                menu.style.zIndex = "10005";
                menu.style.boxShadow = "0 2px 10px rgba(0,0,0,0.5)";
                menu.style.color = "#eee";
                menu.style.minWidth = "120px";

                const createItem = (text, onClick) => {
                    const el = document.createElement("div");
                    el.textContent = text;
                    el.style.padding = "8px 15px";
                    el.style.cursor = "pointer";
                    el.style.fontSize = "14px";
                    el.onmouseenter = () => el.style.background = "#3a3a3a";
                    el.onmouseleave = () => el.style.background = "transparent";
                    el.onclick = (ev) => {
                        ev.stopPropagation();
                        menu.remove();
                        if (onClick) onClick();
                    };
                    return el;
                };

                const moveItem = createItem("📦 移动到...");
                moveItem.style.position = "relative";
                
                const subMenu = document.createElement("div");
                subMenu.style.display = "none";
                subMenu.style.position = "absolute";
                subMenu.style.left = "100%";
                subMenu.style.top = "0";
                subMenu.style.background = "#2a2a2a";
                subMenu.style.border = "1px solid #444";
                subMenu.style.borderRadius = "5px";
                subMenu.style.padding = "5px 0";
                subMenu.style.boxShadow = "0 2px 10px rgba(0,0,0,0.5)";
                subMenu.style.minWidth = "120px";
                
                this.categories.forEach(cat => {
                    if (cat.name === "预览+历史记录" || cat.name === item.category) return;
                    const catItem = createItem("📁 " + cat.name, async () => {
                        try {
                            const res = await fetch("/jdsc/assets/move_asset", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                    source_category: item.category,
                                    filename: item.filename,
                                    target_category: cat.name
                                })
                            });
                            const data = await res.json();
                            if (data.success) {
                                this.refresh();
                            } else {
                                alert("移动失败: " + data.error);
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    });
                    subMenu.appendChild(catItem);
                });
                
                if (subMenu.children.length === 0) {
                    const emptyItem = document.createElement("div");
                    emptyItem.textContent = "无其他分类";
                    emptyItem.style.padding = "8px 15px";
                    emptyItem.style.fontSize = "12px";
                    emptyItem.style.color = "#888";
                    subMenu.appendChild(emptyItem);
                }

                moveItem.onmouseenter = () => {
                    moveItem.style.background = "#3a3a3a";
                    subMenu.style.display = "block";
                };
                moveItem.onmouseleave = () => {
                    moveItem.style.background = "transparent";
                    subMenu.style.display = "none";
                };
                moveItem.appendChild(subMenu);
                
                const copyItem = createItem("📋 复制图片 (供节点加载)", async () => {
                    if (!navigator.clipboard || !navigator.clipboard.write) {
                        alert("⚠ 复制失败：您的浏览器环境不支持剪贴板高级写入 API。\n\n安全限制：此功能强制要求使用 HTTPS 协议或 localhost 访问 ComfyUI 才能生效。");
                        return;
                    }
                    try {
                        const url = `/jdsc/assets/image?category=${encodeURIComponent(item.category)}&filename=${encodeURIComponent(item.filename)}`;
                        const response = await fetch(url);
                        const blob = await response.blob();
                        await navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                        ]);
                        try {
                            const tip = document.createElement('div');
                            tip.textContent = "✓ 图片已提取进剪贴板，可直接在工作流按 Ctrl+V 粘贴！";
                            tip.style.cssText = 'position:fixed;top:20px;right:20px;background:#52c41a;color:#fff;padding:12px 20px;border-radius:4px;z-index:999999;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.15)';
                            document.body.appendChild(tip);
                            setTimeout(() => tip.remove(), 2500);
                        } catch(e){}
                    } catch (err) {
                        console.error("复制失败:", err);
                        alert("⚠ 复制图片失败，请检查浏览器权限。");
                    }
                });

                const delItem = createItem("🗑️ 删除", () => {
                    this.deleteAsset(item.category, item.filename);
                });
                delItem.style.color = "#ff5555";

                menu.appendChild(copyItem);
                menu.appendChild(moveItem);
                menu.appendChild(delItem);

                document.body.appendChild(menu);

                const closeMenu = (ev) => {
                    if (!menu.contains(ev.target)) {
                        menu.remove();
                        document.removeEventListener("click", closeMenu);
                        document.removeEventListener("contextmenu", closeMenu);
                    }
                };
                setTimeout(() => {
                    document.addEventListener("click", closeMenu);
                    document.addEventListener("contextmenu", closeMenu);
                }, 0);
            });
            
            box.append(img, title);
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

// 素材库本次页面会话解锁状态（JS 变量随刷新归零，sessionStorage 不会）
let _assetUnlocked = false;

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

        if (nodeData.name === "WuhuoLoadAsset") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                const node = this;
                const categoryWidget = this.widgets?.find(w => w.name === "category");
                const imageWidget = this.widgets?.find(w => w.name === "image");

                if (categoryWidget && imageWidget) {
                    categoryWidget.type = "combo";
                    imageWidget.type = "combo";
                    
                    categoryWidget.options = { values: [] };
                    imageWidget.options = { values: [] };

                    const getAssetData = async () => {
                        if (manager.categories && manager.categories.length > 0) {
                            return manager.categories;
                        }
                        try {
                            const res = await fetch("/jdsc/assets/list");
                            if (res.ok) {
                                const data = await res.json();
                                if (data.success) {
                                    manager.categories = data.categories || [];
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }
                        return manager.categories || [];
                    };
                    
                    const updateCategories = async () => {
                        const categoriesData = await getAssetData();
                        const categories = categoriesData.map(c => c.name);
                        categoryWidget.options.values = categories;
                        
                        if (!categories.includes(categoryWidget.value)) {
                            categoryWidget.value = categories[0] || "";
                        }
                        
                        await updateImages(categoryWidget.value);
                    };

                    const updateImages = async (categoryName) => {
                        const categoriesData = await getAssetData();
                        const cat = categoriesData.find(c => c.name === categoryName);
                        const files = cat ? cat.files : [];
                        imageWidget.options.values = files;
                        
                        if (!files.includes(imageWidget.value)) {
                            imageWidget.value = files[0] || "";
                        }
                        
                        if (node.graph) {
                            node.graph.setDirtyCanvas(true, true);
                        }
                    };

                    categoryWidget.callback = async function (value) {
                        await updateImages(value);
                    };

                    setTimeout(updateCategories, 50);
                }
                return r;
            };

            const onConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function (info) {
                const r = onConfigure ? onConfigure.apply(this, arguments) : undefined;
                
                const categoryWidget = this.widgets?.find(w => w.name === "category");
                const imageWidget = this.widgets?.find(w => w.name === "image");
                
                if (categoryWidget && imageWidget) {
                    categoryWidget.type = "combo";
                    imageWidget.type = "combo";
                    
                    const savedCategory = categoryWidget.value;
                    const savedImage = imageWidget.value;

                    const getAssetData = async () => {
                        if (manager.categories && manager.categories.length > 0) {
                            return manager.categories;
                        }
                        try {
                            const res = await fetch("/jdsc/assets/list");
                            if (res.ok) {
                                const data = await res.json();
                                if (data.success) {
                                    manager.categories = data.categories || [];
                                }
                            }
                        } catch (e) {
                            console.error(e);
                        }
                        return manager.categories || [];
                    };
                    
                    getAssetData().then(categoriesData => {
                        const categories = categoriesData.map(c => c.name);
                        categoryWidget.options.values = categories;
                        categoryWidget.value = savedCategory;
                        
                        const cat = categoriesData.find(c => c.name === savedCategory);
                        const files = cat ? cat.files : [];
                        imageWidget.options.values = files;
                        imageWidget.value = savedImage;
                        
                        if (this.graph) {
                            this.graph.setDirtyCanvas(true, true);
                        }
                    });
                }
                return r;
            };
        }
        
        // (Shift+左键收藏功能已移到 setup() 中的 document 级监听器，不再在此处注入)
    },
    async setup() {
        // ========================================================================
        // Shift + 左键点击节点 → 弹出"收藏到素材库"菜单
        // 使用 document 级别的捕获阶段监听器，这是浏览器 DOM 最顶层，
        // 不会被任何 LiteGraph 或其他插件的 onMouseDown 覆盖。
        // ========================================================================
        function __jdsc_getMediaUrl(node) {
            if (!node) return null;
            // 嗅探 1: 常规预览图 (PreviewImage, SaveImage 等)
            if (node.imgs && node.imgs.length > 0) {
                const idx = node.imageIndex || 0;
                if (node.imgs[idx] && node.imgs[idx].src) return node.imgs[idx].src;
            }
            // 嗅探 1.2: 兼容单个 image 对象的节点
            if (node.image && typeof node.image.src === "string") {
                return node.image.src;
            }
            if (node.images && node.images.length > 0) {
                const idx = node.imageIndex || 0;
                if (node.images[idx] && node.images[idx].src) return node.images[idx].src;
                if (typeof node.images[idx] === "string") return node.images[idx];
            }
            // 嗅探 2: 视频节点 (VHS_VideoCombine 等)
            if (node.animatedImages && node.animatedImages.length > 0) {
                const idx = node.imageIndex || 0;
                if (node.animatedImages[idx]) {
                    if (node.animatedImages[idx].src) return node.animatedImages[idx].src;
                    if (node.animatedImages[idx].videoEl && node.animatedImages[idx].videoEl.src) return node.animatedImages[idx].videoEl.src;
                }
            }
            // 嗅探 3: 带有 image/video widget 的加载节点 (LoadImage 等)
            if (node.widgets) {
                const mediaWidget = node.widgets.find(w => 
                    w.name === "image" || w.name === "video" || w.name === "Upload" || 
                    (w.value && typeof w.value === "string" && /\.(png|jpg|jpeg|webp|gif|mp4|webm|mov|avif)$/i.test(w.value))
                );
                if (mediaWidget && mediaWidget.value && typeof mediaWidget.value === "string") {
                    if (mediaWidget.value.startsWith("http://") || mediaWidget.value.startsWith("https://") || mediaWidget.value.startsWith("/")) {
                        return mediaWidget.value;
                    }
                    return `/view?filename=${encodeURIComponent(mediaWidget.value)}&type=input&subfolder=`;
                }
            }
            return null;
        }

        function __jdsc_showCollectMenu(posX, posY, targetUrl, node) {
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
                                    body: JSON.stringify({ url: targetUrl, target_category: cat.name })
                                }).then(res => res.json()).then(saveData => {
                                    if (saveData.success) {
                                        const tip = document.createElement("div");
                                        tip.textContent = "✅ 已收藏到: " + cat.name;
                                        tip.style.cssText = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(76,175,80,0.9); color:#fff; padding:10px 20px; border-radius:8px; z-index:10000; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.3); transition:opacity 0.5s;";
                                        document.body.appendChild(tip);
                                        setTimeout(() => { tip.style.opacity = "0"; setTimeout(() => document.body.removeChild(tip), 500); }, 2000);
                                    } else {
                                        alert("保存失败: " + saveData.error);
                                    }
                                }).catch(err => {
                                    console.error(err);
                                    alert("保存失败，网络请求错误。");
                                });
                            }
                        });
                    });
                    if (menuItems.length === 0) { alert("素材库中还没有自定义目录，请先打开素材库进行添加！"); return; }
                    LiteGraph.closeAllContextMenus();
                    new LiteGraph.ContextMenu(menuItems, { event: null, left: posX, top: posY, node: node });
                }).catch(err => {
                    console.error(err);
                    alert("获取分类列表失败，网络错误。");
                });
        }

        // ========================================================================
        // 核心注入：在 LGraphCanvas 原型（Prototype）层劫持鼠标按下处理
        // 从类（Class）级别进行覆盖，这样无论是 window.app.canvas 还是重新初始化的任何实例，
        // 或者是任何嵌套、分屏画布，都绝对会被捕获！且完美利用 LiteGraph 内部精准计算的 graph_mouse 坐标。
        // ========================================================================
        const LGraphCanvasClass = window.LGraphCanvas || (window.LiteGraph && window.LiteGraph.LGraphCanvas);
        if (LGraphCanvasClass) {
            console.log("[jdsc] 成功注入 LGraphCanvas.prototype.processMouseDown 拦截器");
            const origProcessMouseDown = LGraphCanvasClass.prototype.processMouseDown;
            
            LGraphCanvasClass.prototype.processMouseDown = function (e) {
                // 仅限 Shift + 左键点击
                if (e.button === 0 && e.shiftKey) {
                    // 强制 LiteGraph 更新鼠标坐标，确保 graph_mouse 坐标最新
                    if (typeof this.adjustMouseEvent === 'function') {
                        this.adjustMouseEvent(e);
                    }
                    
                    const graphX = this.graph_mouse[0];
                    const graphY = this.graph_mouse[1];
                    
                    // 查找被点击的节点，使用 this.graph._nodes 绕过视野裁剪
                    const node = this.graph.getNodeOnPos(graphX, graphY, this.graph._nodes, 5);
                    
                    console.log("[jdsc-debug] 检测到 Shift + 左键点击!", {
                        hasNode: !!node,
                        nodeType: node ? node.type : null,
                        nodeTitle: node ? node.title : null,
                        graphMouse: [graphX, graphY]
                    });

                    if (node) {
                        const targetUrl = __jdsc_getMediaUrl(node);
                        console.log("[jdsc-debug] 节点媒体地址嗅探结果:", targetUrl, "节点详情:", node);

                        if (targetUrl) {
                            const posX = e.clientX;
                            const posY = e.clientY;
                            
                            // 必须阻止默认事件，防止 LiteGraph 触发多选框或框选行为
                            e.preventDefault();
                            e.stopPropagation();
                            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
                            
                            __jdsc_showCollectMenu(posX, posY, targetUrl, node);
                            
                            // 返回 true 终止后续点击逻辑
                            return true;
                        } else {
                            console.warn("[jdsc-debug] 该节点似乎不包含可识别的图片或视频资源。如果它确实有图片，可能是由非标准插件魔改的渲染方式。");
                        }
                    }
                }
                
                // 放行其他所有点击
                if (origProcessMouseDown) {
                    return origProcessMouseDown.apply(this, arguments);
                }
            };
        } else {
            console.error("[jdsc] 未能在全局找到 LGraphCanvas 类，原型拦截失败！");
        }

        // ========================================================================
        // 核心注入：在 LGraphNode 原型（Prototype）层劫持右键菜单选项
        // 从类（Class）级别进行覆盖，确保任何显示图像/视频的节点在右键菜单最底部都多出“收藏到素材库”选项
        // ========================================================================
        const LGraphNodeClass = window.LGraphNode || (window.LiteGraph && window.LiteGraph.LGraphNode);
        if (LGraphNodeClass) {
            console.log("[jdsc] 成功注入 LGraphNode.prototype.getExtraMenuOptions 拦截器");
            const origGetExtraMenuOptions = LGraphNodeClass.prototype.getExtraMenuOptions;
            LGraphNodeClass.prototype.getExtraMenuOptions = function (canvas, options) {
                options = options || [];
                let r;
                if (origGetExtraMenuOptions) {
                    try {
                        r = origGetExtraMenuOptions.apply(this, arguments);
                    } catch (err) {
                        console.error("[jdsc] 执行原 getExtraMenuOptions 报错:", err);
                    }
                }
                try {
                    const targetUrl = __jdsc_getMediaUrl(this);
                    if (targetUrl) {
                        // 确保不重复添加
                        if (!options.some(opt => opt && opt.content === "⭐ 收藏到素材库")) {
                            options.push({
                                content: "⭐ 收藏到素材库",
                                callback: (value, menuOptions, e, menu, node) => {
                                    const posX = (e && typeof e.clientX !== 'undefined') ? e.clientX : (menu && menu.root ? menu.root.getBoundingClientRect().left : 100);
                                    const posY = (e && typeof e.clientY !== 'undefined') ? e.clientY : (menu && menu.root ? menu.root.getBoundingClientRect().top : 100);
                                    __jdsc_showCollectMenu(posX, posY, targetUrl, this);
                                }
                            });
                        }
                    }
                } catch (err) {
                    console.error("[jdsc] 拦截右键菜单报错:", err);
                }
                return r;
            };
        } else {
            console.error("[jdsc] 未能在全局找到 LGraphNode 类，右键菜单拦截失败！");
        }




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

        // ---- 素材库密码保护 (与历史记录密码独立) ----
        // 配置密码存 localStorage（持久），解锁状态用 JS 变量（刷新即清零）
        const ASSET_PWD_KEY = "jdsc_asset_pwd";

        async function checkAssetPassword() {
            // 本次页面加载已解锁 → 直接通过
            if (_assetUnlocked) return true;

            const storedPwd = localStorage.getItem(ASSET_PWD_KEY);

            // 从未设置过密码 → 引导设置
            if (storedPwd === null) {
                const newPwd = await asyncPromptPassword("首次使用素材库\n请设置一个访问密码（留空则不设密码）：");
                if (newPwd === null) return false;
                localStorage.setItem(ASSET_PWD_KEY, newPwd);
                _assetUnlocked = true;
                return true;
            }

            // 无密码模式 → 直接通过
            if (storedPwd === "") {
                _assetUnlocked = true;
                return true;
            }

            // 有密码 → 验证
            const input = await asyncPromptPassword("🔐 请输入素材库密码：");
            if (input === null) return false;
            if (input !== storedPwd) {
                alert("密码错误！");
                return false;
            }
            _assetUnlocked = true;
            return true;
        }

        globalBtn.onclick = async (e) => {
            if (hasMoved) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const ok = await checkAssetPassword();
            if (ok) manager.show();
        };

        // 右键悬浮按钮 → 修改/清除密码
        globalBtn.addEventListener("contextmenu", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            const storedPwd = localStorage.getItem(ASSET_PWD_KEY);
            const hasPassword = storedPwd !== null && storedPwd !== "";
            const action = confirm(
                hasPassword
                    ? "素材库密码管理\n\n确定 → 修改密码\n取消 → 保持不变"
                    : "素材库当前未设置密码\n\n确定 → 设置新密码\n取消 → 保持不变"
            );
            if (!action) return;
            if (hasPassword) {
                const old = await asyncPromptPassword("请先输入当前密码以确认身份：");
                if (old === null) return;
                if (old !== storedPwd) { alert("旧密码错误！"); return; }
            }
            const newPwd = await asyncPromptPassword("请输入新密码（留空则清除密码保护）：");
            if (newPwd === null) return;
            localStorage.setItem(ASSET_PWD_KEY, newPwd);
            // 重置本次解锁状态
            _assetUnlocked = false;
            alert(newPwd === "" ? "✅ 密码已清除，素材库将不再需要密码。" : "✅ 密码已更新。");
        });

        // 读取历史位置，并进行边界安全钳位，防止按钮因分辨率/布局变化而飞出屏幕
        try {
            const savedPos = localStorage.getItem("jdsc_asset_btn_pos");
            if (savedPos) {
                const pos = JSON.parse(savedPos);
                let left = parseFloat(pos.left) || 0;
                let top = parseFloat(pos.top) || 0;
                const btnW = 100; // 按钮估算宽度
                const btnH = 36;  // 按钮估算高度
                const maxLeft = window.innerWidth - btnW - 10;
                const maxTop  = window.innerHeight - btnH - 10;
                // 钳位到屏幕安全区
                left = Math.max(10, Math.min(left, maxLeft));
                top  = Math.max(10, Math.min(top,  maxTop));
                globalBtn.style.right = "auto";
                globalBtn.style.bottom = "auto";
                globalBtn.style.left = left + "px";
                globalBtn.style.top = top + "px";
            }
        } catch(e) {}

        document.body.appendChild(globalBtn);
    }
});
