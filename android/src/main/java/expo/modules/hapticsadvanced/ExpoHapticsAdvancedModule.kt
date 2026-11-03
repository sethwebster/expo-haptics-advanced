package expo.modules.hapticsadvanced

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import expo.modules.kotlin.types.Enumerable

enum class EventType(val value: String) : Enumerable {
  TRANSIENT("transient"),
  CONTINUOUS("continuous")
}

enum class CurveParameter(val value: String) : Enumerable {
  INTENSITY("intensity"),
  SHARPNESS("sharpness")
}

class PatternEvent : Record {
  @Field val type: EventType = EventType.TRANSIENT
  @Field val time: Double = 0.0
  @Field val duration: Double = 0.0
  @Field val intensity: Double = 1.0
  @Field val sharpness: Double = 0.5
}

class CurvePoint : Record {
  @Field val time: Double = 0.0
  @Field val value: Double = 0.0
}

class PatternCurve : Record {
  @Field val parameter: CurveParameter = CurveParameter.INTENSITY
  @Field val time: Double = 0.0
  @Field val points: List<CurvePoint> = emptyList()
}

class ExpoHapticsAdvancedModule : Module() {
  private var created: VibratorPlayer? = null

  /** Made on first use, when the React context exists; teardown never makes one. */
  private val player: VibratorPlayer
    @Synchronized get() = created ?: VibratorPlayer(requireNotNull(appContext.reactContext) { "No React context" }) { message ->
      sendEvent("onError", mapOf("message" to message))
    }.also { created = it }

  override fun definition() = ModuleDefinition {
    Name("ExpoHapticsAdvanced")

    Events("onError")

    // Every call is a sync Function: each one queues its work on the main looper and returns, so calls run in the order JS made them.
    Function("isSupported") { player.supported }

    Function("prepare") { }

    Function("tap") { intensity: Double, sharpness: Double -> player.tap(intensity, sharpness) }

    Function("startTexture") { intensity: Double, sharpness: Double -> player.startTexture(intensity, sharpness) }

    Function("setTexture") { intensity: Double?, sharpness: Double? -> player.setTexture(intensity, sharpness) }

    Function("stopTexture") { player.stopTexture() }

    Function("playPattern") { events: List<PatternEvent>, curves: List<PatternCurve> -> player.play(events, curves) }

    Function("stop") { player.stop() }

    // A texture never outlives the app's time on screen, whether or not JS gets to stop it.
    OnActivityEntersBackground { created?.stopTexture() }

    OnDestroy { created?.stop() }
  }
}
