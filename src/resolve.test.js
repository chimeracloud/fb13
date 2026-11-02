import { describe, it, expect } from 'vitest';
import { parsePlainSlip } from './parse.js';
import { REAL_PLAIN_2242 } from './fixtures/real-2026-11-01-2242-slip-0800.js';
import { linesForResolve, resolutionLabel, marketsSummary, sessionLabel } from './resolve.js';

describe('what the page sends to resolve', () => {
  it('carries the race and horse of every parsed line of the real 08:00 slip, with the id', () => {
    const { lines } = parsePlainSlip(REAL_PLAIN_2242);
    const out = linesForResolve(lines);
    expect(out).toHaveLength(28);
    expect(out.find((l) => l.horse === 'West Away')).toEqual({ id: lines.find((l) => l.cells.horse === 'West Away').id, race: '13:40 Cork', horse: 'West Away' });
    expect(out.every((l) => /^\d{2}:\d{2} /.test(l.race))).toBe(true);
  });

  it('leaves out lines that did not parse and copes with nothing', () => {
    expect(linesForResolve([{ id: 'a', parsed: false, cells: {} }])).toEqual([]);
    expect(linesForResolve(null)).toEqual([]);
  });
});

describe('how an answer reads', () => {
  it('names the market and the runner, or the flag', () => {
    expect(resolutionLabel({ status: 'resolved', market_id: '1.2', runner_name: 'West Away', selection_id: 42 })).toBe('Betfair 1.2 · West Away (42)');
    expect(resolutionLabel({ status: 'flagged', flag: 'Betfair has nothing at that time' })).toBe('Not resolved: Betfair has nothing at that time');
    expect(resolutionLabel(null)).toBe('');
  });

  it('summarises the catalogue in one sentence', () => {
    expect(marketsSummary({ date: '2026-11-02', summary: { count: 0, venues: [] } })).toBe('No GB or IE win markets for 2026-11-02 in the catalogue.');
    expect(marketsSummary({ date: '2026-11-02', summary: { count: 2, first_off: '12:10', last_off: '15:40', runners: 20, venues: ['Cork', 'Kempton'] } })).toBe(
      '2 win markets on 2026-11-02, first off 12:10, last off 15:40, 20 runners, at Cork, Kempton.',
    );
    expect(marketsSummary(null)).toBe('');
  });

  it('describes the session', () => {
    expect(sessionLabel({ betfair: { session: 'logged_in', logged_in_at: '2026-11-02T05:00:00.000Z' } })).toBe('logged in (delayed key) since 2026-11-02T05:00:00.000Z');
    expect(sessionLabel({ betfair: { session: 'failed', error: 'X' } })).toBe('login failed, not retried: X');
    expect(sessionLabel({ betfair: { session: 'none' } })).toBe('none');
    expect(sessionLabel(null)).toBe('unknown');
  });
});
