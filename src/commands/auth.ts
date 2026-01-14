/**
 * Auth Command
 * Automatically extract Twitter cookies from browsers
 */

import { extractTwitterCookies, listAvailableBrowsers } from '../core/cookies';
import { loadConfig, saveConfig } from '../utils/config';
import { header, success, error, warn, info, dim, Spinner } from '../utils/output';
import { COLORS } from '../utils/constants';

export async function authCommand(): Promise<void> {
  header('Twitter Authentication');
  console.log('');

  // Show available browsers
  const browsers = listAvailableBrowsers();
  if (browsers.length === 0) {
    error('No supported browsers found');
    console.log('');
    dim('Supported browsers: Chrome, Arc, Brave, Edge, Firefox, Safari');
    return;
  }

  dim(`Found browsers: ${browsers.join(', ')}`);
  console.log('');

  // Attempt extraction
  const spinner = new Spinner('Scanning for Twitter session...');
  spinner.start();

  const result = await extractTwitterCookies();

  spinner.stop();

  if (!result) {
    console.log('');
    error('No Twitter session found in any browser');
    console.log('');
    console.log(`${COLORS.dim}To fix this:${COLORS.reset}`);
    console.log(`  1. Open ${COLORS.cyan}https://x.com${COLORS.reset} in your browser`);
    console.log(`  2. Log in to your Twitter account`);
    console.log(`  3. Run ${COLORS.cyan}trench auth${COLORS.reset} again`);
    console.log('');
    return;
  }

  // Found cookies!
  success(`Found Twitter session in ${result.source}`);
  console.log('');

  // Mask the tokens for display
  const maskToken = (token: string) => {
    if (token.length <= 8) return '****';
    return token.slice(0, 4) + '...' + token.slice(-4);
  };

  dim(`auth_token: ${maskToken(result.cookies.auth_token || '')}`);
  dim(`ct0: ${maskToken(result.cookies.ct0 || '')}`);
  console.log('');

  // Save to config
  const config = loadConfig();
  config.twitter.auth_token = result.cookies.auth_token || '';
  config.twitter.ct0 = result.cookies.ct0 || '';
  saveConfig(config);

  success('Credentials saved to config');
  console.log('');

  console.log(`${COLORS.dim}Next steps:${COLORS.reset}`);
  console.log(`  ${COLORS.cyan}trench scan${COLORS.reset}       Monitor your targets`);
  console.log(`  ${COLORS.cyan}trench reply <url>${COLORS.reset} Reply to a tweet`);
  console.log('');
}

/**
 * Check if we have valid Twitter auth
 */
export async function checkAuth(): Promise<boolean> {
  const config = loadConfig();
  return !!(config.twitter.auth_token && config.twitter.ct0);
}

/**
 * Get current Twitter cookies from config
 */
export function getTwitterAuth(): { auth_token: string; ct0: string } | null {
  const config = loadConfig();
  if (config.twitter.auth_token && config.twitter.ct0) {
    return {
      auth_token: config.twitter.auth_token,
      ct0: config.twitter.ct0,
    };
  }
  return null;
}
