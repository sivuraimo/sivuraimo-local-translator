let translateBtn = null;
let translatePopup = null;
let popupResultEl = null;   // direct reference, not searched by id
let popupLangEl = null;
let popupLabelEl = null;
let exportBtnEl = null;
let exportMenuEl = null;
let mainCopyBtnEl = null;
let stopBtnEl = null;
let chatEl = null;
let chatMessagesEl = null;
let chatInputEl = null;
let chatSendEl = null;
let captureOverlayEl = null;
let captureSelectionEl = null;
let captureToolbarEl = null;
let captureSendEl = null;
let captureCancelEl = null;
let currentSelection = '';
let isStreaming = false;
let isDraggingPopup = false;
let lastContextMenuPoint = null;
let activeStreamId = 0;
let activePort = null;
let activeTargetEl = null;
let sessionContext = null;
let pendingCapturePrompt = null;
let chatHistory = [];
let lastCopyText = '';
const POPUP_MIN_WIDTH = 300;
const POPUP_MIN_HEIGHT = 190;
const POPUP_DEFAULT_WIDTH = 320;
const CHAT_INPUT_MIN_HEIGHT = 38;
const CHAT_INPUT_MAX_HEIGHT = 120;
const CHAT_INPUT_DEFAULT_PLACEHOLDER = 'Ask follow-up...';
const CAPTURE_PROMPT_PLACEHOLDER = 'Ask what to do with this screenshot...';

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
      <div class="lt-header-actions">
        <div class="lt-export-wrap">
          <button class="lt-export" type="button" aria-label="Export result" title="Export">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/></svg>
          </button>
          <div class="lt-export-menu" hidden>
            <button type="button" data-export-action="copy">Copy</button>
            <button type="button" data-export-action="save">Save .md</button>
          </div>
        </div>
        <button class="lt-close" type="button" aria-label="Close" title="Close">✕</button>
      </div>
    </div>
    <div class="lt-result-wrap">
      <button class="lt-answer-copy lt-main-copy" type="button" aria-label="Copy answer" title="Copy answer" hidden>
        <svg class="lt-copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
        <svg class="lt-copy-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>
      </button>
      <div class="lt-result"></div>
    </div>
    <div class="lt-chat" hidden>
      <div class="lt-chat-messages"></div>
      <form class="lt-chat-form">
        <div class="lt-chat-composer">
          <textarea class="lt-chat-input" rows="1" placeholder="Ask follow-up..." autocomplete="off"></textarea>
          <button class="lt-chat-send" type="submit" aria-label="Send message" title="Send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/></svg>
          </button>
          <button class="lt-stop" type="button" aria-label="Stop generation" title="Stop" hidden>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
          </button>
        </div>
      </form>
    </div>
    <div class="lt-resize-handle lt-resize-n" data-resize-edge="n"></div>
    <div class="lt-resize-handle lt-resize-e" data-resize-edge="e"></div>
    <div class="lt-resize-handle lt-resize-s" data-resize-edge="s"></div>
    <div class="lt-resize-handle lt-resize-w" data-resize-edge="w"></div>
    <div class="lt-resize-handle lt-resize-ne" data-resize-edge="ne"></div>
    <div class="lt-resize-handle lt-resize-se" data-resize-edge="se"></div>
    <div class="lt-resize-handle lt-resize-sw" data-resize-edge="sw"></div>
    <div class="lt-resize-handle lt-resize-nw" data-resize-edge="nw"></div>
  `;
  document.body.appendChild(popup);
  // store direct references — no getElementById on document
  popupLabelEl = popup.querySelector('.lt-label');
  popupLangEl = popup.querySelector('.lt-lang');
  popupResultEl = popup.querySelector('.lt-result');
  exportBtnEl = popup.querySelector('.lt-export');
  exportMenuEl = popup.querySelector('.lt-export-menu');
  mainCopyBtnEl = popup.querySelector('.lt-main-copy');
  stopBtnEl = popup.querySelector('.lt-stop');
  chatEl = popup.querySelector('.lt-chat');
  chatMessagesEl = popup.querySelector('.lt-chat-messages');
  chatInputEl = popup.querySelector('.lt-chat-input');
  chatSendEl = popup.querySelector('.lt-chat-send');
  stopBtnEl.addEventListener('click', stopGeneration);
  chatInputEl.addEventListener('input', resizeChatInput);
  chatInputEl.addEventListener('keydown', handleChatInputKeydown);
  exportBtnEl.addEventListener('click', toggleExportMenu);
  exportMenuEl.addEventListener('click', handleExportMenuClick);
  mainCopyBtnEl.addEventListener('click', () => copyAnswer(mainCopyBtnEl, popupResultEl.textContent));
  popup.querySelector('.lt-close').addEventListener('click', hideAll);
  popup.querySelector('.lt-chat-form').addEventListener('submit', handleChatSubmit);

  // Draggable via header
  const header = popup.querySelector('.lt-header');
  let dragging = false, dragOffsetX = 0, dragOffsetY = 0;
  let resizing = false, resizeEdge = '', resizeStart = null;

  header.addEventListener('mousedown', (e) => {
    if (e.target.closest('.lt-header-actions')) return;
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
    const width = popup.offsetWidth || POPUP_DEFAULT_WIDTH;
    const height = popup.offsetHeight || POPUP_MIN_HEIGHT;
    const nextLeft = clamp(e.clientX - dragOffsetX, 0, window.innerWidth - width);
    const nextTop = clamp(e.clientY - dragOffsetY, 0, window.innerHeight - height);
    popup.style.left = nextLeft + 'px';
    popup.style.top = nextTop + 'px';
  });

  popup.querySelectorAll('.lt-resize-handle').forEach((handle) => {
    handle.addEventListener('mousedown', (e) => {
      resizing = true;
      isDraggingPopup = true;
      resizeEdge = handle.dataset.resizeEdge;
      const rect = popup.getBoundingClientRect();
      resizeStart = {
        x: e.clientX,
        y: e.clientY,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
      popup.classList.add('lt-resizing');
      e.preventDefault();
      e.stopPropagation();
    });
  });

  document.addEventListener('mousemove', (e) => {
    if (!resizing || !resizeStart) return;
    resizePopup(e, popup, resizeEdge, resizeStart);
  });

  document.addEventListener('mouseup', () => {
    if (dragging) {
      dragging = false;
      isDraggingPopup = false;
      header.classList.remove('lt-dragging');
    }
    if (resizing) {
      resizing = false;
      isDraggingPopup = false;
      resizeEdge = '';
      resizeStart = null;
      popup.classList.remove('lt-resizing');
    }
  });

  return popup;
}

function showLoading(targetEl = popupResultEl) {
  if (targetEl) {
    targetEl.innerHTML = '<div class="lt-loading"><div class="lt-dot"></div><div class="lt-dot"></div><div class="lt-dot"></div></div>';
  }
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resizeChatInput() {
  if (!chatInputEl) return;
  chatInputEl.style.height = 'auto';
  const nextHeight = Math.max(
    CHAT_INPUT_MIN_HEIGHT,
    Math.min(chatInputEl.scrollHeight, CHAT_INPUT_MAX_HEIGHT)
  );
  chatInputEl.style.height = nextHeight + 'px';
  chatInputEl.style.overflowY = chatInputEl.scrollHeight > CHAT_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  updatePopupScrollAreas();
}

function handleChatInputKeydown(e) {
  if (e.key !== 'Enter' || e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
  e.preventDefault();
  if (chatInputEl?.form) {
    chatInputEl.form.requestSubmit();
  }
}

function removeCaptureOverlay() {
  if (!captureOverlayEl) return;

  captureOverlayEl.remove();
  captureOverlayEl = null;
  captureSelectionEl = null;
  captureToolbarEl = null;
  captureSendEl = null;
  captureCancelEl = null;
  document.documentElement.style.cursor = '';
  document.body.style.userSelect = '';
}

function captureAreaImage(rect, devicePixelRatio) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      action: 'captureAreaImage',
      rect,
      devicePixelRatio
    }, (response) => {
      const err = chrome.runtime.lastError;
      if (err) {
        reject(new Error(err.message));
        return;
      }
      if (response?.error) {
        reject(new Error(response.error));
        return;
      }
      if (!response?.imageUrl) {
        reject(new Error('Unable to capture selected area.'));
        return;
      }

      resolve(response.imageUrl);
    });
  });
}

function showCapturePrompt({ rect, imageUrl, settings }) {
  showPopup(rect.left, rect.top, settings.targetLang, 'Capture');
  clearChat();
  translatePopup?.classList.add('lt-capture-prompting');
  if (translatePopup && (parseFloat(translatePopup.style.width) || 0) < 360) {
    translatePopup.style.width = '360px';
  }
  pendingCapturePrompt = {
    imageUrl,
    settings,
    targetLang: settings.targetLang
  };
  sessionContext = {
    sourceType: 'capture',
    action: 'captureArea',
    originalText: '',
    targetLang: settings.targetLang,
    lastAnswer: ''
  };

  if (popupResultEl) {
    popupResultEl.innerHTML = `
      <div class="lt-capture-intro">
        <div class="lt-capture-mark" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 8h.01"/><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 15 4-4a2 2 0 0 1 2.8 0l4.2 4.2"/><path d="m13 14 1.2-1.2a2 2 0 0 1 2.8 0L21 17"/></svg>
        </div>
        <div class="lt-capture-copy">
          <div class="lt-capture-title">Screenshot ready</div>
          <div class="lt-capture-hint">Ask about the selected area or send empty to extract text.</div>
        </div>
      </div>
    `;
  }
  if (chatInputEl) {
    chatInputEl.placeholder = CAPTURE_PROMPT_PLACEHOLDER;
    chatInputEl.focus();
  }
  setChatVisible(true);
  setChatInputEnabled(true);
  setStopVisible(false);
}

function submitPendingCapturePrompt(prompt) {
  if (!pendingCapturePrompt) return false;

  const { imageUrl, settings, targetLang } = pendingCapturePrompt;
  pendingCapturePrompt = null;
  translatePopup?.classList.remove('lt-capture-prompting');
  if (chatInputEl) chatInputEl.placeholder = CHAT_INPUT_DEFAULT_PLACEHOLDER;
  if (chatMessagesEl) chatMessagesEl.textContent = '';
  chatHistory = [];

  streamTranslation({
    action: 'captureArea',
    imageUrl,
    prompt,
    lmPort: settings.port,
    targetLang
  }, {
    onComplete(answer) {
      if (!sessionContext) return;
      sessionContext.originalText = answer;
      sessionContext.lastAnswer = answer;
      lastCopyText = answer;
      setChatVisible(true);
      chatInputEl?.focus();
    }
  });

  return true;
}

function clampRectToViewport(rect) {
  const left = Math.max(0, rect.left);
  const top = Math.max(0, rect.top);
  const right = Math.min(window.innerWidth, rect.right);
  const bottom = Math.min(window.innerHeight, rect.bottom);
  return {
    left,
    top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top)
  };
}

function positionCaptureToolbar(rect) {
  if (!captureToolbarEl) return;
  const toolbarWidth = captureToolbarEl.offsetWidth || 312;
  const toolbarHeight = captureToolbarEl.offsetHeight || 38;
  const margin = 10;
  const left = clamp(
    rect.left + rect.width / 2 - toolbarWidth / 2,
    margin,
    Math.max(margin, window.innerWidth - toolbarWidth - margin)
  );
  const belowTop = rect.top + rect.height + 12;
  const aboveTop = rect.top - toolbarHeight - 12;
  const hasRoomBelow = belowTop + toolbarHeight <= window.innerHeight - margin;
  const top = hasRoomBelow ? belowTop : Math.max(margin, aboveTop);
  captureToolbarEl.style.left = `${left}px`;
  captureToolbarEl.style.top = `${top}px`;
}

function setCaptureSelectionRect(rect) {
  if (!captureSelectionEl) return;
  captureSelectionEl.style.left = `${rect.left}px`;
  captureSelectionEl.style.top = `${rect.top}px`;
  captureSelectionEl.style.width = `${rect.width}px`;
  captureSelectionEl.style.height = `${rect.height}px`;
}

function startAreaCapture() {
  if (captureOverlayEl) return;

  const overlay = document.createElement('div');
  overlay.id = 'lt-capture-overlay';
  overlay.innerHTML = `
    <div class="lt-capture-selection" hidden></div>
    <div class="lt-capture-toolbar" hidden>
      <button type="button" class="lt-action-btn" data-capture-action="translate">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 8l6 6"/><path d="M4 14l6-6 2-2"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/></svg>
        Translate
      </button>
      <button type="button" class="lt-action-btn" data-capture-action="extract">Extract text</button>
      <button type="button" class="lt-action-btn" data-capture-action="custom">Custom prompt</button>
      <button type="button" class="lt-action-btn lt-capture-cancel">Cancel</button>
    </div>
  `;
  document.body.appendChild(overlay);

  captureOverlayEl = overlay;
  captureSelectionEl = overlay.querySelector('.lt-capture-selection');
  captureToolbarEl = overlay.querySelector('.lt-capture-toolbar');
  captureSendEl = overlay.querySelector('.lt-capture-send');
  captureCancelEl = overlay.querySelector('.lt-capture-cancel');
  document.documentElement.style.cursor = 'crosshair';
  document.body.style.userSelect = 'none';

  const state = {
    dragging: false,
    startX: 0,
    startY: 0,
    rect: null
  };

  const cleanup = () => {
    overlay.removeEventListener('mousedown', onMouseDown);
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    document.removeEventListener('keydown', onKeyDown, true);
    captureToolbarEl?.removeEventListener('click', onToolbarClick);
    captureCancelEl?.removeEventListener('click', onCancel);
    removeCaptureOverlay();
  };

  const onCancel = () => {
    cleanup();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cleanup();
    }
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.lt-capture-toolbar')) return;

    state.dragging = true;
    state.startX = e.clientX;
    state.startY = e.clientY;
    state.rect = null;
    captureSelectionEl.hidden = false;
    captureToolbarEl.hidden = true;
    setCaptureSelectionRect({ left: e.clientX, top: e.clientY, width: 0, height: 0 });
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!state.dragging) return;

    const rect = clampRectToViewport({
      left: Math.min(state.startX, e.clientX),
      top: Math.min(state.startY, e.clientY),
      right: Math.max(state.startX, e.clientX),
      bottom: Math.max(state.startY, e.clientY)
    });

    state.rect = rect;
    setCaptureSelectionRect(rect);
  };

  const onMouseUp = () => {
    if (!state.dragging) return;
    state.dragging = false;

    if (!state.rect || state.rect.width < 8 || state.rect.height < 8) {
      cleanup();
      return;
    }

    captureToolbarEl.hidden = false;
    positionCaptureToolbar(state.rect);
  };

  const runQuickCaptureAction = async (action) => {
    if (!state.rect) return;
    const rect = { ...state.rect };

    try {
      const settings = await getSettings();
      const devicePixelRatio = window.devicePixelRatio || 1;
      cleanup();
      const imageUrl = await captureAreaImage(rect, devicePixelRatio);

      if (action === 'custom') {
        showCapturePrompt({ rect, imageUrl, settings });
        return;
      }

      const isTranslate = action === 'translate';
      const targetLang = settings.targetLang;
      const label = isTranslate ? 'Translate' : 'Extract text';
      const prompt = isTranslate
        ? `Translate all visible text in this screenshot to ${targetLang}. Return only the translation, preserving line breaks and simple structure.`
        : '';

      translatePopup?.classList.remove('lt-capture-prompting');
      showPopup(rect.left, rect.top, targetLang, label);
      clearChat();
      sessionContext = {
        sourceType: 'capture',
        action: 'captureArea',
        originalText: '',
        targetLang,
        lastAnswer: ''
      };

      streamTranslation({
        action: 'captureArea',
        imageUrl,
        prompt,
        lmPort: settings.port,
        targetLang
      }, {
        onComplete(answer) {
          if (!sessionContext) return;
          sessionContext.originalText = answer;
          sessionContext.lastAnswer = answer;
          lastCopyText = answer;
          setChatVisible(true);
          chatInputEl?.focus();
        }
      });
    } catch (err) {
      cleanup();
      showPopup(rect.left, rect.top, 'unknown', 'Capture');
      showError(err.message || 'Unable to read extension settings');
    }
  };

  const onToolbarClick = (e) => {
    const actionButton = e.target.closest?.('button[data-capture-action]');
    if (!actionButton) return;
    runQuickCaptureAction(actionButton.dataset.captureAction);
  };

  overlay.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('keydown', onKeyDown, true);
  captureToolbarEl.addEventListener('click', onToolbarClick);
  captureCancelEl.addEventListener('click', onCancel);
}

function resizePopup(e, popup, edge, start) {
  const maxWidth = Math.max(POPUP_MIN_WIDTH, window.innerWidth);
  const maxHeight = Math.max(POPUP_MIN_HEIGHT, window.innerHeight);
  let nextLeft = start.left;
  let nextTop = start.top;
  let nextWidth = start.width;
  let nextHeight = start.height;
  const dx = e.clientX - start.x;
  const dy = e.clientY - start.y;

  if (edge.includes('e')) {
    nextWidth = clamp(start.width + dx, POPUP_MIN_WIDTH, maxWidth - start.left);
  }

  if (edge.includes('s')) {
    nextHeight = clamp(start.height + dy, POPUP_MIN_HEIGHT, maxHeight - start.top);
  }

  if (edge.includes('w')) {
    const maxRightWidth = start.left + start.width;
    nextWidth = clamp(start.width - dx, POPUP_MIN_WIDTH, maxRightWidth);
    nextLeft = start.left + start.width - nextWidth;
  }

  if (edge.includes('n')) {
    const maxBottomHeight = start.top + start.height;
    nextHeight = clamp(start.height - dy, POPUP_MIN_HEIGHT, maxBottomHeight);
    nextTop = start.top + start.height - nextHeight;
  }

  popup.style.left = Math.max(0, nextLeft) + 'px';
  popup.style.top = Math.max(0, nextTop) + 'px';
  popup.style.width = nextWidth + 'px';
  popup.style.height = nextHeight + 'px';
  updatePopupScrollAreas(popup);
}

function updatePopupScrollAreas(popup = translatePopup) {
  if (!popup) return;
  const customHeight = popup.style.height.endsWith('px') ? parseFloat(popup.style.height) : 0;

  if (!customHeight) {
    if (popupResultEl) popupResultEl.style.maxHeight = '';
    if (chatMessagesEl) chatMessagesEl.style.maxHeight = '';
    return;
  }

  const headerHeight = popup.querySelector('.lt-header')?.offsetHeight || 44;
  const chatVisible = chatEl && !chatEl.hidden;
  const chatFormHeight = chatVisible ? (popup.querySelector('.lt-chat-form')?.offsetHeight || 58) : 0;
  const chromeHeight = headerHeight + chatFormHeight + (chatVisible ? 28 : 0);
  const available = Math.max(64, customHeight - chromeHeight);

  if (chatVisible) {
    if (popupResultEl) popupResultEl.style.maxHeight = Math.max(52, Math.floor(available * 0.48)) + 'px';
    if (chatMessagesEl) chatMessagesEl.style.maxHeight = Math.max(64, Math.floor(available * 0.52)) + 'px';
    return;
  }

  if (popupResultEl) popupResultEl.style.maxHeight = Math.max(52, available) + 'px';
  if (chatMessagesEl) chatMessagesEl.style.maxHeight = '';
}

function showError(message, targetEl = popupResultEl) {
  if (!targetEl) return;

  targetEl.textContent = '';
  const errorEl = document.createElement('span');
  errorEl.className = 'lt-error';
  errorEl.textContent = message;
  targetEl.appendChild(errorEl);
}

function showButton(x, y) {
  if (!translateBtn) translateBtn = createButton();
  translateBtn.style.left = x + 'px';
  translateBtn.style.top = Math.max(10, y - 44) + 'px';
  translateBtn.style.display = 'flex';
}

function showPopup(x, y, targetLang, label = 'Translate') {
  if (!translatePopup) translatePopup = createPopup();

  const popupMargin = 10;
  const popupWidth = parseFloat(translatePopup.style.width) || translatePopup.offsetWidth || POPUP_DEFAULT_WIDTH;
  const maxLeft = Math.max(popupMargin, window.innerWidth - popupWidth - popupMargin);
  const left = clamp(x, popupMargin, maxLeft);

  translatePopup.style.left = left + 'px';
  translatePopup.style.top = Math.max(popupMargin, y) + 'px';
  if (!translatePopup.style.width) translatePopup.style.width = POPUP_DEFAULT_WIDTH + 'px';
  updatePopupScrollAreas(translatePopup);
  translatePopup.style.display = 'block';
  popupLabelEl.textContent = label;
  popupLangEl.textContent = targetLang;
}

function setChatVisible(visible) {
  if (!chatEl) return;
  chatEl.hidden = !visible;
  updatePopupScrollAreas();
}

function clearChat() {
  chatHistory = [];
  if (chatMessagesEl) chatMessagesEl.textContent = '';
  if (chatInputEl) {
    chatInputEl.value = '';
    chatInputEl.placeholder = pendingCapturePrompt ? CAPTURE_PROMPT_PLACEHOLDER : CHAT_INPUT_DEFAULT_PLACEHOLDER;
    resizeChatInput();
  }
  setChatInputEnabled(true);
}

function resetSession() {
  sessionContext = null;
  pendingCapturePrompt = null;
  translatePopup?.classList.remove('lt-capture-prompting');
  lastCopyText = '';
  setExportMenuVisible(false);
  setButtonCopied(mainCopyBtnEl, false);
  if (mainCopyBtnEl) mainCopyBtnEl.hidden = true;
  clearChat();
  setChatVisible(false);
}

function appendChatMessage(role, text = '') {
  const messageEl = document.createElement('div');
  messageEl.className = `lt-chat-message lt-chat-message-${role}`;
  const contentEl = document.createElement('div');
  contentEl.className = 'lt-chat-message-content';
  contentEl.textContent = text;
  messageEl.appendChild(contentEl);

  if (role === 'assistant') {
    const copyButton = createAnswerCopyButton();
    copyButton.addEventListener('click', () => copyAnswer(copyButton, contentEl.textContent));
    messageEl.appendChild(copyButton);
  }

  chatMessagesEl.appendChild(messageEl);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  return contentEl;
}

function setChatInputEnabled(enabled) {
  if (chatInputEl) chatInputEl.disabled = !enabled;
  if (chatSendEl) chatSendEl.disabled = !enabled;
}

function setStopVisible(visible) {
  if (!stopBtnEl) return;
  stopBtnEl.hidden = !visible;
  if (chatSendEl) chatSendEl.hidden = visible;
}

function stopGeneration() {
  if (!isStreaming) return;

  isStreaming = false;
  activeStreamId++;
  disconnectActivePort();
  setStopVisible(false);
  setChatInputEnabled(true);
  if (activeTargetEl === popupResultEl && popupResultEl?.textContent.trim() && mainCopyBtnEl) {
    mainCopyBtnEl.hidden = false;
  }
  activeTargetEl = null;
}

function createAnswerCopyButton() {
  const button = document.createElement('button');
  button.className = 'lt-answer-copy';
  button.type = 'button';
  button.title = 'Copy answer';
  button.setAttribute('aria-label', 'Copy answer');
  button.innerHTML = `
    <svg class="lt-copy-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
    <svg class="lt-copy-check" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m20 6-11 11-5-5"/></svg>
  `;
  return button;
}

function setButtonCopied(button, copied) {
  if (!button) return;
  button.classList.toggle('lt-copied', copied);
}

async function copyText(text) {
  if (!text.trim()) return;
  await navigator.clipboard.writeText(text);
}

async function copyAnswer(button, text) {
  try {
    await copyText(text);
    setButtonCopied(button, true);
    setTimeout(() => setButtonCopied(button, false), 1100);
  } catch (err) {
    console.warn('[CS] copy failed:', err.message);
  }
}

function setExportMenuVisible(visible) {
  if (!exportMenuEl) return;
  exportMenuEl.hidden = !visible;
}

function toggleExportMenu() {
  setExportMenuVisible(exportMenuEl.hidden);
}

async function handleExportMenuClick(e) {
  const actionButton = e.target.closest('button[data-export-action]');
  if (!actionButton) return;

  const text = lastCopyText || sessionContext?.lastAnswer || popupResultEl?.textContent || '';
  if (!text.trim()) return;

  setExportMenuVisible(false);

  if (actionButton.dataset.exportAction === 'save') {
    saveMarkdown(text);
    return;
  }

  try {
    await copyText(text);
  } catch (err) {
    console.warn('[CS] export copy failed:', err.message);
  }
}

function saveMarkdown(text) {
  const title = popupLabelEl?.textContent || 'Result';
  const lang = popupLangEl?.textContent || '';
  const markdown = `# ${title}${lang ? ` (${lang})` : ''}\n\n${text.trim()}\n`;
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `local-translator-${Date.now()}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

function getSettings() {
  const defaults = { port: '1234', targetLang: 'русский' };
  const chromeApi = globalThis.chrome;

  if (chromeApi?.storage?.sync) {
    return new Promise((resolve, reject) => {
      chromeApi.storage.sync.get(defaults, (settings) => {
        const err = chromeApi.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }

        resolve(settings);
      });
    });
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
  if (popupResultEl) popupResultEl.textContent = '';
  if (mainCopyBtnEl) mainCopyBtnEl.hidden = true;
  isStreaming = false;
  setStopVisible(false);
  activeStreamId++;
  disconnectActivePort();
  activeTargetEl = null;
  resetSession();
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

function streamTranslation(payload, options = {}) {
  activeStreamId++;
  const streamId = activeStreamId;
  disconnectActivePort();
  const targetEl = options.targetEl || popupResultEl;
  activeTargetEl = targetEl;

  isStreaming = true;
  setStopVisible(true);
  setChatInputEnabled(false);
  if (targetEl === popupResultEl && mainCopyBtnEl) mainCopyBtnEl.hidden = true;
  showLoading(targetEl);

  try {
    const port = chrome.runtime.connect({ name: 'translator' });
    activePort = port;
    let accumulated = '';

    port.onMessage.addListener((msg) => {
      if (streamId !== activeStreamId) return;

      console.log('[CS] port msg:', msg.action, msg.text ?? msg.error ?? '');
      if (msg.action === 'chunk' && isStreaming) {
        accumulated += msg.text;
        lastCopyText = accumulated;
        console.log('[CS] accumulated so far:', accumulated);
        targetEl.textContent = accumulated;
        if (chatMessagesEl?.contains(targetEl)) {
          chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
        }
      } else if (msg.action === 'done') {
        console.log('[CS] done. final translation:', accumulated);
        isStreaming = false;
        activePort = null;
        activeTargetEl = null;
        setStopVisible(false);
        setChatInputEnabled(true);
        if (!accumulated.trim()) {
          showError('Empty model response', targetEl);
        } else {
          if (targetEl === popupResultEl && mainCopyBtnEl) {
            mainCopyBtnEl.hidden = false;
            lastCopyText = accumulated;
          }
          if (options.onComplete) {
            options.onComplete(accumulated);
          }
        }
      } else if (msg.action === 'error') {
        isStreaming = false;
        activePort = null;
        activeTargetEl = null;
        setStopVisible(false);
        setChatInputEnabled(true);
        showError(msg.error || 'Unknown error', targetEl);
      }
    });

    port.onDisconnect.addListener(() => {
      if (streamId !== activeStreamId) return;

      const err = chrome.runtime.lastError?.message;
      activePort = null;
      activeTargetEl = null;
      if (isStreaming) {
        isStreaming = false;
        setStopVisible(false);
        setChatInputEnabled(true);
        if (!accumulated.trim()) {
          showError(err || 'Connection closed', targetEl);
        }
      }
    });

    port.postMessage(payload);
  } catch (err) {
    if (streamId !== activeStreamId) return;

    isStreaming = false;
    activePort = null;
    activeTargetEl = null;
    setStopVisible(false);
    setChatInputEnabled(true);
    if (err.message?.includes('Extension context invalidated')) {
      showError('Extension was updated. Reload the page.', targetEl);
    } else {
      showError(err.message, targetEl);
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
    clearChat();

    sessionContext = {
      sourceType: 'text',
      action,
      originalText: currentSelection,
      targetLang: settings.targetLang,
      lastAnswer: ''
    };

    streamTranslation({
      action,
      text: currentSelection,
      lmPort: settings.port,
      targetLang: settings.targetLang
    }, {
      onComplete(answer) {
        if (!sessionContext) return;
        sessionContext.lastAnswer = answer;
        lastCopyText = answer;
        setChatVisible(true);
        chatInputEl?.focus();
      }
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
    clearChat();
    sessionContext = {
      sourceType: 'image',
      action: 'translateImage',
      originalText: '',
      targetLang: settings.targetLang,
      lastAnswer: ''
    };

    streamTranslation({
      action: 'translateImage',
      imageUrl,
      lmPort: settings.port,
      targetLang: settings.targetLang
    }, {
      onComplete(answer) {
        if (!sessionContext) return;
        sessionContext.lastAnswer = answer;
        lastCopyText = answer;
        setChatVisible(true);
        chatInputEl?.focus();
      }
    });
  } catch (err) {
    const point = lastContextMenuPoint || { x: 10, y: 10 };
    showPopup(point.x, point.y, 'unknown', 'Translate');
    showError(err.message || 'Unable to read extension settings');
  }
}

async function handleChatSubmit(e) {
  e.preventDefault();
  if (isStreaming) return;

  const question = chatInputEl.value.trim();
  if (pendingCapturePrompt) {
    chatInputEl.value = '';
    resizeChatInput();
    submitPendingCapturePrompt(question);
    return;
  }

  if (!sessionContext || !question) return;

  try {
    const settings = await getSettings();
    chatInputEl.value = '';
    resizeChatInput();
    appendChatMessage('user', question);
    const assistantEl = appendChatMessage('assistant');

    const history = chatHistory.slice(-6);
    chatHistory.push({ role: 'user', content: question });

    streamTranslation({
      action: 'chat',
      question,
      context: {
        sourceType: sessionContext.sourceType,
        action: sessionContext.action,
        originalText: sessionContext.originalText,
        lastAnswer: sessionContext.lastAnswer,
        history
      },
      lmPort: settings.port,
      targetLang: settings.targetLang
    }, {
      targetEl: assistantEl,
      onComplete(answer) {
        if (!sessionContext) return;
        sessionContext.lastAnswer = answer;
        lastCopyText = answer;
        chatHistory.push({ role: 'assistant', content: answer });
      }
    });
  } catch (err) {
    appendChatMessage('assistant', err.message || 'Unable to send question');
  }
}

document.addEventListener('contextmenu', (e) => {
  const image = e.target.closest?.('img');
  if (!image) return;

  lastContextMenuPoint = { x: e.clientX, y: e.clientY };
});

document.addEventListener('mouseup', (e) => {
  if (isDraggingPopup) return;
  if (e.target.closest?.('#lt-capture-overlay')) return;

  setTimeout(() => {
    // Clicking the action bar — let the button handlers manage state
    if (e.target.id === 'lt-translate-btn' || e.target.closest?.('#lt-translate-btn')) return;

    const selection = window.getSelection();
    const text = selection && selection.toString().trim();

    if (text && text.length > 2) {
      currentSelection = text;
      isStreaming = false;
      setStopVisible(false);
      activeStreamId++;
      disconnectActivePort();
      resetSession();
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'startAreaCapture') {
    startAreaCapture();
    sendResponse({ ok: true });
    return false;
  }

  if (message.action !== 'translateImageFromContextMenu' || !message.srcUrl) return;
  handleImageTranslate(message.srcUrl);
});
