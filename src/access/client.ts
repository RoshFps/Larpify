import { getAccessToken } from '../auth/session';
import type { AccessRequest } from './shape';

const ENDPOINT = `${import.meta.env.BASE_URL}api/access-requests`;

async function errorFrom(res: Response): Promise<Error> {
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) return new Error(body.error);
  } catch {
    // Not JSON: most likely the API isn't deployed here.
  }
  return new Error('Requests aren’t available on this site yet.');
}

/** Public: anyone can ask to be added. `website` is the hidden bot trap. */
export async function requestAccess(name: string, email: string, website: string): Promise<void> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, website }),
  });
  if (!res.ok) throw await errorFrom(res);
}

export type RequestList = { status: 'owner'; requests: AccessRequest[] } | { status: 'not-owner' };

/** Owner only. Anyone else gets `not-owner`, which hides the Requests page. */
export async function listAccessRequests(): Promise<RequestList> {
  const res = await fetch(ENDPOINT, {
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
    cache: 'no-store',
  });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (!res.ok || !isJson) return { status: 'not-owner' };
  return { status: 'owner', requests: ((await res.json()) as { requests: AccessRequest[] }).requests };
}

export async function removeAccessRequest(email: string): Promise<void> {
  const res = await fetch(`${ENDPOINT}?email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${await getAccessToken()}` },
  });
  if (!res.ok) throw await errorFrom(res);
}
