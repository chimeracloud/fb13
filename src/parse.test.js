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

// ---------------------------------------------------------------------------
// B: the real shape from a browser copy, 30 October 2026. The two real lines
// as the page showed them, with the cells collapsed to spaces:
//   11:35 Newmarket Dove Tale 2.88 B3, SI 2.75 3.10
//   09:52 API 2.70 (13% under) £240
// Tab positions below are the expected ones (a browser copies a table with a
// tab between cells and the <br> inside the Betfair cell as a line break) and
// are to be confirmed from the diagnostics before this commit is pushed.

const REAL_DOVE = {
  race: '11:35 Newmarket',
  horse: 'Dove Tale',
  bestPrice: '2.88 B3, SI',
  bestBog: '2.75',
  betfair: '3.10\n09:52 API',
  layTarget: '2.70 (13% under)',
  betfairCap: '£240',
};

const REAL_TABBED = '11:35 Newmarket\tDove Tale\t2.88 B3, SI\t2.75\t3.10\n09:52 API\t2.70 (13% under)\t£240\n';

describe('B: an HTML table without a header row', () => {
  it('maps seven cells by position and reads the same cells as with a header', () => {
    const r = parseHtmlSlip(`<table>${ROW_DOVE}${ROW_SERVE}${ROW_FEELINGS}${ROW_STARS}</table>`);
    expect(r.mapped).toBe('position');
    expect(r.lines).toHaveLength(4);
    expect(r.lines.every((l) => l.parsed)).toBe(true);
    expect(r.lines[0].cells).toEqual(DOVE);
    expect(r.lines[2].cells).toEqual(FEELINGS);
    expect(r.lines[3].cells).toEqual(STARS);
    expect(r.lines[3].derived.codes).toEqual(['B3', 'BetMGM']);
  });

  it('still prefers the header when there is one', () => {
    expect(parseHtmlSlip(TABLE).mapped).toBe('header');
  });

  it('keeps a line break inside a cell, however the mail client wrote it', () => {
    const row =
      '<tr><td><div>11:35 Newmarket</div></td><td><div><b>Dove Tale</b></div></td><td><div>2.88 <span>B3, SI</span></div></td><td><div>2.75</div></td><td><div>3.10</div><div>09:52 API</div></td><td><div><b>2.70</b> (13% under)</div></td><td><div>£240</div></td></tr>';
    const r = parseHtmlSlip(`<table><tbody>${row}</tbody></table>`);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].cells).toEqual(REAL_DOVE);
    expect(r.lines[0].derived.betfairTime).toBe('09:52 API');
  });

  it('flags a row that is not seven cells and keeps counting', () => {
    const six = '<tr><td>16:10 Newmarket</td><td><b>Some Horse</b></td><td>3.00 <span>WH</span></td><td>3.00</td><td>3.20 <br><span>09:52 API</span></td><td>£100</td></tr>';
    const r = parseHtmlSlip(`<table>${ROW_DOVE}${six}${ROW_STARS}</table>`);
    expect(r.lines).toHaveLength(3);
    expect(r.lines[1].parsed).toBe(false);
    expect(r.lines[1].flag).toBe('6 cells, expected 7');
    expect(r.lines[1].raw).toContain('Some Horse');
    expect(r.lines[0].parsed).toBe(true);
    expect(r.lines[2].parsed).toBe(true);
  });

  it('does not read a header row with other names as a bet', () => {
    const other = '<tr><td>Time</td><td>Selection</td><td>Price</td><td>BOG</td><td>Exchange</td><td>Target</td><td>Cap</td></tr>';
    const r = parseHtmlSlip(`<table>${other}${ROW_DOVE}</table>`);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].parsed).toBe(false);
    expect(r.lines[0].flag).toBe('first cell is not a race time');
    expect(r.lines[1].cells).toEqual(DOVE);
  });

  it('finds the seven cell table inside a layout table', () => {
    const html = `<table><tr><td><div>Hello</div><table>${ROW_DOVE}${ROW_STARS}</table></td></tr></table>`;
    const r = parseHtmlSlip(html);
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].cells).toEqual(DOVE);
    expect(r.note).toBe('Hello');
  });

  it('returns null when no table has a header or seven cell rows', () => {
    expect(parseHtmlSlip('<table><tr><td>a</td><td>b</td></tr></table>')).toBeNull();
  });
});

