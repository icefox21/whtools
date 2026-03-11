// Copyright (c) 2024-2026 icefox21
// This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
// Project Link: https://github.com/icefox21/whtools

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
// 注册节点到 slot search 弹窗（拉线时的搜索菜单）
// ==========================================================================
function registerToSlotDefaults() {
    if (!window.LiteGraph) return;

    // 使用节点的内部名称（NODE_CLASS_MAPPINGS 的 key），而不是显示名称
    const nodeType = "WuhuoMultiPreview";

    // slot_types_default_in: 当从 OUTPUT 拉线时显示的 INPUT 节点
    if (!LiteGraph.slot_types_default_in) {
        LiteGraph.slot_types_default_in = {};
    }
    if (!LiteGraph.slot_types_default_in["IMAGE"]) {
        LiteGraph.slot_types_default_in["IMAGE"] = [];
    }
    // 将节点添加到列表开头，确保显示优先级
    const arr = LiteGraph.slot_types_default_in["IMAGE"];
    const idx = arr.indexOf(nodeType);
    if (idx !== -1) {
        arr.splice(idx, 1);
    }
    arr.unshift(nodeType);

    // 同时注册到 slot_types_default_out（当拉线到 INPUT 时）
    if (!LiteGraph.slot_types_default_out) {
        LiteGraph.slot_types_default_out = {};
    }
    if (!LiteGraph.slot_types_default_out["IMAGE"]) {
        LiteGraph.slot_types_default_out["IMAGE"] = [];
    }
    const arrOut = LiteGraph.slot_types_default_out["IMAGE"];
    const idxOut = arrOut.indexOf(nodeType);
    if (idxOut !== -1) {
        arrOut.splice(idxOut, 1);
    }
    arrOut.unshift(nodeType);
}

