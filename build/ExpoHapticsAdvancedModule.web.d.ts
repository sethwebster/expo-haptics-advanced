import { NativeModule } from 'expo';
import type { ExpoHapticsAdvancedEvents } from './ExpoHapticsAdvanced.types';
/** The web has no haptics with intensity or sharpness: unsupported, and every call does nothing. */
declare class ExpoHapticsAdvancedModule extends NativeModule<ExpoHapticsAdvancedEvents> {
    isSupported(): boolean;
    prepare(): void;
    tap(): void;
    startTexture(): void;
    setTexture(): void;
    stopTexture(): void;
    playPattern(): void;
    stop(): void;
}
declare const _default: ExpoHapticsAdvancedModule;
export default _default;
