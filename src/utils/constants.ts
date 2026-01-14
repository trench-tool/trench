/**
 * Trench Constants
 */

import { homedir } from 'os';
import { join } from 'path';

export const VERSION = '1.0.0';

export const BANNER = `
  ████████╗██████╗ ███████╗███╗   ██╗ ██████╗██╗  ██╗
  ╚══██╔══╝██╔══██╗██╔════╝████╗  ██║██╔════╝██║  ██║
     ██║   ██████╔╝█████╗  ██╔██╗ ██║██║     ███████║
     ██║   ██╔══██╗██╔══╝  ██║╚██╗██║██║     ██╔══██║
     ██║   ██║  ██║███████╗██║ ╚████║╚██████╗██║  ██║
     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝
                                              v${VERSION}
  Authentic AI replies.

  Run 'trench init' to get started.
  Run 'trench --help' for all commands.
`;

// Paths
export const CONFIG_DIR = join(homedir(), '.config', 'trench');
export const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
export const PERSONAS_DIR = join(CONFIG_DIR, 'personas');
export const STATE_FILE = join(CONFIG_DIR, 'state.json');

// Bundled assets (relative to this file when compiled)
export const BUNDLED_PERSONAS_DIR = join(import.meta.dir, '..', '..', 'personas');
export const BUNDLED_EXTENSION_DIR = join(import.meta.dir, '..', '..', 'extension');

// Twitter bearer token (public, rotates rarely)
export const BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

// Default config
export const DEFAULT_CONFIG = {
  anthropic_api_key: '',
  twitter: {
    auth_token: '',
    ct0: '',
    bearer_token: BEARER_TOKEN
  },
  defaults: {
    persona: 'whisperer',
    port: 3000
  },
  scan: {
    targets: [],
    keywords: ['claude', 'agent', 'cursor', 'ai', 'llm']
  }
};

// Anti-slop banned words
export const BANNED_WORDS = [
  'revolutionary', 'game-changing', 'groundbreaking', 'cutting-edge',
  'leverage', 'synergy', 'paradigm', 'disrupt', 'innovative',
  'unlock', 'unleash', 'supercharge', 'turbocharge', 'skyrocket',
  'deep dive', 'circle back', 'move the needle', 'low-hanging fruit',
  'at the end of the day', 'think outside the box', 'best practices',
  'absolutely', 'definitely', 'literally', 'basically',
  'amazing', 'awesome', 'incredible', 'unbelievable',
  '🔥', '💯', '🚀', '🙌', '👏'
];

// Colors for terminal output
export const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',

  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',

  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',

  orange: '\x1b[38;5;208m' // Trench brand color
};
