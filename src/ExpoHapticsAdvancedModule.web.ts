import { NativeModule, registerWebModule } from 'expo';

import type { ExpoHapticsAdvancedEvents } from './ExpoHapticsAdvanced.types';

/** The web has no haptics with intensity or sharpness: unsupported, and every call does nothing. */
class ExpoHapticsAdvancedModule extends NativeModule<ExpoHapticsAdvancedEvents> {
  isSupported() {
    return false;
  }
  prepare() {}
  tap() {}
  startTexture() {}
  setTexture() {}
  stopTexture() {}
  playPattern() {}
  stop() {}
}

export default registerWebModule(ExpoHapticsAdvancedModule, 'ExpoHapticsAdvanced');
