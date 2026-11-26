importScripts('../shared/url-matcher.js', '../shared/storage.js');

async function configureSidePanelBehavior() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch (err) {
    console.warn('Could not set sidePanel behavior:', err);
  }
}

async function updateBadgeForTab(tab) {
  if (!tab || typeof tab.id !== 'number') return;
  try {
    if (!tab.url || !HandyUrlMatcher.isSupportedWebUrl(tab.url)) {
      await chrome.action.setBadgeText({ tabId: tab.id, text: '' });
      return;
    }
    const { workflows, buttons } = await HandyStorage.getMatchingForUrl(tab.url);
    const activeCount =
      workflows.filter((w) => w.enabled).length + buttons.filter((b) => b.enabled).length;
    await chrome.action.setBadgeText({
      tabId: tab.id,
      text: activeCount > 0 ? String(activeCount) : ''
    });
    if (activeCount > 0) {
      await chrome.action.setBadgeBackgroundColor({ tabId: tab.id, color: '#2563eb' });
    }
  } catch (err) {
    console.warn('Badge update failed:', err);
  }
}

async function refreshActiveTabBadge() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await updateBadgeForTab(tab);
    }
  } catch (err) {
    console.warn('Active tab badge refresh failed:', err);
  }
}

async function ensureContentScriptInjected(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    if (ping?.ok) return { ok: true };
  } catch {
    // Not yet injected in this tab
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['shared/url-matcher.js', 'shared/storage.js', 'content/content.js']
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || String(err) };
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await configureSidePanelBehavior();
  await refreshActiveTabBadge();
});

chrome.runtime.onStartup.addListener(async () => {
  await configureSidePanelBehavior();
  await refreshActiveTabBadge();
});

configureSidePanelBehavior();

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await updateBadgeForTab(tab);
  } catch {
    // Tab may have closed
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.url || changeInfo.status === 'complete') {
    await updateBadgeForTab(tab);
    if (changeInfo.url) {
      try {
        await chrome.tabs.sendMessage(tabId, { type: 'URL_CHANGED', url: changeInfo.url });
      } catch {
        // Content script may not be ready on restricted or loading pages
      }
    }
  }
});

chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName === 'local' && changes[HandyStorage.STORAGE_KEY]) {
    await refreshActiveTabBadge();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'ENSURE_CONTENT_SCRIPT' && typeof message.tabId === 'number') {
    (async () => {
      const result = await ensureContentScriptInjected(message.tabId);
      sendResponse(result);
    })();
    return true;
  }
});
