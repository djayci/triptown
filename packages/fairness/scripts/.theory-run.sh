#!/bin/zsh
# Theoretical 10M-round reports. validateProfile refuses any config id without one
# (MIN_REPORT_ROUNDS), so a profile cannot play maths the repo has not proven.
cd "$(dirname "$0")/.."
for cfg in whack-crash/v4 whack-crash/v4-rising whack-crash/v3 whack-crash/v3-rising whack-crash/v3-rising+cap100; do
  echo "== $cfg"
  npx tsx scripts/simulate-rtp.ts --rounds 10000000 --seed 1 --config "$cfg" 2>&1 | tail -2
done
