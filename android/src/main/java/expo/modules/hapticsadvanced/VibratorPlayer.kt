package expo.modules.hapticsadvanced

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlin.math.roundToInt
import kotlin.math.roundToLong

/**
 * Android's vibrator plays one effect at a time and can't change a playing one, so a texture is a repeating waveform re-issued when its feel
 * changes enough to notice (amplitude in 16 steps, at most every [FRAME_MS]), and a tap pauses it for the tap's length. Every call runs on the
 * main looper, so the texture state never races.
 */
class VibratorPlayer(context: Context, private val onError: (String) -> Unit) {
  private val vibrator: Vibrator =
    if (Build.VERSION.SDK_INT >= 31) context.getSystemService(VibratorManager::class.java).defaultVibrator
    else @Suppress("DEPRECATION") context.getSystemService(Vibrator::class.java)
  private val main = Handler(Looper.getMainLooper())

  /** Amplitude control needs API 26 and hardware that has it; without it a vibrator is on or off, which can't make a texture or a tuned tap. */
  val supported: Boolean = Build.VERSION.SDK_INT >= 26 && vibrator.hasVibrator() && vibrator.hasAmplitudeControl()

  private var feel: Pair<Double, Double>? = null
  private var shown: Pair<Int, Long>? = null
  private var renderedAt = 0L
  private var pending = false
  private var heldUntil = 0L

  fun tap(intensity: Double, sharpness: Double) = run {
    val ms = tapMs(sharpness)
    // Android ignores a touch effect while a repeating one plays: the texture stops first, and comes back after the tap.
    if (shown != null) vibrator.cancel()
    vibrate(tapEffect(intensity, sharpness, ms))
    shown = null
    heldUntil = SystemClock.uptimeMillis() + ms
    if (feel != null) main.postDelayed({ render() }, ms)
  }

  fun startTexture(intensity: Double, sharpness: Double) = run {
    feel = intensity to sharpness
    shown = null
    render()
  }

  fun setTexture(intensity: Double, sharpness: Double) = run {
    if (feel == null) return@run
    feel = intensity to sharpness
    render()
  }

  fun stopTexture() = run {
    feel = null
    if (shown != null) vibrator.cancel()
    shown = null
  }

  fun play(events: List<PatternEvent>, curves: List<PatternCurve>) = run {
    feel = null
    shown = null
    val (timings, amplitudes) = waveform(events, curves)
    if (timings.isNotEmpty()) vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
  }

  fun stop() = run {
    feel = null
    shown = null
    main.removeCallbacksAndMessages(null)
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

  private fun vibrate(effect: VibrationEffect) = vibrator.vibrate(effect)

  /** Shows the current feel, at most once per frame: a later call inside the frame is folded into one trailing render. */
  private fun render() {
    val (intensity, sharpness) = feel ?: return
    val now = SystemClock.uptimeMillis()
    if (now < heldUntil) return
    if (now - renderedAt < FRAME_MS) {
      if (!pending) {
        pending = true
        main.postAtTime({ pending = false; render() }, renderedAt + FRAME_MS)
      }
      return
    }
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

  /** A haptic primitive where the device has them (API 30+): a click for a sharp tap, a thud (API 31+) for a dull one. Else a one-shot. */
  private fun tapEffect(intensity: Double, sharpness: Double, ms: Long): VibrationEffect {
    if (Build.VERSION.SDK_INT >= 30) {
      val primitive =
        if (sharpness < 0.5 && Build.VERSION.SDK_INT >= 31) VibrationEffect.Composition.PRIMITIVE_THUD
        else VibrationEffect.Composition.PRIMITIVE_CLICK
      if (vibrator.areAllPrimitivesSupported(primitive)) {
        return VibrationEffect.startComposition().addPrimitive(primitive, unit(intensity).toFloat()).compose()
      }
    }
    return VibrationEffect.createOneShot(ms, (unit(intensity) * 254).roundToInt() + 1)
  }

  /** Sharper is shorter: 8 ms at full sharpness, 30 ms at none. */
  private fun tapMs(sharpness: Double) = (30 - unit(sharpness) * 22).roundToLong()

  /**
   * A pattern as one waveform: sampled every [SAMPLE_MS], each sample the strongest event playing then (a transient lasts its tap length),
   * scaled by the intensity curves, then run-length encoded. Sharpness curves have no Android equivalent.
   */
  private fun waveform(events: List<PatternEvent>, curves: List<PatternCurve>): Pair<LongArray, IntArray> {
    val spans = events.map { e ->
      val start = (e.time * 1000).roundToLong()
      val length = if (e.type == EventType.CONTINUOUS) (e.duration * 1000).roundToLong() else tapMs(e.sharpness)
      Triple(start, start + length, unit(e.intensity))
    }
    val end = spans.maxOfOrNull { it.second } ?: return LongArray(0) to IntArray(0)
    val scales = curves.filter { it.parameter == CurveParameter.INTENSITY }
    val timings = mutableListOf<Long>()
    val amplitudes = mutableListOf<Int>()
    var t = 0L
    while (t < end) {
      var level = spans.filter { t >= it.first && t < it.second }.maxOfOrNull { it.third } ?: 0.0
      for (c in scales) level *= curveAt(c, t / 1000.0)
      val amplitude = (unit(level) * 255).roundToInt()
      if (amplitudes.lastOrNull() == amplitude) timings[timings.size - 1] += SAMPLE_MS
      else { timings += SAMPLE_MS; amplitudes += amplitude }
      t += SAMPLE_MS
    }
    return timings.toLongArray() to amplitudes.toIntArray()
  }

  /** A curve's value at time `t` (seconds, pattern time): linear between its points, held at the ends, 1 where it has none. */
  private fun curveAt(c: PatternCurve, t: Double): Double {
    val points = c.points.sortedBy { it.time }
    if (points.isEmpty()) return 1.0
    val local = t - c.time
    if (local <= points.first().time) return unit(points.first().value)
    for (i in 1 until points.size) {
      val a = points[i - 1]
      val b = points[i]
      if (local <= b.time) return unit(a.value + (b.value - a.value) * (local - a.time) / (b.time - a.time).coerceAtLeast(1e-9))
    }
    return unit(points.last().value)
  }

  private fun unit(v: Double) = v.coerceIn(0.0, 1.0)

  private companion object {
    const val FRAME_MS = 32L
    const val GRAIN_MS = 12L
    const val SAMPLE_MS = 4L
  }
}
