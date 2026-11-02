// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { api, explain } from './api.js';

function fakeFetch(status, body, calls = []) {
  const fn = async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status, headers: { 'content-type': 'application/json' } });
  };
  fn.calls = calls;
  return fn;
}

describe('the page calling its server', () => {
  it('sends a GET to /api with the Access cookie and reads JSON back', async () => {
    const fetch = fakeFetch(200, '{"mode":"paper"}');
    const r = await api('/admin/status', {}, fetch);
    expect(r).toEqual({ ok: true, status: 200, detail: '', data: { mode: 'paper' } });
    expect(fetch.calls[0].url).toBe('/api/admin/status');
    expect(fetch.calls[0].init.method).toBe('GET');
    expect(fetch.calls[0].init.credentials).toBe('same-origin');
    expect(fetch.calls[0].init.body).toBeUndefined();
  });

  it('sends a POST body as JSON', async () => {
    const fetch = fakeFetch(200, '{"action":"betfair-login"}');
    const r = await api('/admin/control/betfair-login', { method: 'POST', body: { reason: 'operator' } }, fetch);
    expect(r.ok).toBe(true);
    expect(fetch.calls[0].init.headers['content-type']).toBe('application/json');
    expect(fetch.calls[0].init.body).toBe('{"reason":"operator"}');
  });

  it('turns a refusal into words and never throws', async () => {
    const r = await api('/admin/status', {}, fakeFetch(403, '{"detail":"x@y.z is not an operator of FB13"}'));
    expect(r.ok).toBe(false);
    expect(r.status).toBe(403);
    expect(r.detail).toBe('x@y.z is not an operator of FB13');
    expect(explain(r)).toBe('Refused: x@y.z is not an operator of FB13. Only an operator on the stored list may use the server.');
    const html = await api('/x', {}, fakeFetch(500, '<html>oops</html>'));
    expect(html.data).toBeNull();
    expect(html.detail).toBe('500: <html>oops</html>');
  });

  it('says so when the route does not answer at all', async () => {
    const failing = async () => {
      throw new TypeError('Failed to fetch');
    };
    const r = await api('/admin/status', {}, failing);
    expect(r.status).toBe(0);
    expect(explain(r)).toContain('reload the page and sign in again');
  });

  it('explains each status in a sentence', () => {
    expect(explain({ ok: true })).toBe('');
    expect(explain({ ok: false, status: 401, detail: 'no Access token' })).toBe('Refused: no Access token');
    expect(explain({ ok: false, status: 409, detail: 'not logged in' })).toBe('not logged in');
    expect(explain({ ok: false, status: 502, detail: 'Betfair login failed: X' })).toBe('The server could not do it: Betfair login failed: X');
    expect(explain({ ok: false, status: 503, detail: 'sign-in is not configured' })).toBe('The server is not ready: sign-in is not configured');
    expect(explain({ ok: false, status: 418, detail: 'teapot' })).toBe('418: teapot');
  });
});
