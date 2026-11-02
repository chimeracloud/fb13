# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 3 of 5). **Written:** 2026-11-02, 07:05 UTC, by the
build agent, from the clock.

**State:** the first login and catalogue read succeeded (Charles, 06:41 and
06:42 UTC); the records are read back and the catalogue kept as a fixture.
Step 3 is built, paper only, committed locally as 0.7.0, not pushed: the
order builder (LAY at the tick below the lay target, size from the ruling,
LAPSE, one order per line, every refusal named), the paper ledger under
`orders/<date>/`, the real path behind the stored mode and the kill switch,
and the test order (BACK 2.00 at 1000, placed, seen, cancelled, gone; real
mode only, with the sentence typed). No order of any kind has been sent.
The live server is 0.6.4 (revision 00004-9vw), logged in, mode paper,
placing disabled. Real mode stays off until Charles writes the settings
version himself.

**Waiting for (from Charles), since 2 November 2026:**
- The word to push 9d2bb50 (status) and the 0.7.0 commit. The server push
  replaces the instance and drops the Betfair session; he logs in again.
- At 08:00 UK: paste the real 08:00 slip, Resolve the lines on this page.
- Rulings on the choices flagged in CHANGELOG 0.7.0 (tick down; the Betfair
  cap as size; placed once a day; the day's risk counts cancelled orders; the
  minimum-bet rule from the library's table).
- The settings version for real mode, then "go" for the test order.
- Whether the pages.dev addresses should go behind Access.

**Last did:** read the three Betfair records back; kept the catalogue as
`server/tests/fixtures/catalogue-2026-11-02.json`; built step 3 with tests
(95 pytest, 109 vitest, none run here); updated README and CHANGELOG.

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
