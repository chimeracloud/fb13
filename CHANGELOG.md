# Changelog

All notable changes to FB13. Dates are UK dates. Newest first.

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
