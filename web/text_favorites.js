// Copyright (c) 2024-2026 icefox21
// This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
// Project Link: https://github.com/icefox21/whtools

// ==============================================================================
// 文本收藏扩展 - 为 WuhuoTextGate 节点添加文本收藏功能
// 独立扩展文件,不修改原有 jdsc.js,避免触发版本检测和数据丢失问题
// ==============================================================================

(() => {
    const KEY_TEXT_FAVS = "jdsc:text_favs";
    const KEY_MODAL_POS = "jdsc:textFavsModalPos";
    const KEY_LAST_CAT = "jdsc:textFavsLastCat"; // 记录上次选中的分类
    let TEXT_FAVS_CACHE = null;

    // 预定义分类
    const DEFAULT_CATEGORIES = ["全部", "SFW", "NSFW"];

    // 从服务器同步文本收藏数据
    async function syncTextFavsFromServer() {
        try {
            const res = await fetch('/jdsc/text_favorites');
            if (res && res.ok) {
                const data = await res.json();
                TEXT_FAVS_CACHE = migrateData(data);
            }
        } catch (e) {
            console.warn('[TextFavorites] 从服务器同步失败:', e);
        }
    }

    // 数据迁移：将旧的 string 格式转换为 object 格式
    function migrateData(data) {
        if (!data || typeof data !== 'object') return {};

        const migrated = {};
        let hasChanges = false;

        for (const [key, val] of Object.entries(data)) {
            if (typeof val === 'string') {
                // 旧格式 -> 新格式
                migrated[key] = {
                    content: val,
                    category: "SFW",
                    tags: []
                };
                hasChanges = true;
            } else if (typeof val === 'object' && val.content) {
                // 已经是新格式，确保字段完整
                migrated[key] = {
                    content: val.content,
                    category: val.category || "SFW",
                    tags: val.tags || []
                };
            } else {
                // 未知格式，保留原样或跳过
                migrated[key] = val;
            }
        }

        return migrated;
    }

    // 获取文本收藏
    function getTextFavs() {
        if (TEXT_FAVS_CACHE) return TEXT_FAVS_CACHE;

        try {
            const s = localStorage.getItem(KEY_TEXT_FAVS);
            let data = s ? JSON.parse(s) : {};
            TEXT_FAVS_CACHE = migrateData(data);
        } catch {
            TEXT_FAVS_CACHE = {};
        }
        return TEXT_FAVS_CACHE;
    }

    // 保存文本收藏(同时保存到本地和服务器)
    function saveTextFavs(val) {
        try {
            TEXT_FAVS_CACHE = migrateData(val); // 确保保存前格式正确

            localStorage.setItem(KEY_TEXT_FAVS, JSON.stringify(TEXT_FAVS_CACHE));

            fetch('/jdsc/text_favorites', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(TEXT_FAVS_CACHE)
            }).catch(e => {
                console.warn('[TextFavorites] 保存到服务器失败:', e);
            });
        } catch (e) {
            console.error('[TextFavorites] 保存失败:', e);
        }
    }

    // 保存/加载对话框位置
    function saveModalPos(x, y) {
        try {
            localStorage.setItem(KEY_MODAL_POS, JSON.stringify({ x, y }));
        } catch { }
    }

    // 保存/加载上次选中的分类
    function saveLastCategory(cat) {
        try {
            localStorage.setItem(KEY_LAST_CAT, cat);
        } catch { }
    }

    function getLastCategory() {
        try {
            return localStorage.getItem(KEY_LAST_CAT) || "全部";
        } catch {
            return "全部";
        }
    }

    // 注入 CSS 样式
    function ensureTextFavsStyles() {
        if (document.getElementById("jdsc-text-favs-styles")) return;
        const style = document.createElement("style");
        style.id = "jdsc-text-favs-styles";
        style.textContent = `
            .jdsc-tf-modal {
                position: absolute;
                background: #111316;
                border: 1px solid #3a3f44;
                border-radius: 12px;
                z-index: 1000;
                box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                user-select: none;
            }
            .jdsc-tf-header {
                display: flex;
                align-items: center;
                padding: 0 16px;
                height: 48px;
                background: linear-gradient(135deg, #1a1d21 0%, #2a2e32 100%);
                border-bottom: 1px solid #3a3f44;
                cursor: move;
                flex-shrink: 0;
                position: relative;
            }
            .jdsc-tf-header::before {
                content: "";
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 2px;
                background: linear-gradient(90deg, #1677ff, #52c41a);
            }
            .jdsc-tf-title {
                color: #e6e9ec;
                font-size: 15px;
                font-weight: 600;
                flex: 1;
                letter-spacing: 0.5px;
            }
            .jdsc-tf-close {
                color: #8a9199;
                font-size: 20px;
                cursor: pointer;
                width: 28px;
                height: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 6px;
                transition: all 0.2s;
            }
            .jdsc-tf-close:hover {
                background: rgba(255, 77, 79, 0.1);
                color: #ff4d4f;
            }
            .jdsc-tf-body-container {
                display: flex;
                flex: 1;
                overflow: hidden;
                background: #1a1d21;
            }
            .jdsc-tf-sidebar {
                width: 140px;
                background: #1a1d21;
                border-right: 1px solid #3a3f44;
                display: flex;
                flex-direction: column;
                padding: 12px 0;
                overflow-y: auto;
                flex-shrink: 0;
            }
            .jdsc-tf-sidebar::-webkit-scrollbar { width: 4px; }
            .jdsc-tf-sidebar::-webkit-scrollbar-thumb { background: #3a3f44; border-radius: 2px; }
            
            .jdsc-tf-cat-item {
                padding: 10px 16px;
                cursor: pointer;
                color: #8a9199;
                font-size: 13px;
                font-weight: 500;
                transition: all 0.2s;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                margin: 2px 8px;
                border-radius: 6px;
            }
            .jdsc-tf-cat-item:hover {
                background: rgba(255, 255, 255, 0.05);
                color: #e6e9ec;
            }
            .jdsc-tf-cat-item.active {
                background: rgba(22, 119, 255, 0.1);
                color: #1677ff;
                font-weight: 600;
            }
            .jdsc-tf-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
                grid-auto-rows: min-content;
                gap: 12px;
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                align-content: start;
            }
            .jdsc-tf-grid::-webkit-scrollbar { width: 8px; }
            .jdsc-tf-grid::-webkit-scrollbar-track { background: transparent; }
            .jdsc-tf-grid::-webkit-scrollbar-thumb { background: #3a3f44; border-radius: 4px; }
            .jdsc-tf-grid::-webkit-scrollbar-thumb:hover { background: #4b5563; }

            .jdsc-tf-card {
                background: #2a2e32;
                color: #e6e9ec;
                padding: 12px;
                border-radius: 8px;
                cursor: pointer;
                text-align: center;
                transition: all 0.2s;
                border: 1px solid #3a3f44;
                word-wrap: break-word;
                font-size: 13px;
                min-height: 48px;
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .jdsc-tf-card:hover {
                background: #333a40;
                border-color: #4a5159;
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            }
            .jdsc-tf-card.nsfw { border-bottom: 3px solid #ff4d4f; }
            .jdsc-tf-card.sfw { border-bottom: 3px solid #1677ff; }
            
            .jdsc-tf-empty {
                padding: 60px 20px;
                text-align: center;
                color: #6b7280;
                font-size: 14px;
                grid-column: 1 / -1;
            }
            .jdsc-tf-context-menu {
                position: fixed;
                background: #1c1f22;
                border: 1px solid #3a3f44;
                border-radius: 8px;
                padding: 4px;
                z-index: 10001;
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                min-width: 140px;
            }
            .jdsc-tf-menu-item {
                padding: 8px 12px;
                color: #b7bcc2;
                cursor: pointer;
                font-size: 13px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 4px;
                transition: all 0.2s;
            }
            .jdsc-tf-menu-item:hover {
                background: rgba(255, 255, 255, 0.05);
                color: #fff;
            }
            .jdsc-tf-menu-item.delete { color: #ff4d4f; }
            .jdsc-tf-menu-item.delete:hover { background: rgba(255, 77, 79, 0.1); }
            
            .jdsc-tf-submenu {
                position: absolute;
                left: 100%;
                top: -4px;
                background: #1c1f22;
                border: 1px solid #3a3f44;
                border-radius: 8px;
                padding: 4px;
                z-index: 10002;
                box-shadow: 0 8px 24px rgba(0,0,0,0.4);
                min-width: 140px;
                max-height: 300px;
                overflow-y: auto;
            }
        `;
        document.head.appendChild(style);
    }

    // 创建可拖动函数
    function makeDraggable(el, handle) {
        let sx = 0, sy = 0, ex = 0, ey = 0, drag = false, moved = false;

        const onDown = e => {
            if (e.target.closest('.jdsc-tf-close')) return; // 点击关闭按钮不触发拖拽
            drag = true;
            moved = false;
            sx = e.clientX;
            sy = e.clientY;
            ex = el.offsetLeft;
            ey = el.offsetTop;
        };

        const onMove = e => {
            if (!drag) return;
            const dx = e.clientX - sx;
            const dy = e.clientY - sy;
            if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
            el.style.left = `${ex + dx}px`;
            el.style.top = `${ey + dy}px`;
        };

        const onUp = () => {
            if (!drag) return;
            drag = false;
            saveModalPos(el.offsetLeft, el.offsetTop);
            if (moved) {
                el.__drag_last = Date.now();
                moved = false;
            }
        };

        handle.addEventListener("mousedown", onDown);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);

        el.addEventListener("click", (e) => {
            try {
                const t = el.__drag_last || 0;
                if (t && (Date.now() - t) < 300) {
                    e.stopPropagation();
                    e.preventDefault();
                    el.__drag_last = 0;
                }
            } catch { }
        }, true);
    }

    // 打开文本收藏对话框
    function openTextFavsModal(node) {
        ensureTextFavsStyles();
        const favs = getTextFavs();
        let currentCategory = getLastCategory();

        // 关闭已有的文本收藏对话框
        const existingModal = document.getElementById('jdsc-text-favs-modal');
        if (existingModal) {
            document.body.removeChild(existingModal);
        }

        // 创建对话框
        const modal = document.createElement('div');
        modal.id = 'jdsc-text-favs-modal';
        modal.className = 'jdsc-tf-modal';
        modal.style.width = '800px';
        modal.style.height = '550px';

        // 计算位置 (保持原有逻辑)
        const modalWidth = 800;
        const modalHeight = 550;
        let posX = 100, posY = 100;

        try {
            const canvas = window.app?.canvas;
            if (canvas && node.pos) {
                const scale = canvas.ds?.scale || 1;
                const offset = canvas.ds?.offset || [0, 0];
                const canvasEl = canvas.canvas;
                const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : { left: 0, top: 0 };
                const nodeScreenX = canvasRect.left + (node.pos[0] + offset[0]) * scale;
                const nodeScreenY = canvasRect.top + (node.pos[1] + offset[1]) * scale;
                const nodeScreenW = (node.size?.[0] || 200) * scale;
                const screenW = window.innerWidth;
                const screenH = window.innerHeight;
                const nodeCenterX = nodeScreenX + nodeScreenW / 2;

                if (nodeCenterX > screenW / 2) {
                    posX = Math.max(10, nodeScreenX - modalWidth - 20);
                } else {
                    posX = Math.min(screenW - modalWidth - 10, nodeScreenX + nodeScreenW + 20);
                }
                posY = Math.max(10, Math.min(screenH - modalHeight - 10, nodeScreenY));
            }
        } catch (e) { }

        modal.style.left = posX + 'px';
        modal.style.top = posY + 'px';

        // ---------------- 标题栏 ----------------
        const header = document.createElement('div');
        header.className = 'jdsc-tf-header';

        const title = document.createElement('div');
        title.className = 'jdsc-tf-title';
        title.textContent = '文本收藏夹';
        header.appendChild(title);

        const closeBtn = document.createElement('div');
        closeBtn.className = 'jdsc-tf-close';
        closeBtn.innerHTML = '×';
        closeBtn.addEventListener('click', () => document.body.removeChild(modal));
        header.appendChild(closeBtn);

        modal.appendChild(header);

        // ---------------- 主体内容区 (侧边栏 + 网格) ----------------
        const bodyContainer = document.createElement('div');
        bodyContainer.className = 'jdsc-tf-body-container';

        // --- 左侧边栏 (分类) ---
        const sidebar = document.createElement('div');
        sidebar.className = 'jdsc-tf-sidebar';

        // 渲染分类列表
        function renderCategories() {
            sidebar.innerHTML = '';

            // 获取所有使用过的分类 (除了默认的)
            const usedCategories = new Set();
            Object.values(favs).forEach(item => {
                if (item.category && !DEFAULT_CATEGORIES.includes(item.category)) {
                    usedCategories.add(item.category);
                }
            });

            const allCategories = [...DEFAULT_CATEGORIES, ...Array.from(usedCategories).sort()];

            allCategories.forEach(cat => {
                const catItem = document.createElement('div');
                catItem.textContent = cat;
                const isActive = cat === currentCategory;
                catItem.className = `jdsc-tf-cat-item${isActive ? ' active' : ''}`;

                catItem.addEventListener('click', () => {
                    currentCategory = cat;
                    saveLastCategory(cat);
                    renderCategories(); // 重新渲染侧边栏以更新高亮
                    renderGrid();       // 重新渲染网格
                });

                sidebar.appendChild(catItem);
            });
        }

        // --- 右侧网格 (收藏项) ---
        const grid = document.createElement('div');
        grid.className = 'jdsc-tf-grid';

        // 渲染网格内容
        function renderGrid() {
            grid.innerHTML = '';
            const names = Object.keys(favs).sort();
            let count = 0;

            names.forEach(name => {
                const item = favs[name];
                const itemCat = item.category || "未分类";

                // 筛选逻辑
                if (currentCategory === "全部") {
                    // 显示所有
                } else if (currentCategory === "SFW") {
                    // 显示SFW 或 空分类
                    if (itemCat !== "SFW" && itemCat !== "") return;
                } else {
                    // 精确匹配
                    if (itemCat !== currentCategory) return;
                }

                count++;
                const card = document.createElement('div');
                card.textContent = name;
                card.title = item.content; // 悬停显示完整内容
                card.className = 'jdsc-tf-card';

                // 分类样式提示
                if (itemCat === "NSFW") {
                    card.classList.add('nsfw');
                } else if (itemCat === "SFW") {
                    card.classList.add('sfw');
                }

                // 点击应用
                card.addEventListener('click', () => {
                    const editWidget = node.widgets.find(w => w.name === "edit_text");
                    if (!editWidget) {
                        alert("❌ 无法找到文本输入框");
                        return;
                    }
                    editWidget.value = item.content;
                    if (editWidget.callback) editWidget.callback(editWidget.value);
                    if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);

                    node.properties = node.properties || {};
                    node.properties.current_fav_name = name;
                    const labelBtn = node.widgets.find(w => w.name && w.name.startsWith("🏷️ 词条:"));
                    if (labelBtn) labelBtn.name = "🏷️ 词条: " + name;

                    // 闪烁效果反馈
                    const oldBg = card.style.background;
                    card.style.background = '#52c41a';
                    setTimeout(() => card.style.background = '', 200);
                });

                // 右键菜单
                card.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showContextMenu(e, name, item);
                });

                grid.appendChild(card);
            });

            if (count === 0) {
                const emptyTip = document.createElement('div');
                emptyTip.className = 'jdsc-tf-empty';
                emptyTip.textContent = '此分类下暂无收藏';
                grid.appendChild(emptyTip);
            }
        }

        // 显示右键菜单
        function showContextMenu(e, name, item) {
            const menu = document.createElement('div');
            menu.className = 'jdsc-tf-context-menu';
            menu.style.left = `${e.clientX}px`;
            menu.style.top = `${e.clientY}px`;

            const createMenuItem = (text, onClick, className = '') => {
                const div = document.createElement('div');
                div.className = `jdsc-tf-menu-item ${className}`;
                div.textContent = text;
                if (onClick) div.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    onClick();
                    document.body.removeChild(menu);
                });
                return div;
            };

            // 修改名称
            menu.appendChild(createMenuItem('📝 修改名称', () => {
                const newName = prompt('请输入新名称:', name);
                if (newName && newName.trim() && newName.trim() !== name) {
                    favs[newName.trim()] = favs[name];
                    delete favs[name];
                    saveTextFavs(favs);
                    renderCategories();
                    renderGrid();
                }
            }));

            // 编辑内容
            menu.appendChild(createMenuItem('✏️ 编辑内容', () => {
                const newContent = prompt('修改提示词内容:', item.content);
                if (newContent !== null && newContent.trim()) {
                    favs[name].content = newContent;
                    saveTextFavs(favs);
                    renderGrid();
                }
            }));

            // 移动到分类 (悬停显示子菜单)
            const moveItem = document.createElement('div');
            moveItem.className = 'jdsc-tf-menu-item';
            moveItem.innerHTML = '📂 移动到... <span style="font-size: 10px; color: #888; margin-left: 10px;">▶</span>';

            let submenu = null;
            let submenuTimeout = null;

            moveItem.addEventListener('mouseenter', () => {
                // 清除可能的延迟关闭
                if (submenuTimeout) {
                    clearTimeout(submenuTimeout);
                    submenuTimeout = null;
                }

                // 如果子菜单已存在，不重复创建
                if (submenu && submenu.parentNode) return;

                // 创建子菜单
                submenu = document.createElement('div');
                submenu.className = 'jdsc-tf-submenu';

                // 收集所有分类
                const usedCategories = new Set();
                DEFAULT_CATEGORIES.forEach(c => usedCategories.add(c));
                Object.values(favs).forEach(f => {
                    if (f.category && f.category.trim()) {
                        usedCategories.add(f.category);
                    }
                });

                // 排序(把默认分类放前面)
                const sortedCats = [];
                DEFAULT_CATEGORIES.forEach(c => {
                    if (c !== '全部') sortedCats.push(c);
                });
                Array.from(usedCategories).sort().forEach(c => {
                    if (!DEFAULT_CATEGORIES.includes(c)) sortedCats.push(c);
                });

                // 添加分类选项
                sortedCats.forEach(cat => {
                    const catDiv = document.createElement('div');
                    catDiv.className = 'jdsc-tf-menu-item';
                    const isCurrent = cat === (item.category || "SFW");
                    catDiv.textContent = isCurrent ? '✓ ' + cat : cat;
                    if (isCurrent) catDiv.style.color = '#52c41a';

                    catDiv.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        favs[name].category = cat;
                        saveTextFavs(favs);
                        renderCategories();
                        renderGrid();
                        // 关闭所有菜单
                        if (submenu && submenu.parentNode) submenu.parentNode.removeChild(submenu);
                        if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
                    });
                    submenu.appendChild(catDiv);
                });

                // 分隔线
                const divider = document.createElement('div');
                divider.style.cssText = 'height: 1px; background: #3a3f44; margin: 4px 8px;';
                submenu.appendChild(divider);

                // 新建分类
                const newCatDiv = document.createElement('div');
                newCatDiv.className = 'jdsc-tf-menu-item';
                newCatDiv.textContent = '+ 新建分类...';
                newCatDiv.style.color = '#1677ff';
                newCatDiv.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    const newCat = prompt("请输入新分类名称:");
                    if (newCat && newCat.trim()) {
                        favs[name].category = newCat.trim();
                        saveTextFavs(favs);
                        renderCategories();
                        renderGrid();
                        if (submenu && submenu.parentNode) submenu.parentNode.removeChild(submenu);
                        if (menu && menu.parentNode) menu.parentNode.removeChild(menu);
                    }
                });
                submenu.appendChild(newCatDiv);

                // 防止子菜单超出屏幕右侧
                moveItem.appendChild(submenu);
                const rect = submenu.getBoundingClientRect();
                if (rect.right > window.innerWidth) {
                    submenu.style.left = 'auto';
                    submenu.style.right = '100%';
                }

                // 子菜单自己的鼠标事件
                submenu.addEventListener('mouseenter', () => {
                    if (submenuTimeout) {
                        clearTimeout(submenuTimeout);
                        submenuTimeout = null;
                    }
                });
                submenu.addEventListener('mouseleave', () => {
                    submenuTimeout = setTimeout(() => {
                        if (submenu && submenu.parentNode) {
                            submenu.parentNode.removeChild(submenu);
                        }
                    }, 200);
                });
            });

            moveItem.addEventListener('mouseleave', () => {
                submenuTimeout = setTimeout(() => {
                    if (submenu && submenu.parentNode) {
                        submenu.parentNode.removeChild(submenu);
                    }
                }, 200);
            });

            menu.appendChild(moveItem);

            // 删除
            const deleteItem = createMenuItem('🗑️ 删除', () => {
                if (confirm(`确定要删除收藏 "${name}" 吗?`)) {
                    delete favs[name];
                    saveTextFavs(favs);
                    renderCategories();
                    renderGrid();
                }
            }, 'delete');
            menu.appendChild(deleteItem);

            document.body.appendChild(menu);

            // 点击其他地方关闭
            const closeMenu = (ev) => {
                if (!menu.contains(ev.target)) {
                    try { document.body.removeChild(menu); } catch { }
                    document.removeEventListener('click', closeMenu);
                }
            };
            setTimeout(() => document.addEventListener('click', closeMenu), 0);
        }

        bodyContainer.appendChild(sidebar);
        bodyContainer.appendChild(grid);
        modal.appendChild(bodyContainer);
        document.body.appendChild(modal);

        makeDraggable(modal, header);

        // 标题栏右键关闭对话框
        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                document.body.removeChild(modal);
            } catch { }
        });

        // 初始渲染
        renderCategories();
        renderGrid();
    }

    // 初始化:从服务器同步数据
    syncTextFavsFromServer();

    // 注册扩展
    function registerExtension() {
        if (!window.app || !window.app.registerExtension) {
            setTimeout(registerExtension, 500);
            return;
        }

        window.app.registerExtension({
            name: "jdsc.TextFavorites",
            async nodeCreated(node) {
                const nodeType = node.comfyClass || node.type;
                if (nodeType !== "WuhuoTextGate") return;

                node.properties = node.properties || {};
                const onConfigure = node.onConfigure;
                node.onConfigure = function(info) {
                    if (onConfigure) onConfigure.apply(this, arguments);
                    if (this.properties && this.properties.current_fav_name) {
                        const labelBtn = this.widgets.find(w => w.name && w.name.startsWith("🏷️ 词条:"));
                        if (labelBtn) {
                            labelBtn.name = "🏷️ 词条: " + this.properties.current_fav_name;
                        }
                    }
                    
                    // 修复由于新增按钮导致的旧版本工作流 widget 错位问题
                    const enhanceWidget = this.widgets.find(w => w.name === "enhance_mode");
                    const keyWordWidget = this.widgets.find(w => w.name === "key_word");
                    const randomSfwWidget = this.widgets.find(w => w.name === "random_sfw");
                    if (enhanceWidget && typeof enhanceWidget.value === "boolean") {
                        // 如果 enhance_mode 变成了布尔值 (原本 random_sfw 的值)，说明发生了错位
                        if (randomSfwWidget) randomSfwWidget.value = enhanceWidget.value;
                        if (keyWordWidget) {
                            enhanceWidget.value = keyWordWidget.value; // key_word 拿到了原 enhance_mode 的值
                            keyWordWidget.value = ""; // 重置 key_word
                        } else {
                            enhanceWidget.value = "无";
                        }
                    }
                };

                // 1. 提示词收藏夹按钮
                const favsBtn = node.addWidget("button", "提示词收藏夹", null, () => {
                    try { openTextFavsModal(node); } catch (e) { alert("❌ 打开失败: " + e); }
                });

                // 2. 清空并粘贴按钮
                const pasteBtn = node.addWidget("button", "清空并粘贴", null, async () => {
                    try {
                        const editWidget = node.widgets.find(w => w.name === "edit_text");
                        if (editWidget) {
                            const text = await navigator.clipboard.readText();
                            editWidget.value = text || "";
                            if (editWidget.callback) editWidget.callback(editWidget.value);
                            if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
                            
                            node.properties = node.properties || {};
                            node.properties.current_fav_name = "";
                            const labelBtn = node.widgets.find(w => w.name && w.name.startsWith("🏷️ 词条:"));
                            if (labelBtn) labelBtn.name = "🏷️ 词条: (未选择)";
                        }
                    } catch (e) { alert("❌ 粘贴失败，请检查权限"); }
                });

                // 调整按钮位置 (放在 free_pass 后)
                const freePassIndex = node.widgets.findIndex(w => w.name === "free_pass");
                if (freePassIndex !== -1) {
                    const widgets = node.widgets;
                    // 移除刚添加的两个按钮
                    widgets.splice(widgets.indexOf(favsBtn), 1);
                    widgets.splice(widgets.indexOf(pasteBtn), 1);
                    // 插入到指定位置
                    widgets.splice(freePassIndex + 1, 0, favsBtn, pasteBtn);
                }

                // 3. 收藏当前按钮及当前词条显示
                const currentFavBtn = node.addWidget("button", "🏷️ 词条: (未选择)", null, () => {
                    try { openTextFavsModal(node); } catch (e) { alert("❌ 打开失败: " + e); }
                });

                const saveBtn = node.addWidget("button", "收藏当前", null, () => {
                    try {
                        const editWidget = node.widgets.find(w => w.name === "edit_text");
                        const currentText = editWidget ? editWidget.value : "";

                        if (!currentText || !currentText.trim()) {
                            alert("当前输入框为空，无法收藏");
                            return;
                        }

                        const defaultName = (node.properties && node.properties.current_fav_name) ? node.properties.current_fav_name : "";
                        const name = prompt("请输入收藏名称 (保持原名则覆盖当前词条):", defaultName);
                        if (!name || !name.trim()) return;

                        let cat = "SFW";
                        const favs = getTextFavs();
                        
                        if (name.trim() === defaultName && favs[name.trim()]) {
                            cat = favs[name.trim()].category;
                        } else {
                            let defaultCat = getLastCategory();
                            if (defaultCat === "全部") defaultCat = "SFW";
                            let inputCat = prompt("请输入分类 (例如: NSFW, 人物, SFW):", defaultCat);
                            if (inputCat === null) return;
                            cat = inputCat;
                        }

                        favs[name.trim()] = {
                            content: currentText,
                            category: cat.trim() || "SFW",
                            tags: []
                        };
                        saveTextFavs(favs);
                        
                        node.properties = node.properties || {};
                        node.properties.current_fav_name = name.trim();
                        currentFavBtn.name = "🏷️ 词条: " + name.trim();

                        console.log('[TextFavorites] 已收藏:', name.trim());
                        try { openTextFavsModal(node); } catch (err) { }

                    } catch (e) {
                        console.error('[TextFavorites] 收藏失败:', e);
                    }
                });

                // 调整收藏按钮位置 (放在 edit_text 后)
                const editTextIndex = node.widgets.findIndex(w => w.name === "edit_text");
                if (editTextIndex !== -1) {
                    const widgets = node.widgets;
                    const saveBtnIndex = widgets.indexOf(saveBtn);
                    const currentFavBtnIndex = widgets.indexOf(currentFavBtn);
                    if (saveBtnIndex !== -1 && currentFavBtnIndex !== -1) {
                        widgets.splice(saveBtnIndex, 1);
                        widgets.splice(currentFavBtnIndex, 1);
                        widgets.splice(editTextIndex + 1, 0, currentFavBtn, saveBtn);
                    }
                }

                // 4. 清空按钮
                node.addWidget("button", "清空", null, () => {
                    const editWidget = node.widgets.find(w => w.name === "edit_text");
                    if (editWidget) {
                        editWidget.value = "";
                        if (editWidget.callback) editWidget.callback("");
                        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
                        
                        node.properties = node.properties || {};
                        node.properties.current_fav_name = "";
                        const labelBtn = node.widgets.find(w => w.name && w.name.startsWith("🏷️ 词条:"));
                        if (labelBtn) labelBtn.name = "🏷️ 词条: (未选择)";
                    }
                });

                // 5. 将 random_sfw 开关移到 清空按钮上方
                const randomSfwWidget = node.widgets.find(w => w.name === "random_sfw");
                const clearWidget = node.widgets.find(w => w.name === "清空");
                if (randomSfwWidget && clearWidget) {
                    const widgets = node.widgets;
                    const rIdx = widgets.indexOf(randomSfwWidget);
                    if (rIdx !== -1) widgets.splice(rIdx, 1);
                    const cIdx = widgets.indexOf(clearWidget);
                    if (cIdx !== -1) {
                        widgets.splice(cIdx, 0, randomSfwWidget);
                    } else {
                        widgets.push(randomSfwWidget);
                    }
                }
            }
        });
    }

    registerExtension();
})();
