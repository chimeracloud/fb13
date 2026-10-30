# Changelog

All notable changes to FB13. Dates are UK dates. Newest first.

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
