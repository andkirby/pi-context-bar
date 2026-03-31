# Context Bar

Replaces pi's default footer with an enhanced version that renders context window usage as a visual bar.

## Alternative for Claude Code
> Full statusline with same the colored context bar.

https://github.com/andkirby/claude-statusline/

## Footer Layout

```
~/project (main)
↑407k ↓20k R3.5M $2.192 3%⠀⠀⠀⠀200k (auto)                    claude-4-sonnet
```

**Line 1** — Working directory and git branch (dimmed).
**Line 2** — Session stats + context bar + model name.


### Vesual Example:
<img width="313" height="28" alt="image" src="https://github.com/user-attachments/assets/75ea6db5-19e5-4e46-8664-39dabf606733" />

### Tests

<img width="155" height="407" alt="image" src="https://github.com/user-attachments/assets/5c512864-16eb-4ae1-82fd-ce661884118e" />
 <img width="166" height="407" alt="image" src="https://github.com/user-attachments/assets/75b2a99c-db8a-4118-bfe9-8dba907071ad" />




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
45%████████200k   (moderate — teal)
72%████████200k   (high — red)
```

- **Left** — Usage percentage
- **Middle** — Braille fill blocks
- **Right** — Context window size

#### Color Thresholds

| Usage | Dim (default) | Vivid |
|-------|---------------|-------|
| 0–30% | Dark green | Green |
| 31–40% | Teal | Green |
| 41–50% | Amber | Yellow |
| 51–60% | Magenta | Red-orange |
| 61–70% | Magenta | Red |
| 71%+  | Red | Bright red |

- **Dim** — Dark truecolor RGB backgrounds that preserve color hue at low brightness. Blends with the footer while remaining readable. Uses ANSI 24-bit color.
- **Vivid** — High-saturation 256-color backgrounds with colored braille fill. Stands out prominently.

The bar is hidden until the first message is sent, then stays visible for the session.

## Commands

### `/context-bar [toggle|dim|vivid]`

Switch the bar color palette at runtime. Preference persists across `/reload`.

| Argument | Effect |
|----------|--------|
| _(none)_ | Toggle between dim and vivid |
| `dim` | Set dim palette |
| `vivid` | Set vivid palette |

## Testing

```bash
# Run all tests (43 assertions)
bash test-context-bar.sh
```

Tests cover:
- Slot count consistency across both palettes
- `formatTokens` formatting ranges
- Vivid threshold boundary values
- Dim palette RGB color codes and hue verification
- Vivid text always uses white foreground
- Style switching
- Edge cases (0%, 100%, 3-digit percentages)

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
