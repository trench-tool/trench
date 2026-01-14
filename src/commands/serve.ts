/**
 * Serve Command
 * Start the local server for browser extension
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamText } from 'hono/streaming';
import { loadConfig } from '../utils/config';
import { header, success, error, info } from '../utils/output';
import { COLORS } from '../utils/constants';
import { generateReply, GenerateOptions } from '../core/generator';
import { loadPersona } from '../core/personas';

interface ServeOptions {
  port?: string;
}

export async function serveCommand(options: ServeOptions): Promise<void> {
  const config = loadConfig();
  const port = parseInt(options.port || String(config.defaults.port) || '3000');

  if (!config.anthropic_api_key) {
    error('No Anthropic API key configured.');
    info('Run: trench init');
    process.exit(1);
  }

  const app = new Hono();

  // CORS for browser extension
  app.use('*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type']
  }));

  // Health check
  app.get('/', (c) => {
    return c.html(`
      <html>
        <body style="background: #0d1117; color: #e5e7eb; font-family: system-ui; padding: 40px;">
          <h1 style="color: #f97316;">Trench Server</h1>
          <p>Trench server is running.</p>
          <p style="color: #6b7280;">POST /generate to create replies.</p>
        </body>
      </html>
    `);
  });

  // Generate endpoint (non-streaming)
  app.post('/generate', async (c) => {
    try {
      const body = await c.req.json();
      const { text, context, persona: personaName } = body;

      if (!text) {
        return c.json({ error: 'Missing "text" field' }, 400);
      }

      const persona = loadPersona(personaName || config.defaults.persona);

      const options: GenerateOptions = {
        content: text,
        platform: context || 'twitter',
        persona,
        apiKey: config.anthropic_api_key
      };

      const result = await generateReply(options);

      return c.json({
        reply: result.reply,
        thought: result.thought,
        score: result.score
      });
    } catch (err) {
      console.error('Generate error:', err);
      return c.json({ error: String(err) }, 500);
    }
  });

  // Streaming endpoint
  app.post('/generate/stream', async (c) => {
    const body = await c.req.json();
    const { text, context, persona: personaName } = body;

    if (!text) {
      return c.json({ error: 'Missing "text" field' }, 400);
    }

    const persona = loadPersona(personaName || config.defaults.persona);

    return streamText(c, async (stream) => {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default;
        const client = new Anthropic({ apiKey: config.anthropic_api_key });

        const systemPrompt = persona + `

TASK: Generate a reply for a ${context || 'social media'} post.

CONSTRAINTS:
- Under 280 characters
- No bullet points or lists
- Natural, conversational tone
- Match the detected language (Norwegian → Bokmål, English → English)`;

        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 300,
          stream: true,
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: `Generate a reply to:\n"${text}"\n\nRespond with ONLY the reply text, nothing else.`
          }]
        });

        for await (const event of response) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            await stream.write(event.delta.text);
          }
        }
      } catch (err) {
        await stream.write(`\n\nError: ${err}`);
      }
    });
  });

  // Start server
  header('Trench Server');
  console.log(`${COLORS.dim}Authentic AI replies${COLORS.reset}\n`);

  success(`Server running on http://localhost:${port}`);
  info('POST /generate - Generate a reply');
  info('POST /generate/stream - Generate with streaming');
  console.log(`\n${COLORS.dim}Press Ctrl+C to stop${COLORS.reset}\n`);

  // Use Bun's native server
  Bun.serve({
    port,
    fetch: app.fetch
  });
}
