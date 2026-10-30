// What a paste handed the page, so that a parser failure can be read rather
// than guessed at. Nothing here leaves the page: the person copies it out.

export const HTML_SAMPLE_LIMIT = 4000;

/** Tabs as →, carriage returns as ␍, line feeds as ¶ followed by a real break. */
export function markWhitespace(s) {
  return String(s ?? '')
    .replace(/\t/g, '→')
    .replace(/\r/g, '␍')
    .replace(/\n/g, '¶\n');
}

/**
 * types: the DataTransfer's types list. data: each type to the string getData
 * returned. html and text: what the parser was given. source: 'paste event' or
 * 'read box'.
 */
export function buildDiagnostics({
  at = new Date().toISOString(),
  source = 'paste event',
  types = [],
  data = {},
  html = '',
  text = '',
  userAgent = '',
}) {
  const htmlStr = String(html ?? '');
  const textStr = String(text ?? '');
  return {
    at,
    source,
    userAgent: String(userAgent ?? ''),
    items: Array.from(types).map((t) => ({ type: String(t), length: String(data[t] ?? '').length })),
    textLength: textStr.length,
    textMarked: markWhitespace(textStr),
    htmlLength: htmlStr.length,
    htmlSample: htmlStr.slice(0, HTML_SAMPLE_LIMIT),
    htmlTruncated: htmlStr.length > HTML_SAMPLE_LIMIT,
  };
}

/** The diagnostics as one block of plain text, for the Copy button. */
export function diagnosticsText(d) {
  if (!d) return 'No paste yet.';
  const lines = [
    'FB13 paste diagnostics',
    `at: ${d.at}`,
    `source: ${d.source}`,
    `user agent: ${d.userAgent || 'not known'}`,
    `clipboard types (${d.items.length}):`,
    ...(d.items.length ? d.items.map((i) => `  ${i.type}: ${i.length} chars`) : ['  none handed to the page']),
    `text/plain, ${d.textLength} chars, tabs as →, carriage returns as ␍, line feeds as ¶:`,
    d.textMarked || '  (empty)',
    `text/html, ${d.htmlLength} chars${d.htmlTruncated ? `, first ${HTML_SAMPLE_LIMIT} shown` : ''}:`,
    d.htmlSample || '  (empty)',
  ];
  return lines.join('\n');
}
