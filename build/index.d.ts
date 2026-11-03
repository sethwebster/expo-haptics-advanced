import type { EventSubscription } from 'expo';
import type { Feel, HapticErrorEvent, HapticPattern } from './ExpoHapticsAdvanced.types';
export * from './ExpoHapticsAdvanced.types';
/** The longest pattern played, in seconds: Core Haptics' longest continuous event. */
export declare const MAX_PATTERN_SECONDS = 30;
/**
 * Whether this device can play these haptics: iOS hardware with Core Haptics (iPhone 8 and later; not the simulator), or an Android vibrator
 * with amplitude control (API 26+). Where it can't, every call does nothing.
 */
export declare function isSupported(): boolean;
/**
 * Starts the haptic engine ahead of time so the first haptic plays without its start-up delay. Call it when a gesture begins. (iOS; Android
 * needs no warm-up.)
 */
export declare function prepare(): void;
/** One short haptic. Defaults: intensity 1, sharpness 0.5. */
export declare function tap({ intensity, sharpness }?: Feel): void;
/**
 * A continuous haptic you change while it plays, for a surface under a moving finger: drive its intensity from the finger's speed so a still
 * finger feels nothing. Taps play on top of it. There is one texture per app: starting one replaces any other.
 *
 * It plays until `texture.stop()` or `stop()`, until the app leaves the foreground, and on Android until a pattern plays.
 */
export declare const texture: {
    /** Starts the texture. Defaults: intensity 0.5, sharpness 0.5. Starting it again restarts it with the new feel. */
    start({ intensity, sharpness }?: Feel): void;
    /** Changes the playing texture; a field left out keeps its value. Does nothing when no texture is playing. Cheap enough for every gesture update. */
    set({ intensity, sharpness }: Feel): void;
    stop(): void;
};
/**
 * Plays a pattern of events and curves (the model of an Apple AHAP file), at most {@link MAX_PATTERN_SECONDS} long. Throws a RangeError for a
 * time or value that isn't finite, a continuous event without a positive duration, or a pattern that is too long; failures while playing
 * arrive at {@link addErrorListener}.
 */
export declare function playPattern({ events, curves }: HapticPattern): void;
/** Stops everything, the texture included, and releases the haptic engine. The next haptic starts it again. */
export declare function stop(): void;
/** Errors from the native haptic engine. Calls return before the haptic plays, so a failure arrives here, not as a thrown error. */
export declare function addErrorListener(listener: (event: HapticErrorEvent) => void): EventSubscription;
