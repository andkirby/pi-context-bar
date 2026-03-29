/**
 * Context Bar — pure rendering functions.
 *
 * Exported so both the extension (index.ts) and tests can import them.
 */

// ---------------------------------------------------------------------------
// ANSI helpers (256-color & truecolor RGB)
// ---------------------------------------------------------------------------

export const RESET = "\x1b[0m";

export const fg256 = (code: number, s: string) => `\x1b[38;5;${code}m${s}${RESET}`;
export const bg256 = (code: number, s: string) => `\x1b[48;5;${code}m${s}${RESET}`;

export const fgRgb = (r: number, g: number, b: number, s: string) =>
	`\x1b[38;2;${r};${g};${b}m${s}${RESET}`;
export const bgRgb = (r: number, g: number, b: number, s: string) =>
	`\x1b[48;2;${r};${g};${b}m${s}${RESET}`;

export const WHITE = 231; // pure white (#ffffff)
export const EMPTY = "\u2800"; // braille blank (visual spacer)

// ---------------------------------------------------------------------------
// Color palettes
// ---------------------------------------------------------------------------

/**
 * Vivid palette — high saturation, stands out against dim footer text.
 * Each entry: [minPct, barFg, barBg, dimBg] — raw 256-color indices.
 */
export const VIVID_THRESHOLDS = [
	[70, 196, 196, 124],  // red
	[60, 160, 160, 88],   // magenta
	[50, 208, 208, 94],   // orange
	[40, 112, 112, 28],   // green
	[30, 40,  40,  22],   // dark green
] as const;

/** Fallback for vivid when pct ≤ 30%. */
export const VIVID_FALLBACK = { barFg: 28, barBg: 28, dimBg: 22 } as const;

// ---------------------------------------------------------------------------
// Style state
// ---------------------------------------------------------------------------

export type BarStyle = "dim" | "vivid";

let activeStyle: BarStyle = "dim";

/** Switch the active palette. Returns the new style. */
export function setBarStyle(style: BarStyle): BarStyle {
	activeStyle = style;
	return style;
}

/** Get the current active style. */
export function getBarStyle(): BarStyle {
	return activeStyle;
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
 * Color resolver — abstracts themed vs raw color application.
 * `isText` distinguishes percentage/context-size text from braille fill.
 */
export interface BarColors {
	/** Apply colors to a character. */
	style(ch: string, filled: boolean, isText: boolean): string;
}

/**
 * Dim palette — dark RGB colors with real hue (not gray).
 * Each entry: [minPct, bgR, bgG, bgB, fgR, fgG, fgB] — filled slot colors.
 * Unfilled slots use a single dark neutral.
 */
export const DIM_THRESHOLDS = [
	[70, 80,  20, 20, 180,  55, 55],  // dark red
	[60, 70,  20, 42, 160,  50, 95],  // dark magenta
	[50, 75,  48, 12, 170, 115, 30],  // dark amber
	[40, 18,  58, 32,  50, 130, 75],  // dark teal
	[0,  20,  58, 20,  55, 135, 55],  // dark green (catches everything)
] as const;

/** Dim unfilled slot — dark neutral but readable. */
export const DIM_UNFILLED_BG: [number, number, number] = [16, 16, 20];
export const DIM_UNFILLED_FG: [number, number, number] = [85, 85, 100];

/** Build theme-aware dim color resolver using dark RGB colors. */
export function dimBarColors(pct: number): BarColors {
	// Pick dim threshold colors
	let bgR = DIM_UNFILLED_BG[0], bgG = DIM_UNFILLED_BG[1], bgB = DIM_UNFILLED_BG[2];
	let fgR = DIM_UNFILLED_FG[0], fgG = DIM_UNFILLED_FG[1], fgB = DIM_UNFILLED_FG[2];
	for (const [min, bR, bG, bB, fR, fG, fB] of DIM_THRESHOLDS) {
		if (pct > min) {
			bgR = bR; bgG = bG; bgB = bB;
			fgR = fR; fgG = fG; fgB = fB;
			break;
		}
	}

	return {
		style(ch, filled, _isText) {
			if (filled) {
				return bgRgb(bgR, bgG, bgB, fgRgb(fgR, fgG, fgB, ch));
			}
			return bgRgb(DIM_UNFILLED_BG[0], DIM_UNFILLED_BG[1], DIM_UNFILLED_BG[2],
				fgRgb(DIM_UNFILLED_FG[0], DIM_UNFILLED_FG[1], DIM_UNFILLED_FG[2], ch));
		},
	};
}

/** Build raw 256-color resolver for the vivid palette. */
export function vividBarColors(pct: number): BarColors {
	// Pick vivid threshold colors
	let barFg: number | undefined, barBg: number | undefined, dimBg: number | undefined;
	for (const [min, fg, bg, db] of VIVID_THRESHOLDS) {
		if (pct > min) { barFg = fg; barBg = bg; dimBg = db; break; }
	}
	if (barFg === undefined) {
		barFg = VIVID_FALLBACK.barFg;
		barBg = VIVID_FALLBACK.barBg;
		dimBg = VIVID_FALLBACK.dimBg;
	}

	return {
		style(ch, filled, isText) {
			// Text chars (percentage + context size) always white
			const fg = isText ? WHITE : (filled ? barFg! : WHITE);
			const bg = filled ? barBg! : dimBg!;
			return fg256(fg, bg256(bg, ch));
		},
	};
}

/**
 * Builds ` PP%████NNNk` — 10 visual slots.
 *   left:   percentage text  (e.g. "8%")
 *   middle: braille fill
 *   right:  context window   (e.g. "200k")
 *
 * @param pct      Context usage percentage (0-100)
 * @param ctxSize  Formatted context window size string (e.g. "200k")
 * @param colors   Theme-aware color resolver
 */
export function buildBar(pct: number, ctxSize: string, colors: BarColors): string {
	const clamped = Math.max(0, Math.min(100, Math.round(pct)));
	const pctStr = `${clamped}%`;
	pct = clamped;
	const pctLen = pctStr.length;   // e.g. 2-3
	const ctxLen = ctxSize.length;  // e.g. 4
	const barStart = pctLen;
	const barEnd = BAR_SLOTS - ctxLen;
	const filledSlots = Math.min(Math.floor(pct / 10), BAR_SLOTS);

	let bar = "";

	// Left: percentage text
	for (let i = 0; i < pctLen; i++) {
		bar += colors.style(pctStr[i]!, i < filledSlots, true);
	}

	// Middle: braille fill
	for (let i = barStart; i < barEnd; i++) {
		bar += colors.style(EMPTY, i < filledSlots, false);
	}

	// Right: context size
	for (let i = barEnd; i < BAR_SLOTS; i++) {
		bar += colors.style(ctxSize[i - barEnd]!, i < filledSlots, true);
	}

	return " " + bar;
}

// ---------------------------------------------------------------------------
// Backward-compat: buildBar with raw 256-color (for tests / standalone use)
// ---------------------------------------------------------------------------

/** Return { barFg, barBg, dimBg } from vivid palette based on pct. */
export function barColors(pct: number) {
	for (const [min, barFg, barBg, dimBg] of VIVID_THRESHOLDS) {
		if (pct > min) return { barFg, barBg, dimBg };
	}
	return { ...VIVID_FALLBACK };
}
