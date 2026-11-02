import { useCallback, useEffect, useState } from 'react';
import { readJson, writeJson } from '../lib/storage';

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
}

const KEY = 'larpify.settings';

const DEFAULTS: Settings = {
  enabled: false,
  idleMinutes: 10,
  source: 'playlist',
  playlist: null,
  artists: [],
  volume: 0.6,
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULTS, ...readJson<Partial<Settings>>(KEY) }));

  useEffect(() => writeJson(KEY, settings), [settings]);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  return [settings, update] as const;
}

export function hasSource(settings: Settings): boolean {
  return settings.source === 'playlist' ? settings.playlist !== null : settings.artists.length > 0;
}
