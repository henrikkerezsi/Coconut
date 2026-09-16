import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

interface AnimatedNumberProps {
  value: number;
  format: (value: number) => string;
  style?: StyleProp<TextStyle>;
  duration?: number;
}

export function AnimatedNumber({ value, format, style, duration = 400 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const [progress] = useState(() => new Animated.Value(value));

  useEffect(() => {
    const listenerId = progress.addListener(({ value: frame }) => {
      setDisplay(frame < 0 ? Math.ceil(frame) : Math.floor(frame));
    });
    Animated.timing(progress, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
    return () => {
      progress.stopAnimation();
      progress.removeListener(listenerId);
    };
  }, [value, duration, progress]);

  return <Text style={[styles.text, style]}>{format(display)}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontVariant: ['tabular-nums'],
  },
});