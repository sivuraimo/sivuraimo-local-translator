let translateBtn = null;
let translatePopup = null;
let popupResultEl = null;   // direct reference, not searched by id
let popupLangEl = null;
let popupLabelEl = null;
let currentSelection = '';
let isStreaming = false;
let isDraggingPopup = false;
let lastContextMenuPoint = null;
let activeStreamId = 0;
let activePort = null;

function createButton() {
  const btn = document.createElement('div');
  btn.id = 'lt-translate-btn';
  btn.innerHTML = `
    <button type="button" class="lt-action-btn" data-action="translate">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-2"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>
      Translate
    </button>
    <button type="button" class="lt-action-btn" data-action="explain">
      Explain
    </button>
    <button type="button" class="lt-action-btn" data-action="summarize">
      Summarize
    </button>
  `;
  btn.addEventListener('click', (e) => {
    const actionBtn = e.target.closest?.('.lt-action-btn');
    if (!actionBtn) return;

    handleTextAction(actionBtn.dataset.action);
  });
  document.body.appendChild(btn);
  return btn;
}

function createPopup() {
  const popup = document.createElement('div');
  popup.id = 'lt-popup';
  popup.innerHTML = `
    <div class="lt-header">
      <div class="lt-title">
        <span class="lt-label">Translate</span>
        <span class="lt-lang"></span>
      </div>
      <button class="lt-close">✕</button>
    </div>
    <div class="lt-result"></div>
  `;
  document.body.appendChild(popup);
  // store direct references — no getElementById on document
  popupLabelEl = popup.querySelector('.lt-label');
  popupLangEl = popup.querySelector('.lt-lang');
  popupResultEl = popup.querySelector('.lt-result');
  popup.querySelector('.lt-close').addEventListener('click', hideAll);

  // Draggable via header
  const header = popup.querySelector('.lt-header');
  let dragging = false, dragOffsetX = 0, dragOffsetY = 0;

  header.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('lt-close')) return;
    dragging = true;
    isDraggingPopup = true;
    const rect = popup.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    header.classList.add('lt-dragging');
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    popup.style.left = (e.clientX - dragOffsetX) + 'px';
    popup.style.top = (e.clientY - dragOffsetY) + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      isDraggingPopup = false;
      header.classList.remove('lt-dragging');
    }
  });

  return popup;
}

function showLoading() {
  if (popupResultEl) {
    popupResultEl.innerHTML = '<div class="lt-loading"><div class="lt-dot"></div><div class="lt-dot"></div><div class="lt-dot"></div></div>';
  }
}

function showError(message) {
  if (!popupResultEl) return;

  popupResultEl.textContent = '';
  const errorEl = document.createElement('span');
  errorEl.className = 'lt-error';
  errorEl.textContent = message;
  popupResultEl.appendChild(errorEl);
}

function showButton(x, y) {
  if (!translateBtn) translateBtn = createButton();
  translateBtn.style.left = x + 'px';
  translateBtn.style.top = Math.max(10, y - 44) + 'px';
  translateBtn.style.display = 'flex';
}

function showPopup(x, y, targetLang, label = 'Translate') {
  if (!translatePopup) translatePopup = createPopup();

  const popupWidth = 320;
  const popupMargin = 10;
  const left = Math.min(Math.max(x, popupMargin), window.innerWidth - popupWidth - popupMargin);

  translatePopup.style.left = left + 'px';
  translatePopup.style.top = Math.max(popupMargin, y) + 'px';
  translatePopup.style.display = 'block';
  popupLabelEl.textContent = label;
  popupLangEl.textContent = targetLang;
}

function getSettings() {
  const defaults = { port: '1234', targetLang: 'русский' };
  const chromeApi = globalThis.chrome;

  if (chromeApi?.storage?.sync) {
    return chromeApi.storage.sync.get(defaults);
  }

  return new Promise((resolve, reject) => {
    if (!chromeApi?.runtime?.sendMessage) {
      reject(new Error('Extension API is not available on this page. Reload the page and try again.'));
      return;
    }

    chromeApi.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      const err = chromeApi.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }

      resolve({ ...defaults, ...response });
    });
  });
}

function hideAll() {
  if (translateBtn) translateBtn.style.display = 'none';
  if (translatePopup) translatePopup.style.display = 'none';
  isStreaming = false;
  activeStreamId++;
  disconnectActivePort();
}

function disconnectActivePort() {
  if (!activePort) return;

  try {
    activePort.disconnect();
  } catch (err) {
    console.warn('[CS] port disconnect failed:', err.message);
  }

  activePort = null;
}

