document.addEventListener('DOMContentLoaded', async () => {
  const settings = await chrome.storage.sync.get({ port: '1234', targetLang: 'русский' });
  document.getElementById('port').value = settings.port;
  document.getElementById('targetLang').value = settings.targetLang;

  document.getElementById('save').addEventListener('click', async () => {
    const port = document.getElementById('port').value || '1234';
    const targetLang = document.getElementById('targetLang').value;
    
    await chrome.storage.sync.set({ port, targetLang });
    
    const status = document.getElementById('status');
    status.classList.add('show');
    setTimeout(() => status.classList.remove('show'), 2000);
  });
});
