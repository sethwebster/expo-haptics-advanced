import { NativeModule, requireNativeModule } from 'expo';

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
  points: { time: number; value: number }[];
};

/** Every call queues its work natively and returns, so calls run in the order they were made. */
export declare class ExpoHapticsAdvancedModule extends NativeModule<ExpoHapticsAdvancedEvents> {
  isSupported(): boolean;
  prepare(): void;
  tap(intensity: number, sharpness: number): void;
  startTexture(intensity: number, sharpness: number): void;
  setTexture(intensity: number | null, sharpness: number | null): void;
  stopTexture(): void;
  playPattern(events: NativeEvent[], curves: NativeCurve[]): void;
  stop(): void;
}

export default requireNativeModule<ExpoHapticsAdvancedModule>('ExpoHapticsAdvanced');
