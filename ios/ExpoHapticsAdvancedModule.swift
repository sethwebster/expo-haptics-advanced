import CoreHaptics
import ExpoModulesCore

enum EventType: String, Enumerable {
  case transient
  case continuous
}

enum CurveParameter: String, Enumerable {
  case intensity
  case sharpness
}

struct PatternEvent: Record {
  @Field var type: EventType = .transient
  @Field var time: Double = 0
  @Field var duration: Double = 0
  @Field var intensity: Double = 1
  @Field var sharpness: Double = 0.5
}

struct CurvePoint: Record {
  @Field var time: Double = 0
  @Field var value: Double = 0
}

struct PatternCurve: Record {
  @Field var parameter: CurveParameter = .intensity
  @Field var time: Double = 0
  @Field var points: [CurvePoint] = []
}

public class ExpoHapticsAdvancedModule: Module {
  private let player = HapticPlayer()

  public func definition() -> ModuleDefinition {
    Name("ExpoHapticsAdvanced")

    Events("onError")

    OnCreate {
      self.player.errors { [weak self] message in self?.sendEvent("onError", ["message": message]) }
    }

    // Every call is a sync Function: each one queues its work and returns, so calls run in the order JS made them.
    Function("isSupported") { HapticPlayer.supported }

    Function("prepare") { self.player.prepare() }

    Function("tap") { (intensity: Double, sharpness: Double) in
      self.player.tap(.init(intensity: Float(intensity), sharpness: Float(sharpness)))
    }

    Function("startTexture") { (intensity: Double, sharpness: Double) in
      self.player.startTexture(.init(intensity: Float(intensity), sharpness: Float(sharpness)))
    }

    Function("setTexture") { (intensity: Double?, sharpness: Double?) in
      self.player.setTexture(intensity: intensity.map(Float.init), sharpness: sharpness.map(Float.init))
    }

    Function("stopTexture") { self.player.stopTexture() }

    Function("playPattern") { (events: [PatternEvent], curves: [PatternCurve]) in
      self.player.play(events.map(Self.event), curves.map(Self.curve))
    }

    Function("stop") { self.player.stop() }

    // A texture never outlives the app's time on screen, whether or not JS gets to stop it.
    OnAppEntersBackground { self.player.stopTexture() }

    OnDestroy { self.player.stop() }
  }

  private static func event(_ e: PatternEvent) -> CHHapticEvent {
    let parameters = HapticPlayer.parameters(.init(intensity: Float(e.intensity), sharpness: Float(e.sharpness)))
    return e.type == .continuous
      ? CHHapticEvent(eventType: .hapticContinuous, parameters: parameters, relativeTime: e.time, duration: e.duration)
      : CHHapticEvent(eventType: .hapticTransient, parameters: parameters, relativeTime: e.time)
  }

  private static func curve(_ c: PatternCurve) -> CHHapticParameterCurve {
    CHHapticParameterCurve(
      parameterID: c.parameter == .sharpness ? .hapticSharpnessControl : .hapticIntensityControl,
      controlPoints: c.points.map { .init(relativeTime: $0.time, value: Float($0.value)) },
      relativeTime: c.time
    )
  }
}
