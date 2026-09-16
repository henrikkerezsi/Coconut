import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

interface FadeInProps {
  children: React.ReactNode;
  slide?: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeIn({ children, slide = true, delay = 0, style }: FadeInProps) {
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(slide ? 12 : 0));

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 240,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }),
    ]);
    const handle = setTimeout(() => animation.start(), delay);
    return () => {
      clearTimeout(handle);
      animation.stop();
    };
  }, [opacity, translateY, delay]);

  return (
    <Animated.View style={[styles.view, style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  view: {},
});