// Dates and times in Europe/London, whatever the device's zone. Charles's
// ruling of 30 October 2026: the date defaults to today in London, not on the
// device.

const LONDON = 'Europe/London';

function parts(now, options) {
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, ...options });
  const out = {};
  for (const p of fmt.formatToParts(now)) out[p.type] = p.value;
  return out;
}

/** Today's date in Europe/London as YYYY-MM-DD. */
export function todayInLondon(now = new Date()) {
  const p = parts(now, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}-${p.month}-${p.day}`;
}

/** The current time in Europe/London as HH:MM, 24 hour clock. */
export function nowInLondon(now = new Date()) {
  const p = parts(now, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  return `${p.hour}:${p.minute}`;
}
