// ==========================================================================
// 多图预览节点 - 原生 Canvas 渲染版
// ==========================================================================
// 说明：
// - 使用 LiteGraph 原生 Canvas API 绘制，不使用 DOM
// - 解决缩放、拖动、黑边等问题
// - 模仿原生 Preview Image 节点的行为
// ==========================================================================

import { app } from "/scripts/app.js";
import { api } from "/scripts/api.js";

// ==========================================================================
// Queue Selected Output Nodes 功能支持
// 优先使用 rgthree 插件，如果没有则使用自己的实现
// ==========================================================================

let _jdscQueueNodeIds = null;
let _jdscQueueHooked = false;

// 递归收集节点依赖
function _jdscRecursiveAddNodes(nodeId, oldOutput, newOutput) {
    let currentId = String(nodeId);
    let currentNode = oldOutput[currentId];

    if (currentNode && newOutput[currentId] == null) {
        newOutput[currentId] = currentNode;
        // 遍历所有输入，递归添加上游节点
        for (const inputValue of Object.values(currentNode.inputs || [])) {
            if (Array.isArray(inputValue)) {
                _jdscRecursiveAddNodes(inputValue[0], oldOutput, newOutput);
            }
        }
    }
    return newOutput;
}

// 初始化 Queue Hook（只在没有 rgthree 时使用）
function _jdscInitQueueHook() {
    if (_jdscQueueHooked) return;
    if (window.rgthree) {
        console.log("[whtools] 检测到 rgthree，使用其 queueOutputNodes");
        _jdscQueueHooked = true;
        return;
    }

    _jdscQueueHooked = true;
    console.log("[whtools] 初始化自定义 Queue Hook");

    const originalApiQueuePrompt = api.queuePrompt.bind(api);
    api.queuePrompt = async function (index, prompt) {
        if (_jdscQueueNodeIds?.length && prompt?.output) {
            const oldOutput = prompt.output;
            let newOutput = {};
            for (const nodeId of _jdscQueueNodeIds) {
                _jdscRecursiveAddNodes(nodeId, oldOutput, newOutput);
            }
            prompt.output = newOutput;
        }
        return originalApiQueuePrompt(index, prompt);
    };
}

// 执行 Queue 指定节点
async function _jdscQueueOutputNodes(nodeIds) {
    // 优先使用 rgthree
    if (window.rgthree && window.rgthree.queueOutputNodes) {
        try {
            await window.rgthree.queueOutputNodes(nodeIds);
            return true;
        } catch (e) {
            console.error("[whtools] rgthree.queueOutputNodes 失败:", e);
        }
    }

    // Fallback: 自己实现
    try {
        _jdscQueueNodeIds = nodeIds;
        await app.queuePrompt(0);
        return true;
    } catch (e) {
        console.error("[whtools] Queue 失败:", e);
        return false;
    } finally {
        _jdscQueueNodeIds = null;
    }
}

// ==========================================================================

