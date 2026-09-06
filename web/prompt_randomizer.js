// -*- coding: utf-8 -*-
// 提示词随机生成器 - WHTools 集成版（源自 ComfyUI-PromptRandomizer，Apache-2.0）
// 实现：重新加载词库 / 试生成 / 词库编辑器（维度文件夹结构 + 自动保存 + 风格管理）
// 文件位于 web/ 根目录，由 /extensions 接口自动加载
import { app } from "../../scripts/app.js";

const NODE_NAMES = new Set(["PromptRandomizer", "WuhuoPromptRandomizer"]);

// 11 个维度（与 Python 端 DIMENSIONS 一一对应）
const DIMENSIONS = [
    { label: "拍摄角度", dir: "01_拍摄角度", code: "01" },
    { label: "光影色调", dir: "02_光影色调", code: "02" },
    { label: "人物维度", dir: "03_人物维度", code: "03" },
    { label: "发型",     dir: "04_发型",     code: "04" },
    { label: "妆容",     dir: "05_妆容",     code: "05" },
    { label: "表情",     dir: "06_表情",     code: "06" },
    { label: "服装",     dir: "07_服装",     code: "07" },
    { label: "姿态",     dir: "08_姿态",     code: "08" },
    { label: "背景",     dir: "09_背景",     code: "09" },
    { label: "构图",     dir: "10_构图",     code: "10" },
    { label: "年龄",     dir: "11_年龄",     code: "11" },
];

// ===== 苹果品牌设计令牌 =====
const C = {
    // 背景（纯黑 + 半透明灰 + 毛玻璃）
    app:       "#000000",
    window:    "rgba(28, 28, 30, 0.95)",
    sidebar:   "rgba(44, 44, 46, 0.65)",
    panel:     "rgba(0, 0, 0, 0.2)",
    panel2:    "rgba(44, 44, 46, 0.5)",
    hover:     "rgba(255, 255, 255, 0.08)",
    hover2:    "rgba(255, 255, 255, 0.15)",
    rowHover:  "rgba(255, 255, 255, 0.02)",
    inputBg:   "rgba(0, 0, 0, 0.4)",
    chipBg:    "rgba(255, 255, 255, 0.06)",
    // 边框（0.5px 细线）
    hair:      "rgba(255, 255, 255, 0.12)",
    hair2:     "rgba(255, 255, 255, 0.08)",
    hair3:     "rgba(255, 255, 255, 0.18)",
    // 文字层级
    t1:        "#ffffff",
    t2:        "#98989e",
    t3:        "#636366",
    t4:        "#48484a",
    // 强调色（苹果蓝）
    brand:     "#007aff",
    brandDk:   "#0063ce",
    brandLt:   "#5ac8fa",
    brandBg:   "rgba(0, 122, 255, 0.2)",
    brandBd:   "rgba(0, 122, 255, 0.2)",
    // 语义色
    ok:        "#30d158",
    warn:      "#ff9f0a",
    err:       "#ff453a",
    // 阴影
    shSm:      "0 1px 2px rgba(0,0,0,0.3)",
    shMd:      "0 4px 12px rgba(0,0,0,0.5)",
    shLg:      "0 30px 60px rgba(0,0,0,0.9)",
    shXl:      "0 40px 80px rgba(0,0,0,0.85), 0 0 0 0.5px rgba(255,255,255,0.15)",
    shBrand:   "0 4px 12px rgba(0,122,255,0.3)",
    // 圆角
    rPill:     "999px",
    rSm:       "6px",
    rMd:       "8px",
    rLg:       "12px",
    rXl:       "20px",
    rXxl:      "22px",
};

// ===== 字体系统 =====
const FONT = {
    sans:  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
    mono:  '"SF Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
};

// ===== 字号系统（苹果层级）=====
const FS = {
    xs:   "11px",   // 辅助标签、计数
    sm:   "12px",   // 次要正文、路径
    md:   "13px",   // 正文、按钮、标签
    lg:   "14px",   // 小标题、输入、导航
    xl:   "15px",   // 主标题
    xxl:  "17px",   // 大标题
};

// ===== 间距系统 =====
const SP = {
    xs:  "4px",
    sm:  "8px",
    md:  "12px",
    lg:  "16px",
    xl:  "20px",
    xxl: "24px",
    xxxl: "32px",
};

// ===== Toast 提示（苹果风格）=====
function showToast(message, type = "info") {
    const map = {
        info:    { c: C.brand, i: "i" },
        success: { c: C.ok,    i: "✓" },
        warn:    { c: C.warn,  i: "!" },
        error:   { c: C.err,   i: "✕" },
    };
    const m = map[type] || map.info;
    const el = document.createElement("div");
    Object.assign(el.style, {
        position: "fixed", top: "24px", left: "50%",
        transform: "translateX(-50%) translateY(-20px)",
        background: C.window, color: C.t1, fontFamily: FONT.sans,
        padding: "0", borderRadius: C.rLg, fontSize: FS.md, fontWeight: "500",
        zIndex: "200000", boxShadow: `${C.shLg}, 0 0 0 0.5px ${C.hair}`,
        opacity: "0", transition: "all 0.25s cubic-bezier(0.2,0.9,0.3,1.1)",
        pointerEvents: "none", maxWidth: "80vw", display: "flex", alignItems: "stretch",
        overflow: "hidden", backdropFilter: "blur(30px)",
    });
    const bar = document.createElement("div");
    Object.assign(bar.style, { width: "3px", background: m.c, flexShrink: "0" });
    el.appendChild(bar);
    const ico = document.createElement("div");
    ico.textContent = m.i;
    Object.assign(ico.style, {
        width: "36px", display: "flex", alignItems: "center", justifyContent: "center",
        color: m.c, fontWeight: "700", fontSize: FS.md, fontFamily: FONT.mono,
        flexShrink: "0",
    });
    el.appendChild(ico);
    const txt = document.createElement("div");
    txt.textContent = message;
    Object.assign(txt.style, { padding: "12px 20px", flex: "1", display: "flex", alignItems: "center" });
    el.appendChild(txt);
    document.body.appendChild(el);
    requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateX(-50%) translateY(0)";
    });
    setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateX(-50%) translateY(-20px)";
        setTimeout(() => el.remove(), 250);
    }, 2200);
}

// ===== 词库目录缓存 =====
let _poolDirCache = null;
async function getPoolDir() {
    if (_poolDirCache) return _poolDirCache;
    try {
        const res = await fetch("/prompt_randomizer/pool_dir");
        if (res.ok) {
            const data = await res.json();
            _poolDirCache = data.pool_dir || "";
        }
    } catch (e) {}
    return _poolDirCache || "";
}

function setModuleWidgets(node, value) {
    let touched = 0;
    for (const w of node.widgets || []) {
        // 维度开关：当前值为"开启"/"关闭"的 widget（名称带①②③前缀，不依赖精确匹配）
        if (w.value !== "开启" && w.value !== "关闭") continue;
        if (w.value !== value) {
            w.value = value;
            if (typeof w.callback === "function") { try { w.callback(value); } catch (e) {} }
            touched++;
        }
    }
    node.setDirtyCanvas?.(true);
    return touched;
}

async function attachPathTooltips(node) {
    const dir = await getPoolDir();
    for (const w of node.widgets || []) {
        if (w.value !== "开启" && w.value !== "关闭") continue;
        // widget 名形如 "① 拍摄角度"，去掉开头非中文部分后匹配 DIMENSIONS.label
        const cleanName = w.name.replace(/^[^\u4e00-\u9fa5]+/, "");
        const m = DIMENSIONS.find((mm) => mm.label === cleanName || mm.label === w.name);
        if (!m) continue;
        const folderPath = dir ? `${dir.replace(/\\/g, "/")}/${m.dir}/` : `${m.dir}/`;
        w.tooltip = `📂 ${folderPath}`;
        if (w.inputEl) w.inputEl.title = `📂 ${folderPath}`;
    }
}

