import { describe, it, expect } from 'vitest';
import { parseHtmlSlip, parsePlainSlip, parseSlip, manualLine, codesFromBestPrice } from './parse.js';

// Real fixtures from Mark's Early Doors email of 30 October 2026, trimmed.
// Nothing here is invented. Build every test from these.

const HEADER =
  '<tr><th>Race</th><th>Horse</th><th>Best price</th><th>Best BOG</th><th>Betfair</th><th>Lay target</th><th>Betfair cap</th></tr>';
const ROW_DOVE =
  '<tr><td>11:35 Newmarket</td><td><b>Dove Tale</b></td><td>2.88 <span>BetMGM, SI</span></td><td>2.88</td><td>3.15 <br><span>07:52 API</span></td><td><b>2.74</b> <span>(13% under)</span></td><td>£240</td></tr>';
const ROW_SERVE =
  '<tr><td>12:35 Uttoxeter</td><td><b>Hold The Serve</b></td><td>1.44 <span>B3, BTT</span></td><td>1.44</td><td>1.45 <br><span>07:52 API</span></td><td><b>1.37</b> <span>(5% under)</span></td><td>£140</td></tr>';
const ROW_FEELINGS =
  '<tr><td>15:20 Uttoxeter</td><td><b>No Hard Feelings</b></td><td>no price read</td><td>–</td><td>– <br><span>07:52 API</span></td><td>–</td><td>£140</td></tr>';
const ROW_STARS =
  '<tr><td>19:00 Dundalk</td><td><b>Wearing Stars</b></td><td>2.50 <span>B3, BetMGM</span></td><td>2.50</td><td>2.02 <span style="color:#b00;font-weight:bold">⚠ check</span> <br><span>07:52 API</span></td><td><b>1.76</b> <span>(13% under)</span></td><td>£25</td></tr>';

const TABLE = `<table>${HEADER}${ROW_DOVE}${ROW_SERVE}${ROW_FEELINGS}${ROW_STARS}</table>`;

const PLAIN = `11:35 Newmarket *Dove Tale* 2.88 BetMGM, SI 2.88 3.15
07:52 API *2.74* (13% under) £240

15:20 Uttoxeter *No Hard Feelings* no price read – –
07:52 API – £140

19:00 Dundalk *Wearing Stars* 2.50 B3, BetMGM 2.50 2.02 ⚠ check
07:52 API *1.76* (13% under) £25`;

const DOVE = {
  race: '11:35 Newmarket',
  horse: 'Dove Tale',
  bestPrice: '2.88 BetMGM, SI',
  bestBog: '2.88',
  betfair: '3.15\n07:52 API',
  layTarget: '2.74 (13% under)',
  betfairCap: '£240',
};
const FEELINGS = {
  race: '15:20 Uttoxeter',
  horse: 'No Hard Feelings',
  bestPrice: 'no price read',
  bestBog: '–',
  betfair: '–\n07:52 API',
  layTarget: '–',
  betfairCap: '£140',
};
const STARS = {
  race: '19:00 Dundalk',
  horse: 'Wearing Stars',
  bestPrice: '2.50 B3, BetMGM',
  bestBog: '2.50',
  betfair: '2.02 ⚠ check\n07:52 API',
  layTarget: '1.76 (13% under)',
  betfairCap: '£25',
};

