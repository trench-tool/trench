#!/usr/bin/env bun

/**
 * Trench CLI
 * AI-powered social media reply generator
 * Authentic AI replies.
 */

import { Command } from 'commander';
import { initCommand } from './commands/init';
import { authCommand } from './commands/auth';
import { serveCommand } from './commands/serve';
import { scanCommand } from './commands/scan';
import { replyCommand } from './commands/reply';
import { personaCommand } from './commands/persona';
import { configCommand } from './commands/config';
import { extensionCommand } from './commands/extension';
import { targetsCommand } from './commands/targets';
import { menuCommand } from './commands/menu';
import { VERSION, BANNER, COLORS } from './utils/constants';

// If no args, show interactive menu
if (process.argv.length === 2) {
  menuCommand().catch(console.error);
} else {
  runCLI();
}

function runCLI() {
const program = new Command();

program
  .name('trench')
  .description('AI-powered social media reply generator. Authentic AI replies.')
  .version(VERSION)
  .addHelpText('before', BANNER + '\n')
  .addHelpText('after', `
${COLORS.orange}Examples:${COLORS.reset}
  ${COLORS.dim}# Generate reply for text${COLORS.reset}
  trench reply "Hot take: AI agents are just prompt chains"

  ${COLORS.dim}# Quick reply from URL${COLORS.reset}
  trench reply https://x.com/user/status/123

  ${COLORS.dim}# Scan targets (dry-run for testing)${COLORS.reset}
  trench scan --dry-run

  ${COLORS.dim}# Unhinged mode${COLORS.reset}
  trench yolo "Just shipped our v2!"

  ${COLORS.dim}# Start extension server${COLORS.reset}
  trench serve

${COLORS.orange}Quick Start:${COLORS.reset}
  1. ${COLORS.cyan}trench init${COLORS.reset}     Setup API keys
  2. ${COLORS.cyan}trench${COLORS.reset}          Interactive menu
  3. ${COLORS.cyan}trench reply${COLORS.reset}    Generate a reply
`);

// Core commands
program
  .command('init')
  .description('First-time setup wizard')
  .action(initCommand);

program
  .command('auth')
  .description('Auto-extract Twitter cookies from your browser')
  .action(authCommand);

program
  .command('serve')
  .description('Start server for browser extension')
  .option('-p, --port <port>', 'Port to run server on', '3000')
  .action(serveCommand);

program
  .command('scan')
  .description('Scan Twitter targets for new tweets')
  .option('--once', 'Run once and exit')
  .option('-t, --targets <handles>', 'Comma-separated Twitter handles')
  .option('--dry-run', 'Use mock data, no actual posting (for testing)')
  .action(scanCommand);

program
  .command('reply <url>')
  .description('Generate a reply for a specific tweet/post URL')
  .option('-p, --persona <name>', 'Persona to use')
  .option('-n, --count <number>', 'Number of options to generate', '3')
  .action(replyCommand);

// Persona management
const persona = program
  .command('persona')
  .description('Manage personas');

persona
  .command('list')
  .description('List available personas')
  .action(() => personaCommand('list'));

persona
  .command('new <name>')
  .description('Create a new persona')
  .action((name: string) => personaCommand('new', name));

persona
  .command('edit <name>')
  .description('Edit an existing persona')
  .action((name: string) => personaCommand('edit', name));

// Config management
const config = program
  .command('config')
  .description('Manage configuration');

config
  .command('set <key> <value>')
  .description('Set a config value')
  .action((key: string, value: string) => configCommand('set', key, value));

config
  .command('get <key>')
  .description('Get a config value')
  .action((key: string) => configCommand('get', key));

config
  .command('show')
  .description('Show all config (redacted)')
  .action(() => configCommand('show'));

// Extension
program
  .command('extension')
  .description('Export browser extension files to ./trench-extension/')
  .action(extensionCommand);

// Targets management
const targets = program
  .command('targets')
  .description('Manage accounts to monitor');

targets
  .command('list')
  .description('List target accounts')
  .action(() => targetsCommand('list'));

targets
  .command('add <handles...>')
  .description('Add accounts to monitor')
  .action((handles: string[]) => targetsCommand('add', handles));

targets
  .command('remove <handles...>')
  .description('Remove accounts from targets')
  .action((handles: string[]) => targetsCommand('remove', handles));

targets
  .command('import')
  .description('Import from your following list (interactive)')
  .action(() => targetsCommand('import'));

// Easter eggs
program
  .command('yolo <url>')
  .description('Generate maximally unhinged reply')
  .action(async (url: string) => {
    const { replyCommand } = await import('./commands/reply');
    await replyCommand(url, { persona: 'chaos-goblin', count: '1' });
  });

program
  .command('explain <url>')
  .description('Break down why a tweet went viral')
  .action(async (url: string) => {
    const { explainCommand } = await import('./commands/explain');
    await explainCommand(url);
  });

// Parse and execute
program.parse();
}
