# Changelog

All notable changes to FB13. Dates are UK dates. Newest first.

## [0.4.1] — 2026-11-02 — the version and the commit on the page

### Why
Three real pastes in a row left one question open: which version was live
when the paste was made. Now the page and the paste both say.

### Added
- `src/build.js`: the version from `package.json`, and the short commit hash
  Cloudflare Pages hands every build as `CF_PAGES_COMMIT_SHA`, stamped in by
  `vite.config.js` through Vite's `define`. Nothing to set in Pages. Outside a
  Pages build the hash is empty and the page says "no commit hash" rather than
  inventing one.
- The footer: "FB13 trade slip, version 0.4.1, commit 7642519."
- The diagnostics carry the build that took the paste. The first line of the
  copied text reads "FB13 paste diagnostics, version 0.4.1, commit 7642519",
  and the panel's first line says the same after the time and the source.
  Diagnostics kept in the browser from an earlier version say "build not
  recorded".
- Tests, five: the version matches `package.json`, the hash is seven hex
  characters or empty, the label in words; the diagnostics' first line with a
  build, without a hash, and from before the build was recorded.

## [0.4.0] — 2026-11-02 — export (step 4)

### Added
- `src/export.js`: every entry as CSV and as JSON, each row carrying the date,
  the slot and the mode. The CSV is UTF-8 with a byte order mark, so a
  spreadsheet reads the £ and the ⚠, quoted per RFC 4180 with CRLF between
  rows; its columns in reading order: date, slot, race, horse, kind, mode,
  where, where kind, side, price, stake, BOG, the time placed, how, reference,
  recorded at (UK time and UTC), the other five cells of the line, the line's
  flag, the entry id and the line id. A not placed entry carries no mode,
  because none was stated. The JSON carries the page name, its version, the
  time of export (UTC and UK), the worksheet notice, the count, and each entry
  with its whole line embedded. The file is made in the browser and saved to
  the device through an anchor with a download name, by an object URL or,
  where a browser has none, a data URL. Nothing is sent anywhere.
- The page: an Export section at the foot with Export CSV and Export JSON, the
  count of entries, and the worksheet notice beside the buttons. Both buttons
  are disabled until there is an entry. The filename carries the UK date and
  time of the export, `fb13-entries-YYYY-MM-DD-HHMM.csv` or `.json`. The
  section says what was saved, or that the browser refused.
- Tests, eleven: CSV quoting (comma, quote, line break, CRLF, empty, missing,
  a number); the header; a placed entry and a not placed entry on the real
  Dove Tale and No Hard Feelings rows field by field, with the Betfair cell's
  line break kept inside quotes and the empty mode on not placed; an edit
  following the entry it corrects; an entry whose line is not on the page,
  flagged; the header alone with no entries; the JSON object and its
  round trip, the missing line as null; the filename in UK time either side
  of the clock change; and the download helper against a fake document.

### Step 5
- Tests have been written alongside each step from the real fixtures and run
  in every Pages build before `vite build`. 81 in all with this version.

## [0.3.3] — 2026-11-02 — the third real paste as a fixture

### Tests
- The text of the third real paste (1 November 2026, 22:42 UK, same browser,
  the 08:00 slip: Curragh, Huntingdon, Cork, Carlisle, Worcester) kept to the
  character (2,305) and read: 28 selections, none flagged, nothing in the
  note, 07:52 API on every line; West Away's Betfair cell "2.90 ⚠ check" kept
  with its line break and marked for a look, the only such row; Choctaw Nation
  and Thread Of Gold cell by cell; the codes BY, CE; B3, BetMGM; Betano, BTT;
  WH; the real Safari markup of its first row read by position.

### Recorded
- The first real browser copy of the 08:00 slip. The same shape as the 10:00
  slip's: no header row in the HTML table, tab separated text, five cells then
  an API line of three. No new bookmaker code in it.

## [0.3.2] — 2026-10-30 — the second real paste as a fixture

