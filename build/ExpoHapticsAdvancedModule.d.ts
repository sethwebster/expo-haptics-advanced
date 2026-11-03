import { NativeModule } from 'expo';
import type { ExpoHapticsAdvancedEvents } from './ExpoHapticsAdvanced.types';
type NativeEvent = {
    type: 'transient' | 'continuous';
    time: number;
    duration: number;
    intensity: number;
    sharpness: number;
};
type NativeCurve = {
    parameter: 'intensity' | 'sharpness';
    time: number;
    points: {
        time: number;
        value: number;
    }[];
};
export declare class ExpoHapticsAdvancedModule extends NativeModule<ExpoHapticsAdvancedEvents> {
    isSupported(): boolean;
    prepareAsync(): Promise<void>;
    tap(intensity: number, sharpness: number): void;
    startTexture(intensity: number, sharpness: number): void;
    setTexture(intensity: number, sharpness: number): void;
    stopTexture(): void;
    playPatternAsync(events: NativeEvent[], curves: NativeCurve[]): Promise<void>;
    stop(): void;
}
declare const _default: ExpoHapticsAdvancedModule;
export default _default;
