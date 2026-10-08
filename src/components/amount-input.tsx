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
  allowNegative?: boolean;
}

function centsToRawInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const absolute = Math.abs(cents);
  const integer = Math.floor(absolute / 100);
  const fraction = (absolute % 100).toString().padStart(2, '0');
  return `${sign}${integer},${fraction}`;
}

export function AmountInput({
  label,
  value,
  onChange,
  autoFocus,
  error,
  prefix,
  allowNegative = false,
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
    const trimmed = next.trim();
    if (trimmed === '') {
      lastEmitted.current = null;
      onChange(null);
      return;
    }
    // Don't commit if ends with decimal separator (still typing)
    if (/[.,]$/.test(trimmed)) {
      return;
    }
    // Also handle case like "-." 
    if (/^[-+]?[.,]$/.test(trimmed) || /^[-+]?\d+[.,]$/.test(trimmed)) {
      return;
    }
    const nextCents = centsFromString(next);
    if (nextCents !== null) {
      lastEmitted.current = nextCents;
      onChange(nextCents);
      return;
    }
    // If parsing fails and not empty, don't emit - preserve last valid value
  };

  // The decimal pad on Android has no minus key, so the sign is flipped here
  // rather than typed.
  const flipSign = () => {
    const current = centsFromString(text);
    if (current === null || current === 0) {
      return;
    }
    const next = -current;
    lastEmitted.current = next;
    setText(centsToRawInput(next));
    onChange(next);
  };

  const formatOnBlur = () => {
    const current = centsFromString(text);
    if (current === null) {
      lastEmitted.current = null;
      setText('');
      onChange(null);
      return;
    }
    lastEmitted.current = current;
    setText(centsToRawInput(current));
    onChange(current);
  };

  const negative = (value ?? 0) < 0;

  return (
    <>
      <PaperTextInput
        label={label}
        mode="outlined"
        value={text}
        onChangeText={handleChange}
        onBlur={formatOnBlur}
        keyboardType="decimal-pad"
        autoFocus={autoFocus}
        error={Boolean(error)}
        left={prefix ? <PaperTextInput.Affix text={prefix} /> : undefined}
        right={
          allowNegative ? (
            <PaperTextInput.Icon
              icon={negative ? 'plus' : 'minus'}
              onPress={flipSign}
              accessibilityLabel={negative ? 'Make positive' : 'Make negative'}
            />
          ) : undefined
        }
      />
      {error ? <HelperText type="error">{error}</HelperText> : null}
    </>
  );
}