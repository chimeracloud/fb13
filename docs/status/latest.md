# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 2 of 5). **Written:** 2026-11-02, 08:05 UTC, by the
build agent, from the clock.

**State:** the page reads the new six-cell layout of the 08:00 slip (0.6.5,
page only, on top of ca06459, committed locally, not pushed). Charles's paste
of 07:40 UTC on 2 November 2026 was refused by 0.6.4, all 22 rows, correctly;
the real diagnostics are the fourth fixture. Price A and Price B are labels,
not meanings, until Charles confirms with Mark; no order is built from such a
line; the Betfair cap is absent and the line says so. The live server is
0.6.4 (revision 00004-9vw), logged in since 06:41 UTC, mode paper, placing
disabled. Step 3 and its rulings (0.7.0, 0.7.1) wait on a holding branch to
be put back on top of this commit; they are not pushed, so the Betfair
session stands.

**Waiting for (from Charles), since 2 November 2026:**
- The word to push the page fix (0.6.5) alone. Then he pastes the 08:00
  slip again and presses Resolve on the current instance.
- Mark's confirmation of what Price A and Price B are, and whether a Betfair
  cap exists for this layout.
- Later, the word to push the server commits (step 3 and the rulings), then
  the settings version for real mode and the £2 test order, as approved.

**Last did:** built the six-cell layout into the parser, the line card and
the export, with the real fixture and tests (112 vitest, none run here);
updated README and CHANGELOG.

**Found and reported, not acted on:**
- The pages.dev addresses serve the page without Access. The API refuses
  there too; the page holds no data for a stranger. Charles decides.
- Platform defaults on the service that `cloudbuild.yaml` does not set:
  startup CPU boost; a service-level maximum of 100 (the revision's 1 governs).
- FastAPI's test client warns that httpx is deprecated in favour of httpx2.
- `page_access_confirmed` stays false until Charles writes it true.
  `chimeracloud/fb13` is a public GitHub repository.
- CHI-PRO-003 versus Chimera_CBI_Corrections_For_CC.txt on the keys (Charles
  ruled for CHI-PRO-003); CHI-BRF-002 versus the admin shell (built as asked);
  the Python version (3.12 as ruled).

**Declined:** logging in to Betfair from the build agent's side, as Charles
said; creating a Cloud Run job for it, unasked. Nothing ran on Charles's
machine.
