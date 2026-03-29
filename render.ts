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
// Color palettes
// ---------------------------------------------------------------------------

/** Vivid palette — high saturation, stands out against dim footer text. */
export const VIVID_THRESHOLDS = [
	[70, 196, 196, 124],  // red
	[60, 160, 160, 88],   // magenta
	[50, 208, 208, 94],   // orange
	[40, 112, 112, 28],   // green
	[30, 40,  40,  22],   // dark green
] as const;

/** Dim palette — muted tones, blends naturally with dim footer text. */
export const DIM_THRESHOLDS = [
	[70, 124, 124, 52],   // muted red
	[60, 96,  96,  52],   // muted magenta
	[50, 130, 130, 58],   // muted orange
	[40, 64,  64,  22],   // muted green
	[30, 22,  22,  17],   // dark green
] as const;

/** Active palette — defaults to dim. Switched via /context-bar toggle. */
let activeThresholds: typeof VIVID_THRESHOLDS = DIM_THRESHOLDS;

export type BarStyle = "dim" | "vivid";

/** Switch the active palette. Returns the new style. */
export function setBarStyle(style: BarStyle): BarStyle {
	activeThresholds = style === "vivid" ? VIVID_THRESHOLDS : DIM_THRESHOLDS;
	return style;
}

/** Get the current active style. */
export function getBarStyle(): BarStyle {
	return activeThresholds === VIVID_THRESHOLDS ? "vivid" : "dim";
}

/** Return { barFg, barBg, dimBg } based on context usage % and active palette. */
export function barColors(pct: number) {
	for (const [min, barFg, barBg, dimBg] of activeThresholds) {
		if (pct > min) return { barFg, barBg, dimBg };
	}
	// Fallback depends on active palette
	return activeThresholds === VIVID_THRESHOLDS
		? { barFg: 28, barBg: 28, dimBg: 22 }
		: { barFg: 22, barBg: 22, dimBg: 17 };
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
