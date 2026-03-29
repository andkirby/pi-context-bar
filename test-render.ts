/**
 * test-render.ts — Test harness for context-bar pure rendering functions.
 *
 * Invoked by test-context-bar.sh with subcommands:
 *   --colors        Visual preview of all color thresholds
 *   --bar <pct> <ctxSize>   Raw buildBar output (for width assertions)
 *   --fmt <n>       formatTokens result
 *   --color <pct>   barColors(pct).barFg (for threshold assertions)
 */

import { buildBar, barColors, formatTokens } from "./render.ts";

const args = process.argv.slice(2);

function usage() {
	console.error("Usage: test-render.ts [--colors | --bar <pct> <ctxSize> | --fmt <n> | --color <pct>]");
	process.exit(1);
}

switch (args[0]) {
	case "--colors": {
		// Print a visual preview at every color boundary
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
			7:   "0-30%: Green (28)",
			28:  "0-30%: Green (28)",
			31:  ">30%: Color 40",
			41:  ">40%: Color 112",
			51:  ">50%: Color 208",
			61:  ">60%: Color 160",
			71:  ">70%: Color 196 (Red)",
			100: ">70%: Color 196 (Red)",
		};

		for (const [pct, ctx] of cases) {
			const bar = buildBar(pct, ctx);
			console.log(`[${pct}% - ${labels[pct]}]`);
			console.log(`→${bar}`);
		}

		// Different context window sizes
		console.log("");
		console.log("--- Different context window sizes ---");
		for (const [pct, ctx] of [[50, "1M"], [50, "1.2M"], [50, "2M"]] as [number, string][]) {
			const bar = buildBar(pct, ctx);
			console.log(`[${pct}% - ${ctx} context]`);
			console.log(`→${bar}`);
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
		if (isNaN(pct)) usage();
		console.log(barColors(pct).barFg);
		break;
	}

	default:
		usage();
}
