async function ensureDefaultSettings() {
  const settings = await chrome.storage.sync.get(['port', 'targetLang']);
  const defaults = {};

  if (!settings.port) defaults.port = '1234';
  if (!settings.targetLang) defaults.targetLang = 'русский';

  if (Object.keys(defaults).length) {
    await chrome.storage.sync.set(defaults);
  }
}

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'translate-image',
      title: 'Translate image',
      contexts: ['image']
    });
  });
}

chrome.runtime.onInstalled.addListener(() => {
  ensureDefaultSettings();
  createContextMenus();
});

chrome.runtime.onStartup.addListener(() => {
  createContextMenus();
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'translate-image' || !info.srcUrl || !tab?.id) return;

  chrome.tabs.sendMessage(tab.id, {
    action: 'translateImageFromContextMenu',
    srcUrl: info.srcUrl
  }, () => {
    if (chrome.runtime.lastError) {
      console.warn('[Translator] unable to send image translate request:', chrome.runtime.lastError.message);
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'getSettings') return false;

  chrome.storage.sync.get({ port: '1234', targetLang: 'русский' }, (settings) => {
    const err = chrome.runtime.lastError;
    if (err) {
      sendResponse({ error: err.message });
      return;
    }

    sendResponse(settings);
  });

  return true;
});

function isVisionUnsupportedError(message) {
  return /image|vision|multimodal|content type|unsupported|invalid content/i.test(message)
    && /unsupported|not support|does not support|invalid|expected.*string/i.test(message);
}

function normalizeErrorMessage(err) {
  const message = err?.message || String(err);
  if (message.includes('Failed to fetch')) {
    return 'LM Studio is not running. Check Local Server.';
  }
  if (isVisionUnsupportedError(message)) {
    return 'This model does not support images. Load a vision model in LM Studio.';
  }
  return message;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }

  return btoa(binary);
}

function dataUrlToBase64(dataUrl) {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

function getImageMime(contentType) {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return mime.startsWith('image/') ? mime : 'image/png';
}

async function blobToDataUrl(blob, mimeOverride) {
  const buffer = await blob.arrayBuffer();
  const mime = mimeOverride || getImageMime(blob.type || 'image/png');
  return `data:${mime};base64,${arrayBufferToBase64(buffer)}`;
}

async function normalizeImageBlobToPngDataUrl(blob) {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas === 'undefined') {
    return null;
  }

  const bitmap = await createImageBitmap(blob);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const pngBlob = await canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(pngBlob, 'image/png');
}

async function imageUrlToPayloads(srcUrl) {
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error(`Image fetch failed: HTTP ${res.status}`);

  const contentType = getImageMime(res.headers.get('content-type') || 'image/png');
  const blob = await res.blob();
  const originalDataUrl = srcUrl.startsWith('data:')
    ? srcUrl
    : await blobToDataUrl(blob, contentType);
  const payloads = [];

  try {
    const pngDataUrl = await normalizeImageBlobToPngDataUrl(blob);
    if (pngDataUrl) payloads.push(pngDataUrl);
  } catch (err) {
    console.warn('[Translator] image normalization failed:', err.message);
  }

  payloads.push(originalDataUrl, dataUrlToBase64(originalDataUrl));
  return [...new Set(payloads)];
}

async function postChatCompletion({ lmPort, body }) {
  const res = await fetch(`http://127.0.0.1:${lmPort}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${res.statusText}${errorText ? ` - ${errorText}` : ''}`);
  }

  return res;
}

