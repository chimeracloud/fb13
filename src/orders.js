// Step 3 on the page: the test order's controls. The server decides everything;
// these helpers only shape what the page sends and show what came back.
//
// The test order (Charles, 2 November 2026): one BACK of 2.00 at the maximum
// price 1000, which cannot match, placed and then cancelled, each step checked.
// Real mode only, and only with this sentence typed in words. The server holds
// the same sentence and refuses anything else.

export const TEST_CONFIRMATION = 'I confirm the real test order: back 2.00 at 1000';

/** The runners of one market from the server's catalogue answer, or []. */
export function runnersOf(markets, marketId) {
  const list = (markets && markets.markets) || [];
  const m = list.find((x) => x.market_id === marketId);
  return m ? m.runners || [] : [];
}

/** The body of POST /orders/test. Nothing is defaulted: a missing choice is a missing field, refused by the server. */
export function testOrderBody({ date, marketId, selectionId, confirmation }) {
  return {
    date,
    market_id: marketId,
    selection_id: Number(selectionId),
    confirmation: String(confirmation || '').trim(),
  };
}

/** One sentence for the test order's record, as the server returned it. */
export function testOrderSummary(rec) {
  if (!rec) return '';
  const steps = (rec.steps || []).map((s) => `${s.step}${s.ok ? '' : ' (not ok)'}`).join(', ');
  const bet = rec.bet_id ? `, bet ${rec.bet_id}` : '';
  return `${rec.verdict}. ${rec.side} ${rec.size} at ${rec.price} on ${rec.runner_name} in ${rec.start_london} ${rec.venue} (${rec.market_id})${bet}; reference ${rec.order_ref}. Steps: ${steps}.`;
}

// ---- Step 4 (2 November 2026): the Place button, the confirm panel, the order status. ----
// The server builds and decides; the page sends the recorded back leg and shows what came back.
// Charles's rulings of 2 November 2026: the Place button only on seven-cell lines (the six-cell
// email is the 06:30 selection, in or out, and nothing more); the lay is built from the back
// price actually taken, the deepest rung only at this stage; the confirm panel shows the lay
// target taken and the percentage under, the slip's target beside it, and says when the two
// differ by more than a tick; nothing is confirmed unless the server names the lay rule in force.

export const LAY_RULE = 'footnote-2026-11-02';
export const SIX_CELL_NO_ORDER = 'no order from a six-cell line: the six-cell email is the 06:30 selection, in or out, and nothing more';

/** The latest back leg recorded as Placed for a line, or null. */
export function backLegOf(entries) {
  const backs = (entries || []).filter((e) => e && e.kind === 'placed' && e.placed && e.placed.side === 'back');
  if (!backs.length) return null;
  const p = backs[backs.length - 1].placed;
  return { price: String(p.price), stake: String(p.stake), where: p.where || null, mode: p.mode || null };
}

/** Why a line cannot ask the server to build a lay yet, or null when it can. The server decides everything else. */
export function placeBlocker(line, entries, status) {
  if (!line || !line.parsed) return 'the line could not be read';
  if (line.layout === 'six') return SIX_CELL_NO_ORDER;
  if (!backLegOf(entries)) return 'record the back leg as Placed first: the lay is built from the back price actually taken';
  if (!status) return "read the server's status first (Refresh status in the Server panel)";
  return null;
}

/** The body of POST /orders/build: the line's cells as pasted, the recorded back leg, the layout. */
export function buildBody({ date, line, back }) {
  const c = line.cells || {};
  const cap = c.betfairCap;
  return {
    date,
    slot: line.slot,
    line: {
      id: line.id,
      race: String(c.race || ''),
      horse: String(c.horse || ''),
      lay_target: String(c.layTarget || ''),
      betfair_cap: cap === undefined || cap === null || cap === '' ? null : String(cap),
      layout: line.layout === 'six' ? 'six' : 'seven',
    },
    back: { price: String(back.price), stake: String(back.stake), where: back.where || null },
  };
}

/** The body of POST /orders/place: the build's body, its ticket, and a reason in words. */
export function placeBody(body, build, reason) {
  return { ...body, ticket: build.ticket, reason: String(reason || '').trim() || null };
}

