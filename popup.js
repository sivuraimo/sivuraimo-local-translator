function setStatus(el, message, type = 'info') {
  el.textContent = message;
  el.classList.add('show');
  el.dataset.type = type;
}

function clearStatus(el) {
  el.textContent = '';
  el.classList.remove('show');
  delete el.dataset.type;
}

function isMissingReceiverError(message = '') {
  return /Receiving end does not exist|Could not establish connection/i.test(message);
}

function isInjectableTab(tab) {
  return /^https?:|^file:/.test(tab?.url || '');
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }

      resolve(response);
    });
  });
}

async function ensureContentScript(tab) {
  if (!isInjectableTab(tab)) {
    throw new Error('Capture is only available on regular web pages.');
  }

  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ['content.css']
  });
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['content.js']
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  const portEl = document.getElementById('port');
  const targetLangEl = document.getElementById('targetLang');
  const saveEl = document.getElementById('save');
  const statusEl = document.getElementById('status');
  const captureAreaEl = document.getElementById('captureArea');
  const captureStatusEl = document.getElementById('captureStatus');

  const settings = await chrome.storage.sync.get({ port: '1234', targetLang: 'русский' });
  portEl.value = settings.port;
  targetLangEl.value = settings.targetLang;

  saveEl.addEventListener('click', async () => {
    const port = portEl.value || '1234';
    const targetLang = targetLangEl.value;

    await chrome.storage.sync.set({ port, targetLang });

    setStatus(statusEl, '✓ Сохранено', 'success');
    setTimeout(() => clearStatus(statusEl), 2000);
  });

  captureAreaEl.addEventListener('click', async () => {
    setStatus(captureStatusEl, 'Select an area on the page.', 'info');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) throw new Error('No active tab found.');

      let response;
      try {
        response = await sendTabMessage(tab.id, { action: 'startAreaCapture' });
      } catch (err) {
        if (!isMissingReceiverError(err.message)) throw err;

        await ensureContentScript(tab);
        response = await sendTabMessage(tab.id, { action: 'startAreaCapture' });
      }

      if (response?.ok) {
        window.close();
        return;
      }

      setStatus(captureStatusEl, 'Unable to start capture.', 'error');
    } catch (err) {
      setStatus(captureStatusEl, err.message || 'Unable to start capture.', 'error');
    }
  });
});
