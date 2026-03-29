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
		raw=$(bun run "$TEST_TS" --bar 50 "$ctx_size" "$style" | strip_ansi)
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
# Section: barColors thresholds — VIVID palette (raw 256-color)
# ---------------------------------------------------------------------------

echo ""
echo "=== barColors Thresholds (vivid) ==="
echo ""

#               pct  expected_fg
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
	actual=$(bun run "$TEST_TS" --color "$pct")
	assert_eq "vivid.barColors($pct%%).barFg" "$expected_fg" "$actual"
done

# ---------------------------------------------------------------------------
# Section: Dim palette uses theme tokens (structural check)
# ---------------------------------------------------------------------------

echo ""
echo "=== Dim Palette — Theme Token Usage ==="
echo ""

# Verify dim bar uses truecolor RGB (not 256-color or gray)
raw=$(bun run "$TEST_TS" --bar 50 "200k" dim)
assert_eq "dim bar at 50% → contains teal RGB bg" "yes" \
	"$(echo "$raw" | grep -q '48;2;12;45;25m' && echo yes || echo no)"

raw=$(bun run "$TEST_TS" --bar 5 "200k" dim)
# DIM_UNFILLED_BG = [14, 14, 18], DIM_UNFILLED_FG = [55, 55, 65]
assert_eq "dim bar at 5% → contains unfilled RGB bg" "yes" \
	"$(echo "$raw" | grep -q '48;2;14;14;18m' && echo yes || echo no)"

assert_eq "dim bar at 5% → contains unfilled RGB fg" "yes" \
	"$(echo "$raw" | grep -q '38;2;55;55;65m' && echo yes || echo no)"

# Verify dim bar at 100% — all filled, no unfilled bg
raw=$(bun run "$TEST_TS" --bar 100 "200k" dim)
assert_eq "dim bar at 100% → no unfilled RGB bg" "no" \
	"$(echo "$raw" | grep -q '48;2;14;14;18m' && echo yes || echo no)"

# Verify 50% is teal-tinted (>40 bracket)
raw=$(bun run "$TEST_TS" --bar 50 "200k" dim)
assert_eq "dim bar at 50% → teal hue (G dominant)" "yes" \
	"$(echo "$raw" | grep -q '48;2;12;45;25m' && echo yes || echo no)"

# Verify 55% is amber-tinted (>50 bracket)
raw=$(bun run "$TEST_TS" --bar 55 "200k" dim)
assert_eq "dim bar at 55% → amber hue (R > G > B)" "yes" \
	"$(echo "$raw" | grep -q '48;2;60;38;10m' && echo yes || echo no)"

# Verify 70%+ is red-tinted
raw=$(bun run "$TEST_TS" --bar 80 "200k" dim)
assert_eq "dim bar at 80% → red hue" "yes" \
	"$(echo "$raw" | grep -q '48;2;60;15;15m' && echo yes || echo no)"

# Verify vivid text is always white (fg 231)
raw=$(bun run "$TEST_TS" --bar 50 "200k" vivid)
assert_eq "vivid bar at 50% → text uses white fg (231)" "yes" \
	"$(echo "$raw" | grep -q '38;5;231m' && echo yes || echo no)"

raw=$(bun run "$TEST_TS" --bar 80 "200k" vivid)
assert_eq "vivid bar at 80% → text uses white fg (231)" "yes" \
	"$(echo "$raw" | grep -q '38;5;231m' && echo yes || echo no)"

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

# 0% — everything unfilled
raw=$(bun run "$TEST_TS" --bar 0 "200k" vivid | strip_ansi)
assert_eq "bar(0%, 200k, vivid) → starts with ' 0%'" " 0%" "$(printf '%s' "$raw" | cut -c1-3)"

# 100% — everything filled
raw=$(bun run "$TEST_TS" --bar 100 "200k" vivid | strip_ansi)
assert_eq "bar(100%, 200k, vivid) → ends with '00k'" "00k" "$(printf '%s' "$raw" | rev | cut -c1-3 | rev)"

# BAR_SLOTS is fixed — 3-digit pct still 11 chars
w=$(visible_width "$(bun run "$TEST_TS" --bar 100 "200k" vivid)")
assert_eq "bar(100%, 200k, vivid) → visible width = 11" "11" "$w"

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
