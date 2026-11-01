# FB13 — status

**Unit:** FB13 Trade slip, version 0. **Written:** 2026-11-02, by the build agent.

**State:** origin main is 1f083f8 (B, 0.3.1), pushed 15:37 UK on 30 October
2026; the Pages build result for it is not yet in hand. Four local commits
sit on top, none pushed: the status commit, the second real paste as a fixture
(0.3.2), the third real paste as a fixture (0.3.3, the 08:00 slip of 1
November 2026, 28 selections, the check marker inside a Betfair cell, reads
cleanly under B by analysis), and step 4 (0.4.0): Export CSV and Export JSON
at the foot of the page, every entry on every date, each row with the date,
the slot and the mode, the worksheet notice beside the buttons. 81 tests in
all, none run here: they run in the Pages build. Step 5, tests from the real
fixtures, has been done alongside each step; Charles says whether more is
wanted.

**Waiting for (from Charles):**
- The Pages build result for 1f083f8, and what the live page showed for the
  pastes of 30 October 15:48 UK (22 lines) and 1 November 22:42 UK (28 lines):
  none flagged, if 0.3.1 was live.
- The word to push the four local commits, in this order or another.
- Whether a not placed entry should carry a mode. It carries none now, because
  the Not placed button records at once with no form, so no mode is stated.

**Last did:** built step 4, export, 2026-11-02.

**Found and reported, not acted on:** CHI-BRF-002 and CHI-BRF-004 disagree on
the Node version (20 against 22). Building on 22 as approved; recorded in the
CHANGELOG for Claude Strategy.

**Declined:** nothing.
