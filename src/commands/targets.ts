/**
 * Targets Command
 * Select accounts to monitor from your following list
 */

import { loadConfig, setConfigValue, getConfigValue } from '../utils/config';
import { header, success, error, info, dim } from '../utils/output';
import { fetchMe, fetchFollowing } from '../core/twitter';
import { COLORS, BEARER_TOKEN } from '../utils/constants';

interface TwitterAuth {
  auth_token: string;
  ct0: string;
  bearer_token: string;
}

function getAuth(): TwitterAuth | null {
  const config = loadConfig();
  if (!config.twitter?.auth_token || !config.twitter?.ct0) {
    return null;
  }
  return {
    auth_token: config.twitter.auth_token,
    ct0: config.twitter.ct0,
    bearer_token: BEARER_TOKEN
  };
}

export async function targetsCommand(action: string, args?: string[]): Promise<void> {
  switch (action) {
    case 'list':
      await listTargets();
      break;
    case 'add':
      if (args && args.length > 0) {
        await addTargets(args);
      } else {
        error('Usage: trench targets add <handle1> <handle2> ...');
      }
      break;
    case 'remove':
      if (args && args.length > 0) {
        await removeTargets(args);
      } else {
        error('Usage: trench targets remove <handle1> <handle2> ...');
      }
      break;
    case 'import':
      await importFromFollowing();
      break;
    default:
      error(`Unknown action: ${action}`);
      info('Usage: trench targets [list|add|remove|import]');
  }
}

async function listTargets(): Promise<void> {
  header('Target Accounts');

  const targets = getConfigValue('targets') as string[] || [];

  if (targets.length === 0) {
    info('No targets configured yet.');
    info('Run: trench targets import  - to import from your following list');
    info('Run: trench targets add <handle>  - to add manually');
    return;
  }

  console.log();
  for (const handle of targets) {
    console.log(`  ${COLORS.cyan}@${handle}${COLORS.reset}`);
  }
  console.log();
  info(`${targets.length} target(s) configured`);
}

async function addTargets(handles: string[]): Promise<void> {
  const existing = (getConfigValue('targets') as string[]) || [];
  const cleaned = handles.map(h => h.replace('@', '').toLowerCase());

  const newTargets = [...new Set([...existing, ...cleaned])];
  setConfigValue('targets', newTargets);

  const added = cleaned.filter(h => !existing.includes(h));
  if (added.length > 0) {
    success(`Added ${added.length} target(s): ${added.map(h => '@' + h).join(', ')}`);
  } else {
    info('All handles were already in targets');
  }
}

async function removeTargets(handles: string[]): Promise<void> {
  const existing = (getConfigValue('targets') as string[]) || [];
  const cleaned = handles.map(h => h.replace('@', '').toLowerCase());

  const newTargets = existing.filter(h => !cleaned.includes(h.toLowerCase()));
  setConfigValue('targets', newTargets);

  const removed = existing.length - newTargets.length;
  if (removed > 0) {
    success(`Removed ${removed} target(s)`);
  } else {
    info('None of the handles were in targets');
  }
}

