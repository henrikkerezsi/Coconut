import React, { useState } from 'react';
import { Platform, TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Text } from 'react-native-paper';
import dayjs from 'dayjs';
import { DAYJS_STORE_DATE_FORMAT } from '../utils/date';

interface DateFieldProps {
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  minimumDate?: string;
  maximumDate?: string;
}

export function DateField({
  value,
  onChange,
  disabled = false,
  minimumDate,
  maximumDate,
}: DateFieldProps) {
  const [show, setShow] = useState(false);

  const handleValueChange = (_event: unknown, selected: Date) => {
    // On Android, committing a date in the dialog also fires `value` prop
    // updates, which make the picker's open-effect re-run and re-show the
    // dialog. Close right away there; on iOS the spinner fires this event on
    // every tick and must only close once dismissed.
    if (Platform.OS === 'android') {
      setShow(false);
    }
    onChange(dayjs(selected).format(DAYJS_STORE_DATE_FORMAT));
  };

  return (
    <>
      <TouchableOpacity
        onPress={() => setShow(!disabled)}
        style={styles.field}
        accessibilityState={{ disabled }}
      >
        <Text variant="bodyLarge" style={styles.value}>
          {dayjs(value).format('ddd, D MMM YYYY')}
        </Text>
        <Text variant="labelMedium" style={styles.label}>
          Change date
        </Text>
      </TouchableOpacity>
      {show ? (
        <DateTimePicker
          value={dayjs(value).toDate()}
          mode="date"
          minimumDate={minimumDate ? dayjs(minimumDate).startOf('day').toDate() : undefined}
          maximumDate={maximumDate ? dayjs(maximumDate).startOf('day').toDate() : undefined}
          onValueChange={handleValueChange}
          onDismiss={() => setShow(false)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    paddingVertical: 8,
  },
  value: {
    fontWeight: '600',
  },
  label: {
    opacity: 0.6,
    marginTop: 2,
  },
});