import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  TextInput,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

export interface KeyboardAwareScrollViewProps extends ScrollViewProps {
  keyboardBottomOffset?: number;
}

interface Measurable {
  measureInWindow(
    callback: (x: number, y: number, width: number, height: number) => void
  ): void;
}

export function keyboardScrollDelta(
  fieldBottomY: number,
  keyboardTopY: number,
  offset: number
): number {
  const coveredBy = fieldBottomY + offset - keyboardTopY;
  return coveredBy > 0 ? coveredBy : 0;
}

export function KeyboardAwareScrollView({
  keyboardBottomOffset = 16,
  contentContainerStyle,
  children,
  onScroll,
  ...rest
}: KeyboardAwareScrollViewProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const keyboardTopRef = useRef(0);
  const scrollOffsetRef = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const scrollFocusedFieldIntoView = useCallback(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const scrollView = scrollViewRef.current;
    const focused = TextInput.State.currentlyFocusedInput();
    if (scrollView === null || focused == null) {
      return;
    }
    const focusedView = focused as unknown as Measurable;
    focusedView.measureInWindow((_x, y, _width, height) => {
      const delta = keyboardScrollDelta(
        y + height,
        keyboardTopRef.current,
        keyboardBottomOffset
      );
      if (delta > 0) {
        scrollView.scrollTo({ y: scrollOffsetRef.current + delta, animated: true });
      }
    });
  }, [keyboardBottomOffset]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (keyboardHeight <= 0) {
      return;
    }
    const frame = requestAnimationFrame(() => scrollFocusedFieldIntoView());
    return () => cancelAnimationFrame(frame);
  }, [keyboardHeight, scrollFocusedFieldIntoView]);

  return (
    <ScrollView
      ref={scrollViewRef}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
        scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      contentContainerStyle={
        keyboardHeight > 0
          ? [contentContainerStyle, { paddingBottom: keyboardHeight + keyboardBottomOffset }]
          : contentContainerStyle
      }
      {...rest}
    >
      {children}
    </ScrollView>
  );
}