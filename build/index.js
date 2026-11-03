import Native from './ExpoHapticsAdvancedModule';
export * from './ExpoHapticsAdvanced.types';
const unit = (v) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
/**
 * Whether this device can play these haptics: iOS hardware with Core Haptics (iPhone 8 and later; not the simulator), or an Android vibrator
 * with amplitude control. Where it can't, every call does nothing.
 */
export const isSupported = Native.isSupported();
/** Starts the haptic engine ahead of time so the first haptic plays without its start-up delay. Call it when a gesture begins. */
export function prepare() {
    return Native.prepareAsync();
}
/** One short haptic. Defaults: intensity 1, sharpness 0.5. */
export function tap({ intensity = 1, sharpness = 0.5 } = {}) {
    Native.tap(unit(intensity), unit(sharpness));
}
let texturing = null;
/**
 * A continuous haptic you change while it plays, for a surface under a moving finger: drive its intensity from the finger's speed so a still
 * finger feels nothing. Taps play on top of it. It runs until `stop()`; `set` is cheap enough to call on every gesture update.
 */
export const texture = {
    /** Starts the texture. Defaults: intensity 0.5, sharpness 0.5. Starting it again restarts it with the new feel. */
    start({ intensity = 0.5, sharpness = 0.5 } = {}) {
        texturing = { intensity: unit(intensity), sharpness: unit(sharpness) };
        Native.startTexture(texturing.intensity, texturing.sharpness);
    },
    /** Changes the playing texture; a field left out keeps its value. Does nothing when no texture is playing. */
    set(feel) {
        if (!texturing)
            return;
        texturing = {
            intensity: unit(feel.intensity ?? texturing.intensity),
            sharpness: unit(feel.sharpness ?? texturing.sharpness),
        };
        Native.setTexture(texturing.intensity, texturing.sharpness);
    },
    stop() {
        texturing = null;
        Native.stopTexture();
    },
};
/** Plays a pattern of events and curves (the model of an Apple AHAP file). Resolves once it starts. */
export function playPattern({ events, curves = [] }) {
    return Native.playPatternAsync(events.map((e) => ({
        type: e.type,
        time: Math.max(0, e.time),
        duration: e.type === 'continuous' ? Math.max(0, e.duration) : 0,
        intensity: unit(e.intensity ?? 1),
        sharpness: unit(e.sharpness ?? 0.5),
    })), curves.map((c) => ({
        parameter: c.parameter,
        time: Math.max(0, c.time ?? 0),
        points: c.points.map((p) => ({
            time: Math.max(0, p.time),
            value: c.parameter === 'sharpness' ? Math.min(1, Math.max(-1, p.value)) : unit(p.value),
        })),
    })));
}
/** Stops everything, the texture included, and releases the haptic engine. The next haptic starts it again. */
export function stop() {
    texturing = null;
    Native.stop();
}
/** Errors from the native haptic engine. Calls return before the haptic plays, so a failure arrives here, not as a thrown error. */
export function addErrorListener(listener) {
    return Native.addListener('onError', listener);
}
//# sourceMappingURL=index.js.map