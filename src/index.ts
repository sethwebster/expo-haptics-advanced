import type { EventSubscription } from 'expo';

import type { Feel, HapticErrorEvent, HapticPattern } from './ExpoHapticsAdvanced.types';
import Native from './ExpoHapticsAdvancedModule';

export * from './ExpoHapticsAdvanced.types';

/** The longest pattern played, in seconds: Core Haptics' longest continuous event. */
export const MAX_PATTERN_SECONDS = 30;

function finite(v: number, name: string): number {
  if (!Number.isFinite(v))
    throw new RangeError(`expo-haptics-advanced: ${name} must be a finite number, got ${v}`);
  return v;
}
const clamp = (v: number, low: number, high: number) => Math.min(high, Math.max(low, v));
const unit = (v: number, name: string) => clamp(finite(v, name), 0, 1);

/**
 * Whether this device can play these haptics: iOS hardware with Core Haptics (iPhone 8 and later; not the simulator), or an Android vibrator
 * with amplitude control (API 26+). Where it can't, every call does nothing.
 */
export function isSupported(): boolean {
  return Native.isSupported();
}

/**
 * Starts the haptic engine ahead of time so the first haptic plays without its start-up delay. Call it when a gesture begins. (iOS; Android
 * needs no warm-up.)
 */
export function prepare(): void {
  Native.prepare();
}

/** One short haptic. Defaults: intensity 1, sharpness 0.5. */
export function tap({ intensity = 1, sharpness = 0.5 }: Feel = {}): void {
  Native.tap(unit(intensity, 'intensity'), unit(sharpness, 'sharpness'));
}

/**
 * A continuous haptic you change while it plays, for a surface under a moving finger: drive its intensity from the finger's speed so a still
 * finger feels nothing. Taps play on top of it. There is one texture per app: starting one replaces any other.
 *
 * It plays until `texture.stop()` or `stop()`, until the app leaves the foreground, and on Android until a pattern plays.
 */
export const texture = {
  /** Starts the texture. Defaults: intensity 0.5, sharpness 0.5. Starting it again restarts it with the new feel. */
  start({ intensity = 0.5, sharpness = 0.5 }: Feel = {}): void {
    Native.startTexture(unit(intensity, 'intensity'), unit(sharpness, 'sharpness'));
  },
  /** Changes the playing texture; a field left out keeps its value. Does nothing when no texture is playing. Cheap enough for every gesture update. */
  set({ intensity, sharpness }: Feel): void {
    Native.setTexture(
      intensity === undefined ? null : unit(intensity, 'intensity'),
      sharpness === undefined ? null : unit(sharpness, 'sharpness')
    );
  },
  stop(): void {
    Native.stopTexture();
  },
};

/**
 * Plays a pattern of events and curves (the model of an Apple AHAP file), at most {@link MAX_PATTERN_SECONDS} long. Throws a RangeError for a
 * time or value that isn't finite, a continuous event without a positive duration, or a pattern that is too long; failures while playing
 * arrive at {@link addErrorListener}.
 */
export function playPattern({ events, curves = [] }: HapticPattern): void {
  if (events.length === 0)
    throw new RangeError('expo-haptics-advanced: a pattern needs at least one event');
  const nativeEvents = events.map((e, i) => {
    const time = clamp(finite(e.time, `events[${i}].time`), 0, Infinity);
    const duration = e.type === 'continuous' ? finite(e.duration, `events[${i}].duration`) : 0;
    if (e.type === 'continuous' && duration <= 0)
      throw new RangeError(
        `expo-haptics-advanced: events[${i}] is continuous and needs a positive duration`
      );
    return {
      type: e.type,
      time,
      duration,
      intensity: unit(e.intensity ?? 1, `events[${i}].intensity`),
      sharpness: unit(e.sharpness ?? 0.5, `events[${i}].sharpness`),
    };
  });
  const nativeCurves = curves
    .map((c, i) => ({
      parameter: c.parameter,
      time: clamp(finite(c.time ?? 0, `curves[${i}].time`), 0, Infinity),
      points: c.points
        .map((p, j) => ({
          time: clamp(finite(p.time, `curves[${i}].points[${j}].time`), 0, Infinity),
          value:
            c.parameter === 'sharpness'
              ? clamp(finite(p.value, `curves[${i}].points[${j}].value`), -1, 1)
              : unit(p.value, `curves[${i}].points[${j}].value`),
        }))
        .sort((a, b) => a.time - b.time),
    }))
    .filter((c) => c.points.length > 0);
  const length = Math.max(
    ...nativeEvents.map((e) => e.time + e.duration),
    ...nativeCurves.map((c) => c.time + (c.points[c.points.length - 1]?.time ?? 0))
  );
  if (length > MAX_PATTERN_SECONDS) {
    throw new RangeError(
      `expo-haptics-advanced: a pattern is at most ${MAX_PATTERN_SECONDS} s long, this one is ${length} s`
    );
  }
  Native.playPattern(nativeEvents, nativeCurves);
}

/** Stops everything, the texture included, and releases the haptic engine. The next haptic starts it again. */
export function stop(): void {
  Native.stop();
}

/** Errors from the native haptic engine. Calls return before the haptic plays, so a failure arrives here, not as a thrown error. */
export function addErrorListener(listener: (event: HapticErrorEvent) => void): EventSubscription {
  return Native.addListener('onError', listener);
}
