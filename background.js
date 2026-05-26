chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ port: '1234', targetLang: 'русский' });
});

// Long-lived port connection for streaming translation back to content script
chrome.runtime.onConnect.addListener((port) => {
  console.log('[Translator BG] onConnect:', port.name);
  if (port.name !== 'translator') return;

  port.onMessage.addListener(async (request) => {
    if (request.action !== 'translate') return;

    const { text, lmPort, targetLang } = request;

    try {
      const res = await fetch(`http://127.0.0.1:${lmPort}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const reader = res.body.getReader();
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
            port.postMessage({ action: 'done' });
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
              port.postMessage({ action: 'chunk', text: chunk });
            }
          } catch (e) { /* skip malformed SSE line */ }
        }
      }

      port.postMessage({ action: 'done' });
    } catch (err) {
      console.error('[Translator] error:', err.message);
      port.postMessage({ action: 'error', error: err.message });
    }
  });
});
