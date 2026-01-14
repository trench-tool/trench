/**
 * Init Command
 * First-time setup wizard with premium UX
 */

import { createInterface } from 'readline';
import { existsSync, copyFileSync, readdirSync, mkdirSync } from 'fs';
import {
  ensureConfigDir,
  configExists,
  loadConfig,
  saveConfig,
  TrenchConfig
} from '../utils/config';
import {
  CONFIG_DIR,
  PERSONAS_DIR,
  BUNDLED_PERSONAS_DIR,
  COLORS,
  BANNER
} from '../utils/constants';
import { header, success, error, warn, info, dim, Spinner } from '../utils/output';
import { extractTwitterCookies, listAvailableBrowsers } from '../core/cookies';
import { fetchTweet } from '../core/twitter';
import { BEARER_TOKEN } from '../utils/constants';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Parse cookies from user-pasted string
 * Accepts formats like: auth_token=xxx;ct0=yyy or just the raw values
 */
function parseCookieString(input: string): { auth_token?: string; ct0?: string } {
  const result: { auth_token?: string; ct0?: string } = {};

  // Try to extract auth_token
  const authMatch = input.match(/auth_token[=:]\s*([a-f0-9]+)/i);
  if (authMatch) result.auth_token = authMatch[1];

  // Try to extract ct0
  const ct0Match = input.match(/ct0[=:]\s*([a-f0-9]+)/i);
  if (ct0Match) result.ct0 = ct0Match[1];

  return result;
}

/**
 * Show cookie extraction instructions
 */
function showCookieInstructions(): void {
  const snippet = `(()=>{let c=document.cookie,a=c.match(/auth_token=([^;]+)/),t=c.match(/ct0=([^;]+)/);if(a&&t)prompt('Copy these tokens:','auth_token='+a[1]+';ct0='+t[1]);else alert('Not logged in!')})()`;

  console.log(`
${COLORS.bold}Twitter Cookie Extraction${COLORS.reset}

${COLORS.cyan}1.${COLORS.reset} Go to ${COLORS.blue}https://x.com${COLORS.reset} and log in

${COLORS.cyan}2.${COLORS.reset} Open DevTools (${COLORS.dim}Cmd+Option+J on Mac, F12 on Windows${COLORS.reset})

${COLORS.cyan}3.${COLORS.reset} Paste this in the Console and press Enter:

${COLORS.orange}───────────────────────────────────────────${COLORS.reset}
${snippet}
${COLORS.orange}───────────────────────────────────────────${COLORS.reset}

${COLORS.cyan}4.${COLORS.reset} A prompt will appear - copy the text and paste below

`);
}

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
};

const askSecret = (question: string): Promise<string> => {
  return new Promise((resolve) => {
    process.stdout.write(question);

    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;

    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }

    let input = '';

    const onData = (char: Buffer) => {
      const c = char.toString();

      if (c === '\n' || c === '\r') {
        stdin.removeListener('data', onData);
        if (stdin.isTTY) {
          stdin.setRawMode(wasRaw ?? false);
        }
        console.log('');
        resolve(input);
      } else if (c === '\u007f' || c === '\b') {
        // Backspace
        if (input.length > 0) {
          input = input.slice(0, -1);
          process.stdout.write('\b \b');
        }
      } else if (c === '\u0003') {
        // Ctrl+C
        process.exit(0);
      } else {
        input += c;
        process.stdout.write('*');
      }
    };

    stdin.on('data', onData);
    stdin.resume();
  });
};

