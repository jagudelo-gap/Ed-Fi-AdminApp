import { stdShort, stdDetailed, stdDiffSeconds, stdDuration } from './date-formats';

describe('stdShort', () => {
  it('returns "-" for undefined', () => {
    expect(stdShort(undefined)).toBe('-');
  });

  it('returns a non-empty formatted date string for a valid date', () => {
    const result = stdShort(new Date('2024-03-15'));
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('-');
  });
});

describe('stdDetailed', () => {
  it('returns "-" for undefined', () => {
    expect(stdDetailed(undefined)).toBe('-');
  });

  it('formats a date in "MMM D, YYYY h:mm:ss A" format', () => {
    const date = new Date('2024-03-15T14:30:00');
    const result = stdDetailed(date);
    expect(result).toMatch(/Mar 15, 2024/);
  });
});

describe('stdDiffSeconds', () => {
  it('returns the difference in seconds with trailing "s"', () => {
    const start = new Date('2024-01-01T00:00:00');
    const end = new Date('2024-01-01T00:01:00');
    expect(stdDiffSeconds(start, end)).toBe('60s');
  });

  it('returns "0s" when start and end are the same', () => {
    const d = new Date('2024-01-01T00:00:00');
    expect(stdDiffSeconds(d, d)).toBe('0s');
  });
});

describe('stdDuration', () => {
  it('formats seconds only', () => {
    expect(stdDuration(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(stdDuration(90)).toBe('1m 30s');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(stdDuration(3661)).toBe('1h 1m 1s');
  });

  it('omits seconds when duration is an exact number of minutes', () => {
    expect(stdDuration(120)).toBe('2m ');
  });

  it('returns "0s" for zero', () => {
    expect(stdDuration(0)).toBe('0s');
  });

  it('formats hours only when minutes and seconds are zero', () => {
    expect(stdDuration(7200)).toBe('2h ');
  });
});
