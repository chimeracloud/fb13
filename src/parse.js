// Parsing Mark's Early Doors slip. Two paths: the clipboard's HTML table, and
// the plain text. Every cell is kept as the text that arrived. Nothing is
// decoded, nothing is dropped, nothing is guessed: a row that does not read
// is returned as it is, flagged.
//
// HTML: a header row naming the columns is used when present; otherwise rows
// of exactly seven cells are mapped by position (Race, Horse, Best price,
// Best BOG, Betfair, Lay target, Betfair cap). A line break inside a cell is
// kept as a line break.
//
// Plain text, with tabs (a browser copy of the table): cells split on tabs.
// The first line of a selection ends with the Betfair price; the second
// begins with the API time and holds the lay target and the cap. Asterisks
// round the horse or the lay target are optional.
//
// Plain text, without tabs: only the email's own plain text form is read,
// where the horse sits between asterisks. Anything else is flagged, not
// guessed.

export const COLUMNS = [
  { key: 'race', header: 'race' },
  { key: 'horse', header: 'horse' },
  { key: 'bestPrice', header: 'best price' },
  { key: 'bestBog', header: 'best bog' },
  { key: 'betfair', header: 'betfair' },
  { key: 'layTarget', header: 'lay target' },
  { key: 'betfairCap', header: 'betfair cap' },
];

export const COLUMN_LABELS = {
  race: 'Race',
  horse: 'Horse',
  bestPrice: 'Best price',
  bestBog: 'Best BOG',
  betfair: 'Betfair',
  layTarget: 'Lay target',
  betfairCap: 'Betfair cap',
};

const DASH = '[\\u2013\\u2014\\u2212-]'; // en dash, em dash, minus, hyphen
const NUM = '\\d+(?:\\.\\d+)?';
const TIME = '\\d{1,2}:\\d{2}';

// A row starts with a time and a course. "09:52 API" also starts with a time,
// so the course must not be the word API. Any HH:MM is accepted before API:
// the 10:00 slip reads at 09:52, the 09:00 slip at 08:52.
const ROW_START = new RegExp(`^${TIME}\\s+(?!API\\b)\\S`);
const CONTINUATION = new RegExp(`^${TIME}\\s+API\\b`);

function normaliseHeader(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Collapse runs of spaces and tabs within each line, trim each line, drop blank lines. */
function tidyLines(s) {
  return String(s || '')
    .replace(/ /g, ' ')
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
}

/** Lines of the text with tabs kept, spaces trimmed at the ends, blank lines dropped. */
function rawLines(s) {
  return String(s || '')
    .replace(/ /g, ' ')
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.replace(/^ +| +$/g, ''))
    .filter((l) => l.trim().length > 0);
}

