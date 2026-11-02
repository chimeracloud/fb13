// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  TEST_CONFIRMATION,
  runnersOf,
  testOrderBody,
  testOrderSummary,
  LAY_RULE,
  SIX_CELL_NO_ORDER,
  backLegOf,
  placeBlocker,
  buildBody,
  placeBody,
  confirmBlocker,
  slipTargetLabel,
  confirmRows,
  ordersForLine,
  orderStatusLabel,
} from './orders.js';

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

// ---- Step 4: the Place button, the confirm panel, the order status ----------------------------

const SEVEN = {
  id: 'ln_1',
  slot: '08:00',
  date: '2026-11-02',
  parsed: true,
  layout: 'seven',
  cells: { race: '13:00 Plumpton', horse: 'Hard Stare', bestPrice: '1.67 BY', bestBog: '–', betfair: '1.84\n07:52 API', layTarget: '1.75 (5% under)', betfairCap: '£125' },
};
const SIX = { ...SEVEN, id: 'ln_2', layout: 'six', cells: { race: '13:00 Plumpton', horse: 'Hard Stare', priceA: '2.76', priceB: '3.10', decision: 'In · clear favourite', button: 'Take out' } };
const BACK = { id: 'en_1', lineId: 'ln_1', kind: 'placed', placed: { where: 'BY', whereKind: 'code', side: 'back', price: '1.67', stake: '3', mode: 'paper' } };
const LAY = { id: 'en_2', lineId: 'ln_1', kind: 'placed', placed: { where: 'Betfair', whereKind: 'betfair', side: 'lay', price: '1.60', stake: '3', mode: 'paper' } };
const STATUS = { mode: 'paper', placing_enabled: true, version: '0.8.1', betfair: { session: 'logged_in' } };

// What the server returns from POST /orders/build under the lay rule of the footnote (2 November 2026).
const BUILD = {
  status: 'ok',
  refusals: [],
  notes: ["the slip's lay target 1.75 and the deepest rung 1.58 from the back price 1.67 differ by 17 ticks", 'Betfair cap 125 shown only: a limit on the back'],
  rule: 'footnote-2026-11-02',
  mode: 'paper',
  market_id: '1.264841544',
  market_name: '3m2f Nov Hcap Chs',
  venue: 'Plumpton',
  start_london: '13:00',
  runner_name: 'Hard Stare',
  selection_id: 81578849,
  side: 'LAY',
  order_type: 'LIMIT',
  persistence: 'LAPSE',
  back: { price: '1.67', stake: '3', where: 'BY' },
  back_price: '1.67',
  back_stake: '3',
  price: '1.58',
  under_pct: '5.4',
  rung: 'one lay, 5% under the back, 1 of 1',
  slip_lay_target: '1.75',
  slip_lay_target_ticks_away: 17,
  size: '3.17',
  liability: '1.84',
  caps: { per_order_at_risk_gbp: '5.00', per_day_at_risk_gbp: '10.00', day_so_far: '0.00' },
  course_cap: '125',
  customer_order_ref: 'FB13-20261102-0800-0123456789ab',
  customer_strategy_ref: 'FB13-0800',
  ticket: '0123456789abcdef',
};

describe('the Place button', () => {
  it('takes the latest back leg recorded as Placed, never a lay', () => {
    expect(backLegOf([])).toBeNull();
    expect(backLegOf([LAY])).toBeNull();
    expect(backLegOf([BACK, LAY])).toEqual({ price: '1.67', stake: '3', where: 'BY', mode: 'paper' });
    const later = { ...BACK, id: 'en_3', placed: { ...BACK.placed, price: '1.70', stake: '2' } };
    expect(backLegOf([BACK, later]).price).toBe('1.70');
  });

  it('is only on seven-cell lines with a back leg recorded and the server status read', () => {
    expect(placeBlocker(SIX, [BACK], STATUS)).toBe(SIX_CELL_NO_ORDER);
    expect(placeBlocker({ ...SEVEN, parsed: false }, [BACK], STATUS)).toBe('the line could not be read');
    expect(placeBlocker(SEVEN, [LAY], STATUS)).toBe('record the back leg as Placed first: the lay is built from the back price actually taken');
    expect(placeBlocker(SEVEN, [BACK], null)).toBe("read the server's status first (Refresh status in the Server panel)");
    expect(placeBlocker(SEVEN, [BACK], STATUS)).toBeNull();
  });

  it('sends the cells as pasted, the back leg taken and the layout', () => {
    const body = buildBody({ date: '2026-11-02', line: SEVEN, back: backLegOf([BACK]) });
    expect(body).toEqual({
      date: '2026-11-02',
      slot: '08:00',
      line: { id: 'ln_1', race: '13:00 Plumpton', horse: 'Hard Stare', lay_target: '1.75 (5% under)', betfair_cap: '£125', layout: 'seven' },
      back: { price: '1.67', stake: '3', where: 'BY' },
    });
    expect(buildBody({ date: '2026-11-02', line: { ...SEVEN, cells: { ...SEVEN.cells, betfairCap: '' } }, back: backLegOf([BACK]) }).line.betfair_cap).toBeNull();
    expect(buildBody({ date: '2026-11-02', line: SIX, back: backLegOf([BACK]) }).line.layout).toBe('six');
    expect(placeBody(body, BUILD, '  paper trial ')).toEqual({ ...body, ticket: '0123456789abcdef', reason: 'paper trial' });
    expect(placeBody(body, BUILD, '').reason).toBeNull();
  });
});

