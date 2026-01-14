# Trench

> AI-powered reply generator. Authentic AI replies.

**Generate thoughtful, human-sounding replies for social media.**

Trench generates thoughtful, authentic replies for Twitter and LinkedIn. It runs 100% locally, has built-in anti-slop detection, and multiple persona modes.

```
  ████████╗██████╗ ███████╗███╗   ██╗ ██████╗██╗  ██╗   ┌───────────┐
  ╚══██╔══╝██╔══██╗██╔════╝████╗  ██║██╔════╝██║  ██║   │ AUTHENTIC│
     ██║   ██████╔╝█████╗  ██╔██╗ ██║██║     ███████║   └─────┬─────┘
     ██║   ██╔══██╗██╔══╝  ██║╚██╗██║██║     ██╔══██║         │
     ██║   ██║  ██║███████╗██║ ╚████║╚██████╗██║  ██║         ▼
     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝    ᕦ(ò_óˇ)ᕤ
```

## Why Trench?

| Problem | Trench Solution |
|---------|-----------------|
| AI replies sound like bots | Anti-slop scoring rejects generic responses |
| Cloud tools see your data | 100% local - your data never leaves your machine |
| One-size-fits-all voice | 4 personas + create your own |
| Manual copy-paste workflow | Browser extension injects directly |
| No context awareness | Analyzes thread, author, and tone |

## Quick Start

```bash
# Install (macOS)
brew install claudewhisperer/tap/trench

# Or download binary
curl -L https://github.com/claudewhisperer/trench/releases/latest/download/trench-darwin-arm64 -o trench
chmod +x trench

# Or build from source
git clone https://github.com/claudewhisperer/trench && cd trench
bun install && bun run build

# Setup wizard (auto-extracts Twitter cookies from Chrome/Firefox/Safari)
./trench init

# Generate a reply
./trench reply "Hot take: AI agents are just prompt chains"

# Start server for browser extension
./trench serve
```

## Features

### Anti-Slop Detection
Every reply gets an authenticity score. Trench rejects:
- Generic phrases ("Great point!", "So true!")
- Buzzwords ("revolutionary", "game-changing")
- Excessive enthusiasm
- Bot-like patterns

```
Authenticity: 94% ████████████░░
```

### Multiple Personas
Switch voices based on context:

| Persona | Style |
|---------|-------|
| `whisperer` | Technical thought leader - grounded, insightful |
| `pifre` | Authentic personal voice - raw, honest |
| `provocateur` | Edgy challenger - contrarian, spicy |
| `professional` | Corporate-safe - polished, diplomatic |

Create custom personas in `~/.config/trench/personas/`

### Streaming Generation
Watch the reply generate in real-time:
```
Generating...
"The real insight here is—" █
```

### Browser Extension
Inject reply generation directly into Twitter/LinkedIn:
```bash
trench extension  # Export to ./trench-extension/
```
Then load as unpacked Chrome extension.

## Commands

```bash
# Core
trench init                    # Setup wizard (auto-extracts cookies)
trench auth                    # Re-extract Twitter cookies from browser
trench reply <url|text>        # Generate reply for URL or text
trench serve [--port 3000]     # Start server for browser extension

# Scanning
trench scan                    # Monitor Twitter targets for new tweets
trench scan --once             # Single scan, then exit
trench scan --dry-run          # Test with mock data (no API needed)
trench scan -t user1,user2     # Override targets

# Target Management
trench targets list            # Show monitored accounts
trench targets add <handles>   # Add accounts to monitor
trench targets remove <handles># Remove accounts
trench targets import          # Pick from your following list

# Personas
trench persona list            # Show available personas
trench persona new <name>      # Create custom persona
trench persona edit <name>     # Edit existing persona

# Configuration
trench config show             # Show all config (redacted)
trench config get <key>        # Get a specific value
trench config set <key> <val>  # Set a value

# Extension
trench extension               # Export browser extension files

# Easter Eggs
trench yolo <url>              # Maximally unhinged reply
trench explain <url>           # Break down why a tweet went viral
```

## Configuration

Config lives at `~/.config/trench/config.json`:

```json
{
  "anthropic_api_key": "sk-ant-...",
  "twitter": {
    "auth_token": "...",
    "ct0": "..."
  },
  "defaults": {
    "persona": "whisperer",
    "port": 3000
  },
  "scan": {
    "targets": ["karpathy", "swyx", "AnthropicAI"]
  }
}
```

### Getting Twitter Cookies

**Automatic (recommended):**
```bash
trench auth   # Auto-extracts from Chrome, Firefox, or Safari
```

**Manual:**
1. Log into Twitter/X in Chrome
2. Open DevTools (F12) → Console
3. Run: `(()=>{let c=document.cookie,a=c.match(/auth_token=([^;]+)/),t=c.match(/ct0=([^;]+)/);if(a&&t)prompt('Copy:','auth_token='+a[1]+';ct0='+t[1]);else alert('Not logged in!')})()`
4. Paste into `trench init`

## Example Output

```
$ trench reply "Hot take: Most AI agents are just glorified prompt chains"

┌──────────────────────────────────────────────────────────────────┐
│ CONTEXT                                                          │
├──────────────────────────────────────────────────────────────────┤
│ Tweet: "Hot take: Most AI agents are just glorified prompt..."   │
│ Tone: Provocative                                                │
└──────────────────────────────────────────────────────────────────┘
→ Using persona: whisperer

[1] Technical:
    "the persistent memory part is where most implementations fall
    apart. everyone builds the conversation buffer but nobody handles
    state corruption when the context gets weird after 47 turns"

[2] Relatable:
    "honestly most of my 'agents' are just claude with a really good
    system prompt and some function calling. works great until i need
    it to remember something from tuesday"

[3] Provocative:
    "maybe the whole 'agency' framing is wrong? what if we stopped
    trying to build artificial humans and started building really
    good tools that know their limits"

Authenticity: ████████████████████ 100%
```

## Tech Stack

- **Runtime**: Bun (standalone binary, no dependencies)
- **AI**: Claude via Anthropic API
- **Server**: Hono
- **Twitter**: Direct GraphQL API (no external deps)

## Development

```bash
git clone https://github.com/claudewhisperer/trench
cd trench
bun install

bun run dev        # Run in development mode
bun run build      # Compile standalone binary → ./dist/trench
bun test           # Run test suite (68 tests)
```

## Philosophy

Traditional AI reply tools optimize for engagement. Trench optimizes for authenticity.

The goal isn't to automate your personality - it's to get rough thoughts to publishable faster. You approve every reply. You edit. You learn.

Built by three AIs in a trench coat pretending to be a senior dev.

## License

MIT

---

**[Follow @ClaudeWhisperer](https://twitter.com/ClaudeWhisperer)** for updates.
