// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { TEST_CONFIRMATION, runnersOf, testOrderBody, testOrderSummary } from './orders.js';

// The shape the server returns for GET /betfair/markets, with the first real market of 2 November 2026.
const MARKETS = {
  markets: [
    {
      market_id: '1.264841544',
      market_name: '3m2f Nov Hcap Chs',
      start_london: '13:00',
      venue: 'Plumpton',
      runners: [
        { selection_id: 81578849, name: 'Hard Stare', sort_priority: 1 },
        { selection_id: 67336975, name: 'Tom Taggle', sort_priority: 2 },
      ],
    },
  ],
};

describe('the test order on the page', () => {
  it('holds the same sentence as the server', () => {
    expect(TEST_CONFIRMATION).toBe('I confirm the real test order: back 2.00 at 1000');
  });

  it('finds the runners of the chosen market, or none', () => {
    expect(runnersOf(MARKETS, '1.264841544').map((r) => r.name)).toEqual(['Hard Stare', 'Tom Taggle']);
    expect(runnersOf(MARKETS, '1.999')).toEqual([]);
    expect(runnersOf(null, '1.264841544')).toEqual([]);
  });

  it('sends exactly what was chosen and typed', () => {
    expect(testOrderBody({ date: '2026-11-02', marketId: '1.264841544', selectionId: '81578849', confirmation: `  ${TEST_CONFIRMATION} ` })).toEqual({
      date: '2026-11-02',
      market_id: '1.264841544',
      selection_id: 81578849,
      confirmation: TEST_CONFIRMATION,
    });
    expect(testOrderBody({ date: '2026-11-02', marketId: '1.264841544', selectionId: '81578849' }).confirmation).toBe('');
  });

  it('says what the server recorded, in one sentence', () => {
    const rec = {
      verdict: 'passed: placed, seen, cancelled, gone',
      side: 'BACK',
      size: '2.00',
      price: '1000',
      runner_name: 'Hard Stare',
      start_london: '13:00',
      venue: 'Plumpton',
      market_id: '1.264841544',
      bet_id: '400000000001',
      order_ref: 'FB13-TEST-083000',
      steps: [{ step: 'placeOrders', ok: true }, { step: 'listCurrentOrders', ok: true }, { step: 'cancelOrders', ok: true }, { step: 'listCurrentOrders', ok: true }],
    };
    expect(testOrderSummary(rec)).toBe(
      'passed: placed, seen, cancelled, gone. BACK 2.00 at 1000 on Hard Stare in 13:00 Plumpton (1.264841544), bet 400000000001; reference FB13-TEST-083000. Steps: placeOrders, listCurrentOrders, cancelOrders, listCurrentOrders.'
    );
    expect(testOrderSummary({ ...rec, bet_id: null, steps: [{ step: 'placeOrders', ok: false }] })).toContain('placeOrders (not ok)');
    expect(testOrderSummary(null)).toBe('');
  });
});
