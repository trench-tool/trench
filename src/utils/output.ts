/**
 * Output Utilities
 * Pretty terminal output for Trench CLI
 */

import { COLORS } from './constants';

/**
 * Print styled header
 */
export function header(text: string): void {
  console.log(`\n${COLORS.orange}${COLORS.bold}${text}${COLORS.reset}\n`);
}

/**
 * Print success message
 */
export function success(text: string): void {
  console.log(`${COLORS.green}✓${COLORS.reset} ${text}`);
}

/**
 * Print error message
 */
export function error(text: string): void {
  console.log(`${COLORS.red}✗${COLORS.reset} ${text}`);
}

/**
 * Print warning message
 */
export function warn(text: string): void {
  console.log(`${COLORS.yellow}!${COLORS.reset} ${text}`);
}

/**
 * Print info message
 */
export function info(text: string): void {
  console.log(`${COLORS.cyan}→${COLORS.reset} ${text}`);
}

/**
 * Print dim text
 */
export function dim(text: string): void {
  console.log(`${COLORS.dim}${text}${COLORS.reset}`);
}

/**
 * Print a box around text
 */
export function box(title: string, content: string): void {
  const lines = content.split('\n');
  const maxLen = Math.max(title.length, ...lines.map(l => l.length));
  const width = maxLen + 4;

  const top = `┌${'─'.repeat(width)}┐`;
  const bottom = `└${'─'.repeat(width)}┘`;
  const titleLine = `│ ${COLORS.bold}${title.padEnd(maxLen)}${COLORS.reset}   │`;
  const divider = `├${'─'.repeat(width)}┤`;

  console.log(COLORS.dim + top + COLORS.reset);
  console.log(titleLine);
  console.log(COLORS.dim + divider + COLORS.reset);

  for (const line of lines) {
    console.log(`│ ${line.padEnd(maxLen)}   │`);
  }

  console.log(COLORS.dim + bottom + COLORS.reset);
}

/**
 * Print a progress bar
 */
export function progressBar(value: number, max: number = 100, width: number = 20): string {
  const percent = Math.min(1, value / max);
  const filled = Math.round(width * percent);
  const empty = width - filled;

  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const percentStr = `${Math.round(percent * 100)}%`;

  return `${bar} ${percentStr}`;
}

/**
 * Print authenticity score
 */
export function authenticityScore(score: number): void {
  let color = COLORS.green;
  if (score < 70) color = COLORS.yellow;
  if (score < 50) color = COLORS.red;

  console.log(`\n${COLORS.dim}Authenticity:${COLORS.reset} ${color}${progressBar(score)}${COLORS.reset}`);
}

/**
 * Print context window
 */
export function contextWindow(context: {
  tweet?: string;
  author?: string;
  tone?: string;
  thread?: number;
}): void {
  const lines = [];
  if (context.tweet) {
    const truncated = context.tweet.length > 50
      ? context.tweet.slice(0, 50) + '...'
      : context.tweet;
    lines.push(`Tweet: "${truncated}"`);
  }
  if (context.author) lines.push(`Author: @${context.author}`);
  if (context.tone) lines.push(`Tone: ${context.tone}`);
  if (context.thread) lines.push(`Thread: ${context.thread} replies`);

  box('CONTEXT', lines.join('\n'));
}

/**
 * Print reply options
 */
export function replyOptions(options: Array<{ label: string; text: string }>): void {
  console.log('');
  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    console.log(`${COLORS.orange}[${i + 1}]${COLORS.reset} ${COLORS.dim}${opt.label}:${COLORS.reset}`);
    console.log(`    "${opt.text}"`);
    console.log('');
  }
}

/**
 * Spinner for loading states
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  private interval: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    process.stdout.write(`${COLORS.cyan}${this.frames[0]}${COLORS.reset} ${this.message}`);
    this.interval = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length;
      process.stdout.write(`\r${COLORS.cyan}${this.frames[this.frameIndex]}${COLORS.reset} ${this.message}`);
    }, 80);
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r' + ' '.repeat(this.message.length + 4) + '\r');
    if (finalMessage) {
      console.log(finalMessage);
    }
  }

  update(message: string): void {
    this.message = message;
  }
}
