import { describe, expect, it } from 'vitest';
import { scaleToExactRange } from './TimeChart';

const applied = { fromUnixMs: 10_000, toUnixMs: 20_000 };

describe('chart zoom bounds', () => {
  it('rounds both second bounds upward to preserve integer millisecond membership', () => {
    expect(scaleToExactRange(10.1231, 19.4561, applied)).toEqual({
      fromUnixMs: 10_124,
      toUnixMs: 19_457,
    });
  });

  it('clamps to the applied interval and ignores its unzoomed full range', () => {
    expect(scaleToExactRange(9, 19, applied)).toEqual({ fromUnixMs: 10_000, toUnixMs: 19_000 });
    expect(scaleToExactRange(9, 21, applied)).toBeNull();
  });

  it('rejects unsafe, nonfinite, or collapsed ranges', () => {
    expect(scaleToExactRange(Number.NaN, 12, applied)).toBeNull();
    expect(scaleToExactRange(12, Number.POSITIVE_INFINITY, applied)).toBeNull();
    expect(scaleToExactRange(12.0001, 12.0001, applied)).toBeNull();
  });
});
