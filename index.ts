/**
 * Context Bar Extension
 *
 * Replaces pi's default footer with a version that renders context usage
 * as a visual bar: [PP%████NNNk] instead of plain "8.9%/200k".
 *
 * Activated on session start. No commands — set-and-forget.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";
import { buildBar, formatTokens, sanitizeStatusText, setBarStyle, getBarStyle, dimBarColors, vividBarColors, type BarStyle } from "./render.ts";

// Public API (tests import render.ts directly)
export type { BarStyle } from "./render.ts";
export { buildBar, formatTokens, setBarStyle, getBarStyle } from "./render.ts";

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

const STATE_TYPE = "context-bar:style";

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		// Resolve once — env vars don't change at runtime
		const home = globalThis.process?.env?.HOME || globalThis.process?.env?.USERPROFILE || "";

		// Restore bar style from session entries (most recent wins)
		const entries = ctx.sessionManager.getEntries();
		for (let i = entries.length - 1; i >= 0; i--) {
			const entry = entries[i];
			if (entry.type === "custom" && entry.customType === STATE_TYPE) {
				const style = (entry.data as { style?: BarStyle }).style;
				if (style) setBarStyle(style);
				break;
			}
		}

		// Incremental token counters — avoid O(n) recomputation on every render
		let totalInput = 0;
		let totalOutput = 0;
		let totalCacheRead = 0;
		let totalCost = 0;
		let processedCount = 0;

		function accumulateEntries() {
			const latest = ctx.sessionManager.getEntries();
			for (let i = processedCount; i < latest.length; i++) {
				const entry = latest[i];
				if (entry.type === "message" && entry.message.role === "assistant") {
					const u = entry.message.usage;
					if (u) {
						totalInput += u.input;
						totalOutput += u.output;
						totalCacheRead += u.cacheRead;
						totalCost += u.cost.total;
					}
				}
			}
			processedCount = latest.length;
		}

		// Warm cache with existing entries
		accumulateEntries();

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsub,
				invalidate() {},

				render(width: number): string[] {
					// Process only new entries since last render
					accumulateEntries();

					// Context usage (mirrors FooterComponent logic)
					const contextUsage = ctx.getContextUsage?.() ?? null;
					const contextWindow = contextUsage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
					const contextPercentValue = contextUsage?.percent ?? 0;
					const contextPercent = contextUsage?.percent != null ? Math.round(contextPercentValue) : null;

					// Pwd + branch
					let pwd = ctx.cwd;
					if (home && pwd.startsWith(home)) pwd = `~${pwd.slice(home.length)}`;
					const branch = footerData.getGitBranch();
					if (branch) pwd = `${pwd} (${branch})`;

					// Build parts independently to avoid ANSI-unsafe string slicing
					const dimStatsParts: string[] = [];
					if (totalInput) dimStatsParts.push(`↑${formatTokens(totalInput)}`);
					if (totalOutput) dimStatsParts.push(`↓${formatTokens(totalOutput)}`);
					if (totalCacheRead) dimStatsParts.push(`R${formatTokens(totalCacheRead)}`);
					if (totalCost) dimStatsParts.push(`$${totalCost.toFixed(3)}`);
					const dimStatsLeft = theme.fg("dim", dimStatsParts.join(" "));
					const statsLeftWidth = visibleWidth(dimStatsLeft);

					// Context bar (replaces plain "8.9%/200k") — hide until first message
					let contextBar = "";
					if (totalInput > 0 && contextPercent != null) {
						const autoIndicator = theme.fg("dim", " (auto)");
						const ctxSizeStr = formatTokens(contextWindow);
						const colors = getBarStyle() === "vivid"
							? vividBarColors(contextPercent)
							: dimBarColors(contextPercent);
						contextBar = buildBar(contextPercent, ctxSizeStr, colors) + autoIndicator;
					} else if (totalInput > 0 && contextPercent == null) {
						const autoIndicator = theme.fg("dim", " (auto)");
						contextBar = theme.fg("dim", `?/${formatTokens(contextWindow)}${autoIndicator}`);
					}
					const contextBarWidth = visibleWidth(contextBar);

					// Right side: model name
					const modelName = ctx.model?.id || "no-model";
					const dimRightSide = theme.fg("dim", modelName);
					const rightWidth = visibleWidth(dimRightSide);

					// Layout: [dimStats][contextBar][padding][dimModel]
					const minPad = 2;
					const usedWidth = statsLeftWidth + contextBarWidth + rightWidth;
					const paddingWidth = Math.max(0, width - usedWidth);

					// If everything fits, render full line
					let statsLine: string;
					if (usedWidth + minPad <= width) {
						statsLine = dimStatsLeft + contextBar + " ".repeat(paddingWidth) + dimRightSide;
					} else {
						// Truncate model name to fit
						const avail = width - statsLeftWidth - contextBarWidth - minPad;
						if (avail > 0) {
							const tr = truncateToWidth(dimRightSide, avail, theme.fg("dim", "…"));
							const trW = visibleWidth(tr);
							statsLine = dimStatsLeft + contextBar + " ".repeat(Math.max(0, width - statsLeftWidth - contextBarWidth - trW)) + tr;
						} else {
							// Drop model entirely, truncate stats+bar
							const fullLeft = dimStatsLeft + contextBar;
							const fullWidth = statsLeftWidth + contextBarWidth;
							if (fullWidth > width) {
								statsLine = truncateToWidth(fullLeft, width, theme.fg("dim", "..."));
							} else {
								statsLine = fullLeft;
							}
						}
					}

					const pwdLine = truncateToWidth(theme.fg("dim", pwd), width, theme.fg("dim", "..."));
					const lines = [pwdLine, statsLine];

					// Extension statuses
					const extStatuses = footerData.getExtensionStatuses();
					if (extStatuses.size > 0) {
						const sorted = Array.from(extStatuses.entries())
							.sort((a, b) => a[0].localeCompare(b[0]))
							.map((e) => sanitizeStatusText(e[1]));
						lines.push(truncateToWidth(sorted.join(" "), width, theme.fg("dim", "...")));
					}

					return lines;
				},
			};
		});
	});

	// /context-bar toggle|dim|vivid — switch bar color palette
	pi.registerCommand("context-bar", {
		description: "Toggle context bar style: dim (default) or vivid",
		handler: async (args, ctx) => {
			const action = args.trim().toLowerCase() || "toggle";
			const current = getBarStyle();

			let next: BarStyle;
			if (action === "dim" || action === "vivid") {
				next = action;
			} else if (action === "toggle") {
				next = current === "dim" ? "vivid" : "dim";
			} else {
				ctx.ui.notify(`Unknown action: "${action}". Use: toggle, dim, vivid`, "error");
				return;
			}

			setBarStyle(next);
			pi.appendEntry(STATE_TYPE, { style: next });
			ctx.ui.notify(`Context bar style: ${next}`, "info");
		},
	});
}
