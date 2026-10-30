# FB13 — status

**Unit:** FB13 Trade slip, version 0. **Written:** 2026-10-30 15:17 UK, by the build agent.

**State:** live at fb13.chimerasportstrading.com on 0.2.1 (A, 06f323a, the
"What was pasted" diagnostics; Charles used it live at 15:13 UK, so its Pages
build passed). Held locally, not pushed, on top of A: step 3 (0.3.0, f4baafc:
Placed and Not placed, the form, counters, history) and B (0.3.1: the parsers
for the real browser copy). B is checked against the real paste: the HTML
table has no header row (read by position now); the text is tab separated,
five cells then three, as assumed. The real text is a fixture; 61 tests in all.

**Waiting for (from Charles):**
- The word to push step 3 and B.

**Last did:** checked B against the diagnostics and added the real paste as a
fixture, 2026-10-30 15:17 UK. Next: step 4, export, once B is pushed.

**Found and reported, not acted on:** CHI-BRF-002 and CHI-BRF-004 disagree on
the Node version (20 against 22). Building on 22 as approved; recorded in the
CHANGELOG for Claude Strategy.

**Declined:** nothing.
