# Context Bar

Replaces pi's default footer with an enhanced version that renders context window usage as a visual bar.

## Footer Layout

```
~/project (main)
↑407k ↓20k R3.5M $2.192 3%⠀⠀⠀⠀200k (auto)                    claude-4-sonnet
```

**Line 1** — Working directory and git branch (dimmed).  
**Line 2** — Session stats + context bar + model name.

### Stats

| Symbol | Meaning |
|--------|---------|
| `↑407k` | Total input tokens |
| `↓20k` | Total output tokens |
| `R3.5M` | Cache read tokens |
| `$2.192` | Session cost |

### Context Bar

A 10-slot visual bar showing context window fill level:

```
3%⠀⠀⠀⠀200k   (low usage — green)
45%████████200k   (moderate — green)
72%████████200k   (high — red)
```

- **Left** — Usage percentage
- **Middle** — Braille fill blocks
- **Right** — Context window size

#### Color Thresholds

| Usage | Color |
|-------|-------|
| 0–30% | Dark green |
| 31–40% | Green |
| 41–50% | Yellow |
| 51–60% | Red-orange |
| 61–70% | Red |
| 71%+  | Bright red |

The bar is hidden until the first message is sent, then stays visible for the session.

## Install

Add to your pi extensions config:

```json
{
  "extensions": {
    "context-bar": {
      "path": "~/.pi/agent/extensions/context-bar"
    }
  }
}
```

Set-and-forget — activates automatically on session start.
