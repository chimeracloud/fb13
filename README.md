# FB13 Trade slip

**Chimera Sports Trading · First Build 13 · version 0 · records only.**

Strategy concept and the trade slip concept: Mark Insley. Architecture and build: Charles Duckitt.

FB13 is the trade slip: each day's Early Doors lines pasted into one page, so
that a person can place each bet elsewhere, come back, and record what they
did in minutes, with every step kept.

**This page records what a person did elsewhere. It places nothing.** Version 0
has no server, no login to any bookmaker or exchange, no credential anywhere,
and makes no network request beyond loading itself. Storage is the browser's
own, so this version is a worksheet and not yet the record.

## Status

| Step | What | State |
| --- | --- | --- |
| 0 | Onboarding message to Charles | Sent 30 October 2026, approved |
| 1 | Repository files, skeleton page, Pages settings | Pushed 30 October 2026, 0.1.0 |
| 2 | Paste, parse and show the lines | Pushed 30 October 2026, 0.2.0; Pages build passed; live |
| 2a | Diagnostics: what was pasted | Pushed 30 October 2026, 0.2.1, for the first real paste from Gmail, which read nothing |
| 3 | Placed and Not placed, the form, counters, history | Committed locally, 0.3.0, held until the diagnostics are read |
| 4 | Export, worksheet notice | |
| 5 | Tests from the real fixtures run in the Pages build | |

Current state in detail: [docs/status/latest.md](docs/status/latest.md).

## What it does

- Two fields above the paste box: slot (08:00, 09:00 or 10:00 UK) and date.
  The date defaults to today in Europe/London, whatever the device's zone.
- A paste box. Copy the table from Mark's Early Doors email and paste it. The
  page reads the clipboard's HTML, finds the table and maps the columns by
  their header text. If there is no table it falls back to the email's plain
  text form, where each selection runs over two lines (the first starting with
  the race time and course, the second with "07:52 API") and the pair is joined
  into one row.
- Every parsed line is shown for the person to check, with a count. A line
  that cannot be read is shown as it is and flagged. Nothing is dropped and
  nothing is guessed. Each paste is kept as a group with the time it was pasted
  and the note below the table, and can be removed only while nothing has been
  recorded against any of its lines. An Add line button covers a bet that is
  not on the slip. If the browser gives the page nothing on paste, the slip
  lands in the box and a Read box button parses it from there.
- Under the paste box, a collapsed section "What was pasted" shows what the
  last paste handed the page: each clipboard type and its length, the
  text/plain with tabs as → and line breaks as ¶, the first 4000 characters of
  the text/html as escaped text (never rendered), the browser's user agent,
  and a Copy diagnostics button. It is kept in the browser with the lines so
  it survives a reload. Nothing in it leaves the page. It exists because the
  first real paste, from Gmail on a Mac on 30 October 2026, read 34 lines as
  plain text and could parse none of them.
- Each line carries all seven columns with its slot and date, and two buttons:
  Placed and Not placed. Placed opens a form: where (Betfair, each bookmaker
  code on that line, or Other), side (back or lay), price obtained, whether the
  BOG price applied (yes, no, unknown), stake (default 50, editable), time
  (default now in Europe/London), how it was placed (by an app, by a person,
  automatic), mode (paper or real, required, default paper, stated by the
  person and never inferred), and an optional reference. Where, side, price
  and how have no default and must be chosen. Not placed records at once, with
  the time.
- Counters at the top: lines, placed, waiting, not placed, and flagged when any
  line is. A line's state is its latest entry. An edit is a new entry, never an
  overwrite, and each line's history stays visible under the line, newest
  first, with the UK time it was recorded.
- Export downloads every entry as CSV and JSON, each row carrying the slot, the
  date and the mode. (Step 4.)

## What it does not do

- It places no bet, logs in nowhere, scrapes nothing and holds no credential.
- It does not decode the bookmaker codes on the slip (B3, WH, LD, CE, BY, FB,
  SI, SX, BTT, FR, Betano, BetMGM, Midnite, and UN, seen in real data on 30
  October 2026). They are shown exactly as they arrive. Charles holds the
  mapping.
- It sends nothing anywhere: no analytics, no third party script, no CDN, no
  fonts fetched. The only requests are for its own files.
- It never edits or deletes a history entry.
- It does not parse the text below the table (the lay rules). That is kept as
  a note.

## The input

