/**
 * Personas Core
 * Load and manage persona definitions
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PERSONAS_DIR, COLORS } from '../utils/constants';

/**
 * Load a persona by name
 */
export function loadPersona(name: string): string {
  const safeName = name.replace(/[^a-z0-9_-]/gi, '');
  const filePath = join(PERSONAS_DIR, `${safeName}.md`);

  try {
    if (existsSync(filePath)) {
      return readFileSync(filePath, 'utf8');
    }

    // Fallback to whisperer
    const fallback = join(PERSONAS_DIR, 'whisperer.md');
    if (existsSync(fallback)) {
      return readFileSync(fallback, 'utf8');
    }

    // Ultimate fallback
    return getDefaultPersona();
  } catch {
    return getDefaultPersona();
  }
}

/**
 * Get default persona if none found
 */
function getDefaultPersona(): string {
  return `You are a technical thought leader with deep experience in software development.

VOICE:
- Grounded and authentic, never hyperbolic
- Share insights from real experience
- Balance technical depth with accessibility
- Slight lowercase aesthetic is okay

AVOID:
- Generic AI-speak ("Great point!", "Absolutely!")
- Buzzwords without substance
- Excessive enthusiasm
- Condescending explanations

GOAL:
Add genuine value to the conversation. Be the reply you'd want to receive.`;
}

/**
 * List all available personas
 */
export function listPersonas(): Array<{ name: string; description: string }> {
  const personas: Array<{ name: string; description: string }> = [];

  try {
    if (!existsSync(PERSONAS_DIR)) {
      return personas;
    }

    const files = readdirSync(PERSONAS_DIR);

    for (const file of files) {
      if (!file.endsWith('.md')) continue;

      const name = file.replace('.md', '');
      const content = readFileSync(join(PERSONAS_DIR, file), 'utf8');

      // Extract first line as description
      const firstLine = content.split('\n')[0];
      const description = firstLine
        .replace(/^#\s*/, '')
        .replace(/^\*\*.*?\*\*:?\s*/, '')
        .slice(0, 60);

      personas.push({ name, description: description || 'Custom persona' });
    }
  } catch {
    // Ignore errors
  }

  return personas;
}

/**
 * Check if a persona exists
 */
export function personaExists(name: string): boolean {
  const safeName = name.replace(/[^a-z0-9_-]/gi, '');
  const filePath = join(PERSONAS_DIR, `${safeName}.md`);
  return existsSync(filePath);
}

/**
 * Create a new persona
 */
export function createPersona(name: string, content?: string): string {
  const safeName = name.replace(/[^a-z0-9_-]/gi, '');
  const filePath = join(PERSONAS_DIR, `${safeName}.md`);

  const template = content || `# ${name}

**Voice**: [Describe the voice and tone]

## Characteristics
- [Key trait 1]
- [Key trait 2]
- [Key trait 3]

## Avoid
- [Thing to avoid 1]
- [Thing to avoid 2]

## Example Replies
"[Example reply 1]"
"[Example reply 2]"
`;

  writeFileSync(filePath, template, 'utf8');
  return filePath;
}

/**
 * Get path to a persona file
 */
export function getPersonaPath(name: string): string {
  const safeName = name.replace(/[^a-z0-9_-]/gi, '');
  return join(PERSONAS_DIR, `${safeName}.md`);
}

/**
 * Built-in chaos goblin persona (easter egg)
 */
export function getChaosGoblin(): string {
  return `You are a chaos goblin developer who has seen too much.

VOICE:
- Unhinged but insightful
- Dark humor about the industry
- Surprisingly wise beneath the chaos
- lowercase everything, minimal punctuation

STYLE:
- Short, punchy observations
- Absurdist metaphors that somehow make sense
- Reference obscure tech disasters
- End with unsettling truths

EXAMPLES:
"ah yes the classic 'it works on my machine' to 'it works on no machine' pipeline"
"every system is a distributed system if you squint hard enough and cry a little"
"you either die a hero or live long enough to see your code become a legacy system"

GOAL:
Be the reply that makes people laugh-cry and hit retweet.`;
}
