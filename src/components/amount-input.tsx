import React, { useEffect, useRef, useState } from 'react';
import { HelperText, TextInput as PaperTextInput } from 'react-native-paper';
import { centsFromString } from '../utils/currency';

interface AmountInputProps {
  label: string;
  value: number | null;
  onChange: (cents: number | null) => void;
  autoFocus?: boolean;
  error?: string | null;
  prefix?: string;
}

function centsToRawInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const integer = Math.floor(absolute / 100);
  const fraction = (absolute % 100).toString().padStart(2, '0');
  return `${sign}${integer}.${fraction}`;
}

export function AmountInput({
  label,
  value,
  onChange,
  autoFocus,
  error,
  prefix,
}: AmountInputProps) {
  const [text, setText] = useState(() =>
    value === null ? '' : centsToRawInput(value)
  );
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (value !== lastEmitted.current) {
      lastEmitted.current = value;
      setText(value === null ? '' : centsToRawInput(value));
    }
  }, [value]);

  const handleChange = (next: string) => {
    setText(next);
    const nextCents = centsFromString(next);
    lastEmitted.current = nextCents;
    onChange(nextCents);
  };

  return (
    <>
      <PaperTextInput
        label={label}
        mode="outlined"
        value={text}
        onChangeText={handleChange}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        error={Boolean(error)}
        left={prefix ? <PaperTextInput.Affix text={prefix} /> : undefined}
      />
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </>
  );
}