describe('B: plain text with tabs, a browser copy of the table', () => {
  it('reads the two real lines, five cells then three, into one row', () => {
    const r = parsePlainSlip(REAL_TABBED);
    expect(r.mapped).toBe('tabs');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].parsed).toBe(true);
    expect(r.lines[0].cells).toEqual(REAL_DOVE);
    expect(r.lines[0].derived.codes).toEqual(['B3', 'SI']);
    expect(r.lines[0].derived.betfairTime).toBe('09:52 API');
  });

  it('accepts asterisks round the horse and the lay target, and reads the same cells without them', () => {
    const starred = '11:35 Newmarket\t*Dove Tale*\t2.88 B3, SI\t2.75\t3.10\n09:52 API\t*2.70* (13% under)\t£240';
    expect(parsePlainSlip(starred).lines[0].cells).toEqual(REAL_DOVE);
  });

  it('reads several selections, the no price read row and the check row among them', () => {
    const text = [
      'Race\tHorse\tBest price\tBest BOG\tBetfair\tLay target\tBetfair cap',
      REAL_TABBED.trim(),
      '15:20 Uttoxeter\tNo Hard Feelings\tno price read\t–\t–',
      '09:52 API\t–\t£140',
      '19:00 Dundalk\tWearing Stars\t2.50 B3, UN\t2.50\t2.02 ⚠ check',
      '09:52 API\t1.76 (13% under)\t£25',
      'Lay rules: lay at the target or better.',
    ].join('\n');
    const r = parsePlainSlip(text);
    expect(r.lines).toHaveLength(3);
    expect(r.lines.every((l) => l.parsed)).toBe(true);
    expect(r.lines[1].cells).toEqual({
      race: '15:20 Uttoxeter',
      horse: 'No Hard Feelings',
      bestPrice: 'no price read',
      bestBog: '–',
      betfair: '–\n09:52 API',
      layTarget: '–',
      betfairCap: '£140',
    });
    expect(r.lines[2].cells.betfair).toBe('2.02 ⚠ check\n09:52 API');
    expect(r.lines[2].derived.betfairCheck).toBe(true);
    expect(r.lines[2].derived.codes).toEqual(['B3', 'UN']);
    expect(r.note).toContain('Race | Horse | Best price');
    expect(r.note).toContain('Lay rules: lay at the target or better.');
  });

  it('reads seven cells on one line as a complete row', () => {
    const r = parsePlainSlip('11:35 Newmarket\tDove Tale\t2.88 B3, SI\t2.75\t3.10 09:52 API\t2.70 (13% under)\t£240');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].parsed).toBe(true);
    expect(r.lines[0].cells.betfair).toBe('3.10 09:52 API');
    expect(r.lines[0].cells.betfairCap).toBe('£240');
  });

  it('flags a first line with no API line after it, and shows it', () => {
    const r = parsePlainSlip('11:35 Newmarket\tDove Tale\t2.88 B3, SI\t2.75\t3.10\n19:00 Dundalk\tWearing Stars\t2.50 B3, UN\t2.50\t2.02\n09:52 API\t1.76 (13% under)\t£25');
    expect(r.lines).toHaveLength(2);
    expect(r.lines[0].parsed).toBe(false);
    expect(r.lines[0].flag).toBe('5 cells, expected 7 on one line or 5 then an API line of 3');
    expect(r.lines[0].raw).toBe('11:35 Newmarket | Dove Tale | 2.88 B3, SI | 2.75 | 3.10');
    expect(r.lines[1].parsed).toBe(true);
  });

  it('flags a pair whose cell counts are off, and shows both lines', () => {
    const r = parsePlainSlip('11:35 Newmarket\tDove Tale\t2.88 B3, SI\t2.75\n09:52 API\t2.70 (13% under)\t£240');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].parsed).toBe(false);
    expect(r.lines[0].flag).toBe('4 cells then 3 on the API line, expected 5 then 3');
    expect(r.lines[0].raw).toContain('09:52 API | 2.70 (13% under) | £240');
  });

  it('drops a trailing empty cell left by a trailing tab', () => {
    const r = parsePlainSlip('11:35 Newmarket\tDove Tale\t2.88 B3, SI\t2.75\t3.10\t\n09:52 API\t2.70 (13% under)\t£240\t');
    expect(r.lines[0].cells).toEqual(REAL_DOVE);
  });
});

