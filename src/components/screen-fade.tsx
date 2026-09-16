import React, { useCallback, useState } from 'react';
import { Animated } from 'react-native';
import { useFocusEffect } from 'expo-router';

interface ScreenFadeProps {
  children: React.ReactNode;
}

export function ScreenFade({ children }: ScreenFadeProps) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateY] = useState(() => new Animated.Value(0));

  useFocusEffect(
    useCallback(() => {
      opacity.setValue(0);
      translateY.setValue(8);
      const animation = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]);
      animation.start();
      return () => animation.stop();
    }, [opacity, translateY])
  );

  return (
    <Animated.View style={[{ flex: 1, opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}