# FB13 — status

**Unit:** FB13 Trade slip, version 0. **Written:** 2026-10-30 14:50 UK, by the build agent.

**State:** live at fb13.chimerasportstrading.com on 0.2.0 (d2f5151; the Pages
build passed). The first real paste from Gmail on a Mac read 34 lines as plain
text and parsed none; nothing dropped or guessed. Commit A (0.2.1) adds the
"What was pasted" diagnostics so the real clipboard shape can be read. Step 3
(Placed and Not placed, written and committed earlier as 661fb04) is being
re-based on top of A and held locally. Commit B (the parsers for the real
shape) follows locally and is held until checked against the diagnostics.

**Waiting for (from Charles):**
- The Pages build result for A, then a paste of the real slip and the copied
  diagnostics.
- The word to push step 3 and B.

**Last did:** committed A, 2026-10-30 14:50 UK.

**Found and reported, not acted on:** CHI-BRF-002 and CHI-BRF-004 disagree on
the Node version (20 against 22). Building on 22 as approved; recorded in the
CHANGELOG for Claude Strategy.

**Declined:** nothing.
