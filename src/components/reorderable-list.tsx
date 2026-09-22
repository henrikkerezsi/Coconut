import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, PanResponder, StyleSheet, View, type FlatListProps, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAppTheme } from '../theme';

type PanHandlers = ReturnType<typeof PanResponder.create>['panHandlers'];

export interface ReorderHandle {
  isDragged: boolean;
  dragY: Animated.Value;
  handleProps: PanHandlers;
}

interface Props<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  rowHeight: number;
  onReorder: (orderedItems: T[]) => void;
  renderRow: (item: T, handle: ReorderHandle) => React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  ListHeaderComponent?: FlatListProps<T>['ListHeaderComponent'];
  ListEmptyComponent?: FlatListProps<T>['ListEmptyComponent'];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

interface RowProps<T> {
  item: T;
  dragKey: string;
  isDragged: boolean;
  shiftY: number;
  dragY: Animated.Value;
  startDrag: (key: string) => void;
  moveDrag: (dy: number) => void;
  endDrag: () => void;
  renderRow: Props<T>['renderRow'];
}

function ReorderableRow<T>({
  item,
  dragKey,
  isDragged,
  shiftY,
  dragY,
  startDrag,
  moveDrag,
  endDrag,
  renderRow,
}: RowProps<T>) {
  const [y] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(y, { toValue: shiftY, duration: 120, useNativeDriver: false }).start();
  }, [shiftY, y]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => startDrag(dragKey),
        onPanResponderMove: (_event, gesture) => moveDrag(gesture.dy),
        onPanResponderRelease: () => endDrag(),
        onPanResponderTerminate: () => endDrag(),
      }),
    [dragKey, startDrag, moveDrag, endDrag]
  );

  return (
    <Animated.View style={{ zIndex: isDragged ? 1 : 0, transform: [{ translateY: isDragged ? dragY : y }] }}>
      {renderRow(item, { isDragged, dragY, handleProps: pan.panHandlers })}
    </Animated.View>
  );
}

export function ReorderableList<T>({
  items,
  keyExtractor,
  rowHeight,
  onReorder,
  renderRow,
  contentContainerStyle,
  ListHeaderComponent,
  ListEmptyComponent,
}: Props<T>) {
  const [orderedItems, setOrderedItems] = useState<T[]>(items);
  const [dragState, setDragState] = useState<{ index: number | null; drop: number | null }>({
    index: null,
    drop: null,
  });
  const dragY = useRef(new Animated.Value(0)).current;
  const dragIndexRef = useRef<number | null>(null);
  const dropRef = useRef(0);
  const [prevItems, setPrevItems] = useState<T[]>(items);

  if (prevItems !== items && dragState.index === null) {
    setPrevItems(items);
    setOrderedItems(items);
  }

  const startDrag = useCallback(
    (key: string) => {
      const index = orderedItems.findIndex((item) => keyExtractor(item) === key);
      if (index < 0) {
        return;
      }
      dragIndexRef.current = index;
      dropRef.current = index;
      dragY.setValue(0);
      setDragState({ index, drop: index });
    },
    [orderedItems, keyExtractor, dragY]
  );

  const moveDrag = useCallback(
    (dy: number) => {
      if (dragIndexRef.current === null) {
        return;
      }
      const from = dragIndexRef.current;
      const target = clamp(from + Math.round(dy / rowHeight), 0, orderedItems.length - 1);
      dragY.setValue(dy);
      if (target !== dropRef.current) {
        dropRef.current = target;
        setDragState((state) => ({ index: state.index, drop: target }));
      }
    },
    [orderedItems.length, rowHeight, dragY]
  );

  const endDrag = useCallback(() => {
    const from = dragIndexRef.current;
    const to = dropRef.current;
    dragIndexRef.current = null;
    dragY.setValue(0);
    setDragState({ index: null, drop: null });
    if (from === null || from === to) {
      return;
    }
    const next = moveItem(orderedItems, from, to);
    setOrderedItems(next);
    onReorder(next);
  }, [orderedItems, dragY, onReorder]);

  function liveShift(index: number): number {
    const { index: from, drop: to } = dragState;
    if (from === null || to === null || from === to) {
      return 0;
    }
    if (from < to && index > from && index <= to) {
      return -rowHeight;
    }
    if (from > to && index < from && index >= to) {
      return rowHeight;
    }
    return 0;
  }

  return (
    <FlatList
      data={orderedItems}
      keyExtractor={keyExtractor}
      extraData={dragState}
      renderItem={({ item, index }) => (
        <ReorderableRow
          item={item}
          dragKey={keyExtractor(item)}
          isDragged={dragState.index === index && dragState.drop !== null}
          shiftY={liveShift(index)}
          dragY={dragY}
          startDrag={startDrag}
          moveDrag={moveDrag}
          endDrag={endDrag}
          renderRow={renderRow}
        />
      )}
      contentContainerStyle={contentContainerStyle}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
    />
  );
}

interface DragHandleProps {
  isDragged: boolean;
  handleProps: PanHandlers;
  label: string;
}

export function DragHandle({ isDragged, handleProps, label }: DragHandleProps) {
  const theme = useAppTheme();
  return (
    <View
      {...handleProps}
      style={styles.handle}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
    >
      <MaterialCommunityIcons
        name="drag"
        size={22}
        color={isDragged ? theme.colors.primary : theme.colors.onSurfaceVariant}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  handle: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    alignSelf: 'stretch',
  },
});