// Trench Extension - Content Script
console.log('Trench loaded');

let lastSelectedText = '';
document.addEventListener('selectionchange', () => {
  const sel = window.getSelection().toString();
  if (sel && sel.trim().length > 2) {
    lastSelectedText = sel;
  }
});

document.addEventListener('focusin', (e) => checkAndInject(e.target));
document.addEventListener('click', (e) => checkAndInject(e.target));

function checkAndInject(target) {
  // LinkedIn
  if (target.classList.contains('ql-editor') || target.getAttribute('role') === 'textbox') {
    injectButton(target, 'linkedin');
    return;
  }
  // Twitter
  const twitterEditor = target.closest('[data-testid="tweetTextarea_0"]');
  if (twitterEditor) {
    injectButton(twitterEditor, 'twitter');
  }
}

function injectButton(editor, platform) {
  if (platform === 'twitter') {
    const toolbar = editor.closest('[class*="group"]')?.querySelector('[data-testid="toolBar"]');
    if (!toolbar || toolbar.querySelector('.trench-btn')) return;

    const btn = createButton();
    toolbar.appendChild(btn);
    attachListener(btn, editor, platform);
  } else {
    if (editor.parentElement.querySelector('.trench-btn')) return;

    const btn = createButton();
    btn.style.position = 'absolute';
    btn.style.bottom = '5px';
    btn.style.right = '5px';
    btn.style.zIndex = '1000';
    editor.parentElement.style.position = 'relative';
    editor.parentElement.appendChild(btn);
    attachListener(btn, editor, platform);
  }
}

function createButton() {
  const btn = document.createElement('button');
  btn.className = 'trench-btn';
  btn.textContent = 'Generate';
  btn.style.cssText = 'background: linear-gradient(135deg, #f97316, #ea580c); color: white; border: none; padding: 4px 12px; border-radius: 9999px; font-weight: 600; font-size: 12px; cursor: pointer; transition: transform 0.1s, box-shadow 0.1s; box-shadow: 0 2px 4px rgba(0,0,0,0.2);';
  btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
  btn.onmouseout = () => btn.style.transform = 'scale(1)';
  return btn;
}

function attachListener(btn, editor, platform) {
  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    btn.textContent = '...';
    const postText = findPostText(editor, platform);

    if (!postText) {
      btn.textContent = 'No text';
      setTimeout(() => { btn.textContent = 'Generate'; }, 2000);
      return;
    }

    chrome.storage.local.get(['persona', 'streaming'], async (result) => {
      const persona = result.persona || 'whisperer';
      const streaming = result.streaming !== false;

      try {
        if (streaming) {
          const response = await fetch('http://localhost:3000/generate/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: postText, context: platform, persona })
          });

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let text = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value);
            insertText(editor, text, platform);
          }
        } else {
          const response = await fetch('http://localhost:3000/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: postText, context: platform, persona })
          });
          const data = await response.json();
          insertText(editor, data.reply, platform);
        }
        btn.textContent = 'Generate';
      } catch (err) {
        console.error('Trench error:', err);
        btn.textContent = 'Error';
        setTimeout(() => { btn.textContent = 'Generate'; }, 2000);
      }
    });
  });
}

function findPostText(element, platform) {
  if (lastSelectedText && lastSelectedText.length > 5) {
    return lastSelectedText;
  }

  if (platform === 'twitter') {
    const modal = element.closest('[role="dialog"]');
    if (modal) {
      const tweetText = modal.querySelector('[data-testid="tweetText"]');
      if (tweetText) return tweetText.innerText;
    }

    let current = element;
    while (current && current.tagName !== 'ARTICLE') {
      current = current.parentElement;
      if (!current || current.tagName === 'BODY') break;
    }

    if (current) {
      const text = current.querySelector('[data-testid="tweetText"]');
      if (text) return text.innerText;
    }

    return null;
  } else {
    const mainContainer = element.closest('.feed-shared-update-v2');
    const mainTextEl = mainContainer?.querySelector('.feed-shared-update-v2__description');
    return mainTextEl?.innerText || null;
  }
}

function insertText(editor, text, platform) {
  if (platform === 'twitter') {
    editor.focus();
    const dataTransfer = new DataTransfer();
    dataTransfer.setData('text/plain', text);
    const event = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true
    });
    editor.dispatchEvent(event);
  } else {
    const p = editor.querySelector('p');
    if (p) {
      p.textContent = text;
    } else {
      editor.textContent = text;
    }
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