describe('B: plain text without tabs', () => {
  it('still reads the email\'s own form with asterisks', () => {
    const r = parsePlainSlip(PLAIN);
    expect(r.mapped).toBe('asterisks');
    expect(r.lines).toHaveLength(3);
    expect(r.lines[0].cells).toEqual(DOVE);
  });

  it('accepts any HH:MM before API', () => {
    const r = parsePlainSlip('11:35 Newmarket *Dove Tale* 2.88 B3, SI 2.75 3.10\n09:52 API *2.70* (13% under) £240');
    expect(r.lines[0].cells).toEqual(REAL_DOVE);
  });

  it('does not guess at the two real lines without tabs or asterisks: flagged, shown, counted', () => {
    const r = parsePlainSlip('11:35 Newmarket Dove Tale 2.88 B3, SI 2.75 3.10\n09:52 API 2.70 (13% under) £240');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].parsed).toBe(false);
    expect(r.lines[0].flag).toBe('first line did not read');
    expect(r.lines[0].raw).toBe('11:35 Newmarket Dove Tale 2.88 B3, SI 2.75 3.10\n09:52 API 2.70 (13% under) £240');
  });
});

// ---------------------------------------------------------------------------
// The real paste of 30 October 2026, 15:13 UK, read from the "What was pasted"
// diagnostics: Gmail in Safari 27.2 on a Mac, the 10:00 slip. The clipboard
// carried text/html (148,852 chars) and text/plain (2,776 chars). The HTML
// table had no header row, which is why 0.2.0 fell back to the text and read
// nothing; the text was tab separated, five cells then an API line of three.

import { REAL_PLAIN_1000, REAL_PLAIN_1000_SELECTIONS } from './fixtures/real-2026-10-30-slip-1000.js';

// The real markup of the first row's td cells, verbatim from the diagnostics
// (the diagnostics stop at 4000 characters, inside the sixth cell; the sixth
// and seventh cells here carry the same style and the email's own markup for
// a lay target and a cap). Safari writes its "Apple-converted-space" as a
// no-break space.
const SAFARI_TD =
  '<td style="margin: 0px; padding: 6px 8px; border-bottom: 1px solid rgb(227, 227, 227); font-style: normal; font-variant-caps: normal; font-weight: normal; font-width: normal; font-size: 13px; line-height: normal; font-family: Arial, sans-serif; font-size-adjust: none; font-kerning: auto; font-variant-alternates: normal; font-variant-ligatures: normal; font-variant-numeric: normal; font-variant-east-asian: normal; font-variant-position: normal; font-feature-settings: normal; font-optical-sizing: auto; font-variation-settings: normal; vertical-align: top;">';
const NBSP = '<span class="Apple-converted-space"> </span>';
const SAFARI_ROW =
  `${SAFARI_TD}11:35 Newmarket</td>` +
  `${SAFARI_TD}<b>Dove Tale</b></td>` +
  `${SAFARI_TD}2.88${NBSP}<span style="color: rgb(119, 119, 119);">B3, SI</span></td>` +
  `${SAFARI_TD}2.75</td>` +
  `${SAFARI_TD}3.10${NBSP}<br><span style="color: rgb(119, 119, 119); font-size: 11px;">09:52 API</span></td>` +
  `${SAFARI_TD}<b>2.70</b>${NBSP}<span style="color: rgb(119, 119, 119);">(13% under)</span></td>` +
  `${SAFARI_TD}£240</td>`;
const SAFARI_HTML =
  '<head><meta charset="UTF-8"></head><table style="font-style: normal; font-variant-caps: normal; font-weight: 400; letter-spacing: normal; orphans: 2; text-align: start; text-transform: none; white-space: normal; widows: 2; word-spacing: 0px; -webkit-text-stroke-width: 0px; text-decoration: none; caret-color: rgb(34, 34, 34); color: rgb(34, 34, 34); font-family: Arial, sans-serif; font-size: 14px; background-color: rgb(255, 255, 255); border-collapse: collapse; width: 1027.984375px;"><tbody>' +
  `<tr>${SAFARI_ROW}</tr>` +
  '</tbody></table>';

