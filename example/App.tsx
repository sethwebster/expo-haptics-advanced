import * as Haptics from 'expo-haptics-advanced';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

const EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const CELL = 52;
/** Finger speed, in points per millisecond, at which the texture is at full strength. */
const FULL_SPEED = 1.5;

const heartbeat: Haptics.HapticPattern = {
  events: [
    { type: 'transient', time: 0, intensity: 1, sharpness: 0.3 },
    { type: 'transient', time: 0.15, intensity: 0.7, sharpness: 0.3 },
    { type: 'continuous', time: 0.4, duration: 0.6, intensity: 1, sharpness: 0.1 },
  ],
  curves: [{ parameter: 'intensity', time: 0.4, points: [{ time: 0, value: 1 }, { time: 0.6, value: 0 }] }],
};

/** Slide a finger along the row: the surface buzzes with your speed and each emoji lands with a firm tap. Lift to pick. */
function SlidePicker() {
  const [over, setOver] = useState(-1);
  const [picked, setPicked] = useState<string | null>(null);
  const at = useRef(-1);
  const left = useRef(0);
  const row = useRef<React.ComponentRef<typeof View>>(null);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        Haptics.prepare();
        Haptics.texture.start({ intensity: 0, sharpness: 0.85 });
        move(e.nativeEvent.pageX - left.current);
      },
      onPanResponderMove: (e, g) => {
        Haptics.texture.set({ intensity: Math.abs(g.vx) / FULL_SPEED });
        move(g.moveX - left.current);
      },
      onPanResponderRelease: () => {
        Haptics.texture.stop();
        if (at.current >= 0) {
          Haptics.tap({ intensity: 1, sharpness: 0.7 });
          setPicked(EMOJI[at.current] ?? null);
        }
        at.current = -1;
        setOver(-1);
      },
      onPanResponderTerminate: () => {
        Haptics.texture.stop();
        at.current = -1;
        setOver(-1);
      },
    })
  ).current;

  function move(x: number) {
    const i = Math.floor(x / CELL);
    const next = i >= 0 && i < EMOJI.length ? i : -1;
    if (next === at.current) return;
    at.current = next;
    setOver(next);
    if (next >= 0) Haptics.tap({ intensity: 1, sharpness: 0.5 });
  }

  return (
    <View style={styles.block}>
      <View
        ref={row}
        style={styles.row}
        onLayout={() => row.current?.measureInWindow((x) => (left.current = x))}
        {...pan.panHandlers}>
        {EMOJI.map((e, i) => (
          <Text key={e} style={[styles.emoji, i === over && styles.over]}>
            {e}
          </Text>
        ))}
      </View>
      <Text style={styles.caption}>{picked ? `Picked ${picked}` : 'Slide across, lift to pick'}</Text>
    </View>
  );
}

function Button({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.button} onPress={onPress}>
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [error, setError] = useState<string | null>(null);
  useErrors(setError);
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>expo-haptics-advanced</Text>
      <Text style={styles.caption}>{Haptics.isSupported() ? 'Haptics supported' : 'Haptics not supported on this device'}</Text>
      <SlidePicker />
      <Button label="Tap: light, crisp" onPress={() => Haptics.tap({ intensity: 0.4, sharpness: 1 })} />
      <Button label="Tap: heavy, dull" onPress={() => Haptics.tap({ intensity: 1, sharpness: 0 })} />
      <Button label="Pattern: heartbeat" onPress={() => Haptics.playPattern(heartbeat)} />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

function useErrors(onError: (message: string) => void) {
  useEffect(() => {
    const subscription = Haptics.addErrorListener((e) => onError(e.message));
    return () => subscription.remove();
  }, [onError]);
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '600' },
  block: { alignItems: 'center', gap: 8, marginVertical: 24 },
  row: { flexDirection: 'row', backgroundColor: '#f2f2f5', borderRadius: CELL / 2, paddingHorizontal: 4 },
  emoji: { width: CELL, height: CELL, fontSize: 30, textAlign: 'center', lineHeight: CELL },
  over: { transform: [{ scale: 1.4 }, { translateY: -10 }] },
  caption: { color: '#666' },
  button: { backgroundColor: '#111', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c00' },
});
