document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('persona-select');
  const streaming = document.getElementById('streaming-toggle');
  const btn = document.getElementById('save-btn');
  const msg = document.getElementById('status-msg');

  // Load saved settings
  chrome.storage.local.get(['persona', 'streaming'], (result) => {
    if (result.persona) select.value = result.persona;
    if (result.streaming !== undefined) streaming.checked = result.streaming;
  });

  // Save settings
  btn.addEventListener('click', () => {
    chrome.storage.local.set({
      persona: select.value,
      streaming: streaming.checked
    }, () => {
      msg.textContent = 'Saved!';
      setTimeout(() => { msg.textContent = ''; }, 2000);
    });
  });
});
