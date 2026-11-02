# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 1 of 5). **Written:** 2026-11-02,
about 02:00 UTC, by the build agent.

**State:** version 1 step 1 is built and committed on `main` as 0.5.0, not
pushed. The server shell exists in the repository: the stored settings (mode,
caps, kill switch, operators), the thirteen admin and observability endpoints
of CHI-POL-008 behind the Cloudflare Access token gate, the Pages Function
that carries `/api/*` from the page's hostname to the server, and the Cloud
Build pipeline that tests, builds and deploys it. It makes no Betfair call.
The cloud resources Charles approved exist: `fb13-sa`, the buckets
`chiops-fb13-config` and `chiops-fb13-orders`, the Artifact Registry
repository `fb13`, create-and-read bindings on the buckets, and read access
for `fb13-sa` on the five existing Betfair secrets. Nothing is deployed yet.

**Waiting for (from Charles), since 2 November 2026:**
- The word to push 0.5.0.
- The repository connected in Cloud Build, after which the build agent
  creates the trigger `fb13-main` with `--build-config`.
- The Cloudflare Access team domain and the application's audience tag, to go
  into `cloudbuild.yaml`. Until then the server refuses everything but
  `/health` and `/ready`.
- The operators' email addresses, to seed the first settings version. Until
  then nobody can sign in.
- Whether `httpx` 0.28.1 may stay as a test-only pin (FastAPI's test client
  needs it), and whether placing starting disabled is as he wants.
- The Pages build results for 7642519 (0.4.0) and fe159bf (0.4.1), still
  unreported.

**Last did:** version 1 step 1, 0.5.0, committed 2026-11-02. Before it, the
Step 0 message for version 1 (sent, answered the same day).

**Found and reported, not acted on:**
- Cloudflare Access was not covering fb13.chimerasportstrading.com at 01:24
  UTC on 2 November 2026: a plain request answered 200 with no login redirect.
- CHI-PRO-003 and Chimera_CBI_Corrections_For_CC.txt assign the two Betfair
  keys opposite ways; Charles ruled for CHI-PRO-003 (the Delayed key).
  Betfair's documentation confirms a Delayed key places bets on the live
  exchange.
- CHI-BRF-002 says a First Build builds no admin endpoint set; the version 1
  prompt asks for the shell, so it is built.
- CHI-BRF-002 and CHI-BRF-004 disagree with each other and with Charles's
  ruling on the Python version; 3.12 built, as ruled.

**Declined:** nothing. Nothing ran on Charles's machine: the Python and
JavaScript files were parsed for syntax only; the tests run in Cloud Build and
in the Pages build.