// ===== 节点按钮动作 =====
async function previewGenerate(node) {
    const widgets = {};
    for (const w of node.widgets || []) { if (w.name) widgets[w.name] = w.value; }
    // 维度开关：widget 值为"开启"/"关闭"的都是维度，key 用 widget 原名（与后端 dim["label"] 一致）
    const modules = {};
    for (const w of node.widgets || []) {
        if (w.value === "开启" || w.value === "关闭") modules[w.name] = w.value;
    }
    const body = {
        seed: widgets["随机种子"] ?? -1,
        style: widgets["风格协调"] ?? "不限",
        sep: widgets["段落分隔符"] ?? "。",
        custom_sep: widgets["自定义分隔符"] ?? "",
        modules: modules,
    };
    showToast("正在试生成", "info");
    try {
        const res = await fetch("/prompt_randomizer/preview", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        if (!res.ok) { showToast("试生成失败", "error"); return; }
        const data = await res.json();
        showPreviewResult(data.prompt || "", data.count ?? 0, data.segments || []);
    } catch (e) {
        showToast("试生成失败", "error");
        console.error("[PR] preview 失败:", e);
    }
}

// ===== 试生成结果浮层（苹果风格）=====
function showPreviewResult(prompt, count, segments) {
    document.querySelectorAll(".pr-preview-overlay").forEach((el) => el.remove());
    const overlay = document.createElement("div");
    overlay.className = "pr-preview-overlay";
    Object.assign(overlay.style, {
        position: "fixed", inset: "0", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)",
        zIndex: "200000", display: "flex", alignItems: "center", justifyContent: "center",
        opacity: "0", pointerEvents: "none", transition: "opacity 0.2s ease",
    });
    requestAnimationFrame(() => { overlay.style.opacity = "1"; overlay.style.pointerEvents = "auto"; });

    const card = document.createElement("div");
    Object.assign(card.style, {
        background: C.window, color: C.t1, borderRadius: C.rXl, fontFamily: FONT.sans,
        maxWidth: "min(80vw, 720px)", maxHeight: "80vh", width: "100%",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: C.shXl, backdropFilter: "blur(30px)",
        transform: "translateY(20px) scale(0.96)", transition: "transform 0.25s cubic-bezier(0.2,0.9,0.3,1.1)",
    });
    requestAnimationFrame(() => { card.style.transform = "translateY(0) scale(1)"; });

    // Header
    const header = document.createElement("div");
    Object.assign(header.style, {
        display: "flex", alignItems: "center", gap: SP.md,
        padding: `${SP.md} ${SP.lg}`, borderBottom: `0.5px solid ${C.hair}`,
    });
    const logo = document.createElement("div");
    logo.textContent = "P";
    Object.assign(logo.style, {
        width: "28px", height: "28px", borderRadius: C.rMd,
        background: C.brand, color: "#fff", fontFamily: FONT.mono, fontSize: FS.md, fontWeight: "700",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: "0",
    });
    const titleBox = document.createElement("div");
    titleBox.style.flex = "1";
    titleBox.innerHTML = `<div style="font-size:${FS.xl};font-weight:600;color:${C.t1};letter-spacing:-0.3px;">试生成结果</div>`;
    header.append(logo, titleBox);
    const badge = document.createElement("span");
    badge.textContent = `${count} 字`;
    Object.assign(badge.style, {
        color: C.t2, fontSize: FS.sm, fontWeight: "500", fontFamily: FONT.mono,
        padding: "4px 10px", borderRadius: C.rPill, background: C.chipBg,
    });
    const copyBtn = mkBtn("复制", "primary", { size: "sm" });
    copyBtn.onclick = async () => {
        try { await navigator.clipboard.writeText(prompt); showToast("已复制到剪贴板", "success"); }
        catch (e) { showToast("复制失败，请手动选中", "warn"); }
    };
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    Object.assign(closeBtn.style, {
        width: "28px", height: "28px", borderRadius: "50%", background: "transparent",
        border: "none", color: C.t2, cursor: "pointer", fontSize: FS.md,
        display: "flex", alignItems: "center", justifyContent: "center", transition: "0.15s",
    });
    closeBtn.onmouseenter = () => { closeBtn.style.background = C.hover; closeBtn.style.color = C.t1; };
    closeBtn.onmouseleave = () => { closeBtn.style.background = "transparent"; closeBtn.style.color = C.t2; };
    closeBtn.onclick = () => overlay.remove();
    header.append(badge, copyBtn, closeBtn);
    card.appendChild(header);

    // Segments
    if (segments && segments.length) {
        const segBox = document.createElement("div");
        Object.assign(segBox.style, { display: "flex", flexDirection: "column", padding: `${SP.sm} ${SP.lg}`, gap: SP.xs });
        segments.forEach((s, i) => {
            const row = document.createElement("div");
            Object.assign(row.style, {
                display: "flex", gap: SP.md, alignItems: "flex-start",
                padding: `${SP.sm} ${SP.md}`, background: C.chipBg, borderRadius: C.rMd,
                fontSize: FS.md, color: C.t2, lineHeight: "1.6",
            });
            const num = document.createElement("span");
            num.textContent = String(i + 1).padStart(2, "0");
            Object.assign(num.style, {
                flexShrink: "0", color: C.brand, fontFamily: FONT.mono, fontSize: FS.sm, fontWeight: "600",
                width: "24px", paddingTop: "1px",
            });
            const txt = document.createElement("span");
            txt.textContent = s;
            txt.style.flex = "1";
            row.append(num, txt);
            segBox.appendChild(row);
        });
        card.appendChild(segBox);
    }

    // Prompt
    const content = document.createElement("div");
    content.textContent = prompt;
    Object.assign(content.style, {
        margin: `${SP.sm} ${SP.lg} ${SP.lg}`, whiteSpace: "pre-wrap", wordBreak: "break-word",
        background: C.inputBg, padding: `${SP.md} ${SP.lg}`, borderRadius: C.rMd,
        border: `0.5px solid ${C.hair}`, fontSize: FS.md, lineHeight: "1.7",
        fontFamily: FONT.mono, color: C.t2, overflow: "auto",
    });
    card.appendChild(content);
    overlay.appendChild(card);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
}

// ===== 通用按钮（苹果药丸形）=====
function mkBtn(label, variant = "default", opts = {}) {
    const btn = document.createElement("button");
    btn.textContent = label;
    const sizes = {
        sm: { pad: "5px 14px", fs: FS.sm, h: "28px" },
        md: { pad: "7px 18px", fs: FS.md, h: "34px" },
        lg: { pad: "8px 22px", fs: FS.lg, h: "38px" },
    };
    const sz = sizes[opts.size || "md"];
    const variants = {
        default: { bg: C.hover,  fg: C.t2, hoverBg: C.hover2, hoverFg: C.t1 },
        primary: { bg: C.brand,   fg: "#fff", hoverBg: C.brandDk, hoverFg: "#fff" },
        ghost:   { bg: "transparent", fg: C.t3, hoverBg: C.hover, hoverFg: C.t1 },
        subtle:  { bg: C.hover,  fg: C.t2, hoverBg: C.hover2, hoverFg: C.t1 },
        danger:  { bg: "transparent", fg: C.err, hoverBg: "rgba(255,69,58,0.15)", hoverFg: C.err },
    };
    const v = variants[variant] || variants.default;
    Object.assign(btn.style, {
        background: v.bg, color: v.fg, border: "none",
        padding: sz.pad, borderRadius: C.rPill, cursor: "pointer",
        fontSize: sz.fs, fontWeight: "500", fontFamily: FONT.sans, letterSpacing: "0.1px",
        transition: "all 0.15s ease", whiteSpace: "nowrap",
        display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px",
        height: sz.h, boxSizing: "border-box",
    });
    if (opts.icon) { btn.style.width = sz.h; btn.style.padding = "0"; btn.style.borderRadius = "50%"; }
    btn.onmouseenter = () => { btn.style.background = v.hoverBg; btn.style.color = v.hoverFg; };
    btn.onmouseleave = () => { btn.style.background = v.bg; btn.style.color = v.fg; };
    btn.onmousedown = () => { btn.style.transform = "scale(0.96)"; };
    btn.onmouseup = () => { btn.style.transform = ""; };
    return btn;
}

