/**
 * Scan Command
 * Monitor Twitter targets for new tweets
 */

import { createInterface } from 'readline';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { loadConfig } from '../utils/config';
import { loadPersona } from '../core/personas';
import { generateReply } from '../core/generator';
import { fetchUserTweets, postReply } from '../core/twitter';
import { header, success, error, info, warn, contextWindow, replyOptions, authenticityScore, Spinner } from '../utils/output';
import { COLORS, STATE_FILE } from '../utils/constants';

interface ScanOptions {
  once?: boolean;
  targets?: string;
  dryRun?: boolean;
}

// Mock tweets for dry-run testing
const MOCK_TWEETS: Record<string, { id: string; text: string; author: string }[]> = {
  'karpathy': [{
    id: '1878900000000000001',
    text: 'Just released a new video on transformers! The attention mechanism is beautiful once you understand it deeply. Thread on the key insights 🧵',
    author: 'karpathy'
  }],
  'swyx': [{
    id: '1878900000000000002',
    text: 'Hot take: Most \"AI agents\" are just glorified prompt chains. True agency requires persistent memory, tool use, AND the ability to know when to ask for help.',
    author: 'swyx'
  }],
  'AnthropicAI': [{
    id: '1878900000000000003',
    text: 'Introducing new safety research on constitutional AI methods. We found that training models to be helpful, harmless, and honest leads to better outcomes than pure RLHF.',
    author: 'AnthropicAI'
  }],
  '_default': [{
    id: '1878900000000000000',
    text: 'This is a test tweet for dry-run mode. The scan command is working correctly!',
    author: 'testuser'
  }]
};

interface ScanState {
  [handle: string]: string; // handle -> last seen tweet ID
}

function loadState(): ScanState {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
    }
  } catch {
    // Ignore
  }
  return {};
}

