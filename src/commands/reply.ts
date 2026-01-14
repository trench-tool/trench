/**
 * Reply Command
 * Generate a reply for a specific URL
 */

import { createInterface } from 'readline';
import { loadConfig } from '../utils/config';
import { loadPersona, getChaosGoblin } from '../core/personas';
import { generateReply, generateReplyStream, calculateAuthenticityScore } from '../core/generator';
import { header, success, error, info, contextWindow, replyOptions, authenticityScore, Spinner } from '../utils/output';
import { COLORS } from '../utils/constants';
import { fetchTweet } from '../core/twitter';

interface ReplyOptions {
  persona?: string;
  count?: string;
}

export async function replyCommand(url: string, options: ReplyOptions): Promise<void> {
  const config = loadConfig();

  if (!config.anthropic_api_key) {
    error('No Anthropic API key configured.');
    info('Run: trench init');
    process.exit(1);
  }

  header('Generate Reply');

  // Parse URL to extract content
  let content: string;
  let author: string | undefined;
  let platform: 'twitter' | 'linkedin' | 'general' = 'general';

  if (url.includes('twitter.com') || url.includes('x.com')) {
    platform = 'twitter';
    const spinner = new Spinner('Fetching tweet...');
    spinner.start();

    try {
      const tweet = await fetchTweet(url, config.twitter);
      content = tweet.text;
      author = tweet.author;
      spinner.stop();
      success(`Fetched tweet from @${author}`);
    } catch (err) {
      spinner.stop();
      error(`Could not fetch tweet: ${err}`);
      console.log(`\n${COLORS.dim}Enter the tweet text manually:${COLORS.reset}`);

      const rl = createInterface({ input: process.stdin, output: process.stdout });
      content = await new Promise<string>((resolve) => {
        rl.question('> ', (answer) => {
          rl.close();
          resolve(answer);
        });
      });
    }
  } else if (url.includes('linkedin.com')) {
    platform = 'linkedin';
    console.log(`\n${COLORS.dim}LinkedIn URL detected. Enter the post text:${COLORS.reset}`);

    const rl = createInterface({ input: process.stdin, output: process.stdout });
    content = await new Promise<string>((resolve) => {
      rl.question('> ', (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  } else {
    // Assume the "url" is actually the content itself
    content = url;
  }

  if (!content) {
    error('No content to reply to.');
    process.exit(1);
  }

  // Show context
  contextWindow({
    tweet: content,
    author,
    tone: detectTone(content)
  });

  // Load persona
  const personaName = options.persona || config.defaults.persona;
  let persona: string;

  if (personaName === 'chaos-goblin' || personaName === 'yolo') {
    persona = getChaosGoblin();
    info('Using chaos-goblin persona (unhinged mode)');
  } else {
    persona = loadPersona(personaName);
    info(`Using persona: ${personaName}`);
  }

  // Generate
  const count = parseInt(options.count || '3');
  const spinner = new Spinner('Generating...');
  spinner.start();

  try {
    const result = await generateReply({
      content,
      platform,
      persona,
      apiKey: config.anthropic_api_key,
      count
    });

    spinner.stop();

    // Show thought process
    console.log(`\n${COLORS.dim}Analysis: ${result.thought}${COLORS.reset}`);

    // Show options
    if (result.options && result.options.length > 0) {
      replyOptions(result.options);
    } else {
      console.log(`\n${COLORS.green}Reply:${COLORS.reset}`);
      console.log(`"${result.reply}"`);
    }

    // Show authenticity score for best option
    authenticityScore(result.score);

    // Interactive selection
    if (result.options && result.options.length > 1) {
      const rl = createInterface({ input: process.stdin, output: process.stdout });

      const choice = await new Promise<string>((resolve) => {
        rl.question(`\n${COLORS.cyan}Choose (1-${result.options!.length}) or [c]opy best:${COLORS.reset} `, (answer) => {
          rl.close();
          resolve(answer.trim().toLowerCase());
        });
      });

      let selectedText: string;

      if (choice === 'c' || choice === '') {
        selectedText = result.reply;
      } else {
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && idx < result.options!.length) {
          selectedText = result.options![idx].text;
        } else {
          selectedText = result.reply;
        }
      }

      // Copy to clipboard (macOS)
      try {
        const proc = Bun.spawn(['pbcopy'], { stdin: 'pipe' });
        proc.stdin.write(selectedText);
        proc.stdin.end();
        await proc.exited;
        success('Copied to clipboard!');
      } catch {
        console.log(`\n${COLORS.dim}Reply:${COLORS.reset} ${selectedText}`);
      }
    }
  } catch (err) {
    spinner.stop();
    error(`Generation failed: ${err}`);
    process.exit(1);
  }
}

/**
 * Simple tone detection
 */
function detectTone(text: string): string {
  const lower = text.toLowerCase();

  if (lower.includes('?')) return 'Questioning';
  if (lower.includes('!') && lower.includes('amazing')) return 'Enthusiastic';
  if (lower.includes('frustrat') || lower.includes('annoying')) return 'Frustrated';
  if (lower.includes('learn') || lower.includes('realiz')) return 'Reflective';
  if (lower.includes('ship') || lower.includes('launch') || lower.includes('built')) return 'Announcement';
  if (lower.includes('hot take') || lower.includes('unpopular')) return 'Provocative';

  return 'Neutral';
}