### Tests
- The text of the second real paste (15:48 UK, same browser, a different
  day's 10:00 slip: Bath, Punchestown, Stratford, Ffos Las, Southwell) kept to
  the character (1,889) and read: 22 selections, none flagged, nothing in the
  note; codes with a space inside kept as written and split only on the comma
  (LiveScore Bet, Virgin Bet; B3, LiveScore Bet; FB, PP); the two word course
  Ffos Las; Passage Guenot and Sevenkingsmustdie cell by cell; the real Safari
  markup of its first row read by position.

### Recorded
- New bookmaker codes in real data: PP, LiveScore Bet, Virgin Bet. Shown as
  they arrive, not decoded.

## [0.3.1] — 2026-10-30 — parsers for the real browser copy (B)

Checked against the real paste of 15:13 UK on 30 October 2026 (Gmail in Safari
27.2 on a Mac, the 10:00 slip), read from the "What was pasted" diagnostics:
text/html of 148,852 characters and text/plain of 2,776. The HTML table had no
header row, which is why 0.2.0 found no table and fell back to the text. The
text was tab separated, five cells then an API line of three, exactly the shape
assumed here. That text is kept as a fixture, to the character.

### Changed
- HTML path: a header row is used when present, as before. Without one, the
  table with the most rows of exactly seven cells is read and the cells are
  mapped by position: Race, Horse, Best price, Best BOG, Betfair, Lay target,
  Betfair cap. A row of another length is flagged "N cells, expected 7". A
  seven cell row whose first cell is not a race time (most likely a header
  row with other names) is flagged, not read as a bet. Line breaks inside a
  cell, whether `<br>` or block elements, are kept. Each result says how it
  was mapped (header or position).
- Plain text path with tabs: cells split on tabs; trailing empty cells from a
  trailing tab are dropped; a line whose first cell is a time and a course
  starts a row; five cells then an API line of three are joined, with the
  Betfair cell carrying its line break; seven cells on one line are a complete
  row; anything else is flagged with the counts seen and shown with the tabs
  as " | ". Asterisks round the horse or the lay target are optional. Header
  and rules lines become the note.
- Plain text path without tabs: unchanged, the email's own form with the
  horse between asterisks. Without tabs and without asterisks nothing is
  guessed: flagged "first line did not read" and shown.
- Any HH:MM before "API" was already accepted; now tested with 09:52.

### Tests
- Seventeen more: seven cells by position reading the same cells as the
  header, the header still preferred, a line break inside a cell written as
  divs, a six cell row flagged, a header with other names not read as a bet,
  the seven cell table inside a layout table, null without either; the two
  real lines tab separated, with and without asterisks, several selections
  including the no price read and check rows with the new code UN, seven
  cells on one line, a first line with no API line flagged, a pair with the
  counts off flagged, a trailing tab; and without tabs the asterisk form
  still read, 09:52 accepted, and the two real lines flagged and shown.
- From the real paste: the fixture is the diagnostics' text to the character
  (2,776); all 34 selections read with none flagged and nothing in the note;
  Dove Tale, Ash Hobbs (codes 10bet and Betano, course Down Royal), No Hard
  Feelings and October Hill (no price read), Wearing Stars (the check, codes
  10bet and B3), Pequenita, Serenity Blue cell by cell; the real Safari table
  markup of the first row, with its no-break spaces and the line break, read
  by position; and the HTML taken first when both types arrive.

### Recorded
- A second new bookmaker code in real data, 10bet. Shown as it arrives.

## [0.3.0] — 2026-10-30 — placed and not placed, the form, counters, history (step 3)

### Added
- `src/entries.js`: the placed form's defaults (mode paper, stake 50, time now
  in Europe/London, BOG unknown, nothing else chosen), its checks (where, side,
  a numeric price and how are required; a bookmaker name when where is Other;
  a numeric stake; HH:MM time; paper or real), entries as append-only records
  carrying the line, slot, date, the UTC instant and the UK time, and the
  counters (lines, placed, waiting, not placed, flagged) read from each line's
  latest entry.
- The page: four counters at the top; Placed and Not placed on every line,
  flagged lines included; the Placed form inline under the line with
  thumb-sized choices for where (Betfair, each code on that line as written,
  Other with a box for the name), side, BOG, how and mode, with real shown in
  red; a status chip and a PAPER or REAL chip on each line; the line's history
  under it, newest first, each entry with the UK time it was recorded; the
  footer now says an entry is never edited or deleted.
- Tests: the where options from the real Dove Tale and No Hard Feelings rows,
  the form's opening state, what it refuses to save, a complete entry field by
  field, a code kept as written, Other named, not placed, an edit kept as a
  second entry with the latest deciding the state, and the counters.

### Not yet
- Export (step 4).

## [0.2.1] — 2026-10-30 — diagnostics: what was pasted

### Why
The first real paste, from Gmail on Charles's Mac, read 34 lines as plain
text and every one was flagged "first line did not read". Nothing was dropped
or guessed. Unknown whether the clipboard held no usable table HTML or the
parser did not find the table; the real plain text has no asterisks round the
horse and reads "09:52 API" on the 10:00 slip, and its cells are probably tab
separated. Charles's ruling: read the real shape before changing the parser.

