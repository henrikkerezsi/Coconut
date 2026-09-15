import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Text } from 'react-native-paper';
import dayjs from 'dayjs';
import { DAYJS_STORE_DATE_FORMAT } from '../utils/date';

interface DateFieldProps {
  value: string;
  onChange: (isoDate: string) => void;
}

export function DateField({ value, onChange }: DateFieldProps) {
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    setShow(false);
    if (event.type === 'set' && selected) {
      onChange(dayjs(selected).format(DAYJS_STORE_DATE_FORMAT));
    }
  };

  return (
    <>
      <TouchableOpacity onPress={() => setShow(true)} style={styles.field}>
        <Text variant="bodyLarge" style={styles.value}>
          {dayjs(value).format('ddd, D MMM YYYY')}
        </Text>
        <Text variant="labelMedium" style={styles.label}>
          Change date
        </Text>
      </TouchableOpacity>
      {show ? (
        <DateTimePicker value={dayjs(value).toDate()} mode="date" onChange={handleChange} />
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