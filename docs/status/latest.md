# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 2 of 5). **Written:** 2026-11-02,
about 03:50 UTC, by the build agent.

**State:** step 1 is deployed and verified (revision 00001 at 627ec3b,
`/health` and `/ready` 200, 47 tests passed in Cloud Build). Step 2 is built
and committed locally as 0.6.0, not pushed: the Betfair session on the
Delayed key (login once with the certificate at an operator's ask, keepAlive,
a failed login latched and never retried), listMarketCatalogue for the day's
GB and IE win markets, the resolver, the page's server panel, every Betfair
request and response recorded in the orders bucket. No login has been made:
the first login is Charles's click on the page once 0.6.0 is deployed, under
the word he gave on 2 November. No order call exists in the code. Placing is
disabled.

**Waiting for (from Charles), since 2 November 2026:**
- The word to push 0.6.0. The push builds the page (104 tests) and the server
  (65 tests, then the deploy).
- Then, on the page: Refresh status, Log in to Betfair, Read the markets for
  today, and at 08:00 UK paste the real 08:00 slip and Resolve. The build
  agent reads the stored catalogue and resolutions back from the bucket and
  reports the count of markets, the first and last off, one sample market
  with its runners, and the session state.
- The minimum instances ruling for step 2: zero (the session dies with the
  instance; an operator logs in again) or one with CPU always allocated (one
  standing session, an always-on instance).
- Whether the pages.dev addresses should go behind Access.

**Last did:** built step 2 and committed 0.6.0; before it, created the trigger
in europe-west2, ran the first deploy and verified it. All 2026-11-02.

**Found and reported, not acted on:**
- The pages.dev addresses serve the page without Access. The API refuses
  there too; the page holds no data for a stranger. Charles decides.
- Two platform defaults on the service that `cloudbuild.yaml` does not set:
  startup CPU boost, and a service-level maximum of 100 instances (the
  revision's maximum of 1 governs).
- FastAPI's test client warns that httpx is deprecated in favour of httpx2.
- `page_access_confirmed` in the stored settings stays false until Charles
  writes it true. `chimeracloud/fb13` is a public GitHub repository.
- CHI-PRO-003 versus Chimera_CBI_Corrections_For_CC.txt on the keys (Charles
  ruled for CHI-PRO-003); CHI-BRF-002 versus the admin shell (built as asked);
  the Python version (3.12 as ruled).

**Declined:** creating a Cloud Run job to run the first login from the CLI,
which would have been a new cloud resource created unasked; the operator's
click on the page does the same under his own hand. Nothing ran on Charles's
machine: files were parsed for syntax only.