describe('the real paste from Gmail in Safari, 30 October 2026', () => {
  it('is the text the diagnostics reported, to the character', () => {
    expect(REAL_PLAIN_1000.length).toBe(2776);
    expect(REAL_PLAIN_1000_SELECTIONS).toBe(34);
  });

  it('reads all 34 selections from the tab separated text, none flagged, nothing in the note', () => {
    const r = parsePlainSlip(REAL_PLAIN_1000);
    expect(r.mapped).toBe('tabs');
    expect(r.lines).toHaveLength(34);
    expect(r.lines.filter((l) => !l.parsed)).toEqual([]);
    expect(r.note).toBe('');
    expect(r.lines.every((l) => l.derived.betfairTime === '09:52 API')).toBe(true);
    expect(r.lines.every((l) => /^\d{2}:\d{2} [A-Z]/.test(l.cells.race))).toBe(true);
  });

  it('keeps the real cells as they arrived, codes included', () => {
    const r = parsePlainSlip(REAL_PLAIN_1000);
    const by = (horse) => r.lines.find((l) => l.cells.horse === horse);
    expect(by('Dove Tale').cells).toEqual(REAL_DOVE);
    expect(by('Ash Hobbs').cells).toEqual({
      race: '14:00 Down Royal',
      horse: 'Ash Hobbs',
      bestPrice: '3.75 10bet, Betano',
      bestBog: '3.75',
      betfair: '4.60\n09:52 API',
      layTarget: '4.00 (13% under)',
      betfairCap: '£25',
    });
    expect(by('Ash Hobbs').derived.codes).toEqual(['10bet', 'Betano']);
    expect(by('No Hard Feelings').cells).toEqual({
      race: '15:20 Uttoxeter',
      horse: 'No Hard Feelings',
      bestPrice: 'no price read',
      bestBog: '–',
      betfair: '–\n09:52 API',
      layTarget: '–',
      betfairCap: '£140',
    });
    expect(by('October Hill').cells.bestPrice).toBe('no price read');
    expect(by('October Hill').derived.codes).toEqual([]);
    expect(by('Wearing Stars').cells.betfair).toBe('2.16 ⚠ check\n09:52 API');
    expect(by('Wearing Stars').derived.betfairCheck).toBe(true);
    expect(by('Wearing Stars').derived.codes).toEqual(['10bet', 'B3']);
    expect(by('Pequenita').derived.codes).toEqual(['WH']);
    expect(by('Serenity Blue').cells.betfairCap).toBe('£25');
    expect(r.lines[33].cells.horse).toBe('Serenity Blue');
  });

  it('reads the real Safari table markup by position, with the no-break spaces and the line break', () => {
    const r = parseHtmlSlip(SAFARI_HTML);
    expect(r.mapped).toBe('position');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].parsed).toBe(true);
    expect(r.lines[0].cells).toEqual(REAL_DOVE);
    expect(r.lines[0].derived.codes).toEqual(['B3', 'SI']);
    expect(r.note).toBe('');
  });

  it('takes the HTML first when the clipboard has both, as it did', () => {
    const r = parseSlip({ html: SAFARI_HTML, text: REAL_PLAIN_1000 });
    expect(r.source).toBe('html');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].cells).toEqual(REAL_DOVE);
  });
});

// ---------------------------------------------------------------------------
// The second real paste, 30 October 2026, 15:48 UK, same browser, a different
// day's 10:00 slip: text/html 96,756 chars, text/plain 1,889 chars. New in it:
// bookmaker codes with a space inside, PP, and the two word course Ffos Las.

import { REAL_PLAIN_1548, REAL_PLAIN_1548_SELECTIONS } from './fixtures/real-2026-10-30-1548-slip-1000.js';