describe('the HTML table from the email', () => {
  it('reads all four rows, every cell as it arrived', () => {
    const r = parseHtmlSlip(TABLE);
    expect(r.source).toBe('html');
    expect(r.lines).toHaveLength(4);
    expect(r.lines.every((l) => l.parsed)).toBe(true);
    expect(r.lines[0].cells).toEqual(DOVE);
    expect(r.lines[1].cells).toEqual({
      race: '12:35 Uttoxeter',
      horse: 'Hold The Serve',
      bestPrice: '1.44 B3, BTT',
      bestBog: '1.44',
      betfair: '1.45\n07:52 API',
      layTarget: '1.37 (5% under)',
      betfairCap: '£140',
    });
    expect(r.lines[2].cells).toEqual(FEELINGS);
    expect(r.lines[3].cells).toEqual(STARS);
  });

  it('keeps the bookmaker codes exactly as written and only splits them for the where field', () => {
    const r = parseHtmlSlip(TABLE);
    expect(r.lines[0].derived.codes).toEqual(['BetMGM', 'SI']);
    expect(r.lines[1].derived.codes).toEqual(['B3', 'BTT']);
    expect(r.lines[2].derived.codes).toEqual([]);
    expect(r.lines[3].derived.codes).toEqual(['B3', 'BetMGM']);
    expect(codesFromBestPrice('no price read')).toEqual([]);
  });

  it('marks the Betfair check and keeps the API time', () => {
    const r = parseHtmlSlip(TABLE);
    expect(r.lines[3].derived.betfairCheck).toBe(true);
    expect(r.lines[0].derived.betfairCheck).toBe(false);
    expect(r.lines[0].derived.betfairTime).toBe('07:52 API');
  });

  it('maps columns by header text, so their order does not matter', () => {
    const header =
      '<tr><th>Horse</th><th>Race</th><th>Betfair cap</th><th>Lay target</th><th>Betfair</th><th>Best BOG</th><th>Best price</th></tr>';
    const row =
      '<tr><td><b>Dove Tale</b></td><td>11:35 Newmarket</td><td>£240</td><td><b>2.74</b> <span>(13% under)</span></td><td>3.15 <br><span>07:52 API</span></td><td>2.88</td><td>2.88 <span>BetMGM, SI</span></td></tr>';
    const r = parseHtmlSlip(`<table>${header}${row}</table>`);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].cells).toEqual(DOVE);
  });

  it('shows a short row as it is, flagged, and drops nothing', () => {
    const short = '<tr><td>16:10 Newmarket</td><td><b>Some Horse</b></td><td>3.00 <span>WH</span></td><td>3.00</td><td>3.20 <br><span>07:52 API</span></td><td>£100</td></tr>';
    const r = parseHtmlSlip(`<table>${HEADER}${ROW_DOVE}${short}${ROW_STARS}</table>`);
    expect(r.lines).toHaveLength(3);
    expect(r.lines[1].parsed).toBe(false);
    expect(r.lines[1].flag).toMatch(/6 cells/);
    expect(r.lines[1].raw).toContain('Some Horse');
    expect(r.lines[0].parsed).toBe(true);
    expect(r.lines[2].parsed).toBe(true);
  });

  it('flags every row when a header is missing, naming the column', () => {
    const header = '<tr><th>Race</th><th>Horse</th><th>Best price</th><th>Best BOG</th><th>Betfair</th><th>Lay target</th></tr>';
    const row = '<tr><td>11:35 Newmarket</td><td><b>Dove Tale</b></td><td>2.88 <span>BetMGM, SI</span></td><td>2.88</td><td>3.15</td><td>2.74</td></tr>';
    const r = parseHtmlSlip(`<table>${header}${row}</table>`);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].parsed).toBe(false);
    expect(r.lines[0].flag).toContain('Betfair cap');
  });

  it('keeps the text below the table as a note and does not parse it', () => {
    const html = `<p>Early Doors 08:00</p>${TABLE}<p>Lay rules: lay at the target or better. Cap per the last column.</p>`;
    const r = parseHtmlSlip(html);
    expect(r.lines).toHaveLength(4);
    expect(r.note).toContain('Lay rules: lay at the target or better.');
    expect(r.note).toContain('Early Doors 08:00');
    expect(r.note).not.toContain('Dove Tale');
  });

  it('finds the slip inside a mail client layout table', () => {
    const html = `<table><tr><td><div>Hello</div>${TABLE}</td></tr></table>`;
    const r = parseHtmlSlip(html);
    expect(r.lines).toHaveLength(4);
    expect(r.lines[0].cells).toEqual(DOVE);
  });

  it('returns null when there is no slip table', () => {
    expect(parseHtmlSlip('<p>no table here</p>')).toBeNull();
    expect(parseHtmlSlip('<table><tr><td>a</td><td>b</td></tr></table>')).toBeNull();
    expect(parseHtmlSlip('')).toBeNull();
  });
});

