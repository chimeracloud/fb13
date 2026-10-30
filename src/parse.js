// Parsing Mark's Early Doors slip. Two paths: the clipboard's HTML table,
// mapped by header text, and the email's plain text form, two lines per
// selection. Every cell is kept as the text that arrived. Nothing is decoded,
// nothing is dropped, nothing is guessed: a row that does not read is returned
// as it is, flagged.

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

function normaliseHeader(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Collapse runs of spaces within each line, trim each line, drop blank lines. */
function tidyLines(s) {
  return String(s || '')
    .replace(/ /g, ' ')
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0)
    .join('\n');
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

function makeLine({ cells, raw, source, flag = null }) {
  const complete = cells && COLUMNS.every((c) => typeof cells[c.key] === 'string');
  return {
    id: newId(),
    source,
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

function findSlipTable(doc) {
  const tables = Array.from(doc.querySelectorAll('table'));
  for (const table of tables) {
    const rows = ownRows(table);
    for (let i = 0; i < rows.length; i += 1) {
      const headers = directCells(rows[i]).map((c) => normaliseHeader(cellText(c)));
      if (headers.includes('race') && headers.includes('horse')) {
        return { table, headerRowIndex: i, headers, rows };
      }
    }
  }
  return null;
}

/**
 * Parse the clipboard's text/html. Returns null when there is no slip table,
 * so the caller can fall back to plain text.
 */
export function parseHtmlSlip(html) {
  if (!html || !/<table/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const found = findSlipTable(doc);
  if (!found) return null;

  const { table, headerRowIndex, headers, rows } = found;
  const index = {};
  const missing = [];
  for (const col of COLUMNS) {
    const at = headers.indexOf(col.header);
    if (at === -1) missing.push(COLUMN_LABELS[col.key]);
    else index[col.key] = at;
  }

  const lines = [];
  for (let r = headerRowIndex + 1; r < rows.length; r += 1) {
    const tds = directCells(rows[r]);
    if (tds.length === 0) continue;
    const texts = tds.map(cellText);
    const raw = texts.join(' | ');
    if (texts.every((t) => t.length === 0)) continue;
    if (missing.length > 0) {
      lines.push(makeLine({ raw, source: 'html', flag: `table is missing: ${missing.join(', ')}` }));
      continue;
    }
    if (tds.length !== headers.length) {
      lines.push(
        makeLine({
          raw,
          source: 'html',
          flag: `${tds.length} cells, header has ${headers.length}`,
        }),
      );
      continue;
    }
    const cells = {};
    for (const col of COLUMNS) cells[col.key] = texts[index[col.key]];
    lines.push(makeLine({ cells, raw, source: 'html' }));
  }

  // Everything that is not the table is kept as a note, unparsed.
  const body = doc.body;
  table.remove();
  const note = cellText(body);

  return { lines, note, source: 'html' };
}

// ---------------------------------------------------------- plain text path

// A row starts with a time and a course. "07:52 API" also starts with a time,
// so the course must not be the word API.
const ROW_START = new RegExp(`^${TIME}\\s+(?!API\\b)\\S`);
const CONTINUATION = new RegExp(`^${TIME}\\s+API\\b`);

function stripStars(s) {
  return s.replace(/^\*+|\*+$/g, '').trim();
}

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
  const middle = m[2].trim();
  // "*2.74* (13% under)" → "2.74 (13% under)"; "–" stays "–".
  const layTarget = middle.replace(/\*([^*]+)\*/g, '$1').replace(/\s+/g, ' ').trim();
  return { betfairTime: m[1], layTarget, betfairCap: m[3] };
}

/** Parse the email's plain text form. Always returns a result. */
export function parsePlainSlip(text) {
  const all = tidyLines(text).split('\n');
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
      const why = !first ? 'first line did not read' : rowLines.length < 2 ? 'second line missing' : 'second line did not read';
      lines.push(makeLine({ raw, source: 'text', flag: why }));
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
    lines.push(makeLine({ cells, raw, source: 'text' }));
  }
  return { lines, note: noteParts.join('\n'), source: 'text' };
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
