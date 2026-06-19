// Copyright (c) 2024-2026 icefox21
// This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
// Project Link: https://github.com/icefox21/whtools

import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

function removeLegacyVersionBanner() {
    try {
        document.querySelectorAll(".jdsc-version-banner").forEach(el => el.remove());
    } catch { }
}

// ==========================================================================
// 注册 WuhuoTextGate（文本传递）到 slot search 弹窗（拉线时的搜索菜单）
// ==========================================================================

function registerTextGateToSlotDefaults() {
    if (!window.LiteGraph) return;

    // 内部辅助：幂等地将节点类型插到数组最前面
    function ensureFirst(arr, nt) {
        const idx = arr.indexOf(nt);
        if (idx !== -1) arr.splice(idx, 1);
        arr.unshift(nt);
    }

    // slot_types_default_out: 当从 INPUT 拉线时显示的 OUTPUT 节点
    if (!LiteGraph.slot_types_default_out) {
        LiteGraph.slot_types_default_out = {};
    }
    if (!LiteGraph.slot_types_default_out["STRING"]) {
        LiteGraph.slot_types_default_out["STRING"] = [];
    }
    const arrOut = LiteGraph.slot_types_default_out["STRING"];
    ensureFirst(arrOut, "WuhuoTextGate");
    ensureFirst(arrOut, "WuhuoTextGatePro"); // 文本++排在最前

    // 同时注册到 slot_types_default_in（当从 OUTPUT 拉线时）
    if (!LiteGraph.slot_types_default_in) {
        LiteGraph.slot_types_default_in = {};
    }
    if (!LiteGraph.slot_types_default_in["STRING"]) {
        LiteGraph.slot_types_default_in["STRING"] = [];
    }
    const arrIn = LiteGraph.slot_types_default_in["STRING"];
    ensureFirst(arrIn, "WuhuoTextGate");
    ensureFirst(arrIn, "WuhuoTextGatePro"); // 文本++排在最前
}

// 在多个时机尝试注册，确保覆盖所有情况
registerTextGateToSlotDefaults();
setTimeout(registerTextGateToSlotDefaults, 100);
setTimeout(registerTextGateToSlotDefaults, 500);
setTimeout(registerTextGateToSlotDefaults, 1000);

// ==========================================================================
// Queue Selected Output Nodes 功能支持（与 multi_preview.js 相同逻辑）
// 使用 whtools 内置实现，避免依赖 rgthree 的 queueOutputNodes。
// ==========================================================================

let _textGateQueueNodeIds = null;
let _textGateQueueHooked = false;

// 递归收集节点依赖
function _textGateRecursiveAddNodes(nodeId, oldOutput, newOutput) {
    let currentId = String(nodeId);
    let currentNode = oldOutput[currentId];

    if (currentNode && newOutput[currentId] == null) {
        newOutput[currentId] = currentNode;
        for (const inputValue of Object.values(currentNode.inputs || [])) {
            if (Array.isArray(inputValue)) {
                _textGateRecursiveAddNodes(inputValue[0], oldOutput, newOutput);
            }
        }
    }
    return newOutput;
}

// 初始化 Queue Hook
function _textGateInitQueueHook() {
    if (_textGateQueueHooked) return;

    _textGateQueueHooked = true;

    const originalApiQueuePrompt = api.queuePrompt.bind(api);
    api.queuePrompt = async function (index, prompt) {
        if (_textGateQueueNodeIds?.length && prompt?.output) {
            const oldOutput = prompt.output;
            let newOutput = {};
            for (const nodeId of _textGateQueueNodeIds) {
                _textGateRecursiveAddNodes(nodeId, oldOutput, newOutput);
            }
            if (Object.keys(newOutput).length > 0) {
                prompt.output = newOutput;
            } else {
                throw new Error("[whtools] 未能收集到指定节点依赖，已取消快捷执行。");
            }
        }
        return originalApiQueuePrompt(index, prompt);
    };
}

// 执行 Queue 指定节点
async function _textGateQueueOutputNodes(nodeIds) {
    try {
        _textGateQueueNodeIds = nodeIds;
        await app.queuePrompt(0);
        return true;
    } catch (e) {
        console.error("[whtools] Queue 失败:", e);
        return false;
    } finally {
        _textGateQueueNodeIds = null;
    }
}

// ==========================================================================

app.registerExtension({
    name: "wuhuo.TextGate",

    // 在 ComfyUI 初始化完成后注册节点到 slot search 弹窗 + Z键快捷键
    async setup() {
        removeLegacyVersionBanner();
        setTimeout(removeLegacyVersionBanner, 1000);
        registerTextGateToSlotDefaults();
        _textGateInitQueueHook();

        // 添加快捷键监听：Z 键执行文本+节点
        window.addEventListener("keydown", (e) => {
            // 1. 如果当前有任何输入框处于激活/焦点状态，按Z就是打字（字母z），绝不执行节点。
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) {
                return;
            }

            const key = e.key.toLowerCase();
            if (key !== "z") return;

            // 获取鼠标位置
            const canvas = app.canvas;
            const mouse = canvas.graph_mouse;
            if (!mouse) return;

            // 查找鼠标下的文本+节点
            const graph = app.graph;
            if (!graph || !graph._nodes) return;

            for (const node of graph._nodes) {
                if (node.type !== "WuhuoTextGate" && node.type !== "WuhuoTextGatePro") continue;

                // 计算文本+/文本++节点的真实高度（多行文本框可能把节点撑得比原始 size 高得多）
                let h = node.size[1];
                if (node.computeSize) {
                    const cSize = node.computeSize([node.size[0], node.size[1]]);
                    if (cSize && cSize[1] > h) h = cSize[1];
                }

                // 加入容差边界，因为 DOM 元素边缘可能有一定的不可见边距
                const pad = 20;

                // 检查鼠标是否在包含容差的节点包围盒内
                const isMouseOver = mouse[0] >= node.pos[0] - pad &&
                    mouse[0] <= node.pos[0] + node.size[0] + pad &&
                    mouse[1] >= node.pos[1] - pad &&
                    mouse[1] <= node.pos[1] + h + pad;

                if (isMouseOver) {
                    // Z 键：执行此节点
                    console.log("[whtools] Z键触发执行节点，节点类型:", node.type, "节点ID:", node.id);
                    _textGateQueueOutputNodes([node.id]).then(success => {
                        if (success) {
                            node.setDirtyCanvas?.(true, true);
                        }
                    });
                    e.preventDefault();
                    e.stopPropagation();
                    break; // 只处理第一个匹配的节点
                }
            }
        });
    },
});
