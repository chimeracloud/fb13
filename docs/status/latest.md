# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 3 of 5). **Written:** 2026-11-02, 07:38 UTC, by the
build agent, from the clock.

**State:** the first login and catalogue read succeeded (Charles, 06:41 and
06:42 UTC); the records are read back and the catalogue kept as a fixture.
Step 3 is built, paper only, committed locally as 0.7.0 and, with Charles's
rulings applied, 0.7.1, not pushed: the
order builder (LAY at the tick below the lay target, size from the ruling,
LAPSE, one order per line, every refusal named), the paper ledger under
`orders/<date>/`, the real path behind the stored mode and the kill switch,
and the test order (BACK 2.00 at 1000, placed, seen, cancelled, gone; real
mode only, with the sentence typed). No order of any kind has been sent.
The live server is 0.6.4 (revision 00004-9vw), logged in, mode paper,
placing disabled. Real mode stays off until Charles writes the settings
version himself.

**Waiting for (from Charles), since 2 November 2026:**
- Charles pastes the 08:00 slip into the current instance and presses
  Resolve first. Then his word to push: 9d2bb50 (status), a011c96 (0.7.0)
  and the 0.7.1 rulings commit together. The server push replaces the
  instance and drops the Betfair session; he logs in again.
- After the deploy: Charles writes the settings version for real mode (the
  exact object and command are in the report of 2 November), then the £2
  test order from the page, with the sentence typed; then the kill switch.
- The Betfair cap's meaning, confirmed at the handover with Mark.
- Whether the pages.dev addresses should go behind Access.

**Last did:** applied Charles's rulings on step 3 (minimum £2.00 an order;
the Betfair cap kept as an assumption and said so in the refusal; the
approved choices recorded; kill and resume buttons on the panel), 0.7.1,
committed locally. Before that: read the three Betfair records back, kept
the catalogue as a fixture, built step 3 (95 pytest, 109 vitest, none run
here).

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
