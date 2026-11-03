import CoreHaptics
import Foundation

/// Owns one CHHapticEngine and the looping texture player. Every call runs on one serial queue, so the engine, the texture and the
/// handlers Core Haptics calls on its own threads never race.
final class HapticPlayer {
  private let queue = DispatchQueue(label: "expo.modules.hapticsadvanced", qos: .userInteractive)
  private let onError: (String) -> Void
  private var engine: CHHapticEngine?
  private var running = false
  private var texture: CHHapticAdvancedPatternPlayer?
  /// The texture's feel while one is wanted: kept so a reset engine can bring it back.
  private var feel: Feel?

  static let supported = CHHapticEngine.capabilitiesForHardware().supportsHaptics

  struct Feel { var intensity: Float; var sharpness: Float }

  /// The texture's continuous event plays at full intensity and mid sharpness; the dynamic controls set its feel. Intensity control scales
  /// intensity (0–1); sharpness control is added to the event's sharpness (−1–1).
  private static let base: Float = 0.5
  /// A continuous event's longest duration; the player loops it.
  private static let loop: TimeInterval = 30

  init(onError: @escaping (String) -> Void) {
    self.onError = onError
  }

  func prepare() {
    run { _ = try $0.started() }
  }

  func tap(_ feel: Feel) {
    run { player in
      try player.retrying {
        let event = CHHapticEvent(eventType: .hapticTransient, parameters: Self.parameters(feel), relativeTime: 0)
        try $0.makePlayer(with: CHHapticPattern(events: [event], parameters: [])).start(atTime: CHHapticTimeImmediate)
      }
    }
  }

  func startTexture(_ feel: Feel) {
    run { player in
      player.feel = feel
      try player.beginTexture()
    }
  }

  func setTexture(_ feel: Feel) {
    run { player in
      guard player.feel != nil else { return }
      player.feel = feel
      guard let texture = player.texture else { return try player.beginTexture() }
      do {
        try texture.sendParameters(Self.controls(feel), atTime: CHHapticTimeImmediate)
      } catch {
        // The engine stopped under the texture (an idle or interrupted engine); start it again with the new feel.
        player.running = false
        try player.beginTexture()
      }
    }
  }

  func stopTexture() {
    run { player in
      player.feel = nil
      try? player.texture?.stop(atTime: CHHapticTimeImmediate)
      player.texture = nil
    }
  }

  func play(_ events: [CHHapticEvent], _ curves: [CHHapticParameterCurve]) {
    run { player in
      try player.retrying { try $0.makePlayer(with: CHHapticPattern(events: events, parameterCurves: curves)).start(atTime: CHHapticTimeImmediate) }
    }
  }

  func stop() {
    run { player in
      player.feel = nil
      player.texture = nil
      player.engine?.stop(completionHandler: nil)
      player.engine = nil
      player.running = false
    }
  }

  // MARK: - On the queue

  private func run(_ work: @escaping (HapticPlayer) throws -> Void) {
    guard Self.supported else { return }
    queue.async {
      do { try work(self) } catch { self.onError(error.localizedDescription) }
    }
  }

  private func started() throws -> CHHapticEngine {
    if let engine, running { return engine }
    let engine = try self.engine ?? make()
    try engine.start()
    running = true
    return engine
  }

  /// Runs `body` on a started engine. An engine can stop between two calls (idle shutdown, an interruption) before its stopped handler
  /// reaches the queue; the first failure marks it stopped and the second attempt starts it.
  private func retrying(_ body: (CHHapticEngine) throws -> Void) throws {
    do {
      try body(started())
    } catch {
      running = false
      try body(started())
    }
  }

  private func make() throws -> CHHapticEngine {
    let engine = try CHHapticEngine()
    engine.playsHapticsOnly = true
    engine.isAutoShutdownEnabled = true
    engine.stoppedHandler = { [weak self] _ in
      self?.queue.async {
        self?.running = false
        self?.texture = nil
        self?.feel = nil
      }
    }
    engine.resetHandler = { [weak self] in
      self?.queue.async {
        guard let self else { return }
        self.running = false
        self.texture = nil
        if self.feel != nil {
          do { try self.beginTexture() } catch { self.onError(error.localizedDescription) }
        }
      }
    }
    self.engine = engine
    return engine
  }

  private func beginTexture() throws {
    guard let feel else { return }
    try? texture?.stop(atTime: CHHapticTimeImmediate)
    texture = nil
    try retrying { engine in
      let event = CHHapticEvent(
        eventType: .hapticContinuous,
        parameters: Self.parameters(Feel(intensity: 1, sharpness: Self.base)),
        relativeTime: 0,
        duration: Self.loop
      )
      let player = try engine.makeAdvancedPlayer(with: CHHapticPattern(events: [event], parameters: []))
      player.loopEnabled = true
      try player.start(atTime: CHHapticTimeImmediate)
      try player.sendParameters(Self.controls(feel), atTime: CHHapticTimeImmediate)
      texture = player
    }
  }

  static func parameters(_ feel: Feel) -> [CHHapticEventParameter] {
    [
      CHHapticEventParameter(parameterID: .hapticIntensity, value: feel.intensity),
      CHHapticEventParameter(parameterID: .hapticSharpness, value: feel.sharpness),
    ]
  }

  private static func controls(_ feel: Feel) -> [CHHapticDynamicParameter] {
    [
      CHHapticDynamicParameter(parameterID: .hapticIntensityControl, value: feel.intensity, relativeTime: 0),
      CHHapticDynamicParameter(parameterID: .hapticSharpnessControl, value: feel.sharpness - base, relativeTime: 0),
    ]
  }
}
