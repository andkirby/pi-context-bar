/**
 * Context Bar — pure rendering functions.
 *
 * Exported so both the extension (index.ts) and tests can import them.
 */

// ---------------------------------------------------------------------------
// ANSI helpers (256-color)
// ---------------------------------------------------------------------------

export const RESET = "\x1b[0m";

export const fg = (code: number, s: string) => `\x1b[38;5;${code}m${s}${RESET}`;
export const bg = (code: number, s: string) => `\x1b[48;5;${code}m${s}${RESET}`;

export const WHITE = 231; // pure white (#ffffff)
export const EMPTY = "\u2800"; // braille blank (visual spacer)

// ---------------------------------------------------------------------------
// Color thresholds
// ---------------------------------------------------------------------------

/** [minPct, barFg, barBg, dimBg] — evaluated top-down */
export const COLOR_THRESHOLDS = [
	[70, 196, 196, 124],
	[60, 160, 160, 88],
	[50, 208, 208, 94],
	[40, 112, 112, 28],
	[30, 40,  40,  22],
] as const;

/** Return { barFg, barBg, dimBg } based on context usage %. */
export function barColors(pct: number) {
	for (const [min, barFg, barBg, dimBg] of COLOR_THRESHOLDS) {
		if (pct > min) return { barFg, barBg, dimBg };
	}
	return { barFg: 28, barBg: 28, dimBg: 22 };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatTokens(n: number): string {
	if (n < 1000) return `${n}`;
	if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
	if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	return `${Math.round(n / 1_000_000)}M`;
}

export function sanitizeStatusText(text: string): string {
	return text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Bar rendering
// ---------------------------------------------------------------------------

/** Number of visual slots in the bar (percentage + fill + context size). */
export const BAR_SLOTS = 10;

/**
 * Builds ` PP%████NNNk` — 10 visual slots.
 *   left:   percentage text  (e.g. "8%")
 *   middle: braille fill
 *   right:  context window   (e.g. "200k")
 */
export function buildBar(pct: number, ctxSize: string): string {
	const pctStr = `${pct}%`;
	const pctLen = pctStr.length;   // e.g. 2-3
	const ctxLen = ctxSize.length;  // e.g. 4
	const barStart = pctLen;
	const barEnd = BAR_SLOTS - ctxLen;
	const filledSlots = Math.min(Math.floor(pct / 10), BAR_SLOTS);

	const { barFg, barBg, dimBg } = barColors(pct);

	let bar = "";

	// Left: percentage text
	for (let i = 0; i < pctLen; i++) {
		const ch = pctStr[i]!;
		bar += i < filledSlots
			? fg(WHITE, bg(barBg, ch))
			: fg(WHITE, bg(dimBg, ch));
	}

	// Middle: braille fill
	for (let i = barStart; i < barEnd; i++) {
		bar += i < filledSlots
			? fg(barFg, bg(barBg, EMPTY))
			: fg(barFg, bg(dimBg, EMPTY));
	}

	// Right: context size
	for (let i = barEnd; i < BAR_SLOTS; i++) {
		const ch = ctxSize[i - barEnd]!;
		bar += i < filledSlots
			? fg(WHITE, bg(barBg, ch))
			: fg(WHITE, bg(dimBg, ch));
	}

	return " " + bar;
}