describe('the second real paste from Gmail in Safari, 30 October 2026', () => {
  it('is the text the diagnostics reported, to the character', () => {
    expect(REAL_PLAIN_1548.length).toBe(1889);
    expect(REAL_PLAIN_1548_SELECTIONS).toBe(22);
  });

  it('reads all 22 selections, none flagged, nothing in the note', () => {
    const r = parsePlainSlip(REAL_PLAIN_1548);
    expect(r.mapped).toBe('tabs');
    expect(r.lines).toHaveLength(22);
    expect(r.lines.filter((l) => !l.parsed)).toEqual([]);
    expect(r.note).toBe('');
    expect(r.lines.every((l) => l.derived.betfairTime === '09:52 API')).toBe(true);
    expect(r.lines[0].cells.horse).toBe('Lady Phillips');
    expect(r.lines[21].cells.horse).toBe('Sevenkingsmustdie');
  });

  it('keeps codes with a space inside as written, and splits them only on the comma', () => {
    const r = parsePlainSlip(REAL_PLAIN_1548);
    const by = (horse) => r.lines.find((l) => l.cells.horse === horse);
    expect(by('Wunderschon').cells.bestPrice).toBe('2.38 LiveScore Bet, Virgin Bet');
    expect(by('Wunderschon').derived.codes).toEqual(['LiveScore Bet', 'Virgin Bet']);
    expect(by('Space Bob').derived.codes).toEqual(['B3', 'LiveScore Bet']);
    expect(by('Ugo Bingo').derived.codes).toEqual(['FB', 'PP']);
    expect(by('Fairye Forth').derived.codes).toEqual(['10bet']);
    expect(by('Pedros Dream').derived.codes).toEqual(['FR']);
  });

  it('reads a two word course and the rest of the row as it arrived', () => {
    const r = parsePlainSlip(REAL_PLAIN_1548);
    const by = (horse) => r.lines.find((l) => l.cells.horse === horse);
    expect(by('Passage Guenot').cells).toEqual({
      race: '14:00 Ffos Las',
      horse: 'Passage Guenot',
      bestPrice: '3.50 B3',
      bestBog: '3.25',
      betfair: '3.55\n09:52 API',
      layTarget: '3.10 (13% under)',
      betfairCap: '£150',
    });
    expect(by('Dance In The Mist').cells.race).toBe('16:20 Stratford');
    expect(by('Sevenkingsmustdie').cells).toEqual({
      race: '19:30 Southwell',
      horse: 'Sevenkingsmustdie',
      bestPrice: '4.00 WH',
      bestBog: '4.00',
      betfair: '3.70\n09:52 API',
      layTarget: '3.20 (13% under)',
      betfairCap: '£125',
    });
  });

  it('reads the real Safari markup of its first row by position', () => {
    // The first five cells verbatim from the diagnostics; the last two carry the
    // same style and the email's own markup, as in the earlier Safari test.
    const row =
      `${SAFARI_TD}12:42 Bath</td>` +
      `${SAFARI_TD}<b>Lady Phillips</b></td>` +
      `${SAFARI_TD}1.67${NBSP}<span style="color: rgb(119, 119, 119);">SI, SX</span></td>` +
      `${SAFARI_TD}1.57</td>` +
      `${SAFARI_TD}1.75${NBSP}<br><span style="color: rgb(119, 119, 119); font-size: 11px;">09:52 API</span></td>` +
      `${SAFARI_TD}<b>1.66</b>${NBSP}<span style="color: rgb(119, 119, 119);">(5% under)</span></td>` +
      `${SAFARI_TD}£115</td>`;
    const r = parseHtmlSlip(`<head><meta charset="UTF-8"></head><table style="border-collapse: collapse; width: 1028px;"><tbody><tr>${row}</tr></tbody></table>`);
    expect(r.mapped).toBe('position');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].cells).toEqual({
      race: '12:42 Bath',
      horse: 'Lady Phillips',
      bestPrice: '1.67 SI, SX',
      bestBog: '1.57',
      betfair: '1.75\n09:52 API',
      layTarget: '1.66 (5% under)',
      betfairCap: '£115',
    });
    expect(r.lines[0].derived.codes).toEqual(['SI', 'SX']);
  });
});

// ---------------------------------------------------------------------------
// The third real paste, 1 November 2026, 22:42 UK, same browser, the 08:00
// slip: text/html 123,127 chars, text/plain 2,305 chars. The first real browser
// copy of the 08:00 slip (API time 07:52), and the check marker inside the
// Betfair cell of a tab separated row.

import { REAL_PLAIN_2242, REAL_PLAIN_2242_SELECTIONS } from './fixtures/real-2026-11-01-2242-slip-0800.js';

