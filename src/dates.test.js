import { describe, it, expect } from 'vitest';
import { todayInLondon, nowInLondon } from './dates.js';

describe('dates in Europe/London', () => {
  it('gives the London date, not the UTC date, late on a summer evening', () => {
    // 2026-07-01 23:30 UTC is 00:30 on 2 July in London (BST).
    expect(todayInLondon(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02');
  });

  it('matches UTC in winter', () => {
    const t = new Date('2026-10-30T13:34:00Z');
    expect(todayInLondon(t)).toBe('2026-10-30');
    expect(nowInLondon(t)).toBe('13:34');
  });

  it('is an hour ahead of UTC in summer', () => {
    expect(nowInLondon(new Date('2026-07-01T07:52:00Z'))).toBe('08:52');
  });
});
