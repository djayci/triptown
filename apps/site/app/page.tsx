import { cookies } from 'next/headers';
import { isConfirmed, safeNext } from '../src/gate';
import { confirmAge, declineAge } from './actions';
import { Home, type GateState } from './home';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page({ searchParams }: { searchParams: SearchParams }) {
  const [store, params] = await Promise.all([cookies(), searchParams]);
  const state: GateState = isConfirmed(store)
    ? 'confirmed'
    : params.declined === '1'
      ? 'declined'
      : 'ask';
  return (
    <Home
      state={state}
      next={safeNext(params.next)}
      confirmAction={confirmAge}
      declineAction={declineAge}
    />
  );
}
