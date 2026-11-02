// The page's only way to the server.
//
// Cloudflare Pages runs this for every request to
// fb13.chimerasportstrading.com/api/* and for nothing else: the static page is
// served as before. It forwards the request to the Cloud Run service in London
// with the Cf-Access-Jwt-Assertion header that Cloudflare Access put on it, and
// returns the answer as it came. Same hostname as the page, so the Access
// session applies; no second hostname, no second login, no script from anyone
// else in the page.
//
// Without the Access header there is nothing to forward: the request did not
// come through Access, so it is refused here and never reaches the server.
// The server verifies the token again on its side (server/app/access.py), so
// neither end trusts the other.
//
// The origin is Cloud Run's deterministic URL for the service in chiops; the
// Pages variable FB13_API_ORIGIN overrides it, should the service move.
//
// No 502 or 504 leaves here. Cloudflare replaces an origin's 502 or 504 with
// its own error page, and when the request asked for JSON that page is JSON
// with a "detail" of its own: that is how the first Betfair login's error
// reached the page on 2 November 2026 as "The origin web server returned an
// invalid or incomplete response to Cloudflare" instead of the server's words.
// The server answers its own failures with 424; a failure to reach it, or a
// 502/504 from Cloud Run's front door, is answered 503 here, in words.

export const DEFAULT_ORIGIN = 'https://fb13-trade-slip-api-991649774709.europe-west2.run.app';
export const ACCESS_HEADER = 'Cf-Access-Jwt-Assertion';

const REQUEST_HEADERS = ['accept', 'content-type', 'cf-access-jwt-assertion', 'last-event-id'];
const RESPONSE_HEADERS = ['content-type', 'cache-control', 'x-accel-buffering'];
/** Statuses Cloudflare would replace with its own page on the way to the browser. */
export const REPLACED_BY_CLOUDFLARE = [502, 504];

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

/** /api/admin/status?x=1 on the page's host -> /admin/status?x=1 on the origin. */
export function targetUrl(requestUrl, origin = DEFAULT_ORIGIN) {
  const url = new URL(requestUrl);
  const path = url.pathname.replace(/^\/api(?=\/|$)/, '') || '/';
  return new URL(path + url.search, origin).toString();
}

export async function proxy(request, env = {}, fetchImpl = fetch) {
  const token = request.headers.get(ACCESS_HEADER);
  if (!token) {
    return json({ detail: 'no Access token: the request did not come through Cloudflare Access' }, 401);
  }
  const origin = (env && env.FB13_API_ORIGIN) || DEFAULT_ORIGIN;
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  headers.set('x-forwarded-host', new URL(request.url).host);
  const method = request.method.toUpperCase();
  const init = { method, headers, redirect: 'manual' };
  if (method !== 'GET' && method !== 'HEAD') init.body = request.body;

  let upstream;
  try {
    upstream = await fetchImpl(targetUrl(request.url, origin), init);
  } catch (e) {
    return json({ detail: `the server did not answer: ${(e && e.name) || 'error'}` }, 503);
  }
  if (REPLACED_BY_CLOUDFLARE.includes(upstream.status)) {
    const text = (await upstream.text()).slice(0, 200);
    return json({ detail: `the server's front door answered ${upstream.status}: ${text}`, upstream_status: upstream.status }, 503);
  }
  const out = new Headers({ 'cache-control': 'no-store' });
  for (const name of RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}

export function onRequest(context) {
  return proxy(context.request, context.env);
}