app.registerExtension({
    name: "jdsc.multi_preview",

    // 初始化 Queue Hook
    async setup() {
        _jdscInitQueueHook();
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name !== "WuhuoMultiPreview") return;

        // ============================================================
        // 1. 初始化与生命周期
        // ============================================================

        const origOnNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            if (origOnNodeCreated) origOnNodeCreated.apply(this, arguments);

            // 默认尺寸
            this.size = [320, 240];

            // 内部状态
            this._history = [];       // 历史记录文件名列表
            this._page = 0;           // 当前页码
            this._imagesPerPage = 6;  // 每页显示数量
            this._loadedImages = [];  // 当前页已加载的 Image 对象
            this._lastClickTime = 0;       // 双击检测：上次点击时间
            this._singleClickTimeout = null; // 双击检测：延迟处理单击的 timeout
            this._lastClickPos = null;       // 双击检测：上次点击位置
            this._previewIndex = -1;         // 当前预览的图片索引（-1表示网格模式）
            this._escListener = null;        // ESC键监听器引用

            // 按钮区域定义 (x, y, w, h, name) - 动态计算
            this._buttons = [];

            // 初始刷新 - 移除，不再自动加载历史记录
            // setTimeout(() => this.refreshHistory(), 500);

            // 监听后端 WebSocket 通知（关键：确保在文件保存完成后触发）
            const nodeRef = this;
            try {
                const apiObj = window.api || (window.app && window.app.api);
                if (apiObj && apiObj.addEventListener) {
                    apiObj.addEventListener("jdsc.multipreview.update", (evt) => {
                        try {
                            const detail = evt && evt.detail || {};
                            // 只刷新匹配的节点
                            if (String(detail.node_id) === String(nodeRef.id)) {
                                nodeRef.refreshHistory();
                            }
                        } catch (e) {
                            console.error("[多图预览] WebSocket事件处理失败:", e);
                        }
                    });
                }
            } catch (e) {
                console.error("[多图预览] 注册WebSocket监听失败:", e);
            }
        };

        // onExecuted 作为备用刷新机制
        const origOnExecuted = nodeType.prototype.onExecuted;
        nodeType.prototype.onExecuted = function (message) {
            if (origOnExecuted) origOnExecuted.apply(this, arguments);
            // 延迟刷新作为备用（WebSocket通知可能失败时）
            const node = this;
            setTimeout(() => node.refreshHistory(), 500);
        };

        // ============================================================
        // 2. 数据获取与图片加载
        // ============================================================

        nodeType.prototype.refreshHistory = async function () {
            try {
                const response = await fetch("/jdsc/history/get?t=" + Date.now(), {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ node_id: String(this.id) })
                });

                if (response.ok) {
                    const data = await response.json();
                    const history = data.history || [];

                    // 提取所有文件名
                    const newHistory = [];
                    for (const batch of history) {
                        for (const file of (batch.files || [])) {
                            newHistory.push(file);
                        }
                    }

                    // 检测是否有新图片
                    const hasNew = newHistory.length !== this._history.length ||
                        (newHistory.length > 0 && newHistory[0] !== this._history[0]);

                    this._history = newHistory;

                    if (hasNew) {
                        this._page = 0; // 回到第一页
                    }

                    this.loadCurrentPageImages();
                }
            } catch (e) {
                console.error("[多图预览] 刷新失败:", e);
            }
        };

        nodeType.prototype.loadCurrentPageImages = function () {
            const wasInPreview = this._previewIndex >= 0;

            // 预先计算每页图片数量（基于节点尺寸，而非已加载图片数量）
            const W = this.size[0];
            const H = this.size[1];
            const layout = calculateLayout(W, H);

            const gap = 3;
            const maxCellW = 600;
            const maxCellH = 600;
            const padding = 6;
            const availableW = W - padding;
            const availableH = layout.gridH;

            // 计算列数：默认2列，超过宽度上限才增加
            let cols = 2;
            const cellW2 = (availableW - gap) / 2;
            if (cellW2 > maxCellW) {
                cols = Math.floor((availableW + gap) / (maxCellW + gap));
                cols = Math.max(2, cols);
            }

            // 计算行数：默认2行，超过高度上限才增加
            let rows = 2;
            const cellH2 = (availableH - gap) / 2;
            if (cellH2 > maxCellH) {
                rows = Math.floor((availableH + gap) / (maxCellH + gap));
                rows = Math.max(2, rows);
            }

            // 更新每页显示数量（基于节点尺寸的理论最大值）
            this._imagesPerPage = cols * rows;

            this._loadedImages = [];
            const start = this._page * this._imagesPerPage;
            const end = start + this._imagesPerPage;
            const files = this._history.slice(start, end);

            for (const file of files) {
                const img = new Image();
                img.src = `/jdsc/history/image?filename=${encodeURIComponent(file)}&t=${Date.now()}`;
                img.onload = () => {
                    this.setDirtyCanvas(true, true); // 重绘
                };
                img.onerror = () => {
                    // 图片加载失败（可能已被删除），从列表中移除并重试
                    console.warn(`[多图预览] 图片加载失败: ${file}`);
                    const idx = this._history.indexOf(file);
                    if (idx > -1) {
                        this._history.splice(idx, 1);
                        // 重新加载当前页
                        this.loadCurrentPageImages();
                    }
                };
                this._loadedImages.push({ file, img });
            }

            // 如果之前在预览模式，且当前页是第一页（最新图片所在页）
            // 自动切换到最新图片（索引0）
            if (wasInPreview && this._page === 0 && files.length > 0) {
                this._previewIndex = 0;
            } else if (wasInPreview) {
                // 如果不在第一页，退出预览模式
                this.exitPreview();
            }

            this.setDirtyCanvas(true, true);
        };

        nodeType.prototype.clearHistory = async function () {
            try {
                await fetch("/jdsc/history/clear", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ node_id: String(this.id) })
                });
                this._history = [];
                this._page = 0;
                this._loadedImages = [];
                this.setDirtyCanvas(true, true);
            } catch (e) { }
        };

        // ============================================================
        // 3. 尺寸调整限制
        // ============================================================
        nodeType.prototype.onResize = function (size) {
            // 限制最小尺寸，防止内容无法显示
            const minW = 250;
            const minH = 200;

            if (size[0] < minW) size[0] = minW;
            if (size[1] < minH) size[1] = minH;
        };

        // ============================================================
        // 4. Canvas 绘制 (核心逻辑)
        // ============================================================

        // 共享的布局计算函数
        function calculateLayout(W, H) {
            const headerH = 60; // 预留顶部空间给输入输出接口（两个接口需要更多空间）

            // 动态计算底部控制栏高度和按钮大小
            // 当节点变小时，缩小控制栏
            const scale = Math.min(1, W / 320);
            const controlH = Math.max(24, 30 * scale);
            const gridH = H - controlH - headerH;

            const btnH = Math.max(16, 18 * scale); // 按钮高度（正方形边长，紧凑尺寸）
            const btnW = btnH; // 方向键按钮为正方形
            const fontSize = Math.max(10, 12 * scale);
            const yBar = H - controlH;
            const btnY = yBar + (controlH - btnH) / 2;
            const gap = 10 * scale;
            const infoW = 60 * scale;

            // 底部只放方向键和页码，居中布局
            const bottomContentW = btnW * 2 + infoW + gap * 2;
            const bottomStartX = (W - bottomContentW) / 2;

            // 清空按钮放在右上角，和序号数字对齐
            const numFontSize = Math.max(8, fontSize - 2); // 和序号使用相同字体大小
            const numHeight = numFontSize + 4; // 数字区域高度
            const clearBtnW = 16; // 小按钮
            const clearBtnH = numFontSize; // 和序号字体高度一致
            const clearBtnX = W - clearBtnW - 6; // 右上角
            const clearBtnY = headerH + (numHeight - clearBtnH) / 2; // 和序号垂直居中对齐

            return {
                headerH, controlH, gridH,
                btnW, btnH, fontSize, yBar, btnY, gap, infoW,
                bottomStartX, // 用于底部居中
                clearBtnX, clearBtnY, clearBtnW, clearBtnH // 清空按钮位置
            };
        }

        nodeType.prototype.onDrawForeground = function (ctx) {
            if (this.flags.collapsed) return;

            const W = this.size[0];
            const H = this.size[1];
            const layout = calculateLayout(W, H);

            ctx.save();

            // --- 1. 绘制图片（网格模式或预览模式） ---
            ctx.beginPath();
            ctx.rect(0, layout.headerH, W, layout.gridH);
            ctx.clip();

            // 预览模式：显示单张图片
            if (this._previewIndex >= 0 && this._previewIndex < this._loadedImages.length) {
                const item = this._loadedImages[this._previewIndex];
                if (item.img.complete) {
                    // 1. 绘制提示文字（无背景，极小字体）
                    const tipHeight = 12; // 预留空间

                    ctx.fillStyle = "#888"; // 灰色文字
                    ctx.font = "8px Arial"; // 字体缩小
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText("按 ESC 返回列表", W / 2, layout.headerH + tipHeight / 2);

                    // 2. 在横条下方绘制图片（减去横条高度）
                    const imgY = layout.headerH + tipHeight;
                    const imgH = layout.gridH - tipHeight;

                    // 全屏显示图片（contain模式）
                    drawImageContain(ctx, item.img, 0, imgY, W, imgH);
                }
                ctx.restore();
                return; // 预览模式下不绘制其他内容
            }

            // 网格模式：显示多张图片

            if (this._loadedImages.length === 0) {
                ctx.fillStyle = "#666";
                ctx.font = "12px Arial";
                ctx.textAlign = "center";
                ctx.fillText(this._history.length > 0 ? "加载中..." : "暂无历史图片", W / 2, layout.headerH + layout.gridH / 2);
            } else {
                // ========================================
                // 新布局逻辑：尽可能大显示图片
                // - 横向默认2列，单图宽度超过600px时增加列数
                // - 纵向默认1行，单图高度超过600px时增加行数
                // ========================================
                const imageCount = this._loadedImages.length;
                const gap = 3; // 图片间距
                const maxCellW = 600; // 单图宽度上限
                const maxCellH = 600; // 单图高度上限
                const padding = 6; // 边缘空隙（左右各3px）

                // 计算可用宽度和高度
                const availableW = W - padding;
                const availableH = layout.gridH;

                // 计算列数：默认2列，超过宽度上限才增加
                let cols = 2;
                if (imageCount === 1) {
                    cols = 1;
                } else {
                    // 计算当前单图宽度（2列时）
                    const cellW2 = (availableW - gap) / 2;
                    if (cellW2 > maxCellW) {
                        // 宽度超过上限，计算需要多少列
                        cols = Math.floor((availableW + gap) / (maxCellW + gap));
                        cols = Math.max(2, Math.min(cols, imageCount));
                    }
                }

                // 计算行数：默认2行，超过高度上限才增加
                let rows = 2;
                const cellH2 = (availableH - gap) / 2; // 2行时的高度
                if (cellH2 > maxCellH && imageCount > cols * 2) {
                    // 高度超过上限，计算需要多少行
                    rows = Math.floor((availableH + gap) / (maxCellH + gap));
                    rows = Math.max(2, rows);
                }

                // 确保行数足够显示当前页的图片
                const neededRows = Math.ceil(imageCount / cols);
                rows = Math.min(neededRows, rows);

                // 计算实际单元格尺寸
                const cellW = (availableW - gap * (cols - 1)) / cols;
                const cellH = (availableH - gap * (rows - 1)) / rows;

                // 更新每页显示数量
                const newImagesPerPage = cols * rows;
                if (this._imagesPerPage !== newImagesPerPage) {
                    this._imagesPerPage = newImagesPerPage;
                }

                const numFontSize = Math.max(8, layout.fontSize - 2);
                const startX = padding / 2; // 居中对齐

                this._loadedImages.forEach((item, index) => {
                    if (!item.img.complete) return;
                    if (index >= cols * rows) return; // 超出当前页不绘制

                    const col = index % cols;
                    const row = Math.floor(index / cols);
                    const x = startX + col * (cellW + gap);
                    const y = layout.headerH + row * (cellH + gap);

                    // 绘制图片
                    drawImageContain(ctx, item.img, x, y, cellW, cellH);

                    // 在图片左上角显示序号
                    const totalImages = this._history.length;
                    const globalIndex = totalImages - (this._page * this._imagesPerPage + index);
                    ctx.font = `${numFontSize}px Arial`;
                    ctx.fillStyle = "rgba(136, 136, 136, 0.8)";
                    ctx.textAlign = "left";
                    ctx.textBaseline = "top";
                    ctx.fillText(String(globalIndex), x + 5, y + 5);
                });
            }

            ctx.restore();

            // --- 2. 绘制控制按钮 ---
            // 清空按钮在右上角，方向键和页码在底部居中

            this._buttons = [
                // 底部居中的方向键
                { name: "prev", text: "◀", x: layout.bottomStartX, y: layout.btnY, w: layout.btnW, h: layout.btnH },
                { name: "next", text: "▶", x: layout.bottomStartX + layout.btnW + layout.gap + layout.infoW + layout.gap, y: layout.btnY, w: layout.btnW, h: layout.btnH },
                // 右上角的清空按钮（灰色不显眼）
                { name: "clear", text: "✕", x: layout.clearBtnX, y: layout.clearBtnY, w: layout.clearBtnW, h: layout.clearBtnH, color: "#555" }
            ];

            ctx.font = `${layout.fontSize}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            // 绘制页码信息（居中）
            const totalPages = Math.max(1, Math.ceil(this._history.length / this._imagesPerPage));
            ctx.fillStyle = "#ccc";
            const infoX = layout.bottomStartX + layout.btnW + layout.gap + layout.infoW / 2;
            ctx.fillText(`${this._page + 1} / ${totalPages}`, infoX, layout.yBar + layout.controlH / 2);

            // 圆角矩形辅助函数
            const drawRoundRect = (x, y, w, h, radius) => {
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.lineTo(x + w - radius, y);
                ctx.arcTo(x + w, y, x + w, y + radius, radius);
                ctx.lineTo(x + w, y + h - radius);
                ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
                ctx.lineTo(x + radius, y + h);
                ctx.arcTo(x, y + h, x, y + h - radius, radius);
                ctx.lineTo(x, y + radius);
                ctx.arcTo(x, y, x + radius, y, radius);
                ctx.closePath();
            };

            // 绘制所有按钮
            for (const btn of this._buttons) {
                const radius = 4; // 圆角半径

                // 清空按钮只显示X，和序号使用相同样式
                if (btn.name === "clear") {
                    const numFontSize = Math.max(8, layout.fontSize - 2);
                    ctx.font = `${numFontSize}px Arial`;
                    ctx.fillStyle = "#888"; // 和序号相同的灰色
                    ctx.textBaseline = "middle";
                    ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2);
                } else {
                    // 其他按钮：透明背景 + 边框
                    ctx.strokeStyle = "#666";
                    ctx.lineWidth = 1;
                    drawRoundRect(btn.x, btn.y, btn.w, btn.h, radius);
                    ctx.stroke();

                    // 绘制文字（三角形符号需要微调Y位置使其视觉居中）
                    ctx.fillStyle = "#aaa";
                    ctx.fillText(btn.text, btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
                }
            }
        };

        // 辅助函数：模拟 object-fit: contain (完整显示)
        function drawImageContain(ctx, img, x, y, w, h) {
            const imgRatio = img.width / img.height;
            const areaRatio = w / h;

            let dw, dh, dx, dy;

            if (imgRatio > areaRatio) {
                // 图片更宽，以宽为准
                dw = w;
                dh = w / imgRatio;
                dx = x;
                dy = y + (h - dh) / 2;
            } else {
                // 图片更高，以高为准
                dh = h;
                dw = h * imgRatio;
                dy = y;
                dx = x + (w - dw) / 2;
            }

            // 稍微留一点内边距 (padding)
            const padding = 2;
            if (dw > padding * 2 && dh > padding * 2) {
                ctx.drawImage(img, dx + padding, dy + padding, dw - padding * 2, dh - padding * 2);
            } else {
                ctx.drawImage(img, dx, dy, dw, dh);
            }
        }

        // ============================================================
        // 5. 交互处理 (点击事件)
        // ============================================================

        nodeType.prototype.onMouseDown = function (e, localPos) {
            const x = localPos[0];
            const y = localPos[1];
            const W = this.size[0];
            const H = this.size[1];

            // 使用相同的布局计算，确保点击区域准确
            const layout = calculateLayout(W, H);

            // 1. 先检查所有按钮（包括右上角的清空按钮）- 按钮不参与双击检测
            for (const btn of this._buttons) {
                if (x >= btn.x && x <= btn.x + btn.w && y >= btn.y && y <= btn.y + btn.h) {
                    this.handleButtonClick(btn.name);
                    return true; // 阻止事件冒泡（不拖动节点）
                }
            }

            // 2. 如果点击了底部区域但没点中按钮，允许事件穿透
            if (y > H - layout.controlH) {
                return false;
            }

            // 2.5 如果点击了标题栏区域（y <= 0），允许拖动节点
            if (y <= 0) {
                return false;
            }

            // 3. 双击检测逻辑
            const now = Date.now();
            const timeSinceLastClick = now - this._lastClickTime;
            const DOUBLE_CLICK_THRESHOLD = 250; // 双击间隔阈值 (毫秒)

            this._lastClickTime = now;

            // 检测是否为双击
            if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && this._lastClickPos) {
                // 检查两次点击位置是否接近（防止跨区域双击误触发）
                const dx = Math.abs(x - this._lastClickPos[0]);
                const dy = Math.abs(y - this._lastClickPos[1]);
                if (dx < 50 && dy < 50) {
                    // 双击确认！取消之前的单击延迟处理
                    if (this._singleClickTimeout) {
                        clearTimeout(this._singleClickTimeout);
                        this._singleClickTimeout = null;
                    }

                    // 触发 Queue Selected Output Nodes
                    this.triggerQueueThisNode();
                    return true;
                }
            }

            // 记录这次点击位置
            this._lastClickPos = [x, y];

            // 4. 延迟处理单击（给双击检测留时间）
            const node = this;
            const clickX = x;
            const clickY = y;

            // 清除之前可能存在的延迟
            if (this._singleClickTimeout) {
                clearTimeout(this._singleClickTimeout);
            }

            this._singleClickTimeout = setTimeout(() => {
                node._singleClickTimeout = null;
                node.handleSingleClick(clickX, clickY, layout);
            }, DOUBLE_CLICK_THRESHOLD);

            return true; // 阻止拖动，等待双击检测完成
        };

        // 处理单击事件（延迟调用）
        nodeType.prototype.handleSingleClick = function (x, y, layout) {
            const W = this.size[0];
            const H = this.size[1];

            // 重新计算 layout（如果没传入）
            if (!layout) {
                layout = calculateLayout(W, H);
            }

            // 检查是否点击了图片区域
            if (this._loadedImages.length > 0 && y > layout.headerH && y < H - layout.controlH) {
                // 使用与绘制代码相同的布局计算逻辑
                const imageCount = this._loadedImages.length;
                const gap = 3;
                const maxCellW = 600;
                const maxCellH = 600;
                const padding = 6;

                const availableW = W - padding;
                const availableH = layout.gridH;

                let cols = 2;
                if (imageCount === 1) {
                    cols = 1;
                } else {
                    const cellW2 = (availableW - gap) / 2;
                    if (cellW2 > maxCellW) {
                        cols = Math.floor((availableW + gap) / (maxCellW + gap));
                        cols = Math.max(2, Math.min(cols, imageCount));
                    }
                }

                let rows = 2;
                const cellH2 = (availableH - gap) / 2;
                if (cellH2 > maxCellH && imageCount > cols * 2) {
                    rows = Math.floor((availableH + gap) / (maxCellH + gap));
                    rows = Math.max(2, rows);
                }
                const neededRows = Math.ceil(imageCount / cols);
                rows = Math.min(neededRows, rows);

                const cellW = (availableW - gap * (cols - 1)) / cols;
                const cellH = (availableH - gap * (rows - 1)) / rows;
                const startX = padding / 2;

                // 计算点击的是哪张图片
                const col = Math.floor((x - startX) / (cellW + gap));
                const row = Math.floor((y - layout.headerH) / (cellH + gap));
                const index = row * cols + col;

                if (index >= 0 && index < Math.min(this._loadedImages.length, cols * rows) && col >= 0 && col < cols) {
                    // 进入预览模式
                    this._previewIndex = index;
                    this.setDirtyCanvas(true, true);

                    // 注册ESC键监听器
                    const node = this;
                    this._escListener = function (e) {
                        if (e.key === "Escape") {
                            node.exitPreview();
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    };
                    window.addEventListener("keydown", this._escListener);
                }
            }
        };

        // 触发 Queue 当前节点
        nodeType.prototype.triggerQueueThisNode = async function () {
            console.log("[whtools] 双击触发 Queue，节点 ID:", this.id);
            const success = await _jdscQueueOutputNodes([this.id]);
            if (success) {
                // 可选：显示一个简短的视觉反馈
                this.setDirtyCanvas(true, true);
            }
        };

        nodeType.prototype.handleButtonClick = function (name) {
            if (name === "prev") {
                if (this._page > 0) {
                    this._page--;
                    this.loadCurrentPageImages();
                }
            } else if (name === "next") {
                const totalPages = Math.ceil(this._history.length / this._imagesPerPage);
                if (this._page < totalPages - 1) {
                    this._page++;
                    this.loadCurrentPageImages();
                }
            } else if (name === "clear") {
                if (confirm("确定要清空所有历史记录吗？")) {
                    this.clearHistory();
                }
            }
        };

        // 退出预览模式
        nodeType.prototype.exitPreview = function () {
            this._previewIndex = -1;
            if (this._escListener) {
                window.removeEventListener("keydown", this._escListener);
                this._escListener = null;
            }
            this.setDirtyCanvas(true, true);
        };

        // 右键菜单
        nodeType.prototype.getExtraMenuOptions = function (canvas, options) {
            const self = this;

            // 获取鼠标位置
            const mousePos = canvas.graph_mouse;
            if (!mousePos) return;

            const x = mousePos[0] - this.pos[0];
            const y = mousePos[1] - this.pos[1];

            // 检查是否在图片区域
            const W = this.size[0];
            const H = this.size[1];
            const layout = calculateLayout(W, H);

            const inImageArea = y >= layout.headerH && y <= layout.headerH + layout.gridH;

            // 预览模式下的右键菜单
            if (inImageArea && this._previewIndex >= 0 && this._previewIndex < this._loadedImages.length) {
                const item = this._loadedImages[this._previewIndex];
                this.addImageMenuOptions(options, item);
                return;
            }

            // 网格模式下的右键菜单（仅当点击了具体图片时）
            if (inImageArea && this._loadedImages.length > 0) {
                // 使用与绘制代码相同的布局计算逻辑
                const imageCount = this._loadedImages.length;
                const gap = 3;
                const maxCellW = 600;
                const maxCellH = 600;
                const padding = 6;

                const availableW = W - padding;
                const availableH = layout.gridH;

                let cols = 2;
                if (imageCount === 1) {
                    cols = 1;
                } else {
                    const cellW2 = (availableW - gap) / 2;
                    if (cellW2 > maxCellW) {
                        cols = Math.floor((availableW + gap) / (maxCellW + gap));
                        cols = Math.max(2, Math.min(cols, imageCount));
                    }
                }

                let rows = 2;
                const cellH2 = (availableH - gap) / 2;
                if (cellH2 > maxCellH && imageCount > cols * 2) {
                    rows = Math.floor((availableH + gap) / (maxCellH + gap));
                    rows = Math.max(2, rows);
                }
                const neededRows = Math.ceil(imageCount / cols);
                rows = Math.min(neededRows, rows);

                const cellW = (availableW - gap * (cols - 1)) / cols;
                const cellH = (availableH - gap * (rows - 1)) / rows;
                const startX = padding / 2;

                const col = Math.floor((x - startX) / (cellW + gap));
                const row = Math.floor((y - layout.headerH) / (cellH + gap));
                const index = row * cols + col;

                if (index >= 0 && index < Math.min(this._loadedImages.length, cols * rows) && col >= 0 && col < cols) {
                    const item = this._loadedImages[index];
                    this.addImageMenuOptions(options, item);
                    return;
                }
            }

            // 无论有无图片，都添加"打开保存目录"选项
            options.push({
                content: "打开保存目录",
                callback: async () => {
                    try {
                        const response = await fetch("/jdsc/history/open_folder", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({})
                        });
                        const data = await response.json();
                        if (!data.success) {
                            alert("打开目录失败: " + (data.error || "未知错误"));
                        }
                    } catch (e) {
                        console.error("打开目录失败:", e);
                        alert("打开目录失败");
                    }
                }
            });

            // 添加"加载历史图片"选项
            const nodeRef = this;
            options.push({
                content: "加载历史图片",
                callback: () => {
                    nodeRef.refreshHistory();
                }
            });
        };

        // 添加图片菜单选项
        nodeType.prototype.addImageMenuOptions = function (options, item) {
            const url = item.img.src;

            options.push({
                content: "打开图像",
                callback: () => {
                    window.open(url, "_blank");
                }
            });

            options.push({
                content: "保存图像",
                callback: async () => {
                    try {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        const link = document.createElement("a");
                        link.href = URL.createObjectURL(blob);
                        link.download = item.file || "image.png";
                        link.click();
                        URL.revokeObjectURL(link.href);
                    } catch (e) {
                        console.error("保存图像失败:", e);
                    }
                }
            });

            options.push({
                content: "复制图像",
                callback: async () => {
                    try {
                        const response = await fetch(url);
                        const blob = await response.blob();
                        await navigator.clipboard.write([
                            new ClipboardItem({ [blob.type]: blob })
                        ]);
                    } catch (e) {
                        console.error("复制图像失败:", e);
                        alert("复制失败，请使用浏览器的右键菜单复制");
                    }
                }
            });

            options.push(null); // 分隔线

            options.push({
                content: "删除图像",
                callback: async () => {
                    if (!confirm("确定要删除这张图片吗？")) return;

                    try {
                        // 从历史记录中移除该文件
                        const index = this._history.indexOf(item.file);
                        if (index > -1) {
                            this._history.splice(index, 1);
                        }

                        // 如果在预览模式，退出预览
                        if (this._previewIndex >= 0) {
                            this.exitPreview();
                        }

                        // 重新加载当前页
                        // 如果当前页已经没有图片了，回到上一页
                        const totalPages = Math.max(1, Math.ceil(this._history.length / this._imagesPerPage));
                        if (this._page >= totalPages) {
                            this._page = Math.max(0, totalPages - 1);
                        }

                        this.loadCurrentPageImages();
                    } catch (e) {
                        console.error("删除图像失败:", e);
                        alert("删除失败");
                    }
                }
            });

            options.push({
                content: "打开保存目录",
                callback: async () => {
                    try {
                        const response = await fetch("/jdsc/history/open_folder", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({})
                        });
                        const data = await response.json();
                        if (!data.success) {
                            alert("打开目录失败: " + (data.error || "未知错误"));
                        }
                    } catch (e) {
                        console.error("打开目录失败:", e);
                        alert("打开目录失败");
                    }
                }
            });
        };
    }
});
