import { describe, it, expect } from 'vitest';
import { markWhitespace, buildDiagnostics, diagnosticsText, HTML_SAMPLE_LIMIT } from './diagnostics.js';

describe('marking whitespace', () => {
  it('shows tabs as arrows and line feeds as pilcrows that still break the line', () => {
    expect(markWhitespace('a\tb\nc')).toBe('a→b¶\nc');
  });

  it('shows a carriage return so CRLF can be told from LF', () => {
    expect(markWhitespace('a\r\nb')).toBe('a␍¶\nb');
  });

  it('copes with nothing', () => {
    expect(markWhitespace('')).toBe('');
    expect(markWhitespace(null)).toBe('');
  });
});

describe('what a paste handed the page', () => {
  const html = '<meta charset="utf-8"><table><tr><td>11:35 Newmarket</td></tr></table>';
  const text = '11:35 Newmarket\tDove Tale\t2.88 B3, SI\t2.75\t3.10\n09:52 API\t2.70 (13% under)\t£240\n';

  it('lists every clipboard type with its length and keeps the text and html', () => {
    const d = buildDiagnostics({
      at: '2026-10-30T15:00:00.000Z',
      types: ['text/plain', 'text/html'],
      data: { 'text/plain': text, 'text/html': html },
      html,
      text,
      userAgent: 'TestAgent/1.0',
    });
    expect(d.items).toEqual([
      { type: 'text/plain', length: text.length },
      { type: 'text/html', length: html.length },
    ]);
    expect(d.textLength).toBe(text.length);
    expect(d.textMarked).toBe(
      '11:35 Newmarket→Dove Tale→2.88 B3, SI→2.75→3.10¶\n09:52 API→2.70 (13% under)→£240¶\n',
    );
    expect(d.htmlLength).toBe(html.length);
    expect(d.htmlSample).toBe(html);
    expect(d.htmlTruncated).toBe(false);
    expect(d.source).toBe('paste event');
  });

  it('keeps only the first 4000 characters of html and says so', () => {
    const long = '<p>' + 'x'.repeat(HTML_SAMPLE_LIMIT + 500) + '</p>';
    const d = buildDiagnostics({ types: ['text/html'], data: { 'text/html': long }, html: long, text: '' });
    expect(d.htmlSample).toHaveLength(HTML_SAMPLE_LIMIT);
    expect(d.htmlTruncated).toBe(true);
    expect(d.htmlLength).toBe(long.length);
  });

  it('records a paste that handed the page no types at all', () => {
    const d = buildDiagnostics({ source: 'read box', types: [], data: {}, html: '<div>a</div>', text: 'a' });
    expect(d.items).toEqual([]);
    expect(d.source).toBe('read box');
    expect(d.htmlSample).toBe('<div>a</div>');
  });

  it('writes it all out as plain text, with the html as text and not markup', () => {
    const d = buildDiagnostics({
      at: '2026-10-30T15:00:00.000Z',
      types: ['text/plain', 'text/html'],
      data: { 'text/plain': text, 'text/html': html },
      html,
      text,
      userAgent: 'TestAgent/1.0',
    });
    const out = diagnosticsText(d);
    expect(out).toContain('source: paste event');
    expect(out).toContain('user agent: TestAgent/1.0');
    expect(out).toContain('clipboard types (2):');
    expect(out).toContain(`  text/plain: ${text.length} chars`);
    expect(out).toContain(`  text/html: ${html.length} chars`);
    expect(out).toContain('11:35 Newmarket→Dove Tale→2.88 B3, SI→2.75→3.10¶');
    expect(out).toContain('<table><tr><td>11:35 Newmarket</td></tr></table>');
    expect(diagnosticsText(null)).toBe('No paste yet.');
    const none = diagnosticsText(buildDiagnostics({ types: [], data: {}, html: '', text: '' }));
    expect(none).toContain('none handed to the page');
    expect(none).toContain('(empty)');
  });
});
