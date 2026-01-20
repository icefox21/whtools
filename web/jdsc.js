(() => {
  const KEY_FAVS = "jdsc:favorites";
  const KEY_GROUPS = "jdsc:groups";
  const KEY_FRAGS = "jdsc:frags";
  const KEY_HOTKEY = "jdsc:hotkey";
  const KEY_MODAL_POS = "jdsc:modalPos";
  const KEY_FLOAT_POS = "jdsc:floatPos";
  const KEY_LANG = "jdsc:lang";
  const JDSC_VERSION = "2025-11-23-01";
  let NODE_CACHE = null;
  let SETTINGS_LOADED = false;  // 标志：设置是否已从服务器加载完成

  let FAVS_CACHE = null;
  async function syncFavsFromServer() {
    try {
      const res = await fetch('/jdsc/favorites');
      if (res && res.ok) { const data = await res.json(); FAVS_CACHE = (data && typeof data === 'object') ? data : {}; }
    } catch { }
  }
  function load(key, def) {
    try {
      if (key === KEY_FAVS) { if (FAVS_CACHE && typeof FAVS_CACHE === 'object') return FAVS_CACHE; }
      if (String(key || '').startsWith('jdsc:')) {
        const cache = (window.__jdsc_settings_cache || {});
        if (Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
      }
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : def;
    } catch {
      return def;
    }
  }

  function getFavs() {
    let favs = load(KEY_FAVS, {});
    if (Array.isArray(favs)) {
      const obj = {};
      favs.forEach(t => obj[t] = { name: t, orig: t });
      save(KEY_FAVS, obj);
      favs = obj;
    }
    if (!favs || typeof favs !== "object") {
      favs = {};
      save(KEY_FAVS, favs);
    }
    return favs;
  }

  function getGroups() {
    let groups = load(KEY_GROUPS, []);
    if (!Array.isArray(groups)) {
      groups = [];
      save(KEY_GROUPS, groups);
    }
    return groups;
  }

  let FRAGS_CACHE = null;
  async function syncFragsFromServer() {
    try { const res = await fetch('/jdsc/frags'); if (res && res.ok) { const data = await res.json(); FRAGS_CACHE = Array.isArray(data) ? data : []; } } catch { }
  }
  function getFrags() {
    let frags = (FRAGS_CACHE !== null ? FRAGS_CACHE : load(KEY_FRAGS, []));
    if (!Array.isArray(frags)) {
      frags = [];
      save(KEY_FRAGS, frags);
    }
    return frags;
  }

  const KEY_ADD_STYLE = "jdsc:addStyle";
  const KEY_LAST_ANCHOR = "jdsc:lastAnchor";
  const KEY_STRICT_FAV_POS = "jdsc:strictFavPos";
  const KEY_UI_ANCHOR = "jdsc:uiAnchor";

  function save(key, val) {
    if (key === KEY_FAVS) {
      try { FAVS_CACHE = (val && typeof val === 'object') ? val : {}; fetch('/jdsc/favorites', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(FAVS_CACHE) }); } catch { }
      return;
    }
    if (key === KEY_FRAGS) {
      try { FRAGS_CACHE = Array.isArray(val) ? val : []; fetch('/jdsc/frags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(FRAGS_CACHE) }); } catch { }
      return;
    }
    if (String(key || '').startsWith('jdsc:')) {
      try {
        // 如果设置还没加载完成，不允许保存（防止覆盖丢失数据）
        if (!SETTINGS_LOADED) {
          console.warn('[whtools] 设置尚未加载完成，跳过保存:', key);
          return;
        }
        window.__jdsc_settings_cache = window.__jdsc_settings_cache || {};
        window.__jdsc_settings_cache[key] = val;
        fetch('/jdsc/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(window.__jdsc_settings_cache) });
      } catch { }
      return;
    }
    localStorage.setItem(key, JSON.stringify(val));
  }

  function getSetting(key, def) {
    try {
      const cache = (window.__jdsc_settings_cache || {});
      if (cache && Object.prototype.hasOwnProperty.call(cache, key)) return cache[key];
      const s = localStorage.getItem(key);
      return s ? JSON.parse(s) : def;
    } catch { return def; }
  }
  function setSetting(key, val) {
    try { save(key, val); } catch { }
  }

  function showVersionBanner() {
    try {
      if (document.querySelector('.jdsc-version-banner')) return;
      const wrap = document.createElement('div');
      wrap.className = 'jdsc-version-banner';
      wrap.style.position = 'fixed'; wrap.style.right = '80px'; wrap.style.bottom = '120px'; wrap.style.zIndex = '10000';
      wrap.style.background = '#faad14'; wrap.style.color = '#000'; wrap.style.padding = '12px 14px'; wrap.style.borderRadius = '8px'; wrap.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)'; wrap.style.fontSize = '13px';
      const msg = document.createElement('div'); msg.textContent = (getLang() === 'en' ? 'Detected new whtools front-end version. If changes are not visible, try force refresh.' : '检测到 whtools 前端版本已更新。如果仍看不到变化，可尝试强制刷新');
      const btns = document.createElement('div'); btns.style.marginTop = '8px'; btns.style.display = 'flex'; btns.style.gap = '8px';
      const btnRefresh = document.createElement('button'); btnRefresh.textContent = (getLang() === 'en' ? 'Force refresh' : '强制刷新'); btnRefresh.style.cursor = 'pointer'; btnRefresh.style.padding = '6px 10px'; btnRefresh.style.border = 'none'; btnRefresh.style.borderRadius = '6px'; btnRefresh.style.background = '#52c41a'; btnRefresh.style.color = '#fff';
      const btnKnow = document.createElement('button'); btnKnow.textContent = (getLang() === 'en' ? 'Got it' : '知道了'); btnKnow.style.cursor = 'pointer'; btnKnow.style.padding = '6px 10px'; btnKnow.style.border = 'none'; btnKnow.style.borderRadius = '6px'; btnKnow.style.background = '#1677ff'; btnKnow.style.color = '#fff';
      btnRefresh.onclick = () => {
        try {
          const clearCaches = () => (window.caches && window.caches.keys ? window.caches.keys().then(keys => Promise.all(keys.map(k => window.caches.delete(k)))) : Promise.resolve());
          clearCaches().finally(() => {
            try { const u = new URL(window.location.href); u.searchParams.set('v', String(Date.now())); window.location.replace(u.toString()); } catch { window.location.reload(true); }
          });
        } catch { window.location.reload(true); }
      };
      btnKnow.onclick = () => { try { setSetting('jdsc:version_seen', JDSC_VERSION); wrap.remove(); } catch { wrap.remove(); } };
      btns.appendChild(btnRefresh); btns.appendChild(btnKnow);
      wrap.appendChild(msg); wrap.appendChild(btns);
      document.body.appendChild(wrap);
    } catch { }
  }
  function verifyVersion() {
    try { const seen = getSetting('jdsc:version_seen', null); if (seen !== JDSC_VERSION) showVersionBanner(); } catch { }
  }

  function getStrictFavPos(type) {
    try {
      const map = load(KEY_STRICT_FAV_POS, {});
      const p = map && map[type];
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return { x: Math.round(p.x), y: Math.round(p.y) };
      return null;
    } catch { return null; }
  }
  function saveStrictFavPos(type, pos) {
    try {
      const map = load(KEY_STRICT_FAV_POS, {});
      map[type] = { x: Math.round(pos.x || 0), y: Math.round(pos.y || 0) };
      save(KEY_STRICT_FAV_POS, map);
    } catch { }
  }
  function getUiAnchor() {
    try {
      const cache = (window.__jdsc_settings_cache || {});
      const p = cache[KEY_UI_ANCHOR] || load(KEY_UI_ANCHOR, null);
      if (p && typeof p.x === 'number' && typeof p.y === 'number') return { x: Math.round(p.x), y: Math.round(p.y) };
      return null;
    } catch { return null; }
  }

  function getAllNodeDefs() {
    if (NODE_CACHE) return NODE_CACHE;
    const reg = window.LiteGraph && window.LiteGraph.registered_node_types || {};
    const types = Object.keys(reg);
    NODE_CACHE = types.map(t => {
      const def = reg[t] || {};
      const name = def.title || def.title_text || (t.split("/").pop() || t);
      const desc = def.description || "";
      const segs = String(t).split("/");
      const typeProj = segs.length > 1 ? segs[0] : "";
      const typeBranch = segs.length > 2 ? segs.slice(1, segs.length - 1).join("/") : (segs.length === 2 ? segs[0] : "");
      const catRaw = (def.category || (def.prototype && def.prototype.category) || def.__category || "");
      const catParts = Array.isArray(catRaw) ? catRaw : String(catRaw).split("/").filter(Boolean);
      const proj = catParts[0] || typeProj || "";
      const branch = catParts.slice(1).join("/") || typeBranch || "";
      const pathText = proj + (branch ? "/" + branch : "");
      const base = (name + " " + t + " " + desc + " " + pathText).toLowerCase();
      const search = base;
      const searchCJK = base.replace(/[\s_\-\/\\]+/g, "");
      const searchAlt = base.replace(/l/g, "i").replace(/\u006C/g, "i");
      const searchSlug = base.replace(/[^a-z0-9]+/g, "");
      return { type: t, name, desc, search, searchAlt, searchSlug, searchCJK, category: branch, project: proj };
    });
    return NODE_CACHE;
  }

  function warmNodesCache() {
    try { getAllNodeDefs(); } catch (e) { }
  }

  function createEl(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function ensureStyles() {
    if (document.getElementById("jdsc-styles")) return;
    const style = createEl("style");
    style.id = "jdsc-styles";
    style.textContent = `
      .jdsc-floating-group { position: fixed; right: 16px; bottom: 16px; display: flex; gap: 8px; z-index: 10000; }
      .jdsc-floating { width: 38px; height: 38px; border-radius: 19px; background: #fa3d64; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: grab; box-shadow: 0 6px 16px rgba(0,0,0,.3); transition: transform 0.2s; }
      .jdsc-floating:hover { transform: scale(1.1); }
      .jdsc-floating:active { cursor: grabbing; }
      .jdsc-floating-workflow { background: #1677ff; }
      
      .jdsc-modal { 
        position: fixed; 
        width: 460px; 
        max-height: 75vh; 
        background: #111316; 
        color: #e6e9ec; 
        border-radius: 12px; 
        box-shadow: 0 24px 64px rgba(0,0,0,.5); 
        overflow: hidden; 
        z-index: 9999; 
        display: flex; 
        flex-direction: column; 
        user-select: none; 
        border: 1px solid #3a3f44;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      
      .jdsc-header { 
        display: flex; 
        align-items: center; 
        padding: 0 12px; 
        height: 36px;
        border-bottom: 1px solid #3a3f44; 
        flex-shrink: 0; 
        background: linear-gradient(135deg, #1a1d21 0%, #2a2e32 100%); 
        position: relative;
      }
      .jdsc-header::before {
        content: "";
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 2px;
        background: linear-gradient(90deg, #fa3d64, #ff7875);
      }
      .jdsc-modal-workflow .jdsc-header::before {
        background: linear-gradient(90deg, #1677ff, #52c41a);
      }
      
      .jdsc-title { font-size: 15px; font-weight: 600; flex: 1; letter-spacing: 0.5px; }
      
      .jdsc-close, .jdsc-lang { 
        width: 24px; 
        height: 24px; 
        border-radius: 4px; 
        background: rgba(255,255,255,0.05); 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer; 
        transition: all 0.2s;
        color: #8a9199;
        font-size: 12px;
      }
      .jdsc-close:hover { background: rgba(255, 77, 79, 0.1); color: #ff4d4f; }
      .jdsc-lang:hover { background: rgba(255, 255, 255, 0.1); color: #fff; }
      .jdsc-lang { margin-right: 8px; }
      
      .jdsc-grid { display: flex; gap: 8px; width: 100%; box-sizing: border-box; }
      .jdsc-col { flex: 1; min-width: 0; display: flex; flex-direction: column; }

      .jdsc-tabs { display: flex; gap: 4px; padding: 8px 12px 0 12px; background: #0d0f12; flex-shrink: 0; }
      .jdsc-tab { 
        flex: 1; 
        text-align: center; 
        padding: 6px 10px; 
        border-radius: 6px 6px 0 0; 
        cursor: pointer; 
        background: transparent; 
        color: #8a9199; 
        font-size: 12px;
        font-weight: 500;
        transition: all 0.2s;
      }
      .jdsc-tab:hover { color: #e6e9ec; background: rgba(255,255,255,0.05); }
      .jdsc-tab.active { 
        background: #1a1d21; 
        color: #fa3d64; 
        font-weight: 600;
        border: 1px solid #3a3f44;
        border-bottom: none;
      }
      .jdsc-modal-workflow .jdsc-tab.active { color: #1677ff; }
      
      .jdsc-tagsbar { display: flex; gap: 6px; padding: 8px 12px; background: #1a1d21; border-bottom: 1px solid #3a3f44; flex-shrink: 0; }
      .jdsc-tag { 
        height: 24px; 
        padding: 0 10px; 
        border-radius: 4px; 
        display: inline-flex; 
        align-items: center; 
        font-size: 11px; 
        font-weight: 500;
        flex: 1; 
        justify-content: center; 
        cursor: pointer;
        transition: all 0.2s;
        opacity: 0.6;
      }
      .jdsc-tag.active { opacity: 1; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
      .jdsc-tag.orange { background: #fa8c16; color: #fff; }
      .jdsc-tag.purple { background: #722ed1; color: #fff; }
      
      .jdsc-search { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: #1a1d21; position: relative; flex-shrink: 0; }
      .jdsc-search input { 
        flex: 1; 
        height: 28px; 
        border-radius: 4px; 
        border: 1px solid #3a3f44; 
        background: #0d0f12; 
        color: #e6e9ec; 
        padding: 0 32px 0 10px; 
        font-size: 12px;
        transition: all 0.2s;
      }
      .jdsc-search input:focus { border-color: #fa3d64; outline: none; box-shadow: 0 0 0 2px rgba(250,61,100,0.2); }
      .jdsc-modal-workflow .jdsc-search input:focus { border-color: #1677ff; box-shadow: 0 0 0 2px rgba(22,119,255,0.2); }
      
      .jdsc-clear { 
        position: absolute; 
        right: 24px; 
        top: 50%; 
        transform: translateY(-50%); 
        width: 18px; 
        height: 18px; 
        border-radius: 50%; 
        background: #4b5563; 
        color: #fff; 
        display: none; 
        align-items: center; 
        justify-content: center; 
        font-size: 10px; 
        cursor: pointer; 
        transition: background 0.2s;
      }
      .jdsc-clear:hover { background: #fa3d64; }
      
      .jdsc-body { 
        overflow-y: auto; 
        padding: 4px 8px; 
        flex: 1; 
        background: #1a1d21;
      }
      .jdsc-body::-webkit-scrollbar { width: 8px; }
      .jdsc-body::-webkit-scrollbar-track { background: transparent; }
      .jdsc-body::-webkit-scrollbar-thumb { background: #3a3f44; border-radius: 4px; }
      .jdsc-body::-webkit-scrollbar-thumb:hover { background: #4b5563; }
      
      .jdsc-item { 
        display: flex; 
        gap: 8px; 
        padding: 8px 10px; 
        align-items: center; 
        background: #2a2e32; 
        border-radius: 6px; 
        margin: 4px 0; 
        border: 1px solid #3a3f44;
        transition: all 0.2s;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .jdsc-item:hover { 
        background: #333a40; 
        border-color: #4a5159; 
        transform: translateY(-1px); 
        box-shadow: 0 4px 12px rgba(0,0,0,0.2); 
      }
      
      .jdsc-drag-handle { 
        width: 20px; 
        height: 20px; 
        border-radius: 4px; 
        background: rgba(255,255,255,0.05); 
        color: #8a9199; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: grab; 
        font-size: 12px; 
        transition: all 0.2s;
      }
      .jdsc-drag-handle:hover { background: rgba(255,255,255,0.1); color: #fff; }
      
      .jdsc-name { font-size: 15px; font-weight: 600; color: #e6e9ec; margin-bottom: 1px; }
      .jdsc-sub { font-size: 10px; color: #8a9199; font-family: monospace; }
      .jdsc-desc { font-size: 11px; color: #8a9199; margin-top: 2px; line-height: 1.3; }
      .jdsc-tertiary { font-size: 9px; color: #8a9199; margin-top: 1px; }
      
      .jdsc-heart { 
        width: 20px; 
        height: 20px; 
        border-radius: 4px; 
        background: rgba(255,255,255,0.05); 
        color: #8a9199; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        cursor: pointer; 
        font-size: 12px; 
        transition: all 0.2s;
      }
      .jdsc-heart:hover { background: rgba(255,255,255,0.1); color: #fff; }
      .jdsc-heart.active { background: rgba(250,61,100,0.1); color: #fa3d64; }
      .jdsc-heart.active:hover { background: rgba(250,61,100,0.2); }
      
      .jdsc-footer { 
        display: flex; 
        gap: 8px; 
        padding: 8px 12px; 
        border-top: 1px solid #3a3f44; 
        align-items: center; 
        justify-content: space-between; 
        flex-shrink: 0; 
        background: #1a1d21;
      }
      .jdsc-btn { 
        height: 28px; 
        padding: 0 12px; 
        border-radius: 4px; 
        background: #2a2e32; 
        color: #b7bcc2; 
        display: inline-flex; 
        align-items: center; 
        cursor: pointer; 
        font-size: 12px; 
        font-weight: 500;
        border: 1px solid #3a3f44;
        transition: all 0.2s;
      }
      .jdsc-btn:hover { background: #3a3f44; color: #fff; border-color: #4a5159; }
      
      /* 右键菜单样式 */
      .jdsc-context-menu {
        position: fixed;
        background: #1c1f22;
        border: 1px solid #3a3f44;
        border-radius: 8px;
        padding: 4px 0;
        z-index: 10001;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        min-width: 140px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .jdsc-menu-item {
        padding: 8px 16px;
        color: #e6e9ec;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .jdsc-menu-item:hover {
        background: #1677ff;
        color: #fff;
      }
      .jdsc-menu-item.danger:hover {
        background: #ff4d4f;
      }
      
      /* 拖动排序样式 */
      .jdsc-noselect {
        user-select: none !important;
        -webkit-user-select: none !important;
      }
      .jdsc-drag-ghost {
        position: fixed;
        background: #1c1f22;
        border: 2px solid #1677ff;
        border-radius: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        pointer-events: none;
        z-index: 10002;
        opacity: 0.9;
      }
      .jdsc-drag-placeholder {
        background: rgba(22, 119, 255, 0.1);
        border: 2px dashed #1677ff;
        border-radius: 8px;
        margin: 4px 0;
      }
    `;
    document.head.appendChild(style);
  }

  const TEXTS = {
    zh: {
      title: "收藏+",
      tab_search: "搜索",
      tab_fav: "收藏",
      tag_nodes: "节点收藏",
      tag_frags: "片段收藏",
      ph_fav: "在收藏中搜索...",
      ph_search: "搜索节点中搜索...",
      btn_hotkey: "设置快捷键",
      btn_save_node: "收藏节点",
      btn_save_frag: "收藏片段",
      heart_add: "收藏",
      heart_added: "已收藏",
      rename_group: "重命名分组",
      rename_frag: "重命名片段",
      rename_fav: "重命名单独收藏",
      new_frag_name: "为片段输入名称",
      confirm_unfav_node: "是否取消收藏该节点？",
      confirm_unfav_group: "是否取消收藏该分组？",
      confirm_unfav_frag: "是否取消收藏该片段？",
      alert_select_one: "请在画布选择一个节点以收藏",
      set_hotkey_done: "已设置快捷键为: ",
    },
    en: {
      title: "Favor+",
      tab_search: "Search",
      tab_fav: "Favorites",
      tag_nodes: "Node Favorites",
      tag_frags: "Fragment Favorites",
      ph_fav: "Search in favorites...",
      ph_search: "Search installed nodes...",
      btn_hotkey: "Set Hotkey",
      btn_save_node: "Save Node",
      btn_save_frag: "Save Fragment",
      heart_add: "Favorite",
      heart_added: "Favorited",
      rename_group: "Rename Group",
      rename_frag: "Rename Fragment",
      rename_fav: "Rename Favorite",
      new_frag_name: "Enter fragment name",
      confirm_unfav_node: "Remove this node from favorites?",
      confirm_unfav_group: "Remove this group from favorites?",
      confirm_unfav_frag: "Remove this fragment from favorites?",
      alert_select_one: "Select one node on canvas to save",
      set_hotkey_done: "Hotkey set to: ",
    }
  };

  function getLang() { const s = localStorage.getItem(KEY_LANG); return s === "en" ? "en" : "zh"; }
  function t(key) { const lang = getLang(); const dict = TEXTS[lang] || TEXTS.zh; return dict[key] || key; }

  function pathTextByType(type) {
    try {
      const reg = (window.LiteGraph && window.LiteGraph.registered_node_types) || {};
      const def = reg[type] || {};
      const segs = String(type || "").split("/");
      const typeProj = segs[0] || "";
      const typeBranch = segs.length > 1 ? segs[1] : "";
      const catRaw = def.category || (def.prototype && def.prototype.category) || "";
      const catParts = Array.isArray(catRaw) ? catRaw : String(catRaw).split("/").filter(Boolean);
      const proj = catParts[0] || typeProj;
      const branch = catParts[1] || typeBranch;
      const pathText = proj + (branch ? "/" + branch : "");
      return pathText || "";
    } catch { return ""; }
  }

  function tokenizeKw(str) {
    const parts = [];
    const re = /[\u4e00-\u9fff]+|[a-zA-Z0-9]+/g;
    let m; while ((m = re.exec(String(str)))) parts.push(m[0].toLowerCase());
    return parts;
  }

  function getCanvas() { return (window.app && window.app.canvas) || null; }
  function getGraph() { return (window.app && window.app.graph) || null; }
  function getViewport() { const canvas = getCanvas(); if (!canvas || !canvas.canvas || !canvas.ds) return { x: 0, y: 0, w: 1200, h: 800, scale: 1 }; const scale = canvas.ds.scale || 1; const off = canvas.ds.offset || [0, 0]; const w = canvas.canvas.width || 1200; const h = canvas.canvas.height || 800; const x = (-off[0]) / scale; const y = (-off[1]) / scale; const gw = w / scale; const gh = h / scale; return { x, y, w: gw, h: gh, scale }; }
  function nodeSize(n) {
    const s = n && n.size;
    if (Array.isArray(s)) {
      // 为节点尺寸添加安全边距，补偿标题栏、边框、阴影等视觉占用
      // 宽度+20px（左右各10px边框阴影），高度+40px（顶部标题栏30px+底部10px）
      return { w: s[0] + 20, h: s[1] + 40 };
    }
    return { w: 180, h: 120 }; // 默认尺寸也相应增加
  }
  function rects(graph) { graph = graph || getGraph(); const arr = (graph && (graph._nodes || graph.nodes)) || []; return arr.map(n => { const s = nodeSize(n); return { x: n.pos[0], y: n.pos[1], w: s.w, h: s.h, id: n.id, ref: n }; }); }
  function rectsExcept(excludeNodes) { const ex = new Set((excludeNodes || []).filter(Boolean)); return rects().filter(r => !ex.has(r.ref)); }
  function intersect(a, b, pad = 300) {
    return !(a.x + a.w + pad <= b.x || b.x + b.w + pad <= a.x || a.y + a.h + pad <= b.y || b.y + b.h + pad <= a.y);
  }
  function findFreeRect(w, h) { const vp = getViewport(); const rs = rects(); const cx = vp.x + vp.w / 2, cy = vp.y + vp.h / 2; const step = 60; const maxR = Math.max(vp.w, vp.h) * 2; for (let r = 0; r < maxR; r += step) { for (let dx = -r; dx <= r; dx += step) { for (let dy = -r; dy <= r; dy += step) { const x = Math.round(cx + dx - w / 2), y = Math.round(cy + dy - h / 2); const candidate = { x, y, w, h }; let ok = true; for (const rr of rs) { if (intersect(candidate, rr)) { ok = false; break; } } if (ok) return candidate; } } } return { x: vp.x + 10, y: vp.y + 10, w, h }; }
  function screenToCanvas(px, py) { try { const c = getCanvas(); if (!c || !c.canvas || !c.ds) return [0, 0]; const rect = c.canvas.getBoundingClientRect(); const scale = c.ds.scale || 1; const off = c.ds.offset || [0, 0]; const sx = px - rect.left; const sy = py - rect.top; return [(sx - off[0]) / scale, (sy - off[1]) / scale]; } catch { return [0, 0]; } }
  function getModalScreenRect() { try { const candidates = ['.jdsc-modal', '.comfy-modal', '.modal', '.modal-container']; let el = null; for (const sel of candidates) { const found = document.querySelector(sel); if (found) { el = found; break; } } if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; } catch { return null; } }
  function getFavorModalScreenRect() { try { const all = Array.from(document.querySelectorAll('.jdsc-modal, .comfy-modal, .modal, .modal-container')); const el = all.find(e => String(e.textContent || '').includes('收藏+') || e.classList.contains('jdsc-modal')); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; } catch { return null; } }
  function getFloatingScreenRect() { try { const float = document.querySelector('.jdsc-floating'); if (!float) return null; const r = float.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; } catch { return null; } }
  function computeAnchorFromUiScreen(size, uiRect) {
    try {
      const c = getCanvas(); if (!c || !c.canvas || !c.ds || !uiRect) return null; const crect = c.canvas.getBoundingClientRect(); const pad = 24; let sx;
      if (uiRect.left >= crect.right) sx = crect.right - Math.round(size.w / 2) - 12;
      else if (uiRect.right <= crect.left) sx = crect.left + Math.round(size.w / 2) + 12;
      else sx = Math.round((Math.max(uiRect.left, crect.left) + Math.min(uiRect.right, crect.right)) / 2);
      let sy = Math.round(uiRect.top - pad - size.h);
      sy = Math.max(crect.top + 12, Math.min(sy, crect.bottom - size.h - 12));
      const p = screenToCanvas(sx, sy);
      return { x: Math.round(p[0]), y: Math.round(p[1]) };
    } catch { return null; }
  }
  function getModalCanvasRect() { try { const c = getCanvas(); if (!c || !c.canvas || !c.ds) return null; const candidates = ['.jdsc-modal', '.comfy-modal', '.modal', '.modal-container']; let el = null; for (const sel of candidates) { const found = document.querySelector(sel); if (found) { el = found; break; } } if (!el) return null; const r = el.getBoundingClientRect(); const p1 = screenToCanvas(r.left, r.top); const p2 = screenToCanvas(r.right, r.bottom); const x = Math.min(p1[0], p2[0]); const y = Math.min(p1[1], p2[1]); const w = Math.abs(p2[0] - p1[0]); const h = Math.abs(p2[1] - p1[1]); return { x, y, w, h }; } catch { return null; } }
  function getFavorModalRect() { try { const c = getCanvas(); if (!c || !c.canvas || !c.ds) return null; const el = document.querySelector('.jdsc-modal'); if (!el) return null; const r = el.getBoundingClientRect(); const p1 = screenToCanvas(r.left, r.top); const p2 = screenToCanvas(r.right, r.bottom); const x = Math.min(p1[0], p2[0]); const y = Math.min(p1[1], p2[1]); const w = Math.abs(p2[0] - p1[0]); const h = Math.abs(p2[1] - p1[1]); return { x, y, w, h }; } catch { return null; } }
  function getFavorModalScreenRect() { try { const el = document.querySelector('.jdsc-modal'); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; } catch { return null; } }
  function computeAnchorFromUiScreen(size, uiRect) {
    try {
      const c = getCanvas(); if (!c || !c.canvas || !c.ds || !uiRect) return null;
      const crect = c.canvas.getBoundingClientRect();
      const pad = 24; const margin = 12;
      const midX = Math.round((uiRect.left + uiRect.right) / 2);
      let sx = midX; let sy = Math.round(uiRect.top - pad);
      // horizontal: if panel is right of canvas, stick to canvas right; if left, stick to left; else center within overlap
      if (uiRect.left >= crect.right) {
        sx = Math.round(crect.right - margin - Math.round(size.w / 2));
      } else if (uiRect.right <= crect.left) {
        sx = Math.round(crect.left + margin + Math.round(size.w / 2));
      } else {
        const minX = crect.left + margin + Math.round(size.w / 2);
        const maxX = crect.right - margin - Math.round(size.w / 2);
        sx = Math.max(minX, Math.min(sx, maxX));
      }
      // vertical: prefer above panel; clamp inside canvas
      const minY = crect.top + margin + size.h;
      const maxY = crect.bottom - margin - size.h;
      sy = Math.max(minY, Math.min(sy, maxY));
      const p = screenToCanvas(sx, sy);
      return { x: Math.round(p[0] - size.w / 2), y: Math.round(p[1] - size.h) };
    } catch { return null; }
  }
  function getFavorModalScreenRect() { try { const el = document.querySelector('.jdsc-modal'); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; } catch { return null; } }
  function computeAnchorFromUiScreen(size, uiRect) { try { const c = getCanvas(); if (!c || !c.canvas || !c.ds || !uiRect) return null; const crect = c.canvas.getBoundingClientRect(); const pad = 24; const minX = crect.left + 12 + Math.round(size.w / 2); const maxX = crect.right - 12 - Math.round(size.w / 2); const sx = Math.max(minX, Math.min(Math.round((uiRect.left + uiRect.right) / 2), maxX)); const minY = crect.top + 12 + size.h; const maxY = crect.bottom - 12 - size.h; const sy = Math.max(minY, Math.min(Math.round(uiRect.top - pad), maxY)); const p = screenToCanvas(sx, sy); return { x: Math.round(p[0] - size.w / 2), y: Math.round(p[1] - size.h) }; } catch { return null; } }
  function updateGlobalModalAnchor() {
    try {
      const rect = getFavorModalRect();
      if (rect) {
        const anchor = { x: Math.round(rect.x + rect.w / 2), y: Math.round(rect.y) - 24 };
        window.__jdsc_modal_anchor = anchor;
        try { save(KEY_UI_ANCHOR, anchor); } catch { }
      }
    } catch { }
  }
  function globalWorkRect() { try { const rs = rects(); if (!rs.length) return null; const minX = Math.min(...rs.map(r => r.x)); const minY = Math.min(...rs.map(r => r.y)); const maxX = Math.max(...rs.map(r => r.x + r.w)); const maxY = Math.max(...rs.map(r => r.y + r.h)); return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }; } catch { return null; } }
  function viewWorkRect() { try { const vp = getViewport(); const rs = rects(); const margin = 60; const vx = vp.x, vy = vp.y, vw = vp.w, vh = vp.h; const inside = r => { const cx = r.x + r.w / 2, cy = r.y + r.h / 2; return cx >= vx - margin && cx <= vx + vw + margin && cy >= vy - margin && cy <= vy + vh + margin; }; const vis = rs.filter(inside); if (!vis.length) return null; const minX = Math.min(...vis.map(r => r.x)); const minY = Math.min(...vis.map(r => r.y)); const maxX = Math.max(...vis.map(r => r.x + r.w)); const maxY = Math.max(...vis.map(r => r.y + r.h)); return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }; } catch { return null; } }
  function getFloatingCanvasRect() { try { const float = document.querySelector('.jdsc-floating'); const c = getCanvas(); if (!float || !c || !c.canvas || !c.ds) return null; const r = float.getBoundingClientRect(); const p1 = screenToCanvas(r.left, r.top); const p2 = screenToCanvas(r.right, r.bottom); const x = Math.min(p1[0], p2[0]); const y = Math.min(p1[1], p2[1]); const w = Math.abs(p2[0] - p1[0]); const h = Math.abs(p2[1] - p1[1]); return { x, y, w, h }; } catch { return null; } }
  function findAboveRect(w, h, baseRect, pad = 24, extraOccupied) { const rs = rects(); const occ = (extraOccupied || []).filter(Boolean); const cx = baseRect.x + baseRect.w / 2; const baseY = baseRect.y - pad - h; const step = 24; const span = Math.max(96, baseRect.w + 96); for (let dx = -span; dx <= span; dx += step) { const x = Math.round(cx + dx - w / 2); const y = Math.round(baseY); const cand = { x, y, w, h }; let ok = true; for (const rr of rs) { if (intersect(cand, rr, 24)) { ok = false; break; } } if (ok) { for (const er of occ) { if (intersect(cand, er, 8)) { ok = false; break; } } } if (ok) return cand; } return { x: Math.round(cx - w / 2), y: Math.round(baseY), w, h }; }
  function findAroundRect(w, h, baseRect, pad = 24, extraOccupied) {
    const rs = rects(); const occ = (extraOccupied || []).filter(Boolean);
    const step = 24; const cx = baseRect.x + baseRect.w / 2; const topY = baseRect.y - pad - h;
    const midY = baseRect.y + Math.round(baseRect.h / 2 - h / 2);
    const belowY = baseRect.y + baseRect.h + pad;
    const spanX = Math.max(120, baseRect.w + 120);
    const spanY = Math.max(96, baseRect.h + 96);
    const candidates = [];
    candidates.push({ x: Math.round(cx - w / 2), y: Math.round(topY), w, h });
    for (let dx = step; dx <= spanX; dx += step) {
      candidates.push({ x: Math.round(cx - dx - w / 2), y: Math.round(topY), w, h });
      candidates.push({ x: Math.round(cx + dx - w / 2), y: Math.round(topY), w, h });
    }
    for (let dy = 0; dy <= spanY; dy += step) {
      candidates.push({ x: Math.round(baseRect.x - pad - w), y: Math.round(midY - dy), w, h });
      candidates.push({ x: Math.round(baseRect.x + baseRect.w + pad), y: Math.round(midY - dy), w, h });
    }
    for (let dx = -spanX; dx <= spanX; dx += step) {
      candidates.push({ x: Math.round(cx + dx - w / 2), y: Math.round(belowY), w, h });
    }
    const ok = cand => !rs.some(rr => intersect(cand, rr, 24)) && !occ.some(er => intersect(cand, er, 8));
    for (const cand of candidates) { if (ok(cand)) return cand; }
    return { x: Math.round(cx - w / 2), y: Math.round(topY), w, h };
  }
  function findLeftRect(w, h, baseRect, pad = 300, extraOccupied) {
    const rs = rects(); const occ = (extraOccupied || []).filter(Boolean);
    const step = 24;
    const x = Math.round(baseRect.x - pad - w);
    const midY = Math.round(baseRect.y + baseRect.h / 2 - h / 2);
    const spanY = Math.max(96, baseRect.h + 96);
    const candidates = [];
    candidates.push({ x, y: midY, w, h });
    for (let dy = step; dy <= spanY; dy += step) {
      candidates.push({ x, y: midY - dy, w, h });
      candidates.push({ x, y: midY + dy, w, h });
    }
    const ok = cand => !rs.some(rr => intersect(cand, rr)) && !occ.some(er => intersect(cand, er, 8));
    for (const cand of candidates) { if (ok(cand)) return cand; }
    return { x, y: midY, w, h };
  }
  function insideViewportRect(x, y) { try { const vp = getViewport(); return x >= vp.x && x <= vp.x + vp.w && y >= vp.y && y <= vp.y + vp.h; } catch { return false; } }
  function findFreeRectGlobal(w, h, rsOverride) {
    const rs = rsOverride || rects(); if (rs.length === 0) { const vp = getViewport(); return { x: vp.x + vp.w / 2 - w / 2, y: vp.y + vp.h / 2 - h / 2, w, h }; } const minX = Math.min(...rs.map(r => r.x)); const minY = Math.min(...rs.map(r => r.y)); const maxX = Math.max(...rs.map(r => r.x + r.w)); const maxY = Math.max(...rs.map(r => r.y + r.h)); const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2; const step = 300; const maxR = 4000; // increased step to 300px for better spacing
    // try to the right
    let candidate = { x: maxX + step, y: cy - h / 2, w, h }; if (!rs.some(rr => intersect(candidate, rr))) return candidate;
    // try below
    candidate = { x: cx - w / 2, y: maxY + step, w, h }; if (!rs.some(rr => intersect(candidate, rr))) return candidate;
    // spiral search around center of all nodes
    for (let r = step; r < maxR; r += step) { for (let dx = -r; dx <= r; dx += step) { for (let dy = -r; dy <= r; dy += step) { const x = Math.round(cx + dx - w / 2), y = Math.round(cy + dy - h / 2); const cand = { x, y, w, h }; let ok = true; for (const rr of rs) { if (intersect(cand, rr)) { ok = false; break; } } if (ok) return cand; } } }
    // fallback far right
    return { x: maxX + step * 2, y: minY + step, w, h };
  }
  function findFreeRectGlobalLeft(w, h, rsOverride) {
    const rs = rsOverride || rects(); if (rs.length === 0) { const vp = getViewport(); return { x: vp.x - w / 2, y: vp.y + vp.h / 2 - h / 2, w, h }; } const minX = Math.min(...rs.map(r => r.x)); const minY = Math.min(...rs.map(r => r.y)); const maxX = Math.max(...rs.map(r => r.x + r.w)); const maxY = Math.max(...rs.map(r => r.y + r.h)); const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2; const step = 300; const maxR = 4000; // increased step to 300px for better spacing
    let candidate = { x: minX - step - w, y: cy - h / 2, w, h }; if (!rs.some(rr => intersect(candidate, rr))) return candidate;
    candidate = { x: cx - w / 2, y: minY - step - h, w, h }; if (!rs.some(rr => intersect(candidate, rr))) return candidate;
    for (let r = step; r < maxR; r += step) { for (let dx = -r; dx <= r; dx += step) { for (let dy = -r; dy <= r; dy += step) { const x = Math.round(cx + dx - w / 2), y = Math.round(cy + dy - h / 2); const cand = { x, y, w, h }; let ok = true; for (const rr of rs) { if (intersect(cand, rr)) { ok = false; break; } } if (ok) return cand; } } }
    return { x: minX - step * 2 - w, y: minY + step, w, h };
  }
  // 计算工作流所有节点的总边框
  function calculateGlobalBounds() { const rs = rects(); if (rs.length === 0) return null; const minX = Math.min(...rs.map(r => r.x)); const minY = Math.min(...rs.map(r => r.y)); const maxX = Math.max(...rs.map(r => r.x + r.w)); const maxY = Math.max(...rs.map(r => r.y + r.h)); return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }; }
  function calculateGlobalBounds() { const rs = rects(); if (!rs.length) return null; const minX = Math.min(...rs.map(r => r.x)); const minY = Math.min(...rs.map(r => r.y)); const maxX = Math.max(...rs.map(r => r.x + r.w)); const maxY = Math.max(...rs.map(r => r.y + r.h)); return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 }; }
  // 智能选择单个节点位置：始终选择距离工作流中心最近的空白位置
  function findSmartPosition(w, h) {
    const app = window.app;
    if (!app || !app.canvas || !app.canvas.canvas) return { x: 0, y: 0, w, h };
    const canvas = app.canvas;
    const bias = (() => { try { const list = Array.from(document.querySelectorAll('.jdsc-modal')); const target = list.find(el => { const t = (el.querySelector('.jdsc-title') || {}).textContent || ''; return /收藏\+|Favor\+/i.test(t); }) || list[0]; if (!target) return 0; const sw = (window.innerWidth || document.documentElement.clientWidth || 0); const r = target.getBoundingClientRect(); const mc = r.left + r.width / 2; return mc >= sw / 2 ? -500 : 500; } catch { return 0; } })();
    // A: 直接使用 LiteGraph 记录的鼠标图坐标
    if (Array.isArray(canvas.graph_mouse) && canvas.graph_mouse.length === 2) {
      const mx = canvas.graph_mouse[0];
      const my = canvas.graph_mouse[1];
      if (Math.abs(mx) > 1 || Math.abs(my) > 1) {
        return { x: Math.round(mx - w / 2 + bias), y: Math.round(my - h / 2), w, h };
      }
    }
    // B: 使用官方 API 将屏幕中心转换为画布坐标
    const rect = canvas.canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    if (typeof canvas.convertClientToCanvasOffset === 'function') {
      const pos = canvas.convertClientToCanvasOffset([cx, cy]);
      return { x: Math.round(pos[0] - w / 2 + bias), y: Math.round(pos[1] - h / 2), w, h };
    }
    // C: 兜底：使用 backing store 尺寸与 ds 偏移/缩放计算
    const ds = canvas.ds;
    const bx = (canvas.canvas.width / 2 - ds.offset[0]) / ds.scale;
    const by = (canvas.canvas.height / 2 - ds.offset[1]) / ds.scale;
    return { x: Math.round(bx - w / 2 + bias), y: Math.round(by - h / 2), w, h };
  }
  function centerOnRect(rect) {
    const canvas = getCanvas(); const graph = getGraph(); if (!canvas) return;
    if (typeof canvas.centerOnNode === 'function') {
      try { canvas.centerOnNode({ pos: [rect.x, rect.y], size: [rect.w, rect.h] }); } catch { }
    } else if (canvas.ds && canvas.canvas) {
      const s = canvas.ds.scale || 1; const cw = canvas.canvas.width || 1200; const ch = canvas.canvas.height || 800; const cx = rect.x + rect.w / 2; const cy = rect.y + rect.h / 2; canvas.ds.offset[0] = -cx * s + cw / 2; canvas.ds.offset[1] = -cy * s + ch / 2;
    }
    if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true, true);
    if (typeof canvas.draw === 'function') setTimeout(() => canvas.draw(true, true), 0);
  }
  function isTypingNow() {
    try {
      const ae = (typeof document !== 'undefined' ? document.activeElement : null);
      return !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable));
    } catch { return false; }
  }
  function colorizeNode(n) { }
  function selectNodes(nodes) {
    const canvas = getCanvas(); const graph = getGraph(); const map = {};
    nodes.forEach(n => { if (n) { n.selected = true; map[n.id] = n; } });
    if (canvas) {
      canvas.selected_nodes = map;
      canvas.last_selected_node = nodes.filter(Boolean).slice(-1)[0] || null;
      canvas.dirty_canvas = true; canvas.dirty_bgcanvas = true;
    }
    if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true, true);
    if (canvas && typeof canvas.draw === 'function') setTimeout(() => canvas.draw(true, true), 0);
  }
  function getNodeBounds(n) { const sz = Array.isArray(n.size) ? n.size : [160, 80]; return { x: n.pos[0], y: n.pos[1], w: sz[0], h: sz[1] }; }
  function findNodeRectByType(typeKey) { try { const g = getGraph(); const arr = (g && (g._nodes || g.nodes)) || []; for (const n of arr) { if (String(n.type || "") === String(typeKey || "")) { const s = nodeSize(n); return { x: n.pos[0], y: n.pos[1], w: s.w, h: s.h }; } } return null; } catch { return null; } }
  function isValidCanvasPos(x, y) {
    try {
      const rs = rects();
      if (rs.length) { const minX = Math.min(...rs.map(r => r.x)); const minY = Math.min(...rs.map(r => r.y)); const maxX = Math.max(...rs.map(r => r.x + r.w)); const maxY = Math.max(...rs.map(r => r.y + r.h)); const m = 2000; return x >= minX - m && x <= maxX + m && y >= minY - m && y <= maxY + m; }
      const vp = getViewport(); const m = vp.w + vp.h; return x >= vp.x - m && x <= vp.x + vp.w + m && y >= vp.y - m && y <= vp.y + vp.h + m;
    } catch { return true; }
  }
  function addNodeByType(type, baseRect, clickPoint) {
    try {
      const graph = getGraph(); const canvas = getCanvas(); if (!graph || !window.LiteGraph) throw new Error('nograph');
      const node = window.LiteGraph.createNode(type); if (!node) throw new Error('nonode');
      const s = nodeSize(node);
      // 使用智能定位：根据工作流形状选择最短边方向放置节点
      const anchor = findSmartPosition(s.w, s.h);
      try { const finite = (v) => typeof v === 'number' && isFinite(v) && Math.abs(v) < 1e9; if (!(finite(anchor.x) && finite(anchor.y))) throw new Error('badpos'); } catch (e) { return null; }
      node.pos = [anchor.x, anchor.y]; colorizeNode(node); graph.add(node);
      if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true, true);
      selectNodes([node]);
      return node;
    } catch (e) {
      return null;
    }
  }

  function normalizeHotkeyString(str) {
    const s = String(str || '').trim().toLowerCase();
    const parts = s.split('+').map(p => p.trim()).filter(Boolean);
    const spec = { ctrl: false, alt: false, shift: false, meta: false, key: '' };
    parts.forEach(p => {
      if (p === 'ctrl' || p === 'control') spec.ctrl = true;
      else if (p === 'alt' || p === 'option') spec.alt = true;
      else if (p === 'shift') spec.shift = true;
      else if (p === 'meta' || p === 'cmd' || p === 'win' || p === 'super') spec.meta = true;
      else spec.key = p;
    });
    return spec;
  }
  function eventKeyString(e) {
    const k = String(e.key || '').toLowerCase();
    if (k === ' ') return 'space';
    if (k === 'escape') return 'esc';
    return k;
  }
  function matchHotkey(e, spec) {
    if (!spec) return false;
    if (spec.ctrl && !e.ctrlKey) return false;
    if (spec.alt && !e.altKey) return false;
    if (spec.shift && !e.shiftKey) return false;
    if (spec.meta && !e.metaKey) return false;
    const key = eventKeyString(e);
    if (spec.key) return key === spec.key;
    return spec.ctrl || spec.alt || spec.shift || spec.meta; // allow pure modifiers
  }

  function makeDraggable(el, saveKey) {
    let sx = 0, sy = 0, ex = 0, ey = 0, drag = false, moved = false;
    const onDown = e => { drag = true; moved = false; sx = e.clientX; sy = e.clientY; ex = el.offsetLeft; ey = el.offsetTop; el.style.right = "auto"; el.style.bottom = "auto"; };
    const onMove = e => { if (!drag) return; const dx = e.clientX - sx; const dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) > 3) moved = true; el.style.left = `${ex + dx}px`; el.style.top = `${ey + dy}px`; };
    const onUp = () => { if (!drag) return; drag = false; if (saveKey) { try { save(saveKey, { x: el.offsetLeft, y: el.offsetTop }); } catch { } } if (moved) { el.__jdsc_drag_last = Date.now(); moved = false; } };
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    // 抑制拖动后的误触发点击：在捕获阶段拦截下一次点击
    el.addEventListener("click", (e) => { try { const t = el.__jdsc_drag_last || 0; if (t && (Date.now() - t) < 300) { e.stopPropagation(); e.preventDefault(); el.__jdsc_drag_last = 0; } } catch { } }, true);
  }

  function createFloating(app, toggle, toggleWorkflow) {
    ensureStyles();
    // 创建双按钮容器
    const container = createEl("div", "jdsc-floating-group");
    const fp = load(KEY_FLOAT_POS, null);
    if (fp && typeof fp.x === "number" && typeof fp.y === "number") {
      container.style.left = fp.x + "px";
      container.style.top = fp.y + "px";
      container.style.right = "auto";
      container.style.bottom = "auto";
    } else {
      container.style.left = "auto";
      container.style.top = "auto";
      container.style.right = "70px";
      container.style.bottom = "70px";
    }

    // 创建节点收藏按钮（❤）
    const btnNode = createEl("div", "jdsc-floating", "❤");
    btnNode.addEventListener("click", toggle);

    // 创建工作流收藏按钮（⭐）
    const btnWorkflow = createEl("div", "jdsc-floating jdsc-floating-workflow", "⭐");
    btnWorkflow.addEventListener("click", toggleWorkflow);

    container.appendChild(btnNode);
    container.appendChild(btnWorkflow);
    document.body.appendChild(container);
    makeDraggable(container, KEY_FLOAT_POS);

    try {
      const r = container.getBoundingClientRect();
      const w = window.innerWidth || document.documentElement.clientWidth || 0;
      const h = window.innerHeight || document.documentElement.clientHeight || 0;
      const off = (r.right < 0) || (r.bottom < 0) || (r.left > w) || (r.top > h) || (r.width === 0) || (r.height === 0);
      if (off) { container.style.left = "auto"; container.style.top = "auto"; container.style.right = "70px"; container.style.bottom = "70px"; save(KEY_FLOAT_POS, { x: null, y: null }); }
    } catch { }

    return container;
  }

  function snapshotSelectedFragment() {
    const graph = window.app && window.app.graph;
    const selObj = (window.app && window.app.canvas && window.app.canvas.selected_nodes) || {};
    const selNodes = Object.values(selObj);
    if (!graph || !selNodes.length) return null;
    const ids = selNodes.map(n => n.id);
    const idSet = new Set(ids);
    const nodes = selNodes.map(n => {
      const widgets = (n.widgets || []).map(w => w.value);
      const props = Object.assign({}, n.properties || {});
      return { id: n.id, type: n.type, pos: [n.pos[0], n.pos[1]], widgets, properties: props };
    });
    const links = [];
    selNodes.forEach(n => {
      (n.outputs || []).forEach((out, oslot) => {
        (out.links || []).forEach(linkId => {
          const l = graph.links && graph.links[linkId];
          if (!l) return;
          if (idSet.has(l.target_id)) {
            links.push({ origin_id: l.origin_id, origin_slot: l.origin_slot, target_id: l.target_id, target_slot: l.target_slot });
          }
        });
      });
    });
    const defName = `片段(${nodes.length}节点)`;
    const name = prompt(t("new_frag_name"), defName);
    if (!name) return null;
    const minX = Math.min(...nodes.map(n => n.pos[0]));
    const minY = Math.min(...nodes.map(n => n.pos[1]));
    return { id: Date.now().toString(36), name, nodes, links, anchor: [minX, minY] };
  }

  function addFragmentToCanvas(frag) {
    const graph = getGraph(); if (!graph || !window.LiteGraph) return; const mapping = {};
    const rel = (frag.nodes || []).map(sn => { const dummy = window.LiteGraph.createNode(sn.type); const s = nodeSize(dummy); return { id: sn.id, type: sn.type, w: s.w, h: s.h, x: sn.pos[0] - (frag.anchor ? frag.anchor[0] : 0), y: sn.pos[1] - (frag.anchor ? frag.anchor[1] : 0), widgets: sn.widgets || [], props: sn.properties || {} }; });
    if (!rel.length) return;
    const minX = Math.min(...rel.map(r => r.x)); const minY = Math.min(...rel.map(r => r.y)); const maxX = Math.max(...rel.map(r => r.x + r.w)); const maxY = Math.max(...rel.map(r => r.y + r.h)); const rectW = maxX - minX; const rectH = maxY - minY;
    // 计算避让时考虑组框的完整大小（使用系统默认的紧凑边距）
    const padX = 10;        // 左右边距：10像素
    const padTop = 40;      // 顶部边距：40像素，留给组框标题
    const padBottom = 10;   // 底部边距：紧凑型，只留10像素
    const padInput = 10;    // 输入接口左侧额外空间：10像素
    const padOutput = 20;   // 输出接口右侧额外空间：20像素
    const totalW = rectW + padX * 2 + padInput + padOutput; const totalH = rectH + padTop + padBottom;
    const free = findFreeRectGlobal(totalW, totalH);
    // 添加节点时，考虑左侧和顶部的边距偏移
    const offsetX = padX + padInput;  // 左侧边距 + 输入接口空间
    const offsetY = padTop;           // 顶部边距
    rel.forEach(r => {
      const node = window.LiteGraph.createNode(r.type);
      if (!node) return;
      node.pos = [free.x + offsetX + (r.x - minX), free.y + offsetY + (r.y - minY)];
      graph.add(node);
      const ws = node.widgets || [];
      for (let i = 0; i < ws.length && i < r.widgets.length; i++) { ws[i].value = r.widgets[i]; }
      node.properties = Object.assign({}, node.properties || {}, r.props || {});
      colorizeNode(node);
      mapping[r.id] = node;
    });
    (frag.links || []).forEach(l => { const A = mapping[l.origin_id]; const B = mapping[l.target_id]; if (A && B && A.connect) { try { A.connect(l.origin_slot, B, l.target_slot); } catch (e) { } } });
    // 选中所有添加的节点
    const added = Object.values(mapping).filter(Boolean);
    selectNodes(added);

    // 延迟后自动创建组框：模拟 Shift+G 键盘事件（EasyUse快捷键）
    setTimeout(() => {
      try {
        const canvas = getCanvas();
        const graph = getGraph();
        if (canvas && canvas.canvas) {
          // 创建并触发 Shift+G 键盘事件
          const keyEvent = new KeyboardEvent('keydown', {
            key: 'g',
            code: 'KeyG',
            keyCode: 71,
            which: 71,
            shiftKey: true,
            ctrlKey: false,
            altKey: false,
            bubbles: true,
            cancelable: true
          });
          canvas.canvas.dispatchEvent(keyEvent);
          console.log('【组框】已触发 Shift+G 事件');

          // 再次延迟，等待组框创建完成后修改其名称
          setTimeout(() => {
            if (graph && graph._groups && graph._groups.length > 0) {
              // 找到最新创建的组框（最后一个）
              const lastGroup = graph._groups[graph._groups.length - 1];
              if (lastGroup) {
                lastGroup.title = frag.name || "片段";
                console.log('【组框】已将名称改为:', lastGroup.title);
                if (canvas.setDirty) canvas.setDirty(true, true);
              }
            }
          }, 100);
        }
      } catch (e) {
        console.error('【组框】触发快捷键失败:', e);
      }
    }, 200);

    // 居中到节点位置
    centerOnRect({ x: free.x, y: free.y, w: totalW, h: totalH });
  }

  function renderList(container, items, favsMap) {
    container.innerHTML = "";
    items.forEach(it => {
      const row = createEl("div", "jdsc-item");
      const main = createEl("div", "jdsc-item-main");
      const fav = favsMap[it.type];
      const name = createEl("div", "jdsc-name", (fav && fav.name) || it.name);
      const pathText = (it.project ? it.project : "") + (it.category ? (it.project ? "/" : "") + it.category : "") || pathTextByType(it.type);
      const sub = createEl("div", "jdsc-sub");
      const heartMark = createEl("span", "jdsc-heartmark", "❤");
      sub.appendChild(heartMark);
      const subTxt = createEl("span", null, fav ? (pathText || fav.orig || it.name) : (pathText || it.type || ""));
      sub.appendChild(subTxt);
      const desc = createEl("div", "jdsc-desc", it.desc || "");
      main.appendChild(name);
      main.appendChild(sub);
      if (it.desc) main.appendChild(desc);
      const heart = createEl("div", "jdsc-heart" + (favsMap[it.type] ? " active" : ""), favsMap[it.type] ? "❤" : "♡");
      if (!it.type.startsWith("__group__") && !it.type.startsWith("__frag__")) {
        row.style.cursor = "pointer";
        const handler = () => { try { const br = getFavorModalRect(); addNodeByType(it.type, br); } catch { } };
        row.addEventListener("click", handler);
        name.addEventListener("click", handler);
        sub.addEventListener("click", handler);
      }
      heart.addEventListener("click", () => {
        try {
          const favs = getFavs();
          if (favs[it.type]) {
            if (confirm(t("confirm_unfav_node"))) { delete favs[it.type]; }
          } else {
            favs[it.type] = { name: it.name, orig: it.name };
          }
          save(KEY_FAVS, favs);
          renderList(container, items, favs);
        } catch (e) { }
      });
      row.appendChild(main);
      row.appendChild(heart);
      container.appendChild(row);
    });
  }

  function openModal(app) {
    ensureStyles();
    const modal = createEl("div", "jdsc-modal jdsc-modal-favorites");
    const header = createEl("div", "jdsc-header");
    const title = createEl("div", "jdsc-title", t("title"));
    const lang = createEl("div", "jdsc-lang", "🌐");
    const close = createEl("div", "jdsc-close", "×");
    close.addEventListener("click", () => modal.remove());
    header.appendChild(title);
    header.appendChild(lang);
    header.appendChild(close);
    const tabs = createEl("div", "jdsc-tabs");
    const tabSearch = createEl("div", "jdsc-tab", t("tab_search"));
    const tabFav = createEl("div", "jdsc-tab active", t("tab_fav"));
    tabs.appendChild(tabSearch);
    tabs.appendChild(tabFav);
    const tagsbar = createEl("div", "jdsc-tagsbar");
    const tagNodes = createEl("div", "jdsc-tag orange active", t("tag_nodes"));
    const tagFrags = createEl("div", "jdsc-tag purple", t("tag_frags"));
    tagsbar.appendChild(tagNodes);
    tagsbar.appendChild(tagFrags);
    const searchBar = createEl("div", "jdsc-search");
    const input = createEl("input");
    input.placeholder = t("ph_fav");
    searchBar.appendChild(input);
    const clearBtn = createEl("div", "jdsc-clear", "×");
    searchBar.appendChild(clearBtn);
    const body = createEl("div", "jdsc-body");
    const footer = createEl("div", "jdsc-footer");
    const btnHotkey = createEl("div", "jdsc-btn", t("btn_hotkey"));
    const btnSaveNode = createEl("div", "jdsc-btn", t("btn_save_node"));
    const btnSaveFrag = createEl("div", "jdsc-btn", t("btn_save_frag"));
    footer.appendChild(btnSaveNode);
    footer.appendChild(btnSaveFrag);
    footer.appendChild(btnHotkey);
    modal.appendChild(header);
    modal.appendChild(tabs);
    modal.appendChild(tagsbar);
    modal.appendChild(searchBar);
    modal.appendChild(body);
    modal.appendChild(footer);
    document.body.appendChild(modal);
    warmNodesCache();
    try { updateGlobalModalAnchor(); } catch { }

    const mp = load(KEY_MODAL_POS, null);
    let positionValid = false;
    if (mp && typeof mp.x === "number" && typeof mp.y === "number") {
      // 检查位置是否在屏幕可见范围内
      const screenW = window.innerWidth || document.documentElement.clientWidth || 1920;
      const screenH = window.innerHeight || document.documentElement.clientHeight || 1080;
      const modalW = 460; // 面板默认宽度
      const modalH = 400; // 面板大致高度
      // 确保至少有100px在屏幕内可见
      if (mp.x >= -modalW + 100 && mp.x <= screenW - 100 && mp.y >= 0 && mp.y <= screenH - 100) {
        modal.style.left = mp.x + "px";
        modal.style.top = mp.y + "px";
        positionValid = true;
      }
    }
    if (!positionValid) {
      // 位置无效时使用默认位置
      modal.style.right = "70px";
      modal.style.bottom = "70px";
      modal.style.left = "auto";
      modal.style.top = "auto";
    }

    let mDown = false, sx = 0, sy = 0, ex = 0, ey = 0;
    header.style.cursor = "move";
    header.addEventListener("mousedown", e => {
      mDown = true; sx = e.clientX; sy = e.clientY; ex = modal.offsetLeft; ey = modal.offsetTop;
      modal.style.right = "auto"; modal.style.bottom = "auto";
    });
    window.addEventListener("mousemove", e => {
      if (!mDown) return; const dx = e.clientX - sx; const dy = e.clientY - sy; modal.style.left = (ex + dx) + "px"; modal.style.top = (ey + dy) + "px"; try { updateGlobalModalAnchor(); } catch { }
    });
    window.addEventListener("mouseup", () => {
      if (!mDown) return; mDown = false; save(KEY_MODAL_POS, { x: modal.offsetLeft, y: modal.offsetTop }); try { updateGlobalModalAnchor(); } catch { }
    });

    // 标题栏右键关闭对话框
    header.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        modal.remove();
      } catch { }
    });

    let mode = "fav";
    let favFilter = "nodes";
    let refreshing = false;

    function addGroupToCanvas(group) {
      const graph = getGraph(); if (!graph || !window.LiteGraph) return;
      const nodesData = group.nodes ? group.nodes.map((n, i) => ({ id: n.id || i + 1, type: n.type })) : (group.types || []).map((t, i) => ({ id: i + 1, type: t }));
      const previews = nodesData.map(nd => { const dummy = window.LiteGraph.createNode(nd.type); const s = nodeSize(dummy); return { id: nd.id, type: nd.type, w: s.w, h: s.h }; });
      const cols = Math.ceil(Math.sqrt(previews.length)) || 1; const gapX = 40, gapY = 30; const cellW = Math.max(...previews.map(p => p.w)) + gapX; const cellH = Math.max(...previews.map(p => p.h)) + gapY; const rows = Math.ceil(previews.length / cols);
      const rectW = cols * cellW; const rectH = rows * cellH;
      const free = findFreeRectGlobal(rectW, rectH);
      const mapping = {};
      previews.forEach((p, idx) => { const col = idx % cols; const row = Math.floor(idx / cols); const x = free.x + col * cellW + gapX / 2; const y = free.y + row * cellH + gapY / 2; const node = window.LiteGraph.createNode(p.type); if (!node) return; node.pos = [x, y]; colorizeNode(node); graph.add(node); mapping[p.id] = node; });
      (group.links || []).forEach(l => {
        const A = mapping[l.origin_id];
        const B = mapping[l.target_id];
        if (A && B && A.connect) {
          try { A.connect(l.origin_slot, B, l.target_slot); } catch (e) { }
        }
      });
      if (!group.links || !group.links.length) {
        const created = nodesData.map(nd => mapping[nd.id]).filter(Boolean);
        const usedInputs = new WeakMap();
        for (let i = 0; i < created.length; i++) {
          const A = created[i];
          if (!A || !A.outputs) continue;
          for (let j = 0; j < created.length; j++) {
            if (i === j) continue;
            const B = created[j];
            if (!B || !B.inputs) continue;
            for (let os = 0; os < (A.outputs || []).length; os++) {
              const otype = (A.outputs[os].type || "").toString().toLowerCase();
              for (let is = 0; is < (B.inputs || []).length; is++) {
                const inp = B.inputs[is];
                const itype = (inp.type || "").toString().toLowerCase();
                const used = (usedInputs.get(B) || new Set());
                if (otype && itype && otype === itype && !used.has(is)) {
                  try { A.connect(os, B, is); used.add(is); usedInputs.set(B, used); break; } catch (e) { }
                }
              }
            }
          }
        }
      }
      const addedNodes = nodesData.map(nd => mapping[nd.id]).filter(Boolean); selectNodes(addedNodes); centerOnRect(free);
    }

    function refresh() {
      if (refreshing) return; refreshing = true;
      const favs = getFavs();
      const groups = getGroups();
      if (mode === "fav") {
        tagsbar.style.display = "flex";
        tagsbar.style.display = "flex";
        tabFav.classList.add("active");
        tabSearch.classList.remove("active");
        input.placeholder = t("ph_fav");
        if (body.jdscScrollHandler) { body.removeEventListener("scroll", body.jdscScrollHandler); body.jdscScrollHandler = null; }
        const frags = getFrags();
        const favTypes = Object.keys(favs);
        // 读取/初始化节点收藏的排序
        const orderNodes = (() => { try { const m = load('jdsc:fav_order_nodes', []); const set = new Set(favTypes); const arr = Array.isArray(m) ? m.filter(k => set.has(k)) : []; favTypes.forEach(k => { if (!arr.includes(k)) arr.push(k); }); return arr; } catch { return favTypes.slice(); } })();
        const orderedNodeItems = favTypes.slice().sort((a, b) => orderNodes.indexOf(a) - orderNodes.indexOf(b))
          .map(t => ({ type: t, name: favs[t].name || t, orig: favs[t].orig || t, desc: "" }));
        const groupItems = groups.map(g => ({ type: `__group__:${g.id}`, name: g.name, desc: `${(g.nodes ? g.nodes.length : (g.types ? g.types.length : 0))} 个节点分组` }));
        const fragItems = frags.map(f => ({ type: `__frag__:${f.id}`, name: f.name, desc: `${(f.nodes ? f.nodes.length : 0)} 节点片段` }));
        let items = [...orderedNodeItems, ...groupItems, ...fragItems];
        const groupMap = new Map(groups.map(g => [g.id, g]));
        const fragMap = new Map(frags.map(f => [f.id, f]));
        const isFrag = (x) => {
          if (x.type.startsWith("__group__")) {
            const id = x.type.split(":")[1];
            const g = groupMap.get(id);
            const cnt = g ? (g.nodes ? g.nodes.length : (g.types ? g.types.length : 0)) : 0;
            return cnt >= 2;
          }
          if (x.type.startsWith("__frag__")) {
            const id = x.type.split(":")[1];
            const f = fragMap.get(id);
            const cnt = f ? (f.nodes ? f.nodes.length : 0) : 0;
            return cnt >= 2;
          }
          return false;
        };
        const isNode = (x) => !x.type.startsWith("__group__") && !x.type.startsWith("__frag__");
        if (favFilter === "nodes") items = items.filter(isNode);
        if (favFilter === "frags") items = items.filter(isFrag);
        const kwRaw = input.value.trim();
        const kw = kwRaw.toLowerCase();
        const kwAlt = kw.replace(/l/g, "i");
        const kwSlug = kw.replace(/[^a-z0-9]+/g, "");
        const hasCJK = /[\u4e00-\u9fff]/.test(kw);
        const kwCJK = kw.replace(/[\s_\-\/\\]+/g, "");
        const tokens = tokenizeKw(kwRaw);
        function favHit(x) {
          if (!kw) return true;
          const base = ((x.name || "") + " " + (x.orig || "") + " " + (x.type || "") + " " + (x.desc || "")).toLowerCase();
          const slug = base.replace(/[^a-z0-9]+/g, "");
          const cjkBase = base.replace(/[\s_\-\/\\]+/g, "");
          const direct = base.includes(kw) || base.includes(kwAlt);
          const slugHit = kwSlug ? slug.includes(kwSlug) : false;
          const cjkHit = hasCJK ? cjkBase.includes(kwCJK) : false;
          const any = direct || slugHit || cjkHit;
          if (!any && tokens.length > 1) {
            const hay = base + " " + cjkBase + " " + pathTextByType(x.type || "").toLowerCase();
            return tokens.every(t => hay.includes(t.toLowerCase()));
          }
          return any;
        }
        const shown = kw ? items.filter(favHit).sort((a, b) => {
          const hayA = ((a.name || "") + " " + (a.orig || "") + " " + (a.type || "") + " " + (a.desc || "")).toLowerCase();
          const hayB = ((b.name || "") + " " + (b.orig || "") + " " + (b.type || "") + " " + (b.desc || "")).toLowerCase();
          const cA = hayA.replace(/[\s_\-\/\\]+/g, "");
          const cB = hayB.replace(/[\s_\-\/\\]+/g, "");
          const score = (h, c) => { let s = 0; if (kw && h.includes(kw)) s += 4; if (kwAlt && h.includes(kwAlt)) s += 2; if (kwSlug && h.replace(/[^a-z0-9]+/g, "").includes(kwSlug)) s += 1; if (hasCJK && kwCJK && c.includes(kwCJK)) s += 3; tokens.forEach(t => { if (h.includes(t.toLowerCase())) s += 1; }); return s; };
          return score(hayB, cB) - score(hayA, cA);
        }) : items;
        const nodesShown = shown.filter(isNode);
        const fragsShown = shown.filter(isFrag);
        body.innerHTML = "";
        const grid = createEl("div", "jdsc-grid");
        const colL = createEl("div", "jdsc-col");
        const colR = createEl("div", "jdsc-col");
        grid.appendChild(colL); grid.appendChild(colR); body.appendChild(grid);

        function splitList(list) { const a = []; const b = []; list.forEach((it, i) => { (i % 2 === 0 ? a : b).push(it); }); return [a, b]; }
        let leftList, rightList;
        if (favFilter === "frags") { [leftList, rightList] = splitList(fragsShown); }
        else if (favFilter === "nodes") { [leftList, rightList] = splitList(nodesShown); }
        else { leftList = nodesShown; rightList = fragsShown; }

        function showContextMenu(e, it) {
          const menu = createEl("div", "jdsc-context-menu");
          menu.style.left = `${e.clientX}px`;
          menu.style.top = `${e.clientY}px`;

          const createMenuItem = (text, icon, onClick, className = "") => {
            const div = createEl("div", "jdsc-menu-item " + className);
            div.innerHTML = `<span>${icon}</span><span>${text}</span>`;
            div.onclick = (ev) => {
              ev.stopPropagation();
              onClick();
              menu.remove();
            };
            return div;
          };

          // 重命名
          menu.appendChild(createMenuItem(t("rename_fav"), "📝", () => {
            if (it.type.startsWith("__group__")) {
              const groups2 = getGroups();
              const id = it.type.split(":")[1];
              const g = groups2.find(x => x.id === id);
              if (!g) return;
              const nn = prompt(t("rename_group"), g.name);
              if (nn) { g.name = nn; save(KEY_GROUPS, groups2); refresh(); }
            } else if (it.type.startsWith("__frag__")) {
              const frags2 = getFrags();
              const id = it.type.split(":")[1];
              const f = frags2.find(x => x.id === id);
              if (!f) return;
              const nn = prompt(t("rename_frag"), f.name);
              if (nn) { f.name = nn; save(KEY_FRAGS, frags2); refresh(); }
            } else {
              const favs2 = getFavs();
              const cur = favs2[it.type]?.name || it.name;
              const nn = prompt(t("rename_fav"), cur);
              if (nn) {
                if (!favs2[it.type]) favs2[it.type] = { name: it.name, orig: it.name };
                favs2[it.type].name = nn; save(KEY_FAVS, favs2); refresh();
              }
            }
          }));

          // 取消收藏
          menu.appendChild(createMenuItem("取消收藏", "💔", () => {
            if (it.type.startsWith("__group__")) {
              if (confirm(t("confirm_unfav_group"))) {
                const groups2 = getGroups();
                const id = it.type.split(":")[1];
                const idx = groups2.findIndex(x => x.id === id);
                if (idx >= 0) { groups2.splice(idx, 1); save(KEY_GROUPS, groups2); refresh(); }
              }
            } else if (it.type.startsWith("__frag__")) {
              if (confirm(t("confirm_unfav_frag"))) {
                const frags2 = getFrags();
                const id = it.type.split(":")[1];
                const idx = frags2.findIndex(x => x.id === id);
                if (idx >= 0) { frags2.splice(idx, 1); save(KEY_FRAGS, frags2); refresh(); }
              }
            } else {
              if (confirm(t("confirm_unfav_node"))) {
                const favs2 = getFavs();
                delete favs2[it.type];
                save(KEY_FAVS, favs2); refresh();
              }
            }
          }, "danger"));

          document.body.appendChild(menu);
          const onDocClick = () => { menu.remove(); document.removeEventListener("click", onDocClick); };
          setTimeout(() => document.addEventListener("click", onDocClick), 10);
        }

        function renderFavItem(target, it, listKind) {
          const row = createEl("div", "jdsc-item");
          // 拖拽排序把手（按住上下拖动）
          const handle = createEl('div', 'jdsc-drag-handle', '⋮⋮');
          const main = createEl("div", "jdsc-item-main");
          const name = createEl("div", "jdsc-name", it.name);
          const sub = createEl("div", "jdsc-sub");
          if (it.type.startsWith("__group__")) {
            sub.textContent = it.desc;
          } else {
            const mark = createEl("span", "jdsc-heartmark", "❤");
            const p = pathTextByType(it.type) || it.orig || it.type;
            const subTxt = createEl("span", null, p);
            sub.appendChild(mark);
            sub.appendChild(subTxt);
          }
          if (!it.type.startsWith("__group__") && !it.type.startsWith("__frag__")) {
            const tiny = createEl("div", "jdsc-tertiary", it.orig || it.type || "");
            main.appendChild(name);
            main.appendChild(sub);
            main.appendChild(tiny);
          } else {
            main.appendChild(name);
            main.appendChild(sub);
          }
          if (it.type.startsWith("__group__")) {
            row.style.cursor = "pointer";
            row.addEventListener("click", () => {
              const id = it.type.split(":")[1];
              const g = groups.find(x => x.id === id);
              if (g) addGroupToCanvas(g);
            });
          } else if (it.type.startsWith("__frag__")) {
            row.style.cursor = "pointer";
            row.addEventListener("click", () => {
              const id = it.type.split(":")[1];
              const frags2 = getFrags();
              const f = frags2.find(x => x.id === id);
              if (f) addFragmentToCanvas(f);
            });
          } else {
            row.style.cursor = "pointer";
            row.addEventListener("click", () => { try { const br = getFavorModalRect(); const n = addNodeByType(it.type, br); if (!n) alert(getLang() === 'en' ? 'Add failed: invalid anchor' : '添加失败：坐标无效'); } catch { alert(getLang() === 'en' ? 'Add failed' : '添加失败'); } });
          }
          row.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            e.stopPropagation();
            showContextMenu(e, it);
          });
          // 标注行类型与键，便于计算排序
          row.dataset.kind = (it.type.startsWith('__frag__') ? 'frag' : (it.type.startsWith('__group__') ? 'group' : 'node'));
          if (row.dataset.kind === 'node') row.dataset.key = it.type;
          if (row.dataset.kind === 'frag') row.dataset.fragId = it.type.split(':')[1];
          // 拖拽排序逻辑
          let dragging = false; let startY = 0; let curY = 0;
          let ghost = null; let placeholder = null; let offsetY = 0; let rowRect = null;
          const onMove = (e) => {
            if (!dragging) return;
            curY = e.clientY; try { e.preventDefault(); } catch { }
            if (ghost) { ghost.style.top = `${Math.round(curY - offsetY)}px`; }
            // 计算并移动占位符到最近位置
            const kind = row.dataset.kind;
            const rowsAll = Array.from(target.querySelectorAll('.jdsc-item')).filter(r => r.dataset.kind === kind && r !== row);
            if (!rowsAll.length || !placeholder) return;
            const rects = rowsAll.map(r => { const br = r.getBoundingClientRect(); return { r, mid: br.top + br.height / 2 }; });
            let nearestIdx = 0; let best = Infinity;
            rects.forEach((ent, idx) => { const d = Math.abs(curY - ent.mid); if (d < best) { best = d; nearestIdx = idx; } });
            const targetEl = rects[nearestIdx]?.r || null;
            if (targetEl) {
              if (curY < rects[nearestIdx].mid) target.insertBefore(placeholder, targetEl);
              else target.insertBefore(placeholder, targetEl.nextSibling);
            }
          };
          const onUp = (e) => {
            if (!dragging) return; dragging = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            try { if (modal && modal.classList) modal.classList.remove('jdsc-noselect'); } catch { }
            if (ghost) { try { ghost.remove(); } catch { } ghost = null; }
            if (placeholder) { try { placeholder.replaceWith(row); } catch { } placeholder = null; }
            row.style.visibility = '';
            const kind = row.dataset.kind;
            const rows = Array.from(target.querySelectorAll('.jdsc-item')).filter(r => r.dataset.kind === kind);
            if (!rows.length) return;
            const rects = rows.map(r => { const br = r.getBoundingClientRect(); return { r, mid: br.top + br.height / 2 }; });
            let nearestIdx = 0; let best = Infinity;
            rects.forEach((ent, idx) => { const d = Math.abs(curY - ent.mid); if (d < best) { best = d; nearestIdx = idx; } });
            const fromIdx = rows.indexOf(row);
            if (fromIdx < 0 || nearestIdx === fromIdx) return;

            if (kind === 'node') {
              try {
                const favs2 = getFavs(); const types = Object.keys(favs2);
                let order = load('jdsc:fav_order_nodes', []); if (!Array.isArray(order)) order = [];
                types.forEach(k => { if (!order.includes(k)) order.push(k); }); order = order.filter(k => types.includes(k));
                const displayKeys = rows.map(r => r.dataset.key).filter(Boolean);
                const typeKey = row.dataset.key; const targetKey = displayKeys[nearestIdx];
                const iGlobal = order.indexOf(typeKey); const jGlobal = order.indexOf(targetKey);
                if (iGlobal < 0 || jGlobal < 0) return;
                const insertPos = (nearestIdx > fromIdx) ? (jGlobal + 1) : jGlobal;
                const cur = order.splice(iGlobal, 1)[0]; order.splice(insertPos > iGlobal ? insertPos - 1 : insertPos, 0, cur);
                save('jdsc:fav_order_nodes', order); refresh();
              } catch { }
            } else if (kind === 'frag') {
              try {
                const arr = getFrags(); const id = row.dataset.fragId; const i = arr.findIndex(x => String(x.id) === String(id));
                const displayIds = rows.map(r => r.dataset.fragId);
                const targetId = displayIds[nearestIdx]; const j = arr.findIndex(x => String(x.id) === String(targetId));
                if (i < 0 || j < 0) return;
                const item = arr.splice(i, 1)[0]; const insertPos = (nearestIdx > fromIdx) ? j + 1 : j; arr.splice(insertPos > i ? insertPos - 1 : insertPos, 0, item);
                save(KEY_FRAGS, arr); refresh();
              } catch { }
            }
          };
          handle.addEventListener('mousedown', (e) => {
            e.stopPropagation(); try { e.preventDefault(); } catch { }
            dragging = true; startY = e.clientY; curY = startY;
            try { if (modal && modal.classList) modal.classList.add('jdsc-noselect'); } catch { }
            // 创建拖拽浮层与占位符
            try {
              rowRect = row.getBoundingClientRect(); offsetY = startY - rowRect.top;
              ghost = document.createElement('div'); ghost.className = 'jdsc-drag-ghost';
              ghost.style.left = `${Math.round(rowRect.left)}px`; ghost.style.top = `${Math.round(rowRect.top)}px`;
              ghost.style.width = `${Math.round(rowRect.width)}px`; ghost.style.height = `${Math.round(rowRect.height)}px`;
              ghost.innerHTML = row.innerHTML; document.body.appendChild(ghost);
              placeholder = document.createElement('div'); placeholder.className = 'jdsc-drag-placeholder'; placeholder.style.height = `${Math.round(rowRect.height)}px`;
              row.parentElement.insertBefore(placeholder, row); row.style.visibility = 'hidden';
            } catch { }
            window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp);
          });
          // append handled above
          row.appendChild(handle);
          row.appendChild(main);
          target.appendChild(row);
        }

        leftList.forEach(it => renderFavItem(colL, it, 'left'));
        rightList.forEach(it => renderFavItem(colR, it, 'right'));
      } else {
        tagsbar.style.display = "none";
        tabSearch.classList.add("active");
        tabFav.classList.remove("active");
        input.placeholder = t("ph_search");
        const all = getAllNodeDefs();
        const kw = input.value.trim().toLowerCase();
        if (!kw) {
          body.innerHTML = "";
        } else {
          const norm = kw.replace(/l/g, "i");
          const slugKw = kw.toLowerCase().replace(/[^a-z0-9]+/g, "");
          const hasCJK = /[\u4e00-\u9fff]/.test(kw);
          const kwCJK = kw.replace(/[\s_\-\/\\]+/g, "");
          function tokenize(str) {
            const parts = [];
            const re = /[\u4e00-\u9fff]+|[a-zA-Z0-9]+/g;
            let m; while ((m = re.exec(str))) { parts.push(m[0].toLowerCase()); }
            return parts;
          }
          const tokens = tokenize(kw);
          const items = all.filter(x => {
            const baseHit = x.search.includes(kw) || x.searchAlt.includes(norm);
            const slugHit = slugKw ? (x.searchSlug || "").includes(slugKw) : false;
            const cjkHit = hasCJK ? (x.searchCJK || "").includes(kwCJK) : false;
            const anyHit = baseHit || slugHit || cjkHit;
            if (!anyHit && tokens.length > 1) {
              const hay = (x.search + " " + (x.searchCJK || ""));
              const allTokens = tokens.every(t => hay.includes(t));
              return allTokens;
            }
            return anyHit;
          }).sort((a, b) => {
            const hayA = (a.search + " " + (a.searchCJK || ""));
            const hayB = (b.search + " " + (b.searchCJK || ""));
            const score = h => {
              let s = 0; if (h.includes(kw)) s += 4; if (norm && h.includes(norm)) s += 2; if (slugKw && (a.searchSlug || "").includes(slugKw)) s += 1; if (hasCJK && h.includes(kwCJK)) s += 3; tokens.forEach(t => { if (h.includes(t)) s += 1; }); return s;
            };
            return score(hayB) - score(hayA);
          });
          const size = kw.length <= 1 ? 60 : 120;
          if (body.jdscScrollHandler) { body.removeEventListener("scroll", body.jdscScrollHandler); body.jdscScrollHandler = null; }
          body.innerHTML = "";
          let idx = 0;
          const total = items.length;
          const appendChunk = () => {
            if (idx >= total) return;
            const frag = document.createDocumentFragment();
            const end = Math.min(idx + size, total);
            for (let i = idx; i < end; i++) {
              const it = items[i];
              const row = document.createElement("div"); row.className = "jdsc-item";
              const main = document.createElement("div"); main.className = "jdsc-item-main";
              const fav = favs[it.type];
              const name = document.createElement("div"); name.className = "jdsc-name"; name.textContent = (fav && fav.name) || it.name;
              const sub = document.createElement("div"); sub.className = "jdsc-sub"; const pathText = (it.project ? it.project : "") + (it.category ? (it.project ? "/" : "") + it.category : ""); const mark = document.createElement("span"); mark.className = "jdsc-heartmark"; mark.textContent = "❤"; const subTxt = document.createElement("span"); subTxt.textContent = fav ? (fav.orig || it.name) : (pathText || it.type || ""); sub.appendChild(mark); sub.appendChild(subTxt);
              main.appendChild(name); main.appendChild(sub);
              const heart = document.createElement("div"); heart.className = "jdsc-heart" + (favs[it.type] ? " active" : ""); heart.textContent = favs[it.type] ? "❤" : "♡";
              row.appendChild(main); row.appendChild(heart);
              row.style.cursor = "pointer";
              row.addEventListener("click", () => { try { const br = getFavorModalRect(); const n = addNodeByType(it.type, br); if (!n) alert(getLang() === 'en' ? 'Add failed: invalid anchor' : '添加失败：坐标无效'); } catch { alert(getLang() === 'en' ? 'Add failed' : '添加失败'); } });
              heart.addEventListener("click", (e) => {
                e.stopPropagation();
                const favs2 = getFavs();
                if (favs2[it.type]) { if (confirm(t("confirm_unfav_node"))) delete favs2[it.type]; } else { favs2[it.type] = { name: it.name, orig: it.name }; }
                save(KEY_FAVS, favs2);
                const active = !!favs2[it.type];
                heart.classList.toggle("active", active);
                heart.textContent = active ? "❤" : "♡";
              });
              frag.appendChild(row);
            }
            body.appendChild(frag);
            idx = end;
          };
          appendChunk();
          const onScroll = () => { if (body.scrollTop + body.clientHeight >= body.scrollHeight - 60) { appendChunk(); if (idx >= total) { body.removeEventListener("scroll", onScroll); body.jdscScrollHandler = null; } } };
          body.addEventListener("scroll", onScroll); body.jdscScrollHandler = onScroll;
        }
      }
      setTimeout(() => { refreshing = false; }, 0);
    }

    let debounceId = null;
    input.addEventListener("input", () => {
      clearBtn.style.display = input.value ? "flex" : "none";
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(refresh, 180);
    });
    clearBtn.addEventListener("click", () => { input.value = ""; clearBtn.style.display = "none"; refresh(); });
    tabFav.addEventListener("mouseenter", () => { mode = "fav"; favFilter = "all"; refresh(); });
    tabSearch.addEventListener("mouseenter", () => { mode = "search"; refresh(); });
    lang.addEventListener("click", () => { const cur = getLang(); localStorage.setItem(KEY_LANG, cur === "en" ? "zh" : "en"); title.textContent = t("title"); tabSearch.textContent = t("tab_search"); tabFav.textContent = t("tab_fav"); tagNodes.textContent = t("tag_nodes"); tagFrags.textContent = t("tag_frags"); btnHotkey.textContent = t("btn_hotkey"); btnSaveNode.textContent = t("btn_save_node"); btnSaveFrag.textContent = t("btn_save_frag"); input.placeholder = mode === "fav" ? t("ph_fav") : t("ph_search"); refresh(); });

    tagNodes.addEventListener("click", () => { favFilter = (favFilter === "nodes" ? "all" : "nodes"); refresh(); });
    tagFrags.addEventListener("click", () => { favFilter = (favFilter === "frags" ? "all" : "frags"); refresh(); });

    btnSaveNode.addEventListener("click", () => {
      const selObj = (window.app && window.app.canvas && window.app.canvas.selected_nodes) || {};
      const sel = Object.values(selObj);
      if (sel.length !== 1) { alert(t("alert_select_one")); return; }
      const n = sel[0];
      const favs = getFavs();
      const defName = n.title || (n.type.split("/").pop());
      const name = prompt(t("btn_save_node"), favs[n.type]?.name || defName || n.type) || defName || n.type;
      favs[n.type] = { name, orig: defName || n.type };
      save(KEY_FAVS, favs);
      try { const pos = { x: n.pos[0], y: n.pos[1] }; const map = load(KEY_STRICT_FAV_POS, {}); map[n.type] = { x: Math.round(pos.x), y: Math.round(pos.y) }; save(KEY_STRICT_FAV_POS, map); } catch { }
      mode = "fav"; refresh();
    });

    btnSaveFrag.addEventListener("click", () => {
      const frag = snapshotSelectedFragment();
      if (!frag) return;
      const frags = getFrags();
      frags.push(frag);
      save(KEY_FRAGS, frags);
      mode = "fav"; refresh();
    });


    btnHotkey.addEventListener("click", () => {
      const cur = load(KEY_HOTKEY, "f");
      const hk = prompt(getLang() === "en" ? "Enter hotkey (combo, e.g. Ctrl+Alt+F)" : "输入快捷键（组合，如 Ctrl+Alt+F）", cur);
      if (!hk) return;
      const spec = normalizeHotkeyString(hk);
      const disp = [spec.ctrl ? 'Ctrl' : null, spec.alt ? 'Alt' : null, spec.shift ? 'Shift' : null, spec.meta ? 'Meta' : null, spec.key ? spec.key.toUpperCase() : null].filter(Boolean).join('+');
      save(KEY_HOTKEY, disp.toLowerCase());
      alert(`${t("set_hotkey_done")}${disp}`);
    });

    refresh();
  }

  function setup(app) {
    const toggle = () => {
      try {
        // 使用CSS类来准确识别收藏+面板
        const existing = document.querySelector(".jdsc-modal-favorites");
        if (existing) existing.remove(); else openModal(app || window.app);
      } catch (e) {
        alert("無惑收藏面板打开失败，请刷新页面重试");
      }
    };
    const toggleWorkflow = () => {
      try {
        const existing = document.querySelector(".jdsc-wf-modal");
        if (existing) {
          existing.remove();
        } else {
          if (window.__jdsc_createWorkflowModal) {
            window.__jdsc_createWorkflowModal(toggleWorkflow);
          } else {
            alert("工作流+面板加载失败，请刷新页面重试");
          }
        }
      } catch (e) {
        console.error("工作流+面板打开失败:", e);
        alert("工作流+面板打开失败，请刷新页面重试");
      }
    };
    window.__jdsc_toggleWorkflow = toggleWorkflow;
    if (!document.querySelector(".jdsc-floating-group")) {
      createFloating(app, toggle, toggleWorkflow);
    }

    let hkStr = getSetting(KEY_HOTKEY, "alt+s");
    let hkSpec = normalizeHotkeyString(hkStr);
    window.addEventListener("keydown", e => {
      try {
        if (matchHotkey(e, hkSpec)) {
          e.preventDefault();
          toggle();
        }
      } catch { }
    });
  }

  const boot = () => {
    try {
      if (!FAVS_CACHE) syncFavsFromServer();
      if (!FRAGS_CACHE) syncFragsFromServer();
      if (!window.__jdsc_settings_cache) {
        fetch('/jdsc/settings').then(r => r.ok ? r.json() : {}).then(s => {
          window.__jdsc_settings_cache = (s && typeof s === 'object') ? s : {};
          SETTINGS_LOADED = true;  // 标记设置已加载完成
          // 确保设置加载完成后再检查版本
          setTimeout(verifyVersion, 100);
        }).catch(() => {
          window.__jdsc_settings_cache = {};
          SETTINGS_LOADED = true;  // 即使失败也标记为已加载，允许后续保存
          setTimeout(verifyVersion, 100);
        });
      } else {
        SETTINGS_LOADED = true;  // 缓存已存在，标记为已加载
        // 如果缓存已存在，直接检查版本
        setTimeout(verifyVersion, 100);
      }
    } catch {
      SETTINGS_LOADED = true;  // 异常情况也标记为已加载
      setTimeout(verifyVersion, 400);
    }
    if (window.app && window.LiteGraph) setup(window.app);
    else setTimeout(boot, 500);
  };
  boot();
  function findNodeById(id) { const g = getGraph(); const arr = (g && (g._nodes || g.nodes)) || []; const sid = String(id); for (const n of arr) { if (String(n.id) === sid) return n; } return null; }
  function syncTextGate() {
    const g = getGraph(); if (!g) return;
    if (isTypingNow() && anyTextGateEditLock()) return;
    const arr = (g._nodes || g.nodes) || [];
    for (const gate of arr) {
      const t = String(gate.type || ""); if (!t.includes("WuhuoTextGate")) continue;
      const ws = gate.widgets || [];
      const wEnable = ws.find(w => String(w.name || "") === "enable_edit");
      const wEdit = ws.find(w => String(w.name || "") === "edit_text");
      const wFree = ws.find(w => String(w.name || "") === "free_pass");
      if (typeof gate.__jdsc_base_bg === 'undefined') gate.__jdsc_base_bg = gate.bgcolor;
      if (typeof gate.__jdsc_base_color === 'undefined') gate.__jdsc_base_color = gate.color;
      if (!wEdit) {
        // still apply color by buttons even if edit widget missing
      }
      try {
        const onEdit = !!(wEnable && wEnable.value);
        const onFree = !!(wFree && wFree.value);
        if (onEdit) { gate.bgcolor = '#A02F2B'; gate.color = '#f0f0f0'; gate.title_text_color = '#f0f0f0'; gate.titlecolor = '#f0f0f0'; gate.title_color = '#f0f0f0'; }
        else if (onFree) { gate.bgcolor = '#5E6B4D'; gate.color = '#f0f0f0'; gate.title_text_color = '#f0f0f0'; gate.titlecolor = '#f0f0f0'; gate.title_color = '#f0f0f0'; }
        else { gate.bgcolor = '#8C7259'; gate.color = '#f0f0f0'; gate.title_text_color = '#f0f0f0'; gate.titlecolor = '#f0f0f0'; gate.title_color = '#f0f0f0'; }
      } catch { }
    }
  }
  setInterval(syncTextGate, 400);
  function syncEmptyLatent() {
    try {
      const g = getGraph(); if (!g) return;
      const arr = (g._nodes || g.nodes) || [];
      const flip = (m) => { try { const p = String(m || '').split(':'); if (p.length !== 2) return m; return `${p[1]}:${p[0]}`; } catch { return m; } };
      const align8 = v => { try { v = Math.max(8, Math.floor(Number(v) || 0)); return Math.floor(v / 8) * 8; } catch { return 8; } };
      const parseRatio = (m) => { try { const p = String(m || '').split(':'); if (p.length !== 2) return [1, 1]; const rw = Math.max(1, parseInt(p[0])); const rh = Math.max(1, parseInt(p[1])); return [rw, rh]; } catch { return [1, 1]; } };
      for (const n of arr) {
        const t = String(n.type || ""); if (!t.includes("WuhuoEmptyLatentVideo") && !t.includes("WuhuoEmptyLatentQwen")) continue;
        const ws = n.widgets || [];
        const wMode = ws.find(w => String(w.name || "") === "size_mode");
        const wOri = ws.find(w => String(w.name || "") === "orientation");
        const wW = ws.find(w => String(w.name || "") === "width");
        const wH = ws.find(w => String(w.name || "") === "height");
        if (!wMode || !wOri || !wW || !wH) continue;
        const props = Object.assign({}, n.properties || {});
        let mode = String(wMode.value || "16:9");
        const ori = String(wOri.value || "横屏");
        let width = align8(wW.value || 720);
        let height = align8(wH.value || 960);
        let primary = props.__empty_primary || 'width';
        // 宽高联动与横竖屏/比例联动
        const lastMode = props.__empty_last_mode;
        const lastW = props.__empty_last_w;
        const lastH = props.__empty_last_h;
        const lastOri = props.__empty_last_orientation;
        const wChanged = (typeof lastW !== 'undefined') && lastW !== width;
        const hChanged = (typeof lastH !== 'undefined') && lastH !== height;
        const curMode0 = String(wMode.value || mode);
        let curMode = curMode0;
        const modeChanged = (typeof lastMode !== 'undefined') && lastMode !== curMode;
        const oriChanged = (typeof lastOri !== 'undefined') && lastOri !== ori;
        if (wChanged && !hChanged) primary = 'width';
        else if (hChanged && !wChanged) primary = 'height';
        if (curMode !== 'custom') {
          let [rw, rh] = parseRatio(curMode);
          if (modeChanged) {
            const targetOri = (rw >= rh) ? '横屏' : '竖屏';
            if (ori !== targetOri) { wOri.value = targetOri; ori = targetOri; }
          } else if (oriChanged) {
            const flipped = flip(curMode);
            wMode.value = flipped; curMode = flipped;[rw, rh] = parseRatio(curMode);
          }
          // 无论是否检测到变化，只要是固定比例，就按主维度实时联动另一边
          if (primary === 'width') {
            const newH = align8(Math.round(width * rh / rw)); if (newH !== height) { wH.value = newH; height = newH; }
          } else {
            const newW = align8(Math.round(height * rw / rh)); if (newW !== width) { wW.value = newW; width = newW; }
          }
        }
        // 写回 last 状态
        props.__empty_last_orientation = ori;
        props.__empty_last_mode = curMode;
        props.__empty_last_w = width;
        props.__empty_last_h = height;
        props.__empty_primary = primary;
        n.properties = props;
      }
      const canvas = getCanvas(); const graph = getGraph();
      if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true, true);
    } catch { }
  }
  setInterval(syncEmptyLatent, 300);
  let prefillInstalled = false;
  function installPrefillListener() {
    try {
      if (prefillInstalled) return;
      const apiObj = (window.api || (window.app && window.app.api));
      if (apiObj && apiObj.addEventListener) {
        apiObj.addEventListener("jdsc.textgate.prefill", (evt) => {
          try {
            const detail = evt && evt.detail || {};
            const nodeId = detail.node; const text = detail.text || "";
            if (!nodeId) return; const gate = findNodeById(nodeId); if (!gate) return;
            const wEdit = (gate.widgets || []).find(w => String(w.name || "") === "edit_text");
            const wEnable = (gate.widgets || []).find(w => String(w.name || "") === "enable_edit");
            const wFree = (gate.widgets || []).find(w => String(w.name || "") === "free_pass");

            // Update edit text based on current mode
            if (wEdit) {
              const isEditMode = wEnable && wEnable.value;
              const isFreeMode = wFree && wFree.value;
              const typing = (typeof document !== 'undefined' ? document.activeElement : null);
              const isTyping = !!(typing && (typing.tagName === 'INPUT' || typing.tagName === 'TEXTAREA' || typing.isContentEditable));
              const manual = (gate.properties || {}).__manual_text_for_pass || "";
              if (isFreeMode) {
                wEdit.value = text;
                gate.properties = Object.assign({}, gate.properties || {}, { __last_edit_text: text });
                const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true);
              } else if (isEditMode && !isTyping) {
                // Red: show current upstream text, avoid stale manual override
                wEdit.value = text;
                gate.properties = Object.assign({}, gate.properties || {}, { __last_edit_text: text });
                const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function' && !isTyping) g.setDirtyCanvas(true, true);
              } else if (!isEditMode && !isFreeMode) {
                // Yellow: prefer manual text if present, else upstream
                wEdit.value = manual ? manual : text;
                gate.properties = Object.assign({}, gate.properties || {}, { __last_edit_text: text });
                const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function' && !isTyping) g.setDirtyCanvas(true, true);
              }
            }
          } catch { }
        });
        apiObj.addEventListener("jdsc.textgate.status", (evt) => {
          try {
            const detail = evt && evt.detail || {};
            const nodeId = detail.node; const passing = !!detail.passing; const manual = !!detail.manual; const free = !!detail.free; const edit = !!detail.edit;
            if (isTypingNow() && edit) return;
            if (!nodeId) return; const gate = findNodeById(nodeId); if (!gate) return;
            gate.properties = Object.assign({}, gate.properties || {}, { __jdsc_last_passing: passing, __jdsc_last_manual: manual });
            try {
              const wStatus = (gate.widgets || []).find(w => String(w.name || "") === "status");
              if (wStatus) wStatus.value = passing ? "🟢" : (manual ? "🟡" : "🔴");
            } catch { }
            try {
              if (typeof gate.__jdsc_base_bg === 'undefined') gate.__jdsc_base_bg = gate.bgcolor;
              if (typeof gate.__jdsc_base_color === 'undefined') gate.__jdsc_base_color = gate.color;
              const okEdit = !!edit;
              const okFree = !!free;
              if (okEdit) { gate.bgcolor = '#A02F2B'; gate.color = '#f0f0f0'; }
              else if (okFree) { gate.bgcolor = '#5E6B4D'; gate.color = '#f0f0f0'; }
              else { gate.bgcolor = '#8C7259'; gate.color = '#f0f0f0'; }
            } catch { }

            // Clear stale manual cache when in yellow and upstream is used
            try {
              if (!edit && !free && !manual) {
                const props = Object.assign({}, gate.properties || {});
                if (props.__manual_text_for_pass) {
                  props.__manual_text_for_pass = "";
                  gate.properties = props;
                }
              }
            } catch { }

            // Handle state transitions more carefully
            if (edit && !free) {
              // Red state - interrupt workflow but don't mess with LiteGraph modes
              setTimeout(() => {
                try {
                  // Only interrupt if we detect the workflow is actually running
                  // Don't change LiteGraph execution modes - let ComfyUI handle that
                  if (window.app && window.app.api && typeof window.app.api.fetchApi === 'function') {
                    // Check if there's an active prompt queue before interrupting
                    window.app.api.fetchApi('/queue')
                      .then(response => response.json())
                      .then(queueData => {
                        if (queueData && queueData.queue_running && queueData.queue_running.length > 0) {
                          // Only interrupt if there's actually something running
                          return window.app.api.fetchApi('/interrupt', { method: 'POST' });
                        }
                      })
                      .then(() => console.log('ComfyUI workflow interrupted when needed'))
                      .catch(err => console.log('No need to interrupt or interrupt failed:', err));
                  }
                } catch { }
              }, 200);  // Increased delay to avoid race conditions
            } else if (!edit && !free) {
              // Yellow state - ensure workflow can continue
              setTimeout(() => {
                try {
                  // Make sure the node is in a state that allows execution
                  // Don't force specific LiteGraph modes, just ensure no blocking
                  console.log('Text gate in yellow state - ready to pass captured text');
                } catch { }
              }, 200);
            }

            // no auto-toggle for IgnoreGroup; respect user's selected target_group and enable
            const g = getGraph();
            const ae = (typeof document !== 'undefined' ? document.activeElement : null);
            const typing = !!(ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable));
            if (g && typeof g.setDirtyCanvas === 'function' && !typing) g.setDirtyCanvas(true, true);
          } catch { }
        });
        apiObj.addEventListener("jdsc.emptylatent.update", (evt) => {
          try {
            const detail = evt && evt.detail || {};
            const nodeId = detail.node;
            if (!nodeId) return;
            const n = findNodeById(nodeId);
            if (!n) return;
            const ws = n.widgets || [];
            const setW = (name, val) => { const w = ws.find(w => String(w.name || "") === String(name || "")); if (w) w.value = val; };
            if (typeof detail.size_mode !== 'undefined') setW('size_mode', detail.size_mode);
            if (typeof detail.orientation !== 'undefined') setW('orientation', detail.orientation);
            if (typeof detail.width !== 'undefined') setW('width', detail.width);
            if (typeof detail.height !== 'undefined') setW('height', detail.height);
            if (typeof detail.frames !== 'undefined') setW('frames', detail.frames);
            const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true);
          } catch { }
        });
        prefillInstalled = true;
      }
    } catch { }
  }
  installPrefillListener();
  const _jdscInstallTimer = setInterval(() => { if (prefillInstalled) { clearInterval(_jdscInstallTimer); } else installPrefillListener(); }, 600);
  function installErrorSuppressor() {
    try {
      if (window.__jdsc_err_observer_installed) return;
      const obs = new MutationObserver((mutations) => {
        try {
          const sels = ['.modal', '.comfy-modal', '.dialog', '[role="dialog"]', '.litegraph-dialog', '.graphdialog', '.modal-backdrop', '.notification', '.toast'];
          const all = [];
          sels.forEach(s => { try { document.querySelectorAll(s).forEach(el => all.push(el)); } catch { } });
          let hasErr = false;
          all.forEach(el => {
            try {
              const txt = String(el.textContent || '').toLowerCase();
              const should = txt.includes('jdsc.textgate') || txt.includes('wuhuotextgate');
              if (should) { hasErr = true; }
            } catch { }
          });
          window.__jdsc_error_modal_open = !!hasErr;
        } catch { }
      });
      obs.observe(document.body, { childList: true, subtree: true });
      try {
        const Dialog = (window.ComfyDialog) || (window.app && window.app.ui && window.app.ui.dialog) || null;
        if (Dialog && typeof Dialog.show === 'function') {
          const orig = Dialog.show.bind(Dialog);
          Dialog.show = function (title, msg, ...rest) {
            try {
              const t = String(title || '').toLowerCase();
              const m = String(msg || '').toLowerCase();
              if (t.includes('wuhuotextgate') || m.includes('jdsc.textgate')) { window.__jdsc_error_modal_open = true; }
            } catch { }
            return orig(title, msg, ...rest);
          };
        }
        const UI = window.app && window.app.ui;
        if (UI && typeof UI.showError === 'function') {
          const orig2 = UI.showError.bind(UI);
          UI.showError = function (title, msg, ...rest) {
            try {
              const t = String(title || '').toLowerCase();
              const m = String(msg || '').toLowerCase();
              if (t.includes('wuhuotextgate') || m.includes('jdsc.textgate')) { window.__jdsc_error_modal_open = true; }
            } catch { }
            return orig2(title, msg, ...rest);
          };
        }
        if (!window.__jdsc_err_click_handler_installed) {
          window.addEventListener('click', (e) => {
            try {
              if (!window.__jdsc_error_modal_open) return;
              const sels = ['.modal', '.comfy-modal', '.dialog', '[role="dialog"]', '.litegraph-dialog', '.graphdialog'];
              const targets = [];
              sels.forEach(s => { try { document.querySelectorAll(s).forEach(el => targets.push(el)); } catch { } });
              let removed = false;
              targets.forEach(el => {
                try {
                  const txt = String(el.textContent || '').toLowerCase();
                  const should = txt.includes('jdsc.textgate') || txt.includes('wuhuotextgate');
                  if (should) { el.remove(); removed = true; }
                } catch { }
              });
              if (removed) { window.__jdsc_error_modal_open = false; e.stopPropagation(); e.preventDefault(); }
            } catch { }
          }, true);
          window.__jdsc_err_click_handler_installed = true;
        }
      } catch { }
      window.__jdsc_err_observer_installed = true;
    } catch { }
  }
  function closeTextGateErrorDialogs() {
    try {
      if (!anyTextGateEditLock()) return;
      const sels = [
        '.modal', '.comfy-modal', '.dialog', '[role="dialog"]',
        '.litegraph-dialog', '.graphdialog', '.modal-backdrop',
        '.notification', '.toast', '.svelte-modal', '.modal-container',
        '#dialog-container', '.dialog-container', '.comfy-modal-container'
      ];
      let hasTextGateModal = false;
      function tryClose(el) {
        try {
          const txt = String(el.textContent || '').toLowerCase();
          if (!(txt.includes('jdsc.textgate') || txt.includes('wuhuotextgate'))) return;
          hasTextGateModal = true;
          const btns = el.querySelectorAll('.close, .modal-close, [aria-label="Close"], button');
          let clicked = false;
          btns.forEach(b => {
            try {
              const t = String(b.textContent || '').toLowerCase();
              if (b.classList.contains('close') || t.includes('×') || t.includes('close') || t.includes('关闭')) {
                b.dispatchEvent(new MouseEvent('click', { bubbles: true }));
                clicked = true;
              }
            } catch { }
          });
          if (!clicked) {
            const parent = el.closest('[aria-modal="true"], .modal, .comfy-modal, .dialog, .litegraph-dialog, .graphdialog, .modal-container');
            if (parent) { parent.remove(); return; }
            el.remove();
          }
        } catch { }
      }
      sels.forEach(s => { try { document.querySelectorAll(s).forEach(tryClose); } catch { } });
      if (hasTextGateModal) {
        try { document.body.classList.remove('modal-open', 'has-dialog', 'comfy-modal-open'); } catch { }
      }
    } catch { }
  }
  function findWidgetByKeyOrLabel(node, key) {
    const ws = node.widgets || [];
    const labelMap = {
      enable_edit: ["enable_edit", "编辑文本"],
      free_pass: ["free_pass", "自由传递"],
      edit_text: ["edit_text", "编辑内容"],
      in_text: ["in_text", "输入文本"],
      status: ["status", "状态"],
    };
    const candidates = labelMap[key] || [key];
    const w = ws.find(x => candidates.includes(String(x.name || "")));
    return w || null;
  }
  function inputLinked(n) {
    try {
      const names = ["in_text", "输入文本"]; const idx = (n.inputs || []).findIndex(i => names.includes(String(i.name || "")));
      if (idx < 0) return false; const inp = n.inputs[idx]; const g = getGraph(); if (!g) return false;
      if (inp && typeof inp.link !== 'undefined' && inp.link != null) { const l = g.links && g.links[inp.link]; return !!l; }
      const ls = inp && inp.links; if (Array.isArray(ls)) { return ls.some(id => g.links && g.links[id]); }
      return false;
    } catch { return false; }
  }
  function scheduleAutoRun(node) {
    try {
      if (!window.app) return;
      const run = async () => {
        try {
          const api = window.app.api;
          if (api && typeof api.fetchApi === 'function') {
            const q = await api.fetchApi('/queue').then(r => r.json()).catch(() => null);
            if (q && q.queue_running && q.queue_running.length > 0) return;
          }
          if (window.app.queuePrompt && typeof window.app.queuePrompt === 'function') {
            await window.app.queuePrompt();
            return;
          }
          if (window.app.graphToPrompt && api && typeof api.fetchApi === 'function') {
            const body = window.app.graphToPrompt();
            await api.fetchApi('/prompt', { method: 'POST', body: JSON.stringify(body) });
          }
        } catch { }
      };
      clearTimeout(node.__jdsc_run_timer);
      node.__jdsc_run_timer = setTimeout(run, 300);
    } catch { }
  }
  function isPassing(n) {
    try { const wf = findWidgetByKeyOrLabel(n, "free_pass"); const on = wf ? !!wf.value : false; return on && inputLinked(n); } catch { return false; }
  }
  function applyTextGateUi(node) {
    if (!node || node.__jdsc_ui_bound) return; node.__jdsc_ui_bound = true;

    // CRITICAL: Protect text gate nodes from being muted/stuck
    // Ensure they can always execute regardless of group settings
    try {
      // Reset any potentially stuck execution mode
      const LG = window.LiteGraph || {};
      const MODE_ALWAYS = (typeof LG.ALWAYS !== "undefined" ? LG.ALWAYS : 0);

      // Only reset if it's clearly wrong (NEVER mode when it should execute)
      if (node.mode !== undefined && node.mode !== MODE_ALWAYS) {
        console.log(`Resetting execution mode for text gate node ${node.id}: was ${node.mode}, setting to ${MODE_ALWAYS}`);
        node.mode = MODE_ALWAYS;
      }
    } catch (e) {
      console.warn("Failed to reset execution mode:", e);
    }

    try { ensureStatusWidget(node); } catch { }
    const we = findWidgetByKeyOrLabel(node, "enable_edit");
    const wf = findWidgetByKeyOrLabel(node, "free_pass");
    const wEdit = findWidgetByKeyOrLabel(node, "edit_text");
    try { if (we && wf) { if (we.value) wf.value = false; if (wf.value) we.value = false; } } catch { }
    function setAllIgnoreGroupsEnabled(on) { try { const g = getGraph(); const arr = (g && (g._nodes || g.nodes)) || []; arr.forEach(n => { const t = String(n.type || ""); if (!t.includes("WuhuoIgnoreGroup")) return; const wE = (n.widgets || []).find(w => String(w.name || "") === "enable"); if (wE) wE.value = !!on; }); syncIgnoreGroups(); const g2 = getGraph(); if (g2 && typeof g2.setDirtyCanvas === 'function') g2.setDirtyCanvas(true, true); } catch { } }
    if (we) {
      const oc = we.callback; we.callback = (v) => {
        try {
          oc?.call(node, v); if (v && wf) wf.value = false; const on = (!!v) || (!!(wf && wf.value)); setAllIgnoreGroupsEnabled(on); const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true);
          // When transitioning FROM edit mode (red to yellow), ensure text is ready
          if (!v) {
            setTimeout(() => {
              try {
                // Refresh the display and ensure graph is updated
                if (window.app.graph && typeof window.app.graph.setDirtyCanvas === 'function') {
                  window.app.graph.setDirtyCanvas(true, true);
                }
                // Store the current edit text for passing when switching to yellow mode
                const wE2 = findWidgetByKeyOrLabel(node, "edit_text");
                if (wE2 && typeof wE2.value !== 'undefined') {
                  node.properties = Object.assign({}, node.properties || {}, { __manual_text_for_pass: String(wE2.value || "") });
                }
                const okManual = !!(wE2 && String(wE2.value || "").length);
                const okLink = inputLinked(node);
                if (okManual || okLink) scheduleAutoRun(node);
              } catch { }
            }, 50);
          }
        } catch { }
      };
    }
    try {
      const release = () => { try { const style = document.getElementById('jdsc-hide-modals'); if (style) style.remove(); window.__jdsc_clicked_once = false; window.__jdsc_sent_escape = false; } catch { } };
      if (we) {
        const prev = we.callback; we.callback = (v) => { try { prev?.call(node, v); if (!v) release(); const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true); } catch { } };
      }
    } catch { }
    if (wf) {
      const oc2 = wf.callback; wf.callback = (v) => {
        try {
          oc2?.call(node, v); if (v && we) we.value = false; const on = (!!v) || (!!(we && we.value)); setAllIgnoreGroupsEnabled(on); const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true);
          // When transitioning TO pass mode, just update the display but don't auto-trigger workflow
          if (v) {
            setTimeout(() => {
              try {
                // Just refresh the display, don't auto-queue workflow
                if (window.app.graph && typeof window.app.graph.setDirtyCanvas === 'function') {
                  window.app.graph.setDirtyCanvas(true, true);
                }
              } catch { }
            }, 50);
          }
        } catch { }
      };
    }
    if (wEdit) { const oc3 = wEdit.callback; wEdit.callback = (val) => { try { oc3?.call(node, val); node.properties = Object.assign({}, node.properties || {}, { __manual_text_for_pass: String(val || "") }); const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true); } catch { } }; }
    // no execution mode enforcement here; colors are UI-only
    // no execution mode enforcement; color is UI-only
    const origFG = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
      try { if (origFG) origFG.call(this, ctx); } catch { }
      try {
        const prop = this.properties || {};
        const hasP = Object.prototype.hasOwnProperty.call(prop, '__jdsc_last_passing');
        const hasM = Object.prototype.hasOwnProperty.call(prop, '__jdsc_last_manual');
        const okP = hasP ? !!prop.__jdsc_last_passing : isPassing(this);
        const okM = hasM ? !!prop.__jdsc_last_manual : false;
        const color = okP ? "#5E6B4D" : (okM ? "#8C7259" : "#A02F2B");
        try { const wStatus = findWidgetByKeyOrLabel(this, "status"); if (wStatus) wStatus.value = okP ? "🟢" : (okM ? "🟡" : "🔴"); } catch { }
        const ox = Array.isArray(this.pos) ? this.pos[0] : 0;
        const oy = Array.isArray(this.pos) ? this.pos[1] : 0;
        let px = 6; let py = 14;
        try { const names = ["in_text", "输入文本"]; const idx = (this.inputs || []).findIndex(i => names.includes(String(i.name || ""))); if (idx >= 0 && typeof this.getConnectionPos === 'function') { const p = this.getConnectionPos(false, idx); if (Array.isArray(p)) { px = (p[0] - ox) - 8; py = (p[1] - oy); } } } catch { }
        try { /* skip status dot drawing */ } catch { }
        let lx = (this.size ? this.size[0] - 16 : 150);
        let ly = 28;
        try { const wFree = findWidgetByKeyOrLabel(this, "free_pass"); if (wFree) { const yv = (typeof wFree.y === 'number') ? wFree.y : (typeof wFree.last_y === 'number' ? wFree.last_y : null); if (yv !== null) ly = yv + 8; } } catch { }
        try { /* skip right dot drawing */ } catch { }
        const label = okP ? "PASS" : (okM ? "EDIT" : "STOP");
        let tx = (this.size ? this.size[0] - 64 : 120);
        let ty = ly - 8;
        try { /* skip STOP/PASS/EDIT label drawing */ } catch { }
        try {
          const we = findWidgetByKeyOrLabel(this, "enable_edit");
          const wf = findWidgetByKeyOrLabel(this, "free_pass");
          const onEdit = !!(we && we.value);
          const onFree = !!(wf && wf.value);
          if (onEdit && !onFree) { /* skip purple border drawing */ }
          if (onFree) {
            const we = findWidgetByKeyOrLabel(this, "edit_text");
            const s = this.size || [160, 80];
            const yv = we ? ((typeof we.y === 'number') ? we.y : (typeof we.last_y === 'number' ? we.last_y : 60)) : 60;
            const pad = 8;
            const x = 6;
            const y = yv + pad;
            const w = (s[0] - 12);
            const h = Math.max(24, s[1] - y - 12);
            ctx.save();
            ctx.globalAlpha = 0.18;
            ctx.fillStyle = '#888';
            ctx.fillRect(x, y, w, h);
            ctx.restore();
          }
        } catch { }
      } catch { }
    };
  }
  function applyTextGateUiToExisting() {
    const g = getGraph(); const arr = (g && (g._nodes || g.nodes)) || []; arr.forEach(n => { if (String(n.type || "").includes("WuhuoTextGate")) { try { applyTextGateUi(n); } catch { } } });
  }
  const _jdscUiBindTick = setInterval(() => { try { applyTextGateUiToExisting(); } catch { } }, 800);
  function applyModalVisibility() {
    try {
      const style = document.getElementById('jdsc-hide-modals');
      if (style) style.remove();
      try { window.__jdsc_clicked_once = false; } catch { }
    } catch { }
  }
  const _jdscHideTick = setInterval(() => { try { applyModalVisibility(); } catch { } }, 800);
  function anyTextGateEditLock() {
    try { const g = getGraph(); const arr = (g && (g._nodes || g.nodes)) || []; return arr.some(n => { const t = String(n.type || ""); if (!t.includes("WuhuoTextGate")) return false; const we = (n.widgets || []).find(w => String(w.name || "") === "enable_edit"); const wf = (n.widgets || []).find(w => String(w.name || "") === "free_pass"); return !!(we && we.value) && !(wf && wf.value); }); } catch { return false; }
  }
  function allGroups() { const g = getGraph(); return (g && (g._groups || g.groups)) || []; }
  function groupNodesOf(grp) {
    try {
      const g = getGraph(); const nodes = (g && (g._nodes || g.nodes)) || []; const gx = grp.pos[0], gy = grp.pos[1], gw = grp.size[0], gh = grp.size[1];
      return nodes.filter(nd => { try { const x = nd.pos[0], y = nd.pos[1]; return x >= gx && y >= gy && x <= gx + gw && y <= gy + gh; } catch { return false; } });
    } catch { return []; }
  }
  function setGroupMode(grp, on) {
    try {
      const g = getGraph();
      const all = groupNodesOf(grp);
      const list = all.filter(nd => {
        const t = String(nd.type || "");
        // IMPORTANT: Never modify WuhuoTextGate or WuhuoIgnoreGroup nodes
        // This prevents the "mute" issue where text gates get stuck in NEVER mode
        return !t.includes("WuhuoTextGate") && !t.includes("WuhuoIgnoreGroup");
      });
      const LG = window.LiteGraph || {};
      const MODE_ON = (typeof LG.ALWAYS !== "undefined" ? LG.ALWAYS : 0);
      const MODE_OFF = (typeof LG.NEVER !== "undefined" ? LG.NEVER : 4);

      list.forEach(nd => {
        try {
          // Double-check: never modify text gate nodes
          const type = String(nd.type || "");
          if (type.includes("WuhuoTextGate") || type.includes("WuhuoIgnoreGroup")) {
            console.log(`Skipping mode change for ${type} node ${nd.id} - protecting text gate functionality`);
            return;
          }
          nd.mode = on ? MODE_ON : MODE_OFF;
        } catch { }
      });

      if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true);
    } catch { }
  }
  function refreshGroupChoices(node) {
    try {
      const names = allGroups().map(gr => String(gr.title || "")).filter(Boolean);
      let wg = (node.widgets || []).find(w => String(w.name || "") === "target_group");
      const saved = String(((node.properties || {}).__jdsc_target_group) || "");
      const desired = saved || (wg ? String(wg.value || "") : "");
      if (!wg) {
        if (typeof node.addWidget === 'function') {
          const initVal = desired || names[0] || "";
          wg = node.addWidget("combo", "target_group", initVal, null, { values: names });
        }
      } else if (wg && wg.options) {
        const cur = desired || String(wg.value || "");
        const vals = names.slice();
        if (cur && !names.includes(cur)) { vals.unshift(cur); }
        wg.options.values = vals;
        if (cur) { wg.value = cur; } else { wg.value = names[0] || ""; }
      }
    } catch { }
  }
  function applyIgnoreGroupUi(node) {
    if (node.__jdsc_ig_bound) return; node.__jdsc_ig_bound = true;
    try { refreshGroupChoices(node); } catch { }
    try {
      const hasBtn = (node.widgets || []).some(w => String(w.name || "") === "refresh");
      if (!hasBtn && typeof node.addWidget === 'function') {
        node.addWidget("button", "refresh", "", () => { try { refreshGroupChoices(node); const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true); } catch { } }, {});
      }
    } catch { }
    try {
      const wEnable = (node.widgets || []).find(w => String(w.name || "") === "enable");
      const wTarget = (node.widgets || []).find(w => String(w.name || "") === "target_group");
      if (wEnable) {
        const oc = wEnable.callback;
        wEnable.callback = (v) => { try { oc?.call(node, v); syncIgnoreGroups(); const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true); } catch { } };
      }
      if (wTarget) {
        const oc2 = wTarget.callback;
        wTarget.callback = (v) => { try { oc2?.call(node, v); node.properties = Object.assign({}, node.properties || {}, { __jdsc_target_group: String(v || "") }); syncIgnoreGroups(); const g = getGraph(); if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true); } catch { } };
        // ensure widget reflects saved value after initial bind
        try { const saved = String(((node.properties || {}).__jdsc_target_group) || ""); if (saved) { wTarget.value = saved; } } catch { }
      }
    } catch { }
    try { const origFG = node.onDrawForeground; node.onDrawForeground = function (ctx) { try { if (origFG) origFG.call(this, ctx); } catch { } }; } catch { }
  }
  function applyIgnoreGroupUiToExisting() {
    const g = getGraph(); const arr = (g && (g._nodes || g.nodes)) || []; arr.forEach(n => { if (String(n.type || "").includes("WuhuoIgnoreGroup")) { try { applyIgnoreGroupUi(n); } catch { } } });
    const gg = getGraph(); if (gg && typeof gg.setDirtyCanvas === 'function') gg.setDirtyCanvas(true, true);
  }
  const _jdscIgnoreBindTick = setInterval(() => { try { applyIgnoreGroupUiToExisting(); } catch { } }, 1200);
  function syncIgnoreGroups() {
    try {
      const g = getGraph(); const nodes = (g && (g._nodes || g.nodes)) || []; const groups = (g && (g._groups || g.groups)) || [];
      nodes.forEach(n => {
        const t = String(n.type || ""); if (!t.includes("WuhuoIgnoreGroup")) return;
        const wEnable = (n.widgets || []).find(w => String(w.name || "") === "enable");
        const wTarget = (n.widgets || []).find(w => String(w.name || "") === "target_group");
        const on = wEnable ? !!wEnable.value : false;
        const title = wTarget ? String(wTarget.value || "") : "";
        const grp = groups.find(gr => String(gr.title || "") === title);
        if (grp) {
          grp.collapsed = !on;
          try { grp.ue_properties = Object.assign({}, grp.ue_properties || {}, { ignore: !on }); } catch { }
          setGroupMode(grp, on);
        }
      });
      if (g && typeof g.setDirtyCanvas === 'function') g.setDirtyCanvas(true, true);
    } catch { }
  }
  const _jdscIgnoreSyncTick = setInterval(() => { try { syncIgnoreGroups(); } catch { } }, 600);
  try {
    if (window.app && window.app.registerExtension) {
      window.app.registerExtension({
        name: "jdsc.textgate.ext",
        async setup() {
          try {
            installPrefillListener();
            if (window.__jdsc_debug || localStorage.getItem('jdsc:debug') === 'true') { installErrorSuppressor(); }
            // Track user interactions to avoid auto-clicking during normal use
            if (window.app && window.app.canvas && window.app.canvas.canvas) {
              const canvas = window.app.canvas.canvas;
              ['mousedown', 'mouseup', 'click', 'pointerdown', 'pointerup'].forEach(eventType => {
                canvas.addEventListener(eventType, () => {
                  window.__jdsc_last_canvas_interaction = Date.now();
                }, true);
              });
            }
          } catch { }
        },
        async nodeCreated(node) { try { if (String(node.type || "").includes("WuhuoTextGate")) setTimeout(() => installPrefillListener(), 100); } catch { } }
      });
    }
  } catch { }
  try {
    if (window.app && window.app.registerExtension) {
      // removed run guard to avoid blocking normal runs; rely on backend cancel
    }
  } catch { }
  try {
    if (window.app && window.app.registerExtension) {
      window.app.registerExtension({
        name: "jdsc.textgate.ui",
        async setup() {
          try {
            const g = getGraph();
            const arr = (g && (g._nodes || g.nodes)) || [];
            arr.forEach(n => { if (String(n.type || "").includes("WuhuoTextGate")) { try { applyTextGateUi(n); } catch { } } });
            const gg = getGraph(); if (gg && typeof gg.setDirtyCanvas === 'function') gg.setDirtyCanvas(true, true);
          } catch { }
        },
        async nodeCreated(node) {
          try { if (String(node.type || "").includes("WuhuoTextGate")) applyTextGateUi(node); } catch { }
        }
      });
    }
  } catch { }
})();