### Added
- `src/diagnostics.js` and a collapsed "What was pasted" section under the
  paste box, always present: each clipboard type received and its length, the
  text/plain with tabs as →, carriage returns as ␍ and line feeds as ¶, the
  first 4000 characters of the text/html as escaped text (never rendered), the
  user agent, the source (paste event or Read box), and a Copy diagnostics
  button with a read-only text box as the fallback. Kept in the browser with
  the lines. No network.
- Tests: the whitespace marks, the type list and lengths, the 4000 character
  cut, a paste with no types, and the plain text form of the whole thing.

### Recorded
- A new bookmaker code, UN, appears in real data. Shown as it arrives, not
  decoded, like the others.
- The API time varies by slot: 09:52 on the 10:00 slip, 08:52 on the 09:00.
  Both parsers already accept any HH:MM before "API".

## [0.2.0] — 2026-10-30 — paste, parse and show the lines (step 2)

### Added
- `src/parse.js`. The HTML path: finds the slip table (including inside a mail
  client's layout table), maps the seven columns by header text so order does
  not matter, keeps every cell as the text that arrived with `<br>` kept as a
  line break, flags a row with the wrong number of cells or a table missing a
  header and shows it raw, keeps everything outside the table as a note. The
  plain text path: a line starting with a time and a course starts a row, the
  line starting with "07:52 API" completes it, the pair is joined; a row with
  no second line or an unreadable first line is shown raw and flagged; header
  and lay rules text become the note. Bookmaker codes are split only to offer
  them in the "where" field; the cell itself stays verbatim.
- `src/storage.js`: browser storage under one key, every read and write in
  try/catch, the page tells the person when the browser refuses to save.
- The page: the paste box (contenteditable; reads text/html then text/plain
  from the clipboard; a Read box button for browsers that paste without
  handing the page the clipboard), counters for lines and flagged, each paste
  shown as a group with its time and note, each line showing slot, date and
  all seven columns with the Betfair check highlighted and "As pasted" under
  it, Add line for a bet not on the slip, a switch to other dates that have
  lines, and the worksheet notice.
- Tests from the real fixtures: the four HTML rows cell by cell, the codes,
  the check flag, reordered columns, a short row flagged, a missing header
  flagged, the note kept and unparsed, the slip inside a layout table, the
  three plain text selections equal to their HTML cells, header and lay rules
  as note, a missing second line flagged, an unreadable first line flagged,
  HTML preferred over text, text fallback, HTML without a table read as text,
  the empty paste, a hand-added line.

### Not yet
- Placed and Not placed, the form, the history (step 3). Export (step 4).

## [0.1.0] — 2026-10-30 — skeleton (step 1)

### Added
- Repository files: `.gitignore` (node_modules, dist, `reference/`),
  `.node-version` 22, `package.json` with exact pins (react 19.3.1, react-dom
  19.3.1, vite 8.3.4, @vitejs/plugin-react 6.1.2, vitest 5.0.5, jsdom 30.1.3),
  `vite.config.js` with the jsdom test environment.
- Skeleton page: masthead, the banner "This page records what a person did
  elsewhere. It places nothing.", slot and date fields (the date defaults to
  today in Europe/London), a placeholder where the paste box goes, a footer
  with the worksheet notice.
- `src/dates.js`: `todayInLondon` and `nowInLondon`, with tests, so the Pages
  test step has real tests to run from the first deploy rather than passing on
  an empty set.
- README with the Pages settings for Charles, this CHANGELOG, and
  `docs/status/latest.md`.

### Decisions recorded
- Charles, 30 October 2026: hostname fb13.chimerasportstrading.com; Node 22;
  the pins above; the date defaults to today in Europe/London, not the device
  date; the "where" field offers Betfair, each code on the line, and Other; no
  `package-lock.json` in version 0, sub-dependencies resolve at build time, to
  be revisited by generating a lock in CI; both parsers ship, and the plain
  text parser handles the email's two-lines-per-selection shape.

### For Claude Strategy
- CHI-BRF-002 §3.5 says Node 20. CHI-BRF-004 §5 says Node 22. FB12 and FB13
  build on 22, approved by Charles on 30 October 2026. Raise for the Bible so
  the two briefs agree.

## STRATEGY NOTES

No notes yet. Only Claude Strategy writes into this section; the build agent
reads it, acts on it and records what it did above.

---

*Born from complexity. Engineered for certainty.*
