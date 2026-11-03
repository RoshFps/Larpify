import { useCallback, useEffect, useState } from 'react';
import type { QuietHours } from '../autopilot/quietHours';
import { readJson, writeJson } from '../lib/storage';
import { SYNCED_KEYS, type SyncDocument } from '../sync/shape';

export interface SourceItem {
  id: string;
  uri: string;
  name: string;
  imageUrl: string | null;
}

export interface Settings {
  enabled: boolean;
  idleMinutes: number;
  source: 'playlist' | 'artists';
  playlist: SourceItem | null;
  artists: SourceItem[];
  volume: number;
  quietHours: QuietHours;
  /** When a synced setting last changed, on any device. 0 = never edited. */
  updatedAt: number;
}

const KEY = 'larpify.settings';

const DEFAULTS: Settings = {
  enabled: false,
  idleMinutes: 10,
  source: 'playlist',
  playlist: null,
  artists: [],
  volume: 0.6,
  quietHours: { enabled: true, start: 2, end: 8 },
  updatedAt: 0,
};

const touchesSynced = (patch: Partial<Settings>) => SYNCED_KEYS.some((key) => key in patch);

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...readJson<Partial<Settings>>(KEY) }));

  useEffect(() => writeJson(KEY, settings), [settings]);

  const update = useCallback(
    (patch: Partial<Settings>) =>
      setSettings((s) => ({ ...s, ...patch, updatedAt: touchesSynced(patch) ? Date.now() : s.updatedAt })),
    [],
  );

  /** Takes another device's newer settings, keeping this device's volume. */
  const applyRemote = useCallback(
    (doc: SyncDocument) =>
      setSettings((s) => (doc.updatedAt > s.updatedAt ? { ...s, ...doc.settings, updatedAt: doc.updatedAt } : s)),
    [],
  );

  return [settings, update, applyRemote] as const;
}

export function hasSource(settings: Settings): boolean {
  return settings.source === 'playlist' ? settings.playlist !== null : settings.artists.length > 0;
}
