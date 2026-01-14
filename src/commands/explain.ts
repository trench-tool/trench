/**
 * Explain Command (Easter Egg)
 * Break down why a tweet went viral
 */

import Anthropic from '@anthropic-ai/sdk';
import { loadConfig } from '../utils/config';
import { fetchTweet } from '../core/twitter';
import { header, success, error, info, box, Spinner } from '../utils/output';
import { COLORS } from '../utils/constants';

export async function explainCommand(url: string): Promise<void> {
  const config = loadConfig();

  if (!config.anthropic_api_key) {
    error('No Anthropic API key configured.');
    info('Run: trench init');
    process.exit(1);
  }

  header('Tweet Analysis');

  let content: string;
  let author: string | undefined;

  // Try to fetch if it's a URL
  if (url.includes('twitter.com') || url.includes('x.com')) {
    if (config.twitter.auth_token && config.twitter.ct0) {
      const spinner = new Spinner('Fetching tweet...');
      spinner.start();

      try {
        const tweet = await fetchTweet(url, config.twitter);
        content = tweet.text;
        author = tweet.author;
        spinner.stop();
        success(`Analyzing tweet from @${author}`);
      } catch (err) {
        spinner.stop();
        error(`Could not fetch: ${err}`);
        content = url; // Use URL as content fallback
      }
    } else {
      info('Twitter not configured. Paste the tweet text instead.');
      content = url;
    }
  } else {
    content = url;
  }

  console.log(`\n${COLORS.dim}"${content.slice(0, 200)}${content.length > 200 ? '...' : ''}"${COLORS.reset}\n`);

  const spinner = new Spinner('Analyzing...');
  spinner.start();

  try {
    const client = new Anthropic({ apiKey: config.anthropic_api_key });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Analyze this tweet/post and explain what makes it effective (or ineffective). Break down:

1. **Hook** - What grabs attention in the first line?
2. **Structure** - How is it formatted for readability?
3. **Emotional Appeal** - What feelings does it trigger?
4. **Value Proposition** - What does the reader gain?
5. **Call to Action** - Does it encourage engagement?
6. **Authenticity Score** - How human/genuine does it feel? (0-100)

Tweet to analyze:
"${content}"

${author ? `Author: @${author}` : ''}

Be specific and actionable. If it's a bad tweet, explain why.`
      }]
    });

    spinner.stop();

    const analysis = response.content[0].type === 'text' ? response.content[0].text : '';

    console.log(analysis);

    // Extract authenticity score if mentioned
    const scoreMatch = analysis.match(/authenticity.*?(\d+)/i);
    if (scoreMatch) {
      const score = parseInt(scoreMatch[1]);
      console.log(`\n${COLORS.orange}Authenticity: ${score}%${COLORS.reset}`);
    }

  } catch (err) {
    spinner.stop();
    error(`Analysis failed: ${err}`);
    process.exit(1);
  }
}