describe('the confirm panel', () => {
  it('confirms only a build that names the lay rule and refuses nothing', () => {
    expect(confirmBlocker(null, STATUS)).toBe('nothing built');
    expect(confirmBlocker({ ...BUILD, rule: undefined }, { version: '0.7.3' })).toBe(
      'the server did not apply the lay rule of 2 November 2026 (server 0.7.3 answered without it); nothing to confirm'
    );
    expect(confirmBlocker({ ...BUILD, status: 'refused', refusals: ['a', 'b'] }, STATUS)).toBe('refused: a; b');
    expect(confirmBlocker({ ...BUILD, ticket: null }, STATUS)).toBe('no ticket on the build; nothing to confirm');
    expect(confirmBlocker(BUILD, STATUS)).toBeNull();
    expect(LAY_RULE).toBe('footnote-2026-11-02');
  });

  it("shows the lay price with the percentage under and the rung, and the slip's target beside it", () => {
    const rows = Object.fromEntries(confirmRows(BUILD));
    expect(rows['Lay price']).toBe('1.58, 5.4% under the back; one lay, 5% under the back, 1 of 1');
    expect(rows["Slip's lay target"]).toBe('1.75 (17 ticks away: more than a tick)');
    expect(rows['Back taken']).toBe('1.67 for 3 at BY');
    expect(rows.Mode).toBe('paper: recorded, nothing is sent');
    expect(rows.Market).toBe('13:00 Plumpton · 3m2f Nov Hcap Chs (1.264841544)');
    expect(rows.Runner).toBe('Hard Stare (81578849)');
    expect(rows.Size).toBe('3.17');
    expect(rows['Liability, at risk']).toBe('1.84');
    expect(rows.Caps).toBe('5.00 an order, 10.00 a day; 0.00 at risk so far today in paper');
    expect(rows['Betfair cap']).toBe("125, shown only: a limit on the morning's Betfair back, not on this lay");
    expect(rows.References).toBe('FB13-20261102-0800-0123456789ab / FB13-0800');
    expect(rows.Ticket).toBe('0123456789abcdef');
    expect(Object.fromEntries(confirmRows({ ...BUILD, mode: 'real' })).Mode).toBe('REAL: this sends an order to Betfair');
    expect(Object.fromEntries(confirmRows({ ...BUILD, market_id: null, runner_name: null, price: null, course_cap: null })).Market).toBe('not resolved');
    expect(confirmRows(null)).toEqual([]);
  });

  it("says how far the slip's target sits from the lay price", () => {
    expect(slipTargetLabel({ slip_lay_target: '2.84', slip_lay_target_ticks_away: 0 })).toBe('2.84 (the same tick)');
    expect(slipTargetLabel({ slip_lay_target: '2.86', slip_lay_target_ticks_away: 1 })).toBe('2.86 (one tick away)');
    expect(slipTargetLabel({ slip_lay_target: '2.88', slip_lay_target_ticks_away: 2 })).toBe('2.88 (2 ticks away: more than a tick)');
    expect(slipTargetLabel({ slip_lay_target: '1.005', slip_lay_target_ticks_away: null })).toBe('1.005 (not compared)');
    expect(slipTargetLabel({ slip_lay_target: null })).toBe('none on the line');
  });
});

describe('the order status on a line', () => {
  const placed = { event: 'placed', mode: 'paper', sent: false, bet_id: null, order_ref: 'FB13-20261102-0800-0123456789ab', order: { line: { id: 'ln_1' }, price: '1.58', size: '3.17' } };
  const real = { ...placed, mode: 'real', sent: true, bet_id: '449945060703' };
  const cancelled = { event: 'cancelled', mode: 'paper', sent: false, order_ref: placed.order_ref, order: placed.order };
  const refused = { event: 'refused', mode: 'paper', order: { line: { id: 'ln_1' }, refusals: ['race already run: it started at 13:00 UK; nothing is laid in play'] } };
  const other = { event: 'placed', mode: 'paper', order: { line: { id: 'ln_9' } } };

  it('finds the ledger records of one line, oldest first', () => {
    expect(ordersForLine({ records: [other, placed, cancelled] }, 'ln_1')).toEqual([placed, cancelled]);
    expect(ordersForLine(null, 'ln_1')).toEqual([]);
    expect(ordersForLine({ records: [{ event: 'test_order' }] }, 'ln_1')).toEqual([]);
  });

  it('says the latest record in one sentence', () => {
    expect(orderStatusLabel([])).toBe('');
    expect(orderStatusLabel([placed])).toBe('Placed (paper): LAY 3.17 at 1.58; recorded, nothing sent; reference FB13-20261102-0800-0123456789ab.');
    expect(orderStatusLabel([real])).toBe('Placed (real): LAY 3.17 at 1.58; sent to Betfair, bet 449945060703; reference FB13-20261102-0800-0123456789ab.');
    expect(orderStatusLabel([placed, cancelled])).toBe('Cancelled (paper): FB13-20261102-0800-0123456789ab; recorded, nothing sent.');
    expect(orderStatusLabel([refused])).toBe('Refused (paper): race already run: it started at 13:00 UK; nothing is laid in play.');
    expect(orderStatusLabel([{ event: 'place_failed', mode: 'real', error: 'placeOrders failed: timeout' }])).toBe('Place failed (real): placeOrders failed: timeout.');
  });
});
