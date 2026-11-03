/** How a haptic feels. Both run 0–1. Intensity is strength. Sharpness is character: 0 is a dull, round thud; 1 is a crisp, precise click. */
export type Feel = { intensity?: number; sharpness?: number };

/** One event in a pattern. `time` and `duration` are seconds from the pattern's start. */
export type HapticEvent =
  | ({ type: 'transient'; time: number } & Feel)
  | ({ type: 'continuous'; time: number; duration: number } & Feel);

/**
 * Changes a parameter of every event over time. `time` is when the curve starts, points' `time` is relative to it, all in seconds.
 * An intensity curve scales the events' intensity (0–1). A sharpness curve is added to their sharpness (−1–1, iOS only).
 */
export type HapticCurve = {
  parameter: 'intensity' | 'sharpness';
  time?: number;
  points: { time: number; value: number }[];
};

export type HapticPattern = { events: HapticEvent[]; curves?: HapticCurve[] };

export type HapticErrorEvent = { message: string };

export type ExpoHapticsAdvancedEvents = { onError: (event: HapticErrorEvent) => void };
