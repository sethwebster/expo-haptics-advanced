import { NativeModule, registerWebModule } from 'expo';
/** The web has no haptics with intensity or sharpness: unsupported, and every call does nothing. */
class ExpoHapticsAdvancedModule extends NativeModule {
    isSupported() {
        return false;
    }
    prepare() { }
    tap() { }
    startTexture() { }
    setTexture() { }
    stopTexture() { }
    playPattern() { }
    stop() { }
}
export default registerWebModule(ExpoHapticsAdvancedModule, 'ExpoHapticsAdvanced');
//# sourceMappingURL=ExpoHapticsAdvancedModule.web.js.map