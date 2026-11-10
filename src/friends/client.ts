import { getAccessToken } from '../auth/session';
import { parseSharedRecap, type SharedRecap } from './shape';

const ENDPOINT = `${import.meta.env.BASE_URL}api/friends`;

/** Thrown with a message that is safe to show as-is. */
export class FriendsError extends Error {
  override name = 'FriendsError';
}

async function call(method: 'GET' | 'PUT' | 'DELETE', query = '', body?: SharedRecap): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}${query}`, {
      method,
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new FriendsError('Couldn’t reach Larpify. Check your connection.');
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data: unknown = isJson ? await res.json() : null;
  if (!isJson || res.status === 501) throw new FriendsError('Friends aren’t set up on this site yet.');
  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error;
    throw new FriendsError(message ?? 'Something went wrong. Try again.');
  }
  return data;
}

export async function getSharing(): Promise<{ sharing: boolean; code: string | null }> {
  return (await call('GET')) as { sharing: boolean; code: string | null };
}

export async function startSharing(recap: SharedRecap): Promise<string> {
  return ((await call('PUT', '', recap)) as { code: string }).code;
}

export async function stopSharing(): Promise<void> {
  await call('DELETE');
}

export async function lookupFriend(code: string): Promise<SharedRecap> {
  const recap = parseSharedRecap(await call('GET', `?code=${encodeURIComponent(code)}`), Date.now());
  if (!recap) throw new FriendsError('No one is sharing with that code.');
  return recap;
}
