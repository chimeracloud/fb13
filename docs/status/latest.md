# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 2 of 5). **Written:** 2026-11-02, 08:53 UTC, by the
build agent, from the clock.

**State:** the page fix for the six-cell layout (0.6.5, a9abada) was pushed
alone on Charles's word, and its Pages build failed at `npm test`: the new
export test split a CSV row on commas, and the decision cell holds commas
inside its quotes. The page stayed at 0.6.4. 0.6.6 (f4c534b) fixed that test and
was pushed alone; its build failed too: three export tests compare whole
CSV rows as literals and the nine new columns changed every row, and the
six-column header rule caught the old missing-column test. 0.6.7 fixes
those, page only, on top of f4c534b, committed locally, not pushed. The
build agent cannot read Cloudflare's build log; the causes are read from
the tests. Charles's paste
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
