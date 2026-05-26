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

document.addEventListener('DOMContentLoaded', async () => {
  const portEl = document.getElementById('port');
  const targetLangEl = document.getElementById('targetLang');
  const saveEl = document.getElementById('save');
  const statusEl = document.getElementById('status');

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
});
