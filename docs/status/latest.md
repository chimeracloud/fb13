# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 1 of 5). **Written:** 2026-11-02,
about 03:00 UTC, by the build agent.

**State:** version 1 step 1 is deployed. The server `fb13-trade-slip-api`
runs in europe-west2 at revision 00001 from commit 627ec3b (0.5.2): build
19b2dac4 by the trigger `fb13-main`, run once by hand at Charles's word, four
steps SUCCESS, 47 tests passed on Python 3.12.16. `/health` and `/ready`
answer 200; `/ready` says storage gcs, settings loaded, Access configured.
Every gated endpoint answers 401 without a token. Placing is disabled in the
stored settings. No Betfair login has been made. The page at 0.5.0 (bb4e8cc)
passed its Pages build and its Function refuses without a token; the builds
for 3125755 and 627ec3b are Charles's to report. 0.5.3 is committed locally,
not pushed: the trigger recorded, the first deploy recorded, and the wrong
statement of 0.5.1 corrected.

**Waiting for (from Charles), since 2 November 2026:**
- The word to push 0.5.3 (docs and version only; it does not rebuild the
  server).
- The Pages build results for 3125755 and 627ec3b.
- Whether the pages.dev addresses should go behind Access.
- The word to begin step 2 (read only: login and listMarketCatalogue), and,
  before its first login, the word for that login, after racing (CHI-BRF-002).

**Last did:** created `fb13-main` in europe-west2, ran it once, read the
deployed flags back, called `/health` and `/ready`, committed 0.5.3.
2026-11-02.

**Found and reported, not acted on:**
- The pages.dev addresses serve the page without Access (02:48 UTC,
  2 November). The API refuses there too; the page holds no data for a
  stranger. Charles decides.
- Two platform defaults on the service that `cloudbuild.yaml` does not set:
  startup CPU boost, and a service-level maximum of 100 instances (the
  revision's maximum of 1 governs).
- FastAPI's test client warns that httpx is deprecated in favour of httpx2.
  Tests pass.
- Cloudflare Access covers fb13.chimerasportstrading.com since 2 November 2026.
  `page_access_confirmed` in the stored settings stays false until Charles
  writes it true.
- `chimeracloud/fb13` is a public GitHub repository. Charles decides.
- CHI-PRO-003 and Chimera_CBI_Corrections_For_CC.txt assign the two Betfair
  keys opposite ways; Charles ruled for CHI-PRO-003 (the Delayed key).
- CHI-BRF-002 says a First Build builds no admin endpoint set; the version 1
  prompt asks for the shell, so it is built.
- CHI-BRF-002 and CHI-BRF-004 disagree with each other and with Charles's
  ruling on the Python version; 3.12 built, as ruled.
- Correction: 0.5.1 said no repository mapping existed in any region. The
  mapping existed, first generation, in europe-west2. Recorded in 0.5.3.

**Declined:** enabling the Developer Connect API, which gcloud offered during
the search for the connection. Nothing ran on Charles's machine.
