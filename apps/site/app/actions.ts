'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GATE_COOKIE, GATE_COOKIE_OPTIONS, safeNext } from '../src/gate';

/** "YES, 18+": the only way to get a demo served. Returns to the demo the visitor asked for, if any. */
export async function confirmAge(formData: FormData) {
  const store = await cookies();
  store.set(GATE_COOKIE, '1', GATE_COOKIE_OPTIONS);
  // Back to the list lands with ?unlocked=1 so the rows fade into colour once, not on every later visit.
  redirect(safeNext(formData.get('next')) ?? '/?unlocked=1#games');
}

/** "NO": grants nothing and stores nothing. */
export async function declineAge() {
  redirect('/?declined=1');
}
