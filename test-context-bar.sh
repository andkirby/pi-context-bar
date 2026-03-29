#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEST_TS="$SCRIPT_DIR/test-render.ts"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PASS=0
FAIL=0

assert_eq() {
	local label="$1" expected="$2" actual="$3"
	if [ "$expected" = "$actual" ]; then
		printf "  \033[32m✓\033[0m %s\n" "$label"
		PASS=$((PASS + 1))
	else
		printf "  \033[31m✗\033[0m %s\n" "$label"
		printf "    expected: %s\n" "$expected"
		printf "    actual:   %s\n" "$actual"
		FAIL=$((FAIL + 1))
	fi
}

# Strip all ANSI escape sequences for visual comparison
strip_ansi() {
	sed $'s/\x1b\[[0-9;]*m//g'
}

# Measure visible width by stripping ANSI and counting characters (not bytes)
visible_width() {
	printf "%s" "$1" | strip_ansi | wc -m | tr -d ' '
}

# ---------------------------------------------------------------------------
# Section: Color segments (visual preview)
# ---------------------------------------------------------------------------

echo ""
echo "=== Context Bar — Color Segments ==="
echo ""

bun run "$TEST_TS" --colors | while IFS= read -r line; do
	echo "$line"
done

# ---------------------------------------------------------------------------
# Section: buildBar slot count (both palettes)
# ---------------------------------------------------------------------------

echo ""
echo "=== Slot Count Consistency ==="
echo ""

for style in dim vivid; do
	for ctx_size in "200k" "1M" "1.2M" "2000k"; do
		raw=$(bun run "$TEST_TS" --bar 50 "$ctx_size" | strip_ansi)
		w=$(visible_width "$raw")
		assert_eq "bar($style, 50%, $ctx_size) → visible width = 11" "11" "$w"
	done
done

# ---------------------------------------------------------------------------
# Section: formatTokens
# ---------------------------------------------------------------------------

echo ""
echo "=== formatTokens ==="
echo ""

cases=( \
	"0:0" \
	"500:500" \
	"999:999" \
	"1000:1k" \
	"1500:2k" \
	"999999:1000k" \
	"1000000:1.0M" \
	"1500000:1.5M" \
	"9999999:10.0M" \
	"10000000:10M" \
)

for c in "${cases[@]}"; do
	input="${c%%:*}"
	expected="${c##*:}"
	actual=$(bun run "$TEST_TS" --fmt "$input")
	assert_eq "formatTokens($input)" "$expected" "$actual"
done

# ---------------------------------------------------------------------------
# Section: barColors thresholds — DIM palette (default)
# ---------------------------------------------------------------------------

echo ""
echo "=== barColors Thresholds (dim) ==="
echo ""

#               pct  expected_fg
thresholds=( \
	"5:22" \
	"29:22" \
	"31:22" \
	"39:22" \
	"41:64" \
	"49:64" \
	"51:130" \
	"59:130" \
	"61:96" \
	"69:96" \
	"71:124" \
	"85:124" \
	"100:124" \
)

for t in "${thresholds[@]}"; do
	pct="${t%%:*}"
	expected_fg="${t##*:}"
	actual=$(bun run "$TEST_TS" --color "$pct" dim)
	assert_eq "dim.barColors($pct%%).barFg" "$expected_fg" "$actual"
done

# ---------------------------------------------------------------------------
# Section: barColors thresholds — VIVID palette
# ---------------------------------------------------------------------------

echo ""
echo "=== barColors Thresholds (vivid) ==="
echo ""

thresholds_vivid=( \
	"5:28" \
	"29:28" \
	"31:40" \
	"39:40" \
	"41:112" \
	"49:112" \
	"51:208" \
	"59:208" \
	"61:160" \
	"69:160" \
	"71:196" \
	"85:196" \
	"100:196" \
)

for t in "${thresholds_vivid[@]}"; do
	pct="${t%%:*}"
	expected_fg="${t##*:}"
	actual=$(bun run "$TEST_TS" --color "$pct" vivid)
	assert_eq "vivid.barColors($pct%%).barFg" "$expected_fg" "$actual"
done

# ---------------------------------------------------------------------------
# Section: Style switching
# ---------------------------------------------------------------------------

echo ""
echo "=== Style Switching ==="
echo ""

assert_eq "default style → dim" "dim" "$(bun run "$TEST_TS" --style)"
assert_eq "get vivid inline" "vivid" "$(bun run "$TEST_TS" --style vivid)"
assert_eq "get dim inline" "dim" "$(bun run "$TEST_TS" --style dim)"

# ---------------------------------------------------------------------------
# Section: Edge cases
# ---------------------------------------------------------------------------

echo ""
echo "=== Edge Cases ==="
echo ""

# 0% — everything dim, no fill
raw=$(bun run "$TEST_TS" --bar 0 "200k" | strip_ansi)
assert_eq "bar(0%, 200k) → starts with ' 0%'" " 0%" "$(printf '%s' "$raw" | cut -c1-3)"

# 100% — everything filled
raw=$(bun run "$TEST_TS" --bar 100 "200k" | strip_ansi)
assert_eq "bar(100%, 200k) → ends with '00k'" "00k" "$(printf '%s' "$raw" | rev | cut -c1-3 | rev)"

# BAR_SLOTS is fixed — 3-digit pct still 11 chars
w=$(visible_width "$(bun run "$TEST_TS" --bar 100 "200k")")
assert_eq "bar(100%, 200k) → visible width = 11 (BAR_SLOTS is fixed)" "11" "$w"

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------

echo ""
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
	printf "\033[32mAll %d tests passed.\033[0m\n" "$TOTAL"
else
	printf "\033[31m%d/%d passed, %d failed.\033[0m\n" "$PASS" "$TOTAL" "$FAIL"
	exit 1
fi
