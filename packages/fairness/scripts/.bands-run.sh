#!/bin/zsh
# Rounding bands for the slow-pace ids at every stake level an active market actually offers:
# 20 = USD/EUR 0.20 minimum, 100 = GHS 1.00, 10000 = NGN 100.00.
cd "$(dirname "$0")/.."
for cfg in whack-crash/v4 whack-crash/v4-rising whack-crash/v3 whack-crash/v3-rising; do
  for stake in 20 100 10000; do
    echo "== $cfg stake $stake"
    npx tsx scripts/simulate-rtp.ts --rounds 4000000 --seed 1 --config "$cfg" \
      --stake-minor "$stake" --time-jitter-ms 50 --rounding halfup 2>&1 | tail -2
  done
done
node scripts/build-bands.mjs
npx tsx scripts/check-bands.mjs
