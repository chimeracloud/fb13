# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 1 of 5). **Written:** 2026-11-02,
about 02:20 UTC, by the build agent.

**State:** version 1 step 1 is pushed as 0.5.0 (bb4e8cc). The Pages build for
it is Charles's to report; it runs 94 tests and deploys the Pages Function.
The first settings version is in the config bucket with the two operators
Charles named. 0.5.1 is committed and not pushed: minimum instances zero until
step 2, and the notes brought up to date. **Blocked on the Cloud Build
trigger:** `gcloud builds triggers create github` for `chimeracloud/fb13`
answered `FAILED_PRECONDITION: Repository mapping does not exist`, and no
mapping for the repository exists in `chiops`, first or second generation, in
any region checked. The server is not deployed; the first build runs once the
trigger exists and a push touches `server/**` or `cloudbuild.yaml`, which
0.5.1 does.

**Waiting for (from Charles), since 2 November 2026:**
- The repository `chimeracloud/fb13` connected in Cloud Build, project
  `chiops`, the first-generation GitHub App route the other `-main` triggers
  use (Cloud Build, Triggers, region global, Connect repository). Then the
  build agent creates `fb13-main` at once.
- The Access team domain and the application's audience tag, for
  `cloudbuild.yaml`. The login redirect names the team `chimera-cape`;
  Charles confirms both values.
- The word to push 0.5.1.
- The Pages build result for bb4e8cc.

**Last did:** 0.5.1 committed; first settings version written; bb4e8cc pushed;
trigger creation attempted and refused. All 2026-11-02.

**Found and reported, not acted on:**
- `chimeracloud/fb13` is a public GitHub repository (`private=false`, read
  through gh on 2 November 2026). It holds no secret; Charles decides.
- Cloudflare Access covers fb13.chimerasportstrading.com since 2 November 2026
  (verified 02:02 UTC: redirect to the chimera-cape login). At 01:24 UTC it
  did not. `page_access_confirmed` in the stored settings stays false until
  Charles writes it true.
- CHI-PRO-003 and Chimera_CBI_Corrections_For_CC.txt assign the two Betfair
  keys opposite ways; Charles ruled for CHI-PRO-003 (the Delayed key).
  Betfair's documentation confirms a Delayed key places bets on the live
  exchange.
- CHI-BRF-002 says a First Build builds no admin endpoint set; the version 1
  prompt asks for the shell, so it is built.
- CHI-BRF-002 and CHI-BRF-004 disagree with each other and with Charles's
  ruling on the Python version; 3.12 built, as ruled.

**Declined:** enabling the Developer Connect API, which `gcloud` offered while
the build agent looked for a repository connection. Nothing was enabled or
changed. Nothing ran on Charles's machine: the Python and JavaScript files
were parsed for syntax only; the tests run in Cloud Build and in the Pages
build.
