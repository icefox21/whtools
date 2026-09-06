export function normalizeWorkflowPath(filePath) {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export function cleanWorkflowName(name) {
  const baseName = String(name || '').trim().split(/[\\/]/).pop();
  return String(baseName || '')
    .replace(/\.json$/i, '')
    .replace(/^\s*\*+\s*/, '')
    .replace(/\s*\*+\s*$/, '')
    .replace(/\s+\((modified|unsaved|已修改|未保存)\)$/i, '')
    .trim();
}

export function sanitizeExternalWorkflowGraph(graph) {
  let removedLegacySession = false;
  if (graph?.extra && Object.prototype.hasOwnProperty.call(graph.extra, 'jdsc_session_id')) {
    delete graph.extra.jdsc_session_id;
    removedLegacySession = true;
  }
  if (graph) {
    graph.jdsc_path = null;
    graph.jdsc_name = null;
    delete graph.__jdsc_session_id;
  }
  return { removedLegacySession };
}

export function stripLegacySessionFromSerializedWorkflow(workflow) {
  if (workflow?.extra && Object.prototype.hasOwnProperty.call(workflow.extra, 'jdsc_session_id')) {
    delete workflow.extra.jdsc_session_id;
  }
  return workflow;
}

function sortedWorkflowValue(value) {
  if (Array.isArray(value)) return value.map(sortedWorkflowValue);
  if (!value || typeof value !== 'object') return value;
  const sorted = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortedWorkflowValue(value[key]);
  }
  return sorted;
}

export function workflowsSemanticallyEqual(left, right) {
  const comparable = (workflow) => {
    const copy = sortedWorkflowValue(workflow);
    if (copy?.extra && Object.prototype.hasOwnProperty.call(copy.extra, 'jdsc_session_id')) {
      delete copy.extra.jdsc_session_id;
    }
    return JSON.stringify(copy);
  };
  return comparable(left) === comparable(right);
}

export function reconcileAutosavedWorkflowRevision({
  expectedRevision = '',
  diskRevision = '',
  diskWorkflow,
  currentWorkflow,
} = {}) {
  if (!diskRevision || diskRevision === expectedRevision) return null;
  return workflowsSemanticallyEqual(diskWorkflow, currentWorkflow) ? diskRevision : null;
}

// ComfyUI AutoSave only writes an active workflow when `isPersisted` is true.
// WHTools controls writes for its bound workflows, so shadow just that getter on
// the instance. Do not mutate `size`: ComfyUI derives `isTemporary` from it.
export function suppressNativeAutosaveForManagedWorkflow(workflow) {
  if (!workflow || typeof workflow !== 'object') return null;
  const originalDescriptor = Object.getOwnPropertyDescriptor(workflow, 'isPersisted');
  try {
    Object.defineProperty(workflow, 'isPersisted', {
      configurable: true,
      enumerable: originalDescriptor?.enumerable ?? false,
      get: () => false,
    });
    return { originalDescriptor };
  } catch {
    return null;
  }
}

export function restoreNativeAutosaveForManagedWorkflow(workflow, token) {
  if (!workflow || !token || typeof workflow !== 'object') return false;
  try {
    if (token.originalDescriptor) {
      Object.defineProperty(workflow, 'isPersisted', token.originalDescriptor);
    } else {
      delete workflow.isPersisted;
    }
    return true;
  } catch {
    return false;
  }
}

export function bindingMatchesActive({ binding, active, graph }) {
  if (!binding || !active || !graph) return { ok: false, reason: 'missing_binding_state' };
  if (
    binding.workflow &&
    active.workflow &&
    binding.workflow !== active.workflow &&
    (!binding.workflowKey || !active.workflowKey || binding.workflowKey !== String(active.workflowKey))
  ) {
    return { ok: false, reason: 'active_workflow_changed' };
  }

  const activeKey = String(active.workflowKey || '');
  if (binding.workflowKey && activeKey && binding.workflowKey !== activeKey) {
    return { ok: false, reason: 'active_workflow_changed' };
  }

  const activeName = cleanWorkflowName(active.displayName);
  if (
    binding.nameNoExt &&
    activeName &&
    binding.nameNoExt.toLocaleLowerCase() !== activeName.toLocaleLowerCase()
  ) {
    return { ok: false, reason: 'active_workflow_changed' };
  }

  if (normalizeWorkflowPath(graph.jdsc_path) !== normalizeWorkflowPath(binding.path)) {
    return { ok: false, reason: 'graph_path_changed' };
  }
  if (String(graph.__jdsc_session_id || '') !== String(binding.sessionId || '')) {
    return { ok: false, reason: 'session_changed' };
  }
  return { ok: true };
}

export function classifyHistoryEntry(item, favorites = {}) {
  const path = String(item?.path || '');
  const normalizedPath = normalizeWorkflowPath(path);
  const favorite = Object.keys(favorites || {}).some(
    (candidate) => normalizeWorkflowPath(candidate) === normalizedPath,
  );
  const storage = item?.storage === 'staged' || normalizedPath.includes('/__工作流+临时__/')
    ? 'staged'
    : 'default';
  return { storage, favorite };
}

export function makeHistoryEntry({
  id = '',
  name = '未命名工作流',
  path = null,
  method = 'jdsc',
  storage = 'default',
  sourceType = 'workflow_file',
  sourceName = '',
  sourcePath = null,
  stageId = '',
  now = Date.now(),
}) {
  return {
    id: id || `wfhist_${String(now)}_${Math.random().toString(36).slice(2)}`,
    name,
    path,
    time: now,
    last_saved: now,
    method,
    storage,
    source_type: sourceType,
    source_name: sourceName,
    source_path: sourcePath,
    stage_id: stageId,
  };
}

export function upsertHistoryEntry(history, entry, { limit = 200 } = {}) {
  const items = Array.isArray(history) ? history : [];
  const remaining = items.filter((item) => {
    if (entry.path && item.path === entry.path) return false;
    return !(!entry.path && item.name === entry.name && !item.path);
  });
  return [entry, ...remaining].slice(0, limit);
}

export function createSerialWriteQueue() {
  const tails = new Map();
  return function enqueue(key, task) {
    const previous = tails.get(key) || Promise.resolve();
    const run = previous.catch(() => undefined).then(task);
    tails.set(key, run.catch(() => undefined));
    return run;
  };
}
