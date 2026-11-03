import { describe, expect, it } from 'vitest';
import { initialState, setEnabled, startFailed, step, type EngineState, type Observation } from './engine';

const config = { idleMs: 10 * 60_000, startGraceMs: 15_000 };
const OURS = 'tab-device';
const PHONE = 'phone-device';

function observe(
  now: number,
  playback: Observation['playback'],
  ourDeviceId: string | null = OURS,
  quiet = false,
): Observation {
  return { now, playback, ourDeviceId, quiet };
}

describe('autopilot engine', () => {
  it('does nothing while off', () => {
    const { state, decision } = step(initialState, observe(1e9, null), config);
    expect(decision).toBe('none');
    expect(state).toBe(initialState);
  });

  it('starts once the account has been idle for the full period', () => {
    let state = setEnabled(initialState, true, 0);
    let result = step(state, observe(config.idleMs - 1, null), config);
    expect(result.decision).toBe('none');
    state = result.state;

    result = step(state, observe(config.idleMs, null), config);
    expect(result.decision).toBe('start');
    expect(result.state.phase).toBe('engaged');
  });

  it('treats a paused player the same as no player', () => {
    const state = setEnabled(initialState, true, 0);
    const result = step(state, observe(config.idleMs, { isPlaying: false, deviceId: PHONE }), config);
    expect(result.decision).toBe('start');
  });

  it('resets the idle clock while the user is listening anywhere', () => {
    let state = setEnabled(initialState, true, 0);
    state = step(state, observe(5 * 60_000, { isPlaying: true, deviceId: PHONE }), config).state;
    expect(state.idleSince).toBeNull();

    // Stops listening at 6 min; must wait another full period from then.
    state = step(state, observe(6 * 60_000, null), config).state;
    expect(step(state, observe(15 * 60_000, null), config).decision).toBe('none');
    expect(step(state, observe(16 * 60_000, null), config).decision).toBe('start');
  });

  it('waits for the tab player before starting', () => {
    const state = setEnabled(initialState, true, 0);
    const result = step(state, observe(config.idleMs * 2, null, null), config);
    expect(result.decision).toBe('none');
    expect(result.state.phase).toBe('watching');
  });

  it('backs off when the user starts playing on another device', () => {
    const engaged: EngineState = { phase: 'engaged', idleSince: null, engagedAt: 0 };
    const result = step(engaged, observe(60_000, { isPlaying: true, deviceId: PHONE }), config);
    expect(result.state).toEqual({ phase: 'watching', idleSince: null, engagedAt: null });
  });

  it('stays engaged while playing on the tab', () => {
    const engaged: EngineState = { phase: 'engaged', idleSince: null, engagedAt: 0 };
    const result = step(engaged, observe(60_000, { isPlaying: true, deviceId: OURS }), config);
    expect(result.state).toBe(engaged);
  });

  it('ignores a stale "not playing" right after starting', () => {
    const engaged: EngineState = { phase: 'engaged', idleSince: null, engagedAt: 0 };
    expect(step(engaged, observe(5_000, null), config).state.phase).toBe('engaged');
  });

  it('goes back to watching with a fresh idle clock once playback stops', () => {
    const engaged: EngineState = { phase: 'engaged', idleSince: null, engagedAt: 0 };
    const result = step(engaged, observe(60_000, { isPlaying: false, deviceId: OURS }), config);
    expect(result.state).toEqual({ phase: 'watching', idleSince: 60_000, engagedAt: null });
  });

  it('turning off clears everything and turning on twice keeps the clock', () => {
    const watching = setEnabled(initialState, true, 100);
    expect(setEnabled(watching, true, 999)).toBe(watching);
    expect(setEnabled(watching, false, 999)).toEqual(initialState);
  });

  it('waits a full period after a failed start', () => {
    expect(startFailed(500)).toEqual({ phase: 'watching', idleSince: 500, engagedAt: null });
  });

  it('never starts during quiet hours, and starts right after they end', () => {
    const state = setEnabled(initialState, true, 0);
    const quiet = step(state, observe(config.idleMs * 5, null, OURS, true), config);
    expect(quiet.decision).toBe('none');
    // The idle clock kept running, so playback starts as soon as quiet hours end.
    expect(step(quiet.state, observe(config.idleMs * 5 + 1, null), config).decision).toBe('start');
  });

  it('pauses the tab when quiet hours begin mid-session', () => {
    const engaged: EngineState = { phase: 'engaged', idleSince: null, engagedAt: 0 };
    const result = step(engaged, observe(60_000, { isPlaying: true, deviceId: OURS }, OURS, true), config);
    expect(result.decision).toBe('stop');
    expect(result.state).toEqual({ phase: 'watching', idleSince: 60_000, engagedAt: null });
  });

  it('leaves the user\'s own playback alone during quiet hours', () => {
    const engaged: EngineState = { phase: 'engaged', idleSince: null, engagedAt: 0 };
    const result = step(engaged, observe(60_000, { isPlaying: true, deviceId: PHONE }, OURS, true), config);
    expect(result.decision).toBe('none');
  });
});
