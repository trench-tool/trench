/**
 * Generator Core
 * AI reply generation with anti-slop detection
 */

import Anthropic from '@anthropic-ai/sdk';
import { BANNED_WORDS } from '../utils/constants';

export interface GenerateOptions {
  content: string;
  platform: 'twitter' | 'linkedin' | 'general';
  persona: string;
  apiKey: string;
  count?: number;
}

export interface GenerateResult {
  reply: string;
  thought: string;
  score: number;
  options?: Array<{ label: string; text: string }>;
}

/**
 * Calculate anti-slop authenticity score
 */
export function calculateAuthenticityScore(text: string): number {
  let score = 100;

  // Check for banned words
  const lowerText = text.toLowerCase();
  for (const word of BANNED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      score -= 15;
    }
  }

  // Penalize excessive punctuation
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations > 1) score -= exclamations * 5;

  // Penalize all caps words
  const capsWords = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  score -= capsWords * 10;

  // Reward shorter replies (Twitter-native)
  if (text.length < 100) score += 5;
  if (text.length < 50) score += 5;

  // Penalize very long replies
  if (text.length > 250) score -= 10;

  // Reward sentence variety (not all same length)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.length > 1) {
    const lengths = sentences.map(s => s.trim().length);
    const variance = Math.abs(lengths[0] - (lengths[1] || lengths[0]));
    if (variance > 20) score += 5;
  }

  // Penalize starting with "I" (often sounds bot-like)
  if (text.trim().startsWith('I ')) score -= 5;

  // Reward lowercase aesthetic (when appropriate)
  if (text === text.toLowerCase() && text.length < 100) score += 3;

  return Math.max(0, Math.min(100, score));
}

/**
 * Detect language from text
 */
function detectLanguage(text: string): 'norwegian' | 'english' {
  const norwegianWords = ['jeg', 'du', 'det', 'er', 'og', 'som', 'har', 'med', 'til', 'av', 'på', 'kan', 'vil', 'skal', 'må', 'få', 'være', 'bli', 'når', 'hva', 'hvor', 'hvorfor', 'fordi'];
  const lowerText = text.toLowerCase();

  let norwegianCount = 0;
  for (const word of norwegianWords) {
    if (lowerText.includes(` ${word} `) || lowerText.startsWith(`${word} `) || lowerText.endsWith(` ${word}`)) {
      norwegianCount++;
    }
  }

  return norwegianCount >= 2 ? 'norwegian' : 'english';
}

/**
 * Generate a reply using Claude
 */
export async function generateReply(options: GenerateOptions): Promise<GenerateResult> {
  const { content, platform, persona, apiKey, count = 3 } = options;

  const client = new Anthropic({ apiKey });

  const language = detectLanguage(content);
  const langInstruction = language === 'norwegian'
    ? 'Reply in Norwegian (Bokmål).'
    : 'Reply in English.';

  const systemPrompt = `${persona}

You are generating replies for ${platform}.

LANGUAGE: ${langInstruction}

CONSTRAINTS:
- Under 280 characters for Twitter, under 300 for LinkedIn
- NO bullet points, lists, or dashes to start sentences
- NO banned words: ${BANNED_WORDS.slice(0, 10).join(', ')}...
- Natural, conversational, slightly lowercase aesthetic
- Add genuine value or insight
- Avoid generic agreement ("Great point!", "So true!")`;

  const userPrompt = `Generate ${count} distinct reply options for this post:

"${content}"

For each reply, provide:
1. A label (Technical, Relatable, or Provocative)
2. The reply text

Format your response as JSON:
{
  "thought": "Brief analysis of the post and best angle",
  "options": [
    {"label": "Technical", "text": "..."},
    {"label": "Relatable", "text": "..."},
    {"label": "Provocative", "text": "..."}
  ]
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON in response');
    }

    const data = JSON.parse(jsonMatch[0]);

    // Calculate scores for each option
    const options = (data.options || []).map((opt: { label: string; text: string }) => ({
      ...opt,
      score: calculateAuthenticityScore(opt.text)
    }));

    // Pick the best one (highest score)
    const best = options.reduce((a: { score: number }, b: { score: number }) =>
      a.score > b.score ? a : b, options[0]
    );

    return {
      reply: best?.text || data.options?.[0]?.text || text,
      thought: data.thought || 'Generated reply',
      score: best?.score || calculateAuthenticityScore(best?.text || ''),
      options
    };
  } catch (err) {
    console.error('Generation error:', err);
    throw err;
  }
}

/**
 * Generate a single reply with streaming (for CLI)
 */
export async function generateReplyStream(
  options: GenerateOptions,
  onToken: (token: string) => void
): Promise<GenerateResult> {
  const { content, platform, persona, apiKey } = options;

  const client = new Anthropic({ apiKey });

  const language = detectLanguage(content);
  const langInstruction = language === 'norwegian'
    ? 'Reply in Norwegian (Bokmål).'
    : 'Reply in English.';

  const systemPrompt = `${persona}

You are generating a reply for ${platform}.
${langInstruction}

CONSTRAINTS:
- Under 280 characters
- Natural, conversational tone
- Add genuine value
- NO generic phrases`;

  let fullText = '';

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 300,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: `Generate a single reply to:\n"${content}"\n\nRespond with ONLY the reply text.`
    }]
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      onToken(event.delta.text);
    }
  }

  return {
    reply: fullText.trim(),
    thought: 'Streamed generation',
    score: calculateAuthenticityScore(fullText.trim())
  };
}
