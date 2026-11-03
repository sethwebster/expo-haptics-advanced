import type { EventSubscription } from 'expo';
import type { Feel, HapticErrorEvent, HapticPattern } from './ExpoHapticsAdvanced.types';
export * from './ExpoHapticsAdvanced.types';
/**
 * Whether this device can play these haptics: iOS hardware with Core Haptics (iPhone 8 and later; not the simulator), or an Android vibrator
 * with amplitude control. Where it can't, every call does nothing.
 */
export declare const isSupported: boolean;
/** Starts the haptic engine ahead of time so the first haptic plays without its start-up delay. Call it when a gesture begins. */
export declare function prepare(): Promise<void>;
/** One short haptic. Defaults: intensity 1, sharpness 0.5. */
export declare function tap({ intensity, sharpness }?: Feel): void;
/**
 * A continuous haptic you change while it plays, for a surface under a moving finger: drive its intensity from the finger's speed so a still
 * finger feels nothing. Taps play on top of it. It runs until `stop()`; `set` is cheap enough to call on every gesture update.
 */
export declare const texture: {
    /** Starts the texture. Defaults: intensity 0.5, sharpness 0.5. Starting it again restarts it with the new feel. */
    start({ intensity, sharpness }?: Feel): void;
    /** Changes the playing texture; a field left out keeps its value. Does nothing when no texture is playing. */
    set(feel: Feel): void;
    stop(): void;
};
/** Plays a pattern of events and curves (the model of an Apple AHAP file). Resolves once it starts. */
export declare function playPattern({ events, curves }: HapticPattern): Promise<void>;
/** Stops everything, the texture included, and releases the haptic engine. The next haptic starts it again. */
export declare function stop(): void;
/** Errors from the native haptic engine. Calls return before the haptic plays, so a failure arrives here, not as a thrown error. */
export declare function addErrorListener(listener: (event: HapticErrorEvent) => void): EventSubscription;