/** Why a build cannot be confirmed on this page, or null. */
export function confirmBlocker(build, status) {
  if (!build) return 'nothing built';
  if (build.rule !== LAY_RULE) {
    const v = status && status.version ? status.version : 'unknown';
    return `the server did not apply the lay rule of 2 November 2026 (server ${v} answered without it); nothing to confirm`;
  }
  if (build.status !== 'ok') return `refused: ${(build.refusals || []).join('; ')}`;
  if (!build.ticket) return 'no ticket on the build; nothing to confirm';
  return null;
}

/** The slip's lay target beside the lay price, with how far apart they are. */
export function slipTargetLabel(build) {
  if (!build || !build.slip_lay_target) return 'none on the line';
  const away = build.slip_lay_target_ticks_away;
  if (away === null || away === undefined) return `${build.slip_lay_target} (not compared)`;
  if (away === 0) return `${build.slip_lay_target} (the same tick)`;
  if (away === 1) return `${build.slip_lay_target} (one tick away)`;
  return `${build.slip_lay_target} (${away} ticks away: more than a tick)`;
}

/** The confirm panel's rows: what the server resolved and would send, before anything is sent. */
export function confirmRows(build) {
  if (!build) return [];
  const caps = build.caps || {};
  const where = build.back && build.back.where ? ` at ${build.back.where}` : '';
  return [
    ['Mode', build.mode === 'real' ? 'REAL: this sends an order to Betfair' : 'paper: recorded, nothing is sent'],
    ['Market', build.market_id ? `${build.start_london} ${build.venue} · ${build.market_name} (${build.market_id})` : 'not resolved'],
    ['Runner', build.runner_name ? `${build.runner_name} (${build.selection_id})` : 'not resolved'],
    ['Side', `${build.side} ${build.order_type}, ${build.persistence}`],
    ['Back taken', build.back_price ? `${build.back_price} for ${build.back_stake}${where}` : 'not read'],
    ['Lay price', build.price ? `${build.price}, ${build.under_pct}% under the back; ${build.rung}` : 'none'],
    ["Slip's lay target", slipTargetLabel(build)],
    ['Size', build.size || 'none'],
    ['Liability, at risk', build.liability || 'none'],
    ['Caps', `${caps.per_order_at_risk_gbp} an order, ${caps.per_day_at_risk_gbp} a day; ${caps.day_so_far} at risk so far today in ${build.mode}`],
    ['Betfair cap', build.course_cap ? `${build.course_cap}, shown only: a limit on the morning's Betfair back, not on this lay` : 'none on this line'],
    ['References', `${build.customer_order_ref} / ${build.customer_strategy_ref}`],
    ['Ticket', build.ticket || 'none'],
  ];
}

/** The server's ledger records (GET /orders?date=) for one line, oldest first. */
export function ordersForLine(ledger, lineId) {
  const records = (ledger && ledger.records) || [];
  return records.filter((r) => r && r.order && r.order.line && r.order.line.id === lineId);
}

/** One sentence of order status for a line, from its latest ledger record; '' when there is none. */
export function orderStatusLabel(records) {
  if (!records || !records.length) return '';
  const r = records[records.length - 1];
  const o = r.order || {};
  const sent = r.sent ? `sent to Betfair${r.bet_id ? `, bet ${r.bet_id}` : ''}` : 'recorded, nothing sent';
  const what = o.price ? `LAY ${o.size} at ${o.price}` : 'the order';
  if (r.event === 'placed') return `Placed (${r.mode}): ${what}; ${sent}; reference ${r.order_ref}.`;
  if (r.event === 'cancelled') return `Cancelled (${r.mode}): ${r.order_ref}; ${sent}.`;
  if (r.event === 'refused') return `Refused (${r.mode}): ${(o.refusals || []).join('; ')}.`;
  if (r.event === 'place_failed') return `Place failed (${r.mode}): ${r.error || (r.betfair && r.betfair.errorCode) || 'see the record'}.`;
  if (r.event === 'cancel_failed') return `Cancel failed (${r.mode}): ${r.error || 'see the record'}.`;
  return `${r.event} (${r.mode}).`;
}
