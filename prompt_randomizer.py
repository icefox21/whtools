# Copyright (c) 2024-2026 icefox21
# This project is licensed under the GNU General Public License v3.0 (GPL-3.0).
# Project Link: https://github.com/icefox21/whtools
#
# Prompt randomizer functionality derived from ComfyUI-PromptRandomizer.
# Original copyright/licence: Apache License 2.0; see THIRD_PARTY_NOTICES.md
# and THIRD_PARTY_LICENSES/ComfyUI-PromptRandomizer-APACHE-2.0.txt.

import shutil

# -*- coding: utf-8 -*-
import os
import random
import re

# ===== 全局缓存（按文件 mtime 失效，编辑保存即生效）=====
_cached_pools = {}
_cached_mtime = {}
# 风格列表缓存（从 _styles.txt 读取，按 mtime 失效）
_styles_cache = None
_styles_mtime = 0


def get_plugin_dir():
    return os.path.dirname(os.path.abspath(__file__))


def get_pool_dir():
    """Return the shared PromptRandomizer pool location.

    The user's launcher runs ``ComfyUI/main.py`` from ``O:\\ComfyI2I``, so the
    historical pool lives beside the ComfyUI directory. If ComfyUI is launched
    from inside its own directory, prefer that historical sibling when it
    already exists; never silently split an existing pool into a second copy.
    """
    override = os.environ.get('WHTOOLS_PROMPT_POOL_DIR')
    if override:
        return os.path.abspath(override)

    configured = os.environ.get('COMFYUI_BASE')
    if configured:
        return os.path.join(os.path.abspath(configured), 'input', 'prompt_pools')

    cwd = os.path.abspath(os.getcwd())
    if os.path.basename(cwd).lower() == 'comfyui':
        candidates = [os.path.dirname(cwd), cwd]
    else:
        candidates = [cwd]
    for base in candidates:
        pool = os.path.join(base, 'input', 'prompt_pools')
        if os.path.isdir(pool):
            return pool
    return os.path.join(candidates[0], 'input', 'prompt_pools')


def read_sub_content(dim_dir, filename, force_refresh=False):
    """读取某维度文件夹下的子内容 .txt 文件，按 mtime 缓存。
    缓存键为 "dim_dir/filename"，避免跨维度同名文件冲突。
    """
    rel_path = dim_dir + "/" + filename
    filepath = os.path.join(get_pool_dir(), dim_dir, filename)
    if not os.path.exists(filepath):
        return []
    try:
        mtime = os.path.getmtime(filepath)
    except OSError:
        mtime = 0
    if not force_refresh and rel_path in _cached_pools:
        if _cached_mtime.get(rel_path) == mtime:
            return _cached_pools[rel_path]
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except (OSError, UnicodeDecodeError):
        return []
    cleaned = [line.strip() for line in lines if line.strip()]
    _cached_pools[rel_path] = cleaned
    _cached_mtime[rel_path] = mtime
    return cleaned


def clear_cache():
    """清空词库缓存（供前端「重新加载词库」按钮调用）。"""
    _cached_pools.clear()
    _cached_mtime.clear()
    global _styles_cache, _styles_mtime
    _styles_cache = None
    _styles_mtime = 0


def get_rng(seed):
    return random if seed == -1 else random.Random(seed)


# ===== 维度配置（11项，年龄独立控制） =====
# 每个维度对应 input/prompt_pools/ 下的一个独立文件夹；第11项年龄不与人物身份混合
# 文件夹内可放置任意数量的 .txt 子内容文件（按文件名排序后依次抽取）
# 生成时：从该维度文件夹内每个 .txt 文件各随机抽取 1 条，用「，」拼接成该维度文本
# 插件不带预设内容：pools/ 模板仅提供空占位文件，用户自行编辑或新建子内容
DIMENSIONS = [
    {"label": "① 拍摄角度", "dir": "01_拍摄角度"},
    {"label": "② 光影色调", "dir": "02_光影色调"},
    {"label": "③ 人物维度", "dir": "03_人物维度"},
    {"label": "④ 发型",     "dir": "04_发型"},
    {"label": "⑤ 妆容",     "dir": "05_妆容"},
    {"label": "⑥ 表情",     "dir": "06_表情"},
    {"label": "⑦ 服装",     "dir": "07_服装"},
    {"label": "⑧ 姿态",     "dir": "08_姿态"},
    {"label": "⑨ 背景",     "dir": "09_背景"},
    {"label": "⑩ 构图",     "dir": "10_构图"},
    {"label": "⑪ 年龄",     "dir": "11_年龄"},
]

