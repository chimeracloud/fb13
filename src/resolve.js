// What the page sends the server to resolve, and how an answer reads on a line.
// Pure functions. The server does the matching (server/app/resolver.py); the
// page only carries the race and horse cells across and shows what came back.

export function linesForResolve(lines) {
  return (lines || [])
    .filter((l) => l && l.parsed && l.cells)
    .map((l) => ({ id: l.id, race: String(l.cells.race || ''), horse: String(l.cells.horse || '') }));
}

export function resolutionLabel(r) {
  if (!r) return '';
  if (r.status === 'resolved') return `Betfair ${r.market_id} · ${r.runner_name} (${r.selection_id})`;
  return `Not resolved: ${r.flag || 'no reason given'}`;
}

export function marketsSummary(data) {
  if (!data || !data.summary) return '';
  const s = data.summary;
  if (!s.count) return `No GB or IE win markets for ${data.date} in the catalogue.`;
  return `${s.count} win markets on ${data.date}, first off ${s.first_off}, last off ${s.last_off}, ${s.runners} runners, at ${s.venues.join(', ')}.`;
}

export function sessionLabel(status) {
  const b = status && status.betfair;
  if (!b) return 'unknown';
  if (b.session === 'logged_in') return `logged in (delayed key) since ${b.logged_in_at}`;
  if (b.session === 'failed') return `login failed, not retried: ${b.error}`;
  if (b.session === 'expired') return `session expired: ${b.error}`;
  return b.session;
}