The slip table has seven columns: Race, Horse, Best price, Best BOG, Betfair,
Lay target, Betfair cap.

| Column | What arrives | Kept as |
| --- | --- | --- |
| Race | Time and course, `11:35 Newmarket` | Text |
| Horse | Bold name | Text |
| Best price | A price and one or two bookmaker codes, `2.88 BetMGM, SI`; or `no price read` | Text, with the codes split out only to offer them in the "where" field |
| Best BOG | A price, or `–` | Text |
| Betfair | A price, sometimes `⚠ check`, then a line break and `07:52 API`; or `–` | Text, line break kept |
| Lay target | A bold price and `(13% under)` or `(5% under)`; or `–` | Text |
| Betfair cap | A pound amount, `£240` | Text |

Columns are matched by header text, so their order does not matter. A row with
a different number of cells, or a table missing one of the seven headers, is
flagged and shown raw.

## Where it runs

Cloudflare Pages, at **fb13.chimerasportstrading.com** behind Cloudflare
Access. Charles creates the Pages project and the Access application. Until
they exist the pages.dev address serves the same page.

Pages settings:

| Setting | Value |
| --- | --- |
| Repository, production branch | `chimeracloud/fb13`, `main` |
| Root directory | repository root |
| Build command | `npm test && npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` (also in `.node-version`) |

The build runs the tests first (`vitest run`), so a failing test fails the
deploy. Pages installs dependencies itself before the build command. Nothing is
built or tested on Charles's machine.

## Dependencies

Exact pins, each released at least two weeks before 30 October 2026. Nothing
else is added without Charles.

| Package | Version | Released |
| --- | --- | --- |
| react, react-dom | 19.3.1 | 2026-10-14 |
| vite | 8.3.4 | 2026-10-08 |
| @vitejs/plugin-react | 6.1.2 | 2026-10-05 |
| vitest | 5.0.5 | 2026-10-15 |
| jsdom | 30.1.3 | 2026-10-15 |

Node 22 (CHI-BRF-004). jsdom 30 needs Node 22.22.2 or later; Pages' default
Node 22 build is 22.23.4 as of 30 October 2026.

## Known risks

- **No `package-lock.json` in version 0** (Charles, 30 October 2026). The six
  direct dependencies are exact-pinned, but their sub-dependencies resolve at
  build time, so two builds days apart can differ underneath. To be revisited
  by generating a lock in CI.
- **Browser storage.** Entries live in this browser on this device. Clearing
  site data, a different browser, or the browser evicting storage loses them.
  Export is the only way out in version 0, and the page says so.
- **Plain text paste.** The fallback parser handles the email's own plain
  text shape (two lines per selection, the horse between asterisks). A browser
  copy from Gmail has no asterisks and, probably, tab separated cells; the
  first real paste read nothing. The diagnostics section exists to settle the
  real shape before the parser is changed. Flagged rows are shown raw, never
  guessed.

## Repository layout

```
index.html            the one page
src/main.jsx          mounts the app
src/App.jsx           the page: paste box, lines, add line
src/parse.js          the slip parser, both paths, pure functions
src/entries.js        the placed form's defaults and checks, append-only entries, counters
src/storage.js        browser storage, every call in try/catch
src/diagnostics.js    what the last paste handed the page, as text
src/dates.js          today and now in Europe/London
src/styles.css        mobile first, system fonts, no fetches
src/*.test.js         tests, run by the Pages build before vite build
docs/status/latest.md status, overwritten whenever the unit reports (CHI-POL-053)
reference/            read-only clones (the Bible), never committed
```

## Policies

- CHI-POL-032: a standalone First Build. Its own repository, its own page,
  nothing shared with or consumed from any other First Build.
- CHI-POL-031: other repositories are read only, cloned into `reference/`,
  which is gitignored.
- CHI-POL-047: STRATEGY NOTES sections below and in the CHANGELOG; only Claude
  Strategy writes into them.
- CHI-POL-053: `docs/status/latest.md`, overwritten whenever the unit reports.
- CHI-BRF-002: a First Build skips the admin shell. Version 0 has no server, so
  there is no shell.
- Node 22 per CHI-BRF-004. CHI-BRF-002 says 20; the conflict is recorded in the
  CHANGELOG for Claude Strategy.

## STRATEGY NOTES

No notes yet. Only Claude Strategy writes into this section; the build agent
reads it, acts on it and records what it did in the CHANGELOG.

---

*Born from complexity. Engineered for certainty.*