// ===== 编辑器状态 =====
const editorState = {
    meta: null, currentDim: null, currentFile: null, rows: [], dirty: false, node: null,
};
let _autoSaveTimer = null;

function scheduleAutoSave(overlay) {
    if (!editorState.currentFile || !editorState.currentDim) return;
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
    updateStatus(overlay, "editing");
    _autoSaveTimer = setTimeout(() => { _autoSaveTimer = null; autoSave(overlay); }, 1500);
}

async function autoSave(overlay) {
    if (!editorState.currentFile || !editorState.currentDim || !editorState.dirty) return;
    updateStatus(overlay, "saving");
    try {
        const res = await fetch("/prompt_randomizer/editor/save", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dim: editorState.currentDim, file: editorState.currentFile, rows: editorState.rows }),
        });
        const data = await res.json();
        if (data.ok) {
            editorState.dirty = false;
            updateStatus(overlay, "saved");
            loadEditorMeta(overlay, true);
        } else { updateStatus(overlay, "error"); }
    } catch (e) {
        updateStatus(overlay, "error");
        console.error("[PR] auto-save 失败:", e);
    }
}

function updateStatus(overlay, state) {
    const dot = overlay.querySelector(".pr-status-dot");
    const txt = overlay.querySelector(".pr-status-text");
    if (!dot || !txt) return;
    const n = editorState.rows.length;
    const states = {
        idle:   { color: C.t3, label: `${n} 条 · 就绪` },
        editing:{ color: C.warn, label: `${n} 条 · 编辑中` },
        saving: { color: C.brand, label: `${n} 条 · 保存中` },
        saved:  { color: C.ok, label: `${n} 条 · 已自动保存` },
        error:  { color: C.err, label: `${n} 条 · 保存失败` },
    };
    const s = states[state] || states.idle;
    dot.style.background = s.color;
    txt.textContent = s.label;
    txt.style.color = s.color;
}

// ===== 编辑器弹窗（苹果风格布局）=====
function createEditorDialog() {
    const overlay = document.createElement("div");
    overlay.className = "pr-editor-overlay";
    Object.assign(overlay.style, {
        position: "fixed", inset: "0", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)",
        zIndex: "100000", display: "flex", alignItems: "center", justifyContent: "center",
        opacity: "0", pointerEvents: "none", transition: "opacity 0.2s ease",
    });
    requestAnimationFrame(() => { overlay.style.opacity = "1"; overlay.style.pointerEvents = "auto"; });

    const dialog = document.createElement("div");
    Object.assign(dialog.style, {
        width: "min(96vw, 1180px)", height: "min(92vh, 760px)",
        background: C.window, color: C.t1, borderRadius: C.rXxl, fontFamily: FONT.sans,
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: C.shXl, backdropFilter: "blur(30px)",
        transform: "translateY(20px) scale(0.97)", transition: "transform 0.25s cubic-bezier(0.2,0.9,0.3,1.1)",
        position: "relative",
    });
    requestAnimationFrame(() => { dialog.style.transform = "translateY(0) scale(1)"; });

    dialog.innerHTML = `
        <header style="display:flex;align-items:center;height:54px;padding:0 60px 0 24px;border-bottom:0.5px solid ${C.hair};background:rgba(28,28,30,0.3);flex-shrink:0;">
            <div style="display:flex;align-items:center;gap:12px;font-size:${FS.lg};font-weight:600;letter-spacing:-0.3px;flex-shrink:0;">
                <div style="width:28px;height:28px;background:${C.brand};border-radius:${C.rMd};display:flex;justify-content:center;align-items:center;font-size:${FS.md};font-weight:700;color:#fff;font-family:${FONT.mono};">P</div>
                <span>词库编辑器</span>
            </div>
            <span class="pr-editor-path" style="margin-left:24px;font-size:${FS.sm};color:${C.t3};font-family:${FONT.mono};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>
        </header>
        <button class="pr-editor-close" style="position:absolute;top:13px;right:18px;width:28px;height:28px;border-radius:50%;background:transparent;border:none;color:${C.t2};cursor:pointer;font-size:${FS.md};display:flex;align-items:center;justify-content:center;transition:0.15s;z-index:5;">✕</button>
        <main style="flex:1;display:flex;overflow:hidden;">
            <aside class="pr-editor-sidebar" style="width:260px;background:${C.sidebar};backdrop-filter:blur(20px);border-right:0.5px solid ${C.hair};display:flex;flex-direction:column;padding:16px 12px 12px;flex-shrink:0;overflow-y:auto;"></aside>
            <section class="pr-editor-main" style="flex:1;display:flex;flex-direction:column;overflow:hidden;background:${C.panel};position:relative;">
                <div class="pr-editor-toolbar" style="height:64px;padding:0 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:0.5px solid ${C.hair};flex-shrink:0;gap:${SP.sm};">
                    <div class="pr-editor-info" style="display:flex;align-items:center;gap:${SP.sm};font-size:${FS.lg};color:${C.t2};flex:1;overflow:hidden;"></div>
                    <div class="action-stack" style="display:flex;gap:6px;align-items:center;flex-shrink:0;"></div>
                </div>
                <div style="flex:1;overflow-y:auto;padding:6px 24px 10px;">
                    <table style="width:100%;border-collapse:separate;border-spacing:0;font-family:${FONT.sans};">
                        <thead class="pr-editor-thead"></thead>
                        <tbody class="pr-editor-tbody"></tbody>
                    </table>
                </div>
                <div class="pr-editor-footer" style="padding:12px 24px;border-top:0.5px solid ${C.hair};background:${C.panel2};backdrop-filter:blur(20px);display:flex;flex-direction:column;gap:6px;flex-shrink:0;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span class="pr-status-dot" style="width:6px;height:6px;border-radius:50%;background:${C.ok};transition:all 0.2s;flex-shrink:0;"></span>
                            <span class="pr-status-text" style="color:${C.t3};font-size:${FS.sm};font-weight:500;">未选择文件</span>
                        </div>
                    </div>
                    <div class="pr-editor-preview-box" style="display:none;background:${C.inputBg};border:0.5px solid ${C.hair};border-radius:${C.rMd};padding:8px 14px;color:${C.t2};font-family:${FONT.mono};font-size:${FS.md};line-height:1.6;overflow-y:auto;max-height:80px;"></div>
                </div>
            </section>
        </main>
    `;
    overlay.appendChild(dialog);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) closeEditor(overlay); });
    const closeBtn = dialog.querySelector(".pr-editor-close");
    closeBtn.onclick = () => closeEditor(overlay);
    closeBtn.onmouseenter = function() { this.style.background = C.err; this.style.color = "#fff"; };
    closeBtn.onmouseleave = function() { this.style.background = "transparent"; this.style.color = C.t2; };
    return overlay;
}

function closeEditor(overlay) {
    if (editorState.dirty && editorState.currentFile && editorState.currentDim) {
        if (_autoSaveTimer) { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; }
        fetch("/prompt_randomizer/editor/save", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dim: editorState.currentDim, file: editorState.currentFile, rows: editorState.rows }),
        }).catch(() => {});
    }
    if (_autoSaveTimer) { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; }
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 250);
    editorState.dirty = false;
    editorState.currentDim = null;
    editorState.currentFile = null;
    editorState.rows = [];
}

