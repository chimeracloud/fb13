# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 2 of 5). **Written:** 2026-11-02, 05:21 UTC, by the
build agent, from the clock.

**State:** step 2 is deployed and ready for the first login. Revision
`fb13-trade-slip-api-00003-gv8` runs image `:945b2c1` (0.6.1): one instance,
always on, CPU always allocated, maximum one, as Charles ruled at step 2.
Both Cloud Build runs of the morning passed, 65 tests each; the Pages build
carries the server panel. `/health` answers 0.6.1; `/ready` says storage gcs,
settings loaded, Access configured, Betfair session none. No login has been
made: the first login is Charles's click on the page, under the word he gave
on 2 November, and the build agent does not log in. No order call exists.
Placing is disabled.

**Waiting for (from Charles), since 2 November 2026:**
- On the page, in order: Refresh status; Log in to Betfair; Read the markets
  for today. Then the build agent reads the stored catalogue back from
  `gs://chiops-fb13-orders/betfair/` and reports the count, the first and
  last off, one sample market with runners, and the session state.
- At 08:00 UK: paste the real 08:00 slip, Resolve the lines on this page. The
  build agent reads `resolutions/` back and reports, then keeps the catalogue
  as a fixture and tests the resolver against real lines.
- Whether the pages.dev addresses should go behind Access.

**Last did:** pushed 75379da (status) and bec76e5 (0.6.2: the banner, the
export section's worksheet notice and the footer's worksheet notice removed
from the page, at Charles's ask) on his word. Page and docs only: no Cloud
Build ran, the server stays at revision 00003-gv8 (945b2c1, 0.6.1), its
settings loaded at 02:58:57 UTC, Betfair session none. The Pages build
passed; the live bundle is 0.6.2 at bec76e5 and carries none of the three
texts. The export file's own notice is left as it is, as Charles ruled.

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
