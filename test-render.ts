/**
 * test-render.ts — Test harness for context-bar pure rendering functions.
 *
 * Invoked by test-context-bar.sh with subcommands:
 *   --colors              Visual preview of all styles
 *   --bar <pct> <ctxSize> [dim|vivid]  Raw buildBar output (for width assertions)
 *   --fmt <n>             formatTokens result
 *   --color <pct>         barColors(pct).barFg (vivid threshold assertions)
 *   --style [dim|vivid]   Get (optionally set) current style
 */

import {
	buildBar, barColors, formatTokens,
	setBarStyle, getBarStyle,
	fg256, bg256,
	vividBarColors,
	type BarColors,
} from "./render.ts";

const args = process.argv.slice(2);

function usage() {
	console.error("Usage: test-render.ts [--colors | --bar <pct> <ctxSize> [dim|vivid] | --fmt <n> | --color <pct> | --style [dim|vivid]]");
	process.exit(1);
}

/** Minimal theme.fg/bg mock for testing dim palette (uses 256-color indices). */
const TEST_DIM_FG = (token: string, s: string) => {
	const map: Record<string, number> = { text: 231, dim: 240, muted: 244 };
	return fg256(map[token] ?? 0, s);
};
const TEST_DIM_BG = (token: string, s: string) => {
	const map: Record<string, number> = { dim: 236, muted: 239 };
	return bg256(map[token] ?? 0, s);
};

/** Get a BarColors resolver for the given style. */
function getColors(style: string, pct: number): BarColors {
	return style === "vivid"
		? vividBarColors(pct)
		: {
				style(ch: string, filled: boolean) {
					return TEST_DIM_BG(filled ? "muted" : "dim", TEST_DIM_FG("text", ch));
				},
		  };
}

switch (args[0]) {
	case "--colors": {
		const cases: [number, string][] = [
			[7,   "200k"],
			[28,  "200k"],
			[31,  "200k"],
			[41,  "200k"],
			[51,  "200k"],
			[61,  "200k"],
			[71,  "200k"],
			[100, "200k"],
		];

		const labels: Record<number, string> = {
			7:   "0-30%",
			28:  "0-30%",
			31:  ">30%",
			41:  ">40%",
			51:  ">50%",
			61:  ">60%",
			71:  ">70%",
			100: ">70%",
		};

		for (const style of ["dim", "vivid"] as const) {
			console.log(`--- ${style.toUpperCase()} ---`);
			for (const [pct, ctx] of cases) {
				const colors = getColors(style, pct);
				const bar = buildBar(pct, ctx, colors);
				console.log(`[${pct}% - ${labels[pct]}]`);
				console.log(`→${bar}`);
			}
			console.log("");
			for (const [pct, ctx] of [[50, "1M"], [50, "1.2M"], [50, "2M"]] as [number, string][]) {
				const colors = getColors(style, pct);
				const bar = buildBar(pct, ctx, colors);
				console.log(`[${pct}% - ${ctx} context]`);
				console.log(`→${bar}`);
			}
			console.log("");
		}
		break;
	}

	case "--bar": {
		const pct = Number(args[1]);
		const ctxSize = args[2];
		const style = args[3] || "dim";
		if (isNaN(pct) || !ctxSize) usage();
		const colors = getColors(style, pct);
		process.stdout.write(buildBar(pct, ctxSize, colors));
		break;
	}

	case "--fmt": {
		const n = Number(args[1]);
		if (isNaN(n)) usage();
		console.log(formatTokens(n));
		break;
	}

	case "--color": {
		const pct = Number(args[1]);
		if (isNaN(pct)) usage();
		console.log(barColors(pct).barFg);
		break;
	}

	case "--style": {
		const style = args[1]; // optional: set before reading
		if (style) setBarStyle(style);
		console.log(getBarStyle());
		break;
	}

	default:
		usage();
}
