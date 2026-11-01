import { describe, it, expect } from 'vitest';
import { parseHtmlSlip } from './parse.js';
import { makeEntry, blankPlaced } from './entries.js';
import { version as pkgVersion } from '../package.json';
import {
  CSV_COLUMNS,
  NOTICE,
  csvField,
  entriesToCsv,
  exportObject,
  entriesToJson,
  exportFilename,
  downloadText,
} from './export.js';

// The real rows again, as in the entries tests.
const TABLE =
  '<table><tr><th>Race</th><th>Horse</th><th>Best price</th><th>Best BOG</th><th>Betfair</th><th>Lay target</th><th>Betfair cap</th></tr>' +
  '<tr><td>11:35 Newmarket</td><td><b>Dove Tale</b></td><td>2.88 <span>BetMGM, SI</span></td><td>2.88</td><td>3.15 <br><span>07:52 API</span></td><td><b>2.74</b> <span>(13% under)</span></td><td>£240</td></tr>' +
  '<tr><td>15:20 Uttoxeter</td><td><b>No Hard Feelings</b></td><td>no price read</td><td>–</td><td>– <br><span>07:52 API</span></td><td>–</td><td>£140</td></tr>' +
  '</table>';

const NOW = new Date('2026-10-30T13:34:00Z');
const LATER = new Date('2026-11-02T09:15:00Z');

function lines() {
  return parseHtmlSlip(TABLE).lines.map((l) => ({ ...l, pasteId: 'paste_1', slot: '08:00', date: '2026-10-30' }));
}

function placedAtSI() {
  return { ...blankPlaced(NOW), where: 'SI', side: 'back', price: '2.88', how: 'app', mode: 'real', reference: 'A1,"x"' };
}

function twoEntries() {
  const ls = lines();
  const [dove, feelings] = ls;
  const entries = [
    makeEntry({ line: dove, kind: 'placed', placed: placedAtSI(), now: NOW }),
    makeEntry({ line: feelings, kind: 'not_placed', now: NOW }),
  ];
  return { ls, dove, feelings, entries };
}

