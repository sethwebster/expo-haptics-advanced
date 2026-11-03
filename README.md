# expo-haptics-advanced

Haptics with a feel you control, for Expo and React Native apps:

- **Textures.** A continuous haptic you change while it plays. Drive it from a finger's speed and a surface feels grainy under a moving
  finger and still under a resting one.
- **Tuned taps.** Any intensity and sharpness, not three fixed weights. Taps play on top of a texture, so a detent lands as the finger
  crosses into something.
- **Patterns.** Transient and continuous events with intensity and sharpness curves: the model of Apple's AHAP files.

iOS uses Core Haptics (`CHHapticEngine`). Android uses an amplitude-controlled vibrator and haptic primitives where the device has them. It
works next to [`expo-haptics`](https://docs.expo.dev/versions/latest/sdk/haptics/), which keeps the system's standard impact, selection and
notification feedback.

## Install

```sh
npm install github:sethwebster/expo-haptics-advanced#v0.1.0
# or
pnpm add github:sethwebster/expo-haptics-advanced#v0.1.0
```

It includes native code: rebuild your app (`npx expo run:ios`, `npx expo run:android`, or an EAS build) after installing. It doesn't work in
Expo Go.

Built and tested with Expo SDK 58 (React Native 0.88). iOS 16.4 or later.

## Use

```ts
import * as Haptics from 'expo-haptics-advanced';

Haptics.tap({ intensity: 0.6, sharpness: 0.9 }); // a light, crisp tick
Haptics.tap({ intensity: 1, sharpness: 0.1 }); // a heavy, dull thud
```

A texture under a sliding finger, with a firm tap on each new item:

```ts
// When the gesture starts
void Haptics.prepare();
Haptics.texture.start({ intensity: 0, sharpness: 0.85 });

// On each gesture update: speed in points per second, full strength at 1500
Haptics.texture.set({ intensity: Math.abs(velocityX) / 1500 });

// When the finger crosses onto a new item
Haptics.tap({ intensity: 1, sharpness: 0.5 });

// When the gesture ends
Haptics.texture.stop();
```

A pattern:

```ts
await Haptics.playPattern({
  events: [
    { type: 'transient', time: 0, intensity: 1, sharpness: 0.3 },
    { type: 'transient', time: 0.15, intensity: 0.7, sharpness: 0.3 },
    { type: 'continuous', time: 0.4, duration: 0.6, intensity: 1, sharpness: 0.1 },
  ],
  curves: [
    {
      parameter: 'intensity',
      time: 0.4,
      points: [
        { time: 0, value: 1 },
        { time: 0.6, value: 0 },
      ],
    },
  ],
});
```

## API

Intensity and sharpness run 0–1. Intensity is strength. Sharpness is character: 0 is dull and round, 1 is crisp and precise.

| Call                                                  | What it does                                                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `isSupported`                                         | Whether the device can play these haptics. Where it can't, every call does nothing.                                                   |
| `prepare()`                                           | Starts the haptic engine ahead of time, so the first haptic plays without the engine's start-up delay. Call it when a gesture starts. |
| `tap({ intensity = 1, sharpness = 0.5 })`             | One short haptic.                                                                                                                     |
| `texture.start({ intensity = 0.5, sharpness = 0.5 })` | Starts a continuous haptic that plays until `texture.stop()`. Starting it again restarts it.                                          |
| `texture.set({ intensity?, sharpness? })`             | Changes the playing texture. A field left out keeps its value. Cheap enough to call on every gesture update.                          |
| `texture.stop()`                                      | Stops the texture.                                                                                                                    |
| `playPattern({ events, curves? })`                    | Plays a pattern. Resolves once it starts.                                                                                             |
| `stop()`                                              | Stops everything and releases the engine. The next haptic starts it again.                                                            |
| `addErrorListener(listener)`                          | Errors from the native engine. Calls return before the haptic plays, so failures arrive here, not as thrown errors.                   |

In a pattern, `time` and `duration` are seconds from the pattern's start. A curve's points are timed from the curve's own `time`. An
intensity curve scales the events' intensity (0–1). A sharpness curve is added to their sharpness (−1 to 1).

## Platforms

|              | iOS                                                        | Android                                                                                                                | Web     |
| ------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------- |
| Supported on | iPhone 8 and later                                         | API 26+ with amplitude control                                                                                         | Nothing |
| Tap          | Core Haptics transient                                     | Click or thud primitive (API 30+), else a one-shot whose length follows sharpness                                      | No-op   |
| Texture      | Looping continuous event with live intensity and sharpness | Repeating waveform, re-issued when its feel changes: 16 intensity steps, sharpness sets the grain, at most every 32 ms | No-op   |
| Pattern      | Core Haptics pattern                                       | One waveform sampled every 4 ms; intensity curves apply, sharpness curves don't                                        | No-op   |

On Android a tap pauses the texture for the tap's length, because a vibrator plays one effect at a time.

The iOS simulator has no haptics: `isSupported` is `false` there. Feel your haptics on a device.

## Example

`example/` is an Expo app with a slide picker, taps and a pattern:

```sh
npm install && npm pack
cd example && npm install && npx expo run:ios --device
```

## License

MIT
