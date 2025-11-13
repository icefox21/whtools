(() => {
  const KEY_FAVS = "jdsc:favorites";
  const KEY_GROUPS = "jdsc:groups";
  const KEY_FRAGS = "jdsc:frags";
  const KEY_HOTKEY = "jdsc:hotkey";
  const KEY_MODAL_POS = "jdsc:modalPos";
  const KEY_FLOAT_POS = "jdsc:floatPos";
  const KEY_LANG = "jdsc:lang";
  let NODE_CACHE = null;

  function load(key, def) {
    try {
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

  function getFrags() {
    let frags = load(KEY_FRAGS, []);
    if (!Array.isArray(frags)) {
      frags = [];
      save(KEY_FRAGS, frags);
    }
    return frags;
  }

  function save(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
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
    try { getAllNodeDefs(); } catch (e) {}
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
      .jdsc-floating { position: fixed; right: 16px; bottom: 16px; width: 38px; height: 38px; border-radius: 19px; background: #fa3d64; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 18px; z-index: 10000; cursor: grab; box-shadow: 0 6px 16px rgba(0,0,0,.3); }
      .jdsc-floating:active { cursor: grabbing; }
      .jdsc-modal { position: fixed; width: 460px; max-height: 70vh; background: #1c1f22; color: #d9d9d9; border-radius: 8px; box-shadow: 0 10px 24px rgba(0,0,0,.45); overflow: hidden; z-index: 9999; }
      .jdsc-header { display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid #2a2e32; }
      .jdsc-title { font-size: 16px; font-weight: 600; flex: 1; }
      .jdsc-close { width: 26px; height: 26px; border-radius: 6px; background: #2a2e32; display: flex; align-items: center; justify-content: center; cursor: pointer; }
      .jdsc-lang { width: 26px; height: 26px; border-radius: 6px; background: #2a2e32; display: flex; align-items: center; justify-content: center; cursor: pointer; margin-right: 8px; }
      .jdsc-tabs { display: flex; gap: 12px; padding: 8px 12px; border-bottom: 1px solid #2a2e32; width: 100%; box-sizing: border-box; }
      .jdsc-tab { flex: 1; text-align: center; padding: 6px 10px; border-radius: 6px; cursor: pointer; background: #2a2e32; color: #bfbfbf; }
      .jdsc-tab.active { background: #3a3f44; color: #fff; }
      .jdsc-search { display: flex; align-items: center; gap: 8px; padding: 8px 12px; position: relative; }
      .jdsc-search input { flex: 1; height: 30px; border-radius: 6px; border: 1px solid #2a2e32; background: #14181b; color: #d9d9d9; padding: 0 30px 0 8px; }
      .jdsc-clear { position: absolute; right: 20px; top: 50%; transform: translateY(-50%); width: 18px; height: 18px; border-radius: 4px; background: #fa3d64; color: #fff; display: none; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; }
      .jdsc-body { overflow: auto; max-height: 52vh; padding-bottom: 8px; }
      .jdsc-item { display: flex; gap: 10px; padding: 10px 12px; border-bottom: 1px solid #2a2e32; align-items: center; }
      .jdsc-item-main { flex: 1; min-width: 0; }
      .jdsc-name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .jdsc-sub { font-size: 12px; color: #9aa0a6; line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .jdsc-desc { font-size: 12px; color: #8a8f94; }
      .jdsc-heart { width: 18px; height: 18px; min-width: 18px; padding: 0; border-radius: 9px; background: #2a2e32; color: #d9d9d9; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; font-size: 12px; }
      .jdsc-heart.active { background: #fa3d64; color: #fff; }
      .jdsc-tertiary { font-size: 11px; color: #7a8086; line-height: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .jdsc-heartmark { color: #fa3d64; margin-right: 4px; }
      .jdsc-footer { display: flex; gap: 8px; padding: 8px 12px; border-top: 1px solid #2a2e32; align-items: center; justify-content: space-between; }
      .jdsc-btn { height: 28px; padding: 0 10px; border-radius: 6px; background: #2a2e32; color: #d9d9d9; display: inline-flex; align-items: center; cursor: pointer; white-space: nowrap; font-size: 12px; }
      .jdsc-tags { display: flex; gap: 8px; align-items: center; }
      .jdsc-tag { height: 24px; padding: 0 8px; border-radius: 6px; display: inline-flex; align-items: center; font-size: 12px; flex: 1; justify-content: center; }
      .jdsc-tag.orange { background: #fa8c16; color: #fff; }
      .jdsc-tag.purple { background: #722ed1; color: #fff; }
      .jdsc-tagsbar { display: flex; gap: 8px; padding: 8px 12px; border-bottom: 1px solid #2a2e32; width: 100%; box-sizing: border-box; }
      .jdsc-grid { display: flex; gap: 12px; padding: 0 12px; }
      .jdsc-col { flex: 1; min-width: 0; }
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
  function getViewport() { const canvas = getCanvas(); if (!canvas || !canvas.canvas || !canvas.ds) return {x:0,y:0,w:1200,h:800,scale:1}; const scale = canvas.ds.scale || 1; const off = canvas.ds.offset || [0,0]; const w = canvas.canvas.width || 1200; const h = canvas.canvas.height || 800; const x = (-off[0]) / scale; const y = (-off[1]) / scale; const gw = w / scale; const gh = h / scale; return {x,y,w:gw,h:gh,scale}; }
  function nodeSize(n) { const s = n && n.size; return Array.isArray(s) ? {w:s[0], h:s[1]} : {w:160, h:80}; }
  function rects(graph) { graph = graph || getGraph(); const arr = (graph && (graph._nodes||graph.nodes)) || []; return arr.map(n => { const s=nodeSize(n); return {x:n.pos[0], y:n.pos[1], w:s.w, h:s.h, id:n.id, ref:n}; }); }
  function rectsExcept(excludeNodes){ const ex = new Set((excludeNodes||[]).filter(Boolean)); return rects().filter(r => !ex.has(r.ref)); }
  function intersect(a,b,pad=40){ return !(a.x+a.w+pad<=b.x || b.x+b.w+pad<=a.x || a.y+a.h+pad<=b.y || b.y+b.h+pad<=a.y); }
  function findFreeRect(w,h){ const vp = getViewport(); const rs = rects(); const cx = vp.x + vp.w/2, cy = vp.y + vp.h/2; const step = 60; const maxR = Math.max(vp.w,vp.h)*2; for(let r=0;r<maxR;r+=step){ for(let dx=-r; dx<=r; dx+=step){ for(let dy=-r; dy<=r; dy+=step){ const x = Math.round(cx+dx - w/2), y = Math.round(cy+dy - h/2); const candidate = {x,y,w,h}; let ok=true; for(const rr of rs){ if (intersect(candidate, rr)) { ok=false; break; } } if (ok) return candidate; } } } return {x:vp.x+10,y:vp.y+10,w,h}; }
  function findFreeRectGlobal(w,h, rsOverride){ const rs = rsOverride || rects(); if (rs.length===0) { const vp=getViewport(); return {x:vp.x+vp.w/2 - w/2, y:vp.y+vp.h/2 - h/2, w,h}; } const minX=Math.min(...rs.map(r=>r.x)); const minY=Math.min(...rs.map(r=>r.y)); const maxX=Math.max(...rs.map(r=>r.x+r.w)); const maxY=Math.max(...rs.map(r=>r.y+r.h)); const cx=(minX+maxX)/2, cy=(minY+maxY)/2; const step=40; const maxR=4000; // denser wide scan
    // try to the right
    let candidate={x:maxX+step,y:cy - h/2,w,h}; if (!rs.some(rr=>intersect(candidate,rr))) return candidate;
    // try below
    candidate={x:cx - w/2,y:maxY+step,w,h}; if (!rs.some(rr=>intersect(candidate,rr))) return candidate;
    // spiral search around center of all nodes
    for(let r=step;r<maxR;r+=step){ for(let dx=-r; dx<=r; dx+=step){ for(let dy=-r; dy<=r; dy+=step){ const x=Math.round(cx+dx - w/2), y=Math.round(cy+dy - h/2); const cand={x,y,w,h}; let ok=true; for(const rr of rs){ if (intersect(cand,rr)) { ok=false; break; } } if (ok) return cand; } } }
    // fallback far right
    return {x:maxX+step*2, y:minY + step, w, h}; }
  function centerOnRect(rect){
    const canvas=getCanvas(); const graph=getGraph(); if(!canvas) return;
    if (typeof canvas.centerOnNode === 'function') {
      try { canvas.centerOnNode({pos:[rect.x,rect.y], size:[rect.w,rect.h]}); } catch {}
    } else if (canvas.ds && canvas.canvas) {
      const s=canvas.ds.scale||1; const cw=canvas.canvas.width||1200; const ch=canvas.canvas.height||800; const cx=rect.x+rect.w/2; const cy=rect.y+rect.h/2; canvas.ds.offset[0] = -cx*s + cw/2; canvas.ds.offset[1] = -cy*s + ch/2;
    }
    if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true,true);
    if (typeof canvas.draw === 'function') setTimeout(()=>canvas.draw(true,true),0);
  }
  function colorizeNode(n){ }
  function selectNodes(nodes){
    const canvas=getCanvas(); const graph=getGraph(); const map = {};
    nodes.forEach(n=>{ if (n) { n.selected=true; map[n.id]=n; } });
    if (canvas) {
      canvas.selected_nodes = map;
      canvas.last_selected_node = nodes.filter(Boolean).slice(-1)[0] || null;
      canvas.dirty_canvas = true; canvas.dirty_bgcanvas = true;
    }
    if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true,true);
    if (canvas && typeof canvas.draw === 'function') setTimeout(()=>canvas.draw(true,true),0);
  }
  function getNodeBounds(n){ const sz = Array.isArray(n.size) ? n.size : [160,80]; return { x: n.pos[0], y: n.pos[1], w: sz[0], h: sz[1] }; }
  function addNodeByType(type){
    try {
      const graph=getGraph(); const canvas=getCanvas(); if(!graph||!window.LiteGraph) throw new Error('nograph');
      const node=window.LiteGraph.createNode(type); if(!node) throw new Error('nonode');
      const s=nodeSize(node); const pos=findFreeRectGlobal(s.w,s.h); node.pos=[pos.x,pos.y]; colorizeNode(node); graph.add(node);
      if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true,true);
      selectNodes([node]); centerOnRect(pos);
      // re-evaluate after render and relocate if overlapping
      const relocate = () => {
        try {
          const rs = rectsExcept([node]);
          const b = getNodeBounds(node);
          const overlapping = rs.some(r => intersect(b, r));
          if (!overlapping) return;
          const cand = findFreeRectGlobal(b.w, b.h, rs);
          node.pos = [cand.x, cand.y];
          if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true,true);
          selectNodes([node]); centerOnRect(cand);
        } catch {}
      };
      setTimeout(relocate, 0); setTimeout(relocate, 150); setTimeout(relocate, 500); setTimeout(relocate, 1000);
      return node;
    } catch(e){
      try {
        const graph=getGraph(); if(!graph||!window.LiteGraph) return null; const node=window.LiteGraph.createNode(type); if(!node) return null; node.pos=[120,120]; graph.add(node);
        if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true,true);
        selectNodes([node]);
        return node;
      } catch{ return null; }
    }
  }

  function normalizeHotkeyString(str){
    const s = String(str || '').trim().toLowerCase();
    const parts = s.split('+').map(p=>p.trim()).filter(Boolean);
    const spec = { ctrl:false, alt:false, shift:false, meta:false, key:'' };
    parts.forEach(p=>{
      if (p==='ctrl' || p==='control') spec.ctrl = true;
      else if (p==='alt' || p==='option') spec.alt = true;
      else if (p==='shift') spec.shift = true;
      else if (p==='meta' || p==='cmd' || p==='win' || p==='super') spec.meta = true;
      else spec.key = p;
    });
    return spec;
  }
  function eventKeyString(e){
    const k = String(e.key || '').toLowerCase();
    if (k===' ') return 'space';
    if (k==='escape') return 'esc';
    return k;
  }
  function matchHotkey(e, spec){
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
    let sx = 0, sy = 0, ex = 0, ey = 0, drag = false;
    const onDown = e => { drag = true; sx = e.clientX; sy = e.clientY; ex = el.offsetLeft; ey = el.offsetTop; el.style.right = "auto"; el.style.bottom = "auto"; };
    const onMove = e => { if (!drag) return; const dx = e.clientX - sx; const dy = e.clientY - sy; el.style.left = `${ex + dx}px`; el.style.top = `${ey + dy}px`; };
    const onUp = () => { drag = false; if (saveKey) { try { save(saveKey, { x: el.offsetLeft, y: el.offsetTop }); } catch {} } };
    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function createFloating(app, toggle) {
    ensureStyles();
    const btn = createEl("div", "jdsc-floating", "❤");
    const fp = load(KEY_FLOAT_POS, null);
    if (fp && typeof fp.x === "number" && typeof fp.y === "number") {
      btn.style.left = fp.x + "px";
      btn.style.top = fp.y + "px";
    } else {
      btn.style.left = "auto";
      btn.style.top = "auto";
    }
    btn.addEventListener("click", toggle);
    document.body.appendChild(btn);
    makeDraggable(btn, KEY_FLOAT_POS);
    return btn;
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
    const rel = (frag.nodes||[]).map(sn => { const dummy = window.LiteGraph.createNode(sn.type); const s = nodeSize(dummy); return {id: sn.id, type: sn.type, w:s.w, h:s.h, x: sn.pos[0]-(frag.anchor?frag.anchor[0]:0), y: sn.pos[1]-(frag.anchor?frag.anchor[1]:0), widgets: sn.widgets||[], props: sn.properties||{}}; });
    if (!rel.length) return;
    const minX = Math.min(...rel.map(r=>r.x)); const minY = Math.min(...rel.map(r=>r.y)); const maxX = Math.max(...rel.map(r=>r.x + r.w)); const maxY = Math.max(...rel.map(r=>r.y + r.h)); const rectW = maxX-minX; const rectH = maxY-minY;
    const free = findFreeRectGlobal(rectW, rectH);
    rel.forEach(r => { const node = window.LiteGraph.createNode(r.type); if (!node) return; node.pos = [free.x + (r.x-minX), free.y + (r.y-minY)]; graph.add(node); const ws = node.widgets || []; for (let i=0;i<ws.length && i<r.widgets.length;i++){ ws[i].value = r.widgets[i]; } node.properties = Object.assign({}, node.properties || {}, r.props || {}); colorizeNode(node); mapping[r.id]=node; });
    (frag.links || []).forEach(l => { const A = mapping[l.origin_id]; const B = mapping[l.target_id]; if (A && B && A.connect) { try { A.connect(l.origin_slot, B, l.target_slot); } catch (e) {} } });
    // compute exact bounds from actually added nodes
    const added = Object.values(mapping).filter(Boolean);
    const padGroup = 24;
    try {
      // use the reserved free rect to place the group so it never overlaps other nodes
      if (window.LiteGraph && window.LiteGraph.LGraphGroup) {
        const grp = new window.LiteGraph.LGraphGroup(frag.name || "片段");
        grp.pos = [free.x, free.y];
        grp.size = [rectW + padGroup*2, rectH + padGroup*2];
        if (typeof graph.add === 'function') graph.add(grp); else if (typeof graph.addGroup === 'function') graph.addGroup(grp);
      } else if (typeof graph.addGroup === 'function') {
        const grp = graph.addGroup(frag.name || "片段");
        grp.pos = [free.x, free.y];
        grp.size = [rectW + padGroup*2, rectH + padGroup*2];
      }
      if (graph && typeof graph.setDirtyCanvas === 'function') graph.setDirtyCanvas(true,true);
    } catch {}
    selectNodes(added); centerOnRect({x: free.x + padGroup, y: free.y + padGroup, w: rectW, h: rectH});
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
        const handler = () => { addNodeByType(it.type); };
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
        } catch (e) {}
      });
      row.appendChild(main);
      row.appendChild(heart);
      container.appendChild(row);
    });
  }

  function openModal(app) {
    ensureStyles();
    const modal = createEl("div", "jdsc-modal");
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
    const tabFav = createEl("div", "jdsc-tab", t("tab_fav"));
    tabs.appendChild(tabSearch);
    tabs.appendChild(tabFav);
    const tagsbar = createEl("div", "jdsc-tagsbar");
    const tagNodes = createEl("div", "jdsc-tag orange", t("tag_nodes"));
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

    const mp = load(KEY_MODAL_POS, null);
    if (mp && typeof mp.x === "number" && typeof mp.y === "number") {
      modal.style.left = mp.x + "px";
      modal.style.top = mp.y + "px";
    } else {
      modal.style.right = "70px";
      modal.style.bottom = "70px";
    }

    let mDown = false, sx = 0, sy = 0, ex = 0, ey = 0;
    header.style.cursor = "move";
    header.addEventListener("mousedown", e => {
      mDown = true; sx = e.clientX; sy = e.clientY; ex = modal.offsetLeft; ey = modal.offsetTop;
      modal.style.right = "auto"; modal.style.bottom = "auto";
    });
    window.addEventListener("mousemove", e => {
      if (!mDown) return; const dx = e.clientX - sx; const dy = e.clientY - sy; modal.style.left = (ex + dx) + "px"; modal.style.top = (ey + dy) + "px";
    });
    window.addEventListener("mouseup", () => {
      if (!mDown) return; mDown = false; save(KEY_MODAL_POS, { x: modal.offsetLeft, y: modal.offsetTop });
    });

    let mode = "fav";
    let favFilter = "all";
    let refreshing = false;

    function addGroupToCanvas(group) {
      const graph = getGraph(); if (!graph || !window.LiteGraph) return;
      const nodesData = group.nodes ? group.nodes.map((n,i)=>({id:n.id||i+1, type:n.type})) : (group.types || []).map((t, i) => ({ id: i + 1, type: t }));
      const previews = nodesData.map(nd => { const dummy = window.LiteGraph.createNode(nd.type); const s=nodeSize(dummy); return {id:nd.id,type:nd.type,w:s.w,h:s.h}; });
      const cols = Math.ceil(Math.sqrt(previews.length)) || 1; const gapX = 40, gapY = 30; const cellW = Math.max(...previews.map(p=>p.w)) + gapX; const cellH = Math.max(...previews.map(p=>p.h)) + gapY; const rows = Math.ceil(previews.length/cols);
      const rectW = cols*cellW; const rectH = rows*cellH;
      const free = findFreeRectGlobal(rectW, rectH);
      const mapping = {};
      previews.forEach((p,idx)=>{ const col = idx%cols; const row = Math.floor(idx/cols); const x = free.x + col*cellW + gapX/2; const y = free.y + row*cellH + gapY/2; const node = window.LiteGraph.createNode(p.type); if (!node) return; node.pos=[x,y]; colorizeNode(node); graph.add(node); mapping[p.id]=node; });
      (group.links || []).forEach(l => {
        const A = mapping[l.origin_id];
        const B = mapping[l.target_id];
        if (A && B && A.connect) {
          try { A.connect(l.origin_slot, B, l.target_slot); } catch (e) {}
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
                  try { A.connect(os, B, is); used.add(is); usedInputs.set(B, used); break; } catch (e) {}
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
        let items = [
          ...Object.keys(favs).map(t => ({ type: t, name: favs[t].name || t, orig: favs[t].orig || t, desc: "" })),
          ...groups.map(g => ({ type: `__group__:${g.id}`, name: g.name, desc: `${(g.nodes ? g.nodes.length : (g.types ? g.types.length : 0))} 个节点分组` })),
          ...frags.map(f => ({ type: `__frag__:${f.id}`, name: f.name, desc: `${(f.nodes ? f.nodes.length : 0)} 节点片段` }))
        ];
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
        const shown = kw ? items.filter(favHit).sort((a,b)=>{
          const hayA = ((a.name||"") + " " + (a.orig||"") + " " + (a.type||"") + " " + (a.desc||"")).toLowerCase();
          const hayB = ((b.name||"") + " " + (b.orig||"") + " " + (b.type||"") + " " + (b.desc||"")).toLowerCase();
          const cA = hayA.replace(/[\s_\-\/\\]+/g, "");
          const cB = hayB.replace(/[\s_\-\/\\]+/g, "");
          const score = (h,c) => { let s=0; if (kw && h.includes(kw)) s+=4; if (kwAlt && h.includes(kwAlt)) s+=2; if (kwSlug && h.replace(/[^a-z0-9]+/g, "").includes(kwSlug)) s+=1; if (hasCJK && kwCJK && c.includes(kwCJK)) s+=3; tokens.forEach(t=>{ if (h.includes(t.toLowerCase())) s+=1; }); return s; };
          return score(hayB,cB) - score(hayA,cA);
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

        function renderFavItem(target, it) {
          const row = createEl("div", "jdsc-item");
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
              const frags2 = load(KEY_FRAGS, []);
              const f = frags2.find(x => x.id === id);
              if (f) addFragmentToCanvas(f);
            });
          } else {
            row.style.cursor = "pointer";
            row.addEventListener("click", () => {
              const graph = getGraph(); if (!graph || !window.LiteGraph) return; const node = window.LiteGraph.createNode(it.type); if (!node) return; const s=nodeSize(node); const pos=findFreeRect(s.w,s.h); node.pos=[pos.x,pos.y]; colorizeNode(node); graph.add(node); selectNodes([node]); centerOnRect(pos);
            });
          }
          row.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            if (it.type.startsWith("__group__")) {
              const groups2 = getGroups();
              const id = it.type.split(":")[1];
              const g = groups2.find(x => x.id === id);
              if (!g) return;
              const nn = prompt(t("rename_group"), g.name);
              if (!nn) return;
              g.name = nn; save(KEY_GROUPS, groups2); refresh();
            } else if (it.type.startsWith("__frag__")) {
              const frags2 = getFrags();
              const id = it.type.split(":")[1];
              const f = frags2.find(x => x.id === id);
              if (!f) return;
              const nn = prompt(t("rename_frag"), f.name);
              if (!nn) return;
              f.name = nn; save(KEY_FRAGS, frags2); refresh();
            } else {
              const favs2 = getFavs();
              const cur = favs2[it.type]?.name || it.name;
              const nn = prompt(t("rename_fav"), cur);
              if (!nn) return;
              if (!favs2[it.type]) favs2[it.type] = { name: it.name, orig: it.orig || it.name };
              favs2[it.type].name = nn; save(KEY_FAVS, favs2); refresh();
            }
          });
          // append handled above
          const heart = createEl("div", "jdsc-heart active", "❤");
          heart.addEventListener("click", (e) => {
            e.stopPropagation();
            if (it.type.startsWith("__group__")) {
              const id = it.type.split(":")[1];
              const groups2 = getGroups();
              const idx = groups2.findIndex(x => x.id === id);
              if (idx >= 0 && confirm(t("confirm_unfav_group"))) { groups2.splice(idx, 1); save(KEY_GROUPS, groups2); refresh(); }
            } else if (it.type.startsWith("__frag__")) {
              const id = it.type.split(":")[1];
              const frags2 = getFrags();
              const idx = frags2.findIndex(x => x.id === id);
              if (idx >= 0 && confirm(t("confirm_unfav_frag"))) { frags2.splice(idx, 1); save(KEY_FRAGS, frags2); refresh(); }
            } else {
              const favs2 = getFavs();
              if (favs2[it.type] && confirm(t("confirm_unfav_node"))) { delete favs2[it.type]; save(KEY_FAVS, favs2); refresh(); }
            }
          });
          row.appendChild(main);
          row.appendChild(heart);
          target.appendChild(row);
        }

        leftList.forEach(it => renderFavItem(colL, it));
        rightList.forEach(it => renderFavItem(colR, it));
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
          let m; while ((m = re.exec(str))){ parts.push(m[0].toLowerCase()); }
          return parts;
        }
        const tokens = tokenize(kw);
        const items = all.filter(x => {
          const baseHit = x.search.includes(kw) || x.searchAlt.includes(norm);
          const slugHit = slugKw ? (x.searchSlug || "").includes(slugKw) : false;
          const cjkHit = hasCJK ? (x.searchCJK || "").includes(kwCJK) : false;
          const anyHit = baseHit || slugHit || cjkHit;
          if (!anyHit && tokens.length > 1){
            const hay = (x.search + " " + (x.searchCJK||""));
            const allTokens = tokens.every(t => hay.includes(t));
            return allTokens;
          }
          return anyHit;
        }).sort((a,b)=>{
          const hayA = (a.search + " " + (a.searchCJK||""));
          const hayB = (b.search + " " + (b.searchCJK||""));
          const score = h => {
            let s = 0; if (h.includes(kw)) s+=4; if (norm && h.includes(norm)) s+=2; if (slugKw && (a.searchSlug||"").includes(slugKw)) s+=1; if (hasCJK && h.includes(kwCJK)) s+=3; tokens.forEach(t=>{ if (h.includes(t)) s+=1; }); return s;
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
              row.addEventListener("click", () => { try { addNodeByType(it.type); } catch {} });
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
    tabFav.addEventListener("click", () => { mode = "fav"; favFilter = "all"; refresh(); });
    tabSearch.addEventListener("click", () => { mode = "search"; refresh(); });
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
      const hk = prompt(getLang()==="en"?"Enter hotkey (combo, e.g. Ctrl+Alt+F)":"输入快捷键（组合，如 Ctrl+Alt+F）", cur);
      if (!hk) return;
      const spec = normalizeHotkeyString(hk);
      const disp = [spec.ctrl?'Ctrl':null,spec.alt?'Alt':null,spec.shift?'Shift':null,spec.meta?'Meta':null,spec.key?spec.key.toUpperCase():null].filter(Boolean).join('+');
      save(KEY_HOTKEY, disp.toLowerCase());
      alert(`${t("set_hotkey_done")}${disp}`);
    });


    tabFav.click();
  }

  function setup(app) {
    const toggle = () => {
      try {
        const existing = document.querySelector(".jdsc-modal");
        if (existing) existing.remove(); else openModal(app || window.app);
      } catch (e) {
        alert("無惑收藏面板打开失败，请刷新页面重试");
      }
    };
    if (!document.querySelector(".jdsc-floating")) {
      createFloating(app, toggle);
    }

    let hkStr = load(KEY_HOTKEY, "f");
    let hkSpec = normalizeHotkeyString(hkStr);
    window.addEventListener("keydown", e => {
      try { if (matchHotkey(e, hkSpec)) { e.preventDefault(); toggle(); } } catch {}
    });
  }

  const boot = () => {
    if (window.app && window.LiteGraph) setup(window.app);
    else setTimeout(boot, 500);
  };
  boot();
})();
