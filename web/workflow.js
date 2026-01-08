// 工作流管理前端代码
(() => {
  const KEY_WF_FOLDERS = "jdsc:workflow_folders";
  const KEY_WF_FAVS = "jdsc:workflow_favorites";
  const KEY_WF_MODAL_POS = "jdsc:workflowModalPos";
  const KEY_WF_HOTKEY = "jdsc:workflow_hotkey";
  const KEY_WF_MODAL_SIZE = "jdsc:workflowModalSize";
  const KEY_WF_MODAL_SIZE_FAVS = "jdsc:workflowModalSize:favs";
  const KEY_WF_MODAL_SIZE_WORK = "jdsc:workflowModalSize:work";
  const KEY_WF_HISTORY = "jdsc:workflow_history"; // 历史记录
  let WF_FOLDERS_CACHE = null;
  let WF_FAVS_CACHE = null;

  // 从服务器同步设置（包括快捷键、模态框位置等）
  async function syncSettingsFromServer() {
    try {
      const res = await fetch('/jdsc/settings');
      if (res && res.ok) {
        const data = await res.json();
        if (data && typeof data === 'object') {
          window.__jdsc_settings_cache = data;
        }
      }
    } catch { }
  }

  async function syncFoldersFromServer() {
    try {
      const res = await fetch('/jdsc/workflow_folders');
      if (res && res.ok) {
        const data = await res.json();
        WF_FOLDERS_CACHE = Array.isArray(data) ? data : [];
      }
    } catch { }
  }

  async function syncFavsFromServer() {
    try {
      const res = await fetch('/jdsc/workflow_favorites');
      if (res && res.ok) {
        const data = await res.json();
        WF_FAVS_CACHE = (data && typeof data === 'object') ? data : {};
      }
    } catch { }
  }

  function loadWF(key, def) {
    try {
      // 对于文件夹和收藏，强制使用服务器缓存（如果同步失败则返回空，不回退到LocalStorage）
      if (key === KEY_WF_FOLDERS) return WF_FOLDERS_CACHE !== null ? WF_FOLDERS_CACHE : def;
      if (key === KEY_WF_FAVS) return WF_FAVS_CACHE !== null ? WF_FAVS_CACHE : def;

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

  function saveWF(key, val) {
    try {
      if (key === KEY_WF_FOLDERS) {
        WF_FOLDERS_CACHE = Array.isArray(val) ? val : [];
        fetch('/jdsc/workflow_folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(WF_FOLDERS_CACHE)
        });
        return;
      }
      if (key === KEY_WF_FAVS) {
        WF_FAVS_CACHE = (val && typeof val === 'object') ? val : {};
        fetch('/jdsc/workflow_favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(WF_FAVS_CACHE)
        });
        return;
      }
      // 如果是 jdsc: 开头的设置，同步到服务器 settings.json
      if (String(key || '').startsWith('jdsc:')) {
        window.__jdsc_settings_cache = window.__jdsc_settings_cache || {};
        window.__jdsc_settings_cache[key] = val;
        fetch('/jdsc/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(window.__jdsc_settings_cache)
        });
        return;
      }
      localStorage.setItem(key, JSON.stringify(val));
    } catch { }
  }

  function getFolders() {
    let folders = loadWF(KEY_WF_FOLDERS, []);
    if (!Array.isArray(folders)) folders = [];

    // 【去重逻辑】使用 Map 以 path 为键去重,保留第一次出现的文件夹
    const folderMap = new Map();

    // 路径标准化函数
    const normalizePath = (p) => {
      if (!p) return '';
      return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    };

    // DEBUG: 打印原始文件夹列表
    console.log('[JDSC] Raw folders from server:', JSON.parse(JSON.stringify(folders)));

    // 【预处理】先提取默认文件夹的状态（如果存在）
    const savedDefaultFolder = folders.find(f => {
      const name = String(f.name || '').trim();
      const path = normalizePath(f.path);
      return f.id === 'default' ||
        name.includes('\u9e88\u8ba4\u5de5\u4f5c\u6d41') ||
        (path.includes('default') && path.includes('workflows'));
    });

    // 【超强去重】预先过滤掉所有疑似默认文件夹的项
    folders = folders.filter(f => {
      const name = String(f.name || '').trim();
      const path = normalizePath(f.path);

      // 1. 名称匹配 (Unicode: 默认工作流)
      if (name.includes('\u9e88\u8ba4\u5de5\u4f5c\u6d41')) return false;
      // 2. 路径匹配 (包含 default 和 workflows)
      if (path.includes('default') && path.includes('workflows')) return false;
      // 3. ID匹配
      if (f.id === 'default') return false;

      return true;
    });

    // 使用保存的状态创建默认文件夹
    const defaultFolder = {
      id: 'default',
      name: '默认工作流',
      path: 'user/default/workflows',
      collapsed: savedDefaultFolder ? savedDefaultFolder.collapsed : false,
      builtin: true
    };
    folderMap.set(normalizePath(defaultFolder.path), defaultFolder);

    // 遍历经过清洗的文件夹列表
    for (const folder of folders) {
      if (folder && folder.path) {
        const normPath = normalizePath(folder.path);
        if (!folderMap.has(normPath)) {
          folderMap.set(normPath, folder);
        }
      }
    }

    // 将 Map 转换回数组
    const uniqueFolders = Array.from(folderMap.values());
    console.log('[JDSC] Final unique folders:', uniqueFolders);

    return uniqueFolders;
  }

  function getWFFavs() {
    let favs = loadWF(KEY_WF_FAVS, {});
    if (!favs || typeof favs !== 'object') favs = {};
    return favs;
  }

  // 获取历史记录
  function getWFHistory() {
    let hist = loadWF(KEY_WF_HISTORY, []);
    if (!Array.isArray(hist)) hist = [];
    return hist;
  }

  // 保存历史记录
  function saveWFHistory(list) {
    if (list.length > 50) list = list.slice(0, 50); // 限制最大50条
    saveWF(KEY_WF_HISTORY, list);
  }

  // 添加到历史记录
  function addToWFHistory(name, path, method = 'jdsc') {
    try {
      let hist = getWFHistory();
      // 移除重复项（基于路径或名称）
      hist = hist.filter(h => {
        if (path && h.path === path) return false;
        if (!path && h.name === name) return false;
        return true;
      });
      // 添加到头部
      hist.unshift({
        name: name,
        path: path,
        time: Date.now(),
        method: method
      });
      saveWFHistory(hist);
    } catch (e) { console.error(e); }
  }

  function getWFHotkey() {
    try {
      const hk = loadWF(KEY_WF_HOTKEY, null);
      return hk ? hk : "alt+w";
    } catch {
      return "alt+w";
    }
  }

  function saveWFHotkey(val) {
    try {
      saveWF(KEY_WF_HOTKEY, val);
    } catch { }
  }

  function normalizeHotkeyString(s) {
    if (!s) return { ctrl: false, alt: false, shift: false, key: "" };
    const lower = s.toLowerCase().trim();
    const parts = lower.split("+").map(p => p.trim());
    const result = { ctrl: false, alt: false, shift: false, key: "" };
    for (const p of parts) {
      if (p === "ctrl" || p === "control") result.ctrl = true;
      else if (p === "alt") result.alt = true;
      else if (p === "shift") result.shift = true;
      else if (p.length > 0) result.key = p.toUpperCase();
    }
    return result;
  }

  function matchHotkey(e, spec) {
    if (!spec || !spec.key) return false;
    const ekey = e.key.toUpperCase();
    if (ekey !== spec.key) return false;
    if (!!e.ctrlKey !== !!spec.ctrl) return false;
    if (!!e.altKey !== !!spec.alt) return false;
    if (!!e.shiftKey !== !!spec.shift) return false;
    return true;
  }

  function createEl(tag, cls, text) {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text !== undefined) el.textContent = text;
    return el;
  }

  function ensureWorkflowStyles() {
    if (document.getElementById("jdsc-workflow-styles")) return;
    const style = createEl("style");
    style.id = "jdsc-workflow-styles";
    style.textContent = `
      .jdsc-wf-search-container{position:relative;flex:1;display:flex;align-items:center}.jdsc-wf-search-input{flex:1;height:28px;padding:4px 32px 4px 10px !important;box-sizing:border-box;max-width:none;font-size:13px;border:1px solid #2a2e32;background:#14181b;color:#d9d9d9;border-radius:4px}.jdsc-wf-search-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:18px;height:18px;border-radius:9px;background:#fa3d64;color:#fff;display:none;align-items:center;justify-content:center;font-size:12px;cursor:pointer;font-weight:bold;line-height:1;padding:0;border:none}.jdsc-wf-search-clear:hover{background:#ff4d4f}.jdsc-wf-search-clear.visible{display:flex}.jdsc-wf-folder{margin:8px 0;padding:0 16px}.jdsc-wf-folder-header{display:flex;align-items:center;padding:8px 12px;background:#2a2e32;border-radius:4px;cursor:pointer;user-select:none}.jdsc-wf-folder-header:hover{background:#333}.jdsc-wf-folder-icon{margin-right:8px;font-size:14px}.jdsc-wf-folder-name{flex:1;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.jdsc-wf-folder-toggle{font-size:12px;color:#888;margin-right:8px}.jdsc-wf-folder-content{padding:4px 0 4px 24px}.jdsc-wf-subfolder{margin:4px 0}.jdsc-wf-subfolder-header{display:flex;align-items:center;padding:6px 10px;background:#242628;border-radius:3px;cursor:pointer;user-select:none}.jdsc-wf-subfolder-header:hover{background:#2a2e32}.jdsc-wf-item{position:relative;padding:10px 12px;margin:4px 0;background:#1c1f22;border-radius:4px;cursor:pointer;transition:background .2s}.jdsc-wf-item:hover{background:#2a2e32}.jdsc-wf-item-name{font-size:14px;color:#d9d9d9;margin-bottom:4px;padding-right:60px}.jdsc-wf-item-path{font-size:11px;color:#666;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.jdsc-wf-item-folder{font-size:11px;color:#1890ff;margin-bottom:2px;font-weight:500}.jdsc-wf-item-actions{position:absolute;right:8px;top:50%;transform:translateY(-50%);display:flex;gap:8px}.jdsc-wf-btn{padding:4px 8px;border:none;background:transparent;color:#888;cursor:pointer;font-size:16px;transition:color .2s}.jdsc-wf-btn:hover{color:#fff}.jdsc-wf-btn-star{color:#888}.jdsc-wf-btn-star.active{color:#fadb14}.jdsc-wf-btn-delete:hover{color:#ff4d4f}.jdsc-wf-fav-item{padding:10px 12px;margin:6px 0;background:#1c1f22;border-radius:4px;cursor:pointer;position:relative}.jdsc-wf-fav-item:hover{background:#2a2e32}.jdsc-wf-fav-name{font-size:14px;color:#d9d9d9;font-weight:500;margin-bottom:2px;padding-right:60px}.jdsc-wf-fav-original{font-size:11px;color:#777;margin-bottom:2px;padding-right:60px}.jdsc-wf-fav-path{font-size:11px;color:#666}.jdsc-wf-add-folder{padding:10px 14px;background:#1677ff;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px}.jdsc-wf-add-folder:hover{background:#1890ff}.jdsc-wf-empty{padding:20px;text-align:center;color:#666;font-size:13px}.jdsc-wf-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99999}.jdsc-wf-confirm-dialog{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:#1c1f22;border-radius:8px;padding:20px;min-width:400px;max-width:600px;box-shadow:0 10px 40px rgba(0,0,0,0.5);z-index:100000}.jdsc-wf-confirm-title{font-size:18px;font-weight:600;color:#d9d9d9;margin-bottom:16px}.jdsc-wf-confirm-content{font-size:14px;color:#bfbfbf;line-height:1.6;margin-bottom:20px}.jdsc-wf-confirm-buttons{display:flex;gap:12px;justify-content:flex-end}.jdsc-wf-confirm-btn{padding:8px 20px;border:none;border-radius:4px;cursor:pointer;font-size:14px}.jdsc-wf-confirm-btn-cancel{background:#2a2e32;color:#d9d9d9}.jdsc-wf-confirm-btn-cancel:hover{background:#333}.jdsc-wf-confirm-btn-ok{background:#ff4d4f;color:#fff}.jdsc-wf-confirm-btn-ok:hover{background:#ff7875}.jdsc-wf-modal .jdsc-header{background:linear-gradient(315deg, #1677ff 0%, #0f5acc 100%) !important}.jdsc-wf-modal{user-select:none !important}
    `;
    document.head.appendChild(style);
  }

  // 额外拖拽样式：把手、占位与禁用选择
  function ensureWorkflowDragStyles() {
    if (document.getElementById('jdsc-workflow-drag-styles')) return;
    const style = createEl('style');
    style.id = 'jdsc-workflow-drag-styles';
    style.textContent = `
      .jdsc-body{ padding: 0 6px 32px 6px; overflow-y:auto; overflow-x:hidden; }
      .jdsc-body::-webkit-scrollbar { width: 10px; }
      .jdsc-body::-webkit-scrollbar-track { background: #1c1f22; border-left: 1px solid #2a2e32; }
      .jdsc-body::-webkit-scrollbar-thumb { background: #4b5563; border-radius: 5px; border: 2px solid #1c1f22; }
      .jdsc-body::-webkit-scrollbar-thumb:hover { background: #6b7280; }
      .jdsc-wf-fav-item{ position: relative; padding-left: 56px; }
      .jdsc-wf-drag{ position:absolute; left:16px; top:50%; transform:translateY(-50%); width:22px; height:22px; border-radius:6px; background:#2a2e32; color:#d9d9d9; display:flex; align-items:center; justify-content:center; cursor:grab; font-size:14px; }
      .jdsc-wf-fav-name, .jdsc-wf-fav-original, .jdsc-wf-fav-path{ margin-left: 0; }
      .jdsc-wf-drag:hover{ background:#3a3f44; color:#fff; }
      .jdsc-wf-drag:active{ cursor:grabbing; }
      .jdsc-wf-noselect, .jdsc-wf-noselect * { user-select: none; }
      .jdsc-wf-drag-ghost{ position:fixed; left:0; top:0; z-index:10001; background:#2a2e32; color:#d9d9d9; border-radius:6px; box-shadow:0 8px 18px rgba(0,0,0,.35); opacity:.92; pointer-events:none; }
      .jdsc-wf-drag-placeholder{ border:2px solid #52c41a; border-radius:6px; box-sizing:border-box; background:rgba(82,196,26,0.06); }
      /* brightness tweaks */
      .jdsc-wf-item{ background:#252a30 !important; }
      .jdsc-wf-item:hover{ background:#2e343a !important; }
      .jdsc-wf-fav-item{ background:#252a30 !important; }
      .jdsc-wf-fav-item:hover{ background:#2e343a !important; }
      .jdsc-wf-fav-name{ color:#e6e9ec !important; }
      .jdsc-wf-fav-original{ color:#b7bcc2 !important; }
      .jdsc-wf-fav-path{ color:#a6acb2 !important; }
      .jdsc-wf-btn{ color:#b0b6bb !important; }
      .jdsc-wf-btn:hover{ color:#ffffff !important; }
      .jdsc-wf-modal .jdsc-footer{ display:flex !important; gap:10px !important; padding:14px 16px !important; border-top:1px solid #2a2e32 !important; align-items:center !important; justify-content:space-between !important; flex-shrink:0 !important; box-sizing:content-box !important; height:auto !important; min-height:auto !important; }
      .jdsc-wf-modal .jdsc-btn{ height:32px !important; padding:0 14px !important; border-radius:6px !important; background:#2a2e32 !important; color:#b0b6bb !important; display:inline-flex !important; align-items:center !important; cursor:pointer !important; white-space:nowrap !important; font-size:13px !important; margin:0 !important; border:none !important; }
      .jdsc-wf-modal .jdsc-btn:hover{ color:#ffffff !important; }
    `;
    document.head.appendChild(style);
  }

  function showConfirmDialog(title, content, onConfirm) {
    const overlay = createEl("div", "jdsc-wf-overlay");
    const dialog = createEl("div", "jdsc-wf-confirm-dialog");
    const titleEl = createEl("div", "jdsc-wf-confirm-title", title);
    const contentEl = createEl("div", "jdsc-wf-confirm-content");
    contentEl.innerHTML = content;
    const buttons = createEl("div", "jdsc-wf-confirm-buttons");
    const btnCancel = createEl("button", "jdsc-wf-confirm-btn jdsc-wf-confirm-btn-cancel", "取消");
    const btnOk = createEl("button", "jdsc-wf-confirm-btn jdsc-wf-confirm-btn-ok", "确认删除");
    btnCancel.onclick = () => {
      overlay.remove();
      dialog.remove();
    };
    btnOk.onclick = () => {
      overlay.remove();
      dialog.remove();
      if (onConfirm) onConfirm();
    };
    buttons.appendChild(btnCancel);
    buttons.appendChild(btnOk);
    dialog.appendChild(titleEl);
    dialog.appendChild(contentEl);
    dialog.appendChild(buttons);
    document.body.appendChild(overlay);
    document.body.appendChild(dialog);
    overlay.onclick = () => {
      overlay.remove();
      dialog.remove();
    };
  }

  async function deleteWorkflowFile(filePath) {
    try {
      const res = await fetch('/jdsc/workflow_delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      if (res && res.ok) {
        const result = await res.json();
        return result.success || false;
      }
      return false;
    } catch {
      return false;
    }
  }

  async function loadWorkflowContent(filePath) {
    try {
      const res = await fetch('/jdsc/workflow_load', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: filePath })
      });
      if (res && res.ok) {
        const data = await res.json();
        return data.content || null;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function getWorkflowList(folderPath) {
    try {
      const res = await fetch('/jdsc/workflow_list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderPath })
      });
      if (res && res.ok) {
        const data = await res.json();
        return {
          files: Array.isArray(data.files) ? data.files : [],
          subfolders: Array.isArray(data.subfolders) ? data.subfolders : []
        };
      }
      return { files: [], subfolders: [] };
    } catch {
      return { files: [], subfolders: [] };
    }
  }

  // 记住当前打开的工作流信息 (仅用于当前操作上下文，不用于保存判定)
  let currentWorkflowInfo = null;

  // 打开工作流到画布
  async function openWorkflowInCanvas(filePath) {
    try {
      const fileName = filePath.split(/[\\\/]/).pop();
      const fileNameNoExt = fileName.replace(/\.json$/i, '');
      console.log('[工作流+] 准备打开工作流:', fileName);
      console.log('[工作流+] 文件路径:', filePath);

      // 加载工作流内容
      const content = await loadWorkflowContent(filePath);
      if (!content) {
        alert('加载工作流失败：无法读取文件内容');
        return;
      }

      let workflow;
      try {
        workflow = typeof content === 'string' ? JSON.parse(content) : content;
        // 记住工作流信息（用于后续保存）
        currentWorkflowInfo = {
          path: filePath,
          name: fileName,
          nameNoExt: fileNameNoExt
        };
        console.log('[工作流+] ✓ 已记录工作流信息，按Ctrl+S可覆盖保存');

      } catch {
        alert('加载工作流失败：文件格式错误');
        return;
      }

      // === Session 绑定逻辑 (提前执行) ===
      // 生成唯一会话ID，用于在多标签切换/重载时识别该工作流实例
      const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);

      // 初始化会话映射表
      if (!window.__jdsc_session_map) {
        window.__jdsc_session_map = new Map();
      }
      // 记录 SessionID -> 路径信息
      window.__jdsc_session_map.set(sessionId, {
        path: filePath,
        name: fileNameNoExt
      });
      console.log('[工作流+] 已预注册 SessionID:', sessionId);

      // 关键：将 SessionID 注入到 workflow 数据中
      // 这样 handleFile 加载时，configure 钩子就能直接从 data.extra 中读到 ID 并恢复路径
      if (workflow && typeof workflow === 'object') {
        if (!workflow.extra) workflow.extra = {};
        workflow.extra.jdsc_session_id = sessionId;
      }

      // 方案A：优先使用 ComfyUI 原生的文件打开流程
      // 思路：把 JSON 内容伪装成一个浏览器 File 对象，交给 app.handleFile
      // 好处：由官方逻辑统一设置标题、清除未保存标记、正确处理标签与状态
      let usedHandleFile = false;
      try {
        if (window.app && typeof window.app.handleFile === 'function') {
          // 注意：这里使用已经注入了 SessionID 的 workflow 对象
          const raw = JSON.stringify(workflow);
          const blob = new Blob([raw], { type: 'application/json' });
          const file = new File([blob], fileName, { type: 'application/json' });

          // 设置 flag 防止 configure 钩子误判（虽然有 SessionID 恢复机制，但双重保险更好）
          window.__jdsc_loading_flag = true;
          try {
            await window.app.handleFile(file);
          } finally {
            window.__jdsc_loading_flag = false;
          }
          usedHandleFile = true;
          // handleFile 内部使用 FileReader 异步读取，这里稍等以确保 UI 状态稳定
          await new Promise(res => setTimeout(res, 150));
          console.log('[工作流+] ✓ 通过 handleFile 原生方式打开');
        }
      } catch (e) {
        console.warn('[工作流+] handleFile 打开失败，将回退到直接渲染:', e);
      }

      // 回退：若 handleFile 不可用或失败，继续使用原来的渲染方式
      if (!usedHandleFile) {
        window.__jdsc_loading_flag = true;
        try {
          await window.app.loadGraphData(workflow, true, true);
        } finally {
          window.__jdsc_loading_flag = false;
        }
        console.log('[工作流+] ✓ 工作流已加载（回退渲染）');
      }

      // 再次确认绑定（防止 handleFile 过程中某些意外重置）
      if (window.app && window.app.graph) {
        window.app.graph.jdsc_path = filePath;
        window.app.graph.jdsc_name = fileNameNoExt;
        if (!window.app.graph.extra) window.app.graph.extra = {};
        window.app.graph.extra.jdsc_session_id = sessionId;
      }

      // 添加到历史记录
      addToWFHistory(fileNameNoExt, filePath, 'jdsc');

      // 记住工作流信息（用于后续保存）
      currentWorkflowInfo = {
        path: filePath,
        name: fileName,
        nameNoExt: fileNameNoExt
      };
      console.log('[工作流+] ✓ 已记录工作流信息，按Ctrl+S可覆盖保存');

    } catch (e) {
      console.error('[工作流+] 打开工作流失败:', e);
      alert('打开工作流失败，请查看控制台');
    }
  }

  // 保存工作流到指定路径
  async function saveWorkflowToPath(filePath, workflowData) {
    try {
      console.log('[工作流+] 正在保存到:', filePath);
      const res = await fetch('/jdsc/workflow_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          content: JSON.stringify(workflowData, null, 2)
        })
      });
      if (res && res.ok) {
        const result = await res.json();
        if (result.success) {
          console.log('[工作流+] ✓ 保存成功:', filePath);

          // 更新标题（保存后可能标题又变成Unsaved了）
          const fileName = filePath.split(/[\\\/]/).pop().replace(/\.json$/i, '');
          updateWorkflowTitle(fileName);

          // 显示保存成功提示
          const notification = document.createElement('div');
          notification.textContent = '✓ 已保存: ' + fileName;
          notification.style.cssText = 'position:fixed;top:20px;right:20px;background:#52c41a;color:#fff;padding:12px 20px;border-radius:4px;z-index:999999;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.15)';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 2000);
        } else {
          console.error('[工作流+] 保存失败:', result.error);
        }
      }
    } catch (e) {
      console.error('[工作流+] 保存出错:', e);
    }
  }

  // (已移除) 旧的标签监听逻辑
  // ...

  // 子文件夹折叠状态管理
  const subfolderStates = {};
  let globalRefreshFn = null;
  let globalToggleFn = null;

  // 递归获取所有子文件夹的文件（用于搜索）
  async function getAllFilesRecursive(folderPath, parentFolderName = "") {
    try {
      const data = await getWorkflowList(folderPath);
      let allFiles = [];

      // 添加当前文件夹的文件，并附加父文件夹信息
      for (const file of data.files) {
        allFiles.push({
          ...file,
          parentFolder: parentFolderName
        });
      }

      // 递归获取子文件夹的文件
      for (const subfolder of data.subfolders) {
        const subFiles = await getAllFilesRecursive(subfolder.path, subfolder.name);
        allFiles = allFiles.concat(subFiles);
      }

      return allFiles;
    } catch {
      return [];
    }
  }

  async function renderSubfolder(subfolder, parentEl, favs, searchKw) {
    const subfolderDiv = createEl("div", "jdsc-wf-subfolder");
    const subfolderHeader = createEl("div", "jdsc-wf-subfolder-header");
    const isCollapsed = subfolderStates[subfolder.path] !== false;
    const subfolderToggle = createEl("span", "jdsc-wf-folder-toggle", isCollapsed ? "▶" : "▼");
    const subfolderIcon = createEl("span", "jdsc-wf-folder-icon", "📁");
    const subfolderName = createEl("span", "jdsc-wf-folder-name", subfolder.name);

    subfolderHeader.appendChild(subfolderToggle);
    subfolderHeader.appendChild(subfolderIcon);
    subfolderHeader.appendChild(subfolderName);
    subfolderHeader.onclick = () => {
      subfolderStates[subfolder.path] = !isCollapsed;
      if (globalRefreshFn) globalRefreshFn();
    };

    subfolderDiv.appendChild(subfolderHeader);

    if (!isCollapsed) {
      const subfolderContent = createEl("div", "jdsc-wf-folder-content");
      const data = await getWorkflowList(subfolder.path);
      const files = data.files;
      const nestedSubfolders = data.subfolders;

      // 递归渲染嵌套子文件夹
      if (!searchKw && nestedSubfolders.length > 0) {
        for (const nested of nestedSubfolders) {
          await renderSubfolder(nested, subfolderContent, favs, searchKw);
        }
      }

      // 渲染文件
      let filtered = searchKw ? files.filter(f => f.name.toLowerCase().includes(searchKw) || f.path.toLowerCase().includes(searchKw)) : files;
      for (const file of filtered) {
        const item = createEl("div", "jdsc-wf-item");
        const itemName = createEl("div", "jdsc-wf-item-name", file.name);
        const folderPath = file.path.replace(/[\\\/][^\\\/]+$/, '');
        const itemPath = createEl("div", "jdsc-wf-item-path", folderPath);
        const actions = createEl("div", "jdsc-wf-item-actions");
        const isFav = !!favs[file.path];
        const starBtn = createEl("button", `jdsc-wf-btn jdsc-wf-btn-star ${isFav ? 'active' : ''}`, isFav ? "★" : "☆");
        starBtn.onclick = (e) => {
          e.stopPropagation();
          const favs = getWFFavs();
          if (favs[file.path]) {
            delete favs[file.path];
          } else {
            favs[file.path] = { custom_name: file.name.replace(/\.json$/i, ''), original_name: file.name, original_path: file.path, starred: false, added_time: Date.now() };
          }
          saveWF(KEY_WF_FAVS, favs);
          if (globalRefreshFn) globalRefreshFn();
        };
        const delBtn = createEl("button", "jdsc-wf-btn jdsc-wf-btn-delete", "🗑");
        delBtn.onclick = (e) => {
          e.stopPropagation();
          showConfirmDialog("⚠ 确认删除工作流？", `<strong>文件：</strong>${file.name}<br><strong>路径：</strong>${file.path}<br><br><strong style="color:#ff4d4f;">此操作将永久删除文件！</strong>`, async () => {
            const ok = await deleteWorkflowFile(file.path);
            if (ok) {
              const favs = getWFFavs();
              if (favs[file.path]) {
                delete favs[file.path];
                saveWF(KEY_WF_FAVS, favs);
              }
              if (globalRefreshFn) globalRefreshFn();
            } else {
              alert('删除失败');
            }
          });
        };
        actions.appendChild(starBtn);
        actions.appendChild(delBtn);
        item.appendChild(itemName);
        item.appendChild(itemPath);
        item.appendChild(actions);
        item.onclick = (e) => {
          if (e.target.tagName === 'BUTTON') return;
          openWorkflowInCanvas(file.path);
          if (globalToggleFn) globalToggleFn();
        };
        subfolderContent.appendChild(item);
      }

      subfolderDiv.appendChild(subfolderContent);
    }

    parentEl.appendChild(subfolderDiv);
  }

  window.__jdsc_createWorkflowModal = function (toggle) {
    // 【单例模式+切换】检查是否已有窗口
    const existing = document.querySelector('.jdsc-wf-modal');
    if (existing) {
      // 如果已存在,直接移除(关闭)
      existing.remove();
      return null; // 返回 null 表示已关闭
    }

    // 如果不存在,创建新窗口
    ensureWorkflowStyles();
    ensureWorkflowDragStyles();
    const modal = createEl("div", "jdsc-modal jdsc-wf-modal");
    modal.id = "jdsc-workflow-modal-root"; // 添加唯一ID方便查找
    const pos = loadWF(KEY_WF_MODAL_POS, null);
    if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
      modal.style.left = pos.x + "px";
      modal.style.top = pos.y + "px";
    } else {
      modal.style.left = "50%";
      modal.style.top = "50%";
      modal.style.transform = "translate(-50%, -50%)";
    }
    const header = createEl("div", "jdsc-header");
    const title = createEl("div", "jdsc-title", "工作流+ (v2)");
    const closeBtn = createEl("div", "jdsc-close", "✕");
    closeBtn.onclick = toggle;
    header.appendChild(title);
    header.appendChild(closeBtn);
    const tabs = createEl("div", "jdsc-tabs");
    const tabWorkflow = createEl("div", "jdsc-tab", "工作流");
    const tabFavorites = createEl("div", "jdsc-tab active", "流收藏");
    const tabHistory = createEl("div", "jdsc-tab", "流历史");
    tabs.appendChild(tabWorkflow);
    tabs.appendChild(tabFavorites);
    tabs.appendChild(tabHistory);
    const searchBar = createEl("div", "jdsc-search-bar");
    searchBar.style.display = "flex";
    searchBar.style.gap = "8px";
    searchBar.style.alignItems = "center";
    searchBar.style.padding = "0 16px";

    // 创建搜索框容器（用于包含输入框和清空按钮）
    const searchContainer = createEl("div", "jdsc-wf-search-container");

    const searchInput = createEl("input", "jdsc-wf-search-input");
    searchInput.type = "text";
    searchInput.placeholder = "搜索收藏的工作流...";

    // 创建清空按钮
    const clearBtn = createEl("button", "jdsc-wf-search-clear", "✕");
    clearBtn.title = "清空搜索";
    clearBtn.onclick = () => {
      searchInput.value = "";
      clearBtn.classList.remove("visible");
      refresh();
    };

    // 监听输入，显示/隐藏清空按钮
    searchInput.addEventListener("input", () => {
      if (searchInput.value.trim()) {
        clearBtn.classList.add("visible");
      } else {
        clearBtn.classList.remove("visible");
      }
      refresh();
    });

    searchContainer.appendChild(searchInput);
    searchContainer.appendChild(clearBtn);
    const addFolderBtn = createEl("button", "jdsc-wf-add-folder");
    addFolderBtn.innerHTML = "📁 + 添加文件夹";
    addFolderBtn.style.marginBottom = "0";
    addFolderBtn.style.flexShrink = "0";
    addFolderBtn.style.height = "28px";
    addFolderBtn.style.padding = "4px 12px";
    addFolderBtn.onclick = async () => {
      const path = prompt("请输入文件夹路径：\n(相对于ComfyUI根目录，或绝对路径)");
      if (!path) return;
      const name = prompt("请输入文件夹别名：", "我的工作流");
      if (!name) return;
      const folders = getFolders();
      folders.push({ id: Date.now().toString(36), name, path, collapsed: false, builtin: false });
      saveWF(KEY_WF_FOLDERS, folders);
      refresh();
    };
    searchBar.appendChild(searchContainer);
    searchBar.appendChild(addFolderBtn);
    const body = createEl("div", "jdsc-body");
    const footer = createEl("div", "jdsc-footer");
    footer.style.cssText = "height: 61px !important; min-height: 61px !important; max-height: 61px !important; padding: 14px 16px !important; box-sizing: border-box !important; display: flex !important; align-items: center !important; justify-content: space-between !important; gap: 10px !important; border-top: 1px solid #2a2e32 !important; flex-shrink: 0 !important; overflow: hidden !important;";
    const btnSetHotkey = createEl("div", "jdsc-btn", "设置快捷键");
    btnSetHotkey.style.cssText = "height: 32px !important; padding: 0 14px !important; border-radius: 6px !important; background: #2a2e32 !important; color: #b0b6bb !important; display: inline-flex !important; align-items: center !important; cursor: pointer !important; white-space: nowrap !important; font-size: 13px !important; margin: 0 !important; border: none !important; line-height: normal !important; box-sizing: border-box !important;";
    btnSetHotkey.onclick = () => {
      const currentHk = getWFHotkey();
      const newHk = prompt(`设置工作流+快捷键（当前：${currentHk.toUpperCase()}）\n格式：ctrl+shift+w`, currentHk);
      if (newHk && newHk !== currentHk) {
        saveWFHotkey(newHk.toLowerCase().trim());
        const disp = newHk.toUpperCase().split("+").join(" + ");
        alert(`快捷键已设置为：${disp}`);
        location.reload();
      }
    };
    const btnAddCurrent = createEl("div", "jdsc-btn", "收藏当前工作流");
    btnAddCurrent.style.cssText = "height: 32px !important; padding: 0 14px !important; border-radius: 6px !important; background: #2a2e32 !important; color: #b0b6bb !important; display: inline-flex !important; align-items: center !important; cursor: pointer !important; white-space: nowrap !important; font-size: 13px !important; margin: 0 !important; border: none !important; line-height: normal !important; box-sizing: border-box !important;";
    btnAddCurrent.onclick = () => {
      try {
        console.log('[工作流+] ========== 收藏当前工作流触发 ==========');



        // === 1. 直接从 Graph 获取路径 ===
        let path = null;
        let nameNoExt = null;
        let fileName = null;

        if (window.app && window.app.graph && window.app.graph.jdsc_path) {
          path = window.app.graph.jdsc_path;
          nameNoExt = window.app.graph.jdsc_name;
          fileName = nameNoExt + ".json";
          console.log('[收藏] 从 Graph 获取路径:', path);
        }

        // === 2. 后备：尝试从 currentWorkflowInfo 获取 (仅作为最后手段) ===
        if (!path && currentWorkflowInfo && currentWorkflowInfo.path) {
          path = currentWorkflowInfo.path;
          nameNoExt = currentWorkflowInfo.nameNoExt;
          fileName = currentWorkflowInfo.name;
        }

        if (!path) {
          alert("⚠ 无法收藏：无法获取工作流路径\n\n请确保工作流已通过 Workflow+ 打开。");
          return;
        }

        const favs = getWFFavs();
        favs[path] = favs[path] || { custom_name: nameNoExt, original_name: fileName, original_path: path, starred: false, added_time: Date.now() };
        // 覆盖名称为当前显示名（若已有则保留原置顶状态）
        favs[path].custom_name = nameNoExt;
        favs[path].original_name = fileName;
        favs[path].original_path = path;
        favs[path].added_time = favs[path].added_time || Date.now();
        saveWF(KEY_WF_FAVS, favs);
        refresh();
        try { const tip = document.createElement('div'); tip.textContent = `✓ 已添加到流收藏: ${nameNoExt}`; tip.style.cssText = 'position:fixed;top:20px;right:20px;background:#52c41a;color:#fff;padding:12px 20px;border-radius:4px;z-index:999999;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.15)'; document.body.appendChild(tip); setTimeout(() => tip.remove(), 1800); } catch { }
      } catch (e) {
        console.error('[收藏] 失败:', e);
        alert("添加到流收藏失败");
      }
    };
    footer.appendChild(btnAddCurrent);
    footer.appendChild(btnSetHotkey);
    modal.appendChild(header);
    modal.appendChild(tabs);
    modal.appendChild(searchBar);
    modal.appendChild(body);
    modal.appendChild(footer);
    const minH = 360;
    const maxH = Math.max(480, (window.innerHeight || 800) - 60);
    function calcAutoHeight() {
      try {
        const used = header.offsetHeight + tabs.offsetHeight + searchBar.offsetHeight + 61;
        const cap = Math.floor((window.innerHeight || 800) * 0.6);
        const content = Math.min(body.scrollHeight + 24, cap);
        const autoH = Math.max(minH, Math.min(maxH, used + content));
        return autoH;
      } catch { return minH; }
    }
    function getModeSizeKey() { return currentMode === 'workflow' ? KEY_WF_MODAL_SIZE_WORK : KEY_WF_MODAL_SIZE_FAVS; }
    function setModalHeightForMode() {
      const key = getModeSizeKey();
      const szm = loadWF(key, null);
      if (szm && typeof szm.h === 'number') {
        const h = Math.max(minH, Math.min(maxH, szm.h));
        modal.style.height = h + 'px';
      } else {
        modal.style.height = '';
      }
      applyBodyMax();
    }
    const sz = loadWF(KEY_WF_MODAL_SIZE_FAVS, null);
    let hasSavedSize = false;
    if (sz && typeof sz.h === 'number') {
      const initialH = Math.max(minH, Math.min(maxH, sz.h));
      modal.style.height = initialH + 'px';
      hasSavedSize = true;
    } else {
      modal.style.height = '';
    }
    function applyBodyMax() { try { if (!modal.style.height) return; const h = modal.offsetHeight; const used = header.offsetHeight + tabs.offsetHeight + searchBar.offsetHeight + 61; body.style.maxHeight = Math.max(120, h - used - 20) + 'px'; } catch { } }
    applyBodyMax();
    // 已禁用拖拽缩放：面板高度不通过底边拖动改变
    let dragging = false, offsetX = 0, offsetY = 0;
    header.style.cursor = "move";
    header.addEventListener("mousedown", (e) => {
      dragging = true;
      offsetX = e.clientX - modal.offsetLeft;
      offsetY = e.clientY - modal.offsetTop;
      modal.style.transform = "none";
    });
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      modal.style.left = (e.clientX - offsetX) + "px";
      modal.style.top = (e.clientY - offsetY) + "px";
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      saveWF(KEY_WF_MODAL_POS, { x: modal.offsetLeft, y: modal.offsetTop });
    });
    let currentMode = "favorites";
    let currentRefreshId = 0;
    async function refresh() {
      const myId = ++currentRefreshId;
      globalRefreshFn = refresh;
      globalToggleFn = toggle;
      body.innerHTML = "";
      if (currentMode === "workflow") {
        addFolderBtn.style.display = "flex";
        const folders = getFolders();
        const favs = getWFFavs();
        const searchKw = searchInput.value.toLowerCase();
        for (const folder of folders) {
          const folderDiv = createEl("div", "jdsc-wf-folder");
          const folderHeader = createEl("div", "jdsc-wf-folder-header");
          const folderToggle = createEl("span", "jdsc-wf-folder-toggle", folder.collapsed ? "▶" : "▼");
          const folderIcon = createEl("span", "jdsc-wf-folder-icon", "📁");
          const folderName = createEl("span", "jdsc-wf-folder-name", folder.name);
          folderHeader.appendChild(folderToggle);
          folderHeader.appendChild(folderIcon);
          folderHeader.appendChild(folderName);
          if (!folder.builtin) {
            const delBtn = createEl("button", "jdsc-wf-btn jdsc-wf-btn-delete", "✕");
            delBtn.onclick = (e) => {
              e.stopPropagation();
              if (confirm(`确认删除文件夹"${folder.name}"？\n（不会删除实际文件）`)) {
                const folders = getFolders();
                const idx = folders.findIndex(f => f.id === folder.id);
                if (idx !== -1) {
                  folders.splice(idx, 1);
                  saveWF(KEY_WF_FOLDERS, folders);
                  refresh();
                }
              }
            };
            folderHeader.appendChild(delBtn);
          }
          folderHeader.onclick = () => {
            folder.collapsed = !folder.collapsed;

            // 获取原始文件夹列表（包括默认文件夹）
            const allFolders = getFolders();

            // 更新对应文件夹的折叠状态
            const targetFolder = allFolders.find(f => f.path === folder.path);
            if (targetFolder) {
              targetFolder.collapsed = folder.collapsed;
            }

            saveWF(KEY_WF_FOLDERS, allFolders);
            refresh();
          };
          folderDiv.appendChild(folderHeader);
          if (!folder.collapsed || searchKw) {
            const folderContent = createEl("div", "jdsc-wf-folder-content");

            let files, subfolders;

            // 如果有搜索关键词，递归获取所有文件
            if (searchKw) {
              const allFiles = await getAllFilesRecursive(folder.path);
              if (myId !== currentRefreshId) return; // 如果已有新搜索，终止当前操作
              files = allFiles.filter(f =>
                f.name.toLowerCase().includes(searchKw) ||
                f.path.toLowerCase().includes(searchKw) ||
                (f.parentFolder && f.parentFolder.toLowerCase().includes(searchKw))
              );
              subfolders = [];
            } else {
              // 无搜索时，正常渲染
              const data = await getWorkflowList(folder.path);
              if (myId !== currentRefreshId) return; // 如果已有新搜索，终止当前操作
              files = data.files;
              subfolders = data.subfolders;
            }

            // 渲染子文件夹（仅在无搜索时）
            if (!searchKw && subfolders.length > 0) {
              for (const subfolder of subfolders) {
                await renderSubfolder(subfolder, folderContent, favs, searchKw);
                if (myId !== currentRefreshId) return; // 如果已有新搜索，终止当前操作
              }
            }

            // 渲染文件
            let filtered = files;
            if (filtered.length === 0 && subfolders.length === 0) {
              folderContent.appendChild(createEl("div", "jdsc-wf-empty", searchKw ? "无匹配的工作流" : "文件夹为空"));
            } else {
              for (const file of filtered) {
                const item = createEl("div", "jdsc-wf-item");

                // 如果是搜索模式且文件在子文件夹中，显示子文件夹信息
                if (searchKw && file.parentFolder) {
                  const itemFolder = createEl("div", "jdsc-wf-item-folder", `📁 ${file.parentFolder}`);
                  item.appendChild(itemFolder);
                }

                const itemName = createEl("div", "jdsc-wf-item-name", file.name);
                item.appendChild(itemName);

                const folderPath = file.path.replace(/[\\\/][^\\\/]+$/, '');
                const itemPath = createEl("div", "jdsc-wf-item-path", folderPath);
                item.appendChild(itemPath);
                const actions = createEl("div", "jdsc-wf-item-actions");
                const isFav = !!favs[file.path];
                const starBtn = createEl("button", `jdsc-wf-btn jdsc-wf-btn-star ${isFav ? 'active' : ''}`, isFav ? "★" : "☆");
                starBtn.onclick = (e) => {
                  e.stopPropagation();
                  const favs = getWFFavs();
                  if (favs[file.path]) {
                    delete favs[file.path];
                  } else {
                    favs[file.path] = { custom_name: file.name.replace(/\.json$/i, ''), original_name: file.name, original_path: file.path, starred: false, added_time: Date.now() };
                  }
                  saveWF(KEY_WF_FAVS, favs);
                  refresh();
                };
                const delBtn = createEl("button", "jdsc-wf-btn jdsc-wf-btn-delete", "🗑");
                delBtn.onclick = (e) => {
                  e.stopPropagation();
                  showConfirmDialog("⚠ 确认删除工作流？", `<strong>文件：</strong>${file.name}<br><strong>路径：</strong>${file.path}<br><br><strong style="color:#ff4d4f;">此操作将永久删除文件！</strong>`, async () => {
                    const ok = await deleteWorkflowFile(file.path);
                    if (ok) {
                      const favs = getWFFavs();
                      if (favs[file.path]) {
                        delete favs[file.path];
                        saveWF(KEY_WF_FAVS, favs);
                      }
                      refresh();
                    } else {
                      alert('删除失败');
                    }
                  });
                };
                actions.appendChild(starBtn);
                actions.appendChild(delBtn);
                item.appendChild(actions);
                item.onclick = (e) => {
                  if (e.target.tagName === 'BUTTON') return;
                  openWorkflowInCanvas(file.path);
                  toggle();
                };
                folderContent.appendChild(item);
              }
            }
            folderDiv.appendChild(folderContent);
          }
          body.appendChild(folderDiv);
        }
      } else if (currentMode === 'history') {
        // === 历史记录模式 ===
        addFolderBtn.style.display = "none";
        const hist = getWFHistory();
        const searchKw = searchInput.value.toLowerCase();
        let filtered = searchKw ? hist.filter(h => (h.name || '').toLowerCase().includes(searchKw) || (h.path || '').toLowerCase().includes(searchKw)) : hist;

        if (filtered.length === 0) {
          body.appendChild(createEl("div", "jdsc-wf-empty", searchKw ? "无匹配的历史" : "暂无历史记录"));
        } else {
          for (const item of filtered) {
            const row = createEl("div", "jdsc-wf-fav-item");

            // 图标和名称
            const icon = item.method === 'jdsc' ? "📄" : "📝";
            const itemName = createEl("div", "jdsc-wf-fav-name", `${icon} ${item.name}`);
            if (item.method !== 'jdsc') itemName.title = "通过原生方式打开（可能无路径）";
            itemName.style.paddingRight = "80px"; // 为按钮预留空间

            // 时间
            const timeStr = new Date(item.time).toLocaleString();
            const timeDiv = createEl("div", "jdsc-wf-fav-original", `时间: ${timeStr}`);
            timeDiv.style.paddingRight = "80px"; // 为按钮预留空间

            // 路径显示
            const pathDiv = createEl("div", "jdsc-wf-fav-path", item.path || "无路径信息");
            pathDiv.style.paddingRight = "80px"; // 为按钮预留空间

            // 操作按钮
            const actions = createEl("div", "jdsc-wf-item-actions");

            // 收藏按钮（只有有路径的才能收藏）
            if (item.path) {
              const favs = getWFFavs();
              const isFav = !!favs[item.path];
              const starBtn = createEl("button", `jdsc-wf-btn jdsc-wf-btn-star ${isFav ? 'active' : ''}`, isFav ? "★" : "☆");
              starBtn.title = isFav ? "取消收藏" : "收藏";
              starBtn.onclick = (e) => {
                e.stopPropagation();
                const favs = getWFFavs();
                if (favs[item.path]) {
                  delete favs[item.path];
                } else {
                  favs[item.path] = { custom_name: item.name, original_name: item.name, original_path: item.path, starred: false, added_time: Date.now() };
                }
                saveWF(KEY_WF_FAVS, favs);
                refresh();
              };
              actions.appendChild(starBtn);
            }

            // 删除按钮
            const delBtn = createEl("button", "jdsc-wf-btn jdsc-wf-btn-delete", "✕");
            delBtn.title = "从历史中删除";
            delBtn.onclick = (e) => {
              e.stopPropagation();
              let h = getWFHistory();
              h = h.filter(x => x.time !== item.time);
              saveWFHistory(h);
              refresh();
            };
            actions.appendChild(delBtn);

            row.appendChild(itemName);
            row.appendChild(timeDiv);
            row.appendChild(pathDiv);
            row.appendChild(actions);

            row.onclick = (e) => {
              if (e.target.tagName === 'BUTTON') return;
              if (item.path) {
                openWorkflowInCanvas(item.path);
                toggle();
              } else {
                alert("此记录无路径信息，无法直接打开。");
              }
            };

            body.appendChild(row);
          }
        }
      } else {
        addFolderBtn.style.display = "none";
        const favs = getWFFavs();
        const favList = Object.entries(favs).map(([path, data]) => ({ path, ...data }));
        favList.sort((a, b) => {
          if (a.starred && !b.starred) return -1;
          if (!a.starred && b.starred) return 1;
          return (b.added_time || 0) - (a.added_time || 0);
        });
        const searchKw = searchInput.value.toLowerCase();
        let filtered = searchKw ? favList.filter(f => (f.custom_name || '').toLowerCase().includes(searchKw) || (f.original_name || '').toLowerCase().includes(searchKw) || (f.original_path || '').toLowerCase().includes(searchKw)) : favList;
        const favOrder = loadWF('jdsc:workflow_fav_order', []);
        const present = new Set(filtered.map(f => f.path));
        const orderedVisible = Array.isArray(favOrder) ? favOrder.filter(p => present.has(p)) : [];
        const restVisible = filtered.map(f => f.path).filter(p => !orderedVisible.includes(p));
        const seq = orderedVisible.concat(restVisible);
        const idx = new Map(seq.map((p, i) => [p, i]));
        const listPinned = filtered.filter(f => !!f.starred).sort((a, b) => (idx.get(a.path) || 0) - (idx.get(b.path) || 0));
        const listUnpinned = filtered.filter(f => !f.starred).sort((a, b) => (idx.get(a.path) || 0) - (idx.get(b.path) || 0));
        const renderListAll = listPinned.concat(listUnpinned);
        if (renderListAll.length === 0) {
          body.appendChild(createEl("div", "jdsc-wf-empty", searchKw ? "无匹配的收藏" : "还没有收藏的工作流"));
        } else {
          for (const fav of renderListAll) {
            const item = createEl("div", "jdsc-wf-fav-item");
            const handle = createEl('div', 'jdsc-wf-drag', '⋮⋮');
            item.appendChild(handle);
            const favName = createEl("div", "jdsc-wf-fav-name", `❤ ${fav.custom_name || fav.original_name}`);
            const favOriginal = createEl("div", "jdsc-wf-fav-original", `原名：${fav.original_name}`);
            const favFolderPath = fav.original_path.replace(/[\\\/][^\\\/]+$/, '');
            const favPath = createEl("div", "jdsc-wf-fav-path", favFolderPath);
            const actions = createEl("div", "jdsc-wf-item-actions");
            const pinBtn = createEl("button", `jdsc-wf-btn ${fav.starred ? 'active' : ''}`, fav.starred ? "📌" : "📍");
            pinBtn.title = fav.starred ? "取消常用" : "标记常用";
            pinBtn.onclick = (e) => {
              e.stopPropagation();
              const favs = getWFFavs();
              if (favs[fav.path]) {
                favs[fav.path].starred = !favs[fav.path].starred;
                saveWF(KEY_WF_FAVS, favs);
                refresh();
              }
            };
            const removeBtn = createEl("button", "jdsc-wf-btn jdsc-wf-btn-delete", "✕");
            removeBtn.title = "取消收藏";
            removeBtn.onclick = (e) => {
              e.stopPropagation();
              const favs = getWFFavs();
              delete favs[fav.path];
              saveWF(KEY_WF_FAVS, favs);
              refresh();
            };
            actions.appendChild(pinBtn);
            actions.appendChild(removeBtn);
            item.appendChild(favName);
            item.appendChild(favOriginal);
            item.appendChild(favPath);
            item.appendChild(actions);
            item.oncontextmenu = (e) => {
              e.preventDefault();
              const newName = prompt("重命名工作流收藏：", fav.custom_name || fav.original_name);
              if (newName && newName !== fav.custom_name) {
                const favs = getWFFavs();
                if (favs[fav.path]) {
                  favs[fav.path].custom_name = newName;
                  saveWF(KEY_WF_FAVS, favs);
                  refresh();
                }
              }
            };
            item.onclick = (e) => {
              if (e.target.tagName === 'BUTTON') return;
              openWorkflowInCanvas(fav.path);
              toggle();
            };
            // 拖拽排序：保存到 jdsc:workflow_fav_order
            item.dataset.path = fav.path;
            item.dataset.starred = fav.starred ? '1' : '0';
            let dragging = false; let startY = 0; let curY = 0; let ghost = null; let placeholder = null; let rowRect = null; let offsetY = 0;
            const onMove = (e) => {
              if (!dragging) return; curY = e.clientY; try { e.preventDefault(); } catch { }
              if (ghost) ghost.style.top = `${Math.round(curY - offsetY)}px`;
              const rows = Array.from(body.querySelectorAll('.jdsc-wf-fav-item')).filter(r => r !== item && String(r.dataset.starred || '0') === String(item.dataset.starred || '0'));
              if (!rows.length || !placeholder) return;
              const rects = rows.map(r => { const br = r.getBoundingClientRect(); return { r, mid: br.top + br.height / 2 }; });
              let nearestIdx = 0; let best = Infinity;
              rects.forEach((ent, idx) => { const d = Math.abs(curY - ent.mid); if (d < best) { best = d; nearestIdx = idx; } });
              const targetEl = rects[nearestIdx]?.r || null;
              if (targetEl) {
                if (curY < rects[nearestIdx].mid) body.insertBefore(placeholder, targetEl);
                else body.insertBefore(placeholder, targetEl.nextSibling);
              }
            };
            const onUp = (e) => {
              if (!dragging) return; dragging = false;
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
              try { modal.classList.remove('jdsc-wf-noselect'); } catch { }
              if (ghost) { try { ghost.remove(); } catch { } ghost = null; }
              if (placeholder) { try { placeholder.replaceWith(item); } catch { } placeholder = null; }
              item.style.visibility = '';
              try {
                const rowsAll = Array.from(body.querySelectorAll('.jdsc-wf-fav-item'));
                const pinnedSeq = rowsAll.filter(r => String(r.dataset.starred || '0') === '1').map(r => String(r.dataset.path || ''));
                const unpinnedSeq = rowsAll.filter(r => String(r.dataset.starred || '0') !== '1').map(r => String(r.dataset.path || ''));
                const visibleSeq = pinnedSeq.concat(unpinnedSeq);
                let order = loadWF('jdsc:workflow_fav_order', []); if (!Array.isArray(order)) order = [];
                const setVisible = new Set(visibleSeq);
                const rest = order.filter(p => !setVisible.has(p));
                const allPaths = Object.keys(getWFFavs());
                const missing = allPaths.filter(p => !setVisible.has(p) && !rest.includes(p));
                order = visibleSeq.concat(rest).concat(missing);
                saveWF('jdsc:workflow_fav_order', order);
                refresh();
              } catch { }
            };
            handle.addEventListener('mousedown', (e) => {
              e.stopPropagation(); try { e.preventDefault(); } catch { }
              dragging = true; startY = e.clientY; curY = startY; try { modal.classList.add('jdsc-wf-noselect'); } catch { }
              try {
                rowRect = item.getBoundingClientRect(); offsetY = startY - rowRect.top;
                ghost = document.createElement('div'); ghost.className = 'jdsc-wf-drag-ghost';
                ghost.style.left = `${Math.round(rowRect.left)}px`; ghost.style.top = `${Math.round(rowRect.top)}px`;
                ghost.style.width = `${Math.round(rowRect.width)}px`; ghost.style.height = `${Math.round(rowRect.height)}px`;
                ghost.innerHTML = item.innerHTML; document.body.appendChild(ghost);
                placeholder = document.createElement('div'); placeholder.className = 'jdsc-wf-drag-placeholder'; placeholder.style.height = `${Math.round(rowRect.height)}px`;
                item.parentElement.insertBefore(placeholder, item); item.style.visibility = 'hidden';
              } catch { }
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            });
            body.appendChild(item);
          }
        }
      }
      try { setModalHeightForMode(); } catch { }
    }
    tabWorkflow.onclick = () => {
      currentMode = "workflow";
      tabWorkflow.classList.add("active");
      tabFavorites.classList.remove("active");
      searchInput.placeholder = "搜索工作流...";
      refresh();
    };
    tabFavorites.onclick = () => {
      currentMode = "favorites";
      tabFavorites.classList.add("active");
      tabWorkflow.classList.remove("active");
      tabHistory.classList.remove("active");
      searchInput.placeholder = "搜索收藏的工作流...";
      refresh();
    };
    tabHistory.onclick = () => {
      currentMode = "history";
      tabHistory.classList.add("active");
      tabWorkflow.classList.remove("active");
      tabFavorites.classList.remove("active");
      searchInput.placeholder = "搜索历史记录...";
      refresh();
    };
    syncSettingsFromServer().then(() => syncFoldersFromServer()).then(() => syncFavsFromServer()).then(() => refresh());
    document.body.appendChild(modal);
    return modal;
  };
  document.addEventListener('keydown', (e) => {
    const hkStr = getWFHotkey();
    const hkSpec = normalizeHotkeyString(hkStr);
    if (matchHotkey(e, hkSpec)) {
      e.preventDefault();
      const existing = document.querySelector('.jdsc-modal .jdsc-title');
      if (existing && existing.textContent === '工作流+') {
        const modal = existing.closest('.jdsc-modal');
        if (modal) modal.remove();
      } else {
        if (window.__jdsc_toggleWorkflow) window.__jdsc_toggleWorkflow();
      }
    }
  });

  // 遍历已有文件夹列表
  function getFolders() {
    let folders = loadWF(KEY_WF_FOLDERS, []);
    if (!Array.isArray(folders)) folders = [];

    const folderMap = new Map(); // 用于去重，key为标准化路径

    // 路径标准化函数
    const normalizePath = (p) => {
      if (!p) return '';
      return p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    };

    // 首先添加默认文件夹，确保它始终存在且是唯一的
    const defaultFolder = {
      id: 'default',
      name: '默认工作流',
      path: 'user/default/workflows',
      enabled: true,
      order: 0,
      is_default: true,
    };
    folderMap.set(normalizePath(defaultFolder.path), defaultFolder);

    // 遍历已有文件夹列表
    for (const folder of folders) {
      // 如果是旧的默认文件夹记录（id为default），跳过
      if (folder.id === 'default') continue;
      // 【强去重】如果名称是"默认工作流"，也跳过（强制单例）
      if (folder.name === '默认工作流') continue;

      if (folder && folder.path) {
        const normPath = normalizePath(folder.path);
        // 如果路径未出现过，则添加
        if (!folderMap.has(normPath)) {
          folderMap.set(normPath, folder);
        }
      }
    }

    // 将 Map 转换回数组
    const uniqueFolders = Array.from(folderMap.values());

    return uniqueFolders;
  }

  function getWFFavs() {
    let favs = loadWF(KEY_WF_FAVS, {});
    if (!favs || typeof favs !== 'object') favs = {};
    return favs;
  }

  function getWFHotkey() {
    try {
      const hk = loadWF(KEY_WF_HOTKEY, null);
      return hk ? hk : "alt+w";
    } catch {
      return "alt+w";
    }
  }

  function saveWFHotkey(val) {
    try {
      saveWF(KEY_WF_HOTKEY, val);
    } catch { }
  }

  function normalizeHotkeyString(s) {
    if (!s) return { ctrl: false, alt: false, shift: false, key: "" };
    const lower = s.toLowerCase().trim();
    const parts = lower.split("+").map(p => p.trim());
    const result = { ctrl: false, alt: false, shift: false, key: "" };
    for (const p of parts) {
      if (p === "ctrl" || p === "control") result.ctrl = true;
      else if (p === "alt") result.alt = true;
      else if (p === "shift") result.shift = true;
      else if (p.length > 0) result.key = p.toUpperCase();
    }
    return result;
  }

  function matchHotkey(e, spec) {
    if (!spec || !spec.key) return false;
    const ekey = e.key.toUpperCase();
    if (ekey !== spec.key) return false;
    if (!!e.ctrlKey !== !!spec.ctrl) return false;
    if (!!e.altKey !== !!spec.alt) return false;
    if (!!e.shiftKey !== !!spec.shift) return false;
    return true;
  }

  // 【Ctrl+S 保存拦截功能】
  // 拦截 Ctrl+S，直接保存到原始路径
  document.addEventListener('keydown', async (e) => {
    // 只拦截 Ctrl+S (Windows/Linux) 或 Cmd+S (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      try {
        // === 核心修改：只信任绑定在 Graph 对象上的路径 ===
        // 任何 DOM 属性、全局变量、标签状态都不可靠
        let savePath = null;
        let saveName = null;

        if (window.app && window.app.graph && window.app.graph.jdsc_path) {
          savePath = window.app.graph.jdsc_path;
          saveName = window.app.graph.jdsc_name || savePath.split(/[\\/]/).pop().replace(/\.json$/i, '');

          // === 安全检查：文件名一致性验证 ===
          // 尝试获取当前 UI 上的标签名，如果与绑定的 saveName 严重不符，则发出警告或阻止
          try {
            const activeTab = document.querySelector('.p-togglebutton-checked, .workflow-tab.active');
            if (activeTab) {
              const tabText = (activeTab.textContent || '').trim();
              // 如果标签名存在，且与 saveName 不包含关系（宽松匹配），则警示
              // 注意：tabText 可能是 "MyFlow (modified)" 或 "MyFlow.json"，所以用宽松匹配
              if (tabText && saveName && !tabText.includes(saveName) && !saveName.includes(tabText)) {
                console.warn(`[工作流+] 安全警告：当前标签名 "${tabText}" 与绑定文件名 "${saveName}" 不匹配！`);
                // 这种情况下，极有可能是串台了，强制清除绑定并终止保存
                window.app.graph.jdsc_path = null;
                window.app.graph.jdsc_name = null;
                savePath = null; // 终止拦截
                console.error('[工作流+] 已自动终止保存拦截，防止误覆盖。');
              }
            }
          } catch (e) { console.warn('安全检查异常', e); }

          if (savePath) {
            console.log('[工作流+] (Ctrl+S) 从 Graph 获取路径:', savePath);
          }
        }

        // 如果存在保存路径，拦截默认保存行为
        if (savePath) {
          e.preventDefault();
          e.stopPropagation();

          // === 3. 用户确认对话框 ===
          const confirmMsg = `即将保存工作流，请确认：\n\n文件名: ${saveName || '未知'}\n完整路径: ${savePath}\n\n这是您要保存的文件吗？`;
          if (!confirm(confirmMsg)) {
            console.log('[工作流+] 用户取消保存');
            return;
          }

          // 显示蓝色通知：提示正在拦截保存
          const notificationInfo = document.createElement('div');
          notificationInfo.textContent = '⚡ 正在保存: ' + (saveName || '...');
          notificationInfo.style.cssText = 'position:fixed;top:20px;right:20px;background:#1677ff;color:#fff;padding:12px 20px;border-radius:4px;z-index:999999;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.15)';
          document.body.appendChild(notificationInfo);

          try {
            // 获取当前工作流数据
            if (!window.app || !window.app.graph) {
              throw new Error('无法获取工作流数据');
            }

            const workflowData = window.app.graph.serialize();

            // 保存到指定路径
            await saveWorkflowToPath(savePath, workflowData);

            // 移除蓝色通知
            setTimeout(() => notificationInfo.remove(), 500);

            console.log('[工作流+] ✓ Ctrl+S 拦截保存成功:', savePath);

          } catch (err) {
            // 移除蓝色通知
            notificationInfo.remove();

            // 显示红色错误通知
            const notificationError = document.createElement('div');
            notificationError.textContent = '✗ 保存失败: ' + (err.message || '未知错误');
            notificationError.style.cssText = 'position:fixed;top:20px;right:20px;background:#ff4d4f;color:#fff;padding:12px 20px;border-radius:4px;z-index:999999;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.15)';
            document.body.appendChild(notificationError);
            setTimeout(() => notificationError.remove(), 3000);

            console.error('[工作流+] ✗ Ctrl+S 拦截保存失败:', err);
          }
        }
        // 如果没有保存路径，让默认保存行为继续执行
      } catch (e) {
        console.error('[工作流+] Ctrl+S 拦截出错:', e);
      }
    }
  }, true); // 使用捕获阶段，确保优先拦截

  // Monkey Patch: 拦截原生 handleFile 以记录历史
  if (window.app && typeof window.app.handleFile === 'function') {
    const originalHandleFile = window.app.handleFile;
    window.app.handleFile = async function (file) {
      try {
        // 【BUG修复】原生加载文件时，必须清除之前记录的“工作流+”保存路径
        // 否则 Ctrl+S 会覆盖掉之前打开的文件
        currentWorkflowInfo = null;
        window.__jdsc_active_save_path = null;
        window.__jdsc_active_display_name = null;
        if (window.app && window.app.graph) {
          window.app.graph.jdsc_path = null;
          window.app.graph.jdsc_name = null;
        }
        console.log('[工作流+] 原生加载文件，已清除保存路径绑定');

        // 清除当前激活标签的绑定属性（防止从标签读取到旧路径）
        try {
          const activeTab = document.querySelector('.p-togglebutton-checked');
          if (activeTab) {
            activeTab.removeAttribute('data-jdsc-path');
            activeTab.removeAttribute('data-jdsc-name');
          }
          // 同时也尝试清除可能存在的其他高亮样式的标签
          const otherActive = document.querySelector('.workflow-label.active, .workflow-tab.active');
          if (otherActive) {
            otherActive.removeAttribute('data-jdsc-path');
            otherActive.removeAttribute('data-jdsc-name');
            if (otherActive.parentElement) {
              otherActive.parentElement.removeAttribute('data-jdsc-path');
              otherActive.parentElement.removeAttribute('data-jdsc-name');
            }
          }
        } catch { }

        if (file && file.name) {
          const name = file.name.replace(/\.json$/i, '');
          addToWFHistory(name, null, 'native');
        }
      } catch { }
      return await originalHandleFile.apply(this, arguments);
    };
  }

  // Monkey Patch: 拦截 LGraph 底层方法以清除状态
  // 这是最底层的拦截，无论通过何种方式（多标签插件、原生加载、拖拽）改变画布，都会触发
  if (window.LGraph) {
    // 1. 拦截 configure (加载新数据时触发)
    const originalConfigure = window.LGraph.prototype.configure;
    window.LGraph.prototype.configure = function (data, keep_old) {
      const ret = originalConfigure.apply(this, arguments);

      // 如果是本插件主动加载的，不做处理（openWorkflowInCanvas 会负责后续绑定）
      if (window.__jdsc_loading_flag) return ret;

      // === 核心逻辑：尝试从 SessionID 恢复绑定 ===
      // 当切换标签时，Graph 会被重建，但 extra 数据通常会被恢复
      let restored = false;
      if (this.extra && this.extra.jdsc_session_id) {
        const sid = this.extra.jdsc_session_id;
        if (window.__jdsc_session_map && window.__jdsc_session_map.has(sid)) {
          const info = window.__jdsc_session_map.get(sid);
          if (info) {
            this.jdsc_path = info.path;
            this.jdsc_name = info.name;
            // console.log('[工作流+] 检测到会话恢复 (configure)，已还原路径:', info.path);
            restored = true;
          }
        }
      }

      // 如果无法恢复（说明是外部新加载的文件，或者 Session 已过期），则强制清除绑定
      if (!restored) {
        // 只有当 this 是当前的 app.graph 时才打印日志
        if (window.app && window.app.graph === this) {
          // console.log('[工作流+] 检测到外部加载 (configure)，清除绑定');
        }
        this.jdsc_path = null;
        this.jdsc_name = null;
        // 同时也清除 extra 中的 session_id，防止污染
        if (this.extra) delete this.extra.jdsc_session_id;
      }

      return ret;
    };

    // 2. 拦截 clear (清空画布时触发)
    const originalClear = window.LGraph.prototype.clear;
    window.LGraph.prototype.clear = function () {
      if (!window.__jdsc_loading_flag) {
        // 只有当 this 是当前的 app.graph 时才打印日志
        if (window.app && window.app.graph === this) {
          // console.log('[工作流+] 检测到 Graph 清空 (clear)，清除保存路径绑定');
        }
        this.jdsc_path = null;
        this.jdsc_name = null;
        // 【BUG修复】清空画布时，同步清除“备胎”信息，防止收藏时读取到上一个文件的信息
        currentWorkflowInfo = null;
      }
      return originalClear.apply(this, arguments);
    };
  }

})();
