import { NativeModule, registerWebModule } from 'expo';

import type { ExpoHapticsAdvancedEvents } from './ExpoHapticsAdvanced.types';

/** The web has no haptics with intensity or sharpness: unsupported, and every call does nothing. */
class ExpoHapticsAdvancedModule extends NativeModule<ExpoHapticsAdvancedEvents> {
  isSupported() {
    return false;
  }
  async prepareAsync() {}
  tap() {}
  startTexture() {}
  setTexture() {}
  stopTexture() {}
  async playPatternAsync() {}
  stop() {}
}

export default registerWebModule(ExpoHapticsAdvancedModule, 'ExpoHapticsAdvanced');
