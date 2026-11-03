package expo.modules.hapticsadvanced

import android.content.Context
import android.media.AudioAttributes
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/**
 * Android's vibrator plays one effect at a time and can't change a playing one, so a texture is a repeating waveform re-issued when its feel
 * changes enough to notice (amplitude in 16 steps, at most every [FRAME_MS]), and a tap or a pattern replaces it: a tap for the tap's length,
 * a pattern for good. Every call runs on the main looper, in the order JS made it, so the texture state never races.
 */
class VibratorPlayer(context: Context, private val onError: (String) -> Unit) {
  private val vibrator: Vibrator =
    if (Build.VERSION.SDK_INT >= 31) context.getSystemService(VibratorManager::class.java).defaultVibrator
    else @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)
  private val main = Handler(Looper.getMainLooper())

  /** Amplitude control needs API 26 and hardware that has it; without it a vibrator is on or off, which can't make a texture or a tuned tap. */
  val supported: Boolean = Build.VERSION.SDK_INT >= 26 && vibrator.hasVibrator() && vibrator.hasAmplitudeControl()

  private var feel: Pair<Double, Double>? = null
  /** The texture effect playing now (amplitude, gap), or null when none is. */
  private var shown: Pair<Int, Long>? = null
  private var renderedAt = 0L
  private var heldUntil = 0L
  /** The one deferred render: after a throttled frame, or once a tap ends. */
  private val renderTask = Runnable { scheduled = false; render() }
  private var scheduled = false

  fun tap(intensity: Double, sharpness: Double) = run {
    val (effect, ms) = tapEffect(intensity, sharpness)
    // Android ignores a touch effect while a repeating one plays: the texture stops first, and comes back after the tap.
    if (shown != null) vibrator.cancel()
    shown = null
    vibrate(effect)
    heldUntil = SystemClock.uptimeMillis() + ms
    if (feel != null) renderAt(heldUntil)
  }

  fun startTexture(intensity: Double, sharpness: Double) = run {
    feel = intensity to sharpness
    shown = null
    render()
  }

  /** A null field keeps its value. Does nothing when no texture is playing. */
  fun setTexture(intensity: Double?, sharpness: Double?) = run {
    val (i, s) = feel ?: return@run
    feel = (intensity ?: i) to (sharpness ?: s)
    render()
  }

  fun stopTexture() = run { endTexture() }

  fun play(events: List<PatternEvent>, curves: List<PatternCurve>) = run {
    endTexture()
    val (timings, amplitudes) = waveform(events, curves)
    // A waveform with nothing to feel is refused by the platform; there is nothing to play.
    if (amplitudes.any { it > 0 }) vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
  }

  fun stop() = run {
    endTexture()
    heldUntil = 0
    vibrator.cancel()
  }

  private fun run(work: () -> Unit) {
    if (!supported) return
    main.post {
      try {
        work()
      } catch (e: Exception) {
        onError(e.message ?: e.toString())
      }
    }
  }

  private fun endTexture() {
    feel = null
    main.removeCallbacks(renderTask)
    scheduled = false
    if (shown != null) vibrator.cancel()
    shown = null
  }

  /** Touch usage: the haptics follow the user's touch feedback setting, as the system's own do. */
  private fun vibrate(effect: VibrationEffect) {
    if (Build.VERSION.SDK_INT >= 33) {
      vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_TOUCH))
    } else {
      @Suppress("DEPRECATION")
      vibrator.vibrate(
        effect,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_ASSISTANCE_SONIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build()
      )
    }
  }

  private fun renderAt(at: Long) {
    if (scheduled) main.removeCallbacks(renderTask)
    scheduled = true
    main.postAtTime(renderTask, at)
  }

  /** Shows the current feel, at most once per frame and never over a tap: a call inside either is deferred to one trailing render. */
  private fun render() {
    val (intensity, sharpness) = feel ?: return
    val now = SystemClock.uptimeMillis()
    if (now < heldUntil) return renderAt(heldUntil)
    if (now - renderedAt < FRAME_MS) return renderAt(renderedAt + FRAME_MS)
    // Sixteen amplitude steps; sharpness sets the grain: a dull texture is a solid buzz, a sharp one pulses with gaps up to GRAIN_MS.
    val amplitude = ((unit(intensity) * 15).roundToInt() * 17).coerceIn(0, 255)
    val gap = (unit(sharpness) * 3).roundToLong() * (GRAIN_MS / 3)
    if (shown == amplitude to gap) return
    renderedAt = now
    shown = amplitude to gap
    if (amplitude == 0) return vibrator.cancel()
    vibrate(
      if (gap == 0L) VibrationEffect.createWaveform(longArrayOf(1000), intArrayOf(amplitude), 0)
      else VibrationEffect.createWaveform(longArrayOf(GRAIN_MS, gap), intArrayOf(amplitude, 0), 0)
    )
  }

  /**
   * A haptic primitive where the device has them (API 30+): a click for a sharp tap, a thud (API 31+) for a dull one, held for the primitive's
   * own length where the device reports it (API 31+). Else a one-shot whose length follows sharpness.
   */
  private fun tapEffect(intensity: Double, sharpness: Double): Pair<VibrationEffect, Long> {
    val ms = tapMs(sharpness)
    if (Build.VERSION.SDK_INT >= 30) {
      val primitive =
        if (sharpness < 0.5 && Build.VERSION.SDK_INT >= 31) VibrationEffect.Composition.PRIMITIVE_THUD
        else VibrationEffect.Composition.PRIMITIVE_CLICK
      if (vibrator.areAllPrimitivesSupported(primitive)) {
        val length = if (Build.VERSION.SDK_INT >= 31) vibrator.getPrimitiveDurations(primitive)[0].toLong() else 0L
        return VibrationEffect.startComposition().addPrimitive(primitive, unit(intensity).toFloat()).compose() to maxOf(ms, length)
      }
    }
    return VibrationEffect.createOneShot(ms, (unit(intensity) * 254).roundToInt() + 1) to ms
  }

  /** Sharper is shorter: 8 ms at full sharpness, 30 ms at none. */
  private fun tapMs(sharpness: Double) = (30 - unit(sharpness) * 22).roundToLong()

  /**
   * A pattern as one waveform: sampled every [SAMPLE_MS] up to [MAX_PATTERN_MS], each sample the strongest event playing then (a transient
   * lasts its tap length), scaled by the intensity curves, then run-length encoded. Sharpness curves have no Android equivalent.
   */
  private fun waveform(events: List<PatternEvent>, curves: List<PatternCurve>): Pair<LongArray, IntArray> {
    val spans = events.map { e ->
      val start = (e.time * 1000).roundToLong()
      val length = if (e.type == EventType.CONTINUOUS) (e.duration * 1000).roundToLong() else tapMs(e.sharpness)
      Triple(start, start + length, unit(e.intensity))
    }
    val end = minOf(spans.maxOfOrNull { it.second } ?: 0L, MAX_PATTERN_MS)
    val scales = curves.filter { it.parameter == CurveParameter.INTENSITY }.map { it.time to it.points.sortedBy { p -> p.time } }
    val timings = mutableListOf<Long>()
    val amplitudes = mutableListOf<Int>()
    var t = 0L
    while (t < end) {
      var level = spans.filter { t >= it.first && t < it.second }.maxOfOrNull { it.third } ?: 0.0
      for ((start, points) in scales) level *= curveAt(points, t / 1000.0 - start)
      val amplitude = (unit(level) * 255).roundToInt()
      if (amplitudes.lastOrNull() == amplitude) timings[timings.size - 1] += SAMPLE_MS
      else { timings += SAMPLE_MS; amplitudes += amplitude }
      t += SAMPLE_MS
    }
    return timings.toLongArray() to amplitudes.toIntArray()
  }

  /** A curve's value at `t` seconds into it: linear between its points (sorted by time), held at the ends, 1 where it has none. */
  private fun curveAt(points: List<CurvePoint>, t: Double): Double {
    if (points.isEmpty()) return 1.0
    if (t <= points.first().time) return unit(points.first().value)
    for (i in 1 until points.size) {
      val a = points[i - 1]
      val b = points[i]
      if (t <= b.time) return unit(a.value + (b.value - a.value) * (t - a.time) / (b.time - a.time).coerceAtLeast(1e-9))
    }
    return unit(points.last().value)
  }

  private fun unit(v: Double) = v.coerceIn(0.0, 1.0)

  private companion object {
    const val FRAME_MS = 32L
    const val GRAIN_MS = 12L
    const val SAMPLE_MS = 4L
    /** The longest pattern played, as on iOS. */
    const val MAX_PATTERN_MS = 30_000L
  }
}