// 在多个时机尝试注册，确保覆盖所有情况
registerToSlotDefaults();
setTimeout(registerToSlotDefaults, 100);
setTimeout(registerToSlotDefaults, 500);
setTimeout(registerToSlotDefaults, 1000);

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

    // 初始化 Queue Hook 和全局快捷键
    async setup() {
        _jdscInitQueueHook();
        registerToSlotDefaults(); // 注册到拉线弹窗

        // 添加快捷键监听：X 加载历史图片/放大图片，Z 执行节点
        window.addEventListener("keydown", (e) => {
            // 忽略输入框中的按键
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
                return;
            }

            const key = e.key.toLowerCase();
            if (key !== "x" && key !== "z" && key !== "c") return;

            // 获取鼠标位置
            const canvas = app.canvas;
            const mouse = canvas.graph_mouse;
            if (!mouse) return;

            // 查找鼠标下的多图预览节点
            const graph = app.graph;
            if (!graph || !graph._nodes) return;

            for (const node of graph._nodes) {
                if (node.type !== "WuhuoMultiPreview") continue;

                // 检查鼠标是否在节点上
                const isMouseOver = mouse[0] >= node.pos[0] &&
                    mouse[0] <= node.pos[0] + node.size[0] &&
                    mouse[1] >= node.pos[1] &&
                    mouse[1] <= node.pos[1] + node.size[1];

                if (isMouseOver) {
                    if (key === "x") {
                        // X 键：无图时加载历史，多图模式时放大鼠标悬停的图片
                        const hasNoImages = !node._loadedImages || node._loadedImages.length === 0;
                        const isInPreview = node._previewIndex >= 0;  // -1 表示网格模式，>=0 表示预览模式

                        if (hasNoImages) {
                            // 没有图片时：加载历史图片
                            console.log("[whtools] X键触发加载历史图片，节点ID:", node.id);
                            node.refreshHistory();
                        } else if (!isInPreview) {
                            // 有图片且在多图模式：计算鼠标悬停的图片并放大
                            const localX = mouse[0] - node.pos[0];
                            const localY = mouse[1] - node.pos[1];
                            console.log("[whtools] X键触发放大图片，节点ID:", node.id);
                            node.handleSingleClick(localX, localY, null);
                        }
                        e.preventDefault();
                        e.stopPropagation();
                    } else if (key === "z") {
                        // Z 键：执行此节点
                        console.log("[whtools] Z键触发执行节点，节点ID:", node.id);
                        node.triggerQueueThisNode();
                        e.preventDefault();
                        e.stopPropagation();
                    } else if (key === "c") {
                        // C 键：切换对比模式
                        if (node._loadedImages && node._loadedImages.length >= 2) {
                            if (node._compareMode) {
                                // 已在对比模式，退出
                                console.log("[whtools] C键退出对比模式，节点ID:", node.id);
                                node.exitCompareMode();
                            } else {
                                // 进入对比模式
                                if (node._previewIndex < 0) {
                                    // 处于网格模式，尝试获取鼠标点中的图片
                                    const localX = mouse[0] - node.pos[0];
                                    const localY = mouse[1] - node.pos[1];
                                    node.handleSingleClick(localX, localY, null);

                                    // 如果通过悬停没选中图片（如在空隙中），默认选中最新图
                                    if (node._previewIndex < 0) {
                                        node._previewIndex = 0;
                                        node.setDirtyCanvas(true, true);
                                    }
                                }

                                console.log("[whtools] C键触发对比模式，节点ID:", node.id);
                                if (node._previewIndex === 0) {
                                    node.enterCompareMode(1); // 和第二张对比
                                } else {
                                    node.enterCompareMode(node._previewIndex - 1); // 和上一张对比
                                }
                            }
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    }
                    break; // 只处理第一个匹配的节点
                }
            }
        });
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

            // 对比模式相关
            this._compareMode = false;       // 是否在对比模式
            this._compareIndex = -1;         // 对比的另一张图片索引（通常是上一张）
            this._pointerX = 0;              // 鼠标X坐标（分割线位置）
            this._longPressTimeout = null;   // 长按定时器

            // 按钮区域定义 (x, y, w, h, name) - 动态计算
            this._buttons = [];

            // 隐藏 enable_images / enable_images_opt 默认 widget
            const _hideToggleWidgets = () => {
                if (!this.widgets) return;
                for (let i = 0; i < this.widgets.length; i++) {
                    const w = this.widgets[i];
                    if (w.name === "enable_images" || w.name === "enable_images_opt") {
                        w.type = "hidden";
                        w.computeSize = () => [0, -4];
                        // 完全覆盖其绘图函数
                        w.draw = () => { };
                        if (w.element) w.element.style.display = "none";
                    }
                }
                // 保留当前尺寸，不用 computeSize 覆盖
                const cur = this.size;
                if (cur) {
                    this.setSize([Math.max(cur[0], 250), Math.max(cur[1], 200)]);
                }
                this.setDirtyCanvas(true, true);
            };

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

            // 初次隐藏 (延迟以防其他扩展覆盖)
            requestAnimationFrame(_hideToggleWidgets);
            setTimeout(_hideToggleWidgets, 100);
        };

        // 拦截配置加载，再次隐藏 widget（防止加载已有工作流时被重置）
        const origOnConfigure = nodeType.prototype.onConfigure;
        nodeType.prototype.onConfigure = function (info) {
            if (origOnConfigure) origOnConfigure.apply(this, arguments);
            const _hideWidgets = () => {
                if (!this.widgets) return;
                let needResize = false;
                for (let i = 0; i < this.widgets.length; i++) {
                    const w = this.widgets[i];
                    if (w.name === "enable_images" || w.name === "enable_images_opt") {
                        w.type = "hidden";
                        w.computeSize = () => [0, -4];
                        w.draw = () => { };
                        needResize = true;
                    }
                }
                if (needResize) {
                    // 保留工作流中保存的尺寸，仅做最小约束
                    const saved = info && info.size;
                    if (saved) {
                        this.setSize([Math.max(saved[0], 250), Math.max(saved[1], 200)]);
                    }
                }
                this.setDirtyCanvas(true, true);
            };
            requestAnimationFrame(_hideWidgets);
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
                    // 图片加载失败（可能已被删除），从列表中移除
                    console.warn(`[多图预览] 图片加载失败: ${file}`);
                    const idx = this._history.indexOf(file);
                    if (idx > -1) {
                        this._history.splice(idx, 1);
                    }
                    // 从当前加载列表中也移除
                    const loadedIdx = this._loadedImages.findIndex(item => item.file === file);
                    if (loadedIdx > -1) {
                        this._loadedImages.splice(loadedIdx, 1);
                    }
                    this.setDirtyCanvas(true, true);
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

        // 获取 widget 值的辅助函数
        function getWidgetValue(node, name) {
            if (!node.widgets) return true;
            const w = node.widgets.find(w => w.name === name);
            return w ? w.value : true;
        }

        // 开关点击区域常量
        const TOGGLE_RADIUS = 5;
        const TOGGLE_RIGHT_MARGIN = 15; // 距节点右边缘的距离

        nodeType.prototype.onDrawForeground = function (ctx) {
            if (this.flags.collapsed) return;

            const W = this.size[0];
            const H = this.size[1];
            const layout = calculateLayout(W, H);

            ctx.save();

            // --- 0. 绘制输入 slot 旁的开关小圆点 ---
            if (this.inputs) {
                const slotMap = { "images": "enable_images", "images_opt": "enable_images_opt" };
                for (let i = 0; i < this.inputs.length; i++) {
                    const slot = this.inputs[i];
                    const widgetName = slotMap[slot.name];
                    if (!widgetName) continue;

                    const enabled = getWidgetValue(this, widgetName);
                    const slotY = this.getConnectionPos(true, i)[1] - this.pos[1];
                    const cx = W - TOGGLE_RIGHT_MARGIN;
                    const cy = slotY;

                    ctx.beginPath();
                    ctx.arc(cx, cy, TOGGLE_RADIUS, 0, Math.PI * 2);
                    ctx.fillStyle = enabled ? "#4CAF50" : "#F44336";
                    ctx.fill();
                }
            }

            // --- 1. 绘制图片（网格模式或预览模式） ---
            ctx.beginPath();
            ctx.rect(0, layout.headerH, W, layout.gridH);
            ctx.clip();

            // 预览模式：显示单张图片
            if (this._previewIndex >= 0 && this._previewIndex < this._loadedImages.length) {
                const item = this._loadedImages[this._previewIndex];
                // 检查图片是否成功加载（complete=true 且 naturalWidth>0 表示成功）
                if (item.img.complete && item.img.naturalWidth > 0) {
                    // 1. 绘制提示文字（无背景，极小字体）
                    const tipHeight = 12; // 预留空间

                    ctx.fillStyle = "#888"; // 灰色文字
                    ctx.font = "8px Arial"; // 字体缩小
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    // 根据模式显示不同提示
                    const tipText = this._compareMode
                        ? "对比模式 | 按 ESC 退出"
                        : "按 ESC 返回 | 按 C 对比";
                    ctx.fillText(tipText, W / 2, layout.headerH + tipHeight / 2);

                    // 2. 在横条下方绘制图片（减去横条高度）
                    const imgY = layout.headerH + tipHeight;
                    const imgH = layout.gridH - tipHeight;

                    // 对比模式：新图（索引小）在左，旧图（索引大）在右
                    if (this._compareMode && this._compareIndex >= 0 && this._compareIndex < this._loadedImages.length) {
                        const compareItem = this._loadedImages[this._compareIndex];
                        if (compareItem.img.complete && compareItem.img.naturalWidth > 0) {
                            // 计算分割线位置（限制在图片区域内）
                            const splitX = Math.max(0, Math.min(W, this._pointerX));

                            // 确定谁是新图（索引小 = 更新）
                            // _previewIndex 是当前预览的图，_compareIndex 是对比的图
                            const currentIsNewer = this._previewIndex < this._compareIndex;
                            const leftImg = currentIsNewer ? item.img : compareItem.img;
                            const rightImg = currentIsNewer ? compareItem.img : item.img;

                            // 先绘制右边（旧图，完整显示）
                            drawImageContain(ctx, rightImg, 0, imgY, W, imgH);

                            // 再用 clip 绘制左边（新图，只显示分割线左侧）
                            ctx.save();
                            ctx.beginPath();
                            ctx.rect(0, imgY, splitX, imgH);
                            ctx.clip();
                            drawImageContain(ctx, leftImg, 0, imgY, W, imgH);
                            ctx.restore();

                            // 绘制分割线
                            if (splitX > 0 && splitX < W) {
                                ctx.beginPath();
                                ctx.moveTo(splitX, imgY);
                                ctx.lineTo(splitX, imgY + imgH);
                                ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
                                ctx.lineWidth = 0.1;
                                ctx.stroke();
                            }
                        }
                    } else {
                        // 普通预览模式：全屏显示图片（contain模式）
                        drawImageContain(ctx, item.img, 0, imgY, W, imgH);
                    }
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
                    // 检查图片是否成功加载（complete=true 且 naturalWidth>0 表示成功）
                    if (!item.img.complete || item.img.naturalWidth === 0) return;
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

            // 0. 检测开关小圆点点击
            if (this.inputs) {
                const slotMap = { "images": "enable_images", "images_opt": "enable_images_opt" };
                for (let i = 0; i < this.inputs.length; i++) {
                    const slot = this.inputs[i];
                    const widgetName = slotMap[slot.name];
                    if (!widgetName) continue;

                    const slotY = this.getConnectionPos(true, i)[1] - this.pos[1];
                    const cx = W - TOGGLE_RIGHT_MARGIN;
                    const cy = slotY;
                    const dx = x - cx;
                    const dy = y - cy;
                    if (dx * dx + dy * dy <= (TOGGLE_RADIUS + 4) * (TOGGLE_RADIUS + 4)) {
                        // 点击了开关，切换 widget 值
                        const w = this.widgets && this.widgets.find(w => w.name === widgetName);
                        if (w) {
                            w.value = !w.value;
                            this.setDirtyCanvas(true, true);
                        }
                        return true;
                    }
                }
            }

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

            // 2.6 对比模式下禁止点击（不切换图片）
            if (this._compareMode) {
                return true; // 阻止事件
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

                    // 注册键盘监听器（仅 ESC，C 键已移至全局）
                    const node = this;
                    if (this._escListener) {
                        window.removeEventListener("keydown", this._escListener);
                    }
                    this._escListener = function (e) {
                        // 检查鼠标是否在当前节点上
                        const canvas = app.canvas;
                        const mouse = canvas.graph_mouse;
                        let isMouseOver = true;
                        if (mouse) {
                            isMouseOver = mouse[0] >= node.pos[0] &&
                                mouse[0] <= node.pos[0] + node.size[0] &&
                                mouse[1] >= node.pos[1] &&
                                mouse[1] <= node.pos[1] + node.size[1];
                        }

                        if (e.key === "Escape" && isMouseOver) {
                            if (node._compareMode) {
                                // 先退出对比模式
                                node.exitCompareMode();
                            } else {
                                // 再退出预览模式
                                node.exitPreview();
                            }
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
            // 如果在对比模式，先退出
            if (this._compareMode) {
                this.exitCompareMode();
            }
            this._previewIndex = -1;
            if (this._escListener) {
                window.removeEventListener("keydown", this._escListener);
                this._escListener = null;
            }
            // 清除长按定时器（已废弃，保留防止错误）
            this.setDirtyCanvas(true, true);
        };

        // 进入对比模式
        nodeType.prototype.enterCompareMode = function (compareIndex) {
            if (compareIndex < 0 || compareIndex >= this._loadedImages.length) return;
            if (compareIndex === this._previewIndex) return; // 不和自己对比

            this._compareMode = true;
            this._compareIndex = compareIndex;
            this._pointerX = this.size[0] / 2; // 初始分割线在中间
            this.setDirtyCanvas(true, true);
        };

        // 退出对比模式
        nodeType.prototype.exitCompareMode = function () {
            this._compareMode = false;
            this._compareIndex = -1;
            this.setDirtyCanvas(true, true);
        };

        // 鼠标移动处理（用于对比模式的分割线）
        nodeType.prototype.onMouseMove = function (e, localPos) {
            if (this._compareMode) {
                this._pointerX = localPos[0];
                this.setDirtyCanvas(true, false);
            }
        };

        // 鼠标释放处理（取消长按定时器）
        nodeType.prototype.onMouseUp = function (e, localPos) {
            if (this._longPressTimeout) {
                clearTimeout(this._longPressTimeout);
                this._longPressTimeout = null;
            }
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
