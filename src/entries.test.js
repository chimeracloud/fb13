import { describe, it, expect } from 'vitest';
import { parseHtmlSlip } from './parse.js';
import {
  whereOptions,
  blankPlaced,
  validatePlaced,
  makeEntry,
  entriesFor,
  latestFor,
  lineStatus,
  counters,
} from './entries.js';

// The real rows again: the where field offers the codes exactly as they arrive.
const TABLE =
  '<table><tr><th>Race</th><th>Horse</th><th>Best price</th><th>Best BOG</th><th>Betfair</th><th>Lay target</th><th>Betfair cap</th></tr>' +
  '<tr><td>11:35 Newmarket</td><td><b>Dove Tale</b></td><td>2.88 <span>BetMGM, SI</span></td><td>2.88</td><td>3.15 <br><span>07:52 API</span></td><td><b>2.74</b> <span>(13% under)</span></td><td>£240</td></tr>' +
  '<tr><td>15:20 Uttoxeter</td><td><b>No Hard Feelings</b></td><td>no price read</td><td>–</td><td>– <br><span>07:52 API</span></td><td>–</td><td>£140</td></tr>' +
  '</table>';

function lines() {
  return parseHtmlSlip(TABLE).lines.map((l) => ({ ...l, slot: '08:00', date: '2026-10-30' }));
}

const NOW = new Date('2026-10-30T13:34:00Z');

function complete() {
  return {
    ...blankPlaced(NOW),
    where: 'Betfair',
    side: 'lay',
    price: '2.72',
    how: 'person',
  };
}

describe('the where field', () => {
  it('offers Betfair, each code on the line as written, and Other', () => {
    const [dove, feelings] = lines();
    expect(whereOptions(dove)).toEqual(['Betfair', 'BetMGM', 'SI', 'Other']);
    expect(whereOptions(feelings)).toEqual(['Betfair', 'Other']);
  });
});

describe('the placed form', () => {
  it('opens with paper, stake 50, now in London, BOG unknown, and nothing chosen', () => {
    const f = blankPlaced(NOW);
    expect(f.mode).toBe('paper');
    expect(f.stake).toBe('50');
    expect(f.time).toBe('13:34');
    expect(f.bog).toBe('unknown');
    expect(f.where).toBe('');
    expect(f.side).toBe('');
    expect(f.how).toBe('');
  });

  it('refuses to save until where, side, price and how are stated', () => {
    const errors = validatePlaced(blankPlaced(NOW));
    expect(Object.keys(errors).sort()).toEqual(['how', 'price', 'side', 'where']);
  });

  it('needs a bookmaker name when where is Other', () => {
    const errors = validatePlaced({ ...complete(), where: 'Other', whereOther: '' });
    expect(errors.whereOther).toBeTruthy();
    expect(validatePlaced({ ...complete(), where: 'Other', whereOther: 'Skybet' })).toEqual({});
  });

  it('accepts a complete form and rejects a bad price, stake or mode', () => {
    expect(validatePlaced(complete())).toEqual({});
    expect(validatePlaced({ ...complete(), price: 'evens' }).price).toBeTruthy();
    expect(validatePlaced({ ...complete(), stake: '0' }).stake).toBeTruthy();
    expect(validatePlaced({ ...complete(), mode: 'live' }).mode).toBeTruthy();
    expect(validatePlaced({ ...complete(), time: '9:5' }).time).toBeTruthy();
  });
});

describe('entries', () => {
  it('records a placed entry with the line, slot, date, time and the stated mode', () => {
    const [dove] = lines();
    const e = makeEntry({ line: dove, kind: 'placed', placed: complete(), now: NOW });
    expect(e.lineId).toBe(dove.id);
    expect(e.slot).toBe('08:00');
    expect(e.date).toBe('2026-10-30');
    expect(e.kind).toBe('placed');
    expect(e.at).toBe('2026-10-30T13:34:00.000Z');
    expect(e.atLondon).toBe('2026-10-30 13:34');
    expect(e.placed).toEqual({
      where: 'Betfair',
      whereKind: 'betfair',
      side: 'lay',
      price: '2.72',
      bog: 'unknown',
      stake: '50',
      time: '13:34',
      how: 'person',
      mode: 'paper',
      reference: '',
    });
  });

  it('keeps a bookmaker code as written and names an Other bookmaker', () => {
    const [dove] = lines();
    const code = makeEntry({ line: dove, kind: 'placed', placed: { ...complete(), where: 'SI', side: 'back', mode: 'real' }, now: NOW });
    expect(code.placed.where).toBe('SI');
    expect(code.placed.whereKind).toBe('code');
    expect(code.placed.mode).toBe('real');
    const other = makeEntry({ line: dove, kind: 'placed', placed: { ...complete(), where: 'Other', whereOther: ' Skybet ' }, now: NOW });
    expect(other.placed.where).toBe('Skybet');
    expect(other.placed.whereKind).toBe('other');
  });

  it('records not placed with no form', () => {
    const [dove] = lines();
    const e = makeEntry({ line: dove, kind: 'not_placed', now: NOW });
    expect(e.kind).toBe('not_placed');
    expect(e.placed).toBeNull();
  });

  it('an edit is a new entry: the history keeps both and the latest decides the state', () => {
    const [dove, feelings] = lines();
    const entries = [];
    entries.push(makeEntry({ line: dove, kind: 'placed', placed: complete(), now: NOW }));
    expect(lineStatus(entries, dove.id)).toBe('placed');
    entries.push(makeEntry({ line: dove, kind: 'not_placed', now: new Date('2026-10-30T13:40:00Z') }));
    expect(entriesFor(entries, dove.id)).toHaveLength(2);
    expect(latestFor(entries, dove.id).kind).toBe('not_placed');
    expect(lineStatus(entries, dove.id)).toBe('not_placed');
    expect(lineStatus(entries, feelings.id)).toBe('waiting');
  });

  it('counts lines, placed, waiting and not placed from the latest entry per line', () => {
    const ls = lines();
    const [dove, feelings] = ls;
    const entries = [
      makeEntry({ line: dove, kind: 'not_placed', now: NOW }),
      makeEntry({ line: dove, kind: 'placed', placed: complete(), now: NOW }),
    ];
    expect(counters(ls, entries)).toEqual({ lines: 2, placed: 1, waiting: 1, notPlaced: 0, flagged: 0 });
    entries.push(makeEntry({ line: feelings, kind: 'not_placed', now: NOW }));
    expect(counters(ls, entries)).toEqual({ lines: 2, placed: 1, waiting: 0, notPlaced: 1, flagged: 0 });
  });
});
