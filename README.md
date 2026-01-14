# Trench

```
  ████████╗██████╗ ███████╗███╗   ██╗ ██████╗██╗  ██╗   ┌───────────┐
  ╚══██╔══╝██╔══██╗██╔════╝████╗  ██║██╔════╝██║  ██║   │ AUTHENTIC │
     ██║   ██████╔╝█████╗  ██╔██╗ ██║██║     ███████║   └─────┬─────┘
     ██║   ██╔══██╗██╔══╝  ██║╚██╗██║██║     ██╔══██║         │
     ██║   ██║  ██║███████╗██║ ╚████║╚██████╗██║  ██║         ▼
     ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝    ᕦ(ò_óˇ)ᕤ
```

**AI reply generator that doesn't sound like a bot.**

Most AI tools generate slop. Trench generates replies you'd actually post.

---

## Install

```bash
# Download (macOS ARM)
curl -L https://github.com/trench-tool/trench/releases/latest/download/trench -o trench
chmod +x trench

# Setup
./trench init

# Run
./trench
```

Or build from source:
```bash
git clone https://github.com/trench-tool/trench && cd trench
bun install && bun run build
./dist/trench
```

---

## What it does

You paste a tweet. Trench gives you 3 reply options. You pick one, edit it, post it.

```
$ trench reply "Hot take: Most AI agents are just glorified prompt chains"

┌──────────────────────────────────────────────────────────────────┐
│ Tweet: "Hot take: Most AI agents are just glorified prompt..."   │
│ Tone: Provocative                                                │
└──────────────────────────────────────────────────────────────────┘
→ Using persona: whisperer

[1] "the persistent memory part is where most implementations fall
    apart. everyone builds the conversation buffer but nobody handles
    state corruption when the context gets weird after 47 turns"

[2] "honestly most of my 'agents' are just claude with a really good
    system prompt and some function calling. works great until i need
    it to remember something from tuesday"

[3] "maybe the whole 'agency' framing is wrong? what if we stopped
    trying to build artificial humans and started building really
    good tools that know their limits"

Authenticity: ████████████████████ 100%
```

---

## Anti-slop

Every reply gets scored. Trench rejects:

- Generic phrases ("Great point!", "This is so true!")
- Buzzwords ("revolutionary", "game-changing", "leverage")
- Excessive enthusiasm
- Bot patterns

If authenticity drops below 70%, it regenerates.

---

## Personas

| Persona | Vibe |
|---------|------|
| `whisperer` | Technical thought leader. Grounded, insightful. |
| `authentic` | Raw personal voice. Honest, direct. |
| `provocateur` | Contrarian. Spicy takes, challenges assumptions. |
| `professional` | Corporate-safe. Polished, diplomatic. |

Switch with `--persona`:
```bash
trench reply "..." --persona provocateur
```

Create your own in `~/.config/trench/personas/`

---

## Commands

```bash
trench                     # Interactive menu
trench reply "text"        # Generate reply
trench reply <tweet-url>   # Reply to specific tweet

trench scan                # Watch targets for new tweets
trench scan --dry-run      # Test mode (no API needed)

trench targets list        # Show monitored accounts
trench targets add karpathy swyx

trench serve               # Start server for browser extension
trench extension           # Export Chrome extension

trench yolo "text"         # Unhinged mode
trench explain <url>       # Why did this go viral?
```

---

## Browser Extension

Generate replies directly in Twitter/LinkedIn:

```bash
trench serve &             # Start local server
trench extension           # Export extension files
```

Then load `./trench-extension/` as unpacked extension in Chrome.

---

## Config

Lives at `~/.config/trench/config.json`:

```json
{
  "anthropic_api_key": "sk-ant-...",
  "twitter": {
    "auth_token": "...",
    "ct0": "..."
  },
  "defaults": {
    "persona": "whisperer"
  },
  "scan": {
    "targets": ["karpathy", "swyx"]
  }
}
```

Twitter cookies are optional. Only needed for `scan` and URL-based replies.

```bash
trench auth   # Auto-extract from Chrome/Firefox/Safari
```

---

## Philosophy

Traditional AI reply tools optimize for engagement metrics. Trench optimizes for authenticity.

The goal isn't to automate your voice. It's to get from rough thought to publishable faster. You approve every reply. You edit. You learn.

---

## Tech

- **Runtime**: Bun (single binary, no deps)
- **AI**: Claude via Anthropic API
- **Server**: Hono
- **Twitter**: Direct GraphQL (no wrappers)

---

## License

MIT