# 风格默认列表（_styles.txt 不存在时回退使用）
_DEFAULT_STYLES = ["温柔", "飒爽", "性感", "文艺", "校园", "清冷", "热烈"]


def get_styles_file():
    """返回工作目录下的 _styles.txt 路径。"""
    return os.path.join(get_pool_dir(), "_styles.txt")


def get_styles():
    """返回当前可用风格列表（从 _styles.txt 动态读取，按 mtime 缓存）。
    文件不存在时回退到 _DEFAULT_STYLES。
    """
    global _styles_cache, _styles_mtime
    filepath = get_styles_file()
    if not os.path.exists(filepath):
        return list(_DEFAULT_STYLES)
    try:
        mtime = os.path.getmtime(filepath)
    except OSError:
        mtime = 0
    if _styles_cache is not None and _styles_mtime == mtime:
        return list(_styles_cache)
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            styles = [line.strip() for line in f if line.strip()]
    except (OSError, UnicodeDecodeError):
        return list(_DEFAULT_STYLES)
    _styles_cache = styles
    _styles_mtime = mtime
    return list(styles)


def _write_styles(styles):
    """把风格列表写回 _styles.txt（UTF-8 无 BOM），并更新缓存。"""
    global _styles_cache, _styles_mtime
    pool_dir = get_pool_dir()
    if not os.path.exists(pool_dir):
        os.makedirs(pool_dir, exist_ok=True)
    filepath = os.path.join(pool_dir, "_styles.txt")
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(styles) + "\n")
    try:
        _styles_mtime = os.path.getmtime(filepath)
    except OSError:
        _styles_mtime = 0
    _styles_cache = list(styles)


def add_style(name):
    """添加一个风格。已存在则返回 False。"""
    name = (name or "").strip()
    if not name:
        return False, "风格名不能为空"
    styles = get_styles()
    if name in styles:
        return False, "风格已存在"
    styles.append(name)
    _write_styles(styles)
    return True, None


def delete_style(name):
    """删除一个风格。不存在则返回 False。"""
    name = (name or "").strip()
    styles = get_styles()
    if name not in styles:
        return False, "风格不存在"
    styles = [s for s in styles if s != name]
    _write_styles(styles)
    return True, None


def count_han(text):
    """统计汉字数（不含标点、空白、英文字母、数字、换行）。"""
    if not text:
        return 0
    n = 0
    for ch in text:
        cp = ord(ch)
        if (0x4E00 <= cp <= 0x9FFF) or (0x3400 <= cp <= 0x4DBF) or (0xF900 <= cp <= 0xFAFF):
            n += 1
    return n


def filter_by_style(pool, style):
    """按风格过滤词条池。
    - style 为 None（不限）：返回所有词条，但剥离风格标签（输出不含 ||...）。
    - style 为指定风格：保留带该标签的 + 未标注风格的通用词条；排除明确标注其他风格的。
      无匹配时返回空列表，由调用方跳过（不影响其他维度/子内容）。
    词条格式：正文||风格1,风格2
    """
    if not pool:
        return pool
    bodies = []
    tagged = []
    for line in pool:
        if "||" in line:
            body, _, tags = line.rpartition("||")
            body = body if body else line
            tag_set = {t.strip() for t in tags.split(",") if t.strip()}
            bodies.append(body)
            tagged.append((body, tag_set))
        else:
            bodies.append(line)
            tagged.append((line, set()))
    if style is None:
        return bodies
    # 带该风格的 + 未标注的通用词条参与；明确标注其他风格的排除
    return [b for b, ts in tagged if not ts or style in ts]


def clean_separators(text):
    """清理因抽取置空产生的多余分隔符。"""
    if not text:
        return text
    while "，，" in text:
        text = text.replace("，，", "，")
    while ",," in text:
        text = text.replace(",,", ",")
    for lead in ("，", ","):
        while text.startswith(lead):
            text = text[len(lead):]
    return text.rstrip()