function streamTranslation(payload) {
  activeStreamId++;
  const streamId = activeStreamId;
  disconnectActivePort();

  isStreaming = true;
  showLoading();

  try {
    const port = chrome.runtime.connect({ name: 'translator' });
    activePort = port;
    let accumulated = '';

    port.onMessage.addListener((msg) => {
      if (streamId !== activeStreamId) return;

      console.log('[CS] port msg:', msg.action, msg.text ?? msg.error ?? '');
      if (msg.action === 'chunk' && isStreaming) {
        accumulated += msg.text;
        console.log('[CS] accumulated so far:', accumulated);
        popupResultEl.textContent = accumulated;
      } else if (msg.action === 'done') {
        console.log('[CS] done. final translation:', accumulated);
        isStreaming = false;
        activePort = null;
        if (!accumulated.trim()) {
          showError('Empty model response');
        }
      } else if (msg.action === 'error') {
        isStreaming = false;
        activePort = null;
        showError(msg.error || 'Unknown error');
      }
    });

    port.onDisconnect.addListener(() => {
      if (streamId !== activeStreamId) return;

      const err = chrome.runtime.lastError?.message;
      activePort = null;
      if (isStreaming) {
        isStreaming = false;
        if (!accumulated.trim()) {
          showError(err || 'Connection closed');
        }
      }
    });

    port.postMessage(payload);
  } catch (err) {
    if (streamId !== activeStreamId) return;

    isStreaming = false;
    activePort = null;
    if (err.message?.includes('Extension context invalidated')) {
      showError('Extension was updated. Reload the page.');
    } else {
      showError(err.message);
    }
  }
}

function getActionLabel(action) {
  if (action === 'explain') return 'Explain';
  if (action === 'summarize') return 'Summarize';
  return 'Translate';
}

async function handleTextAction(action) {
  if (!currentSelection) return;

  try {
    const btnLeft = parseInt(translateBtn.style.left);
    const btnTop = parseInt(translateBtn.style.top);
    translateBtn.style.display = 'none';

    const settings = await getSettings();
    showPopup(btnLeft, btnTop, settings.targetLang, getActionLabel(action));

    streamTranslation({
      action,
      text: currentSelection,
      lmPort: settings.port,
      targetLang: settings.targetLang
    });
  } catch (err) {
    showPopup(parseInt(translateBtn.style.left) || 10, parseInt(translateBtn.style.top) || 10, 'unknown', getActionLabel(action));
    showError(err.message || 'Unable to read extension settings');
  }
}

async function handleImageTranslate(imageUrl) {
  try {
    const settings = await getSettings();
    const point = lastContextMenuPoint || {
      x: Math.round(window.innerWidth / 2 - 160),
      y: Math.round(window.innerHeight / 3)
    };

    if (translateBtn) translateBtn.style.display = 'none';
    showPopup(point.x, point.y, settings.targetLang, 'Translate');

    streamTranslation({
      action: 'translateImage',
      imageUrl,
      lmPort: settings.port,
      targetLang: settings.targetLang
    });
  } catch (err) {
    const point = lastContextMenuPoint || { x: 10, y: 10 };
    showPopup(point.x, point.y, 'unknown', 'Translate');
    showError(err.message || 'Unable to read extension settings');
  }
}

document.addEventListener('contextmenu', (e) => {
  const image = e.target.closest?.('img');
  if (!image) return;

  lastContextMenuPoint = { x: e.clientX, y: e.clientY };
});

document.addEventListener('mouseup', (e) => {
  if (isDraggingPopup) return;

  setTimeout(() => {
    // Clicking the action bar — let the button handlers manage state
    if (e.target.id === 'lt-translate-btn' || e.target.closest?.('#lt-translate-btn')) return;

    const selection = window.getSelection();
    const text = selection && selection.toString().trim();

    if (text && text.length > 2) {
      currentSelection = text;
      isStreaming = false;
      activeStreamId++;
      disconnectActivePort();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showButton(rect.left + rect.width / 2 - 50, rect.top);
      if (translatePopup) translatePopup.style.display = 'none';
    } else {
      const t = e.target;
      if (t.id !== 'lt-translate-btn' && !t.closest('#lt-popup') && !t.closest('#lt-translate-btn')) {
        hideAll();
      }
    }
  }, 10);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hideAll();
});

document.addEventListener('scroll', () => {
  if (translateBtn) translateBtn.style.display = 'none';
}, { passive: true });

chrome.runtime.onMessage.addListener((message) => {
  if (message.action !== 'translateImageFromContextMenu' || !message.srcUrl) return;
  handleImageTranslate(message.srcUrl);
});
