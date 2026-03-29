/**
 * test-render.ts — Test harness for context-bar pure rendering functions.
 *
 * Invoked by test-context-bar.sh with subcommands:
 *   --colors              Visual preview of all color thresholds
 *   --bar <pct> <ctxSize> Raw buildBar output (for width assertions)
 *   --fmt <n>             formatTokens result
 *   --color <pct>         barColors(pct).barFg (for threshold assertions)
 *   --style               Current active style
 *   --set-style <style>   Switch palette (dim|vivid)
 */

import { buildBar, barColors, formatTokens, setBarStyle, getBarStyle } from "./render.ts";

const args = process.argv.slice(2);

function usage() {
	console.error("Usage: test-render.ts [--colors | --bar <pct> <ctxSize> | --fmt <n> | --color <pct> | --style | --set-style <dim|vivid>]");
	process.exit(1);
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
			setBarStyle(style);
			console.log(`--- ${style.toUpperCase()} ---`);
			for (const [pct, ctx] of cases) {
				const bar = buildBar(pct, ctx);
				console.log(`[${pct}% - ${labels[pct]}]`);
				console.log(`→${bar}`);
			}
			// Different context window sizes
			console.log("");
			for (const [pct, ctx] of [[50, "1M"], [50, "1.2M"], [50, "2M"]] as [number, string][]) {
				const bar = buildBar(pct, ctx);
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
		if (isNaN(pct) || !ctxSize) usage();
		process.stdout.write(buildBar(pct, ctxSize));
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
		const style = args[2]; // optional: "dim" or "vivid"
		if (isNaN(pct)) usage();
		if (style) setBarStyle(style);
		console.log(barColors(pct).barFg);
		break;
	}

	case "--style": {
		const style = args[1]; // optional: set before reading
		if (style) setBarStyle(style);
		console.log(getBarStyle());
		break;
	}

	case "--set-style": {
		const style = args[1];
		if (style !== "dim" && style !== "vivid") usage();
		setBarStyle(style);
		break;
	}

	default:
		usage();
}
