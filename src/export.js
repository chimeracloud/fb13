// Export: every entry as CSV and as JSON, each row carrying the date, the slot
// and the mode. A file made in the browser and saved to the device, nothing
// else: no request, no server. In version 0 the browser is the only store, so
// the export is the only way out, which is why the page calls itself a
// worksheet and not yet the record.

import { version } from '../package.json';
import { todayInLondon, nowInLondon } from './dates.js';

export const NOTICE =
  'Worksheet, not yet the record. Made by the FB13 trade slip page from the entries kept in one ' +
  'browser on one device. The page records what a person did elsewhere and places nothing. An ' +
  "entry is never edited or deleted: a correction is a new entry, and a line's state is its latest " +
  'entry. A not placed entry carries no mode, because none was stated.';

/** The line stood in for an entry whose line is not on the page. Should not happen: a paste cannot be removed once anything is recorded against it. */
const MISSING_LINE = { cells: {}, parsed: false, flag: 'line not on this page' };

const placed = (get) => (e) => (e.placed ? get(e.placed) : '');
const cell = (key) => (e, l) => (l.cells && l.cells[key]) || '';

/** Column name and how its value is read from the entry and its line. In reading order. */
export const CSV_COLUMNS = [
  ['date', (e) => e.date],
  ['slot', (e) => e.slot],
  ['race', cell('race')],
  ['horse', cell('horse')],
  ['kind', (e) => e.kind],
  ['mode', placed((p) => p.mode)],
  ['where', placed((p) => p.where)],
  ['where_kind', placed((p) => p.whereKind)],
  ['side', placed((p) => p.side)],
  ['price', placed((p) => p.price)],
  ['stake', placed((p) => p.stake)],
  ['bog', placed((p) => p.bog)],
  ['placed_time', placed((p) => p.time)],
  ['how', placed((p) => p.how)],
  ['reference', placed((p) => p.reference)],
  ['recorded_at_london', (e) => e.atLondon],
  ['recorded_at_utc', (e) => e.at],
  ['best_price', cell('bestPrice')],
  ['best_bog', cell('bestBog')],
  ['betfair', cell('betfair')],
  ['lay_target', cell('layTarget')],
  ['betfair_cap', cell('betfairCap')],
  ['line_flag', (e, l) => l.flag || ''],
  ['entry_id', (e) => e.id],
  ['line_id', (e) => e.lineId],
];

/** One CSV field, RFC 4180: quoted when it holds a comma, a quote or a line break, quotes doubled. */
export function csvField(value) {
  const s = value == null ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function linesById(lines) {
  return new Map((lines || []).map((l) => [l.id, l]));
}

/** UTF-8 with a byte order mark, so a spreadsheet reads the £ and the ⚠; CRLF between rows. */
export function entriesToCsv(entries, lines) {
  const byId = linesById(lines);
  const rows = [CSV_COLUMNS.map(([name]) => name).join(',')];
  for (const e of entries) {
    const l = byId.get(e.lineId) || MISSING_LINE;
    rows.push(CSV_COLUMNS.map(([, read]) => csvField(read(e, l))).join(','));
  }
  return `﻿${rows.join('\r\n')}\r\n`;
}

/** The entries with the whole line embedded, the page version, when, and the notice. */
export function exportObject(entries, lines, now = new Date()) {
  const byId = linesById(lines);
  return {
    page: 'FB13 trade slip',
    version,
    exportedAt: now.toISOString(),
    exportedAtLondon: `${todayInLondon(now)} ${nowInLondon(now)}`,
    notice: NOTICE,
    count: entries.length,
    entries: entries.map((e) => ({ ...e, line: byId.get(e.lineId) || null })),
  };
}

export function entriesToJson(entries, lines, now = new Date()) {
  return `${JSON.stringify(exportObject(entries, lines, now), null, 2)}\n`;
}

/** fb13-entries-YYYY-MM-DD-HHMM.ext, UK date and time of the export. */
export function exportFilename(ext, now = new Date()) {
  return `fb13-entries-${todayInLondon(now)}-${nowInLondon(now).replace(':', '')}.${ext}`;
}

/**
 * Save text as a file on the device: an anchor with a download name, clicked
 * once. An object URL where the browser has them, a data URL otherwise. Both
 * stay inside the browser. Returns the href used.
 */
export function downloadText({ filename, text, type }, doc = globalThis.document) {
  const { href, objectUrl } = fileHref(text, type);
  const a = doc.createElement('a');
  a.href = href;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  doc.body.appendChild(a);
  a.click();
  doc.body.removeChild(a);
  if (objectUrl) setTimeout(() => URL.revokeObjectURL(href), 60_000);
  return href;
}

/** An object URL where the browser makes one, otherwise a data URL. Both stay inside the browser. */
function fileHref(text, type) {
  try {
    if (typeof Blob !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      return { href: URL.createObjectURL(new Blob([text], { type })), objectUrl: true };
    }
  } catch {
    // fall through to a data URL
  }
  return { href: `data:${type},${encodeURIComponent(text)}`, objectUrl: false };
}
