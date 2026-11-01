# FB13 — status

**Unit:** FB13 Trade slip, version 0. **Written:** 2026-11-02, by the build agent.

**State:** steps 0 to 4 pushed to main on chimeracloud/fb13. The Pages build
for 1f083f8 (B, 0.3.1) passed, Charles reports. Pushed on 2 November 2026:
the status commit, the second and third real pastes as fixtures (0.3.2,
0.3.3), step 4 export (0.4.0, 7642519), and 0.4.1, which puts the version and
the short commit hash in the footer and on the first line of the diagnostics,
so a paste always says which build read it. 86 tests in all, none run here:
they run in the Pages build. Step 5, tests from the real fixtures, has been
done alongside each step.

**Decided by Charles, 2 November 2026:** a not placed entry carries no mode.
Left as built.

**Waiting for (from Charles):**
- The Pages build results for 7642519 (0.4.0) and for 0.4.1.
- Whether the footer and the diagnostics read as wanted once 0.4.1 is live.
- Anything further for step 5, or the next unit of work.

**Last did:** 0.4.1, the version and the commit on the page, 2026-11-02.

**Found and reported, not acted on:** CHI-BRF-002 and CHI-BRF-004 disagree on
the Node version (20 against 22). Building on 22 as approved; recorded in the
CHANGELOG for Claude Strategy.

**Declined:** nothing.
