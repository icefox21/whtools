// ==============================================================================
// 文本收藏扩展 - 为 WuhuoTextGate 节点添加文本收藏功能
// 独立扩展文件,不修改原有 jdsc.js,避免触发版本检测和数据丢失问题
// ==============================================================================

(() => {
    const KEY_TEXT_FAVS = "jdsc:text_favs";
    const KEY_MODAL_POS = "jdsc:textFavsModalPos";
    let TEXT_FAVS_CACHE = null;

    // 从服务器同步文本收藏数据
    async function syncTextFavsFromServer() {
        try {
            const res = await fetch('/jdsc/text_favorites');
            if (res && res.ok) {
                const data = await res.json();
                TEXT_FAVS_CACHE = (data && typeof data === 'object') ? data : {};
            }
        } catch (e) {
            console.warn('[TextFavorites] 从服务器同步失败:', e);
        }
    }

    // 获取文本收藏
    function getTextFavs() {
        if (TEXT_FAVS_CACHE) return TEXT_FAVS_CACHE;

        try {
            const s = localStorage.getItem(KEY_TEXT_FAVS);
            TEXT_FAVS_CACHE = s ? JSON.parse(s) : {};
        } catch {
            TEXT_FAVS_CACHE = {};
        }
        return TEXT_FAVS_CACHE;
    }

    // 保存文本收藏(同时保存到本地和服务器)
    function saveTextFavs(val) {
        try {
            TEXT_FAVS_CACHE = (val && typeof val === 'object') ? val : {};

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

    function loadModalPos() {
        try {
            const s = localStorage.getItem(KEY_MODAL_POS);
            return s ? JSON.parse(s) : null;
        } catch {
            return null;
        }
    }

    // 创建可拖动函数(参考 jdsc.js 的 makeDraggable)
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

        // 抑制拖动后的误触发点击
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
        const names = Object.keys(favs);

        if (names.length === 0) {
            alert("暂无收藏记录\n\n请先使用\"收藏当前\"按钮保存一些文本");
            return;
        }


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
      min-width: 400px;
      min-height: 300px;
      z-index: 1000;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      resize: both;
      overflow: hidden;
    `;

        // 计算浮窗位置：在节点左边或右边打开
        const modalWidth = 400;
        const modalHeight = 300;
        let posX = 100, posY = 100;

        // 尝试获取节点在屏幕上的位置
        try {
            const canvas = window.app?.canvas;
            if (canvas && node.pos) {
                // 获取画布的变换矩阵信息
                const scale = canvas.ds?.scale || 1;
                const offset = canvas.ds?.offset || [0, 0];

                // 获取画布DOM元素的位置
                const canvasEl = canvas.canvas;
                const canvasRect = canvasEl ? canvasEl.getBoundingClientRect() : { left: 0, top: 0 };

                // 计算节点在屏幕上的位置
                const nodeScreenX = canvasRect.left + (node.pos[0] + offset[0]) * scale;
                const nodeScreenY = canvasRect.top + (node.pos[1] + offset[1]) * scale;
                const nodeScreenW = (node.size?.[0] || 200) * scale;
                const nodeScreenH = (node.size?.[1] || 100) * scale;

                // 获取屏幕尺寸
                const screenW = window.innerWidth;
                const screenH = window.innerHeight;

                // 决定浮窗放在节点左边还是右边
                const nodeRightEdge = nodeScreenX + nodeScreenW;
                const nodeCenterX = nodeScreenX + nodeScreenW / 2;

                if (nodeCenterX > screenW / 2) {
                    // 节点偏右，浮窗放在节点左边
                    posX = Math.max(10, nodeScreenX - modalWidth - 20);
                } else {
                    // 节点偏左，浮窗放在节点右边
                    posX = Math.min(screenW - modalWidth - 10, nodeRightEdge + 20);
                }

                // 垂直方向：与节点顶部对齐，但确保不超出屏幕
                posY = Math.max(10, Math.min(screenH - modalHeight - 10, nodeScreenY));
            }
        } catch (e) {
            console.warn('[TextFavorites] 计算节点位置失败:', e);
        }

        // 直接使用基于节点计算的位置（不再使用保存的位置）
        modal.style.left = posX + 'px';
        modal.style.top = posY + 'px';

        // 标题栏(带拖动手柄)
        const header = document.createElement('div');
        header.style.cssText = `
      display: flex;
      align-items: center;
      padding: 10px 15px;
      background: #2a2a2a;
      border-bottom: 1px solid #444;
      cursor: move;
      user-select: none;
    `;

        // 拖动手柄图标
        const handle = document.createElement('div');
        handle.textContent = '⋮⋮';
        handle.style.cssText = `
      color: #888;
      font-size: 16px;
      margin-right: 10px;
      cursor: move;
    `;
        header.appendChild(handle);

        // 标题
        const title = document.createElement('div');
        title.textContent = '文本收藏';
        title.style.cssText = `
      color: #fff;
      font-size: 16px;
      font-weight: bold;
      flex: 1;
    `;
        header.appendChild(title);

        // 关闭按钮
        const closeBtn = document.createElement('div');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = `
      color: #fff;
      font-size: 24px;
      cursor: pointer;
      padding: 0 5px;
    `;
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        header.appendChild(closeBtn);

        modal.appendChild(header);

        // 网格容器
        const grid = document.createElement('div');
        grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
      gap: 8px;
      flex: 1;
      overflow: auto;
      padding: 15px;
    `;

        // 为每个收藏创建一个卡片
        names.forEach(name => {
            const card = document.createElement('div');
            card.textContent = name;
            card.style.cssText = `
        background: #2d2d2d;
        color: #ddd;
        padding: 4px 10px;
        border-radius: 4px;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s;
        border: 1px solid #444;
        word-wrap: break-word;
        user-select: none;
        font-size: 13px;
        aspect-ratio: 2/1;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
      `;

            card.addEventListener('mouseenter', () => {
                card.style.background = '#3a3a3a';
                card.style.borderColor = '#666';
            });

            card.addEventListener('mouseleave', () => {
                card.style.background = '#2d2d2d';
                card.style.borderColor = '#444';
            });

            card.addEventListener('click', () => {
                const content = favs[name];
                const editWidget = node.widgets.find(w => w.name === "edit_text");

                if (!editWidget) {
                    alert("❌ 无法找到文本输入框");
                    return;
                }

                // 先清空输入框，再填入收藏内容
                editWidget.value = content;

                if (editWidget.callback) {
                    editWidget.callback(editWidget.value);
                }

                if (node.setDirtyCanvas) {
                    node.setDirtyCanvas(true, true);
                }

                console.log('[TextFavorites] 已应用收藏:', name);
            });

            // 右键菜单: 编辑/删除
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();

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
                `;

                const editBtn = document.createElement('div');
                editBtn.textContent = '✏️ 编辑';
                editBtn.style.cssText = `
                    padding: 6px 15px;
                    color: #fff;
                    cursor: pointer;
                    font-size: 13px;
                `;
                editBtn.addEventListener('mouseenter', () => editBtn.style.background = '#3a3a3a');
                editBtn.addEventListener('mouseleave', () => editBtn.style.background = 'transparent');
                editBtn.addEventListener('click', () => {
                    const newName = prompt('修改收藏名称:', name);
                    const newContent = prompt('修改收藏内容:', favs[name]);

                    if (newName && newContent) {
                        const updatedFavs = getTextFavs();
                        if (newName !== name) {
                            delete updatedFavs[name];
                        }
                        updatedFavs[newName.trim()] = newContent;
                        saveTextFavs(updatedFavs);
                        document.body.removeChild(menu);
                        document.body.removeChild(modal);
                        openTextFavsModal(node);
                    } else {
                        document.body.removeChild(menu);
                    }
                });

                const deleteBtn = document.createElement('div');
                deleteBtn.textContent = '🗑️ 删除';
                deleteBtn.style.cssText = `
                    padding: 6px 15px;
                    color: #ff6b6b;
                    cursor: pointer;
                    font-size: 13px;
                `;
                deleteBtn.addEventListener('mouseenter', () => deleteBtn.style.background = '#3a3a3a');
                deleteBtn.addEventListener('mouseleave', () => deleteBtn.style.background = 'transparent');
                deleteBtn.addEventListener('click', () => {
                    if (confirm(`确定要删除收藏 "${name}" 吗?`)) {
                        const updatedFavs = getTextFavs();
                        delete updatedFavs[name];
                        saveTextFavs(updatedFavs);
                        document.body.removeChild(menu);
                        document.body.removeChild(modal);
                        if (Object.keys(updatedFavs).length > 0) {
                            openTextFavsModal(node);
                        }
                    } else {
                        document.body.removeChild(menu);
                    }
                });

                menu.appendChild(editBtn);
                menu.appendChild(deleteBtn);
                document.body.appendChild(menu);

                // 点击其他地方关闭菜单
                const closeMenu = (ev) => {
                    if (!menu.contains(ev.target)) {
                        try { document.body.removeChild(menu); } catch { }
                        document.removeEventListener('click', closeMenu);
                    }
                };
                setTimeout(() => document.addEventListener('click', closeMenu), 0);
            });

            grid.appendChild(card);
        });

        modal.appendChild(grid);
        document.body.appendChild(modal);

        // 使标题栏可拖动
        makeDraggable(modal, header);

        // 标题栏右键关闭对话框
        header.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                document.body.removeChild(modal);
            } catch { }
        });
    }

    // 初始化:从服务器同步数据
    syncTextFavsFromServer();

    // 注册函数
    function registerExtension() {
        if (!window.app || !window.app.registerExtension) {
            setTimeout(registerExtension, 500);
            return;
        }

        window.app.registerExtension({
            name: "jdsc.TextFavorites",
            async nodeCreated(node) {
                const nodeType = node.comfyClass || node.type;

                // 只处理 WuhuoTextGate 节点
                if (nodeType !== "WuhuoTextGate") return;

                // 添加"提示词收藏夹"按钮
                const favsBtn = node.addWidget("button", "提示词收藏夹", null, () => {
                    try {
                        openTextFavsModal(node);
                    } catch (e) {
                        console.error('[TextFavorites] 打开收藏列表失败:', e);
                        alert("❌ 打开收藏列表失败，请查看控制台");
                    }
                });

                // 添加"清空并粘贴"按钮
                const pasteBtn = node.addWidget("button", "清空并粘贴", null, async () => {
                    try {
                        const editWidget = node.widgets.find(w => w.name === "edit_text");
                        if (editWidget) {
                            // 从剪切板读取文本
                            const clipboardText = await navigator.clipboard.readText();

                            // 清空并粘贴
                            editWidget.value = clipboardText || "";

                            if (editWidget.callback) {
                                editWidget.callback(editWidget.value);
                            }
                            if (node.setDirtyCanvas) {
                                node.setDirtyCanvas(true, true);
                            }
                            console.log('[TextFavorites] 已粘贴剪切板内容');
                        }
                    } catch (e) {
                        console.error('[TextFavorites] 粘贴失败:', e);
                        alert("❌ 粘贴失败，请确保已授予剪切板权限");
                    }
                });

                // 将这两个按钮移动到 free_pass 下方、edit_text 上方
                // 找到 free_pass 的位置
                const freePassIndex = node.widgets.findIndex(w => w.name === "free_pass");
                if (freePassIndex !== -1) {
                    // 从末尾移除这两个按钮
                    const widgets = node.widgets;
                    const favsBtnIndex = widgets.indexOf(favsBtn);
                    const pasteBtnIndex = widgets.indexOf(pasteBtn);

                    // 先移除（从后往前移除，避免索引变化问题）
                    if (pasteBtnIndex > favsBtnIndex) {
                        widgets.splice(pasteBtnIndex, 1);
                        widgets.splice(favsBtnIndex, 1);
                    } else {
                        widgets.splice(favsBtnIndex, 1);
                        widgets.splice(pasteBtnIndex, 1);
                    }

                    // 插入到 free_pass 之后
                    widgets.splice(freePassIndex + 1, 0, favsBtn, pasteBtn);
                }

                // 添加"收藏当前"按钮
                const saveBtn = node.addWidget("button", "收藏当前", null, () => {
                    try {
                        const editWidget = node.widgets.find(w => w.name === "edit_text");
                        const currentText = editWidget ? editWidget.value : "";

                        if (!currentText || currentText.trim() === "") {
                            alert("当前输入框为空，无法收藏");
                            return;
                        }

                        const name = prompt("请输入收藏名称:", "");
                        if (!name || name.trim() === "") {
                            return;
                        }

                        const favs = getTextFavs();
                        favs[name.trim()] = currentText;
                        saveTextFavs(favs);

                        console.log('[TextFavorites] 已收藏:', name.trim());

                        // 刷新悬浮窗
                        try { openTextFavsModal(node); } catch (err) { }

                    } catch (e) {
                        console.error('[TextFavorites] 收藏失败:', e);
                        alert("❌ 收藏失败，请查看控制台");
                    }
                });

                // 将"收藏当前"移动到 edit_text 下方、key_word 上方
                const editTextIndex = node.widgets.findIndex(w => w.name === "edit_text");
                if (editTextIndex !== -1) {
                    const widgets = node.widgets;
                    const saveBtnIndex = widgets.indexOf(saveBtn);
                    if (saveBtnIndex !== -1) {
                        widgets.splice(saveBtnIndex, 1);
                        widgets.splice(editTextIndex + 1, 0, saveBtn);
                    }
                }

                // 添加"清空"按钮
                node.addWidget("button", "清空", null, () => {
                    try {
                        const editWidget = node.widgets.find(w => w.name === "edit_text");
                        if (editWidget) {
                            editWidget.value = "";
                            if (editWidget.callback) {
                                editWidget.callback("");
                            }
                            if (node.setDirtyCanvas) {
                                node.setDirtyCanvas(true, true);
                            }
                            console.log('[TextFavorites] 已清空输入框');
                        }
                    } catch (e) {
                        console.error('[TextFavorites] 清空失败:', e);
                    }
                });
            }
        });

        console.log('[TextFavorites] ✅ 扩展已成功注册');
    }

    // 开始注册
    registerExtension();
})();
