/**
 * Extension Command
 * Export browser extension files
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { header, success, info, warn } from '../utils/output';
import { COLORS } from '../utils/constants';

const EXTENSION_DIR = './trench-extension';

export async function extensionCommand(): Promise<void> {
  header('Export Browser Extension');

  if (existsSync(EXTENSION_DIR)) {
    warn(`Directory ${EXTENSION_DIR} already exists.`);
    info('Files will be overwritten.');
  } else {
    mkdirSync(EXTENSION_DIR, { recursive: true });
  }

  // Write manifest.json
  writeFileSync(
    join(EXTENSION_DIR, 'manifest.json'),
    JSON.stringify({
      manifest_version: 3,
      name: 'Trench',
      version: '1.0.0',
      description: 'AI-powered reply generator. Authentic AI replies.',
      permissions: ['activeTab', 'storage'],
      host_permissions: [
        'https://www.linkedin.com/*',
        'https://x.com/*',
        'https://twitter.com/*',
        'http://localhost:3000/*'
      ],
      action: {
        default_popup: 'popup.html',
        default_icon: {
          '16': 'icon16.png',
          '48': 'icon48.png',
          '128': 'icon128.png'
        }
      },
      content_scripts: [
        {
          matches: ['https://www.linkedin.com/*', 'https://x.com/*', 'https://twitter.com/*'],
          js: ['content.js'],
          css: ['styles.css']
        }
      ],
      icons: {
        '16': 'icon16.png',
        '48': 'icon48.png',
        '128': 'icon128.png'
      }
    }, null, 2)
  );
  success('Created manifest.json');

  // Write content.js
  writeFileSync(
    join(EXTENSION_DIR, 'content.js'),
    CONTENT_JS
  );
  success('Created content.js');

  // Write popup.html
  writeFileSync(
    join(EXTENSION_DIR, 'popup.html'),
    POPUP_HTML
  );
  success('Created popup.html');

  // Write popup.js
  writeFileSync(
    join(EXTENSION_DIR, 'popup.js'),
    POPUP_JS
  );
  success('Created popup.js');

  // Write styles.css
  writeFileSync(
    join(EXTENSION_DIR, 'styles.css'),
    STYLES_CSS
  );
  success('Created styles.css');

  console.log(`\n${COLORS.green}Extension exported to ${EXTENSION_DIR}/${COLORS.reset}`);
  console.log(`
${COLORS.dim}To install:
1. Open Chrome -> chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the ${EXTENSION_DIR} folder

Make sure trench serve is running on localhost:3000${COLORS.reset}
`);
}

const CONTENT_JS = `// Trench Extension - Content Script
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
`;

const POPUP_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 260px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(180deg, #0d1117 0%, #161b22 100%);
      color: #e5e7eb;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 4px;
      background: linear-gradient(135deg, #f97316, #fb923c);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      font-size: 11px;
      color: #6b7280;
      margin-bottom: 16px;
    }
    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: #9ca3af;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    select {
      width: 100%;
      padding: 10px 12px;
      background: #1e293b;
      color: #e5e7eb;
      border: 1px solid #374151;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 12px;
      cursor: pointer;
    }
    select:hover { border-color: #f97316; }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }
    .toggle-label {
      font-size: 13px;
      color: #d1d5db;
    }
    .toggle {
      position: relative;
      width: 44px;
      height: 24px;
    }
    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .toggle-slider {
      position: absolute;
      cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background: #374151;
      border-radius: 24px;
      transition: 0.3s;
    }
    .toggle-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: 0.3s;
    }
    input:checked + .toggle-slider {
      background: #f97316;
    }
    input:checked + .toggle-slider:before {
      transform: translateX(20px);
    }
    button {
      width: 100%;
      padding: 10px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.1s;
    }
    button:hover { transform: scale(1.02); }
    .status {
      font-size: 11px;
      color: #10b981;
      text-align: center;
      margin-top: 8px;
      min-height: 16px;
    }
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #374151;
      font-size: 10px;
      color: #6b7280;
      text-align: center;
    }
  </style>
</head>
<body>
  <h1>Trench</h1>
  <p class="tagline">Authentic AI replies</p>

  <label>Active Persona</label>
  <select id="persona-select">
    <option value="whisperer">Whisperer (Technical)</option>
    <option value="authentic">Authentic (Personal)</option>
    <option value="provocateur">Provocateur (Edgy)</option>
    <option value="professional">Professional (Safe)</option>
  </select>

  <div class="toggle-row">
    <span class="toggle-label">Streaming mode</span>
    <label class="toggle">
      <input type="checkbox" id="streaming-toggle" checked>
      <span class="toggle-slider"></span>
    </label>
  </div>

  <button id="save-btn">Save Settings</button>
  <p class="status" id="status-msg"></p>

  <div class="footer">
    Ensure trench serve is running
  </div>

  <script src="popup.js"></script>
</body>
</html>
`;

const POPUP_JS = `document.addEventListener('DOMContentLoaded', () => {
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
`;

const STYLES_CSS = `.trench-btn {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
}

.trench-btn:active {
  transform: scale(0.95) !important;
}
`;
