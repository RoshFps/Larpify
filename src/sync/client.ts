import { getAccessToken } from '../auth/session';
import { parseSyncDocument, type SyncDocument } from './shape';

const ENDPOINT = `${import.meta.env.BASE_URL}api/settings`;

/** Sync isn't set up on this deployment (or this is the local dev server). */
export class SyncUnavailable extends Error {
  override name = 'SyncUnavailable';
}

async function call(method: 'GET' | 'PUT', body?: SyncDocument): Promise<SyncDocument | null> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method,
      headers: {
        Authorization: `Bearer ${await getAccessToken()}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new Error('Offline');
  }
  if (res.status === 404 && method === 'GET') return null;
  // 501: storage not connected. The dev server answers /api with index.html, hence the content-type check.
  const isJson = res.headers.get('content-type')?.includes('application/json');
  if (res.status === 501 || !isJson) throw new SyncUnavailable();
  if (!res.ok) throw new Error(`Sync failed (${res.status})`);
  return parseSyncDocument(await res.json());
}

export const pullSettings = () => call('GET');
export const pushSettings = (doc: SyncDocument) => call('PUT', doc);