async function openEditor(node) {
    const existing = document.querySelector(".pr-editor-overlay");
    if (existing) existing.remove();
    editorState.node = node;
    const overlay = createEditorDialog();
    document.body.appendChild(overlay);

    const actionStack = overlay.querySelector(".action-stack");
    const styleBtn = mkBtn("🎨 风格管理", "default", { size: "sm" });
    const addBtn = mkBtn("添加新行", "primary", { size: "sm" });
    const batchBtn = mkBtn("批量添加", "default", { size: "sm" });
    const previewBtn = mkBtn("🎲试生成", "default", { size: "sm" });
    styleBtn.onclick = () => openStyleModal(overlay);
    addBtn.onclick = () => addRow(overlay);
    batchBtn.onclick = () => addBatchRows(overlay);
    previewBtn.onclick = () => previewInEditor(overlay);
    actionStack.append(styleBtn, addBtn, batchBtn, previewBtn);

    await loadEditorMeta(overlay);
}

async function loadEditorMeta(overlay, silent = false) {
    if (!silent) showToast("加载词库结构", "info");
    try {
        const res = await fetch("/prompt_randomizer/editor/meta");
        if (!res.ok) throw new Error("meta fetch failed");
        const data = await res.json();
        editorState.meta = data;
        overlay.querySelector(".pr-editor-path").textContent = data.pool_dir || "";
        renderSidebar(overlay);
    } catch (e) {
        if (!silent) showToast("加载维度结构失败", "error");
        console.error("[PR] editor meta 失败:", e);
    }
}

// ===== 侧边栏渲染（苹果纯导航树）=====
function renderSidebar(overlay) {
    const sidebar = overlay.querySelector(".pr-editor-sidebar");
    sidebar.innerHTML = "";
    const meta = editorState.meta;
    if (!meta) return;

    // 维度列表容器
    const list = document.createElement("div");
    Object.assign(list.style, { flex: "1", overflowY: "auto", display: "flex", flexDirection: "column" });
    for (const dim of meta.dimensions) {
        list.appendChild(renderDimensionCard(overlay, dim));
    }
    sidebar.appendChild(list);

    // 恢复高亮
    if (editorState.currentDim && editorState.currentFile) {
        sidebar.querySelectorAll(".pr-file-item").forEach((el) => {
            if (el.dataset.dim === editorState.currentDim && el.dataset.file === editorState.currentFile) {
                el.dataset.active = "1";
                el.style.background = C.brandBg;
                el.style.color = C.t1;
            }
        });
    }
}

// 维度卡片（苹果树形）
function renderDimensionCard(overlay, dim) {
    const dimMeta = DIMENSIONS.find(d => d.dir === dim.dir) || {};
    const group = document.createElement("div");
    Object.assign(group.style, { marginBottom: SP.md });

    // Parent
    const parent = document.createElement("div");
    Object.assign(parent.style, {
        display: "flex", alignItems: "center", padding: "6px 12px", borderRadius: C.rMd,
        fontSize: FS.lg, fontWeight: "500", color: C.t2, gap: SP.sm,
    });
    parent.innerHTML = `<span style="flex:1;">${dim.label}</span>`;
    if (!dim.exists) {
        parent.innerHTML += `<span style="font-size:${FS.xs};color:${C.warn};">缺失</span>`;
    }
    const addBtn = document.createElement("span");
    addBtn.textContent = "+";
    Object.assign(addBtn.style, {
        fontSize: FS.sm, color: C.t3, background: C.chipBg, padding: "0 6px", borderRadius: "4px",
        cursor: "pointer", transition: "0.15s",
    });
    addBtn.onmouseenter = () => { addBtn.style.background = C.hover; addBtn.style.color = C.t1; };
    addBtn.onmouseleave = () => { addBtn.style.background = C.chipBg; addBtn.style.color = C.t3; };
    addBtn.onclick = (e) => { e.stopPropagation(); showCreateFileDialog(overlay, dim.dir, dim.label); };
    parent.appendChild(addBtn);
    group.appendChild(parent);

    // Children
    if (dim.files && dim.files.length) {
        dim.files.forEach((f, i) => {
            group.appendChild(renderFileItem(overlay, dim.dir, dim.label, f.file, f.count, i, dim.files));
        });
    }
    return group;
}

// 文件条目（苹果树形子项 + 上下移）
function renderFileItem(overlay, dimDir, dimLabel, file, count, idx, files) {
    const item = document.createElement("div");
    item.className = "pr-file-item";
    item.dataset.dim = dimDir;
    item.dataset.file = file;
    Object.assign(item.style, {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "5px 12px 5px 28px", margin: "2px 0", borderRadius: C.rSm,
        fontSize: FS.md, color: C.t2, cursor: "pointer", transition: "0.1s",
    });
    const name = document.createElement("span");
    name.textContent = file.replace(/\.txt$/i, "");
    name.style.flex = "1";
    name.style.overflow = "hidden";
    name.style.textOverflow = "ellipsis";
    name.style.whiteSpace = "nowrap";
    item.appendChild(name);
    const right = document.createElement("div");
    right.style.display = "flex";
    right.style.alignItems = "center";
    right.style.gap = "2px";
    // 计数
    const cnt = document.createElement("span");
    cnt.textContent = count || 0;
    Object.assign(cnt.style, { fontSize: FS.xs, color: C.t3, fontFamily: FONT.mono, marginRight: "6px" });
    right.appendChild(cnt);

    // 上移
    const upBtn = document.createElement("span");
    upBtn.textContent = "↑";
    Object.assign(upBtn.style, {
        opacity: "0", color: C.t3, cursor: "pointer", fontSize: FS.sm, transition: "0.15s",
        width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: C.rSm, userSelect: "none",
    });
    upBtn.onmouseenter = (e) => { e.stopPropagation(); if (idx > 0) upBtn.style.color = C.t1; };
    upBtn.onmouseleave = () => { upBtn.style.color = C.t3; };
    upBtn.onclick = (e) => {
        e.stopPropagation();
        if (idx <= 0) return;
        const order = files.map(f => f.file);
        [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
        moveFile(overlay, dimDir, order);
    };
    if (idx === 0) upBtn.style.opacity = "0.25";
    right.appendChild(upBtn);

    // 下移
    const downBtn = document.createElement("span");
    downBtn.textContent = "↓";
    Object.assign(downBtn.style, {
        opacity: "0", color: C.t3, cursor: "pointer", fontSize: FS.sm, transition: "0.15s",
        width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: C.rSm, userSelect: "none",
    });
    downBtn.onmouseenter = (e) => { e.stopPropagation(); if (idx < files.length - 1) downBtn.style.color = C.t1; };
    downBtn.onmouseleave = () => { downBtn.style.color = C.t3; };
    downBtn.onclick = (e) => {
        e.stopPropagation();
        if (idx >= files.length - 1) return;
        const order = files.map(f => f.file);
        [order[idx + 1], order[idx]] = [order[idx], order[idx + 1]];
        moveFile(overlay, dimDir, order);
    };
    if (idx === files.length - 1) downBtn.style.opacity = "0.25";
    right.appendChild(downBtn);

    // 删除
    const del = document.createElement("span");
    del.textContent = "✕";
    Object.assign(del.style, {
        opacity: "0", color: C.t3, cursor: "pointer", fontSize: FS.xs, transition: "0.15s",
        width: "20px", height: "20px", display: "flex", alignItems: "center", justifyContent: "center",
        borderRadius: C.rSm,
    });
    del.onmouseenter = (e) => { e.stopPropagation(); del.style.color = C.err; };
    del.onmouseleave = () => { del.style.color = C.t3; };
    del.onclick = (e) => { e.stopPropagation(); deleteSubContentFile(overlay, dimDir, file, dimLabel); };
    right.appendChild(del);
    item.appendChild(right);

    item.onmouseenter = () => {
        upBtn.style.opacity = idx === 0 ? "0.25" : "1";
        downBtn.style.opacity = idx === files.length - 1 ? "0.25" : "1";
        del.style.opacity = "1";
        if (item.dataset.active !== "1") { item.style.background = C.hover; item.style.color = C.t1; }
    };
    item.onmouseleave = () => {
        upBtn.style.opacity = "0";
        downBtn.style.opacity = "0";
        del.style.opacity = "0";
        if (item.dataset.active !== "1") { item.style.background = "transparent"; item.style.color = C.t2; }
    };
    item.onclick = () => selectFile(dimDir, file, overlay);
    return item;
}

// 调用后端 reorder，重新加载并保持选中
async function moveFile(overlay, dimDir, order) {
    try {
        const res = await fetch("/prompt_randomizer/editor/reorder", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dim: dimDir, order }),
        });
        const data = await res.json();
        if (data.ok) {
            const savedDim = editorState.currentDim;
            const savedFile = editorState.currentFile;
            await loadEditorMeta(overlay, true);
            // 恢复选中高亮
            if (savedDim && savedFile) {
                overlay.querySelectorAll(".pr-file-item").forEach((el) => {
                    if (el.dataset.dim === savedDim && el.dataset.file === savedFile) {
                        el.dataset.active = "1";
                        el.style.background = C.brandBg;
                        el.style.color = C.t1;
                    }
                });
            }
        } else { showToast("移动失败", "error"); }
    } catch (e) { showToast("移动失败", "error"); console.error("[PR] reorder:", e); }
}