export async function initCommand(): Promise<void> {
  console.log(BANNER);

  if (configExists()) {
    warn('Config already exists at ' + CONFIG_DIR);
    const overwrite = await ask(`${COLORS.yellow}Overwrite? (y/N):${COLORS.reset} `);
    if (overwrite.toLowerCase() !== 'y') {
      info('Keeping existing config.');
      rl.close();
      return;
    }
  }

  header('Welcome to Trench');
  dim('Authentic AI replies.\n');
  console.log("Let's get you set up.\n");

  // Ensure directories exist
  ensureConfigDir();

  const config = loadConfig();

  // Step 1: Anthropic API Key
  console.log(`${COLORS.bold}Step 1/3: Anthropic API Key${COLORS.reset}`);
  dim('Get yours at: https://console.anthropic.com/settings/keys\n');

  const apiKey = await askSecret(`${COLORS.cyan}API Key:${COLORS.reset} `);

  if (apiKey && apiKey.startsWith('sk-ant-')) {
    config.anthropic_api_key = apiKey;
    success('API key saved');
  } else if (apiKey) {
    warn("That doesn't look like an Anthropic key (should start with sk-ant-)");
    config.anthropic_api_key = apiKey;
    warn('Saved anyway. Fix later with: trench config set anthropic_api_key <key>');
  } else {
    warn('Skipped. Add later with: trench config set anthropic_api_key <key>');
  }

  console.log('');

  // Step 2: Twitter (Optional)
  console.log(`${COLORS.bold}Step 2/3: Twitter Integration (Optional)${COLORS.reset}`);
  dim('Required for scan/reply commands. Skip if only using browser extension.\n');

  const setupTwitter = await ask(`${COLORS.cyan}Set up Twitter? (Y/n):${COLORS.reset} `);

  if (setupTwitter.toLowerCase() !== 'n') {
    // Try auto-extraction first
    const browsers = listAvailableBrowsers();

    if (browsers.length > 0) {
      dim(`Found browsers: ${browsers.join(', ')}`);
      console.log('');

      const spinner = new Spinner('Scanning for Twitter session...');
      spinner.start();

      const result = await extractTwitterCookies();
      spinner.stop();

      if (result) {
        // Auto-extraction succeeded!
        success(`Found Twitter session in ${result.source}`);
        config.twitter.auth_token = result.cookies.auth_token || '';
        config.twitter.ct0 = result.cookies.ct0 || '';

        // Show masked tokens
        const mask = (t: string) => t.length > 8 ? t.slice(0, 4) + '...' + t.slice(-4) : '****';
        dim(`  auth_token: ${mask(config.twitter.auth_token)}`);
        dim(`  ct0: ${mask(config.twitter.ct0)}`);
      } else {
        // Auto-extraction failed - offer manual option
        console.log('');
        warn('No Twitter session found in browsers');
        console.log('');

        const tryManual = await ask(`${COLORS.cyan}Enter cookies manually? (y/N):${COLORS.reset} `);

        if (tryManual.toLowerCase() === 'y') {
          showCookieInstructions();

          try {
            Bun.spawn(['open', 'https://x.com']);
          } catch {}

          const pastedCookies = await ask(`${COLORS.cyan}Paste cookies here:${COLORS.reset} `);

          if (pastedCookies) {
            const cookies = parseCookieString(pastedCookies);

            if (cookies.auth_token && cookies.ct0) {
              config.twitter.auth_token = cookies.auth_token;
              config.twitter.ct0 = cookies.ct0;
              success('Cookies saved');
            } else {
              warn('Could not parse. Run `trench auth` later to try again.');
            }
          }
        } else {
          info('Skipped. Run `trench auth` later to set up Twitter.');
        }
      }
    } else {
      // No browsers found - manual only
      warn('No supported browsers found for auto-extraction');
      showCookieInstructions();

      const pastedCookies = await ask(`${COLORS.cyan}Paste cookies (or press Enter to skip):${COLORS.reset} `);

      if (pastedCookies) {
        const cookies = parseCookieString(pastedCookies);
        if (cookies.auth_token && cookies.ct0) {
          config.twitter.auth_token = cookies.auth_token;
          config.twitter.ct0 = cookies.ct0;
          success('Cookies saved');
        }
      }
    }

    // Targets - only if we have Twitter auth
    if (config.twitter.auth_token && config.twitter.ct0) {
      console.log('');
      dim('Enter Twitter handles to monitor (comma-separated)');
      dim('Example: karpathy,swyx,AnthropicAI');
      dim('Or run `trench targets import` later to pick from your following list.\n');

      const targets = await ask(`${COLORS.cyan}Targets:${COLORS.reset} `);
      if (targets) {
        config.scan.targets = targets.split(',').map(t => t.trim().replace('@', ''));
        success(`Added ${config.scan.targets.length} target(s)`);
      }
    }
  } else {
    info('Skipped Twitter setup. Run `trench auth` later to add it.');
  }

  console.log('');

  // Step 3: Default Persona
  console.log(`${COLORS.bold}Step 3/3: Default Persona${COLORS.reset}`);
  dim('Choose your default voice for replies.\n');

  const personas = [
    { name: 'whisperer', desc: 'Technical thought leader - grounded, insightful' },
    { name: 'pifre', desc: 'Authentic personal voice - raw, honest' },
    { name: 'provocateur', desc: 'Edgy challenger - contrarian, spicy' },
    { name: 'professional', desc: 'Corporate-safe - polished, diplomatic' }
  ];

  for (let i = 0; i < personas.length; i++) {
    console.log(`  ${COLORS.orange}[${i + 1}]${COLORS.reset} ${personas[i].name} - ${COLORS.dim}${personas[i].desc}${COLORS.reset}`);
  }
  console.log('');

  const personaChoice = await ask(`${COLORS.cyan}Choose (1-4) [1]:${COLORS.reset} `);
  const idx = parseInt(personaChoice) - 1;

  if (idx >= 0 && idx < personas.length) {
    config.defaults.persona = personas[idx].name;
    success(`Default persona: ${personas[idx].name}`);
  } else {
    config.defaults.persona = 'whisperer';
    success('Default persona: whisperer');
  }

  // Save config
  saveConfig(config);
  success(`Config saved to ${CONFIG_DIR}/config.json`);

  // Copy bundled personas
  console.log('');
  info('Installing personas...');

  try {
    if (!existsSync(PERSONAS_DIR)) {
      mkdirSync(PERSONAS_DIR, { recursive: true });
    }

    // Try to copy bundled personas
    if (existsSync(BUNDLED_PERSONAS_DIR)) {
      const files = readdirSync(BUNDLED_PERSONAS_DIR);
      for (const file of files) {
        if (file.endsWith('.md')) {
          const src = `${BUNDLED_PERSONAS_DIR}/${file}`;
          const dest = `${PERSONAS_DIR}/${file}`;
          if (!existsSync(dest)) {
            copyFileSync(src, dest);
          }
        }
      }
      success(`Personas installed to ${PERSONAS_DIR}`);
    } else {
      // Personas not bundled (dev mode) - copy from docs/personas
      const docsPersonas = '../../docs/personas';
      if (existsSync(docsPersonas)) {
        const files = readdirSync(docsPersonas);
        for (const file of files) {
          if (file.endsWith('.md')) {
            const src = `${docsPersonas}/${file}`;
            const dest = `${PERSONAS_DIR}/${file}`;
            if (!existsSync(dest)) {
              copyFileSync(src, dest);
            }
          }
        }
        success(`Personas installed to ${PERSONAS_DIR}`);
      } else {
        warn('Could not find bundled personas. Add manually to ' + PERSONAS_DIR);
      }
    }
  } catch (e) {
    warn('Could not copy personas: ' + (e as Error).message);
  }

  // Step 4: Verification
  console.log('');
  console.log(`${COLORS.bold}Verifying Setup${COLORS.reset}`);
  console.log('');

  let allPassed = true;

  // Test Anthropic API
  if (config.anthropic_api_key) {
    const spinner = new Spinner('Testing Anthropic API...');
    spinner.start();

    try {
      const client = new Anthropic({ apiKey: config.anthropic_api_key });
      await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say "ok"' }]
      });
      spinner.stop();
      success('Anthropic API: Connected');
    } catch (e: any) {
      spinner.stop();
      const msg = e.message || String(e);
      if (msg.includes('401') || msg.includes('invalid')) {
        error('Anthropic API: Invalid key');
        dim('  Fix with: trench config set anthropic_api_key <your-key>');
      } else if (msg.includes('rate') || msg.includes('429')) {
        warn('Anthropic API: Rate limited (but key is valid)');
      } else {
        error(`Anthropic API: ${msg.slice(0, 50)}`);
      }
      allPassed = false;
    }
  } else {
    warn('Anthropic API: Not configured');
    dim('  Add with: trench config set anthropic_api_key <your-key>');
    allPassed = false;
  }

  // Test Twitter API
  if (config.twitter.auth_token && config.twitter.ct0) {
    const spinner = new Spinner('Testing Twitter API...');
    spinner.start();

    try {
      // Try to fetch Anthropic's pinned tweet as a test
      const auth = {
        auth_token: config.twitter.auth_token,
        ct0: config.twitter.ct0,
        bearer_token: BEARER_TOKEN
      };
      await fetchTweet('https://x.com/AnthropicAI/status/1861169617498808645', auth);
      spinner.stop();
      success('Twitter API: Connected');
    } catch (e: any) {
      spinner.stop();
      const msg = e.message || String(e);
      if (msg.includes('restrictions') || msg.includes('unavailable')) {
        warn('Twitter API: Limited (new account restrictions)');
        dim('  Some features may not work. Use an established account for full access.');
      } else if (msg.includes('401') || msg.includes('403')) {
        error('Twitter API: Auth failed - cookies may be expired');
        dim('  Fix with: trench auth');
      } else {
        warn(`Twitter API: ${msg.slice(0, 60)}`);
      }
      // Don't mark as failed for restrictions - it's a known limitation
      if (!msg.includes('restrictions') && !msg.includes('unavailable')) {
        allPassed = false;
      }
    }
  } else {
    info('Twitter API: Not configured (optional)');
    dim('  Add with: trench auth');
  }

  // Done!
  console.log('');
  if (allPassed) {
    header('Setup Complete!');
  } else {
    header('Setup Complete (with warnings)');
    dim('Fix the issues above for full functionality.\n');
  }

  console.log(`${COLORS.dim}Next steps:${COLORS.reset}`);
  console.log(`  ${COLORS.cyan}trench targets import${COLORS.reset}  Pick accounts to monitor from your following`);
  console.log(`  ${COLORS.cyan}trench reply <url>${COLORS.reset}     Generate reply for a tweet`);
  console.log(`  ${COLORS.cyan}trench scan${COLORS.reset}            Monitor targets for new tweets`);
  console.log(`  ${COLORS.cyan}trench --help${COLORS.reset}          See all commands`);
  console.log('');

  rl.close();
}
