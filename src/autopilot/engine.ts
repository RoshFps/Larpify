// The autopilot's decision logic, kept free of timers and network calls so it
// can be tested on its own. The hook feeds it one observation per poll.

export type Phase = 'off' | 'watching' | 'engaged';

export interface EngineState {
  phase: Phase;
  /** When nothing started playing anywhere; null while the user is listening. */
  idleSince: number | null;
  engagedAt: number | null;
}

export interface Observation {
  now: number;
  /** What Spotify reports for the account, or null when no device is active. */
  playback: { isPlaying: boolean; deviceId: string | null } | null;
  ourDeviceId: string | null;
}

export interface EngineConfig {
  idleMs: number;
  /** Ignore "not playing" this soon after starting; Spotify's state lags behind. */
  startGraceMs: number;
}

export type Decision = 'none' | 'start';

export const initialState: EngineState = { phase: 'off', idleSince: null, engagedAt: null };

export function setEnabled(state: EngineState, enabled: boolean, now: number): EngineState {
  if (!enabled) return initialState;
  if (state.phase !== 'off') return state;
  return { phase: 'watching', idleSince: now, engagedAt: null };
}

export function step(
  state: EngineState,
  { now, playback, ourDeviceId }: Observation,
  { idleMs, startGraceMs }: EngineConfig,
): { state: EngineState; decision: Decision } {
  const playingOnOurs = !!playback?.isPlaying && !!ourDeviceId && playback.deviceId === ourDeviceId;
  const playingElsewhere = !!playback?.isPlaying && !playingOnOurs;

  switch (state.phase) {
    case 'off':
      return { state, decision: 'none' };

    case 'watching': {
      if (playback?.isPlaying) {
        return { state: { ...state, idleSince: null }, decision: 'none' };
      }
      const idleSince = state.idleSince ?? now;
      if (ourDeviceId && now - idleSince >= idleMs) {
        return { state: { phase: 'engaged', idleSince: null, engagedAt: now }, decision: 'start' };
      }
      return { state: { ...state, idleSince }, decision: 'none' };
    }

    case 'engaged': {
      if (playingOnOurs) return { state, decision: 'none' };
      if (playingElsewhere) {
        // The user picked up their phone or desktop app; get out of the way.
        return { state: { phase: 'watching', idleSince: null, engagedAt: null }, decision: 'none' };
      }
      if (state.engagedAt !== null && now - state.engagedAt < startGraceMs) {
        return { state, decision: 'none' };
      }
      // Paused or ran out of tracks. Start the idle clock again so a paused
      // tab resumes only after another full idle period.
      return { state: { phase: 'watching', idleSince: now, engagedAt: null }, decision: 'none' };
    }
  }
}

/** Call when starting playback failed, so the next attempt waits a full idle period. */
export function startFailed(now: number): EngineState {
  return { phase: 'watching', idleSince: now, engagedAt: null };
}
