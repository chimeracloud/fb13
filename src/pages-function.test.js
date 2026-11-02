// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { targetUrl, proxy, onRequest, DEFAULT_ORIGIN, ACCESS_HEADER } from '../functions/api/[[path]].js';

const PAGE = 'https://fb13.chimerasportstrading.com';

function fakeFetch(status = 200, body = '{"ok":true}', headers = { 'content-type': 'application/json', 'set-cookie': 'x=1' }) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    return new Response(body, { status, headers });
  };
  fn.calls = calls;
  return fn;
}

describe('the path the Pages Function forwards to', () => {
  it('drops the /api prefix and keeps the query', () => {
    expect(targetUrl(`${PAGE}/api/admin/status?x=1`)).toBe(`${DEFAULT_ORIGIN}/admin/status?x=1`);
    expect(targetUrl(`${PAGE}/api/health`, 'https://example.test')).toBe('https://example.test/health');
    expect(targetUrl(`${PAGE}/api`)).toBe(`${DEFAULT_ORIGIN}/`);
    expect(targetUrl(`${PAGE}/api/`)).toBe(`${DEFAULT_ORIGIN}/`);
  });

  it('points at the Cloud Run service in London by default', () => {
    expect(DEFAULT_ORIGIN).toBe('https://fb13-trade-slip-api-991649774709.europe-west2.run.app');
  });
});

describe('the proxy', () => {
  it('refuses a request that did not come through Access, without calling the server', async () => {
    const fetch = fakeFetch();
    const res = await proxy(new Request(`${PAGE}/api/admin/status`), {}, fetch);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ detail: 'no Access token: the request did not come through Cloudflare Access' });
    expect(fetch.calls).toHaveLength(0);
  });

  it('forwards the Access token, the method and the body, and nothing else from the browser', async () => {
    const fetch = fakeFetch(200, '{"placing_enabled":false}');
    const req = new Request(`${PAGE}/api/admin/control/kill`, {
      method: 'POST',
      headers: { [ACCESS_HEADER]: 'tok.en', 'content-type': 'application/json', cookie: 'CF_Authorization=secret', 'x-other': 'no' },
      body: '{"reason":"stop"}',
    });
    const res = await proxy(req, {}, fetch);
    expect(fetch.calls).toHaveLength(1);
    const { url, init } = fetch.calls[0];
    expect(url).toBe(`${DEFAULT_ORIGIN}/admin/control/kill`);
    expect(init.method).toBe('POST');
    expect(init.redirect).toBe('manual');
    expect(init.headers.get('cf-access-jwt-assertion')).toBe('tok.en');
    expect(init.headers.get('content-type')).toBe('application/json');
    expect(init.headers.get('x-forwarded-host')).toBe('fb13.chimerasportstrading.com');
    expect(init.headers.get('cookie')).toBeNull();
    expect(init.headers.get('x-other')).toBeNull();
    expect(await new Response(init.body).text()).toBe('{"reason":"stop"}');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ placing_enabled: false });
    expect(res.headers.get('content-type')).toBe('application/json');
    expect(res.headers.get('set-cookie')).toBeNull();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('sends no body with GET and passes the status through', async () => {
    const fetch = fakeFetch(403, '{"detail":"not an operator"}');
    const res = await proxy(new Request(`${PAGE}/api/admin/status`, { headers: { [ACCESS_HEADER]: 't' } }), {}, fetch);
    expect(fetch.calls[0].init.body).toBeUndefined();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ detail: 'not an operator' });
  });

  it('uses FB13_API_ORIGIN from the Pages environment when set', async () => {
    const fetch = fakeFetch();
    await proxy(new Request(`${PAGE}/api/health`, { headers: { [ACCESS_HEADER]: 't' } }), { FB13_API_ORIGIN: 'https://moved.example' }, fetch);
    expect(fetch.calls[0].url).toBe('https://moved.example/health');
  });

  it('answers 502 when the server does not answer', async () => {
    const failing = async () => {
      throw new TypeError('fetch failed');
    };
    const res = await proxy(new Request(`${PAGE}/api/health`, { headers: { [ACCESS_HEADER]: 't' } }), {}, failing);
    expect(res.status).toBe(502);
    expect((await res.json()).detail).toBe('the server did not answer: TypeError');
  });

  it('is what Pages calls', async () => {
    const res = await onRequest({ request: new Request(`${PAGE}/api/health`), env: {} });
    expect(res.status).toBe(401);
  });
});
