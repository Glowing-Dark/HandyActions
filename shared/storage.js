(function initHandyStorage(globalScope) {
  if (globalScope.HandyStorage) return;

  const STORAGE_KEY = 'handy_data_v1';
  const PICKER_SESSION_KEY = 'handy_last_pick_v1';

  const DEFAULT_DATA = {
    version: 1,
    workflows: [],
    buttons: []
  };

  function generateId(prefix) {
    const rand = Math.random().toString(36).slice(2, 8);
    return `${prefix}_${Date.now().toString(36)}_${rand}`;
  }

  function normalizeStep(step) {
    const s = step || {};
    return {
      id: s.id || generateId('st'),
      type: s.type || 'click',
      selector: typeof s.selector === 'string' ? s.selector : '',
      elementLabel: typeof s.elementLabel === 'string' ? s.elementLabel : '',
      value: typeof s.value === 'string' ? s.value : '',
      delayMs: Number.isFinite(Number(s.delayMs)) ? Math.max(0, Number(s.delayMs)) : 45,
      clearFirst: s.clearFirst !== false,
      waitMs: Number.isFinite(Number(s.waitMs)) ? Math.max(0, Number(s.waitMs)) : 500,
      timeoutMs: Number.isFinite(Number(s.timeoutMs)) ? Math.max(100, Number(s.timeoutMs)) : 5000,
      key: typeof s.key === 'string' && s.key ? s.key : 'Enter',
      modifiers: {
        ctrl: Boolean(s.modifiers?.ctrl),
        shift: Boolean(s.modifiers?.shift),
        alt: Boolean(s.modifiers?.alt),
        meta: Boolean(s.modifiers?.meta)
      }
    };
  }

  function normalizeWorkflow(wf) {
    const now = Date.now();
    return {
      id: wf.id || generateId('wf'),
      name: (wf.name || 'Untitled Workflow').trim(),
      urlPattern: (wf.urlPattern || '*://*/*').trim(),
      enabled: wf.enabled !== false,
      steps: Array.isArray(wf.steps) ? wf.steps.map(normalizeStep) : [],
      createdAt: wf.createdAt || now,
      updatedAt: now
    };
  }

  function normalizeButton(btn) {
    const now = Date.now();
    return {
      id: btn.id || generateId('btn'),
      label: (btn.label || 'Quick Action').trim(),
      color: btn.color || 'blue',
      urlPattern: (btn.urlPattern || '*://*/*').trim(),
      enabled: btn.enabled !== false,
      placementMode: btn.placementMode === 'floating' ? 'floating' : 'anchor',
      anchorSelector: typeof btn.anchorSelector === 'string' ? btn.anchorSelector : '',
      anchorLabel: typeof btn.anchorLabel === 'string' ? btn.anchorLabel : '',
      anchorPosition: ['before', 'after', 'prepend', 'append'].includes(btn.anchorPosition)
        ? btn.anchorPosition
        : 'after',
      floatingCorner: ['bottom-right', 'bottom-left', 'top-right', 'top-left'].includes(
        btn.floatingCorner
      )
        ? btn.floatingCorner
        : 'bottom-right',
      actionMode: btn.actionMode === 'workflow' ? 'workflow' : 'steps',
      workflowId: typeof btn.workflowId === 'string' ? btn.workflowId : '',
      steps: Array.isArray(btn.steps) ? btn.steps.map(normalizeStep) : [],
      createdAt: btn.createdAt || now,
      updatedAt: now
    };
  }

  async function getAllData() {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    const raw = stored[STORAGE_KEY];
    if (!raw || typeof raw !== 'object') {
      return { version: 1, workflows: [], buttons: [] };
    }
    return {
      version: 1,
      workflows: Array.isArray(raw.workflows) ? raw.workflows : [],
      buttons: Array.isArray(raw.buttons) ? raw.buttons : []
    };
  }

  async function saveAllData(data) {
    const payload = {
      version: 1,
      workflows: Array.isArray(data.workflows) ? data.workflows : [],
      buttons: Array.isArray(data.buttons) ? data.buttons : []
    };
    await chrome.storage.local.set({ [STORAGE_KEY]: payload });
    return payload;
  }

  async function saveWorkflow(workflowInput) {
    const data = await getAllData();
    const normalized = normalizeWorkflow(workflowInput);
    const idx = data.workflows.findIndex((w) => w.id === normalized.id);
    if (idx >= 0) {
      normalized.createdAt = data.workflows[idx].createdAt || normalized.createdAt;
      data.workflows[idx] = normalized;
    } else {
      data.workflows.unshift(normalized);
    }
    await saveAllData(data);
    return normalized;
  }

  async function deleteWorkflow(workflowId) {
    const data = await getAllData();
    data.workflows = data.workflows.filter((w) => w.id !== workflowId);
    await saveAllData(data);
    return data;
  }

  async function saveButton(buttonInput) {
    const data = await getAllData();
    const normalized = normalizeButton(buttonInput);
    const idx = data.buttons.findIndex((b) => b.id === normalized.id);
    if (idx >= 0) {
      normalized.createdAt = data.buttons[idx].createdAt || normalized.createdAt;
      data.buttons[idx] = normalized;
    } else {
      data.buttons.unshift(normalized);
    }
    await saveAllData(data);
    return normalized;
  }

  async function deleteButton(buttonId) {
    const data = await getAllData();
    data.buttons = data.buttons.filter((b) => b.id !== buttonId);
    await saveAllData(data);
    return data;
  }

  async function getMatchingForUrl(url) {
    const data = await getAllData();
    const matcher = globalScope.HandyUrlMatcher;
    if (!matcher || !url) {
      return { workflows: [], buttons: [] };
    }
    return {
      workflows: data.workflows.filter((w) => matcher.matchesUrl(w.urlPattern, url)),
      buttons: data.buttons.filter((b) => matcher.matchesUrl(b.urlPattern, url))
    };
  }

  globalScope.HandyStorage = {
    STORAGE_KEY,
    PICKER_SESSION_KEY,
    DEFAULT_DATA,
    generateId,
    normalizeStep,
    normalizeWorkflow,
    normalizeButton,
    getAllData,
    saveAllData,
    saveWorkflow,
    deleteWorkflow,
    saveButton,
    deleteButton,
    getMatchingForUrl
  };
})(globalThis);
