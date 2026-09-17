'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { GATE_COOKIE, GATE_COOKIE_OPTIONS, safeNext } from '../src/gate';

/** "YES, 18+": the only way to get a demo served. Returns to the demo the visitor asked for, if any. */
export async function confirmAge(formData: FormData) {
  const store = await cookies();
  store.set(GATE_COOKIE, '1', GATE_COOKIE_OPTIONS);
  // Next re-renders the page in place, so the rows fade from grey into colour through their CSS
  // transitions; #games brings the list into view.
  redirect(safeNext(formData.get('next')) ?? '/#games');
}

/** "NO": grants nothing and stores nothing. */
export async function declineAge() {
  redirect('/?declined=1');
}