def build_dimension(dim, rng, style=None):
    """构造一个维度的文本：从该维度文件夹内每个 .txt 子内容文件各抽 1 条，用「，」拼接。
    容错：某子内容文件缺失或为空则跳过，不影响其余子内容。
    """
    dim_path = os.path.join(get_pool_dir(), dim["dir"])
    if not os.path.isdir(dim_path):
        return ""
    txt_files = sorted([f for f in os.listdir(dim_path) if f.lower().endswith(".txt")])
    picks = []
    for filename in txt_files:
        pool = filter_by_style(read_sub_content(dim["dir"], filename), style)
        if pool:
            picks.append(rng.choice(pool))
    if not picks:
        return ""
    return clean_separators("，".join(picks))


def build_age_segment(modules, rng):
    """第11项年龄：开关开启 → 随机抽 26 岁以内；关闭 → 不输出年龄。"""
    if modules.get("⑪ 年龄", "开启") == "关闭":
        return ""
    pool = []
    for line in read_sub_content("11_年龄", "年龄.txt"):
        body = line.split("||", 1)[0].strip()
        m = re.match(r"^(\d+)", body)
        if m and int(m.group(1)) <= 26:
            pool.append(body)
    return rng.choice(pool) if pool else ""


def generate_preview(seed=-1, style="不限", sep_mode="。", custom_sep="", modules=None):
    """供后端 /prompt_randomizer/preview 接口调用，无需节点实例即可试生成。
    返回 dict：{prompt, count, empty, segments}。
    """
    if sep_mode == "换行":
        sep = "\n"
    elif sep_mode == "自定义":
        sep = custom_sep
    else:
        sep = sep_mode

    rng = get_rng(seed)
    style_real = None if style in ("不限", "关闭", "") else style
    modules = modules or {}

    segments = []
    # 第11项：开关开启 → 随机 26 岁以内，放在提示词最前边
    age = build_age_segment(modules, rng)
    if age:
        segments.append(age)
    for dim in DIMENSIONS:
        if dim["dir"] == "11_年龄":
            continue
        if modules.get(dim["label"], "开启") == "关闭":
            continue
        text = build_dimension(dim, rng, style=style_real)
        if text:
            segments.append(text)

    if not segments:
        default_text = "默认人像，中性自然光线，适中构图，人物主体清晰"
        return {
            "prompt": default_text,
            "count": count_han(default_text),
            "empty": True,
            "segments": [],
        }
    prompt = sep.join(segments)
    return {
        "prompt": prompt,
        "count": count_han(prompt),
        "empty": False,
        "segments": segments,
    }


# ===== 词库编辑器：解析与序列化 =====
_ORDER_FILE = "_order.json"


