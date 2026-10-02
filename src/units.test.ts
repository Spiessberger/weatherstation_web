import { describe, expect, it } from 'vitest';
import { getInitialWindUnit } from './units';

describe('wind unit preference', () => {
  it('defaults to m/s and only restores an explicit km/h choice', () => {
    expect(getInitialWindUnit({ getItem: () => null })).toBe('mps');
    expect(getInitialWindUnit({ getItem: () => 'mps' })).toBe('mps');
    expect(getInitialWindUnit({ getItem: () => 'kmh' })).toBe('kmh');
    expect(getInitialWindUnit({ getItem: () => 'knots' })).toBe('mps');
  });
});
