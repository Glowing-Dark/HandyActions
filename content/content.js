(function initHandyContent() {
  if (globalThis.__handyContentInitialized) return;
  globalThis.__handyContentInitialized = true;

  const HANDY_ATTR = 'data-handy-ui';
  const STATE = {
    picking: false,
    pickerContext: null,
    pickerHost: null,
    pickerBox: null,
    pickerLabel: null,
    lastHovered: null,
    activeRunId: null,
    cancelledRunId: null,
    lastUrl: location.href,
    syncTimer: null,
    toastHost: null,
    autoRunTimers: new Map(),
    autoRunCompletedKeys: new Set()
  };

  const BUTTON_COLORS = {
    blue: { bg: '#2563eb', hover: '#1d4ed8', text: '#ffffff', border: '#1d4ed8' },
    emerald: { bg: '#059669', hover: '#047857', text: '#ffffff', border: '#047857' },
    violet: { bg: '#7c3aed', hover: '#6d28d9', text: '#ffffff', border: '#6d28d9' },
    amber: { bg: '#d97706', hover: '#b45309', text: '#ffffff', border: '#b45309' },
    rose: { bg: '#e11d48', hover: '#be123c', text: '#ffffff', border: '#be123c' },
    slate: { bg: '#1e293b', hover: '#0f172a', text: '#ffffff', border: '#0f172a' }
  };

  function isHandyElement(node) {
    if (!node || !(node instanceof Element)) return false;
    return Boolean(node.closest(`[${HANDY_ATTR}]`));
  }

  function isUniqueSelector(selector) {
    if (!selector) return false;
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch {
      return false;
    }
  }

  function escapeAttrValue(val) {
    return String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function looksDynamicToken(str) {
    if (!str) return true;
    // Heuristic for random CSS-in-JS or framework generated IDs/classes
    if (/^[a-zA-Z]{1,3}-[a-z0-9]{5,}$/i.test(str)) return true;
    if (/[0-9]{5,}/.test(str)) return true;
    if (/^:r[0-9a-z]+:$/i.test(str)) return true;
    return false;
  }

  function buildSelectorInfo(el) {
    const tag = el.tagName.toLowerCase();
    const candidates = [];

    if (el.id && !looksDynamicToken(el.id)) {
      const idSel = `#${CSS.escape(el.id)}`;
      if (isUniqueSelector(idSel)) candidates.push(idSel);
    }

    const attrPriority = ['data-testid', 'data-test', 'data-cy', 'name', 'aria-label', 'placeholder'];
    for (const attr of attrPriority) {
      const val = el.getAttribute(attr);
      if (val && val.length <= 80) {
        const attrSel = `${tag}[${attr}="${escapeAttrValue(val)}"]`;
        if (isUniqueSelector(attrSel)) candidates.push(attrSel);
      }
    }

    if (el.id) {
      const idSel = `#${CSS.escape(el.id)}`;
      if (isUniqueSelector(idSel) && !candidates.includes(idSel)) {
        candidates.push(idSel);
      }
    }

    if (el.classList && el.classList.length > 0) {
      const stableClasses = Array.from(el.classList)
        .filter((c) => c && !looksDynamicToken(c) && !/^(hover|focus|active|selected|open)$/i.test(c))
        .slice(0, 3);
      if (stableClasses.length > 0) {
        const clsSel = `${tag}.${stableClasses.map((c) => CSS.escape(c)).join('.')}`;
        if (isUniqueSelector(clsSel)) candidates.push(clsSel);
      }
    }

    // Build shortest unique DOM path
    const segments = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.documentElement) {
      const curTag = current.tagName.toLowerCase();
      if (current.id && !looksDynamicToken(current.id)) {
        const anchor = `#${CSS.escape(current.id)}`;
        if (isUniqueSelector(anchor)) {
          segments.unshift(anchor);
          break;
        }
      }
      let seg = curTag;
      const parent = current.parentElement;
      if (parent) {
        const sameTagSiblings = Array.from(parent.children).filter(
          (child) => child.tagName === current.tagName && !isHandyElement(child)
        );
        if (sameTagSiblings.length > 1) {
          const index = sameTagSiblings.indexOf(current) + 1;
          seg += `:nth-of-type(${index})`;
        }
      }
      segments.unshift(seg);
      const joined = segments.join(' > ');
      if (isUniqueSelector(joined)) {
        candidates.push(joined);
        break;
      }
      current = parent;
    }

    if (candidates.length === 0) {
      candidates.push(segments.join(' > ') || tag);
    }

    const primarySelector = candidates[0];
    const inputType = (el.getAttribute('type') || '').toLowerCase();
    const rawText = (el.innerText || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    const labelHint =
      el.getAttribute('aria-label') ||
      el.getAttribute('placeholder') ||
      el.getAttribute('name') ||
      rawText ||
      (el.id ? `#${el.id}` : '');

    const elementLabel = labelHint ? `${tag} (${labelHint})` : primarySelector;

    let suggestedAction = 'click';
    if (tag === 'select') {
      suggestedAction = 'select';
    } else if (
      tag === 'textarea' ||
      el.isContentEditable ||
      (tag === 'input' && !['checkbox', 'radio', 'submit', 'button', 'reset', 'file', 'image'].includes(inputType))
    ) {
      suggestedAction = 'fill';
    }

    return {
      selector: primarySelector,
      alternatives: Array.from(new Set(candidates)).slice(0, 5),
      tagName: tag,
      inputType,
      elementLabel,
      suggestedAction,
      sampleText: rawText
    };
  }

  function sleep(ms, runId) {
    return new Promise((resolve) => {
      const start = performance.now();
      function tick() {
        if (runId && STATE.cancelledRunId === runId) {
          resolve(false);
          return;
        }
        const elapsed = performance.now() - start;
        if (elapsed >= ms) {
          resolve(true);
          return;
        }
        setTimeout(tick, Math.min(50, ms - elapsed));
      }
      setTimeout(tick, Math.min(50, ms));
    });
  }

  function findTargetElement(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  function isInViewport(el) {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  function setNativeValue(el, value) {
    const tag = el.tagName.toLowerCase();
    let proto = null;
    if (tag === 'input') proto = HTMLInputElement.prototype;
    else if (tag === 'textarea') proto = HTMLTextAreaElement.prototype;
    else if (tag === 'select') proto = HTMLSelectElement.prototype;

    const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(el, value);
    } else {
      el.value = value;
    }
  }

  function dispatchInputAndChange(el, dataChar = null) {
    try {
      el.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          cancelable: true,
          inputType: dataChar === null ? 'insertReplacementText' : 'insertText',
          data: dataChar
        })
      );
    } catch {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function dispatchMouseSequence(el, type) {
    const rect = el.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;
    const common = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX,
      clientY
    };

    if (type === 'hover') {
      el.dispatchEvent(new PointerEvent('pointerover', { ...common, pointerType: 'mouse' }));
      el.dispatchEvent(new MouseEvent('mouseover', common));
      el.dispatchEvent(new MouseEvent('mousemove', common));
      return;
    }

    if (type === 'contextmenu') {
      el.dispatchEvent(new MouseEvent('mousedown', { ...common, button: 2, buttons: 2 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...common, button: 2, buttons: 0 }));
      el.dispatchEvent(new MouseEvent('contextmenu', { ...common, button: 2 }));
      return;
    }

    if (type === 'dblclick') {
      el.dispatchEvent(new MouseEvent('mousedown', { ...common, button: 0, detail: 1 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...common, button: 0, detail: 1 }));
      el.dispatchEvent(new MouseEvent('click', { ...common, button: 0, detail: 1 }));
      el.dispatchEvent(new MouseEvent('mousedown', { ...common, button: 0, detail: 2 }));
      el.dispatchEvent(new MouseEvent('mouseup', { ...common, button: 0, detail: 2 }));
      el.dispatchEvent(new MouseEvent('click', { ...common, button: 0, detail: 2 }));
      el.dispatchEvent(new MouseEvent('dblclick', { ...common, button: 0, detail: 2 }));
      return;
    }

    // Standard click
    el.dispatchEvent(new PointerEvent('pointerdown', { ...common, pointerType: 'mouse', button: 0 }));
    el.dispatchEvent(new MouseEvent('mousedown', { ...common, button: 0, buttons: 1 }));
    if (typeof el.focus === 'function') {
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
    }
    el.dispatchEvent(new PointerEvent('pointerup', { ...common, pointerType: 'mouse', button: 0 }));
    el.dispatchEvent(new MouseEvent('mouseup', { ...common, button: 0, buttons: 0 }));
    el.click();
  }

  function applyFillValue(el, value) {
    if (typeof el.focus === 'function') el.focus();
    const tag = el.tagName.toLowerCase();
    const inputType = (el.getAttribute('type') || '').toLowerCase();

    if (tag === 'input' && (inputType === 'checkbox' || inputType === 'radio')) {
      const normalized = String(value).trim().toLowerCase();
      const targetChecked =
        normalized === '' ? !el.checked : normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
      if (el.checked !== targetChecked) {
        el.click();
      }
      return;
    }

    if (el.isContentEditable) {
      el.textContent = value;
      dispatchInputAndChange(el, value);
      return;
    }

    setNativeValue(el, value);
    dispatchInputAndChange(el, value);
  }

  async function typeSequentially(el, text, delayMs, clearFirst, runId) {
    if (typeof el.focus === 'function') el.focus();
    let current = '';

    if (clearFirst) {
      if (el.isContentEditable) {
        el.textContent = '';
      } else {
        setNativeValue(el, '');
      }
      dispatchInputAndChange(el, null);
    } else {
      current = el.isContentEditable ? el.textContent || '' : el.value || '';
    }

    const chars = Array.from(String(text || ''));
    for (const ch of chars) {
      if (runId && STATE.cancelledRunId === runId) return false;
      const keyOpts = { key: ch, bubbles: true, cancelable: true };
      el.dispatchEvent(new KeyboardEvent('keydown', keyOpts));
      el.dispatchEvent(new KeyboardEvent('keypress', keyOpts));

      current += ch;
      if (el.isContentEditable) {
        el.textContent = current;
      } else {
        setNativeValue(el, current);
      }

      try {
        el.dispatchEvent(
          new InputEvent('input', {
            bubbles: true,
            cancelable: true,
            inputType: 'insertText',
            data: ch
          })
        );
      } catch {
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      el.dispatchEvent(new KeyboardEvent('keyup', keyOpts));

      if (delayMs > 0) {
        const ok = await sleep(delayMs, runId);
        if (!ok) return false;
      }
    }

    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function applySelectOption(el, value) {
    if (el.tagName.toLowerCase() !== 'select') {
      throw new Error('Selected element is not a <select> dropdown');
    }
    const target = String(value || '');
    const options = Array.from(el.options || []);
    const match =
      options.find((opt) => opt.value === target) ||
      options.find((opt) => opt.textContent.trim() === target) ||
      options.find((opt) => opt.textContent.trim().toLowerCase() === target.toLowerCase());
    if (!match) {
      throw new Error(`Option "${target}" not found in <select>`);
    }
    setNativeValue(el, match.value);
    dispatchInputAndChange(el, null);
  }

  function dispatchKeyPress(el, step) {
    const target = el || document.activeElement || document.body;
    if (target && typeof target.focus === 'function') target.focus();
    const key = step.key || 'Enter';
    const mods = step.modifiers || {};
    const codeMap = {
      Enter: 'Enter',
      Tab: 'Tab',
      Escape: 'Escape',
      Backspace: 'Backspace',
      ' ': 'Space',
      Space: 'Space',
      ArrowUp: 'ArrowUp',
      ArrowDown: 'ArrowDown',
      ArrowLeft: 'ArrowLeft',
      ArrowRight: 'ArrowRight'
    };
    const normalizedKey = key === 'Space' ? ' ' : key;
    const init = {
      key: normalizedKey,
      code: codeMap[key] || (normalizedKey.length === 1 ? `Key${normalizedKey.toUpperCase()}` : key),
      ctrlKey: Boolean(mods.ctrl),
      shiftKey: Boolean(mods.shift),
      altKey: Boolean(mods.alt),
      metaKey: Boolean(mods.meta),
      bubbles: true,
      cancelable: true
    };
    const notCancelled = target.dispatchEvent(new KeyboardEvent('keydown', init));
    target.dispatchEvent(new KeyboardEvent('keypress', init));
    target.dispatchEvent(new KeyboardEvent('keyup', init));

    if (normalizedKey === 'Enter' && notCancelled && target.form && typeof target.form.requestSubmit === 'function') {
      const submitBtn = target.form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn) {
        submitBtn.click();
      } else {
        target.form.requestSubmit();
      }
    }
  }

  async function waitForSelector(selector, timeoutMs, runId) {
    const existing = findTargetElement(selector);
    if (existing) return existing;

    const deadline = performance.now() + timeoutMs;
    while (performance.now() < deadline) {
      if (runId && STATE.cancelledRunId === runId) return null;
      await sleep(120, runId);
      const found = findTargetElement(selector);
      if (found) return found;
    }
    throw new Error(`Timed out waiting for element: ${selector}`);
  }

  async function executeSingleStep(step, runId) {
    if (step.type === 'wait') {
      const ok = await sleep(Math.max(0, Number(step.waitMs) || 0), runId);
      if (!ok) throw new Error('Execution cancelled');
      return;
    }

    if (step.type === 'waitFor') {
      await waitForSelector(step.selector, Math.max(100, Number(step.timeoutMs) || 5000), runId);
      return;
    }

    if (step.type === 'keypress' && !step.selector) {
      dispatchKeyPress(null, step);
      return;
    }

    const el = findTargetElement(step.selector);
    if (!el) {
      throw new Error(`Element not found for selector: ${step.selector || '(empty)'}`);
    }

    if (!isInViewport(el)) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      await sleep(180, runId);
    }

    switch (step.type) {
      case 'click':
        dispatchMouseSequence(el, 'click');
        break;
      case 'dblclick':
        dispatchMouseSequence(el, 'dblclick');
        break;
      case 'contextmenu':
        dispatchMouseSequence(el, 'contextmenu');
        break;
      case 'hover':
        dispatchMouseSequence(el, 'hover');
        break;
      case 'fill':
        applyFillValue(el, step.value || '');
        break;
      case 'type': {
        const finished = await typeSequentially(
          el,
          step.value || '',
          Math.max(0, Number(step.delayMs) || 40),
          step.clearFirst !== false,
          runId
        );
        if (!finished) throw new Error('Execution cancelled');
        break;
      }
      case 'select':
        applySelectOption(el, step.value || '');
        break;
      case 'clear':
        applyFillValue(el, '');
        break;
      case 'focus':
        if (typeof el.focus === 'function') el.focus();
        break;
      case 'scroll':
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        break;
      case 'keypress':
        dispatchKeyPress(el, step);
        break;
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  function notifyRunProgress(payload) {
    try {
      chrome.runtime.sendMessage({ type: 'RUN_PROGRESS', ...payload });
    } catch {
      // Side panel may be closed
    }
  }

  async function runStepList(steps, runId, label = 'Workflow') {
    if (!Array.isArray(steps) || steps.length === 0) {
      return { ok: false, error: 'No steps to run' };
    }
    STATE.activeRunId = runId;
    STATE.cancelledRunId = null;

    try {
      for (let i = 0; i < steps.length; i++) {
        if (STATE.cancelledRunId === runId) {
          notifyRunProgress({ runId, status: 'cancelled', stepIndex: i });
          return { ok: false, cancelled: true, error: 'Stopped by user' };
        }
        const step = steps[i];
        notifyRunProgress({ runId, status: 'running', stepIndex: i, stepId: step.id });
        await executeSingleStep(step, runId);
        notifyRunProgress({ runId, status: 'step-done', stepIndex: i, stepId: step.id });
        // Tiny yield between steps so page event handlers/re-renders settle cleanly
        if (i < steps.length - 1 && step.type !== 'wait') {
          await sleep(60, runId);
        }
      }
      notifyRunProgress({ runId, status: 'completed' });
      return { ok: true };
    } catch (err) {
      const msg = err?.message || String(err);
      notifyRunProgress({ runId, status: 'error', error: msg });
      return { ok: false, error: msg };
    } finally {
      if (STATE.activeRunId === runId) {
        STATE.activeRunId = null;
      }
    }
  }

  // ---------- Shadow DOM Toast Feedback ----------
  function showPageToast(text, isError = false) {
    if (STATE.toastHost) {
      STATE.toastHost.remove();
      STATE.toastHost = null;
    }
    const host = document.createElement('div');
    host.setAttribute(HANDY_ATTR, 'toast-host');
    host.style.cssText =
      'position:fixed;bottom:18px;right:18px;z-index:2147483647;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'open' });
    const pill = document.createElement('div');
    pill.style.cssText = [
      'font-family:system-ui,-apple-system,sans-serif',
      'font-size:13px',
      'font-weight:500',
      'padding:9px 14px',
      'border-radius:10px',
      'box-shadow:0 8px 24px rgba(0,0,0,0.22)',
      'color:#ffffff',
      `background:${isError ? '#dc2626' : '#0f172a'}`,
      'border:1px solid rgba(255,255,255,0.14)',
      'max-width:320px'
    ].join(';');
    pill.textContent = text;
    shadow.appendChild(pill);
    (document.body || document.documentElement).appendChild(host);
    STATE.toastHost = host;
    setTimeout(() => {
      if (STATE.toastHost === host) {
        host.remove();
        STATE.toastHost = null;
      }
    }, 2600);
  }

  // ---------- Element Highlighter (Test Selector) ----------
  function highlightSelector(selector) {
    const el = findTargetElement(selector);
    if (!el) {
      return { ok: false, error: `No element found matching "${selector}"` };
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    const rect = el.getBoundingClientRect();
    const host = document.createElement('div');
    host.setAttribute(HANDY_ATTR, 'highlight-host');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'open' });
    const box = document.createElement('div');
    box.style.cssText = [
      'position:fixed',
      `left:${Math.max(0, rect.left - 3)}px`,
      `top:${Math.max(0, rect.top - 3)}px`,
      `width:${rect.width + 6}px`,
      `height:${rect.height + 6}px`,
      'border:2.5px solid #2563eb',
      'background:rgba(37,99,235,0.14)',
      'border-radius:6px',
      'box-sizing:border-box',
      'transition:opacity 0.25s ease'
    ].join(';');
    shadow.appendChild(box);
    (document.body || document.documentElement).appendChild(host);

    setTimeout(() => {
      const updated = el.getBoundingClientRect();
      box.style.left = `${Math.max(0, updated.left - 3)}px`;
      box.style.top = `${Math.max(0, updated.top - 3)}px`;
      box.style.width = `${updated.width + 6}px`;
      box.style.height = `${updated.height + 6}px`;
    }, 220);

    setTimeout(() => {
      box.style.opacity = '0';
      setTimeout(() => host.remove(), 260);
    }, 1500);

    return { ok: true };
  }

  function detachPickerListeners() {
    window.removeEventListener('mousemove', onPickerMouseMove, true);
    window.removeEventListener('pointerdown', onPickerSuppress, true);
    window.removeEventListener('pointerup', onPickerSuppress, true);
    window.removeEventListener('mousedown', onPickerSuppress, true);
    window.removeEventListener('mouseup', onPickerSuppress, true);
    window.removeEventListener('click', onPickerClick, true);
    window.removeEventListener('keydown', onPickerKeyDown, true);
  }

  function sendRuntimeSafe(payload) {
    try {
      const maybePromise = chrome.runtime.sendMessage(payload);
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {});
      }
    } catch {
      // Ignore if extension context is unavailable
    }
  }

  function stopPicker(notifyCancelled = false) {
    if (!STATE.picking && !STATE.pickerHost) return;
    STATE.picking = false;
    detachPickerListeners();

    if (STATE.pickerHost) {
      STATE.pickerHost.remove();
      STATE.pickerHost = null;
      STATE.pickerBox = null;
      STATE.pickerLabel = null;
    }
    STATE.lastHovered = null;

    if (notifyCancelled) {
      const ctx = STATE.pickerContext;
      STATE.pickerContext = null;
      sendRuntimeSafe({ type: 'PICKER_CANCELLED', targetContext: ctx });
    } else {
      STATE.pickerContext = null;
    }
  }

  function updatePickerBox(el) {
    if (!STATE.pickerBox || !STATE.pickerLabel) return;
    if (!el || isHandyElement(el) || el === document.documentElement || el === document.body) {
      STATE.pickerBox.style.display = 'none';
      return;
    }
    const rect = el.getBoundingClientRect();
    STATE.pickerBox.style.display = 'block';
    STATE.pickerBox.style.left = `${rect.left}px`;
    STATE.pickerBox.style.top = `${rect.top}px`;
    STATE.pickerBox.style.width = `${rect.width}px`;
    STATE.pickerBox.style.height = `${rect.height}px`;

    const tag = el.tagName.toLowerCase();
    const idPart = el.id ? `#${el.id}` : '';
    const clsPart =
      !idPart && el.classList.length > 0
        ? '.' + Array.from(el.classList).slice(0, 2).join('.')
        : '';
    STATE.pickerLabel.textContent = `${tag}${idPart}${clsPart}`;
    const labelTop = rect.top > 28 ? rect.top - 24 : rect.bottom + 4;
    STATE.pickerLabel.style.left = `${Math.max(4, Math.min(window.innerWidth - 180, rect.left))}px`;
    STATE.pickerLabel.style.top = `${Math.max(4, labelTop)}px`;
  }

  function onPickerMouseMove(e) {
    if (!STATE.picking) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (target && !isHandyElement(target)) {
      STATE.lastHovered = target;
      updatePickerBox(target);
    }
  }

  function onPickerSuppress(e) {
    if (!STATE.picking) return;
    if (isHandyElement(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  function onPickerClick(e) {
    if (!STATE.picking) return;
    if (isHandyElement(e.target)) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    STATE.picking = false;
    detachPickerListeners();

    try {
      const picked =
        document.elementFromPoint(e.clientX, e.clientY) ||
        STATE.lastHovered ||
        (e.target instanceof Element ? e.target : null);
      if (!picked || !(picked instanceof Element) || isHandyElement(picked)) {
        stopPicker(true);
        return;
      }

      const info = buildSelectorInfo(picked);
      const context = STATE.pickerContext;

      if (STATE.pickerBox) {
        STATE.pickerBox.style.borderColor = '#10b981';
        STATE.pickerBox.style.background = 'rgba(16, 185, 129, 0.2)';
      }

      sendRuntimeSafe({
        type: 'ELEMENT_PICKED',
        targetContext: context,
        elementInfo: info
      });

      setTimeout(() => stopPicker(false), 160);
    } catch (err) {
      console.error('Handy picker error:', err);
      stopPicker(true);
    }
  }

  function onPickerKeyDown(e) {
    if (!STATE.picking) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      stopPicker(true);
    }
  }

  function startPicker(targetContext) {
    stopPicker(false);
    STATE.picking = true;
    STATE.pickerContext = targetContext || null;

    const host = document.createElement('div');
    host.setAttribute(HANDY_ATTR, 'picker-host');
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      .hud {
        position: fixed;
        top: 12px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        align-items: center;
        gap: 10px;
        background: #0f172a;
        color: #f8fafc;
        padding: 8px 14px;
        border-radius: 999px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 500;
        box-shadow: 0 10px 30px rgba(0,0,0,0.32);
        border: 1px solid rgba(255,255,255,0.16);
        pointer-events: auto;
      }
      .dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #3b82f6;
        box-shadow: 0 0 0 4px rgba(59,130,246,0.28);
      }
      .cancel {
        background: rgba(255,255,255,0.14);
        color: #ffffff;
        border: none;
        border-radius: 999px;
        padding: 4px 10px;
        font-size: 12px;
        cursor: pointer;
      }
      .cancel:hover { background: rgba(255,255,255,0.24); }
      .box {
        position: fixed;
        display: none;
        border: 2px solid #2563eb;
        background: rgba(37, 99, 235, 0.14);
        border-radius: 4px;
        box-sizing: border-box;
        pointer-events: none;
      }
      .label {
        position: fixed;
        background: #1e293b;
        color: #ffffff;
        padding: 2px 7px;
        border-radius: 4px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        pointer-events: none;
        white-space: nowrap;
      }
    `;

    const hud = document.createElement('div');
    hud.className = 'hud';
    const dot = document.createElement('span');
    dot.className = 'dot';
    const msg = document.createElement('span');
    msg.textContent =
      targetContext?.kind === 'button-anchor'
        ? 'Click where you want to place the button (Esc to cancel)'
        : 'Click any element on the page to select it (Esc to cancel)';
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      stopPicker(true);
    });
    hud.append(dot, msg, cancelBtn);

    const box = document.createElement('div');
    box.className = 'box';
    const label = document.createElement('div');
    label.className = 'label';
    box.appendChild(label);

    shadow.append(style, box, hud);
    (document.body || document.documentElement).appendChild(host);

    STATE.pickerHost = host;
    STATE.pickerBox = box;
    STATE.pickerLabel = label;

    window.addEventListener('mousemove', onPickerMouseMove, true);
    window.addEventListener('pointerdown', onPickerSuppress, true);
    window.addEventListener('pointerup', onPickerSuppress, true);
    window.addEventListener('mousedown', onPickerSuppress, true);
    window.addEventListener('mouseup', onPickerSuppress, true);
    window.addEventListener('click', onPickerClick, true);
    window.addEventListener('keydown', onPickerKeyDown, true);
  }

  // ---------- Custom Page Button Injection ----------
  function createShadowButtonNode(btnConfig) {
    const host = document.createElement('span');
    host.setAttribute(HANDY_ATTR, 'button-host');
    host.setAttribute('data-handy-btn-id', btnConfig.id);
    host.style.cssText = 'display:inline-flex;vertical-align:middle;margin:4px;';

    const shadow = host.attachShadow({ mode: 'open' });
    const theme = BUTTON_COLORS[btnConfig.color] || BUTTON_COLORS.blue;

    const style = document.createElement('style');
    style.textContent = `
      button {
        all: unset;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 13px;
        border-radius: 8px;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.2;
        cursor: pointer;
        background: ${theme.bg};
        color: ${theme.text};
        border: 1px solid ${theme.border};
        box-shadow: 0 2px 6px rgba(15, 23, 42, 0.16);
        transition: background-color 0.15s ease, transform 0.1s ease, opacity 0.15s ease;
        user-select: none;
      }
      button:hover { background: ${theme.hover}; }
      button:active { transform: translateY(1px); }
      button:focus-visible { outline: 2px solid #0f172a; outline-offset: 2px; }
      button[data-busy="true"] { opacity: 0.78; cursor: wait; }
    `;

    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = btnConfig.label || 'Quick Action';

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (button.getAttribute('data-busy') === 'true') return;

      button.setAttribute('data-busy', 'true');
      const originalLabel = btnConfig.label || 'Quick Action';
      button.textContent = 'Running...';

      try {
        let stepsToRun = btnConfig.steps || [];
        if (btnConfig.actionMode === 'workflow' && btnConfig.workflowId) {
          const allData = await HandyStorage.getAllData();
          const wf = allData.workflows.find((w) => w.id === btnConfig.workflowId);
          if (!wf) {
            throw new Error('Linked workflow no longer exists');
          }
          stepsToRun = wf.steps || [];
        }

        const runId = `btn_${Date.now()}`;
        const result = await runStepList(stepsToRun, runId, originalLabel);
        if (result.ok) {
          button.textContent = 'Done ✓';
          setTimeout(() => {
            button.textContent = originalLabel;
          }, 1200);
        } else {
          button.textContent = originalLabel;
          showPageToast(result.error || 'Action failed', true);
        }
      } catch (err) {
        button.textContent = originalLabel;
        showPageToast(err?.message || 'Action failed', true);
      } finally {
        button.removeAttribute('data-busy');
      }
    });

    shadow.append(style, button);
    return host;
  }

  function ensureFloatingDock(corner) {
    let dock = document.querySelector(`[${HANDY_ATTR}="dock"][data-handy-corner="${corner}"]`);
    if (dock) return dock;

    dock = document.createElement('div');
    dock.setAttribute(HANDY_ATTR, 'dock');
    dock.setAttribute('data-handy-corner', corner);

    const posCss = {
      'bottom-right': 'bottom:18px;right:18px;justify-content:flex-end;',
      'bottom-left': 'bottom:18px;left:18px;justify-content:flex-start;',
      'top-right': 'top:18px;right:18px;justify-content:flex-end;',
      'top-left': 'top:18px;left:18px;justify-content:flex-start;'
    }[corner] || 'bottom:18px;right:18px;justify-content:flex-end;';

    dock.style.cssText = `position:fixed;${posCss}z-index:2147483640;display:flex;flex-wrap:wrap;gap:6px;max-width:340px;pointer-events:auto;`;
    (document.body || document.documentElement).appendChild(dock);
    return dock;
  }

  function isButtonMountedCorrectly(host, btnConfig) {
    if (!host || !host.isConnected) return false;
    if (btnConfig.placementMode === 'floating') {
      const parent = host.parentElement;
      return Boolean(parent && parent.getAttribute('data-handy-corner') === btnConfig.floatingCorner);
    }
    const anchor = findTargetElement(btnConfig.anchorSelector);
    if (!anchor) return false;
    if (btnConfig.anchorPosition === 'before') return host.nextElementSibling === anchor;
    if (btnConfig.anchorPosition === 'after') return anchor.nextElementSibling === host;
    if (btnConfig.anchorPosition === 'prepend') return anchor.firstElementChild === host;
    return anchor.lastElementChild === host;
  }

  async function syncPageButtons() {
    if (!document.body) return;
    const { buttons } = await HandyStorage.getMatchingForUrl(location.href);
    const activeButtons = buttons.filter((b) => b.enabled);
    const activeMap = new Map(activeButtons.map((b) => [b.id, b]));

    // Remove stale or outdated button hosts
    const existingHosts = document.querySelectorAll(`[${HANDY_ATTR}="button-host"]`);
    for (const host of existingHosts) {
      const id = host.getAttribute('data-handy-btn-id');
      const cfg = activeMap.get(id);
      if (!cfg) {
        host.remove();
        continue;
      }
      const sig = JSON.stringify([
        cfg.label,
        cfg.color,
        cfg.placementMode,
        cfg.anchorSelector,
        cfg.anchorPosition,
        cfg.floatingCorner,
        cfg.actionMode,
        cfg.workflowId,
        cfg.steps
      ]);
      if (host.getAttribute('data-handy-sig') !== sig || !isButtonMountedCorrectly(host, cfg)) {
        host.remove();
      }
    }

    // Mount missing buttons
    for (const cfg of activeButtons) {
      const existing = document.querySelector(
        `[${HANDY_ATTR}="button-host"][data-handy-btn-id="${CSS.escape(cfg.id)}"]`
      );
      if (existing) continue;

      const sig = JSON.stringify([
        cfg.label,
        cfg.color,
        cfg.placementMode,
        cfg.anchorSelector,
        cfg.anchorPosition,
        cfg.floatingCorner,
        cfg.actionMode,
        cfg.workflowId,
        cfg.steps
      ]);

      if (cfg.placementMode === 'floating') {
        const dock = ensureFloatingDock(cfg.floatingCorner || 'bottom-right');
        const node = createShadowButtonNode(cfg);
        node.setAttribute('data-handy-sig', sig);
        dock.appendChild(node);
      } else {
        const anchor = findTargetElement(cfg.anchorSelector);
        if (!anchor) continue;
        const node = createShadowButtonNode(cfg);
        node.setAttribute('data-handy-sig', sig);

        if (cfg.anchorPosition === 'before') {
          anchor.insertAdjacentElement('beforebegin', node);
        } else if (cfg.anchorPosition === 'after') {
          anchor.insertAdjacentElement('afterend', node);
        } else if (cfg.anchorPosition === 'prepend') {
          anchor.insertAdjacentElement('afterbegin', node);
        } else {
          anchor.insertAdjacentElement('beforeend', node);
        }
      }
    }

    // Clean up empty docks
    const docks = document.querySelectorAll(`[${HANDY_ATTR}="dock"]`);
    for (const dock of docks) {
      if (dock.children.length === 0) dock.remove();
    }
  }

  function cancelPendingAutoRuns() {
    for (const timerId of STATE.autoRunTimers.values()) {
      clearTimeout(timerId);
    }
    STATE.autoRunTimers.clear();
  }

  async function scheduleAutoRunWorkflows(targetUrl = location.href) {
    if (!HandyUrlMatcher.isSupportedWebUrl(targetUrl)) return;
    const { workflows } = await HandyStorage.getMatchingForUrl(targetUrl);
    const eligible = workflows.filter(
      (w) => w.enabled && w.autoRunOnLoad && Array.isArray(w.steps) && w.steps.length > 0
    );

    for (const wf of eligible) {
      const key = `${wf.id}::${targetUrl}`;
      if (STATE.autoRunCompletedKeys.has(key) || STATE.autoRunTimers.has(wf.id)) {
        continue;
      }
      const delayMs = Math.max(0, Number(wf.autoRunDelayMs) || 0);
      const timerId = setTimeout(async () => {
        STATE.autoRunTimers.delete(wf.id);
        if (location.href !== targetUrl) return;
        // Re-check latest workflow config in case user disabled or edited it during delay
        const freshData = await HandyStorage.getAllData();
        const latestWf = freshData.workflows.find((item) => item.id === wf.id);
        if (
          !latestWf ||
          !latestWf.enabled ||
          !latestWf.autoRunOnLoad ||
          !HandyUrlMatcher.matchesUrl(latestWf.urlPattern, location.href)
        ) {
          return;
        }
        STATE.autoRunCompletedKeys.add(key);
        const result = await runStepList(
          latestWf.steps,
          `auto_${latestWf.id}_${Date.now()}`,
          latestWf.name
        );
        if (!result.ok && !result.cancelled) {
          showPageToast(`Auto-run "${latestWf.name}" failed: ${result.error}`, true);
        }
      }, delayMs);

      STATE.autoRunTimers.set(wf.id, timerId);
    }
  }

  function handleUrlTransition(newUrl) {
    STATE.lastUrl = newUrl;
    cancelPendingAutoRuns();
    scheduleSyncButtons();
    scheduleAutoRunWorkflows(newUrl);
  }

  function scheduleSyncButtons() {
    clearTimeout(STATE.syncTimer);
    STATE.syncTimer = setTimeout(() => {
      syncPageButtons();
    }, 150);
  }

  // Watch DOM changes & SPA URL transitions
  const observer = new MutationObserver((mutations) => {
    const hasRelevantMutation = mutations.some(
      (m) => !(m.target instanceof Element && isHandyElement(m.target))
    );
    if (location.href !== STATE.lastUrl) {
      handleUrlTransition(location.href);
      return;
    }
    if (hasRelevantMutation) {
      scheduleSyncButtons();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
  window.addEventListener('popstate', () => {
    if (location.href !== STATE.lastUrl) {
      handleUrlTransition(location.href);
    } else {
      scheduleSyncButtons();
    }
  });
  window.addEventListener('hashchange', () => {
    if (location.href !== STATE.lastUrl) {
      handleUrlTransition(location.href);
    } else {
      scheduleSyncButtons();
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes[HandyStorage.STORAGE_KEY]) {
      syncPageButtons();
      // Cancel any pending auto-run whose workflow was disabled or deleted
      const updated = changes[HandyStorage.STORAGE_KEY].newValue;
      const wfMap = new Map((updated?.workflows || []).map((w) => [w.id, w]));
      for (const [wfId, timerId] of STATE.autoRunTimers.entries()) {
        const wf = wfMap.get(wfId);
        if (!wf || !wf.enabled || !wf.autoRunOnLoad) {
          clearTimeout(timerId);
          STATE.autoRunTimers.delete(wfId);
        }
      }
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || !message.type) return;

    switch (message.type) {
      case 'PING':
        sendResponse({ ok: true, url: location.href });
        return;

      case 'URL_CHANGED': {
        const nextUrl = message.url || location.href;
        if (nextUrl !== STATE.lastUrl) {
          handleUrlTransition(nextUrl);
        } else {
          syncPageButtons();
        }
        sendResponse({ ok: true });
        return;
      }

      case 'START_PICKER':
        startPicker(message.targetContext || null);
        sendResponse({ ok: true });
        return;

      case 'STOP_PICKER':
        stopPicker(false);
        sendResponse({ ok: true });
        return;

      case 'HIGHLIGHT_SELECTOR':
        sendResponse(highlightSelector(message.selector));
        return;

      case 'RUN_STEPS': {
        (async () => {
          const runId = message.runId || `run_${Date.now()}`;
          const result = await runStepList(message.steps || [], runId, message.label || 'Workflow');
          sendResponse(result);
        })();
        return true;
      }

      case 'STOP_RUN':
        if (STATE.activeRunId) {
          STATE.cancelledRunId = STATE.activeRunId;
        }
        sendResponse({ ok: true });
        return;

      case 'SYNC_BUTTONS':
        syncPageButtons().then(() => sendResponse({ ok: true }));
        return true;

      default:
        return;
    }
  });

  syncPageButtons();
  scheduleAutoRunWorkflows(location.href);
})();
