// Copyright (c) 2024-2026 icefox21
// This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
// Project Link: https://github.com/icefox21/whtools

import { app } from "/scripts/app.js";

const TOOLTIP_TEXT = {
    lora_a: "第一个 LoRA。通常放主要脸、主要角色，或你更想保留特征的 LoRA。",
    lora_b: "第二个 LoRA。通常放补充脸、表情、身体、服装或另一个版本的角色 LoRA。",
    model_weight_a: "LoRA A 对模型/画面主体的强度。接近普通 LoRA Loader 的 model strength。",
    model_weight_b: "LoRA B 对模型/画面主体的强度。效果弱就提高，互相打架就降低。",
    clip_weight_a: "LoRA A 对提示词理解的强度。角色触发词、概念绑定通常和这里有关。",
    clip_weight_b: "LoRA B 对提示词理解的强度。两个角色词混乱时，可以先降低这个值。",
    attention_weight_a: "LoRA A 的注意力层倍率。更影响脸部结构、五官关系、身份识别。",
    attention_weight_b: "LoRA B 的注意力层倍率。合并两个脸时通常保留 0.8 到 1.0。",
    ff_weight_a: "LoRA A 的前馈层倍率。更容易带出画风、质感、服装、身体等整体变化。",
    ff_weight_b: "LoRA B 的前馈层倍率。只想合脸时建议降低到 0.2 到 0.5。",
    adaln_weight_a: "LoRA A 的调制/归一化相关倍率。会影响整体调性、光影、风格稳定性。",
    adaln_weight_b: "LoRA B 的调制/归一化相关倍率。只想保脸时不要太高，可先用 0.5。",
    block_weights_a: "LoRA A 的分层权重。可填一串数字，如 1,1,0.8,0.6；空着表示所有层都用 1。",
    block_weights_b: "LoRA B 的分层权重。用于细调某些层的影响；看不懂时留空即可。",
    merge_strategy: "合并策略。rank_concat 更接近同时加载两个 LoRA；tensor_blend 是旧式张量混合，通常不推荐。",
    overlap_mode: "两个 LoRA 命中同一层时怎么处理。add 最像同时加载；weighted_average 更柔和；keep_a/keep_b 只保留一边。",
    shape_mode: "遇到不同 rank 或形状时怎么处理。pad_to_larger 会补零对齐，兼容性最好。",
    include_unique_keys: "是否保留只存在于其中一个 LoRA 的权重。一般保持开启。",
    save_dtype: "保存精度。fp16 文件小、加载快；fp32 更精确但文件更大；keep 保持原始类型。",
    output_name: "输出 LoRA 文件名。不写后缀也可以，会自动保存为 .safetensors。",
    output_subfolder: "输出到 LoRA 目录下的子文件夹。默认 whtools_merged，方便和原始 LoRA 分开。",
    overwrite: "如果输出文件已存在，是否覆盖。关闭时可防止误覆盖旧结果。",
};

function ensureStyle() {
    if (document.getElementById("whtools-lora-tooltip-style")) return;
    const style = document.createElement("style");
    style.id = "whtools-lora-tooltip-style";
    style.textContent = `
        .whtools-lora-tooltip {
            position: fixed;
            max-width: 360px;
            z-index: 100000;
            pointer-events: none;
            padding: 9px 11px;
            border: 1px solid rgba(255,255,255,0.16);
            border-radius: 8px;
            background: rgba(20, 22, 26, 0.96);
            color: #f2f5f7;
            box-shadow: 0 10px 30px rgba(0,0,0,0.38);
            font: 13px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif;
            white-space: normal;
            transform: translate(14px, 14px);
        }
        .whtools-lora-tooltip strong {
            display: block;
            margin-bottom: 4px;
            color: #9fd0ff;
            font-weight: 650;
        }
    `;
    document.head.appendChild(style);
}

function tooltipEl() {
    ensureStyle();
    let el = document.getElementById("whtools-lora-tooltip");
    if (!el) {
        el = document.createElement("div");
        el.id = "whtools-lora-tooltip";
        el.className = "whtools-lora-tooltip";
        el.style.display = "none";
        document.body.appendChild(el);
    }
    return el;
}

function showTooltip(name, text, event) {
    const el = tooltipEl();
    el.innerHTML = `<strong>${name}</strong>${text}`;
    const x = Math.min((event?.clientX ?? 0) + 14, window.innerWidth - 380);
    const y = Math.min((event?.clientY ?? 0) + 14, window.innerHeight - 120);
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, y)}px`;
    el.style.display = "block";
}

function hideTooltip() {
    const el = document.getElementById("whtools-lora-tooltip");
    if (el) el.style.display = "none";
}

function widgetAt(node, localPos) {
    const widgets = node.widgets || [];
    const widgetHeight = (window.LiteGraph && window.LiteGraph.NODE_WIDGET_HEIGHT) || 20;
    const y = localPos?.[1];
    if (typeof y !== "number") return null;

    for (let i = 0; i < widgets.length; i++) {
        const widget = widgets[i];
        const name = String(widget?.name || "");
        if (!TOOLTIP_TEXT[name]) continue;

        const top = typeof widget.last_y === "number"
            ? widget.last_y
            : (typeof widget.y === "number" ? widget.y : 32 + i * (widgetHeight + 4));
        const height = Math.max(widgetHeight, widget.computeSize?.(node.size?.[0] || 260)?.[1] || widgetHeight);
        if (y >= top - 2 && y <= top + height + 2) {
            return widget;
        }
    }
    return null;
}

function applyWidgetTooltips(node) {
    for (const widget of node.widgets || []) {
        const text = TOOLTIP_TEXT[widget.name];
        if (text) {
            widget.tooltip = text;
            widget.options = widget.options || {};
            widget.options.tooltip = text;
        }
    }
}

app.registerExtension({
    name: "whtools.lora_merge_tooltips",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData?.name !== "WuhuoLoraMerge") return;

        const originalCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = originalCreated?.apply(this, arguments);
            applyWidgetTooltips(this);
            return result;
        };

        const originalMove = nodeType.prototype.onMouseMove;
        nodeType.prototype.onMouseMove = function (event, localPos) {
            const result = originalMove?.apply(this, arguments);
            applyWidgetTooltips(this);
            const widget = widgetAt(this, localPos);
            const text = widget ? TOOLTIP_TEXT[widget.name] : null;
            if (text) {
                showTooltip(widget.name, text, event);
            } else {
                hideTooltip();
            }
            return result;
        };

        const originalLeave = nodeType.prototype.onMouseLeave;
        nodeType.prototype.onMouseLeave = function () {
            hideTooltip();
            return originalLeave?.apply(this, arguments);
        };
    },
});