/** Text of a DOM node with <br> and block boundaries kept as line breaks. */
function cellText(node) {
  const out = [];
  const walk = (n) => {
    if (n.nodeType === 3) {
      out.push(n.nodeValue);
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (tag === 'br') {
      out.push('\n');
      return;
    }
    if (tag === 'script' || tag === 'style') return;
    const block = /^(p|div|li|tr|ul|ol|h[1-6]|blockquote|pre|table)$/.test(tag);
    if (block) out.push('\n');
    for (const c of n.childNodes) walk(c);
    if (block) out.push('\n');
  };
  walk(node);
  return tidyLines(out.join(''));
}

let counter = 0;
export function newId(prefix = 'ln') {
  counter += 1;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${rand}`;
}

/** Split "2.88 BetMGM, SI" into the codes offered in the "where" field. Verbatim pieces. */
export function codesFromBestPrice(text) {
  const t = tidyLines(text);
  const m = t.match(new RegExp(`^${NUM}\\s+(.+)$`));
  if (!m) return [];
  return m[1]
    .split(',')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
}

/** A few derived pieces for display and for the form. The cell text stays the source. */
export function derive(cells) {
  const d = {};
  d.codes = codesFromBestPrice(cells.bestPrice);
  const bf = (cells.betfair || '').split('\n');
  d.betfairCheck = /⚠|check/i.test(cells.betfair || '');
  d.betfairTime = bf.find((l) => new RegExp(`^${TIME}\\s+API`).test(l)) || '';
  return d;
}

function makeLine({ cells, raw, source, flag = null, mapped = null }) {
  const complete = cells && COLUMNS.every((c) => typeof cells[c.key] === 'string');
  return {
    id: newId(),
    source,
    mapped,
    raw,
    parsed: !flag && !!complete,
    flag: flag || (complete ? null : 'row did not read'),
    cells: cells || {},
    derived: cells ? derive(cells) : { codes: [] },
  };
}

// ---------------------------------------------------------------- HTML path

/** The td and th cells that belong to this row itself, not to a table nested in it. */
function directCells(tr) {
  return Array.from(tr.children).filter((c) => /^(td|th)$/i.test(c.tagName));
}

/** The rows that belong to this table itself. Mail clients wrap bodies in layout tables. */
function ownRows(table) {
  return Array.from(table.querySelectorAll('tr')).filter((tr) => tr.closest('table') === table);
}

function isHeaderRow(headers) {
  return headers.includes('race') && headers.includes('horse');
}

/**
 * First choice: a table with a header row naming the columns. Otherwise the
 * table with the most rows of exactly seven cells, mapped by position.
 */
function findSlipTable(doc) {
  const tables = Array.from(doc.querySelectorAll('table'));
  for (const table of tables) {
    const rows = ownRows(table);
    for (let i = 0; i < rows.length; i += 1) {
      const headers = directCells(rows[i]).map((c) => normaliseHeader(cellText(c)));
      if (isHeaderRow(headers)) return { table, headerRowIndex: i, headers, rows, byHeader: true };
    }
  }
  let best = null;
  for (const table of tables) {
    const rows = ownRows(table);
    const sevens = rows.filter((r) => directCells(r).length === COLUMNS.length).length;
    if (sevens > 0 && (!best || sevens > best.sevens)) best = { table, rows, sevens };
  }
  if (!best) return null;
  return { table: best.table, headerRowIndex: -1, headers: null, rows: best.rows, byHeader: false };
}

/**
 * Parse the clipboard's text/html. Returns null when there is no table with a
 * header or with rows of seven cells, so the caller can fall back to text.
 */
export function parseHtmlSlip(html) {
  if (!html || !/<table/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const found = findSlipTable(doc);
  if (!found) return null;

  const { table, headerRowIndex, headers, rows, byHeader } = found;
  const mapped = byHeader ? 'header' : 'position';
  const index = {};
  const missing = [];
  if (byHeader) {
    for (const col of COLUMNS) {
      const at = headers.indexOf(col.header);
      if (at === -1) missing.push(COLUMN_LABELS[col.key]);
      else index[col.key] = at;
    }
  } else {
    COLUMNS.forEach((col, i) => {
      index[col.key] = i;
    });
  }
  const expected = byHeader ? headers.length : COLUMNS.length;
  const raceStartsWithTime = new RegExp(`^${TIME}\\b`);

  const lines = [];
  for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
    const tds = directCells(rows[r]);
    if (tds.length === 0) continue;
    const texts = tds.map(cellText);
    if (texts.every((t) => t.length === 0)) continue;
    const raw = texts.join(' | ');
    if (missing.length > 0) {
      lines.push(makeLine({ raw, source: 'html', mapped, flag: `table is missing: ${missing.join(', ')}` }));
      continue;
    }
    if (tds.length !== expected) {
      lines.push(
        makeLine({
          raw,
          source: 'html',
          mapped,
          flag: byHeader ? `${tds.length} cells, header has ${expected}` : `${tds.length} cells, expected ${expected}`,
        }),
      );
      continue;
    }
    const cells = {};
    for (const col of COLUMNS) cells[col.key] = texts[index[col.key]];
    if (!byHeader && !raceStartsWithTime.test(cells.race)) {
      // Without a header to go by, a row whose first cell is not a race time
      // is not read as a bet. Most likely a header row with other names.
      lines.push(makeLine({ raw, source: 'html', mapped, flag: 'first cell is not a race time' }));
      continue;
    }
    lines.push(makeLine({ cells, raw, source: 'html', mapped }));
  }

  // Everything that is not the table is kept as a note, unparsed.
  const body = doc.body;
  table.remove();
  const note = cellText(body);

  return { lines, note, source: 'html', mapped };
}

// ---------------------------------------------------------- plain text path

function stripStars(s) {
  return s.replace(/^\*+|\*+$/g, '').trim();
}

/** "*2.74* (13% under)" → "2.74 (13% under)"; "–" stays "–". */
function unstar(s) {
  return s.replace(/\*([^*]+)\*/g, '$1').replace(/\s+/g, ' ').trim();
}

// --- with tabs: a browser copy of the table

function splitTabs(line) {
  const cells = line.split('\t').map((c) => c.replace(/\s+/g, ' ').trim());
  while (cells.length > 0 && cells[cells.length - 1] === '') cells.pop();
  return cells;
}

function showTabs(line) {
  return line.split('\t').join(' | ');
}

/**
 * Seven cells on one line, or five on the first line (ending with the Betfair
 * price) and three on the API line (API time, lay target, cap), which are
 * joined with the Betfair cell carrying its line break.
 */
function rowFromTabCells(first, second) {
  if (!second && first.length === 7) {
    return {
      race: first[0],
      horse: stripStars(first[1]),
      bestPrice: first[2],
      bestBog: first[3],
      betfair: first[4],
      layTarget: unstar(first[5]),
      betfairCap: first[6],
    };
  }
  if (second && first.length === 5 && second.length === 3) {
    return {
      race: first[0],
      horse: stripStars(first[1]),
      bestPrice: first[2],
      bestBog: first[3],
      betfair: `${first[4]}\n${second[0]}`,
      layTarget: unstar(second[1]),
      betfairCap: second[2],
    };
  }
  return null;
}

function parseTabbed(all) {
  const lines = [];
  const noteParts = [];
  let i = 0;
  while (i < all.length) {
    const line = all[i];
    const first = splitTabs(line);
    if (!ROW_START.test(first[0] || '')) {
      noteParts.push(showTabs(line).trim());
      i += 1;
      continue;
    }
    i += 1;
    let secondLine = null;
    let second = null;
    if (i < all.length) {
      const c2 = splitTabs(all[i]);
      if (CONTINUATION.test(c2[0] || '')) {
        secondLine = all[i];
        second = c2;
        i += 1;
      }
    }
    const raw = [line, secondLine].filter(Boolean).map(showTabs).join('\n');
    const cells = rowFromTabCells(first, second);
    if (!cells) {
      const why = second
        ? `${first.length} cells then ${second.length} on the API line, expected 5 then 3`
        : `${first.length} cells, expected 7 on one line or 5 then an API line of 3`;
      lines.push(makeLine({ raw, source: 'text', mapped: 'tabs', flag: why }));
      continue;
    }
    lines.push(makeLine({ cells, raw, source: 'text', mapped: 'tabs' }));
  }
  return { lines, note: noteParts.join('\n'), source: 'text', mapped: 'tabs' };
}

// --- without tabs: the email's own plain text, the horse between asterisks

/**
 * The first line of a selection:
 *   11:35 Newmarket *Dove Tale* 2.88 BetMGM, SI 2.88 3.15
 *   15:20 Uttoxeter *No Hard Feelings* no price read – –
 *   19:00 Dundalk *Wearing Stars* 2.50 B3, BetMGM 2.50 2.02 ⚠ check
 */
function parseFirstLine(line) {
  const head = line.match(new RegExp(`^(${TIME}\\s+[^*]+?)\\s+\\*([^*]+)\\*\\s+(.*)$`));
  if (!head) return null;
  const race = head[1].trim();
  const horse = head[2].trim();
  const rest = head[3].trim();

  let m = rest.match(new RegExp(`^(no price read)\\s+(${DASH})\\s+(${DASH})(?:\\s+(\\u26a0.*))?$`));
  if (m) {
    return {
      race,
      horse,
      bestPrice: m[1],
      bestBog: m[2],
      betfairTop: m[4] ? `${m[3]} ${m[4]}` : m[3],
    };
  }
  m = rest.match(
    new RegExp(`^(${NUM})(?:\\s+(.*?))?\\s+(${NUM}|${DASH})\\s+(${NUM}|${DASH})(?:\\s+(\\u26a0.*))?$`),
  );
  if (m) {
    const bestPrice = m[2] ? `${m[1]} ${m[2]}` : m[1];
    return {
      race,
      horse,
      bestPrice,
      bestBog: m[3],
      betfairTop: m[5] ? `${m[4]} ${m[5]}` : m[4],
    };
  }
  return null;
}

/**
 * The second line of a selection:
 *   07:52 API *2.74* (13% under) £240
 *   07:52 API – £140
 */
function parseSecondLine(line) {
  const m = line.match(new RegExp(`^(${TIME}\\s+API)\\s+(.*?)\\s+(£\\s?[\\d,]+(?:\\.\\d+)?)$`));
  if (!m) return null;
  return { betfairTime: m[1], layTarget: unstar(m[2].trim()), betfairCap: m[3] };
}

function parseUntabbed(all) {
  const lines = [];
  const noteParts = [];
  let i = 0;
  while (i < all.length) {
    const line = all[i];
    if (!ROW_START.test(line)) {
      noteParts.push(line);
      i += 1;
      continue;
    }
    // Gather the row: the start line plus following lines up to the next row start.
    const group = [line];
    i += 1;
    while (i < all.length && !ROW_START.test(all[i])) {
      group.push(all[i]);
      i += 1;
    }
    // The lay rules text follows the last row, so a trailing group may hold
    // the continuation and then prose. Keep only the continuation with the row.
    const contAt = group.findIndex((l, k) => k > 0 && CONTINUATION.test(l));
    const rowLines = contAt === -1 ? [group[0]] : group.slice(0, contAt + 1);
    const extra = contAt === -1 ? group.slice(1) : group.slice(contAt + 1);
    noteParts.push(...extra);

    const raw = rowLines.join('\n');
    const first = parseFirstLine(rowLines[0]);
    const second = rowLines.length > 1 ? parseSecondLine(rowLines.slice(1).join(' ')) : null;
    if (!first || !second) {
      let why;
      if (!first) why = 'first line did not read';
      else if (rowLines.length < 2) why = 'second line missing';
      else why = 'second line did not read';
      lines.push(makeLine({ raw, source: 'text', mapped: 'asterisks', flag: why }));
      continue;
    }
    const cells = {
      race: first.race,
      horse: stripStars(first.horse),
      bestPrice: first.bestPrice,
      bestBog: first.bestBog,
      betfair: `${first.betfairTop}\n${second.betfairTime}`,
      layTarget: second.layTarget,
      betfairCap: second.betfairCap,
    };
    lines.push(makeLine({ cells, raw, source: 'text', mapped: 'asterisks' }));
  }
  return { lines, note: noteParts.join('\n'), source: 'text', mapped: 'asterisks' };
}

/** Parse the plain text. Always returns a result. */
export function parsePlainSlip(text) {
  const all = rawLines(text);
  const hasTabs = all.some((l) => l.includes('\t'));
  if (hasTabs) return parseTabbed(all);
  return parseUntabbed(all.map((l) => l.replace(/[ \t]+/g, ' ').trim()));
}

/** What a paste event gives us: html first, plain text as the fallback. */
export function parseSlip({ html, text }) {
  const fromHtml = parseHtmlSlip(html);
  if (fromHtml && fromHtml.lines.length > 0) return fromHtml;
  const plain = text && text.trim() ? text : fromHtml ? '' : htmlToText(html);
  if (!plain.trim()) return { lines: [], note: '', source: 'empty' };
  return parsePlainSlip(plain);
}

/** For a box the browser filled with HTML but no table we can read. */
export function htmlToText(html) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return cellText(doc.body);
}

/** A line typed in by hand through Add line. */
export function manualLine(cells) {
  const clean = {};
  for (const col of COLUMNS) clean[col.key] = tidyLines(cells[col.key] || '');
  const raw = COLUMNS.map((c) => clean[c.key]).join(' | ');
  return makeLine({ cells: clean, raw, source: 'manual' });
}
