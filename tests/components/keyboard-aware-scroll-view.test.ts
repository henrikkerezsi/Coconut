import { keyboardScrollDelta } from '../../src/components/keyboard-aware-scroll-view';

describe('keyboardScrollDelta', () => {
  const keyboardTopY = 600;

  it('returns 0 when the field bottom is above the keyboard', () => {
    expect(keyboardScrollDelta(500, keyboardTopY, 16)).toBe(0);
  });

  it('returns 0 when the field bottom touches the keyboard top', () => {
    expect(keyboardScrollDelta(600, keyboardTopY, 0)).toBe(0);
  });

  it('returns the overlap plus the offset when the field is covered', () => {
    expect(keyboardScrollDelta(650, keyboardTopY, 16)).toBe(66);
  });

  it('uses the offset to keep breathing room even at exact overlap', () => {
    expect(keyboardScrollDelta(600, keyboardTopY, 16)).toBe(16);
  });
});