describe('the plain text form of the email', () => {
  it('joins each pair of lines into one row and reads the same cells as the table', () => {
    const r = parsePlainSlip(PLAIN);
    expect(r.source).toBe('text');
    expect(r.lines).toHaveLength(3);
    expect(r.lines.every((l) => l.parsed)).toBe(true);
    expect(r.lines[0].cells).toEqual(DOVE);
    expect(r.lines[1].cells).toEqual(FEELINGS);
    expect(r.lines[2].cells).toEqual(STARS);
    expect(r.lines[0].derived.codes).toEqual(['BetMGM', 'SI']);
    expect(r.lines[2].derived.betfairCheck).toBe(true);
  });

  it('keeps the header line and the lay rules as a note, unparsed', () => {
    const text = `Race Horse Best price Best BOG Betfair Lay target Betfair cap\n${PLAIN}\n\nLay rules: lay at the target or better.\nThe cap is the most to lay.`;
    const r = parsePlainSlip(text);
    expect(r.lines).toHaveLength(3);
    expect(r.note).toContain('Race Horse Best price');
    expect(r.note).toContain('Lay rules: lay at the target or better.');
    expect(r.note).toContain('The cap is the most to lay.');
    expect(r.lines[2].cells).toEqual(STARS);
  });

  it('shows a selection with no second line as it is, flagged, and keeps counting', () => {
    const text = `11:35 Newmarket *Dove Tale* 2.88 BetMGM, SI 2.88 3.15\n19:00 Dundalk *Wearing Stars* 2.50 B3, BetMGM 2.50 2.02 ⚠ check\n07:52 API *1.76* (13% under) £25`;
    const r = parsePlainSlip(text);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].parsed).toBe(false);
    expect(r.lines[0].flag).toBe('second line missing');
    expect(r.lines[0].raw).toBe('11:35 Newmarket *Dove Tale* 2.88 BetMGM, SI 2.88 3.15');
    expect(r.lines[1].cells).toEqual(STARS);
  });

  it('shows a first line it cannot read as it is, flagged', () => {
    const text = `11:35 Newmarket Dove Tale something else entirely\n07:52 API *2.74* (13% under) £240`;
    const r = parsePlainSlip(text);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].parsed).toBe(false);
    expect(r.lines[0].flag).toBe('first line did not read');
    expect(r.lines[0].raw).toContain('Dove Tale something else entirely');
  });
});

describe('what a paste gives us', () => {
  it('prefers the HTML table when the clipboard has one', () => {
    const r = parseSlip({ html: TABLE, text: PLAIN });
    expect(r.source).toBe('html');
    expect(r.lines).toHaveLength(4);
  });

  it('falls back to plain text when there is no table', () => {
    const r = parseSlip({ html: '<div>no table</div>', text: PLAIN });
    expect(r.source).toBe('text');
    expect(r.lines).toHaveLength(3);
  });

  it('reads HTML without a table as text when there is no plain text at all', () => {
    const html = PLAIN.split('\n').map((l) => `<div>${l}</div>`).join('');
    const r = parseSlip({ html, text: '' });
    expect(r.source).toBe('text');
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0].cells).toEqual(DOVE);
  });

  it('returns no lines for an empty paste', () => {
    expect(parseSlip({ html: '', text: '' }).lines).toEqual([]);
  });
});

describe('a line added by hand', () => {
  it('keeps the seven cells as typed and is marked manual', () => {
    const l = manualLine({
      race: '14:05 Ascot',
      horse: 'Some Horse',
      bestPrice: '4.00 WH',
      bestBog: '4.00',
      betfair: '4.30',
      layTarget: '3.74 (13% under)',
      betfairCap: '£50',
    });
    expect(l.parsed).toBe(true);
    expect(l.source).toBe('manual');
    expect(l.cells.race).toBe('14:05 Ascot');
    expect(l.derived.codes).toEqual(['WH']);
  });
});