function saveState(state: ScanState): void {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export async function scanCommand(options: ScanOptions): Promise<void> {
  const config = loadConfig();

  if (!config.anthropic_api_key) {
    error('No Anthropic API key configured.');
    info('Run: trench init');
    process.exit(1);
  }

  if (!options.dryRun && (!config.twitter.auth_token || !config.twitter.ct0)) {
    error('Twitter authentication not configured.');
    info('Run: trench init (or use --dry-run for testing)');
    process.exit(1);
  }

  // Get targets
  const targets = options.targets
    ? options.targets.split(',').map(t => t.trim().replace('@', ''))
    : config.scan.targets;

  if (!targets || targets.length === 0) {
    error('No targets configured.');
    info('Add targets: trench config set scan.targets \'["user1","user2"]\'');
    process.exit(1);
  }

  header('Trench Scanner');
  if (options.dryRun) {
    console.log(`${COLORS.yellow}[DRY-RUN MODE]${COLORS.reset} Using mock data, no actual posting\n`);
  }
  console.log(`${COLORS.dim}Monitoring ${targets.length} target(s)${COLORS.reset}\n`);

  const state = loadState();
  const persona = loadPersona(config.defaults.persona);

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, resolve);
    });
  };

  // Process each target
  for (const target of targets) {
    console.log(`\n${COLORS.cyan}Scanning @${target}...${COLORS.reset}`);

    try {
      let tweets;

      if (options.dryRun) {
        // Use mock data
        tweets = MOCK_TWEETS[target.toLowerCase()] || MOCK_TWEETS['_default'];
        // Randomize the ID slightly so it looks "new" each run
        tweets = tweets.map(t => ({
          ...t,
          id: t.id.slice(0, -1) + Math.floor(Math.random() * 10),
          author: target
        }));
      } else {
        tweets = await fetchUserTweets(target, config.twitter, 1);
      }

      if (tweets.length === 0) {
        info('No tweets found');
        continue;
      }

      const tweet = tweets[0];

      // Check if we've already processed this tweet
      if (state[target] === tweet.id) {
        info('Already processed latest tweet');
        continue;
      }

      // New tweet found
      console.log(`\n${COLORS.green}New tweet from @${target}:${COLORS.reset}`);
      console.log(`${COLORS.dim}"${tweet.text.slice(0, 100)}${tweet.text.length > 100 ? '...' : ''}"${COLORS.reset}`);
      console.log(`${COLORS.blue}https://x.com/${target}/status/${tweet.id}${COLORS.reset}\n`);

      // Generate reply
      const spinner = new Spinner('Generating reply...');
      spinner.start();

      const result = await generateReply({
        content: tweet.text,
        platform: 'twitter',
        persona,
        apiKey: config.anthropic_api_key,
        count: 3
      });

      spinner.stop();

      // Show options
      if (result.options) {
        replyOptions(result.options);
      }

      authenticityScore(result.score);

      // Interactive decision
      const action = await ask(`\n${COLORS.cyan}[y]es / [n]o / [e]dit / [1-3] select:${COLORS.reset} `);
      const choice = action.trim().toLowerCase();

      if (choice === 'y' || choice === '') {
        // Post the best reply
        if (options.dryRun) {
          success('[DRY-RUN] Would post reply:');
          console.log(`  ${COLORS.dim}"${result.reply}"${COLORS.reset}`);
        } else {
          const postSpinner = new Spinner('Posting reply...');
          postSpinner.start();

          try {
            const postResult = await postReply(tweet.id, result.reply, config.twitter);
            postSpinner.stop();

            if (postResult.success) {
              success('Reply posted!');
              console.log(`${COLORS.blue}https://x.com/${target}/status/${postResult.tweetId}${COLORS.reset}`);
            } else {
              error('Failed to post reply');
            }
          } catch (e) {
            postSpinner.stop();
            error(`Post failed: ${e}`);
          }
        }

        // Update state
        state[target] = tweet.id;
        saveState(state);

      } else if (choice === 'e') {
        const customReply = await ask(`${COLORS.cyan}Your reply:${COLORS.reset} `);

        if (customReply.trim()) {
          if (options.dryRun) {
            success('[DRY-RUN] Would post custom reply:');
            console.log(`  ${COLORS.dim}"${customReply}"${COLORS.reset}`);
          } else {
            const postSpinner = new Spinner('Posting reply...');
            postSpinner.start();

            try {
              const postResult = await postReply(tweet.id, customReply, config.twitter);
              postSpinner.stop();

              if (postResult.success) {
                success('Reply posted!');
              } else {
                error('Failed to post');
              }
            } catch (e) {
              postSpinner.stop();
              error(`Post failed: ${e}`);
            }
          }
        }

        state[target] = tweet.id;
        saveState(state);

      } else if (['1', '2', '3'].includes(choice) && result.options) {
        const idx = parseInt(choice) - 1;
        const selectedReply = result.options[idx]?.text || result.reply;

        if (options.dryRun) {
          success('[DRY-RUN] Would post selected reply:');
          console.log(`  ${COLORS.dim}"${selectedReply}"${COLORS.reset}`);
        } else {
          const postSpinner = new Spinner('Posting reply...');
          postSpinner.start();

          try {
            const postResult = await postReply(tweet.id, selectedReply, config.twitter);
            postSpinner.stop();

            if (postResult.success) {
              success('Reply posted!');
            }
          } catch (e) {
            postSpinner.stop();
            error(`Post failed: ${e}`);
          }
        }

        state[target] = tweet.id;
        saveState(state);

      } else if (choice === 'n' || choice === 's') {
        info('Skipped');
        state[target] = tweet.id;
        saveState(state);
      }

    } catch (e) {
      error(`Error scanning @${target}: ${e}`);
    }
  }

  rl.close();

  if (!options.once) {
    console.log(`\n${COLORS.dim}Scan complete. Run again to check for new tweets.${COLORS.reset}`);
  }
}
