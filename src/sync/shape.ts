// The settings that follow you between devices. Volume stays per device: the
// right level for a laptop speaker isn't the right level for a phone.

import type { QuietHours } from '../autopilot/quietHours.js';
import type { Settings, SourceItem } from '../settings/useSettings.js';

export const SYNCED_KEYS = ['enabled', 'idleMinutes', 'source', 'playlist', 'artists', 'quietHours'] as const;

export type SyncedSettings = Pick<Settings, (typeof SYNCED_KEYS)[number]>;

export interface SyncDocument {
  settings: SyncedSettings;
  /** Milliseconds since epoch of the edit that produced this document. */
  updatedAt: number;
}

export const MAX_DOCUMENT_BYTES = 8_000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function sourceItem(v: unknown): SourceItem | null {
  if (!isObject(v)) return null;
  const { id, uri, name, imageUrl } = v;
  if (typeof id !== 'string' || typeof uri !== 'string' || typeof name !== 'string') return null;
  if (!uri.startsWith('spotify:')) return null;
  return { id, uri, name, imageUrl: typeof imageUrl === 'string' && imageUrl.startsWith('https://') ? imageUrl : null };
}

function quietHours(v: unknown): QuietHours | null {
  if (!isObject(v)) return null;
  const { enabled, start, end } = v;
  const hour = (h: unknown) => Number.isInteger(h) && (h as number) >= 0 && (h as number) <= 23;
  if (typeof enabled !== 'boolean' || !hour(start) || !hour(end)) return null;
  return { enabled, start: start as number, end: end as number };
}

/**
 * Checks a document from the network field by field. Anything malformed is
 * rejected whole rather than half-applied, since it came from outside this tab.
 */
export function parseSyncDocument(value: unknown): SyncDocument | null {
  if (!isObject(value) || !isObject(value.settings)) return null;
  const { updatedAt } = value;
  const s = value.settings;
  if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) return null;
  if (typeof s.enabled !== 'boolean') return null;
  if (typeof s.idleMinutes !== 'number' || s.idleMinutes < 1 || s.idleMinutes > 120) return null;
  if (s.source !== 'playlist' && s.source !== 'artists') return null;

  const playlist = s.playlist === null ? null : sourceItem(s.playlist);
  if (s.playlist !== null && !playlist) return null;
  if (!Array.isArray(s.artists) || s.artists.length > 5) return null;
  const artists = s.artists.map(sourceItem);
  if (artists.some((a) => a === null)) return null;
  const quiet = quietHours(s.quietHours);
  if (!quiet) return null;

  return {
    updatedAt,
    settings: {
      enabled: s.enabled,
      idleMinutes: s.idleMinutes,
      source: s.source,
      playlist,
      artists: artists as SourceItem[],
      quietHours: quiet,
    },
  };
}

export function pickSynced(settings: Settings): SyncedSettings {
  return Object.fromEntries(SYNCED_KEYS.map((key) => [key, settings[key]])) as SyncedSettings;
}
