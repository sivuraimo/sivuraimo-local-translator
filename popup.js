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

  const providerEl = document.getElementById('provider');
  const anthropicKeyEl = document.getElementById('anthropicKey');

  function syncProviderFields() {
    const isAnthropic = providerEl.value === 'anthropic';
    document.getElementById('lmstudioFields').hidden = isAnthropic;
    document.getElementById('lmstudioHint').hidden = isAnthropic;
    document.getElementById('anthropicFields').hidden = !isAnthropic;
    document.getElementById('anthropicHint').hidden = !isAnthropic;
  }

  const settings = await chrome.storage.sync.get({ port: '1234', targetLang: 'русский', provider: 'lmstudio' });
  const { anthropicKey } = await chrome.storage.local.get({ anthropicKey: '' });
  portEl.value = settings.port;
  targetLangEl.value = settings.targetLang;
  providerEl.value = settings.provider;
  anthropicKeyEl.value = anthropicKey;
  syncProviderFields();

  providerEl.addEventListener('change', syncProviderFields);

  saveEl.addEventListener('click', async () => {
    const port = portEl.value || '1234';
    const targetLang = targetLangEl.value;
    const provider = providerEl.value;

    if (provider === 'anthropic' && !anthropicKeyEl.value.trim()) {
      setStatus(statusEl, 'Введи Anthropic API key', 'error');
      return;
    }

    await chrome.storage.sync.set({ port, targetLang, provider });
    await chrome.storage.local.set({ anthropicKey: anthropicKeyEl.value.trim() });

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
