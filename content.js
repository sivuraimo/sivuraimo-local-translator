let translateBtn = null;
let translatePopup = null;
let popupResultEl = null;   // direct reference, not searched by id
let popupOriginalEl = null;
let currentSelection = '';
let isStreaming = false;
let isDraggingPopup = false;

function createButton() {
  const btn = document.createElement('div');
  btn.id = 'lt-translate-btn';
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-2"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg> Перевести`;
  btn.addEventListener('click', handleTranslate);
  document.body.appendChild(btn);
  return btn;
}

function createPopup() {
  const popup = document.createElement('div');
  popup.id = 'lt-popup';
  popup.innerHTML = `
    <div class="lt-header">
      <span class="lt-label">Перевод</span>
      <button class="lt-close">✕</button>
    </div>
    <div class="lt-original"></div>
    <div class="lt-result"></div>
  `;
  document.body.appendChild(popup);
  // store direct references — no getElementById on document
  popupOriginalEl = popup.querySelector('.lt-original');
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

function showButton(x, y) {
  if (!translateBtn) translateBtn = createButton();
  translateBtn.style.left = x + 'px';
  translateBtn.style.top = Math.max(10, y - 44) + 'px';
  translateBtn.style.display = 'flex';
}

function hideAll() {
  if (translateBtn) translateBtn.style.display = 'none';
  if (translatePopup) translatePopup.style.display = 'none';
  isStreaming = false;
}

async function handleTranslate() {
  if (!currentSelection) return;

  const btnLeft = parseInt(translateBtn.style.left);
  const btnTop = parseInt(translateBtn.style.top);
  translateBtn.style.display = 'none';

  if (!translatePopup) translatePopup = createPopup();

  const popupWidth = 300;
  const vw = window.innerWidth;
  let left = Math.min(Math.max(btnLeft, 10), vw - popupWidth - 10);

  translatePopup.style.left = left + 'px';
  translatePopup.style.top = btnTop + 'px';
  translatePopup.style.display = 'block';

  popupOriginalEl.textContent = currentSelection.length > 120
    ? currentSelection.slice(0, 120) + '…'
    : currentSelection;

  isStreaming = true;
  showLoading();

  const settings = await chrome.storage.sync.get({ port: '1234', targetLang: 'русский' });

  try {
    const port = chrome.runtime.connect({ name: 'translator' });
    let accumulated = '';

    port.onMessage.addListener((msg) => {
      console.log('[CS] port msg:', msg.action, msg.text ?? msg.error ?? '');
      if (msg.action === 'chunk' && isStreaming) {
        accumulated += msg.text;
        console.log('[CS] accumulated so far:', accumulated);
        popupResultEl.textContent = accumulated;
      } else if (msg.action === 'done') {
        console.log('[CS] done. final translation:', accumulated);
        isStreaming = false;
        if (!accumulated.trim()) {
          popupResultEl.innerHTML = '<span class="lt-error">Пустой ответ от модели</span>';
        }
      } else if (msg.action === 'error') {
        isStreaming = false;
        if (msg.error?.includes('Failed to fetch')) {
          popupResultEl.innerHTML = '<span class="lt-error">LM Studio не запущен. Проверь Local Server.</span>';
        } else {
          popupResultEl.innerHTML = '<span class="lt-error">Ошибка: ' + (msg.error || 'неизвестно') + '</span>';
        }
      }
    });

    port.onDisconnect.addListener(() => {
      const err = chrome.runtime.lastError?.message;
      if (isStreaming) {
        isStreaming = false;
        if (!accumulated.trim()) {
          popupResultEl.innerHTML = '<span class="lt-error">Ошибка: ' + (err || 'соединение разорвано') + '</span>';
        }
      }
    });

    port.postMessage({
      action: 'translate',
      text: currentSelection,
      lmPort: settings.port,
      targetLang: settings.targetLang
    });

  } catch (err) {
    isStreaming = false;
    if (err.message?.includes('Extension context invalidated')) {
      popupResultEl.innerHTML = '<span class="lt-error">Расширение обновилось — перезагрузи страницу (F5)</span>';
    } else {
      popupResultEl.innerHTML = '<span class="lt-error">Ошибка: ' + err.message + '</span>';
    }
  }
}

document.addEventListener('mouseup', (e) => {
  if (isDraggingPopup) return;

  setTimeout(() => {
    // Clicking the translate button — let handleTranslate manage state
    if (e.target.id === 'lt-translate-btn' || e.target.closest?.('#lt-translate-btn')) return;

    const selection = window.getSelection();
    const text = selection && selection.toString().trim();

    if (text && text.length > 2) {
      currentSelection = text;
      isStreaming = false;
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
