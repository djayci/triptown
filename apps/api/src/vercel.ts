import { handle } from 'hono/vercel';
import { appFromEnv } from './app';

const handler = handle(await appFromEnv());

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const OPTIONS = handler;
