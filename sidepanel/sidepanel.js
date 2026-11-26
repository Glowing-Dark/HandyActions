(function initSidePanel() {
  const STEP_TYPES = [
    { value: 'click', label: 'Click' },
    { value: 'dblclick', label: 'Double Click' },
    { value: 'contextmenu', label: 'Right Click' },
    { value: 'hover', label: 'Hover' },
    { value: 'fill', label: 'Fill Input (Instant)' },
    { value: 'type', label: 'Type Sequentially' },
    { value: 'select', label: 'Select Dropdown Option' },
    { value: 'keypress', label: 'Press Key' },
    { value: 'clear', label: 'Clear Input' },
    { value: 'focus', label: 'Focus Element' },
    { value: 'scroll', label: 'Scroll Into View' },
    { value: 'wait', label: 'Wait (Delay)' },
    { value: 'waitFor', label: 'Wait for Element' },
    { value: 'runWorkflow', label: 'Run Another Workflow' }
  ];

  const BUTTON_THEME_HEX = {
    blue: '#2563eb',
    emerald: '#059669',
    violet: '#7c3aed',
    amber: '#d97706',
    rose: '#e11d48',
    slate: '#1e293b'
  };

  const STANDARD_KEYS = ['Enter', 'Tab', 'Escape', 'Backspace', 'Space', 'ArrowDown', 'ArrowUp'];

  const state = {
    activeTab: null,
    data: { version: 1, workflows: [], buttons: [] },
    currentTabView: 'current', // 'current' | 'all'
    previousView: 'current',
    editorKind: null, // 'workflow' | 'button' | null
    draft: null,
    pickingContext: null,
    activeRunId: null,
    stepStates: {}, // stepId -> 'running' | 'done' | 'error'
    pendingConfirmResolve: null
  };

  const els = {
    activeUrlLabel: document.getElementById('active-url-label'),
    currentCountPill: document.getElementById('current-count-pill'),
    allCountPill: document.getElementById('all-count-pill'),
    mainTabs: document.getElementById('main-tabs'),
    pickerBanner: document.getElementById('picker-banner'),
    pickerBannerMsg: document.getElementById('picker-banner-msg'),
    cancelPickerBtn: document.getElementById('cancel-picker-btn'),
    viewCurrent: document.getElementById('view-current'),
    viewAll: document.getElementById('view-all'),
    viewEditor: document.getElementById('view-editor'),
    unsupportedNotice: document.getElementById('unsupported-notice'),
    currentButtonsSub: document.getElementById('current-buttons-sub'),
    currentButtonsList: document.getElementById('current-buttons-list'),
    currentWorkflowsSub: document.getElementById('current-workflows-sub'),
    currentWorkflowsList: document.getElementById('current-workflows-list'),
    allSearchInput: document.getElementById('all-search-input'),
    allSitesList: document.getElementById('all-sites-list'),
    newWorkflowBtn: document.getElementById('new-workflow-btn'),
    newButtonBtn: document.getElementById('new-button-btn'),
    allNewWorkflowBtn: document.getElementById('all-new-workflow-btn'),
    allNewButtonBtn: document.getElementById('all-new-button-btn'),
    editorBackBtn: document.getElementById('editor-back-btn'),
    editorTitle: document.getElementById('editor-title'),
    editorMatchChip: document.getElementById('editor-match-chip'),
    editorForm: document.getElementById('editor-form'),
    edNameLabel: document.getElementById('ed-name-label'),
    edName: document.getElementById('ed-name'),
    edButtonAppearance: document.getElementById('ed-button-appearance'),
    edBtnPreview: document.getElementById('ed-btn-preview'),
    edColorSwatches: document.getElementById('ed-color-swatches'),
    edUrlPattern: document.getElementById('ed-url-pattern'),
    edEnabled: document.getElementById('ed-enabled'),
    edUrlPresets: document.getElementById('ed-url-presets'),
    edWorkflowAutorun: document.getElementById('ed-workflow-autorun'),
    edAutorunEnabled: document.getElementById('ed-autorun-enabled'),
    edAutorunDelayWrap: document.getElementById('ed-autorun-delay-wrap'),
    edAutorunDelay: document.getElementById('ed-autorun-delay'),
    edAutorunPresets: document.getElementById('ed-autorun-presets'),
    edButtonPlacement: document.getElementById('ed-button-placement'),
    edPlacementMode: document.getElementById('ed-placement-mode'),
    edPlacementAnchorFields: document.getElementById('ed-placement-anchor-fields'),
    edPlacementFloatingFields: document.getElementById('ed-placement-floating-fields'),
    edAnchorSelector: document.getElementById('ed-anchor-selector'),
    edPickAnchorBtn: document.getElementById('ed-pick-anchor-btn'),
    edLocateAnchorBtn: document.getElementById('ed-locate-anchor-btn'),
    edAnchorPosition: document.getElementById('ed-anchor-position'),
    edFloatingCorner: document.getElementById('ed-floating-corner'),
    edButtonActionMode: document.getElementById('ed-button-action-mode'),
    edActionModeToggle: document.getElementById('ed-action-mode-toggle'),
    edLinkedWorkflowWrap: document.getElementById('ed-linked-workflow-wrap'),
    edLinkedWorkflow: document.getElementById('ed-linked-workflow'),
    edStepsSection: document.getElementById('ed-steps-section'),
    edStepsCount: document.getElementById('ed-steps-count'),
    edStepsList: document.getElementById('ed-steps-list'),
    edPickAddStepBtn: document.getElementById('ed-pick-add-step-btn'),
    edAddWorkflowStepBtn: document.getElementById('ed-add-workflow-step-btn'),
    edAddWaitBtn: document.getElementById('ed-add-wait-btn'),
    edAddEmptyStepBtn: document.getElementById('ed-add-empty-step-btn'),
    edRunBtn: document.getElementById('ed-run-btn'),
    edStopBtn: document.getElementById('ed-stop-btn'),
    edSaveBtn: document.getElementById('ed-save-btn'),
    confirmDialog: document.getElementById('confirm-dialog'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmMessage: document.getElementById('confirm-message'),
    openBackupBtn: document.getElementById('open-backup-btn'),
    backupDialog: document.getElementById('backup-dialog'),
    exportJsonBtn: document.getElementById('export-json-btn'),
    importJsonFile: document.getElementById('import-json-file'),
    backupJsonText: document.getElementById('backup-json-text'),
    importMergeBtn: document.getElementById('import-merge-btn'),
    importReplaceBtn: document.getElementById('import-replace-btn'),
    toastRegion: document.getElementById('toast-region'),
    toastLive: document.getElementById('toast-live')
  };

  // ---------- Toast Notifications (popover="manual") ----------
  function showToast(message, tone = 'info') {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const toast = document.createElement('div');
    toast.id = id;
    toast.className = 'toast-item';
    toast.setAttribute('popover', 'manual');
    toast.setAttribute('data-tone', tone);

    const textSpan = document.createElement('span');
    textSpan.className = 'toast-msg';
    textSpan.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'icon-btn';
    closeBtn.setAttribute('popovertarget', id);
    closeBtn.setAttribute('popovertargetaction', 'hide');
    closeBtn.setAttribute('aria-label', 'Dismiss notification');
    closeBtn.textContent = '✕';

    toast.append(textSpan, closeBtn);
    els.toastRegion.appendChild(toast);

    try {
      toast.showPopover();
    } catch {
      toast.classList.add(':popover-open');
    }

    if (typeof document.ariaNotify === 'function') {
      document.ariaNotify(message);
    } else {
      els.toastLive.textContent = message;
    }

    const removeToast = () => {
      try {
        if (toast.matches(':popover-open')) toast.hidePopover();
      } catch {
        // ignore
      }
      toast.remove();
    };

    let timer = setTimeout(removeToast, 3200);
    toast.addEventListener('focusin', () => clearTimeout(timer));
    toast.addEventListener('focusout', () => {
      timer = setTimeout(removeToast, 2200);
    });
    toast.addEventListener('toggle', (e) => {
      if (e.newState === 'closed') {
        clearTimeout(timer);
        toast.remove();
      }
    });
  }

  // ---------- Native Modal Confirm ----------
  function askConfirm(title, message) {
    return new Promise((resolve) => {
      els.confirmTitle.textContent = title;
      els.confirmMessage.textContent = message;
      state.pendingConfirmResolve = resolve;
      els.confirmDialog.returnValue = '';
      els.confirmDialog.showModal();
    });
  }

  els.confirmDialog.addEventListener('close', () => {
    const confirmed = els.confirmDialog.returnValue === 'confirm';
    els.confirmDialog.returnValue = '';
    if (state.pendingConfirmResolve) {
      const res = state.pendingConfirmResolve;
      state.pendingConfirmResolve = null;
      res(confirmed);
    }
  });

  // ---------- Active Tab & Messaging ----------
  async function refreshActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      state.activeTab = tab || null;
    } catch {
      state.activeTab = null;
    }

    const url = state.activeTab?.url || '';
    if (!url) {
      els.activeUrlLabel.textContent = 'No active tab';
      els.activeUrlLabel.title = '';
    } else if (!HandyUrlMatcher.isSupportedWebUrl(url)) {
      els.activeUrlLabel.textContent = 'Browser internal page';
      els.activeUrlLabel.title = url;
    } else {
      try {
        const u = new URL(url);
        els.activeUrlLabel.textContent = `${u.host}${u.pathname}`;
      } catch {
        els.activeUrlLabel.textContent = url;
      }
      els.activeUrlLabel.title = url;
    }

    const supported = HandyUrlMatcher.isSupportedWebUrl(url);
    els.unsupportedNotice.hidden = supported;

    renderAllViews();
  }

  async function sendToActiveTab(message) {
    const tab = state.activeTab;
    if (!tab || typeof tab.id !== 'number' || !HandyUrlMatcher.isSupportedWebUrl(tab.url)) {
      showToast('Open an http/https webpage to run actions or pick elements.', 'error');
      return null;
    }
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      // Content script might not be loaded on a pre-existing tab; inject and retry
      const ensured = await chrome.runtime.sendMessage({
        type: 'ENSURE_CONTENT_SCRIPT',
        tabId: tab.id
      });
      if (!ensured?.ok) {
        showToast(ensured?.error || 'Could not connect to this webpage.', 'error');
        return null;
      }
      try {
        return await chrome.tabs.sendMessage(tab.id, message);
      } catch (err) {
        showToast(err?.message || 'Could not reach webpage.', 'error');
        return null;
      }
    }
  }

  // ---------- Data Loading ----------
  async function loadData() {
    state.data = await HandyStorage.getAllData();
    renderAllViews();
  }

  function getMatchingItemsForCurrentUrl() {
    const url = state.activeTab?.url || '';
    if (!HandyUrlMatcher.isSupportedWebUrl(url)) {
      return { workflows: [], buttons: [] };
    }
    return {
      workflows: state.data.workflows.filter((w) => HandyUrlMatcher.matchesUrl(w.urlPattern, url)),
      buttons: state.data.buttons.filter((b) => HandyUrlMatcher.matchesUrl(b.urlPattern, url))
    };
  }

  // ---------- Rendering Lists ----------
  function renderAllViews() {
    const matching = getMatchingItemsForCurrentUrl();
    const currentTotal = matching.workflows.length + matching.buttons.length;
    const allTotal = state.data.workflows.length + state.data.buttons.length;

    els.currentCountPill.textContent = String(currentTotal);
    els.allCountPill.textContent = String(allTotal);

    renderCurrentView(matching);
    renderAllSitesView();
    updateEditorMatchChip();
  }

  function summarizeSteps(steps) {
    if (!Array.isArray(steps) || steps.length === 0) return '0 steps';
    if (steps.length === 1) return '1 step';
    return `${steps.length} steps`;
  }

  function createButtonCard(btn, showRunOnPage = true) {
    const card = document.createElement('article');
    card.className = `item-card${btn.enabled ? '' : ' disabled'}`;

    const top = document.createElement('div');
    top.className = 'card-top';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'card-title-wrap';

    const title = document.createElement('h3');
    title.className = 'card-title';

    const dot = document.createElement('span');
    dot.className = 'color-dot';
    dot.style.background = BUTTON_THEME_HEX[btn.color] || BUTTON_THEME_HEX.blue;

    const text = document.createElement('span');
    text.textContent = btn.label || 'Quick Action';
    title.append(dot, text);

    const pattern = document.createElement('p');
    pattern.className = 'card-pattern';
    pattern.textContent = btn.urlPattern;

    titleWrap.append(title, pattern);

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'inline-check';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = btn.enabled;
    toggle.setAttribute('aria-label', `Enable button ${btn.label}`);
    toggle.addEventListener('change', async () => {
      await HandyStorage.saveButton({ ...btn, enabled: toggle.checked });
      await loadData();
    });
    toggleLabel.append(toggle);
    top.append(titleWrap, toggleLabel);

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const placeText = document.createElement('span');
    const placementDesc =
      btn.placementMode === 'floating'
        ? `Floating (${btn.floatingCorner})`
        : `${btn.anchorPosition} ${btn.anchorLabel || btn.anchorSelector || 'element'}`;
    const actionDesc =
      btn.actionMode === 'workflow'
        ? 'Runs workflow'
        : summarizeSteps(btn.steps);
    placeText.textContent = `${placementDesc} • ${actionDesc}`;

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    if (showRunOnPage) {
      const runBtn = document.createElement('button');
      runBtn.type = 'button';
      runBtn.className = 'btn btn-xs btn-secondary';
      runBtn.textContent = '▶ Run';
      runBtn.addEventListener('click', () => runButtonConfig(btn));
      actions.appendChild(runBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-xs btn-ghost';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditor('button', btn));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-xs btn-ghost';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      const ok = await askConfirm('Delete Page Button', `Delete "${btn.label}"?`);
      if (!ok) return;
      await HandyStorage.deleteButton(btn.id);
      showToast('Page button deleted.');
      await loadData();
    });

    actions.append(editBtn, delBtn);
    meta.append(placeText, actions);
    card.append(top, meta);
    return card;
  }

  function createWorkflowCard(wf, showRunOnPage = true) {
    const card = document.createElement('article');
    card.className = `item-card${wf.enabled ? '' : ' disabled'}`;

    const top = document.createElement('div');
    top.className = 'card-top';

    const titleWrap = document.createElement('div');
    titleWrap.className = 'card-title-wrap';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = wf.name || 'Untitled Workflow';

    const pattern = document.createElement('p');
    pattern.className = 'card-pattern';
    pattern.textContent = wf.urlPattern;

    titleWrap.append(title, pattern);

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'inline-check';
    const toggle = document.createElement('input');
    toggle.type = 'checkbox';
    toggle.checked = wf.enabled;
    toggle.setAttribute('aria-label', `Enable workflow ${wf.name}`);
    toggle.addEventListener('change', async () => {
      await HandyStorage.saveWorkflow({ ...wf, enabled: toggle.checked });
      await loadData();
    });
    toggleLabel.append(toggle);
    top.append(titleWrap, toggleLabel);

    const meta = document.createElement('div');
    meta.className = 'card-meta';

    const infoSpan = document.createElement('span');
    const stepSummary = summarizeSteps(wf.steps);
    if (wf.autoRunOnLoad) {
      const delayMs = Math.max(0, Number(wf.autoRunDelayMs) || 0);
      const delayLabel = delayMs >= 1000 && delayMs % 1000 === 0 ? `${delayMs / 1000}s` : `${delayMs}ms`;
      infoSpan.textContent = `${stepSummary} • Auto-run (${delayLabel})`;
    } else {
      infoSpan.textContent = stepSummary;
    }

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    if (showRunOnPage) {
      const runBtn = document.createElement('button');
      runBtn.type = 'button';
      runBtn.className = 'btn btn-xs btn-primary';
      runBtn.textContent = '▶ Run';
      runBtn.addEventListener('click', () => runStepsOnActiveTab(wf.steps, wf.name, wf.id));
      actions.appendChild(runBtn);
    }

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-xs btn-ghost';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditor('workflow', wf));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-xs btn-ghost';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', async () => {
      const ok = await askConfirm('Delete Workflow', `Delete "${wf.name}"?`);
      if (!ok) return;
      await HandyStorage.deleteWorkflow(wf.id);
      showToast('Workflow deleted.');
      await loadData();
    });

    actions.append(editBtn, delBtn);
    meta.append(infoSpan, actions);
    card.append(top, meta);
    return card;
  }

  function renderCurrentView(matching) {
    els.currentButtonsSub.textContent = `(${matching.buttons.length})`;
    els.currentWorkflowsSub.textContent = `(${matching.workflows.length})`;

    els.currentButtonsList.replaceChildren();
    if (matching.buttons.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-card';
      empty.textContent =
        'No page buttons match this URL yet. Click "+ Add Page Button" to place one on this page.';
      els.currentButtonsList.appendChild(empty);
    } else {
      matching.buttons.forEach((btn) =>
        els.currentButtonsList.appendChild(createButtonCard(btn, true))
      );
    }

    els.currentWorkflowsList.replaceChildren();
    if (matching.workflows.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-card';
      empty.textContent =
        'No workflows match this URL yet. Click "+ New Workflow" to pick elements and build steps.';
      els.currentWorkflowsList.appendChild(empty);
    } else {
      matching.workflows.forEach((wf) =>
        els.currentWorkflowsList.appendChild(createWorkflowCard(wf, true))
      );
    }
  }

  function renderAllSitesView() {
    const query = (els.allSearchInput.value || '').trim().toLowerCase();
    const groups = new Map();
    const activeUrl = state.activeTab?.url || '';

    const addToGroup = (kind, item) => {
      const title = kind === 'button' ? item.label : item.name;
      const haystack = `${title} ${item.urlPattern}`.toLowerCase();
      if (query && !haystack.includes(query)) return;

      const groupKey = HandyUrlMatcher.getSiteGroupLabel(item.urlPattern);
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push({ kind, item });
    };

    state.data.buttons.forEach((b) => addToGroup('button', b));
    state.data.workflows.forEach((w) => addToGroup('workflow', w));

    els.allSitesList.replaceChildren();
    if (groups.size === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-card';
      empty.textContent = query
        ? 'No saved workflows or buttons match your filter.'
        : 'No saved workflows or page buttons yet.';
      els.allSitesList.appendChild(empty);
      return;
    }

    for (const [groupName, entries] of groups.entries()) {
      const box = document.createElement('section');
      box.className = 'site-group';

      const header = document.createElement('div');
      header.className = 'site-group-header';

      const h3 = document.createElement('h3');
      h3.className = 'site-group-title';
      h3.textContent = groupName;

      const count = document.createElement('span');
      count.className = 'count-pill';
      count.textContent = String(entries.length);

      header.append(h3, count);

      const list = document.createElement('div');
      list.className = 'card-list';

      for (const { kind, item } of entries) {
        const matchesActive =
          HandyUrlMatcher.isSupportedWebUrl(activeUrl) &&
          HandyUrlMatcher.matchesUrl(item.urlPattern, activeUrl);
        list.appendChild(
          kind === 'button'
            ? createButtonCard(item, matchesActive)
            : createWorkflowCard(item, matchesActive)
        );
      }

      box.append(header, list);
      els.allSitesList.appendChild(box);
    }
  }

  // ---------- View Switching ----------
  function switchMainTab(tabName) {
    state.currentTabView = tabName;
    state.editorKind = null;
    state.draft = null;

    els.viewEditor.hidden = true;
    els.viewCurrent.hidden = tabName !== 'current';
    els.viewAll.hidden = tabName !== 'all';
    els.mainTabs.hidden = false;

    for (const btn of els.mainTabs.querySelectorAll('.tab-btn')) {
      const active = btn.dataset.tab === tabName;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    }
  }

  // ---------- Editor Logic ----------
  function getDefaultPatternForNewItem() {
    const url = state.activeTab?.url || '';
    const presets = HandyUrlMatcher.buildPresets(url);
    return presets.domain || '*://*/*';
  }

  function openEditor(kind, existing = null) {
    state.previousView = state.currentTabView;
    state.editorKind = kind;
    state.stepStates = {};

    if (kind === 'workflow') {
      state.draft = existing
        ? structuredClone(HandyStorage.normalizeWorkflow(existing))
        : HandyStorage.normalizeWorkflow({
            name: '',
            urlPattern: getDefaultPatternForNewItem(),
            enabled: true,
            steps: []
          });
    } else {
      state.draft = existing
        ? structuredClone(HandyStorage.normalizeButton(existing))
        : HandyStorage.normalizeButton({
            label: '',
            color: 'blue',
            urlPattern: getDefaultPatternForNewItem(),
            enabled: true,
            placementMode: 'anchor',
            anchorSelector: '',
            anchorLabel: '',
            anchorPosition: 'after',
            floatingCorner: 'bottom-right',
            actionMode: 'steps',
            workflowId: '',
            steps: []
          });
    }

    els.mainTabs.hidden = true;
    els.viewCurrent.hidden = true;
    els.viewAll.hidden = true;
    els.viewEditor.hidden = false;

    populateEditorForm();
  }

  function populateEditorForm() {
    const isButton = state.editorKind === 'button';
    const d = state.draft;

    els.editorTitle.textContent = isButton
      ? d.id && state.data.buttons.some((b) => b.id === d.id)
        ? 'Edit Page Button'
        : 'New Page Button'
      : d.id && state.data.workflows.some((w) => w.id === d.id)
        ? 'Edit Workflow'
        : 'New Workflow';

    els.edNameLabel.textContent = isButton ? 'Button Text' : 'Workflow Name';
    els.edName.placeholder = isButton
      ? 'e.g. Auto-Fill Form'
      : 'e.g. Login & Submit';
    els.edName.value = isButton ? d.label : d.name;

    els.edUrlPattern.value = d.urlPattern;
    els.edEnabled.checked = d.enabled !== false;

    els.edWorkflowAutorun.hidden = isButton;
    els.edButtonAppearance.hidden = !isButton;
    els.edButtonPlacement.hidden = !isButton;
    els.edButtonActionMode.hidden = !isButton;

    if (isButton) {
      updateButtonPreview();
      syncButtonSwatches();
      syncPlacementUI();
      syncActionModeUI();
      populateLinkedWorkflowSelect();
      els.edSaveBtn.textContent = 'Save Page Button';
    } else {
      els.edAutorunEnabled.checked = Boolean(d.autoRunOnLoad);
      els.edAutorunDelay.value = String(d.autoRunDelayMs ?? 1000);
      els.edAutorunDelayWrap.hidden = !els.edAutorunEnabled.checked;
      els.edStepsSection.hidden = false;
      els.edSaveBtn.textContent = 'Save Workflow';
    }

    updateEditorMatchChip();
    renderDraftSteps();
  }

  function updateEditorMatchChip() {
    if (!state.draft) return;
    const url = state.activeTab?.url || '';
    const pattern = els.edUrlPattern.value.trim();
    const matched =
      HandyUrlMatcher.isSupportedWebUrl(url) && HandyUrlMatcher.matchesUrl(pattern, url);
    els.editorMatchChip.textContent = matched ? '✓ Matches current page' : 'Other / inactive URL';
    els.editorMatchChip.classList.toggle('matched', matched);
  }

  function updateButtonPreview() {
    if (state.editorKind !== 'button' || !state.draft) return;
    els.edBtnPreview.textContent = state.draft.label.trim() || 'Quick Action';
    els.edBtnPreview.style.background =
      BUTTON_THEME_HEX[state.draft.color] || BUTTON_THEME_HEX.blue;
  }

  function syncButtonSwatches() {
    const selected = state.draft?.color || 'blue';
    for (const sw of els.edColorSwatches.querySelectorAll('.swatch')) {
      sw.setAttribute('aria-checked', sw.dataset.color === selected ? 'true' : 'false');
    }
  }

  function syncPlacementUI() {
    const mode = state.draft.placementMode;
    for (const btn of els.edPlacementMode.querySelectorAll('.seg-btn')) {
      btn.classList.toggle('active', btn.dataset.placement === mode);
    }
    els.edPlacementAnchorFields.hidden = mode !== 'anchor';
    els.edPlacementFloatingFields.hidden = mode !== 'floating';

    els.edAnchorSelector.value = state.draft.anchorSelector || '';

    for (const btn of els.edAnchorPosition.querySelectorAll('.pos-btn')) {
      btn.classList.toggle('active', btn.dataset.pos === state.draft.anchorPosition);
    }
    for (const btn of els.edFloatingCorner.querySelectorAll('.pos-btn')) {
      btn.classList.toggle('active', btn.dataset.corner === state.draft.floatingCorner);
    }
  }

  function syncActionModeUI() {
    const mode = state.draft.actionMode;
    for (const btn of els.edActionModeToggle.querySelectorAll('.seg-btn')) {
      btn.classList.toggle('active', btn.dataset.actionMode === mode);
    }
    els.edLinkedWorkflowWrap.hidden = mode !== 'workflow';
    els.edStepsSection.hidden = mode === 'workflow';
  }

  function populateLinkedWorkflowSelect() {
    els.edLinkedWorkflow.replaceChildren();
    if (state.data.workflows.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No workflows saved yet — create one first';
      els.edLinkedWorkflow.appendChild(opt);
      return;
    }

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'Select a workflow…';
    els.edLinkedWorkflow.appendChild(placeholder);

    for (const wf of state.data.workflows) {
      const opt = document.createElement('option');
      opt.value = wf.id;
      opt.textContent = `${wf.name} (${wf.steps.length} steps)`;
      els.edLinkedWorkflow.appendChild(opt);
    }
    els.edLinkedWorkflow.value = state.draft.workflowId || '';
  }

  function renderDraftSteps() {
    const steps = state.draft?.steps || [];
    els.edStepsCount.textContent = `(${steps.length})`;
    els.edStepsList.replaceChildren();

    if (steps.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-card';
      empty.textContent =
        'No steps yet. Click "⌖ Pick Element & Add" to select something on the webpage, or "+ Wait" to add a delay.';
      els.edStepsList.appendChild(empty);
      return;
    }

    steps.forEach((step, idx) => {
      els.edStepsList.appendChild(createStepCard(step, idx, steps.length));
    });
  }

  function createStepCard(step, index, total) {
    const card = document.createElement('div');
    card.className = 'step-card';
    card.dataset.stepId = step.id;
    const runState = state.stepStates[step.id];
    if (runState === 'running') card.classList.add('is-running');
    else if (runState === 'done') card.classList.add('is-done');
    else if (runState === 'error') card.classList.add('is-error');

    // Header row
    const head = document.createElement('div');
    head.className = 'step-head';

    const num = document.createElement('span');
    num.className = 'step-num';
    num.textContent = String(index + 1);

    const typeSelect = document.createElement('select');
    typeSelect.className = 'step-type-select';
    typeSelect.setAttribute('aria-label', `Step ${index + 1} action type`);
    for (const t of STEP_TYPES) {
      const opt = document.createElement('option');
      opt.value = t.value;
      opt.textContent = t.label;
      typeSelect.appendChild(opt);
    }
    typeSelect.value = step.type;
    typeSelect.addEventListener('change', () => {
      step.type = typeSelect.value;
      renderDraftSteps();
    });

    const tools = document.createElement('div');
    tools.className = 'step-tools';

    const makeToolBtn = (label, title, onClick, disabled = false) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'icon-btn';
      b.textContent = label;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.disabled = disabled;
      b.addEventListener('click', onClick);
      return b;
    };

    tools.append(
      makeToolBtn('▶', 'Test this step', () => runStepsOnActiveTab([step], `Step ${index + 1}`)),
      makeToolBtn(
        '↑',
        'Move step up',
        () => {
          const arr = state.draft.steps;
          [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
          renderDraftSteps();
        },
        index === 0
      ),
      makeToolBtn(
        '↓',
        'Move step down',
        () => {
          const arr = state.draft.steps;
          [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
          renderDraftSteps();
        },
        index === total - 1
      ),
      makeToolBtn('✕', 'Delete step', () => {
        state.draft.steps.splice(index, 1);
        renderDraftSteps();
      })
    );

    head.append(num, typeSelect, tools);
    card.appendChild(head);

    const body = document.createElement('div');
    body.className = 'step-body';

    // Target selector row (everything except wait and runWorkflow)
    if (step.type !== 'wait' && step.type !== 'runWorkflow') {
      if (step.elementLabel) {
        const hint = document.createElement('div');
        hint.className = 'step-el-hint';
        hint.textContent = `Element: ${step.elementLabel}`;
        hint.title = step.elementLabel;
        body.appendChild(hint);
      }

      const selRow = document.createElement('div');
      selRow.className = 'selector-row';

      const selInput = document.createElement('input');
      selInput.type = 'text';
      selInput.value = step.selector || '';
      selInput.placeholder =
        step.type === 'keypress'
          ? 'Optional selector (or active element)'
          : 'Pick element or enter CSS selector';
      selInput.autocapitalize = 'none';
      selInput.spellcheck = false;
      selInput.setAttribute('aria-label', `Step ${index + 1} CSS selector`);
      selInput.addEventListener('input', () => {
        step.selector = selInput.value;
      });

      const pickBtn = document.createElement('button');
      pickBtn.type = 'button';
      pickBtn.className = 'btn btn-xs btn-primary';
      pickBtn.textContent = '⌖ Pick';
      pickBtn.addEventListener('click', () =>
        startPicking({ kind: 'step', stepId: step.id })
      );

      const locateBtn = document.createElement('button');
      locateBtn.type = 'button';
      locateBtn.className = 'btn btn-xs btn-ghost';
      locateBtn.textContent = '◎';
      locateBtn.title = 'Highlight element on webpage';
      locateBtn.addEventListener('click', async () => {
        const res = await sendToActiveTab({
          type: 'HIGHLIGHT_SELECTOR',
          selector: step.selector
        });
        if (res && !res.ok) showToast(res.error || 'Element not found', 'error');
      });

      selRow.append(selInput, pickBtn, locateBtn);
      body.appendChild(selRow);
    }

    // Type-specific fields
    if (step.type === 'runWorkflow') {
      const wfSelect = document.createElement('select');
      wfSelect.setAttribute('aria-label', `Step ${index + 1} workflow to run`);

      const currentEditingId = state.editorKind === 'workflow' ? state.draft?.id : null;
      const availableWfs = state.data.workflows.filter((w) => w.id !== currentEditingId);

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent =
        availableWfs.length === 0
          ? 'No other saved workflows yet…'
          : 'Choose a saved workflow…';
      wfSelect.appendChild(placeholder);

      for (const wf of availableWfs) {
        const opt = document.createElement('option');
        opt.value = wf.id;
        opt.textContent = `${wf.name} (${wf.steps.length} steps)`;
        wfSelect.appendChild(opt);
      }
      wfSelect.value = step.workflowId || '';

      const wfHint = document.createElement('div');
      wfHint.className = 'step-el-hint';
      const updateWfHint = () => {
        const chosen = availableWfs.find((w) => w.id === step.workflowId);
        wfHint.textContent = chosen
          ? `Runs "${chosen.name}" (${chosen.urlPattern})`
          : 'Select any saved workflow to reuse its steps here.';
      };
      updateWfHint();

      wfSelect.addEventListener('change', () => {
        step.workflowId = wfSelect.value;
        updateWfHint();
      });

      body.append(wfSelect, wfHint);
    } else if (step.type === 'fill' || step.type === 'select') {
      const valInput = document.createElement('input');
      valInput.type = 'text';
      valInput.value = step.value || '';
      valInput.placeholder =
        step.type === 'select'
          ? 'Option value or visible text…'
          : 'Text or value to fill…';
      valInput.setAttribute('aria-label', `Step ${index + 1} value`);
      valInput.addEventListener('input', () => {
        step.value = valInput.value;
      });
      body.appendChild(valInput);
    } else if (step.type === 'type') {
      const valInput = document.createElement('input');
      valInput.type = 'text';
      valInput.value = step.value || '';
      valInput.placeholder = 'Text to type sequentially…';
      valInput.setAttribute('aria-label', `Step ${index + 1} text to type`);
      valInput.addEventListener('input', () => {
        step.value = valInput.value;
      });

      const inlineRow = document.createElement('div');
      inlineRow.className = 'step-inline-row';

      const delayWrap = document.createElement('div');
      const delayInput = document.createElement('input');
      delayInput.type = 'number';
      delayInput.min = '0';
      delayInput.step = '10';
      delayInput.value = String(step.delayMs ?? 45);
      delayInput.title = 'Delay per character in milliseconds';
      delayInput.setAttribute('aria-label', 'Typing speed milliseconds per character');
      delayInput.addEventListener('input', () => {
        step.delayMs = Math.max(0, Number(delayInput.value) || 0);
      });
      delayWrap.appendChild(delayInput);

      const clearLbl = document.createElement('label');
      clearLbl.className = 'inline-check';
      const clearCb = document.createElement('input');
      clearCb.type = 'checkbox';
      clearCb.checked = step.clearFirst !== false;
      clearCb.addEventListener('change', () => {
        step.clearFirst = clearCb.checked;
      });
      const clearTxt = document.createElement('span');
      clearTxt.textContent = 'Clear first (ms/char)';
      clearLbl.append(clearCb, clearTxt);

      inlineRow.append(delayWrap, clearLbl);
      body.append(valInput, inlineRow);
    } else if (step.type === 'wait') {
      const waitInput = document.createElement('input');
      waitInput.type = 'number';
      waitInput.min = '0';
      waitInput.step = '100';
      waitInput.value = String(step.waitMs ?? 500);
      waitInput.setAttribute('aria-label', `Step ${index + 1} wait duration in milliseconds`);
      waitInput.addEventListener('input', () => {
        step.waitMs = Math.max(0, Number(waitInput.value) || 0);
      });

      const chips = document.createElement('div');
      chips.className = 'preset-chips';
      for (const [label, ms] of [
        ['250ms', 250],
        ['500ms', 500],
        ['1s', 1000],
        ['2s', 2000],
        ['5s', 5000]
      ]) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip-btn';
        chip.textContent = label;
        chip.addEventListener('click', () => {
          step.waitMs = ms;
          waitInput.value = String(ms);
        });
        chips.appendChild(chip);
      }
      body.append(waitInput, chips);
    } else if (step.type === 'waitFor') {
      const toInput = document.createElement('input');
      toInput.type = 'number';
      toInput.min = '100';
      toInput.step = '500';
      toInput.value = String(step.timeoutMs ?? 5000);
      toInput.title = 'Max wait timeout in milliseconds';
      toInput.setAttribute('aria-label', `Step ${index + 1} timeout in milliseconds`);
      toInput.addEventListener('input', () => {
        step.timeoutMs = Math.max(100, Number(toInput.value) || 5000);
      });
      body.appendChild(toInput);
    } else if (step.type === 'keypress') {
      const keySelect = document.createElement('select');
      for (const k of [...STANDARD_KEYS, 'Custom']) {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k === 'Custom' ? 'Custom key…' : k;
        keySelect.appendChild(opt);
      }
      const isStandard = STANDARD_KEYS.includes(step.key);
      keySelect.value = isStandard ? step.key : 'Custom';

      const customKeyInput = document.createElement('input');
      customKeyInput.type = 'text';
      customKeyInput.value = isStandard ? '' : step.key || '';
      customKeyInput.placeholder = 'Enter key name (e.g. a, /, F2)';
      customKeyInput.hidden = isStandard;

      keySelect.addEventListener('change', () => {
        if (keySelect.value === 'Custom') {
          customKeyInput.hidden = false;
          step.key = customKeyInput.value || 'a';
        } else {
          customKeyInput.hidden = true;
          step.key = keySelect.value;
        }
      });
      customKeyInput.addEventListener('input', () => {
        step.key = customKeyInput.value;
      });

      const modRow = document.createElement('div');
      modRow.className = 'mod-row';
      for (const [modKey, modLabel] of [
        ['ctrl', 'Ctrl'],
        ['shift', 'Shift'],
        ['alt', 'Alt'],
        ['meta', 'Cmd/Meta']
      ]) {
        const lbl = document.createElement('label');
        lbl.className = 'inline-check';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = Boolean(step.modifiers?.[modKey]);
        cb.addEventListener('change', () => {
          step.modifiers = step.modifiers || {};
          step.modifiers[modKey] = cb.checked;
        });
        const sp = document.createElement('span');
        sp.textContent = modLabel;
        lbl.append(cb, sp);
        modRow.appendChild(lbl);
      }
      body.append(keySelect, customKeyInput, modRow);
    }

    // Before / After delay timing controls (available on every step)
    const timingDetails = document.createElement('details');
    timingDetails.className = 'step-timing';
    const hasTiming =
      (Number(step.beforeDelayMs) || 0) > 0 || (Number(step.afterDelayMs) || 0) > 0;
    if (hasTiming || step.type === 'runWorkflow') {
      timingDetails.open = true;
    }

    const timingSummary = document.createElement('summary');
    const formatTimingSummary = () => {
      const b = Math.max(0, Number(step.beforeDelayMs) || 0);
      const a = Math.max(0, Number(step.afterDelayMs) || 0);
      if (b === 0 && a === 0) return 'Before / After delay (0ms)';
      const parts = [];
      if (b > 0) parts.push(`Before ${b}ms`);
      if (a > 0) parts.push(`After ${a}ms`);
      return `Timing: ${parts.join(' • ')}`;
    };
    timingSummary.textContent = formatTimingSummary();

    const timingGrid = document.createElement('div');
    timingGrid.className = 'step-timing-grid';

    const makeTimingField = (labelText, fieldKey) => {
      const wrap = document.createElement('div');
      wrap.className = 'timing-field';
      const lbl = document.createElement('label');
      lbl.textContent = labelText;
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.min = '0';
      inp.step = '100';
      inp.value = String(step[fieldKey] ?? 0);
      inp.setAttribute('aria-label', `Step ${index + 1} ${labelText}`);
      inp.addEventListener('input', () => {
        step[fieldKey] = Math.max(0, Number(inp.value) || 0);
        timingSummary.textContent = formatTimingSummary();
      });
      wrap.append(lbl, inp);
      return wrap;
    };

    timingGrid.append(
      makeTimingField('Before delay (ms)', 'beforeDelayMs'),
      makeTimingField('After delay (ms)', 'afterDelayMs')
    );
    timingDetails.append(timingSummary, timingGrid);
    body.appendChild(timingDetails);

    if (body.childNodes.length > 0) {
      card.appendChild(body);
    }
    return card;
  }

  // ---------- Element Picking ----------
  async function startPicking(targetContext) {
    state.pickingContext = targetContext;
    els.pickerBannerMsg.textContent =
      targetContext?.kind === 'button-anchor'
        ? 'Click an element on the webpage to place the button near it… (Esc to cancel)'
        : 'Click any element on the webpage to select it… (Esc to cancel)';
    els.pickerBanner.hidden = false;

    const res = await sendToActiveTab({
      type: 'START_PICKER',
      targetContext
    });
    if (!res?.ok) {
      els.pickerBanner.hidden = true;
      state.pickingContext = null;
    }
  }

  async function cancelPicking() {
    els.pickerBanner.hidden = true;
    state.pickingContext = null;
    await sendToActiveTab({ type: 'STOP_PICKER' });
  }

  function applyPickedElement(targetContext, elementInfo) {
    els.pickerBanner.hidden = true;
    state.pickingContext = null;
    if (!state.draft || !elementInfo) return;

    if (targetContext?.kind === 'button-anchor' && state.editorKind === 'button') {
      state.draft.anchorSelector = elementInfo.selector;
      state.draft.anchorLabel = elementInfo.elementLabel;
      els.edAnchorSelector.value = elementInfo.selector;
      showToast(`Button location set: ${elementInfo.elementLabel}`, 'success');
      return;
    }

    if (targetContext?.kind === 'new-step') {
      const newStep = HandyStorage.normalizeStep({
        type: elementInfo.suggestedAction || 'click',
        selector: elementInfo.selector,
        elementLabel: elementInfo.elementLabel
      });
      state.draft.steps.push(newStep);
      renderDraftSteps();
      showToast(`Added ${newStep.type} step for ${elementInfo.elementLabel}`, 'success');
      return;
    }

    if (targetContext?.kind === 'step' && targetContext.stepId) {
      const step = state.draft.steps.find((s) => s.id === targetContext.stepId);
      if (step) {
        step.selector = elementInfo.selector;
        step.elementLabel = elementInfo.elementLabel;
        renderDraftSteps();
        showToast(`Updated target: ${elementInfo.elementLabel}`, 'success');
      }
    }
  }

  // ---------- Running Workflows & Buttons ----------
  async function runStepsOnActiveTab(steps, label = 'Workflow', rootWorkflowId = null) {
    if (!Array.isArray(steps) || steps.length === 0) {
      showToast('Add at least one step before running.', 'error');
      return;
    }
    const runId = `sp_${Date.now()}`;
    state.activeRunId = runId;
    state.stepStates = {};
    if (state.editorKind) {
      els.edRunBtn.hidden = true;
      els.edStopBtn.hidden = false;
      renderDraftSteps();
    }

    const res = await sendToActiveTab({
      type: 'RUN_STEPS',
      runId,
      steps,
      label,
      rootWorkflowId
    });

    if (state.activeRunId === runId) {
      state.activeRunId = null;
      if (state.editorKind) {
        els.edRunBtn.hidden = false;
        els.edStopBtn.hidden = true;
      }
    }

    if (res?.ok) {
      showToast(`${label} finished!`, 'success');
    } else if (res && !res.cancelled) {
      showToast(res.error || 'Execution failed.', 'error');
    } else if (res?.cancelled) {
      showToast('Execution stopped.', 'info');
    }
  }

  async function runButtonConfig(btn) {
    if (btn.actionMode === 'workflow') {
      const wf = state.data.workflows.find((w) => w.id === btn.workflowId);
      if (!wf) {
        showToast('Linked workflow not found.', 'error');
        return;
      }
      await runStepsOnActiveTab(wf.steps, btn.label, wf.id);
    } else {
      await runStepsOnActiveTab(btn.steps, btn.label);
    }
  }

  // ---------- Save Draft ----------
  async function saveCurrentDraft(e) {
    e.preventDefault();
    if (!state.draft) return;

    const pattern = els.edUrlPattern.value.trim();
    if (!pattern) {
      showToast('Please enter a URL pattern (or pick a preset).', 'error');
      els.edUrlPattern.focus();
      return;
    }

    const titleVal = els.edName.value.trim();
    if (!titleVal) {
      showToast(
        state.editorKind === 'button'
          ? 'Please enter a button label.'
          : 'Please enter a workflow name.',
        'error'
      );
      els.edName.focus();
      return;
    }

    state.draft.urlPattern = pattern;
    state.draft.enabled = els.edEnabled.checked;

    if (state.editorKind === 'workflow') {
      state.draft.name = titleVal;
      state.draft.autoRunOnLoad = els.edAutorunEnabled.checked;
      state.draft.autoRunDelayMs = Math.max(0, Number(els.edAutorunDelay.value) || 0);
      await HandyStorage.saveWorkflow(state.draft);
      showToast('Workflow saved!', 'success');
    } else {
      state.draft.label = titleVal;
      if (
        state.draft.placementMode === 'anchor' &&
        !state.draft.anchorSelector.trim()
      ) {
        showToast('Pick a target element on the webpage or switch to Floating Corner.', 'error');
        return;
      }
      if (state.draft.actionMode === 'workflow' && !state.draft.workflowId) {
        showToast('Choose a workflow to run when the button is clicked.', 'error');
        return;
      }
      await HandyStorage.saveButton(state.draft);
      showToast('Page button saved!', 'success');
      await sendToActiveTab({ type: 'SYNC_BUTTONS' });
    }

    await loadData();
    switchMainTab(state.previousView);
  }

  // ---------- Backup (Export / Import) ----------
  async function openBackupDialog() {
    const fresh = await HandyStorage.getAllData();
    els.backupJsonText.value = JSON.stringify(fresh, null, 2);
    els.backupDialog.returnValue = '';
    els.backupDialog.showModal();
  }

  function parseBackupJson(rawText) {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid JSON structure');
    }
    const workflows = Array.isArray(parsed.workflows)
      ? parsed.workflows.map(HandyStorage.normalizeWorkflow)
      : [];
    const buttons = Array.isArray(parsed.buttons)
      ? parsed.buttons.map(HandyStorage.normalizeButton)
      : [];
    return { version: 1, workflows, buttons };
  }

  // ---------- Event Wiring ----------
  els.mainTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (btn) switchMainTab(btn.dataset.tab);
  });

  els.allSearchInput.addEventListener('input', () => renderAllSitesView());

  els.newWorkflowBtn.addEventListener('click', () => openEditor('workflow'));
  els.newButtonBtn.addEventListener('click', () => openEditor('button'));
  els.allNewWorkflowBtn.addEventListener('click', () => openEditor('workflow'));
  els.allNewButtonBtn.addEventListener('click', () => openEditor('button'));

  els.editorBackBtn.addEventListener('click', () => switchMainTab(state.previousView));
  els.editorForm.addEventListener('submit', saveCurrentDraft);

  els.edName.addEventListener('input', () => {
    if (!state.draft) return;
    if (state.editorKind === 'button') {
      state.draft.label = els.edName.value;
      updateButtonPreview();
    } else {
      state.draft.name = els.edName.value;
    }
  });

  els.edUrlPattern.addEventListener('input', () => {
    if (!state.draft) return;
    state.draft.urlPattern = els.edUrlPattern.value;
    updateEditorMatchChip();
  });

  els.edUrlPresets.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-btn');
    if (!chip || !state.draft) return;
    const presetKey = chip.dataset.preset;
    if (presetKey === 'any') {
      els.edUrlPattern.value = '*://*/*';
    } else {
      const presets = HandyUrlMatcher.buildPresets(state.activeTab?.url || '');
      if (presets[presetKey]) {
        els.edUrlPattern.value = presets[presetKey];
      } else {
        showToast('Open an http/https webpage to generate URL presets.', 'error');
        return;
      }
    }
    state.draft.urlPattern = els.edUrlPattern.value;
    updateEditorMatchChip();
  });

  els.edAutorunEnabled.addEventListener('change', () => {
    if (!state.draft) return;
    state.draft.autoRunOnLoad = els.edAutorunEnabled.checked;
    els.edAutorunDelayWrap.hidden = !els.edAutorunEnabled.checked;
  });

  els.edAutorunDelay.addEventListener('input', () => {
    if (!state.draft) return;
    state.draft.autoRunDelayMs = Math.max(0, Number(els.edAutorunDelay.value) || 0);
  });

  els.edAutorunPresets.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip-btn');
    if (!chip || !state.draft) return;
    const ms = Math.max(0, Number(chip.dataset.delay) || 0);
    els.edAutorunDelay.value = String(ms);
    state.draft.autoRunDelayMs = ms;
  });

  els.edColorSwatches.addEventListener('click', (e) => {
    const sw = e.target.closest('.swatch');
    if (!sw || !state.draft) return;
    state.draft.color = sw.dataset.color;
    syncButtonSwatches();
    updateButtonPreview();
  });

  els.edPlacementMode.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn || !state.draft) return;
    state.draft.placementMode = btn.dataset.placement;
    syncPlacementUI();
  });

  els.edAnchorSelector.addEventListener('input', () => {
    if (!state.draft) return;
    state.draft.anchorSelector = els.edAnchorSelector.value;
  });

  els.edPickAnchorBtn.addEventListener('click', () =>
    startPicking({ kind: 'button-anchor' })
  );

  els.edLocateAnchorBtn.addEventListener('click', async () => {
    const res = await sendToActiveTab({
      type: 'HIGHLIGHT_SELECTOR',
      selector: els.edAnchorSelector.value.trim()
    });
    if (res && !res.ok) showToast(res.error || 'Element not found', 'error');
  });

  els.edAnchorPosition.addEventListener('click', (e) => {
    const btn = e.target.closest('.pos-btn');
    if (!btn || !state.draft) return;
    state.draft.anchorPosition = btn.dataset.pos;
    syncPlacementUI();
  });

  els.edFloatingCorner.addEventListener('click', (e) => {
    const btn = e.target.closest('.pos-btn');
    if (!btn || !state.draft) return;
    state.draft.floatingCorner = btn.dataset.corner;
    syncPlacementUI();
  });

  els.edActionModeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg-btn');
    if (!btn || !state.draft) return;
    state.draft.actionMode = btn.dataset.actionMode;
    syncActionModeUI();
  });

  els.edLinkedWorkflow.addEventListener('change', () => {
    if (!state.draft) return;
    state.draft.workflowId = els.edLinkedWorkflow.value;
  });

  els.edPickAddStepBtn.addEventListener('click', () =>
    startPicking({ kind: 'new-step' })
  );

  els.edAddWorkflowStepBtn.addEventListener('click', () => {
    if (!state.draft) return;
    state.draft.steps.push(HandyStorage.normalizeStep({ type: 'runWorkflow' }));
    renderDraftSteps();
  });

  els.edAddWaitBtn.addEventListener('click', () => {
    if (!state.draft) return;
    state.draft.steps.push(HandyStorage.normalizeStep({ type: 'wait', waitMs: 500 }));
    renderDraftSteps();
  });

  els.edAddEmptyStepBtn.addEventListener('click', () => {
    if (!state.draft) return;
    state.draft.steps.push(HandyStorage.normalizeStep({ type: 'click' }));
    renderDraftSteps();
  });

  els.edRunBtn.addEventListener('click', async () => {
    if (!state.draft) return;
    if (state.editorKind === 'button' && state.draft.actionMode === 'workflow') {
      const wf = state.data.workflows.find((w) => w.id === state.draft.workflowId);
      if (!wf) {
        showToast('Select a workflow to test.', 'error');
        return;
      }
      await runStepsOnActiveTab(wf.steps, state.draft.label || 'Button', wf.id);
      return;
    }
    await runStepsOnActiveTab(
      state.draft.steps,
      els.edName.value.trim() || 'Draft',
      state.editorKind === 'workflow' ? state.draft.id : null
    );
  });

  els.edStopBtn.addEventListener('click', async () => {
    await sendToActiveTab({ type: 'STOP_RUN' });
  });

  els.cancelPickerBtn.addEventListener('click', cancelPicking);

  els.openBackupBtn.addEventListener('click', openBackupDialog);
  els.exportJsonBtn.addEventListener('click', async () => {
    const fresh = await HandyStorage.getAllData();
    const text = JSON.stringify(fresh, null, 2);
    els.backupJsonText.value = text;
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `handy-actions-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Backup downloaded.', 'success');
  });

  els.importJsonFile.addEventListener('change', async () => {
    const file = els.importJsonFile.files?.[0];
    if (!file) return;
    els.backupJsonText.value = await file.text();
    els.importJsonFile.value = '';
  });

  els.importMergeBtn.addEventListener('click', async () => {
    try {
      const incoming = parseBackupJson(els.backupJsonText.value);
      const current = await HandyStorage.getAllData();
      const wfMap = new Map(current.workflows.map((w) => [w.id, w]));
      incoming.workflows.forEach((w) => wfMap.set(w.id, w));
      const btnMap = new Map(current.buttons.map((b) => [b.id, b]));
      incoming.buttons.forEach((b) => btnMap.set(b.id, b));
      await HandyStorage.saveAllData({
        version: 1,
        workflows: Array.from(wfMap.values()),
        buttons: Array.from(btnMap.values())
      });
      els.backupDialog.close();
      await loadData();
      showToast('Rules merged!', 'success');
    } catch (err) {
      showToast(`Invalid JSON: ${err.message}`, 'error');
    }
  });

  els.importReplaceBtn.addEventListener('click', async () => {
    try {
      const incoming = parseBackupJson(els.backupJsonText.value);
      await HandyStorage.saveAllData(incoming);
      els.backupDialog.close();
      await loadData();
      showToast('All rules replaced from backup!', 'success');
    } catch (err) {
      showToast(`Invalid JSON: ${err.message}`, 'error');
    }
  });

  // ---------- Chrome Listeners ----------
  chrome.runtime.onMessage.addListener((message) => {
    if (!message || !message.type) return;

    if (message.type === 'ELEMENT_PICKED') {
      applyPickedElement(message.targetContext, message.elementInfo);
    } else if (message.type === 'PICKER_CANCELLED') {
      els.pickerBanner.hidden = true;
      state.pickingContext = null;
    } else if (message.type === 'RUN_PROGRESS' && message.runId === state.activeRunId) {
      if (message.status === 'running' && message.stepId) {
        state.stepStates[message.stepId] = 'running';
        renderDraftSteps();
      } else if (message.status === 'step-done' && message.stepId) {
        state.stepStates[message.stepId] = 'done';
        renderDraftSteps();
      } else if (message.status === 'error') {
        for (const [k, v] of Object.entries(state.stepStates)) {
          if (v === 'running') state.stepStates[k] = 'error';
        }
        renderDraftSteps();
      }
    }
  });

  chrome.tabs.onActivated.addListener(() => {
    refreshActiveTab();
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (state.activeTab && tabId === state.activeTab.id && (changeInfo.url || changeInfo.status === 'complete')) {
      refreshActiveTab();
    }
  });

  chrome.windows.onFocusChanged.addListener(() => {
    refreshActiveTab();
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[HandyStorage.STORAGE_KEY]) {
      loadData();
    }
  });

  // ---------- Init ----------
  (async () => {
    await loadData();
    await refreshActiveTab();
  })();
})();
