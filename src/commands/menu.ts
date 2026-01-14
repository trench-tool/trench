/**
 * Interactive Menu
 * Main entry point when running `trench` without arguments
 */

import { createInterface } from 'readline';
import { loadConfig } from '../utils/config';
import { COLORS, BANNER } from '../utils/constants';

const MENU_OPTIONS = [
  { key: '1', label: 'Generate reply', desc: 'Reply to a tweet or text', cmd: 'reply' },
  { key: '2', label: 'Scan targets', desc: 'Monitor accounts for new tweets', cmd: 'scan' },
  { key: '3', label: 'Start server', desc: 'Run server for browser extension', cmd: 'serve' },
  { key: '4', label: 'Manage targets', desc: 'Add/remove monitored accounts', cmd: 'targets' },
  { key: '5', label: 'Personas', desc: 'View or create personas', cmd: 'persona' },
  { key: '6', label: 'Settings', desc: 'View or change config', cmd: 'config' },
  { key: '0', label: 'Setup wizard', desc: 'First-time setup or reconfigure', cmd: 'init' },
];

export async function menuCommand(): Promise<void> {
  // Main loop
  while (true) {
    console.clear();
    console.log(BANNER);
    console.log();

    // Status check
    const config = loadConfig();
    const hasApi = !!config.anthropic_api_key;
    const hasTwitter = !!(config.twitter?.auth_token && config.twitter?.ct0);
    const hasTargets = config.scan?.targets?.length > 0;

    // Status line
    console.log(`${COLORS.dim}Status:${COLORS.reset}`);
    console.log(`  API:     ${hasApi ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.red}✗${COLORS.reset} run ${COLORS.cyan}trench init${COLORS.reset}`}`);
    console.log(`  Twitter: ${hasTwitter ? `${COLORS.green}✓${COLORS.reset}` : `${COLORS.yellow}○${COLORS.reset} optional`}`);
    console.log(`  Targets: ${hasTargets ? `${COLORS.green}${config.scan.targets.length} accounts${COLORS.reset}` : `${COLORS.dim}none${COLORS.reset}`}`);
    console.log();

    // Menu
    console.log(`${COLORS.orange}What do you want to do?${COLORS.reset}`);
    console.log();

    for (const opt of MENU_OPTIONS) {
      const keyStyle = opt.key === '0' ? COLORS.dim : COLORS.cyan;
      console.log(`  ${keyStyle}[${opt.key}]${COLORS.reset} ${opt.label}`);
    }

    console.log();
    console.log(`  ${COLORS.dim}[q] Quit${COLORS.reset}`);
    console.log();

    // Single keypress
    const choice = await getKeypress();

    if (choice === 'q' || choice === '\x03') { // q or Ctrl+C
      console.log();
      break;
    }

    const selected = MENU_OPTIONS.find(o => o.key === choice);
    if (!selected) {
      continue; // Invalid, just redraw menu
    }

    // Execute command
    console.clear();

    try {
      switch (selected.cmd) {
        case 'reply':
          await handleReply();
          break;
        case 'scan':
          const { scanCommand } = await import('./scan');
          await scanCommand({ once: true }); // Once, then return
          break;
        case 'serve':
          const { serveCommand } = await import('./serve');
          await serveCommand({});
          break;
        case 'targets':
          const { targetsCommand } = await import('./targets');
          await targetsCommand('list');
          break;
        case 'persona':
          const { personaCommand } = await import('./persona');
          await personaCommand('list');
          break;
        case 'config':
          const { configCommand } = await import('./config');
          await configCommand('show');
          break;
        case 'init':
          const { initCommand } = await import('./init');
          await initCommand();
          break;
      }
    } catch (err) {
      console.error(`${COLORS.red}Error: ${err}${COLORS.reset}`);
    }

    // Wait for keypress before returning to menu
    if (selected.cmd !== 'serve') {
      console.log();
      console.log(`${COLORS.dim}Press any key to continue...${COLORS.reset}`);
      await getKeypress();
    }
  }
}

async function getKeypress(): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const onData = (key: string) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      resolve(key);
    };

    stdin.once('data', onData);
  });
}

async function handleReply(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const text = await new Promise<string>((resolve) => {
    rl.question(`${COLORS.cyan}Paste tweet or text:${COLORS.reset} `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

  if (!text) {
    console.log(`${COLORS.dim}Cancelled${COLORS.reset}`);
    return;
  }

  const { replyCommand } = await import('./reply');
  await replyCommand(text, {});
}