def get_dim_order(dim):
    """读取某维度的自定义文件顺序（_order.json）。返回文件名列表。
    文件不存在或损坏时返回空列表（调用方按字母序兜底）。
    """
    import json
    order_path = os.path.join(get_pool_dir(), dim, _ORDER_FILE)
    try:
        with open(order_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return [str(x) for x in data if isinstance(x, str)]
    except (OSError, ValueError, TypeError):
        pass
    return []


def save_dim_order(dim, order):
    """保存某维度的自定义文件顺序到 _order.json。"""
    import json
    pool_dir = get_pool_dir()
    dim_path = os.path.join(pool_dir, dim)
    if not os.path.exists(dim_path):
        os.makedirs(dim_path, exist_ok=True)
    order_path = os.path.join(dim_path, _ORDER_FILE)
    clean = [str(x) for x in order if isinstance(x, str) and x]
    with open(order_path, "w", encoding="utf-8") as f:
        json.dump(clean, f, ensure_ascii=False, indent=2)
    return order_path


def get_dimensions_meta():
    """返回各维度文件夹及其子内容文件的结构信息（供前端编辑器展示）。
    文件顺序：优先按 _order.json 自定义顺序，未记录的按字母序追加到末尾。
    """
    pool_dir = get_pool_dir()
    meta = []
    for dim in DIMENSIONS:
        dim_path = os.path.join(pool_dir, dim["dir"])
        files = []
        if os.path.isdir(dim_path):
            all_txt = [f for f in os.listdir(dim_path)
                       if f.lower().endswith(".txt") and os.path.isfile(os.path.join(dim_path, f))]
            order = get_dim_order(dim["dir"])
            ordered = []
            seen = set()
            for name in order:
                if name in all_txt and name not in seen:
                    seen.add(name)
                    ordered.append(name)
            for name in sorted(all_txt):
                if name not in seen:
                    ordered.append(name)
            # 自动补全 _order.json：缺失/不完整/含已删除文件时写入最新顺序
            if ordered != order:
                save_dim_order(dim["dir"], ordered)
            for name in ordered:
                cnt = len(read_sub_content(dim["dir"], name))
                files.append({"file": name, "count": cnt, "exists": True})
        meta.append({
            "label": dim["label"],
            "dir": dim["dir"],
            "exists": os.path.isdir(dim_path),
            "files": files,
        })
    return meta


def reorder_sub_content(dim, order):
    """更新某维度文件夹下子内容文件的顺序（写入 _order.json）。"""
    pool_dir = get_pool_dir()
    dim_path = os.path.join(pool_dir, dim)
    if not os.path.isdir(dim_path):
        return False
    all_txt = [f for f in os.listdir(dim_path)
               if f.lower().endswith(".txt") and os.path.isfile(os.path.join(dim_path, f))]
    clean = [f for f in order if f in all_txt]
    for name in all_txt:
        if name not in clean:
            clean.append(name)
    save_dim_order(dim, clean)
    return True


def parse_sub_content(dim, filename):
    """解析子内容文件为结构化行：[{text, tags}]。
    每行格式：正文||风格1,风格2（||部分可选）
    """
    pool = read_sub_content(dim, filename, force_refresh=True)
    rows = []
    for line in pool:
        if "||" in line:
            body, _, tags_str = line.rpartition("||")
            tags = [t.strip() for t in tags_str.split(",") if t.strip()]
        else:
            body, tags = line, []
        rows.append({"text": body, "tags": tags})
    return {"dim": dim, "file": filename, "rows": rows}


def serialize_sub_content(rows):
    """把结构化行序列化为文件文本（每行 正文||风格1,风格2，末尾保留换行）。"""
    lines = []
    for row in rows:
        body = row.get("text", "")
        tags = [t for t in (row.get("tags", []) or []) if t]
        line = body + ("||" + ",".join(tags) if tags else "")
        lines.append(line)
    return "\n".join(lines) + "\n"


def write_sub_content(dim, filename, content):
    """把内容写回子内容文件（UTF-8 无 BOM），备份原文件并清缓存。"""
    pool_dir = get_pool_dir()
    dim_path = os.path.join(pool_dir, dim)
    if not os.path.exists(dim_path):
        os.makedirs(dim_path, exist_ok=True)
    filepath = os.path.join(dim_path, filename)
    if os.path.exists(filepath):
        try:
            import shutil
            shutil.copy2(filepath, filepath + ".bak")
        except OSError:
            pass
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(content)
    rel_path = dim + "/" + filename
    _cached_pools.pop(rel_path, None)
    _cached_mtime.pop(rel_path, None)
    return filepath


def create_sub_content(dim, filename):
    """在维度文件夹下创建空子内容文件，并追加到 _order.json 末尾。
    返回 (filepath, created)。
    """
    pool_dir = get_pool_dir()
    dim_path = os.path.join(pool_dir, dim)
    if not os.path.exists(dim_path):
        os.makedirs(dim_path, exist_ok=True)
    filepath = os.path.join(dim_path, filename)
    if os.path.exists(filepath):
        return filepath, False
    with open(filepath, "w", encoding="utf-8") as f:
        f.write("")
    # 追加到顺序末尾，保证新建内容排在已有子内容下面
    try:
        order = get_dim_order(dim)
        # 先把目录下已有文件补进 order（保持新建的排在最后）
        all_txt = [f for f in os.listdir(dim_path)
                   if f.lower().endswith(".txt") and os.path.isfile(os.path.join(dim_path, f)) and f != filename]
        for name in sorted(all_txt):
            if name not in order:
                order.append(name)
        if filename not in order:
            order.append(filename)
        save_dim_order(dim, order)
    except OSError:
        pass
    return filepath, True


def delete_sub_content(dim, filename):
    """删除维度文件夹下的子内容文件，并从 _order.json 中移除。成功返回 True。"""
    pool_dir = get_pool_dir()
    filepath = os.path.join(pool_dir, dim, filename)
    if not os.path.exists(filepath):
        return False
    try:
        os.remove(filepath)
    except OSError:
        return False
    rel_path = dim + "/" + filename
    _cached_pools.pop(rel_path, None)
    _cached_mtime.pop(rel_path, None)
    # 从顺序记录中移除
    try:
        order = get_dim_order(dim)
        if filename in order:
            order = [f for f in order if f != filename]
            save_dim_order(dim, order)
    except OSError:
        pass
    return True


class PromptRandomizer:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "随机种子": ("INT", {"default": -1, "min": -1, "max": 9007199254740991, "control_after_generate": True}),
                "风格协调": (["不限"] + get_styles(), {"default": "不限"}),
                "段落分隔符": (["。", "，", "换行", "自定义"], {"default": "。"}),
                "自定义分隔符": ("STRING", {"default": "", "multiline": False}),
                **{dim["label"]: (["开启", "关闭"], {"default": "开启"}) for dim in DIMENSIONS},
            },
        }

    RETURN_TYPES = ("STRING", "INT")
    RETURN_NAMES = ("提示词", "字数")
    FUNCTION = "generate"
    CATEGORY = "utils"
    OUTPUT_NODE = True

    def generate(self, 随机种子, 段落分隔符, 自定义分隔符, **kwargs):
        if 段落分隔符 == "换行":
            sep = "\n"
        elif 段落分隔符 == "自定义":
            sep = 自定义分隔符
        else:
            sep = 段落分隔符

        rng = get_rng(随机种子)
        style = kwargs.get("风格协调", "不限")
        style = None if style in ("不限", "关闭", "") else style

        segments = []
        # 第11项：开关开启 → 随机 26 岁以内，放在提示词最前边
        age = build_age_segment(kwargs, rng)
        if age:
            segments.append(age)
        for dim in DIMENSIONS:
            if dim["dir"] == "11_年龄":
                continue
            if kwargs.get(dim["label"], "关闭") == "关闭":
                continue
            text = build_dimension(dim, rng, style=style)
            if text:
                segments.append(text)

        if not segments:
            default_text = "默认人像，中性自然光线，适中构图，人物主体清晰"
            return (default_text, count_han(default_text))

        prompt = sep.join(segments)
        return (prompt, count_han(prompt))