// ===== 风格管理独立弹窗（苹果 Modal）=====
function openStyleModal(overlay) {
    overlay.querySelectorAll(".pr-style-modal").forEach((el) => el.remove());
    const styles = editorState.meta ? editorState.meta.styles : [];

    const modal = document.createElement("div");
    modal.className = "pr-style-modal";
    Object.assign(modal.style, {
        position: "absolute", inset: "0", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
        display: "flex", justifyContent: "center", alignItems: "center",
        opacity: "0", pointerEvents: "none", transition: "opacity 0.2s ease", zIndex: "200001",
    });
    requestAnimationFrame(() => { modal.style.opacity = "1"; modal.style.pointerEvents = "auto"; });

    const box = document.createElement("div");
    Object.assign(box.style, {
        width: "min(90%, 460px)", maxHeight: "80%",
        background: C.window, backdropFilter: "blur(30px)", borderRadius: C.rXl,
        boxShadow: C.shLg, display: "flex", flexDirection: "column", overflow: "hidden",
        transform: "translateY(20px) scale(0.95)", transition: "transform 0.25s cubic-bezier(0.2,0.9,0.3,1.1)",
    });
    requestAnimationFrame(() => { box.style.transform = "translateY(0) scale(1)"; });

    // Header
    const header = document.createElement("div");
    Object.assign(header.style, {
        padding: `${SP.md} ${SP.lg}`, borderBottom: `0.5px solid ${C.hair}`,
        display: "flex", justifyContent: "space-between", alignItems: "center",
    });
    const title = document.createElement("span");
    Object.assign(title.style, { fontSize: FS.xl, fontWeight: "600", color: C.t1 });
    title.textContent = "🎨 风格管理";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    Object.assign(closeBtn.style, {
        width: "28px", height: "28px", borderRadius: "50%", background: "transparent",
        border: "none", color: C.t2, cursor: "pointer", fontSize: FS.md,
        display: "flex", alignItems: "center", justifyContent: "center", transition: "0.15s",
    });
    closeBtn.onmouseenter = () => { closeBtn.style.background = C.hover; closeBtn.style.color = C.t1; };
    closeBtn.onmouseleave = () => { closeBtn.style.background = "transparent"; closeBtn.style.color = C.t2; };
    closeBtn.onclick = () => closeModal(modal);
    header.append(title, closeBtn);
    box.appendChild(header);

    // Body
    const body = document.createElement("div");
    Object.assign(body.style, { padding: SP.lg, flex: "1", overflowY: "auto", display: "flex", flexDirection: "column", gap: SP.md });

    // Style list
    const list = document.createElement("div");
    Object.assign(list.style, { display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "200px", overflowY: "auto", paddingBottom: SP.xs });
    if (styles.length === 0) {
        const empty = document.createElement("div");
        empty.textContent = "暂无风格";
        Object.assign(empty.style, { color: C.t3, fontSize: FS.md });
        list.appendChild(empty);
    }
    for (const s of styles) {
        const tag = document.createElement("span");
        Object.assign(tag.style, {
            display: "flex", alignItems: "center", gap: SP.sm,
            background: C.chipBg, borderRadius: C.rLg, padding: "4px 8px 4px 12px",
            fontSize: FS.md, color: C.t2, border: "0.5px solid transparent", transition: "0.1s",
        });
        tag.textContent = s;
        const x = document.createElement("span");
        x.textContent = "✕";
        Object.assign(x.style, { color: "transparent", cursor: "pointer", transition: "0.1s", fontSize: FS.sm });
        x.onmouseenter = (e) => { e.stopPropagation(); x.style.color = C.err; };
        x.onmouseleave = () => { x.style.color = "transparent"; };
        x.onclick = async () => {
            try {
                const res = await fetch("/prompt_randomizer/styles/delete", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: s }),
                });
                const data = await res.json();
                if (data.ok) {
                    showToast(`已删除风格: ${s}`, "success");
                    editorState.meta.styles = data.styles;
                    openStyleModal(overlay);
                    if (editorState.currentFile) renderTable(overlay);
                } else { showToast(data.error || "删除失败", "error"); }
            } catch (e) { showToast("删除失败", "error"); console.error("[PR] styles/delete:", e); }
        };
        tag.appendChild(x);
        list.appendChild(tag);
    }
    body.appendChild(list);

    // Add row
    const addRow = document.createElement("div");
    Object.assign(addRow.style, { display: "flex", gap: SP.sm, alignItems: "center", paddingTop: SP.sm, borderTop: `0.5px solid ${C.hair}` });
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "请输入新风格名称...";
    Object.assign(input.style, {
        flex: "1", background: C.inputBg, border: `0.5px solid ${C.hair}`, borderRadius: C.rMd,
        padding: "8px 12px", color: C.t1, fontSize: FS.md, outline: "none", transition: "0.15s",
        fontFamily: FONT.sans,
    });
    input.onfocus = () => { input.style.borderColor = C.brand; };
    input.onblur = () => { input.style.borderColor = C.hair; };
    input.onkeydown = (e) => { if (e.key === "Enter") addBtn.click(); };
    const addBtn = mkBtn("添加风格", "primary", { size: "sm" });
    addBtn.onclick = async () => {
        const name = input.value.trim();
        if (!name) { showToast("请输入风格名", "warn"); return; }
        try {
            const res = await fetch("/prompt_randomizer/styles/add", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name }),
            });
            const data = await res.json();
            if (data.ok) {
                showToast(`已添加风格: ${name}`, "success");
                editorState.meta.styles = data.styles;
                openStyleModal(overlay);
                if (editorState.currentFile) renderTable(overlay);
            } else { showToast(data.error || "添加失败", "error"); }
        } catch (e) { showToast("添加失败", "error"); console.error("[PR] styles/add:", e); }
    };
    addRow.append(input, addBtn);
    body.appendChild(addRow);

    box.appendChild(body);
    modal.appendChild(box);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeModal(modal); });
    overlay.appendChild(modal);
    setTimeout(() => input.focus(), 100);
}

function closeModal(modal) {
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
    setTimeout(() => modal.remove(), 200);
}

