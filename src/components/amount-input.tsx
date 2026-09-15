import React, { useState } from 'react';
import { HelperText, TextInput as PaperTextInput } from 'react-native-paper';
import { centsFromString, centsToInput } from '../utils/currency';

interface AmountInputProps {
  label: string;
  value: number | null;
  onChange: (cents: number | null) => void;
  autoFocus?: boolean;
  error?: string | null;
  prefix?: string;
}

export function AmountInput({
  label,
  value,
  onChange,
  autoFocus,
  error,
  prefix,
}: AmountInputProps) {
  const [draftValue, setDraftValue] = useState<number | null>(value);

  if (draftValue !== value) {
    setDraftValue(value);
  }

  const text = draftValue === null ? '' : centsToInput(draftValue);

  const handleChange = (next: string) => {
    const nextCents = centsFromString(next);
    setDraftValue(nextCents);
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