function buildTranslationBody({ targetLang, text }) {
  return {
    model: 'qwen/qwen3.5-9b',
    messages: [
      {
        role: 'system',
        content: `Ты переводчик. Переводи текст на ${targetLang}. Отвечай ТОЛЬКО переводом, без пояснений, без кавычек.`
      },
      { role: 'user', content: '/no_think\n' + text }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    stream: true
  };
}

function buildExplainBody({ targetLang, text }) {
  return {
    model: 'qwen/qwen3.5-9b',
    messages: [
      {
        role: 'system',
        content: `Ты объясняешь выделенный пользователем текст на ${targetLang}.
Пиши простыми словами и не переводи дословно.
Если текст короткий или простой — отвечай кратко одним абзацем.
Если текст сложный — дай структурированное объяснение:
- Коротко: главная мысль.
- Что это значит: смысл простыми словами.
- Термины: поясни только реально важные термины, если они есть.
- Важный нюанс: укажи условие, риск, ограничение или скрытый смысл, если он есть.
Не выдумывай факты вне данного текста. Не используй markdown-таблицы.`
      },
      { role: 'user', content: '/no_think\nОбъясни этот текст:\n\n' + text }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    stream: true
  };
}

function buildSummarizeBody({ targetLang, text }) {
  return {
    model: 'qwen/qwen3.5-9b',
    messages: [
      {
        role: 'system',
        content: `Ты кратко пересказываешь выделенный пользователем текст на ${targetLang}.
Сохраняй только важные мысли и выводы.
Если текст короткий — ответь 1-2 предложениями.
Если текст длинный — используй структуру:
- Summary: краткое резюме.
- Key points: основные пункты.
Не добавляй факты, которых нет в тексте. Не используй markdown-таблицы.`
      },
      { role: 'user', content: '/no_think\nСделай краткое резюме этого текста:\n\n' + text }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    stream: true
  };
}

function buildChatBody({ targetLang, question, context }) {
  const history = (context.history || [])
    .map((message) => `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`)
    .join('\n\n');
  const originalBlock = context.sourceType === 'text' && context.originalText
    ? `Original selected text:\n${context.originalText}\n\n`
    : '';

  return {
    model: 'qwen/qwen3.5-9b',
    messages: [
      {
        role: 'system',
        content: `Ты продолжаешь работу с контекстом пользователя и отвечаешь на ${targetLang}.
Отвечай только на вопрос пользователя, учитывая исходный контент и предыдущий ответ.
Если исходный контент был картинкой, работай только с уже полученным текстовым результатом, не выдумывай детали изображения.
Не добавляй факты, которых нет в контексте, если пользователь прямо не просит творчески переформулировать.`
      },
      {
        role: 'user',
        content: `/no_think
${originalBlock}Initial action: ${context.action}
Previous assistant answer:
${context.lastAnswer || 'No previous answer.'}

Conversation so far:
${history || 'No previous follow-up messages.'}

User question:
${question}`
      }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    stream: true
  };
}

function buildImageTranslationBody({ targetLang, imageUrl }) {
  return {
    model: 'qwen/qwen3.5-9b',
    messages: [
      {
        role: 'system',
        content: `You translate visible text from images to ${targetLang}. Return only the translation, no explanations, no quotes.`
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: '/no_think\nTranslate the visible text in this image.' },
          { type: 'image_url', image_url: { url: imageUrl } }
        ]
      }
    ],
    temperature: 0.3,
    max_tokens: 2000,
    stream: true
  };
}

async function postImageChatCompletion({ lmPort, targetLang, imageUrl }) {
  const payloads = await imageUrlToPayloads(imageUrl);
  let lastError = null;

  for (const payload of payloads) {
    try {
      return await postChatCompletion({
        lmPort,
        body: buildImageTranslationBody({ targetLang, imageUrl: payload })
      });
    } catch (err) {
      lastError = err;
      if (!/HTTP 400|Invalid url|base64 encoded image/i.test(err.message)) {
        throw err;
      }
    }
  }

  throw lastError;
}

function safePostMessage(port, message) {
  try {
    port.postMessage(message);
    return true;
  } catch (err) {
    console.warn('[Translator] unable to post message:', err.message);
    return false;
  }
}

async function streamCompletion({ port, response }) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let chunkCount = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data: ')) continue;
      const data = trimmed.slice(6);
      if (data === '[DONE]') {
        safePostMessage(port, { action: 'done' });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta;
        console.log('[BG] delta:', JSON.stringify(delta));
        const chunk = delta?.content; // reasoning_content = thinking mode, ignore it
        if (chunk) {
          chunkCount++;
          console.log('[BG] chunk #' + chunkCount + ':', chunk);
          if (!safePostMessage(port, { action: 'chunk', text: chunk })) return;
        }
      } catch (e) { /* skip malformed SSE line */ }
    }
  }

  safePostMessage(port, { action: 'done' });
}

// Long-lived port connection for streaming translation back to content script
chrome.runtime.onConnect.addListener((port) => {
  console.log('[Translator BG] onConnect:', port.name);
  if (port.name !== 'translator') return;

  port.onMessage.addListener(async (request) => {
    if (
      request.action !== 'translate'
      && request.action !== 'explain'
      && request.action !== 'summarize'
      && request.action !== 'chat'
      && request.action !== 'translateImage'
    ) return;

    const { text, imageUrl, question, context, lmPort, targetLang } = request;

    try {
      let res;

      if (request.action === 'translateImage') {
        res = await postImageChatCompletion({ lmPort, targetLang, imageUrl });
      } else if (request.action === 'explain') {
        res = await postChatCompletion({
          lmPort,
          body: buildExplainBody({ targetLang, text })
        });
      } else if (request.action === 'summarize') {
        res = await postChatCompletion({
          lmPort,
          body: buildSummarizeBody({ targetLang, text })
        });
      } else if (request.action === 'chat') {
        res = await postChatCompletion({
          lmPort,
          body: buildChatBody({ targetLang, question, context })
        });
      } else {
        res = await postChatCompletion({
          lmPort,
          body: buildTranslationBody({ targetLang, text })
        });
      }

      await streamCompletion({ port, response: res });
    } catch (err) {
      console.error('[Translator] error:', err.message);
      safePostMessage(port, { action: 'error', error: normalizeErrorMessage(err) });
    }
  });
});