// ===== 新建文件对话框（苹果 Modal）=====
function showCreateFileDialog(overlay, dimDir, dimLabel) {
    overlay.querySelectorAll(".pr-create-dialog").forEach((el) => el.remove());
    const dialog = document.createElement("div");
    dialog.className = "pr-create-dialog";
    Object.assign(dialog.style, {
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) translateY(12px) scale(0.96)",
        background: C.window, backdropFilter: "blur(30px)", color: C.t1, borderRadius: C.rXl, fontFamily: FONT.sans,
        padding: SP.lg, width: "min(80%, 420px)",
        display: "flex", flexDirection: "column", gap: SP.md,
        boxShadow: C.shLg, zIndex: "200001",
        transition: "transform 0.25s cubic-bezier(0.2,0.9,0.3,1.1)",
    });
    requestAnimationFrame(() => { dialog.style.transform = "translate(-50%, -50%) translateY(0) scale(1)"; });

    const title = document.createElement("div");
    title.innerHTML = `
        <div style="font-size:${FS.xl};font-weight:600;color:${C.t1};letter-spacing:-0.3px;">新建子内容</div>
        <div style="color:${C.t3};font-size:${FS.sm};margin-top:${SP.xs};font-family:${FONT.mono};">${dimLabel}</div>`;
    dialog.appendChild(title);
    const input = document.createElement("input");
    input.placeholder = "文件名（无需 .txt）";
    Object.assign(input.style, {
        width: "100%", background: C.inputBg, color: C.t1, fontFamily: FONT.sans,
        border: `0.5px solid ${C.hair}`, padding: "10px 14px", borderRadius: C.rMd,
        fontSize: FS.md, boxSizing: "border-box", outline: "none", transition: "border-color 0.15s",
    });
    input.onfocus = () => { input.style.borderColor = C.brand; };
    input.onblur = () => { input.style.borderColor = C.hair; };
    dialog.appendChild(input);
    const btnBox = document.createElement("div");
    Object.assign(btnBox.style, { display: "flex", gap: SP.sm, justifyContent: "flex-end" });
    const cancel = mkBtn("取消", "default", { size: "sm" });
    cancel.onclick = () => dialog.remove();
    const ok = mkBtn("创建", "primary", { size: "sm" });
    ok.onclick = async () => {
        let name = input.value.trim();
        if (!name) { showToast("请输入文件名", "warn"); return; }
        if (!name.toLowerCase().endsWith(".txt")) name += ".txt";
        try {
            const res = await fetch("/prompt_randomizer/editor/create_file", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dim: dimDir, file: name }),
            });
            const data = await res.json();
            if (data.ok) {
                showToast(`已创建 ${name}`, "success");
                dialog.remove();
                await loadEditorMeta(overlay, true);
                selectFile(dimDir, name, overlay);
            } else { showToast("创建失败: " + (data.error || ""), "error"); }
        } catch (e) { showToast("创建失败", "error"); console.error("[PR] create_file:", e); }
    };
    btnBox.append(cancel, ok);
    dialog.appendChild(btnBox);
    overlay.appendChild(dialog);
    input.focus();
    input.onkeydown = (e) => { if (e.key === "Enter") ok.click(); if (e.key === "Escape") dialog.remove(); };
}

async function deleteSubContentFile(overlay, dimDir, file, dimLabel) {
    showConfirm(overlay, "删除子内容", `确定删除 ${dimLabel} 下的 ${file} 吗？`, async () => {
        try {
            const res = await fetch("/prompt_randomizer/editor/delete_file", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dim: dimDir, file }),
            });
            const data = await res.json();
            if (data.ok) {
                showToast(`已删除 ${file}`, "success");
                if (editorState.currentDim === dimDir && editorState.currentFile === file) {
                    editorState.currentDim = null;
                    editorState.currentFile = null;
                    editorState.rows = [];
                    renderTable(overlay);
                }
                await loadEditorMeta(overlay, true);
            } else { showToast("删除失败", "error"); }
        } catch (e) { showToast("删除失败", "error"); console.error("[PR] delete_file:", e); }
    });
}

// ===== 自定义确认弹窗（替代原生 confirm，避免破坏 ComfyUI 焦点）=====
function showConfirm(overlay, title, message, onOk) {
    overlay.querySelectorAll(".pr-confirm-modal").forEach((el) => el.remove());
    const modal = document.createElement("div");
    modal.className = "pr-confirm-modal";
    Object.assign(modal.style, {
        position: "absolute", inset: "0", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
        display: "flex", justifyContent: "center", alignItems: "center",
        opacity: "0", pointerEvents: "none", transition: "opacity 0.2s ease", zIndex: "200002",
    });
    requestAnimationFrame(() => { modal.style.opacity = "1"; modal.style.pointerEvents = "auto"; });

    const box = document.createElement("div");
    Object.assign(box.style, {
        background: C.window, backdropFilter: "blur(30px)", color: C.t1, borderRadius: C.rXl,
        fontFamily: FONT.sans, padding: SP.lg, width: "min(85%, 380px)",
        display: "flex", flexDirection: "column", gap: SP.md,
        boxShadow: C.shLg,
        transform: "translateY(12px) scale(0.96)", transition: "transform 0.2s cubic-bezier(0.2,0.9,0.3,1.1)",
    });
    requestAnimationFrame(() => { box.style.transform = "translateY(0) scale(1)"; });

    const titleEl = document.createElement("div");
    Object.assign(titleEl.style, { fontSize: FS.xl, fontWeight: "600", color: C.t1, letterSpacing: "-0.2px" });
    titleEl.textContent = title;
    box.appendChild(titleEl);

    const msgEl = document.createElement("div");
    Object.assign(msgEl.style, { fontSize: FS.md, color: C.t2, lineHeight: "1.6", wordBreak: "break-word" });
    msgEl.textContent = message;
    box.appendChild(msgEl);

    const btnBox = document.createElement("div");
    Object.assign(btnBox.style, { display: "flex", gap: SP.sm, justifyContent: "flex-end" });
    const cancelBtn = mkBtn("取消", "default", { size: "sm" });
    cancelBtn.onclick = () => closeConfirmModal(modal);
    const okBtn = mkBtn("删除", "danger", { size: "sm" });
    okBtn.style.background = C.err;
    okBtn.style.color = "#fff";
    okBtn.onmouseenter = () => { okBtn.style.background = "#d70015"; };
    okBtn.onmouseleave = () => { okBtn.style.background = C.err; };
    okBtn.onclick = () => { closeConfirmModal(modal); onOk(); };
    btnBox.append(cancelBtn, okBtn);
    box.appendChild(btnBox);
    modal.appendChild(box);
    modal.addEventListener("click", (e) => { if (e.target === modal) closeConfirmModal(modal); });
    overlay.appendChild(modal);
    const escHandler = (e) => { if (e.key === "Escape") { closeConfirmModal(modal); document.removeEventListener("keydown", escHandler); } };
    document.addEventListener("keydown", escHandler);
    setTimeout(() => cancelBtn.focus(), 50);
}

function closeConfirmModal(modal) {
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
    setTimeout(() => modal.remove(), 200);
}

async function selectFile(dimDir, file, overlay) {
    if (editorState.dirty && editorState.currentFile && editorState.currentDim) {
        if (_autoSaveTimer) { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; }
        await autoSave(overlay);
    }
    try {
        const res = await fetch(`/prompt_randomizer/editor/get?dim=${encodeURIComponent(dimDir)}&file=${encodeURIComponent(file)}`);
        if (!res.ok) throw new Error("get failed");
        const data = await res.json();
        editorState.currentDim = dimDir;
        editorState.currentFile = file;
        editorState.rows = data.rows || [];
        editorState.dirty = false;
        renderTable(overlay);
        overlay.querySelectorAll(".pr-file-item").forEach((el) => {
            if (el.dataset.dim === dimDir && el.dataset.file === file) {
                el.dataset.active = "1";
                el.style.background = C.brandBg;
                el.style.color = C.t1;
            } else {
                el.dataset.active = "0";
                el.style.background = "transparent";
                el.style.color = C.t2;
            }
        });
    } catch (e) { showToast("加载失败", "error"); console.error("[PR] editor get:", e); }
}

