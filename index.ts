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
import { buildBar, formatTokens, sanitizeStatusText } from "./render.ts";

// Re-export sanitizeStatusText — keep render.ts as the single source for pure logic
export { buildBar, formatTokens, barColors, BAR_SLOTS, COLOR_THRESHOLDS } from "./render.ts";

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		// Resolve once — env vars don't change at runtime
		const home = globalThis.process?.env?.HOME || globalThis.process?.env?.USERPROFILE || "";

		ctx.ui.setFooter((tui, theme, footerData) => {
			const unsub = footerData.onBranchChange(() => tui.requestRender());

			return {
				dispose: unsub,
				invalidate() {},

				render(width: number): string[] {
					const state = ctx.sessionManager.getEntries();

					// Token stats
					let totalInput = 0;
					let totalOutput = 0;
					let totalCacheRead = 0;
					let totalCost = 0;
					for (const entry of state) {
						if (entry.type === "message" && entry.message.role === "assistant") {
							const u = entry.message.usage;
							if (!u) continue;
							totalInput += u.input;
							totalOutput += u.output;
							totalCacheRead += u.cacheRead;
							totalCost += u.cost.total;
						}
					}

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
						contextBar = buildBar(contextPercent, ctxSizeStr) + autoIndicator;
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
							const tr = truncateToWidth(dimRightSide, avail, "");
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
}