def ensure_pool_files():
    """补全缺失词库：将插件 pools/ 模板目录的文件夹结构复制到工作目录。
    已存在的绝不覆盖，仅创建缺失的文件夹和文件（空占位 .txt）。
    首次补全后写入 .initialized 标记：之后启动不再自动补全，以保留用户在编辑器里的删除/修改。
    返回 (created, existed) 列表，元素为相对路径（如 "01_拍摄角度/角度.txt"）。
    """
    pool_dir = get_pool_dir()
    src_dir = os.path.join(get_plugin_dir(), "prompt_randomizer_pools")
    sentinel = os.path.join(pool_dir, ".initialized")

    created, existed = [], []

    if not os.path.exists(pool_dir):
        os.makedirs(pool_dir, exist_ok=True)

    # 判断是否已初始化：有 .initialized 标记，或工作目录已有任何内容（兼容老用户，避免重启复活已删文件）
    has_content = False
    try:
        with os.scandir(pool_dir) as it:
            has_content = any(it)
    except OSError:
        has_content = False

    if os.path.exists(sentinel) or has_content:
        # 老用户首次升级到本版本：补写标记但不复制，尊重其现有的删除/修改
        if not os.path.exists(sentinel):
            try:
                with open(sentinel, "w", encoding="utf-8") as f:
                    f.write("initialized\n")
            except OSError:
                pass
        print(f"[提示词] 词库目录: {pool_dir}（已初始化，跳过自动补全；如需恢复默认可点「补全缺失词库」按钮，或删除整个 prompt_pools 目录后重启）")
        return created, existed

    if not os.path.isdir(src_dir):
        print(f"[提示词] 模板目录不存在: {src_dir}（首次安装或模板被移除，跳过补全）")
        return created, existed

    for root, dirs, files in os.walk(src_dir):
        rel_root = os.path.relpath(root, src_dir)
        dst_root = pool_dir if rel_root == "." else os.path.join(pool_dir, rel_root)
        if not os.path.exists(dst_root):
            os.makedirs(dst_root, exist_ok=True)
        for filename in files:
            dst_file = os.path.join(dst_root, filename)
            rel_path = os.path.relpath(dst_file, pool_dir).replace("\\", "/")
            if os.path.exists(dst_file):
                existed.append(rel_path)
            else:
                src_file = os.path.join(root, filename)
                shutil.copy2(src_file, dst_file)
                created.append(rel_path)

    # 写入初始化标记，后续启动不再自动补全
    try:
        with open(sentinel, "w", encoding="utf-8") as f:
            f.write("initialized\n")
    except OSError:
        pass

    print(f"[提示词] 词库目录: {pool_dir}")
    print(f"[提示词] 已存在 {len(existed)} 个，已补全 {len(created)} 个")
    return created, existed


