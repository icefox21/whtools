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

    // 创建可拖动函数
    function makeDraggable(el, handle) {
        let sx = 0, sy = 0, ex = 0, ey = 0, drag = false, moved = false;

        const onDown = e => {
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
        modal.style.cssText = `
            position: absolute;
            background: #1e1e1e;
            border: 2px solid #444;
            border-radius: 8px;
            width: 600px;
            height: 400px;
            z-index: 1000;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            display: flex;
            flex-direction: column;
            resize: both;
            overflow: hidden;
            font-family: sans-serif;
            width: 800px;
            height: 550px;
        `;

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
        header.style.cssText = `
            display: flex;
            align-items: center;
            padding: 10px 15px;
            background: #2a2a2a;
            border-bottom: 1px solid #444;
            cursor: move;
            user-select: none;
            flex-shrink: 0;
        `;

        const handle = document.createElement('div');
        handle.textContent = '⋮⋮';
        handle.style.cssText = 'color: #888; font-size: 16px; margin-right: 10px; cursor: move;';
        header.appendChild(handle);

        const title = document.createElement('div');
        title.textContent = '文本收藏';
        title.style.cssText = 'color: #fff; font-size: 16px; font-weight: bold; flex: 1;';
        header.appendChild(title);

        const closeBtn = document.createElement('div');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'color: #fff; font-size: 24px; cursor: pointer; padding: 0 5px;';
        closeBtn.addEventListener('click', () => document.body.removeChild(modal));
        header.appendChild(closeBtn);

        modal.appendChild(header);

        // ---------------- 主体内容区 (侧边栏 + 网格) ----------------
        const bodyContainer = document.createElement('div');
        bodyContainer.style.cssText = `
            display: flex;
            flex: 1;
            overflow: hidden;
        `;

        // --- 左侧边栏 (分类) ---
        const sidebar = document.createElement('div');
        sidebar.style.cssText = `
            width: 120px;
            background: #252525;
            border-right: 1px solid #444;
            display: flex;
            flex-direction: column;
            padding: 10px 0;
            overflow-y: auto;
            flex-shrink: 0;
        `;

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

                catItem.style.cssText = `
                    padding: 8px 15px;
                    cursor: pointer;
                    color: ${isActive ? '#fff' : '#aaa'};
                    background: ${isActive ? '#3a3a3a' : 'transparent'};
                    border-left: 3px solid ${isActive ? '#2196F3' : 'transparent'};
                    font-size: 13px;
                    transition: all 0.2s;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                `;

                catItem.addEventListener('mouseenter', () => {
                    if (cat !== currentCategory) catItem.style.background = '#2d2d2d';
                });
                catItem.addEventListener('mouseleave', () => {
                    if (cat !== currentCategory) catItem.style.background = 'transparent';
                });

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
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
            grid-auto-rows: min-content;
            gap: 8px;
            flex: 1;
            overflow-y: auto;
            padding: 15px;
            align-content: start;
        `;

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
                card.style.cssText = `
                    background: #2d2d2d;
                    color: #ddd;
                    padding: 8px;
                    border-radius: 4px;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s;
                    border: 1px solid #444;
                    word-wrap: break-word;
                    user-select: none;
                    font-size: 13px;
                    min-height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                `;

                // 分类样式提示
                if (itemCat === "NSFW") {
                    card.style.borderLeft = "3px solid #ff4444"; // 红色
                } else if (itemCat === "SFW") {
                    card.style.borderLeft = "3px solid #4488ff"; // 蓝色
                }

                card.addEventListener('mouseenter', () => {
                    card.style.background = '#3a3a3a';
                    card.style.borderColor = '#666';
                });

                card.addEventListener('mouseleave', () => {
                    card.style.background = '#2d2d2d';
                    card.style.borderColor = '#444';
                });

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

                    // 闪烁效果反馈
                    card.style.background = '#4CAF50';
                    setTimeout(() => card.style.background = '#2d2d2d', 200);
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
                emptyTip.textContent = '此分类下暂无收藏';
                emptyTip.style.cssText = 'color: #666; text-align: center; width: 100%; padding-top: 50px; grid-column: 1 / -1;';
                grid.appendChild(emptyTip);
            }
        }

        // 显示右键菜单
        function showContextMenu(e, name, item) {
            const menu = document.createElement('div');
            menu.style.cssText = `
                position: fixed;
                left: ${e.clientX}px;
                top: ${e.clientY}px;
                background: #2b2b2b;
                border: 1px solid #555;
                border-radius: 4px;
                padding: 4px 0;
                z-index: 10001;
                box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                min-width: 120px;
            `;

            const createMenuItem = (text, onClick, hasSubmenu = false) => {
                const div = document.createElement('div');
                div.textContent = text;
                div.style.cssText = `
                    padding: 6px 15px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 13px;
                    display: flex;
                    justify-content: space-between;
                `;
                div.addEventListener('mouseenter', () => div.style.background = '#3a3a3a');
                div.addEventListener('mouseleave', () => div.style.background = 'transparent');
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
            moveItem.innerHTML = '📂 移动到... <span style="fontSize: 10px; color: #888; marginLeft: 10px;">▶</span>';
            moveItem.style.cssText = `
                padding: 6px 15px;
                color: #fff;
                cursor: pointer;
                font-size: 13px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                position: relative;
            `;

            let submenu = null;
            let submenuTimeout = null;

            moveItem.addEventListener('mouseenter', () => {
                moveItem.style.background = '#3a3a3a';

                // 清除可能的延迟关闭
                if (submenuTimeout) {
                    clearTimeout(submenuTimeout);
                    submenuTimeout = null;
                }

                // 如果子菜单已存在，不重复创建
                if (submenu && submenu.parentNode) return;

                // 创建子菜单
                submenu = document.createElement('div');
                submenu.style.cssText = `
                    position: absolute;
                    left: 100%;
                    top: 0;
                    background: #2b2b2b;
                    border: 1px solid #555;
                    border-radius: 4px;
                    padding: 4px 0;
                    z-index: 10002;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.5);
                    min-width: 140px;
                    max-height: 300px;
                    overflow-y: auto;
                `;

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
                    const isCurrent = cat === (item.category || "SFW");
                    catDiv.textContent = isCurrent ? '✓ ' + cat : cat;
                    catDiv.style.cssText = `
                        padding: 6px 15px;
                        cursor: pointer;
                        font-size: 13px;
                        color: ${isCurrent ? '#4CAF50' : '#ddd'};
                        white-space: nowrap;
                    `;

                    catDiv.addEventListener('mouseenter', () => catDiv.style.background = '#3a3a3a');
                    catDiv.addEventListener('mouseleave', () => catDiv.style.background = 'transparent');

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
                divider.style.cssText = 'height: 1px; background: #444; margin: 4px 0;';
                submenu.appendChild(divider);

                // 新建分类
                const newCatDiv = document.createElement('div');
                newCatDiv.textContent = '+ 新建分类...';
                newCatDiv.style.cssText = `
                    padding: 6px 15px;
                    color: #81D4FA;
                    cursor: pointer;
                    font-size: 13px;
                `;
                newCatDiv.addEventListener('mouseenter', () => newCatDiv.style.background = '#3a3a3a');
                newCatDiv.addEventListener('mouseleave', () => newCatDiv.style.background = 'transparent');
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
                moveItem.style.background = 'transparent';
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
            });
            deleteItem.style.color = '#ff6b6b';
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

                // 3. 收藏当前按钮
                const saveBtn = node.addWidget("button", "收藏当前", null, () => {
                    try {
                        const editWidget = node.widgets.find(w => w.name === "edit_text");
                        const currentText = editWidget ? editWidget.value : "";

                        if (!currentText || !currentText.trim()) {
                            alert("当前输入框为空，无法收藏");
                            return;
                        }

                        const name = prompt("请输入收藏名称:", "");
                        if (!name || !name.trim()) return;

                        // 默认分类：优先使用当前选中的分类（如果不是全部），否则用SFW
                        let defaultCat = getLastCategory();
                        if (defaultCat === "全部") defaultCat = "SFW";

                        // 简单的分类输入
                        let cat = prompt("请输入分类 (例如: NSFW, 人物, SFW):", defaultCat);
                        if (cat === null) cat = defaultCat;

                        const favs = getTextFavs();
                        favs[name.trim()] = {
                            content: currentText,
                            category: cat.trim() || "SFW",
                            tags: []
                        };
                        saveTextFavs(favs);

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
                    if (saveBtnIndex !== -1) {
                        widgets.splice(saveBtnIndex, 1);
                        widgets.splice(editTextIndex + 1, 0, saveBtn);
                    }
                }

                // 4. 清空按钮
                node.addWidget("button", "清空", null, () => {
                    const editWidget = node.widgets.find(w => w.name === "edit_text");
                    if (editWidget) {
                        editWidget.value = "";
                        if (editWidget.callback) editWidget.callback("");
                        if (node.setDirtyCanvas) node.setDirtyCanvas(true, true);
                    }
                });
            }
        });
    }

    registerExtension();
})();