describe('a CSV field', () => {
  it('is quoted when it holds a comma, a quote or a line break, and left alone otherwise', () => {
    expect(csvField('2.88')).toBe('2.88');
    expect(csvField('2.88 BetMGM, SI')).toBe('"2.88 BetMGM, SI"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('3.15\n07:52 API')).toBe('"3.15\n07:52 API"');
    expect(csvField('a\r\nb')).toBe('"a\r\nb"');
    expect(csvField('')).toBe('');
    expect(csvField(null)).toBe('');
    expect(csvField(undefined)).toBe('');
    expect(csvField(50)).toBe('50');
  });
});

describe('the CSV', () => {
  it('starts with the byte order mark, then one header and one row per entry, CRLF between', () => {
    const { ls, entries } = twoEntries();
    const csv = entriesToCsv(entries, ls);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const rows = csv.slice(1).split('\r\n');
    expect(rows).toHaveLength(4);
    expect(rows[3]).toBe('');
    expect(rows[0]).toBe(CSV_COLUMNS.map(([name]) => name).join(','));
    expect(rows[0]).toBe(
      'date,slot,race,horse,kind,mode,where,where_kind,side,price,stake,bog,placed_time,how,reference,' +
        'recorded_at_london,recorded_at_utc,best_price,best_bog,betfair,lay_target,betfair_cap,line_flag,entry_id,line_id',
    );
  });

  it('writes a placed entry with the date, the slot, the stated mode and the line it was recorded against', () => {
    const { ls, dove, entries } = twoEntries();
    const rows = entriesToCsv(entries, ls).slice(1).split('\r\n');
    expect(rows[1]).toBe(
      `2026-10-30,08:00,11:35 Newmarket,Dove Tale,placed,real,SI,code,back,2.88,50,unknown,13:34,app,"A1,""x""",` +
        `2026-10-30 13:34,2026-10-30T13:34:00.000Z,"2.88 BetMGM, SI",2.88,"3.15\n07:52 API",2.74 (13% under),£240,,${entries[0].id},${dove.id}`,
    );
  });

  it('writes a not placed entry with no mode and the rest of the form empty, because none was stated', () => {
    const { ls, feelings, entries } = twoEntries();
    const rows = entriesToCsv(entries, ls).slice(1).split('\r\n');
    expect(rows[2]).toBe(
      `2026-10-30,08:00,15:20 Uttoxeter,No Hard Feelings,not_placed,,,,,,,,,,,` +
        `2026-10-30 13:34,2026-10-30T13:34:00.000Z,no price read,–,"–\n07:52 API",–,£140,,${entries[1].id},${feelings.id}`,
    );
  });

  it('keeps the order entries were recorded in, so an edit follows the entry it corrects', () => {
    const { ls, dove, entries } = twoEntries();
    entries.push(makeEntry({ line: dove, kind: 'not_placed', now: new Date('2026-10-30T13:40:00Z') }));
    const rows = entriesToCsv(entries, ls).slice(1).split('\r\n');
    expect(rows).toHaveLength(5);
    expect(rows[1].startsWith('2026-10-30,08:00,11:35 Newmarket,Dove Tale,placed,real,')).toBe(true);
    expect(rows[3].startsWith('2026-10-30,08:00,11:35 Newmarket,Dove Tale,not_placed,,')).toBe(true);
    expect(rows[3]).toContain(',2026-10-30 13:40,2026-10-30T13:40:00.000Z,');
  });

  it('still writes an entry whose line is not on the page, flagged as such', () => {
    const { ls, entries } = twoEntries();
    const orphan = { ...entries[0], id: 'en_orphan', lineId: 'ln_gone' };
    const rows = entriesToCsv([orphan], ls).slice(1).split('\r\n');
    expect(rows[1]).toBe(
      `2026-10-30,08:00,,,placed,real,SI,code,back,2.88,50,unknown,13:34,app,"A1,""x""",` +
        `2026-10-30 13:34,2026-10-30T13:34:00.000Z,,,,,,line not on this page,en_orphan,ln_gone`,
    );
  });

  it('is just the header with no entries', () => {
    expect(entriesToCsv([], lines()).slice(1).split('\r\n')).toHaveLength(2);
  });
});

describe('the JSON', () => {
  it('carries the page, its version, when, the notice, the count and each entry with its line', () => {
    const { ls, dove, feelings, entries } = twoEntries();
    const o = exportObject(entries, ls, LATER);
    expect(o.page).toBe('FB13 trade slip');
    expect(o.version).toBe(pkgVersion);
    expect(o.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(o.exportedAt).toBe('2026-11-02T09:15:00.000Z');
    expect(o.exportedAtLondon).toBe('2026-11-02 09:15');
    expect(o.notice).toBe(NOTICE);
    expect(o.notice).toContain('Worksheet, not yet the record');
    expect(o.count).toBe(2);
    expect(o.entries).toHaveLength(2);
    expect(o.entries[0].slot).toBe('08:00');
    expect(o.entries[0].date).toBe('2026-10-30');
    expect(o.entries[0].placed.mode).toBe('real');
    expect(o.entries[0].placed.where).toBe('SI');
    expect(o.entries[0].line.id).toBe(dove.id);
    expect(o.entries[0].line.cells.betfair).toBe('3.15\n07:52 API');
    expect(o.entries[0].line.derived.codes).toEqual(['BetMGM', 'SI']);
    expect(o.entries[1].kind).toBe('not_placed');
    expect(o.entries[1].placed).toBeNull();
    expect(o.entries[1].line.id).toBe(feelings.id);
    expect(o.entries[1].line.cells.horse).toBe('No Hard Feelings');
  });

  it('reads back as the same object, and a missing line is null', () => {
    const { ls, entries } = twoEntries();
    const text = entriesToJson(entries, ls, LATER);
    expect(text.endsWith('}\n')).toBe(true);
    expect(JSON.parse(text)).toEqual(exportObject(entries, ls, LATER));
    const orphan = { ...entries[0], lineId: 'ln_gone' };
    expect(JSON.parse(entriesToJson([orphan], ls, LATER)).entries[0].line).toBeNull();
  });
});

describe('the file', () => {
  it('is named with the UK date and time of the export', () => {
    expect(exportFilename('csv', LATER)).toBe('fb13-entries-2026-11-02-0915.csv');
    expect(exportFilename('json', LATER)).toBe('fb13-entries-2026-11-02-0915.json');
    // Clocks went back on 25 October 2026, so 13:34Z is 13:34 in London.
    expect(exportFilename('csv', NOW)).toBe('fb13-entries-2026-10-30-1334.csv');
  });

  it('is saved by one anchor with a download name, clicked once, and nothing else', () => {
    const made = [];
    const added = [];
    const removed = [];
    const anchor = { style: {}, clicks: 0, click() { this.clicks += 1; } };
    const doc = {
      createElement: (tag) => {
        made.push(tag);
        return anchor;
      },
      body: {
        appendChild: (el) => added.push(el),
        removeChild: (el) => removed.push(el),
      },
    };
    const href = downloadText({ filename: 'fb13-entries-x.csv', text: 'a,b\r\n', type: 'text/csv;charset=utf-8' }, doc);
    expect(made).toEqual(['a']);
    expect(added).toEqual([anchor]);
    expect(removed).toEqual([anchor]);
    expect(anchor.clicks).toBe(1);
    expect(anchor.download).toBe('fb13-entries-x.csv');
    expect(anchor.rel).toBe('noopener');
    expect(anchor.href).toBe(href);
    expect(/^(blob:|data:text\/csv;charset=utf-8,)/.test(href)).toBe(true);
    if (href.startsWith('data:')) {
      expect(decodeURIComponent(href.slice(href.indexOf(',') + 1))).toBe('a,b\r\n');
    }
  });
});
