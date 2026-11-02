import { useEffect, useRef, useState } from 'react';
import { todayInLondon } from './dates.js';
import { parseSlip, manualLine, newId, COLUMNS, COLUMN_LABELS, extractedLabel } from './parse.js';
import { loadState, saveState } from './storage.js';
import { buildDiagnostics, diagnosticsText } from './diagnostics.js';
import { BUILD, buildLabel } from './build.js';
import { entriesToCsv, entriesToJson, exportFilename, downloadText } from './export.js';
import { api, explain } from './api.js';
import { linesForResolve, resolutionLabel, marketsSummary, sessionLabel } from './resolve.js';
import { TEST_CONFIRMATION, runnersOf, testOrderBody, testOrderSummary } from './orders.js';
import {
  WHERE_OTHER,
  SIDES,
  BOG,
  HOW,
  MODES,
  howLabel,
  whereOptions,
  blankPlaced,
  validatePlaced,
  makeEntry,
  entriesFor,
  counters,
} from './entries.js';

const SLOTS = ['08:00', '09:00', '10:00'];
const EMPTY = { version: 1, pastes: [], lines: [], entries: [], diagnostics: null };

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function timeOf(iso) {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

export default function App() {
  const [slot, setSlot] = useState(SLOTS[0]);
  const [date, setDate] = useState(() => todayInLondon());
  const [state, setState] = useState(() => loadState() || EMPTY);
  const [storageOk, setStorageOk] = useState(true);
  const [message, setMessage] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  // What the server resolved each line to, by line id. In memory only: asked for again next time.
  const [resolutions, setResolutions] = useState({});

  useEffect(() => {
    setStorageOk(saveState(state));
  }, [state]);

  function addParsed(result) {
    if (!result.lines.length) {
      setMessage({
        kind: 'warn',
        text: 'Nothing read. If the slip landed in the box, tap Read box. Otherwise add the line by hand.',
      });
      return false;
    }
    const pasteId = newId('paste');
    const paste = {
      id: pasteId,
      slot,
      date,
      source: result.source,
      note: result.note || '',
      pastedAt: new Date().toISOString(),
    };
    const lines = result.lines.map((l) => ({ ...l, pasteId, slot, date }));
    setState((s) => ({ ...s, pastes: [...s.pastes, paste], lines: [...s.lines, ...lines] }));
    const flagged = lines.filter((l) => !l.parsed).length;
    setMessage({
      kind: flagged ? 'warn' : 'ok',
      text: `Read ${plural(lines.length, 'line', 'lines')} from ${
        result.source === 'html' ? 'the table' : 'plain text'
      }${flagged ? `, ${flagged} flagged` : ''}. Check them below against the email.`,
    });
    return true;
  }

  function setDiagnostics(d) {
    setState((s) => ({ ...s, diagnostics: d }));
  }

  function addManual(cells) {
    const line = { ...manualLine(cells), pasteId: null, slot, date };
    setState((s) => ({ ...s, lines: [...s.lines, line] }));
    setShowAdd(false);
    setMessage({ kind: 'ok', text: `Added ${line.cells.horse || 'a line'} by hand.` });
  }

  function removePaste(pasteId) {
    const ids = new Set(state.lines.filter((l) => l.pasteId === pasteId).map((l) => l.id));
    if (state.entries.some((e) => ids.has(e.lineId))) return;
    setState((s) => ({
      ...s,
      pastes: s.pastes.filter((p) => p.id !== pasteId),
      lines: s.lines.filter((l) => l.pasteId !== pasteId),
    }));
    setMessage({ kind: 'ok', text: 'Paste removed. Nothing had been recorded against it.' });
  }

  function recordPlaced(line, form) {
    const entry = makeEntry({ line, kind: 'placed', placed: form });
    setState((s) => ({ ...s, entries: [...s.entries, entry] }));
    setMessage({
      kind: 'ok',
      text: `Recorded ${line.cells.horse || 'the line'} as placed at ${entry.placed.where}, ${entry.placed.mode}.`,
    });
  }

  function recordNotPlaced(line) {
    const entry = makeEntry({ line, kind: 'not_placed' });
    setState((s) => ({ ...s, entries: [...s.entries, entry] }));
    setMessage({ kind: 'ok', text: `Recorded ${line.cells.horse || 'the line'} as not placed.` });
  }

  const dayLines = state.lines.filter((l) => l.date === date);
  const dayPastes = state.pastes.filter((p) => p.date === date);
  const manualLines = dayLines.filter((l) => !l.pasteId);
  const c = counters(dayLines, state.entries);
  const otherDates = Array.from(new Set(state.lines.map((l) => l.date)))
    .filter((d) => d !== date)
    .sort()
    .reverse();

  const lineProps = (l) => ({
    line: l,
    entries: entriesFor(state.entries, l.id),
    onPlaced: (form) => recordPlaced(l, form),
    onNotPlaced: () => recordNotPlaced(l),
    resolution: resolutions[l.id] || null,
  });

  const takeResolutions = (list) =>
    setResolutions((prev) => ({
      ...prev,
      ...Object.fromEntries((list || []).filter((r) => r && r.id).map((r) => [r.id, r])),
    }));

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">Chimera Sports Trading</div>
        <h1>FB13 Trade slip</h1>
      </header>

      {!storageOk && (
        <div className="banner warn" role="alert">
          This browser is not saving. Anything on this page is lost when it closes.
        </div>
      )}

      <main>
        <section className="counters" aria-label="Counters">
          <Counter n={c.lines} label="lines" />
          <Counter n={c.placed} label="placed" className={c.placed ? 'ok' : ''} />
          <Counter n={c.waiting} label="waiting" />
          <Counter n={c.notPlaced} label="not placed" />
          {c.flagged > 0 && <Counter n={c.flagged} label="flagged" className="warn" />}
        </section>

        <section className="fields" aria-label="Slip">
          <label>
            <span>Slot</span>
            <select value={slot} onChange={(e) => setSlot(e.target.value)}>
              {SLOTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </section>

        <PasteBox onPaste={(clip) => addParsed(parseSlip(clip))} onDiagnostics={setDiagnostics} />

        <DiagnosticsPanel diagnostics={state.diagnostics} />

        <ServerPanel date={date} lines={dayLines} onResolutions={takeResolutions} />

        {message && (
          <p className={`message ${message.kind}`} role="status">
            {message.text}
          </p>
        )}

        {dayPastes.map((p) => (
          <PasteGroup
            key={p.id}
            paste={p}
            lines={dayLines.filter((l) => l.pasteId === p.id)}
            lineProps={lineProps}
            canRemove={!state.entries.some((e) =>
              dayLines.some((l) => l.pasteId === p.id && l.id === e.lineId),
            )}
            onRemove={() => removePaste(p.id)}
          />
        ))}

        {manualLines.length > 0 && (
          <section className="paste-group">
            <h2>Added by hand</h2>
            {manualLines.map((l) => (
              <LineCard key={l.id} {...lineProps(l)} />
            ))}
          </section>
        )}

        {dayLines.length === 0 && (
          <p className="empty">No lines for {date} yet. Paste the slip above.</p>
        )}

        <section className="add-line">
          {showAdd ? (
            <AddLineForm slot={slot} date={date} onAdd={addManual} onCancel={() => setShowAdd(false)} />
          ) : (
            <button type="button" onClick={() => setShowAdd(true)}>
              Add line
            </button>
          )}
        </section>

        {otherDates.length > 0 && (
          <p className="other-dates">
            Lines on other dates:{' '}
            {otherDates.map((d) => (
              <button key={d} type="button" className="link" onClick={() => setDate(d)}>
                {d} ({state.lines.filter((l) => l.date === d).length})
              </button>
            ))}
          </p>
        )}

        <ExportPanel entries={state.entries} lines={state.lines} />
      </main>

      <footer>
        <p className="build">FB13 trade slip, {buildLabel(BUILD)}.</p>
        <p className="tag">Born from complexity. Engineered for certainty.</p>
      </footer>
    </div>
  );
}

/**
 * Version 1, step 2. The page's window on its server: the status, the Betfair
 * session (an operator logs in; nothing logs in by itself), the day's markets,
 * and the resolution of the lines on this page to a market and a runner.
 * Read only: nothing here places, cancels or changes a setting.
 */
function ServerPanel({ date, lines, onResolutions }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const [markets, setMarkets] = useState(null);
  const [result, setResult] = useState(null);
  const [testMarket, setTestMarket] = useState('');
  const [testRunner, setTestRunner] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [testResult, setTestResult] = useState(null);

  async function run(label, fn) {
    setBusy(label);
    setNote(null);
    try {
      const r = await fn();
      if (r && !r.ok) setNote({ kind: 'warn', text: explain(r) });
      return r;
    } catch (e) {
      setNote({ kind: 'warn', text: `The page could not finish that: ${(e && e.message) || 'error'}` });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function loadStatus() {
    const r = await api('/admin/status');
    if (r.ok) setStatus(r.data);
    return r;
  }

  const refresh = () => run('status', loadStatus);

  const control = (action) =>
    run(action, async () => {
      const r = await api(`/admin/control/${action}`, { method: 'POST', body: { reason: 'operator, from the page' } });
      await loadStatus();
      return r;
    });

  const readMarkets = () =>
    run('markets', async () => {
      const r = await api(`/betfair/markets?date=${encodeURIComponent(date)}`);
      if (r.ok) setMarkets(r.data);
      return r;
    });

  const resolve = () =>
    run('resolve', async () => {
      const body = { date, lines: linesForResolve(lines) };
      if (!body.lines.length) {
        return { ok: false, status: 409, detail: `No parsed lines on this page for ${date}. Paste the slip first.` };
      }
      const r = await api('/resolve', { method: 'POST', body });
      if (r.ok && r.data) {
        setResult(r.data);
        onResolutions(r.data.resolutions || []);
      }
      return r;
    });

  const testOrder = () =>
    run('test-order', async () => {
      setTestResult(null);
      const r = await api('/orders/test', {
        method: 'POST',
        body: testOrderBody({ date, marketId: testMarket, selectionId: testRunner, confirmation }),
      });
      if (r.ok && r.data) setTestResult(r.data);
      setConfirmation('');
      await loadStatus();
      return r;
    });

  const b = status ? status.betfair : null;
  const session = b ? b.session : null;
  const realMode = !!status && status.mode === 'real';
  const testRunners = runnersOf(markets, testMarket);

  return (
    <section className="server" aria-label="Server">
      <h2>
        Server{' '}
        <span className="sub">
          version 1, step 3: {status ? (realMode ? 'real mode.' : 'paper. Orders are built and recorded; nothing is sent.') : 'mode not read yet.'}
        </span>
      </h2>
      <p className="status-line">
        {status
          ? `Mode ${status.mode}; placing ${status.placing_enabled ? 'enabled' : 'disabled'}; Betfair session ${sessionLabel(status)}; ` +
            `signed in as ${status.signed_in_as}; server ${status.version}${status.commit ? ` (${status.commit})` : ''}.`
          : "Not asked yet. Refresh to read the server's status."}
      </p>
      <div className="row">
        <button type="button" onClick={refresh} disabled={!!busy}>
          {busy === 'status' ? 'Reading…' : 'Refresh status'}
        </button>
        <button type="button" onClick={() => control('betfair-login')} disabled={!!busy || session === 'logged_in'}>
          {busy === 'betfair-login' ? 'Logging in…' : 'Log in to Betfair'}
        </button>
        <button type="button" onClick={() => control('betfair-logout')} disabled={!!busy || session !== 'logged_in'}>
          Log out
        </button>
        {(session === 'failed' || session === 'expired' || session === 'logged_out') && (
          <button type="button" onClick={() => control('betfair-reset')} disabled={!!busy}>
            Clear the session state
          </button>
        )}
        {status && (
          <button type="button" onClick={() => control(status.placing_enabled ? 'kill' : 'resume')} disabled={!!busy}>
            {busy === 'kill' || busy === 'resume' ? 'Storing…' : status.placing_enabled ? 'Kill switch: stop all placing' : 'Resume placing'}
          </button>
        )}
        <button type="button" onClick={readMarkets} disabled={!!busy}>
          {busy === 'markets' ? 'Reading…' : `Read the markets for ${date}`}
        </button>
        <button type="button" className="primary" onClick={resolve} disabled={!!busy}>
          {busy === 'resolve' ? 'Resolving…' : 'Resolve the lines on this page'}
        </button>
      </div>
      {note && (
        <p className={`message ${note.kind}`} role="status">
          {note.text}
        </p>
      )}
      {markets && (
        <div className="result">
          <p>
            {marketsSummary(markets)}
            {markets.from_cache ? " (from the server's cache)" : ''}
          </p>
          {markets.markets && markets.markets.length > 0 && (
            <details>
              <summary>Every market and its runners</summary>
              <ol>
                {markets.markets.map((m) => (
                  <li key={m.market_id}>
                    {m.start_london} {m.venue} · {m.market_name} · {m.market_id}:{' '}
                    {(m.runners || []).map((r) => `${r.name} (${r.selection_id})`).join(', ')}
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}
      {result && (
        <div className="result">
          <p>
            Resolved {result.resolved} of {result.resolved + result.flagged} lines for {result.date} against the
            catalogue read at {result.catalogue_fetched_at}. Each line below shows its market and runner, or why not.
          </p>
        </div>
      )}
      <div className="test-order">
        <h3>Test order</h3>
        <p>
          One BACK of £2.00 at 1000, which cannot match: placed, seen in the current orders, cancelled, seen gone.
          Real money, real mode only.{' '}
          {realMode
            ? 'Choose the market and runner from the catalogue read above, type the sentence, then press the button.'
            : `The stored mode is ${status ? status.mode : 'not read yet'}; the server refuses it until Charles writes real.`}
        </p>
        <div className="row">
          <select
            aria-label="Test order market"
            value={testMarket}
            onChange={(e) => {
              setTestMarket(e.target.value);
              setTestRunner('');
            }}
            disabled={!realMode || !markets}
          >
            <option value="">{markets ? 'Market…' : 'Read the markets first'}</option>
            {((markets && markets.markets) || []).map((m) => (
              <option key={m.market_id} value={m.market_id}>
                {m.start_london} {m.venue} · {m.market_name}
              </option>
            ))}
          </select>
          <select aria-label="Test order runner" value={testRunner} onChange={(e) => setTestRunner(e.target.value)} disabled={!realMode || !testMarket}>
            <option value="">Runner…</option>
            {testRunners.map((r) => (
              <option key={r.selection_id} value={String(r.selection_id)}>
                {r.name} ({r.selection_id})
              </option>
            ))}
          </select>
        </div>
        <div className="row">
          <input
            type="text"
            aria-label="Test order confirmation"
            placeholder={`Type: ${TEST_CONFIRMATION}`}
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={!realMode}
            size={60}
          />
          <button
            type="button"
            className="primary"
            onClick={testOrder}
            disabled={!!busy || !realMode || !testMarket || !testRunner || confirmation.trim() !== TEST_CONFIRMATION}
          >
            {busy === 'test-order' ? 'Placing and cancelling…' : 'Place the £2 test back at 1000, then cancel it'}
          </button>
        </div>
        {testResult && (
          <p className="message ok" role="status">
            {testOrderSummary(testResult)}
          </p>
        )}
      </div>
    </section>
  );
}

function ExportPanel({ entries, lines }) {
  const [note, setNote] = useState(null);
  const n = entries.length;

  function exportAs(ext) {
    const now = new Date();
    const csv = ext === 'csv';
    const text = csv ? entriesToCsv(entries, lines) : entriesToJson(entries, lines, now);
    const type = csv ? 'text/csv;charset=utf-8' : 'application/json;charset=utf-8';
    const filename = exportFilename(ext, now);
    try {
      downloadText({ filename, text, type });
      setNote({
        kind: 'ok',
        text: `Saved ${filename} to this device, ${plural(n, 'entry', 'entries')}. Nothing was sent anywhere.`,
      });
    } catch (err) {
      setNote({
        kind: 'warn',
        text: `The browser did not save the file${err && err.message ? `: ${err.message}` : ''}.`,
      });
    }
  }

  return (
    <section className="export" aria-label="Export">
      <h2>Export</h2>
      <p>
        Every entry on every date, as a file saved to this device. Each row carries the date, the
        slot and the mode. {n ? `${plural(n, 'entry', 'entries')} so far.` : 'Nothing recorded yet.'}
      </p>
      <div className="actions">
        <button type="button" className="primary" disabled={!n} onClick={() => exportAs('csv')}>
          Export CSV
        </button>
        <button type="button" disabled={!n} onClick={() => exportAs('json')}>
          Export JSON
        </button>
      </div>
      {note && (
        <p className={`message ${note.kind}`} role="status">
          {note.text}
        </p>
      )}
    </section>
  );
}

function Counter({ n, label, className = '' }) {
  return (
    <div className={`counter ${className}`}>
      <span className="n">{n}</span>
      <span className="l">{label}</span>
    </div>
  );
}

function PasteBox({ onPaste, onDiagnostics }) {
  const ref = useRef(null);
  const [hasContent, setHasContent] = useState(false);

  function refresh() {
    const el = ref.current;
    setHasContent(!!el && el.innerText.trim().length > 0);
  }

  function clear() {
    if (ref.current) ref.current.innerHTML = '';
    setHasContent(false);
  }

  function handlePaste(e) {
    const cd = e.clipboardData;
    let types = [];
    try {
      types = cd && cd.types ? Array.from(cd.types) : [];
    } catch {
      types = [];
    }
    const data = {};
    for (const t of types) {
      try {
        data[t] = cd.getData(t);
      } catch {
        data[t] = '';
      }
    }
    const html = cd ? data['text/html'] ?? cd.getData('text/html') : '';
    const text = cd ? data['text/plain'] ?? cd.getData('text/plain') : '';
    onDiagnostics(
      buildDiagnostics({
        source: 'paste event',
        types,
        data,
        html,
        text,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        build: BUILD,
      }),
    );
    if (!html && !text) return; // let the browser paste; the person taps Read box
    e.preventDefault();
    const ok = onPaste({ html, text });
    if (ok) {
      clear();
    } else if (ref.current) {
      ref.current.textContent = text || '';
      refresh();
    }
  }

  function readBox() {
    const el = ref.current;
    if (!el) return;
    onDiagnostics(
      buildDiagnostics({
        source: 'read box',
        types: [],
        data: {},
        html: el.innerHTML,
        text: el.innerText,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        build: BUILD,
      }),
    );
    const ok = onPaste({ html: el.innerHTML, text: el.innerText });
    if (ok) clear();
  }

  return (
    <section className="pastebox" aria-label="Paste box">
      <div
        ref={ref}
        className="paste-area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Paste the slip here"
        data-placeholder="Copy the table from the Early Doors email and paste it here"
        onPaste={handlePaste}
        onInput={refresh}
      />
      <div className="row">
        <button type="button" onClick={readBox} disabled={!hasContent}>
          Read box
        </button>
        <button type="button" onClick={clear} disabled={!hasContent}>
          Clear box
        </button>
      </div>
    </section>
  );
}

function PasteGroup({ paste, lines, lineProps, canRemove, onRemove }) {
  const flagged = lines.filter((l) => !l.parsed).length;
  return (
    <section className="paste-group">
      <h2>
        {paste.slot} slip
        <span className="sub">
          {' '}
          pasted {timeOf(paste.pastedAt)} from {paste.source === 'html' ? 'the table' : 'plain text'},{' '}
          {plural(lines.length, 'line', 'lines')}
          {flagged ? `, ${flagged} flagged` : ''}
        </span>
      </h2>
      {lines.map((l) => (
        <LineCard key={l.id} {...lineProps(l)} />
      ))}
      {paste.note && (
        <details className="note">
          <summary>Note from the slip (not parsed)</summary>
          <pre>{paste.note}</pre>
        </details>
      )}
      {canRemove && (
        <button type="button" className="quiet" onClick={onRemove}>
          Remove this paste (nothing recorded against it yet)
        </button>
      )}
    </section>
  );
}

const STATUS_LABEL = { placed: 'Placed', not_placed: 'Not placed', waiting: 'Waiting' };

function LineCard({ line, entries, onPlaced, onNotPlaced, resolution = null }) {
  const [formOpen, setFormOpen] = useState(false);
  const c = line.cells || {};
  const d = line.derived || {};
  const latest = entries.length ? entries[entries.length - 1] : null;
  const status = latest ? latest.kind : 'waiting';

  return (
    <article className={`line ${line.parsed ? '' : 'flagged'} status-${status}`}>
      <div className="line-meta">
        <span className="chip">{line.slot}</span>
        <span className="chip">{line.date}</span>
        {line.source === 'manual' && <span className="chip">added by hand</span>}
        {!line.parsed && <span className="chip warn">Could not read: {line.flag}</span>}
        <span className={`chip status ${status}`}>{STATUS_LABEL[status]}</span>
        {latest && latest.kind === 'placed' && (
          <span className={`chip mode ${latest.placed.mode}`}>{latest.placed.mode.toUpperCase()}</span>
        )}
        {resolution && (
          <span className={`chip ${resolution.status === 'resolved' ? 'resolved' : 'unresolved'}`}>
            {resolution.status === 'resolved' ? 'Betfair: resolved' : 'Betfair: not resolved'}
          </span>
        )}
      </div>
      {resolution && <p className="resolution">{resolutionLabel(resolution)}</p>}

      {line.parsed ? (
        <>
          <div className="line-head">
            <span className="race">{c.race}</span>
            <span className="horse">{c.horse}</span>
          </div>
          {line.layout === 'six' ? (
            <>
              <dl className="cells">
                <div>
                  <dt>Price A</dt>
                  <dd>{c.priceA}</dd>
                </div>
                <div>
                  <dt>Price B</dt>
                  <dd>{c.priceB}</dd>
                </div>
                <div>
                  <dt>Decision</dt>
                  <dd>{c.decision}</dd>
                </div>
                <div>
                  <dt>Button</dt>
                  <dd>{c.button}</dd>
                </div>
                <div>
                  <dt>Betfair cap</dt>
                  <dd>none in this layout</dd>
                </div>
              </dl>
              <p className="extracted">{extractedLabel(d)}</p>
            </>
          ) : (
            <dl className="cells">
              <div>
                <dt>Best price</dt>
                <dd>{c.bestPrice}</dd>
              </div>
              <div>
                <dt>Best BOG</dt>
                <dd>{c.bestBog}</dd>
              </div>
              <div className={d.betfairCheck ? 'check' : ''}>
                <dt>Betfair</dt>
                <dd className="multiline">{c.betfair}</dd>
              </div>
              <div>
                <dt>Lay target</dt>
                <dd>{c.layTarget}</dd>
              </div>
              <div>
                <dt>Betfair cap</dt>
                <dd>{c.betfairCap}</dd>
              </div>
            </dl>
          )}
          {line.source !== 'manual' && (
            <details className="raw-toggle">
              <summary>As pasted</summary>
              <pre className="raw">{line.raw}</pre>
            </details>
          )}
        </>
      ) : (
        <pre className="raw">{line.raw}</pre>
      )}

      <div className="actions">
        <button
          type="button"
          className="primary"
          aria-expanded={formOpen}
          onClick={() => setFormOpen((v) => !v)}
        >
          Placed
        </button>
        <button type="button" onClick={onNotPlaced}>
          Not placed
        </button>
      </div>

      {formOpen && (
        <PlacedForm
          line={line}
          onSave={(form) => {
            onPlaced(form);
            setFormOpen(false);
          }}
          onCancel={() => setFormOpen(false)}
        />
      )}

      {entries.length > 0 && <History entries={entries} />}
    </article>
  );
}

function Choice({ label, value, options, onChange, error, className = '' }) {
  return (
    <div className={`choice ${className}`}>
      <span className="choice-label">{label}</span>
      <div className="choice-options" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`opt ${o.value === value ? 'selected' : ''} ${o.value === 'real' ? 'real' : ''}`}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {error && <em className="err">{error}</em>}
    </div>
  );
}

function PlacedForm({ line, onSave, onCancel }) {
  const [f, setF] = useState(() => blankPlaced());
  const [touched, setTouched] = useState(false);
  const errors = validatePlaced(f);
  const options = whereOptions(line);
  const show = (k) => (touched && errors[k] ? errors[k] : null);

  function set(k, v) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  function submit(e) {
    e.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length > 0) return;
    onSave(f);
  }

  return (
    <form className="placed-form" onSubmit={submit} noValidate>
      <h3>
        Record as placed <span className="sub">{line.cells.horse}</span>
      </h3>

      <Choice
        label="Where"
        value={f.where}
        options={options.map((o) => ({ value: o, label: o }))}
        onChange={(v) => set('where', v)}
        error={show('where')}
      />
      {f.where === WHERE_OTHER && (
        <label>
          <span>Bookmaker</span>
          <input
            type="text"
            value={f.whereOther}
            onChange={(e) => set('whereOther', e.target.value)}
            autoComplete="off"
          />
          {show('whereOther') && <em className="err">{errors.whereOther}</em>}
        </label>
      )}

      <Choice
        label="Side"
        value={f.side}
        options={SIDES.map((s) => ({ value: s, label: s }))}
        onChange={(v) => set('side', v)}
        error={show('side')}
      />

      <div className="two">
        <label>
          <span>Price obtained</span>
          <input
            type="text"
            inputMode="decimal"
            value={f.price}
            onChange={(e) => set('price', e.target.value)}
            autoComplete="off"
          />
          {show('price') && <em className="err">{errors.price}</em>}
        </label>
        <label>
          <span>Stake (£)</span>
          <input
            type="text"
            inputMode="decimal"
            value={f.stake}
            onChange={(e) => set('stake', e.target.value)}
            autoComplete="off"
          />
          {show('stake') && <em className="err">{errors.stake}</em>}
        </label>
      </div>

      <Choice
        label="BOG price applied"
        value={f.bog}
        options={BOG.map((b) => ({ value: b, label: b }))}
        onChange={(v) => set('bog', v)}
        error={show('bog')}
      />

      <label>
        <span>Time placed (UK)</span>
        <input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
        {show('time') && <em className="err">{errors.time}</em>}
      </label>

      <Choice
        label="How it was placed"
        value={f.how}
        options={HOW.map((h) => ({ value: h.value, label: h.label }))}
        onChange={(v) => set('how', v)}
        error={show('how')}
      />

      <Choice
        label="Mode"
        value={f.mode}
        options={MODES.map((m) => ({ value: m, label: m }))}
        onChange={(v) => set('mode', v)}
        error={show('mode')}
        className="mode-choice"
      />

      <label>
        <span>Reference (optional)</span>
        <input
          type="text"
          value={f.reference}
          onChange={(e) => set('reference', e.target.value)}
          autoComplete="off"
        />
      </label>

      <div className="row">
        <button type="submit" className="primary">
          Save entry
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function describePlaced(p) {
  return [
    `Placed at ${p.where}`,
    p.side,
    `price ${p.price}`,
    `BOG ${p.bog}`,
    `£${p.stake}`,
    `at ${p.time}`,
    howLabel(p.how),
    p.mode.toUpperCase(),
    p.reference ? `ref ${p.reference}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

function History({ entries }) {
  const newestFirst = [...entries].reverse();
  return (
    <details className="history" open>
      <summary>
        History, {plural(entries.length, 'entry', 'entries')}. A correction is a new entry; nothing
        here is edited or deleted.
      </summary>
      <ol>
        {newestFirst.map((e) => (
          <li key={e.id} className={e.kind}>
            <span className="when">{e.atLondon}</span>{' '}
            {e.kind === 'placed' ? describePlaced(e.placed) : 'Not placed'}
          </li>
        ))}
      </ol>
    </details>
  );
}

function AddLineForm({ slot, date, onAdd, onCancel }) {
  const [cells, setCells] = useState(() => Object.fromEntries(COLUMNS.map((c) => [c.key, ''])));
  const canAdd = cells.race.trim().length > 0 && cells.horse.trim().length > 0;

  function submit(e) {
    e.preventDefault();
    if (!canAdd) return;
    onAdd(cells);
  }

  return (
    <form className="add-form" onSubmit={submit}>
      <h2>
        Add line <span className="sub">for the {slot} slip on {date}</span>
      </h2>
      {COLUMNS.map((col) => (
        <label key={col.key}>
          <span>{COLUMN_LABELS[col.key]}</span>
          {col.key === 'betfair' ? (
            <textarea
              rows={2}
              value={cells[col.key]}
              onChange={(e) => setCells({ ...cells, [col.key]: e.target.value })}
            />
          ) : (
            <input
              type="text"
              value={cells[col.key]}
              onChange={(e) => setCells({ ...cells, [col.key]: e.target.value })}
              autoComplete="off"
            />
          )}
        </label>
      ))}
      <div className="row">
        <button type="submit" className="primary" disabled={!canAdd}>
          Add
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function DiagnosticsPanel({ diagnostics }) {
  const [copied, setCopied] = useState(null);
  const text = diagnosticsText(diagnostics);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied.');
    } catch {
      setCopied('Copy did not work here. Select the text in the box below and copy it by hand.');
    }
  }

  return (
    <details className="diagnostics">
      <summary>What was pasted</summary>
      {diagnostics ? (
        <>
          <p className="sub">
            Last paste at {diagnostics.at}, via {diagnostics.source}, {buildLabel(diagnostics.build)}.
            Shown as text, never rendered. Nothing here leaves this page.
          </p>
          <table className="diag-types">
            <thead>
              <tr>
                <th>Clipboard type</th>
                <th>Characters</th>
              </tr>
            </thead>
            <tbody>
              {diagnostics.items.length === 0 ? (
                <tr>
                  <td colSpan={2}>none handed to the page</td>
                </tr>
              ) : (
                diagnostics.items.map((i) => (
                  <tr key={i.type}>
                    <td>{i.type}</td>
                    <td>{i.length}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <h4>
            text/plain, {diagnostics.textLength} characters. Tabs as →, carriage returns as ␍, line
            feeds as ¶.
          </h4>
          <pre className="diag">{diagnostics.textMarked || '(empty)'}</pre>
          <h4>
            text/html, {diagnostics.htmlLength} characters
            {diagnostics.htmlTruncated ? ', first 4000 shown' : ''}.
          </h4>
          <pre className="diag">{diagnostics.htmlSample || '(empty)'}</pre>
        </>
      ) : (
        <p className="sub">No paste yet.</p>
      )}
      <div className="row">
        <button type="button" onClick={copy} disabled={!diagnostics}>
          Copy diagnostics
        </button>
      </div>
      {copied && <p className="sub">{copied}</p>}
      <textarea className="diag-copy" readOnly value={text} rows={4} aria-label="Diagnostics as text" />
    </details>
  );
}
