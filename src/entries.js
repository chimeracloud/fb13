// Entries: what a person records against a line. Append only. An edit is a
// new entry, never an overwrite, and a line's state is its latest entry.

import { newId } from './parse.js';
import { todayInLondon, nowInLondon } from './dates.js';

export const WHERE_BETFAIR = 'Betfair';
export const WHERE_OTHER = 'Other';
export const SIDES = ['back', 'lay'];
export const BOG = ['yes', 'no', 'unknown'];
export const HOW = [
  { value: 'app', label: 'by an app' },
  { value: 'person', label: 'by a person' },
  { value: 'automatic', label: 'automatic' },
];
export const MODES = ['paper', 'real'];
export const DEFAULT_STAKE = '50';

export function howLabel(value) {
  const h = HOW.find((x) => x.value === value);
  return h ? h.label : value;
}

/** Betfair, each bookmaker code on this line exactly as it appears, and Other. */
export function whereOptions(line) {
  const codes = (line && line.derived && line.derived.codes) || [];
  const seen = new Set([WHERE_BETFAIR, WHERE_OTHER]);
  const out = [WHERE_BETFAIR];
  for (const c of codes) {
    if (!seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  }
  out.push(WHERE_OTHER);
  return out;
}

/** The form as it opens. Mode is paper until the person says real. */
export function blankPlaced(now = new Date()) {
  return {
    where: '',
    whereOther: '',
    side: '',
    price: '',
    bog: 'unknown',
    stake: DEFAULT_STAKE,
    time: nowInLondon(now),
    how: '',
    mode: 'paper',
    reference: '',
  };
}

function isPositiveNumber(s) {
  const t = String(s ?? '').trim();
  return /^\d+(\.\d+)?$/.test(t) && Number(t) > 0;
}

/** Field name to message. Empty when the form can be saved. */
export function validatePlaced(f) {
  const errors = {};
  if (!f.where) errors.where = 'Choose where it was placed';
  if (f.where === WHERE_OTHER && !String(f.whereOther || '').trim()) {
    errors.whereOther = 'Name the bookmaker';
  }
  if (!SIDES.includes(f.side)) errors.side = 'Back or lay';
  if (!isPositiveNumber(f.price)) errors.price = 'Price obtained, as a number';
  if (!BOG.includes(f.bog)) errors.bog = 'Yes, no or unknown';
  if (!isPositiveNumber(f.stake)) errors.stake = 'Stake, as a number';
  if (!/^\d{2}:\d{2}$/.test(String(f.time || ''))) errors.time = 'Time as HH:MM';
  if (!HOW.some((h) => h.value === f.how)) errors.how = 'How it was placed';
  if (!MODES.includes(f.mode)) errors.mode = 'Paper or real';
  return errors;
}

function normalisePlaced(f) {
  const other = f.where === WHERE_OTHER;
  return {
    where: other ? String(f.whereOther).trim() : f.where,
    whereKind: f.where === WHERE_BETFAIR ? 'betfair' : other ? 'other' : 'code',
    side: f.side,
    price: String(f.price).trim(),
    bog: f.bog,
    stake: String(f.stake).trim(),
    time: f.time,
    how: f.how,
    mode: f.mode,
    reference: String(f.reference || '').trim(),
  };
}

/** A new entry against a line. kind is 'placed' or 'not_placed'. */
export function makeEntry({ line, kind, placed = null, now = new Date() }) {
  if (kind !== 'placed' && kind !== 'not_placed') throw new Error(`unknown entry kind: ${kind}`);
  return {
    id: newId('en'),
    lineId: line.id,
    slot: line.slot,
    date: line.date,
    kind,
    at: now.toISOString(),
    atLondon: `${todayInLondon(now)} ${nowInLondon(now)}`,
    placed: kind === 'placed' ? normalisePlaced(placed) : null,
  };
}

/** Entries for one line, oldest first, as they were recorded. */
export function entriesFor(entries, lineId) {
  return entries.filter((e) => e.lineId === lineId);
}

export function latestFor(entries, lineId) {
  const xs = entriesFor(entries, lineId);
  return xs.length ? xs[xs.length - 1] : null;
}

/** 'placed', 'not_placed' or 'waiting'. */
export function lineStatus(entries, lineId) {
  const latest = latestFor(entries, lineId);
  return latest ? latest.kind : 'waiting';
}

export function counters(lines, entries) {
  const c = { lines: lines.length, placed: 0, waiting: 0, notPlaced: 0, flagged: 0 };
  for (const l of lines) {
    const s = lineStatus(entries, l.id);
    if (s === 'placed') c.placed += 1;
    else if (s === 'not_placed') c.notPlaced += 1;
    else c.waiting += 1;
    if (!l.parsed) c.flagged += 1;
  }
  return c;
}