// ===== 表格渲染（苹果行列表）=====
function renderTable(overlay) {
    const main = overlay.querySelector(".pr-editor-main");
    const styles = editorState.meta ? editorState.meta.styles : [];

    // Info bar（苹果 path 风格）
    const info = main.querySelector(".pr-editor-info");
    if (editorState.currentFile) {
        const dim = DIMENSIONS.find(d => d.dir === editorState.currentDim);
        const dimLabel = dim ? `${dim.code}_${dim.label}` : editorState.currentDim;
        const fileName = editorState.currentFile.replace(/\.txt$/i, "");
        info.innerHTML = `<span style="color:${C.t3};">${dimLabel}</span> <span style="color:${C.t4};">/</span> <strong style="color:${C.t1};font-weight:500;">${fileName}</strong>`;
    } else {
        info.innerHTML = `<span style="color:${C.t3};">← 请在左侧选择或新建子内容文件</span>`;
    }

    // Thead（隐藏，苹果风格无表头）
    const thead = main.querySelector(".pr-editor-thead");
    thead.innerHTML = "";

    // Tbody
    const tbody = main.querySelector(".pr-editor-tbody");
    tbody.innerHTML = "";
    if (!editorState.currentFile) {
        const emptyRow = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.innerHTML = `<div style="padding:120px 20px;text-align:center;">
            <div style="font-size:${FS.xs};color:${C.t4};letter-spacing:1px;text-transform:uppercase;font-weight:600;">No File Selected</div>
            <div style="color:${C.t3};font-size:${FS.md};margin-top:${SP.sm};">请从左侧选择或新建子内容文件</div>
        </div>`;
        Object.assign(td.style, { borderBottom: "none" });
        emptyRow.appendChild(td);
        tbody.appendChild(emptyRow);
        updateStatus(overlay, "idle");
        return;
    }
    if (editorState.rows.length === 0) {
        const emptyRow = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.innerHTML = `<div style="padding:80px 20px;text-align:center;">
            <div style="color:${C.t3};font-size:${FS.md};font-weight:500;">空文件</div>
            <div style="color:${C.t4};font-size:${FS.sm};margin-top:6px;">点击右上「添加新行」开始</div>
        </div>`;
        Object.assign(td.style, { borderBottom: "none" });
        emptyRow.appendChild(td);
        tbody.appendChild(emptyRow);
        updateStatus(overlay, "idle");
        return;
    }
    editorState.rows.forEach((row, idx) => {
        const tr = document.createElement("tr");
        tr.style.transition = "background 0.1s ease";
        tr.onmouseenter = () => { tr.style.background = C.rowHover; };
        tr.onmouseleave = () => { tr.style.background = "transparent"; };

        // #
        const tdNum = document.createElement("td");
        tdNum.textContent = String(idx + 1).padStart(2, "0");
        Object.assign(tdNum.style, {
            width: "40px", padding: `10px 8px`, color: C.t3, fontSize: FS.sm, verticalAlign: "middle",
            borderBottom: `0.5px solid ${C.hair2}`, textAlign: "center", fontWeight: "600",
            fontFamily: FONT.mono,
        });
        tr.appendChild(tdNum);

        // Content input
        const tdContent = document.createElement("td");
        Object.assign(tdContent.style, { padding: `8px`, borderBottom: `0.5px solid ${C.hair2}`, verticalAlign: "middle" });
        const input = document.createElement("input");
        input.value = row.text || "";
        input.placeholder = "输入词条内容…";
        Object.assign(input.style, {
            width: "100%", background: "transparent", border: "none", color: C.t1, fontFamily: FONT.sans,
            padding: "4px 8px", borderRadius: C.rSm, fontSize: FS.lg, outline: "none",
        });
        input.onfocus = () => { input.style.background = C.inputBg; };
        input.onblur = () => { input.style.background = "transparent"; };
        input.oninput = () => { row.text = input.value; editorState.dirty = true; scheduleAutoSave(overlay); };
        tdContent.appendChild(input);
        tr.appendChild(tdContent);

        // Style tags
        const styleTd = document.createElement("td");
        Object.assign(styleTd.style, { padding: `8px`, borderBottom: `0.5px solid ${C.hair2}`, verticalAlign: "middle", width: "240px" });
        if (!row.tags) row.tags = [];
        const tagsWrap = document.createElement("div");
        tagsWrap.style.display = "flex";
        tagsWrap.style.flexWrap = "wrap";
        tagsWrap.style.gap = "4px";
        styles.forEach((s) => {
            const isOn = row.tags.includes(s);
            const tag = document.createElement("span");
            tag.textContent = s;
            Object.assign(tag.style, {
                display: "inline-flex", alignItems: "center", cursor: "pointer",
                padding: "3px 10px", borderRadius: C.rLg, fontSize: FS.md,
                fontWeight: "400", transition: "0.1s", userSelect: "none", fontFamily: FONT.sans,
            });
            function applyStyle(on) {
                Object.assign(tag.style, on ? {
                    background: C.brand, color: "#fff",
                } : {
                    background: C.chipBg, color: C.t3,
                });
            }
            applyStyle(isOn);
            tag.onmouseenter = () => { if (!row.tags.includes(s)) { tag.style.background = C.hover; tag.style.color = C.t2; } };
            tag.onmouseleave = () => applyStyle(row.tags.includes(s));
            tag.onclick = () => {
                if (row.tags.includes(s)) {
                    row.tags = row.tags.filter(t => t !== s);
                } else {
                    row.tags.push(s);
                }
                applyStyle(row.tags.includes(s));
                editorState.dirty = true;
                scheduleAutoSave(overlay);
            };
            tagsWrap.appendChild(tag);
        });
        styleTd.appendChild(tagsWrap);
        tr.appendChild(styleTd);

        // Delete
        const delTd = document.createElement("td");
        Object.assign(delTd.style, { padding: `8px 12px`, borderBottom: `0.5px solid ${C.hair2}`, verticalAlign: "middle", textAlign: "center", width: "52px" });
        const delBtn = document.createElement("span");
        delBtn.textContent = "✕";
        Object.assign(delBtn.style, {
            cursor: "pointer", color: C.t3, fontSize: FS.sm, opacity: "0",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: "24px", height: "24px", borderRadius: C.rSm, transition: "0.15s",
        });
        tr.onmouseenter = () => { delBtn.style.opacity = "1"; };
        tr.onmouseleave = () => { delBtn.style.opacity = "0"; };
        delBtn.onmouseenter = () => { delBtn.style.color = C.err; };
        delBtn.onmouseleave = () => { delBtn.style.color = C.t3; };
        delBtn.onclick = () => {
            editorState.rows.splice(idx, 1);
            editorState.dirty = true;
            renderTable(overlay);
            scheduleAutoSave(overlay);
        };
        delTd.appendChild(delBtn);
        tr.appendChild(delTd);

        tbody.appendChild(tr);
    });

    updateStatus(overlay, editorState.dirty ? "editing" : "idle");
}

function addRow(overlay) {
    if (!editorState.currentFile) { showToast("请先选择子内容文件", "warn"); return; }
    editorState.rows.push({ text: "", tags: [] });
    editorState.dirty = true;
    renderTable(overlay);
    scheduleAutoSave(overlay);
    const scrollBox = overlay.querySelector(".pr-editor-tbody").parentElement;
    scrollBox.scrollTop = scrollBox.scrollHeight;
}

