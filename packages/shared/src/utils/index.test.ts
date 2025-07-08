import { describe, it, expect } from 'vitest';
import { debounce, formatDate } from './index';

describe('debounce', () => {
  it('should debounce function calls', async () => {
    let callCount = 0;
    const fn = () => callCount++;
    const debouncedFn = debounce(fn, 100);

    // Call multiple times quickly
    debouncedFn();
    debouncedFn();
    debouncedFn();

    // Should not have called the function yet
    expect(callCount).toBe(0);

    // Wait for debounce delay
    await new Promise(resolve => setTimeout(resolve, 150));

    // Should have called the function only once
    expect(callCount).toBe(1);
  });

  it('should cancel previous calls when called again', async () => {
    let callCount = 0;
    const fn = () => callCount++;
    const debouncedFn = debounce(fn, 100);

    debouncedFn();

    // Call again before first call executes
    setTimeout(() => debouncedFn(), 50);

    await new Promise(resolve => setTimeout(resolve, 200));

    // Should only call once (the second call)
    expect(callCount).toBe(1);
  });
});

describe('formatDate', () => {
  it('should format date as ISO string', () => {
    const date = new Date('2023-01-01T12:00:00Z');
    const formatted = formatDate(date);
    expect(formatted).toBe('2023-01-01T12:00:00.000Z');
  });

  it('should handle date strings', () => {
    const dateString = '2023-01-01T12:00:00Z';
    const formatted = formatDate(dateString);
    expect(formatted).toBe('2023-01-01T12:00:00.000Z');
  });

  it('should handle invalid dates', () => {
    const invalidDate = 'invalid-date';
    expect(() => formatDate(invalidDate)).toThrow('Invalid date');
  });
});