describe('the third real paste from Gmail in Safari, 1 November 2026, the 08:00 slip', () => {
  it('is the text the diagnostics reported, to the character', () => {
    expect(REAL_PLAIN_2242.length).toBe(2305);
    expect(REAL_PLAIN_2242_SELECTIONS).toBe(28);
  });

  it('reads all 28 selections, none flagged, nothing in the note, 07:52 on every line', () => {
    const r = parsePlainSlip(REAL_PLAIN_2242);
    expect(r.mapped).toBe('tabs');
    expect(r.lines).toHaveLength(28);
    expect(r.lines.filter((l) => !l.parsed)).toEqual([]);
    expect(r.note).toBe('');
    expect(r.lines.every((l) => l.derived.betfairTime === '07:52 API')).toBe(true);
    expect(r.lines[0].cells.horse).toBe('Choctaw Nation');
    expect(r.lines[27].cells.horse).toBe('Thread Of Gold');
  });

  it('keeps the check marker inside the Betfair cell and marks that row for a look, not as unread', () => {
    const r = parsePlainSlip(REAL_PLAIN_2242);
    const west = r.lines.find((l) => l.cells.horse === 'West Away');
    expect(west.parsed).toBe(true);
    expect(west.cells).toEqual({
      race: '13:40 Cork',
      horse: 'West Away',
      bestPrice: '3.75 FR',
      bestBog: '3.50',
      betfair: '2.90 ⚠ check\n07:52 API',
      layTarget: '2.52 (13% under)',
      betfairCap: '£55',
    });
    expect(west.derived.betfairCheck).toBe(true);
    expect(west.derived.betfairTime).toBe('07:52 API');
    expect(west.derived.codes).toEqual(['FR']);
    expect(r.lines.filter((l) => l.derived.betfairCheck).map((l) => l.cells.horse)).toEqual(['West Away']);
  });

  it('reads the rest as it arrived: the first and last rows, codes, a one word horse', () => {
    const r = parsePlainSlip(REAL_PLAIN_2242);
    const by = (horse) => r.lines.find((l) => l.cells.horse === horse);
    expect(by('Choctaw Nation').cells).toEqual({
      race: '12:17 Curragh',
      horse: 'Choctaw Nation',
      bestPrice: '1.67 BY, CE',
      bestBog: '1.67',
      betfair: '1.85\n07:52 API',
      layTarget: '1.75 (5% under)',
      betfairCap: '£125',
    });
    expect(by('Choctaw Nation').derived.codes).toEqual(['BY', 'CE']);
    expect(by('Lennon Grove').derived.codes).toEqual(['B3', 'BetMGM']);
    expect(by('Paggane').derived.codes).toEqual(['Betano', 'BTT']);
    expect(by('Code Name Cubitt').derived.codes).toEqual(['WH']);
    expect(by('Meetmebythelake').cells.race).toBe('16:10 Carlisle');
    expect(by('Thread Of Gold').cells).toEqual({
      race: '16:20 Curragh',
      horse: 'Thread Of Gold',
      bestPrice: '2.88 CE, LD',
      bestBog: '2.88',
      betfair: '2.76\n07:52 API',
      layTarget: '2.40 (13% under)',
      betfairCap: '£125',
    });
  });

  it('reads the real Safari markup of its first row by position', () => {
    // The first five cells verbatim from the diagnostics; the last two carry the
    // same style and the email's own markup, as in the earlier Safari tests.
    const row =
      `${SAFARI_TD}12:17 Curragh</td>` +
      `${SAFARI_TD}<b>Choctaw Nation</b></td>` +
      `${SAFARI_TD}1.67${NBSP}<span style="color: rgb(119, 119, 119);">BY, CE</span></td>` +
      `${SAFARI_TD}1.67</td>` +
      `${SAFARI_TD}1.85${NBSP}<br><span style="color: rgb(119, 119, 119); font-size: 11px;">07:52 API</span></td>` +
      `${SAFARI_TD}<b>1.75</b>${NBSP}<span style="color: rgb(119, 119, 119);">(5% under)</span></td>` +
      `${SAFARI_TD}£125</td>`;
    const r = parseHtmlSlip(`<head><meta charset="UTF-8"></head><table style="border-collapse: collapse; width: 1027.984375px;"><tbody><tr>${row}</tr></tbody></table>`);
    expect(r.mapped).toBe('position');
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].parsed).toBe(true);
    expect(r.lines[0].cells).toEqual({
      race: '12:17 Curragh',
      horse: 'Choctaw Nation',
      bestPrice: '1.67 BY, CE',
      bestBog: '1.67',
      betfair: '1.85\n07:52 API',
      layTarget: '1.75 (5% under)',
      betfairCap: '£125',
    });
    expect(r.lines[0].derived.betfairTime).toBe('07:52 API');
    expect(r.lines[0].derived.codes).toEqual(['BY', 'CE']);
  });
});
