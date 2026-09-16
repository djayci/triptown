// Verifies the production/preview audit chain: pnpm --filter @triptown/api audit:verify
import { verifyAuditChain } from '@triptown/core';
import { RedisAuditLog } from '../src/audit-log';
import { nodeCrypto } from '../src/node-crypto';
import { upstashRedis } from '../src/redis-clients';

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
if (!url || !token) {
  console.error('Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
  process.exit(2);
}
const log = new RedisAuditLog(upstashRedis(url, token), { now: () => Date.now() });
const entries = await log.readAll();
const result = verifyAuditChain(entries, nodeCrypto);
if (result.ok) {
  console.info(`audit chain OK: ${result.entries} entries`);
} else {
  console.error(`audit chain BROKEN at seq ${result.brokenAt}: ${result.reason}`);
  process.exit(1);
}