ensure_pool_files()


# ===== 后端接口：供前端按钮调用 =====
try:
    from server import PromptServer
    from aiohttp import web

    # 维度文件夹名集合（用于校验，防止路径穿越）
    _DIM_DIRS = {dim["dir"] for dim in DIMENSIONS}

    def _safe_filename(name):
        """安全校验文件名：禁止路径穿越，仅允许 .txt 文件名（不含子目录）。"""
        if not name or not isinstance(name, str):
            return None
        norm = os.path.normpath(name).replace("\\", "/")
        if "/" in norm or "\\" in norm or norm.startswith("..") or os.path.isabs(name):
            return None
        if not norm.lower().endswith(".txt"):
            return None
        return norm

    def _safe_dim(dim):
        """校验维度文件夹名：必须在 DIMENSIONS 注册列表中。"""
        if not dim or not isinstance(dim, str):
            return None
        return dim if dim in _DIM_DIRS else None

    @PromptServer.instance.routes.get("/prompt_randomizer/pool_dir")
    async def _pr_pool_dir(request):
        return web.json_response({"pool_dir": get_pool_dir()})

    @PromptServer.instance.routes.post("/prompt_randomizer/refresh_pools")
    async def _pr_refresh_pools(request):
        # 清空词库缓存，下次生成即重新读取磁盘（用于编辑词库后立即生效）
        clear_cache()
        return web.json_response({"ok": True})

    @PromptServer.instance.routes.post("/prompt_randomizer/preview")
    async def _pr_preview(request):
        # 试生成：读取前端传入的当前控件值，调用 generate_preview 返回样本
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            seed = int(data.get("seed", -1))
        except (TypeError, ValueError):
            seed = -1
        style = data.get("style", "不限") or "不限"
        sep_mode = data.get("sep", "。") or "。"
        custom_sep = data.get("custom_sep", "") or ""
        modules = data.get("modules", {}) or {}
        result = generate_preview(
            seed=seed,
            style=style,
            sep_mode=sep_mode,
            custom_sep=custom_sep,
            modules=modules,
        )
        return web.json_response(result)

    # ===== 词库编辑器接口 =====
    @PromptServer.instance.routes.get("/prompt_randomizer/editor/meta")
    async def _pr_editor_meta(request):
        """返回维度结构 + 风格集合 + 词库目录。"""
        return web.json_response({
            "pool_dir": get_pool_dir(),
            "dimensions": get_dimensions_meta(),
            "styles": get_styles(),
        })

    @PromptServer.instance.routes.get("/prompt_randomizer/editor/get")
    async def _pr_editor_get(request):
        """解析单个子内容文件为结构化行。参数：dim, file。"""
        dim = request.query.get("dim", "")
        filename = request.query.get("file", "")
        safe_dim = _safe_dim(dim)
        safe_file = _safe_filename(filename)
        if not safe_dim or not safe_file:
            return web.json_response({"error": "invalid dim or file"}, status=400)
        parsed = parse_sub_content(safe_dim, safe_file)
        return web.json_response(parsed)

    @PromptServer.instance.routes.post("/prompt_randomizer/editor/save")
    async def _pr_editor_save(request):
        """保存子内容文件。Body: {dim, file, rows}。"""
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "invalid json"}, status=400)
        dim = _safe_dim(data.get("dim", ""))
        filename = _safe_filename(data.get("file", ""))
        if not dim or not filename:
            return web.json_response({"error": "invalid dim or file"}, status=400)
        rows = data.get("rows", [])
        if not isinstance(rows, list):
            return web.json_response({"error": "rows must be a list"}, status=400)
        content = serialize_sub_content(rows)
        filepath = write_sub_content(dim, filename, content)
        return web.json_response({
            "ok": True,
            "dim": dim,
            "file": filename,
            "count": len(rows),
            "path": filepath,
        })

    @PromptServer.instance.routes.post("/prompt_randomizer/editor/create_file")
    async def _pr_editor_create_file(request):
        """在维度文件夹下创建空子内容文件。Body: {dim, file}。"""
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "invalid json"}, status=400)
        dim = _safe_dim(data.get("dim", ""))
        filename = _safe_filename(data.get("file", ""))
        if not dim or not filename:
            return web.json_response({"error": "invalid dim or file"}, status=400)
        filepath, created = create_sub_content(dim, filename)
        return web.json_response({
            "ok": True,
            "dim": dim,
            "file": filename,
            "created": created,
            "path": filepath,
        })

    @PromptServer.instance.routes.post("/prompt_randomizer/editor/delete_file")
    async def _pr_editor_delete_file(request):
        """删除维度文件夹下的子内容文件。Body: {dim, file}。"""
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "invalid json"}, status=400)
        dim = _safe_dim(data.get("dim", ""))
        filename = _safe_filename(data.get("file", ""))
        if not dim or not filename:
            return web.json_response({"error": "invalid dim or file"}, status=400)
        ok = delete_sub_content(dim, filename)
        return web.json_response({"ok": ok, "dim": dim, "file": filename})

    @PromptServer.instance.routes.post("/prompt_randomizer/editor/reorder")
    async def _pr_editor_reorder(request):
        """调整某维度下子内容文件的顺序。Body: {dim, order:[file1, file2, ...]}。"""
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "invalid json"}, status=400)
        dim = _safe_dim(data.get("dim", ""))
        order = data.get("order", [])
        if not isinstance(order, list):
            return web.json_response({"error": "order 必须是数组"}, status=400)
        if not dim:
            return web.json_response({"error": "invalid dim"}, status=400)
        # 校验每个文件名
        clean = []
        for f in order:
            fn = _safe_filename(f)
            if fn:
                clean.append(fn)
        ok = reorder_sub_content(dim, clean)
        return web.json_response({"ok": ok, "dim": dim, "order": clean})

    # ===== 风格管理接口 =====
    @PromptServer.instance.routes.get("/prompt_randomizer/styles/list")
    async def _pr_styles_list(request):
        """返回当前风格列表和 _styles.txt 路径。"""
        return web.json_response({
            "styles": get_styles(),
            "path": get_styles_file(),
        })

    @PromptServer.instance.routes.post("/prompt_randomizer/styles/add")
    async def _pr_styles_add(request):
        """添加风格。Body: {name}。"""
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "invalid json"}, status=400)
        name = (data.get("name", "") or "").strip()
        if not name:
            return web.json_response({"error": "风格名不能为空"}, status=400)
        ok, err = add_style(name)
        if not ok:
            return web.json_response({"error": err or "添加失败"}, status=400)
        return web.json_response({"ok": True, "styles": get_styles()})

    @PromptServer.instance.routes.post("/prompt_randomizer/styles/delete")
    async def _pr_styles_delete(request):
        """删除风格。Body: {name}。"""
        try:
            data = await request.json()
        except Exception:
            return web.json_response({"error": "invalid json"}, status=400)
        name = (data.get("name", "") or "").strip()
        if not name:
            return web.json_response({"error": "风格名不能为空"}, status=400)
        ok, err = delete_style(name)
        if not ok:
            return web.json_response({"error": err or "删除失败"}, status=400)
        return web.json_response({"ok": True, "styles": get_styles()})

except Exception as e:  # noqa
    print(f"[提示词] 后端接口注册失败（不影响节点使用）: {e}")

class WuhuoPromptRandomizer(PromptRandomizer):
    """WHTools-owned prompt randomizer, retaining the old workflow contract."""
    CATEGORY = "wuhuo/提示词"


# Keep PromptRandomizer as an alias so existing workflow JSON continues to load.
NODE_CLASS_MAPPINGS = {
    "WuhuoPromptRandomizer": WuhuoPromptRandomizer,
    "PromptRandomizer": WuhuoPromptRandomizer,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "WuhuoPromptRandomizer": "🔀 提示词随机生成器+",
    "PromptRandomizer": "🔀 提示词随机生成器  v2.0",
}