function addBatchRows(overlay) {
    if (!editorState.currentFile) { showToast("请先选择子内容文件", "warn"); return; }
    overlay.querySelectorAll(".pr-batch-dialog").forEach((el) => el.remove());
    const styles = editorState.meta ? editorState.meta.styles : [];

    const dialog = document.createElement("div");
    dialog.className = "pr-batch-dialog";
    Object.assign(dialog.style, {
        position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%) translateY(12px) scale(0.96)",
        background: C.window, backdropFilter: "blur(30px)", color: C.t1, borderRadius: C.rXl, fontFamily: FONT.sans,
        padding: SP.lg, width: "min(85%, 620px)", maxHeight: "85%",
        display: "flex", flexDirection: "column", gap: SP.md,
        boxShadow: C.shLg, zIndex: "200001",
        transition: "transform 0.25s cubic-bezier(0.2,0.9,0.3,1.1)",
    });
    requestAnimationFrame(() => { dialog.style.transform = "translate(-50%, -50%) translateY(0) scale(1)"; });

    const title = document.createElement("div");
    title.innerHTML = `
        <div style="font-size:${FS.xl};font-weight:600;color:${C.t1};letter-spacing:-0.3px;">批量添加</div>
        <div style="color:${C.t3};font-size:${FS.sm};margin-top:${SP.xs};font-family:${FONT.mono};">${editorState.currentDim}/${editorState.currentFile}</div>`;
    dialog.appendChild(title);

    const help = document.createElement("div");
    Object.assign(help.style, {
        color: C.t3, fontSize: FS.sm, background: C.inputBg, padding: `${SP.sm} ${SP.md}`,
        borderRadius: C.rMd, lineHeight: "1.7", border: `0.5px solid ${C.hair}`,
    });
    help.innerHTML = `每行一条词条。可选在行末追加 <code style="color:${C.warn};font-family:${FONT.mono};background:${C.chipBg};padding:2px 6px;border-radius:4px;">||风格1,风格2</code> 指定风格`;
    dialog.appendChild(help);

    const ta = document.createElement("textarea");
    ta.placeholder = "正面拍摄，人物主体清晰||温柔,文艺\n侧面剪影，光影对比强烈||飒爽,清冷";
    Object.assign(ta.style, {
        flex: "1", minHeight: "200px", width: "100%", background: C.inputBg, color: C.t2,
        border: `0.5px solid ${C.hair}`, padding: SP.md, borderRadius: C.rMd,
        fontFamily: FONT.mono, fontSize: FS.sm, boxSizing: "border-box", resize: "vertical", outline: "none",
        transition: "border-color 0.15s", lineHeight: "1.7",
    });
    ta.onfocus = () => { ta.style.borderColor = C.brand; };
    ta.onblur = () => { ta.style.borderColor = C.hair; };
    dialog.appendChild(ta);

    // Default style tags
    const styleBox = document.createElement("div");
    Object.assign(styleBox.style, { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" });
    const styleLabel = document.createElement("span");
    styleLabel.textContent = "默认风格";
    Object.assign(styleLabel.style, { color: C.t3, fontSize: FS.xs, fontWeight: "600", letterSpacing: "0.5px", textTransform: "uppercase", marginRight: SP.xs });
    styleBox.appendChild(styleLabel);
    const defaultTags = [];
    styles.forEach((s) => {
        const tag = document.createElement("span");
        tag.textContent = s;
        Object.assign(tag.style, {
            cursor: "pointer", padding: "4px 12px", borderRadius: C.rLg,
            fontSize: FS.md, fontWeight: "400",
            background: C.chipBg, color: C.t3, transition: "0.1s", userSelect: "none",
        });
        let on = false;
        tag.onclick = () => {
            on = !on;
            if (on) { defaultTags.push(s); tag.style.background = C.brand; tag.style.color = "#fff"; }
            else { const i = defaultTags.indexOf(s); if (i >= 0) defaultTags.splice(i, 1); tag.style.background = C.chipBg; tag.style.color = C.t3; }
        };
        styleBox.appendChild(tag);
    });
    dialog.appendChild(styleBox);

    const btnBox = document.createElement("div");
    Object.assign(btnBox.style, { display: "flex", gap: SP.sm, justifyContent: "flex-end" });
    const cancelBtn = mkBtn("取消", "default", { size: "sm" });
    cancelBtn.onclick = () => dialog.remove();
    const okBtn = mkBtn("添加", "primary", { size: "sm" });
    okBtn.onclick = () => {
        const lines = (ta.value || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
        if (!lines.length) { showToast("请输入至少一行", "warn"); return; }
        let added = 0;
        for (const line of lines) {
            let body, tags = [];
            if (line.includes("||")) {
                const i = line.lastIndexOf("||");
                body = line.slice(0, i).trim();
                const tagStr = line.slice(i + 2).trim();
                tags = tagStr ? tagStr.split(",").map(s => s.trim()).filter(Boolean) : [];
            } else { body = line; }
            for (const t of defaultTags) { if (!tags.includes(t)) tags.push(t); }
            editorState.rows.push({ text: body, tags });
            added++;
        }
        editorState.dirty = true;
        renderTable(overlay);
        scheduleAutoSave(overlay);
        showToast(`已添加 ${added} 条`, "success");
        dialog.remove();
    };
    btnBox.append(cancelBtn, okBtn);
    dialog.appendChild(btnBox);
    overlay.appendChild(dialog);
    ta.focus();
}

async function previewInEditor(overlay) {
    if (!editorState.node) return;
    if (editorState.dirty) {
        if (_autoSaveTimer) { clearTimeout(_autoSaveTimer); _autoSaveTimer = null; }
        await autoSave(overlay);
    }
    const node = editorState.node;
    const widgets = {};
    for (const w of node.widgets || []) { if (w.name) widgets[w.name] = w.value; }
    // 维度开关：值为"开启"/"关闭"的 widget，key 用 widget 原名（与后端 dim["label"] 一致）
    const modules = {};
    for (const w of node.widgets || []) {
        if (w.value === "开启" || w.value === "关闭") modules[w.name] = w.value;
    }
    const body = {
        seed: widgets["随机种子"] ?? -1,
        style: widgets["风格协调"] ?? "不限",
        sep: widgets["段落分隔符"] ?? "。",
        custom_sep: widgets["自定义分隔符"] ?? "",
        modules: modules,
    };
    showToast("试生成中", "info");
    try {
        const res = await fetch("/prompt_randomizer/preview", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const data = await res.json();
        const box = overlay.querySelector(".pr-editor-preview-box");
        box.style.display = "block";
        box.textContent = data.prompt || "";
        showToast("试生成成功", "success");
    } catch (e) { showToast("试生成失败", "error"); console.error("[PR] editor preview:", e); }
}

// ===== 节点按钮注册 =====
function setupNode(node) {
    if (node._buttonsAdded) { attachPathTooltips(node); return; }
    node._buttonsAdded = true;
    node.addWidget("button", "✏️ 词库编辑器", "", function () { openEditor(node); });
    node.addWidget("button", "🎲试生成", "", function () { previewGenerate(node); });
    node.addWidget("button", "全部开启", "", function () { showToast(`已全部开启（${setModuleWidgets(node, "开启")} 项）`, "success"); });
    node.addWidget("button", "全部关闭", "", function () { showToast(`已全部关闭（${setModuleWidgets(node, "关闭")} 项）`, "success"); });
    attachPathTooltips(node);
    node.setDirtyCanvas?.(true);
}

app.registerExtension({
    name: "PromptRandomizer",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (!NODE_NAMES.has(nodeData?.name)) return;
        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated?.apply(this, arguments);
            requestAnimationFrame(() => setupNode(this));
            return r;
        };
    },
});
