import { serve } from '@hono/node-server';
import { appFromEnv } from './app';

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: (await appFromEnv()).fetch, port });
console.info(`api listening on http://localhost:${port}`);