async function importFromFollowing(): Promise<void> {
  header('Import Targets from Following');

  const auth = getAuth();
  if (!auth) {
    error('Not authenticated. Run: trench auth');
    process.exit(1);
  }

  // Try to fetch profile, fall back to asking user
  info('Fetching your profile...');

  let me;
  try {
    me = await fetchMe(auth);
    success(`Logged in as @${me.username}`);
  } catch (e) {
    // API might be restricted on new accounts - ask for username
    console.log();
    console.log(`${COLORS.yellow}Could not auto-detect your username (new account restrictions).${COLORS.reset}`);
    console.log(`${COLORS.dim}Enter your Twitter username to continue:${COLORS.reset}`);
    process.stdout.write('> @');

    const username = await readLine();
    if (!username) {
      error('Username required');
      process.exit(1);
    }

    // Fetch user ID by screen name
    try {
      const userVariables = { screen_name: username.replace('@', '') };
      const userFeatures = {
        hidden_profile_subscriptions_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        creator_subscriptions_tweet_preview_api_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true
      };

      const url = `https://x.com/i/api/graphql/${(await import('../core/query-ids')).getQueryId('UserByScreenName')}/UserByScreenName?variables=${encodeURIComponent(JSON.stringify(userVariables))}&features=${encodeURIComponent(JSON.stringify(userFeatures))}`;

      const headers = {
        'authorization': `Bearer ${auth.bearer_token}`,
        'cookie': `auth_token=${auth.auth_token}; ct0=${auth.ct0}`,
        'x-csrf-token': auth.ct0,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'accept': '*/*',
        'origin': 'https://x.com',
        'referer': 'https://x.com/',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      };

      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const result = data.data?.user?.result;

      if (!result?.rest_id) {
        throw new Error('User not found');
      }

      me = {
        id: result.rest_id,
        username: username.replace('@', ''),
        name: result.legacy?.name || username
      };

      success(`Found user @${me.username}`);
    } catch (e2) {
      error(`Failed to look up user: ${e2}`);
      console.log();
      info('This Twitter account appears to have API restrictions.');
      info('New accounts often cannot access the API until they are more established.');
      console.log();
      info('Workaround: Add targets manually instead:');
      console.log(`  ${COLORS.cyan}trench targets add karpathy swyx AnthropicAI${COLORS.reset}`);
      process.exit(1);
    }
  }

  info('Fetching following list...');

  let following;
  try {
    following = await fetchFollowing(me.id, auth, 100);
  } catch (e) {
    error(`Failed to fetch following: ${e}`);
    process.exit(1);
  }

  if (following.length === 0) {
    info('No accounts found in following list.');
    return;
  }

  console.log();
  console.log(`${COLORS.bold}Found ${following.length} accounts:${COLORS.reset}`);
  console.log();

  // Display with numbers for selection
  for (let i = 0; i < following.length; i++) {
    const user = following[i];
    const verified = user.verified ? ` ${COLORS.blue}✓${COLORS.reset}` : '';
    const followers = user.followers_count ? ` ${COLORS.dim}(${formatNumber(user.followers_count)} followers)${COLORS.reset}` : '';
    console.log(`  ${COLORS.dim}${String(i + 1).padStart(2)}.${COLORS.reset} ${COLORS.cyan}@${user.username}${COLORS.reset}${verified}${followers}`);
    if (user.description) {
      console.log(`      ${COLORS.dim}${truncate(user.description, 60)}${COLORS.reset}`);
    }
  }

  console.log();
  console.log(`${COLORS.yellow}Enter numbers to add as targets (comma-separated), or 'all' for all:${COLORS.reset}`);
  console.log(`${COLORS.dim}Example: 1,3,5-10 or all${COLORS.reset}`);

  // Read user input
  process.stdout.write('> ');

  const input = await readLine();

  if (!input || input.trim() === '') {
    info('Cancelled');
    return;
  }

  const selectedIndices = parseSelection(input, following.length);

  if (selectedIndices.length === 0) {
    info('No valid selection');
    return;
  }

  const selectedHandles = selectedIndices.map(i => following[i].username);

  // Add to targets
  const existing = (getConfigValue('targets') as string[]) || [];
  const newTargets = [...new Set([...existing, ...selectedHandles])];
  setConfigValue('targets', newTargets);

  const added = selectedHandles.filter(h => !existing.includes(h));
  success(`Added ${added.length} target(s)`);

  console.log();
  info(`Total targets: ${newTargets.length}`);
  info('Run: trench scan  - to start monitoring');
}

function parseSelection(input: string, max: number): number[] {
  const trimmed = input.trim().toLowerCase();

  if (trimmed === 'all') {
    return Array.from({ length: max }, (_, i) => i);
  }

  const indices: Set<number> = new Set();

  const parts = trimmed.split(',').map(p => p.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      // Range: 5-10
      const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = Math.max(1, start); i <= Math.min(max, end); i++) {
          indices.add(i - 1); // Convert to 0-indexed
        }
      }
    } else {
      // Single number
      const num = parseInt(part, 10);
      if (!isNaN(num) && num >= 1 && num <= max) {
        indices.add(num - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function truncate(str: string, len: number): string {
  const cleaned = str.replace(/\n/g, ' ').trim();
  if (cleaned.length <= len) return cleaned;
  return cleaned.slice(0, len - 3) + '...';
}

async function readLine(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';

    process.stdin.setEncoding('utf8');
    process.stdin.once('data', (chunk) => {
      data = chunk.toString().trim();
      resolve(data);
    });

    // Handle if stdin is not interactive
    if (!process.stdin.isTTY) {
      resolve('');
    }
  });
}
