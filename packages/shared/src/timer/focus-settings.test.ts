import { describe, expect, it } from 'vitest';
import {
  addFocusPreset,
  clockGroups,
  DEFAULT_FOCUS_SETTINGS,
  DEFAULT_TIMER_FACE,
  faceReadout,
  MAX_FOCUS_PRESETS,
  parseFocusSettings,
  parseTimerFace,
  removeFocusPreset,
  serialiseFocusSettings,
  toFocusMinutes,
  TIMER_FACES,
  TIMER_FACE_NAMES,
} from './focus-settings';
import { createTimer, pause, start } from './timer';

const T0 = 1_700_000_000_000;

describe('focus lengths', () => {
  it('accepts any whole number of minutes from 1 to 240', () => {
    expect(toFocusMinutes(1)).toBe(1);
    expect(toFocusMinutes(37)).toBe(37);
    expect(toFocusMinutes(' 240 ')).toBe(240);
  });

  it('refuses anything else', () => {
    for (const value of [0, 241, 2.5, '', 'ten', null, undefined, Number.NaN]) {
      expect(toFocusMinutes(value)).toBeNull();
    }
  });
});

describe('focus settings', () => {
  it('round-trips', () => {
    const settings = {
      presets: [20, 37],
      minutes: 37,
      alert: 'vibrate' as const,
      keepAwake: false,
    };

    expect(parseFocusSettings(serialiseFocusSettings(settings))).toEqual(settings);
  });

  it('falls back to the defaults for nothing, junk or the wrong shape', () => {
    for (const stored of [null, '{nope', '[]', '"text"', 'null']) {
      expect(parseFocusSettings(stored)).toEqual(DEFAULT_FOCUS_SETTINGS);
    }
  });

  it('keeps the good fields of a partly bad value', () => {
    const settings = parseFocusSettings(
      JSON.stringify({
        presets: [90, 'x', 10, 10, 999, 45],
        minutes: 0,
        alert: 'loud',
        keepAwake: 'yes',
      }),
    );

    expect(settings).toEqual({ ...DEFAULT_FOCUS_SETTINGS, presets: [10, 45, 90] });
  });

  it('keeps an empty preset list, which the student chose', () => {
    expect(parseFocusSettings(JSON.stringify({ presets: [] })).presets).toEqual([]);
  });

  it('adds presets in order, once, up to the limit', () => {
    const one = addFocusPreset(DEFAULT_FOCUS_SETTINGS, 37);
    expect(one.presets).toEqual([25, 37, 45, 60, 90]);
    expect(addFocusPreset(one, 37)).toBe(one);
    expect(addFocusPreset(one, 0)).toBe(one);

    const full = { ...DEFAULT_FOCUS_SETTINGS, presets: [5, 10, 15, 20, 25, 30] };
    expect(full.presets).toHaveLength(MAX_FOCUS_PRESETS);
    expect(addFocusPreset(full, 40)).toBe(full);
  });

  it('removes a preset', () => {
    expect(removeFocusPreset(DEFAULT_FOCUS_SETTINGS, 45).presets).toEqual([25, 60, 90]);
  });
});

describe('timer faces', () => {
  it('reads a stored face, defaulting to flip cards', () => {
    expect(parseTimerFace('tide')).toBe('tide');
    expect(parseTimerFace('disco')).toBe(DEFAULT_TIMER_FACE);
    expect(parseTimerFace(null)).toBe('flip');
  });

  it('names every face', () => {
    for (const face of TIMER_FACES) expect(TIMER_FACE_NAMES[face].length).toBeGreaterThan(0);
  });

  it('groups digits as minutes and seconds, with hours only when needed', () => {
    expect(clockGroups(1499)).toEqual(['24', '59']);
    expect(clockGroups(0)).toEqual(['00', '00']);
    expect(clockGroups(3900)).toEqual(['1', '05', '00']);
    expect(clockGroups(-5)).toEqual(['00', '00']);
  });

  it('counts a countdown down and measures how far through it is', () => {
    const timer = start(createTimer({ mode: 'custom', targetSeconds: 600 }), T0);

    expect(faceReadout(timer, T0)).toEqual({
      seconds: 600,
      countsDown: true,
      fraction: 0,
      groups: ['10', '00'],
    });
    expect(faceReadout(timer, T0 + 150_000)).toMatchObject({ seconds: 450, fraction: 0.25 });
    expect(faceReadout(timer, T0 + 900_000)).toMatchObject({ seconds: 0, fraction: 1 });
  });

  it('holds still while paused', () => {
    const paused = pause(
      start(createTimer({ mode: 'custom', targetSeconds: 600 }), T0),
      T0 + 60_000,
    );

    expect(faceReadout(paused, T0 + 500_000).seconds).toBe(540);
  });

  it('counts a stopwatch up, going round once an hour', () => {
    const timer = start(createTimer({ mode: 'stopwatch' }), T0);

    expect(faceReadout(timer, T0 + 900_000)).toMatchObject({
      seconds: 900,
      countsDown: false,
      fraction: 0.25,
    });
    expect(faceReadout(timer, T0 + 4_500_000).fraction).toBeCloseTo(0.25);
  });

  it('measures a Pomodoro phase against its own length', () => {
    const timer = start(createTimer({ mode: 'pomodoro' }), T0);

    expect(faceReadout(timer, T0 + 750_000)).toMatchObject({ seconds: 750, fraction: 0.5 });
  });
});
