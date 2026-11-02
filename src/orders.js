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
