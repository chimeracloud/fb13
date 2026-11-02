# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 2 of 5). **Written:** 2026-11-02, 06:31 UTC, by the
build agent, from the clock.

**State:** 0.6.4 is deployed and ready for the login. Cloud Build 2103e1b5
(ca06459) passed, 68 tests; revision `fb13-trade-slip-api-00004-9vw` runs
image `:ca06459`, one instance, always on, CPU always allocated, maximum one.
`/health` answers 0.6.4; `/ready` says storage gcs, settings loaded at
06:30:49 UTC, Access configured, Betfair session none (the new instance
starts clean, so the failed state of the first login is gone with the old
one). The page is live at 0.6.4. No login attempted; the build agent does
not log in. Placing is disabled. No order call exists.

**What this deploy carries:** the certificate pair as a tuple (the first
login's cause); the HTTP trail in every Betfair record; 424, never 502, for a
failed Betfair call, with the Pages Function and the page never passing
Cloudflare's 502/504 page off as the server's words; and object names from
one process that never share a millisecond, so "newest" is the last written.

**Waiting for (from Charles), since 2 November 2026:**
- On the page, in order: Refresh status (session none); Log in to Betfair,
  once; Read the markets for today. Then the build agent reads the stored
  records back from `gs://chiops-fb13-orders/betfair/2026-11-02/` and
  reports the count, the first and last off, one sample market with runners,
  the session state and the HTTP trail of the login and the catalogue call.
- At 08:00 UK: paste the real 08:00 slip, Resolve the lines on this page.
- Whether the pages.dev addresses should go behind Access.

**Last did:** pushed ca06459 on Charles's word, watched the build pass and
deploy, read the service back, called `/health` and `/ready`, confirmed the
page bundle is 0.6.4.

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
