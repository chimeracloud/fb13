// The page's calls to its own server, through /api/* on the page's hostname.
// Cloudflare Access adds the token on the way; the Pages Function carries it to
// the server; the server checks it. Nothing here holds a credential. Every
// answer comes back as { ok, status, detail, data } and never throws, so a
// button can show what happened in words.
//
// 409 and 424 carry the server's own sentence (a state that refuses the call;
// a call to Betfair that failed), shown as it is. Any other status is shown
// with its number, so a body that is not the server's (Cloudflare's own error
// page is JSON with a "detail" too) is seen for what it is.

export async function api(path, { method = 'GET', body } = {}, fetchImpl = globalThis.fetch) {
  const init = { method, headers: { accept: 'application/json' }, credentials: 'same-origin' };
  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetchImpl(`/api${path}`, init);
  } catch (e) {
    return { ok: false, status: 0, detail: `no answer from the page's server route (${(e && e.name) || 'error'})`, data: null };
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  const detail = data && typeof data.detail === 'string' ? data.detail : res.ok ? '' : `${res.status}: ${text.slice(0, 200)}`;
  return { ok: res.ok, status: res.status, detail, data };
}

/** One sentence for a failed answer, for the person at the page. */
export function explain(r) {
  if (!r || r.ok) return '';
  if (r.status === 0) return `${r.detail}. If the Access session has run out, reload the page and sign in again.`;
  if (r.status === 401) return `Refused: ${r.detail}`;
  if (r.status === 403) return `Refused: ${r.detail}. Only an operator on the stored list may use the server.`;
  if (r.status === 409) return r.detail;
  if (r.status === 424) return r.detail;
  if (r.status === 503) return `The server is not ready: ${r.detail}`;
  return `${r.status}: ${r.detail}`;
}
