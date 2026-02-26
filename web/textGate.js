// Copyright (c) 2024-2026 icefox21
// This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
// Project Link: https://github.com/icefox21/whtools

import { app } from "../../../scripts/app.js";

// ==========================================================================
// 注册 WuhuoTextGate（文本传递）到 slot search 弹窗（拉线时的搜索菜单）
// ==========================================================================

function registerTextGateToSlotDefaults() {
    if (!window.LiteGraph) return;

    const nodeType = "WuhuoTextGate";

    // slot_types_default_out: 当从 INPUT 拉线时显示的 OUTPUT 节点
    if (!LiteGraph.slot_types_default_out) {
        LiteGraph.slot_types_default_out = {};
    }
    if (!LiteGraph.slot_types_default_out["STRING"]) {
        LiteGraph.slot_types_default_out["STRING"] = [];
    }
    const arrOut = LiteGraph.slot_types_default_out["STRING"];
    const idxOut = arrOut.indexOf(nodeType);
    if (idxOut !== -1) {
        arrOut.splice(idxOut, 1);
    }
    arrOut.unshift(nodeType);

    // 同时注册到 slot_types_default_in（当从 OUTPUT 拉线时）
    if (!LiteGraph.slot_types_default_in) {
        LiteGraph.slot_types_default_in = {};
    }
    if (!LiteGraph.slot_types_default_in["STRING"]) {
        LiteGraph.slot_types_default_in["STRING"] = [];
    }
    const arrIn = LiteGraph.slot_types_default_in["STRING"];
    const idxIn = arrIn.indexOf(nodeType);
    if (idxIn !== -1) {
        arrIn.splice(idxIn, 1);
    }
    arrIn.unshift(nodeType);
}

// 在多个时机尝试注册，确保覆盖所有情况
registerTextGateToSlotDefaults();
setTimeout(registerTextGateToSlotDefaults, 100);
setTimeout(registerTextGateToSlotDefaults, 500);
setTimeout(registerTextGateToSlotDefaults, 1000);

app.registerExtension({
    name: "wuhuo.TextGate",

    // 在 ComfyUI 初始化完成后注册节点到 slot search 弹窗
    async setup() {
        registerTextGateToSlotDefaults();
    },
});
