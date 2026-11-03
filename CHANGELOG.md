# Changelog

## 0.1.1

- iOS: a texture can no longer keep playing out of reach of `texture.stop()` after the engine stops and restarts, and it plays again on the
  next `texture.set` after an interruption or a return from the background.
- Android: `stop()` no longer drops the call made right after it; a texture no longer sticks at an old strength after `stop()`, or stays
  silent after a tap; a pattern stops a playing texture; a silent pattern no longer errors; haptics follow the touch feedback setting.
- Both: the texture stops when the app leaves the foreground. Calls run in the order they were made.
- API: `isSupported` is a function, `prepare` and `playPattern` return nothing (failures go to `addErrorListener`), `playPattern` throws
  a `RangeError` for a non-finite time or value, a continuous event without a positive duration, or a pattern over 30 s
  (`MAX_PATTERN_SECONDS`). Curve points are sorted. Requires Expo SDK 58 or later.

## 0.1.0

- First release: `tap`, `texture` (start, set, stop), `playPattern`, `prepare`, `stop`, `isSupported` and `addErrorListener`, on iOS (Core Haptics)
  and Android (amplitude-controlled vibration). The web is unsupported: every call does nothing.
