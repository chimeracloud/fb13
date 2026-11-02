# Changelog

All notable changes to FB13. Dates are UK dates. Newest first.

## [0.7.2] — 2026-11-02 — a line without a Betfair cap says so

### Changed
- `server/app/orders.py`: a line with no Betfair cap (the six-cell slip layout
  of 2 November 2026 has no cap column) is built with no course cap, and the
  build carries `notes` with "no Betfair cap on this line (the six-cell slip
  layout carries none): no course cap applied", for the confirm panel of step
  4 to show, as Charles asked. 96 pytest. No order is built from a six-cell
  line until Charles confirms with Mark which price is the lay target.

## [0.7.1] — 2026-11-02 — Charles's rulings on step 3's choices

### Changed
- Charles's rulings of 2 November 2026 on the choices flagged in 0.7.0:
  approved the tick down, never up; a line placed once a day in a mode is
  never placed again; the day's money at risk counts every placed order,
  cancelled or not, and the £2 test order; nothing laid once the race has
  started; the caps stay at £5 an order and £10 a mode a day.
- **Minimum size £2.00 for any order**, whatever Betfair's currency table
  says (ruling 5). `server/app/orders.py` no longer reads betfairlightweight's
  currency table; a size below £2.00 is refused in words. At the slip's
  prices a recorded back stake of £2 gives a lay of £1.90, refused; £3 gives
  £2.86 with £2.15 at risk (ruling 7: about £3 for paper trials).
- **The Betfair cap stays an assumption** (ruling 2): kept as a cap on the
  lay's size for now, written in the README as an assumption with Claude
  Strategy's reading (a cap on the Betfair BACK stake at a course, the excess
  to bookmakers, so perhaps not applying to lays), confirmed at the handover
  with Mark. A lay refused for it now says so in the refusal.
- The page's server panel gains the kill switch and its inverse ("Kill
  switch: stop all placing" / "Resume placing"), so placing can be enabled
  for the test order and stopped after it without leaving the page.

### Recorded for Claude Strategy
- The reading of Mark's "Betfair cap" note differs between the build (a lay
  size cap, as an assumption) and Claude Strategy (a Betfair BACK stake cap).
  Settled at the handover with Mark.

## [0.7.0] — 2026-11-02 — version 1, step 3: the order builder, paper first; the test order

### Why
Charles's message of 2 November 2026, after the first login and catalogue
read succeeded: read the stored records back, keep the catalogue as a real
fixture, then Step 3, paper only, with one addition: a test order path that
cannot be mistaken for a bet. Real mode stays off; Charles writes the settings
version himself after this report and his go.

### Read back (part 1)
Three records in `gs://chiops-fb13-orders/betfair/2026-11-02/`: the failed
login of 05:53 (old code, no HTTP trail); the login of 06:41:27 UTC, one POST
to identitysso-cert.betfair.com/api/certlogin answered 200 in 129.5 ms;
listMarketCatalogue at 06:42:15 UTC, one POST to
api.betfair.com/exchange/betting/json-rpc/v1 answered 200 in 64.0 ms, 30 GB
WIN markets, 285 runners, first off 13:00 Plumpton, last off 20:30
Wolverhampton (Plumpton 7, Southwell 6, Wolverhampton 9, Chelmsford City 8).
Session logged_in. Nothing token-shaped in any record. The catalogue record is
kept as `server/tests/fixtures/catalogue-2026-11-02.json` with the operator's
address replaced by "operator".

### Added
- `server/app/orders.py`: the order from a slip line whose back leg is
  recorded: resolve the market and runner; LAY LIMIT at the lay target moved
  down to a valid Betfair tick; size = back stake x back price / lay price,
  down to the penny; liability size x (price - 1); persistence LAPSE;
  customerOrderRef `FB13-YYYYMMDD-HHMM-<12 hex of the line>`,
  customerStrategyRef `FB13-HHMM`; every refusal named (kill switch, mode,
  unresolved, race started, unreadable cells, outside the price ladder, below
  Betfair's minimum bet rule, above the slip's Betfair cap, above the
  per-order cap, above the per-day cap for the mode, line already placed). A
  Place must present the ticket of the build it confirmed; a different build
  is refused. Paper records the exact placeOrders body and sends nothing. Real
  sends it and records Betfair's report. Cancel is a separate call by
  reference. Records under `orders/<date>/` in the orders bucket: placed,
  refused, cancelled, place_failed, cancel_failed, test_order.
- The test order: one BACK of 2.00 at 1000, placeOrders, listCurrentOrders
  (seen, EXECUTABLE, nothing matched), cancelOrders, listCurrentOrders (gone),
  one record with the four steps and a verdict. Refused unless the stored mode
  is real, the kill switch is off, Access is confirmed, the session is logged
  in, the market is in today's catalogue and not started, the caps hold, and
  the operator typed exactly: "I confirm the real test order: back 2.00 at
  1000". Its references are FB13-TEST; it is never a line's order; its 2.00
  counts toward the real day's money at risk.
- `server/app/betfair.py`: placeOrders, cancelOrders, listCurrentOrders on
  the session, each recorded with its request, Betfair's answer and the HTTP
  trail; a session error marks the session expired. `order_calls` in the view
  and on `/status`.
- Endpoints: `POST /orders/build`, `POST /orders/place`, `POST /orders/cancel`,
  `GET /orders?date=`, `GET /orders/current?date=`, `POST /orders/test`.
- The page: the server panel's test-order controls (market and runner from
  the catalogue, the sentence typed, one button), enabled only when the
  stored mode is real. `src/orders.js` holds the same sentence.

### Choices made here, flagged for Charles
- The lay target moves down to the tick, never up.
- The slip's Betfair cap is read as the most that may be laid at that course
  in backer's stake (the order's size).
- A line placed once that day in that mode is never placed again, cancelled
  or not. The day's money at risk counts every placed order, cancelled or
  not, and the test order's 2.00.
- Betfair's minimum-bet rule is taken from betfairlightweight 2.24.0's
  currency table (GBP: minimum size 1, minimum payout 10); Betfair's own
  pages show the GBP minimum size as 1 in one version and 2 in another.
- Nothing is laid once the race has started.
- With the caps at 5.00 an order, a slip line at stake 50 is refused in paper
  too (liability 35.78 at 1.67/1.75); a paper trial needs a smaller recorded
  stake or a higher cap.

### Tests
- `server/tests/test_orders.py` (17), the resolver against the real
  catalogue (5: every one of the 30 markets resolves from its own time, venue
  and first runner; misses are flagged with the candidates; "Chelmsford" for
  "Chelmsford City" is flagged, a known risk until a real slip shows the
  course names), the session's order calls (1), the endpoints (4). 95 pytest.
- `src/orders.test.js` (4). 109 vitest.

### Not changed
- No order of any kind was sent. Real mode stays off until Charles writes the
  settings version. The page's Place button per line is step 4.
- `docs/betfair-master/` (betfairlightweight 2.24.0, put there by Charles for
  the build agent to read) is ignored by git and never committed.
## [0.6.7] — 2026-11-02 — the 0.6.6 Pages build failed too: three more tests

### Fixed
- The Pages build of f4c534b (0.6.6) failed at `npm test` as well. Read from
  the tests themselves, since Cloudflare's log is not open to the build agent:
  three export tests compare whole CSV rows as literals, and 0.6.5 appended
  nine columns to every row; and the six-column header rule of 0.6.5 caught
  the old test for a seven-cell table missing a column, because that header
  has six known names. The literals now carry the nine columns; a six-column
  header is read as the six-cell layout only when it names at least one column
  the seven-cell layout does not have. `src/parse.js` and the tests; the page's
  reading of the real six-cell paste is unchanged. 0.6.5 and 0.6.6 never went
  live; the page stayed at 0.6.4. Page only.

## [0.6.6] — 2026-11-02 — the 0.6.5 Pages build failed on a test

### Fixed
- The Pages build of a9abada (0.6.5) failed at `npm test`: the new export test
  split a CSV row on commas, and the six-cell decision cell holds commas inside
  its quotes, so every later column was misplaced. The test now splits the row
  as a CSV reader would (quoted fields, doubled quotes). The page's code is
  unchanged; 0.6.5 never went live, the page stayed at 0.6.4. Page only.

## [0.6.5] — 2026-11-02 — the six-cell layout of the 08:00 slip

### Why
The 08:00 slip email of 2 November 2026 has a new layout. The page (0.6.4)
refused all 22 rows with "6 cells, expected 7 on one line or 5 then an API
line of 3": correct, nothing dropped or guessed. Charles sent the real
diagnostics (text/plain 2193 characters, tab separated, one line per row,
six cells; the HTML table, 91976 characters, has six cells per row) and asked
for the layout to be read alongside the old one. Page only, on top of
ca06459, so it can be pushed alone and touches nothing under `server/**`.

### Added
- `src/parse.js`: the six-cell layout. Race | Horse | Price A | Price B |
  Decision | Button, by position, from tab-separated text (six cells on one
  line) and from an HTML table (rows of six cells; a six-column header naming
  race and horse is kept out of the rows and shown in the note). Every cell
  verbatim. From the decision cell, beside it and never in its place: In or
  Out; where the reason names them, the Betfair price, the next price and the
  best bookmaker price (null when it says null). A reason in another shape
  gives the decision alone, with the note "prices not named in the reason;
  none extracted" (the seven Out rows of the real slip; fifteen rows are In). A cell that does not
  start with In or Out and a middle dot is flagged and the row shown raw,
  never guessed. Each line and each parse carry `layout`: seven, six, mixed.
  The seven-cell layout reads exactly as before.
- The line card shows a six-cell line as Price A, Price B, Decision, Button,
  "Betfair cap: none in this layout", and the extracted decision in words.
- `src/export.js`: nine columns appended to the CSV (layout, the four cells,
  what was extracted) so every earlier column keeps its place; the JSON embeds
  the whole line as before.
- `src/fixtures/real-2026-11-02-0740-slip-0800.js`: the 22 real rows from
  the diagnostics, 2193 characters to the character. The HTML was not in the
  message; the HTML test builds a six-cell table from the real rows.
- Tests: 6 for the layout, 1 for the export; 112 vitest.

### Not decided here
- What Price A and Price B mean. Charles's reading (A about 3 to 4 percent
  under the Betfair price, probably the lay target; B the next favourite's
  price) is confirmed with Mark. No order is built from a six-cell line until
  then; when confirmed as read, the order builder would take Price A as the
  lay target and Price B not at all, with no course cap, and the confirm
  panel would say the cap is absent.

## [0.6.4] — 2026-11-02 — the 0.6.3 build failed: record order within a millisecond

### Why
The Cloud Build run of 0.6.3 (4944dd11) failed at the test step, 3 failed and
64 passed, so nothing was built or deployed; the live server stayed at 0.6.1
in the failed state. The two new tests passed. The three that failed:
- `test_a_failed_login_latches_and_is_never_retried`: the test's fake client
  wrote the raw error into the fake HTTP trail, token and all, where the real
  `RecordingSession` redacts it. Test only; the fake now redacts as the real
  one does.
- `test_markets_asks_for_the_days_gb_and_ie_win_markets_and_records_it` and
  `test_logout_gives_the_session_back`: the records came back in the wrong
  order. Object names are `{prefix}{ms:013d}-{8 hex}.json`, and two objects
  written in the same millisecond were ordered by the hex, which is no order
  at all. The tests had passed by luck in the three builds before. This is not
  a test problem: on the live server a settings version or a Betfair record
  written in the same millisecond as the one before could sort before it, and
  "newest wins" would pick the wrong one.

### Fixed
- `server/app/storage.py`: a clock-named object from this process always
  takes a later millisecond than the one before it (a lock and the last
  millisecond handed out). The service runs one instance, so the order of
  names is the order of writes. An explicit `t_ms` is used as given.
- `server/tests/test_storage.py`: with the clock frozen, three names in a row
  take three successive milliseconds and a store lists them in the order
  written. 68 pytest cases.

### Not changed
- Nothing else from 0.6.3. No login attempted; the live server's failed state
  stands until this deploys and Charles clears it.

## [0.6.3] — 2026-11-02 — the first login's failure: cause, record, and the error's path

### Why
The first Betfair login, Charles's click on the page at 05:53 UTC on
2 November 2026, failed. The server panel said "Betfair session login failed,
not retried: APIError: None Params: None Exception: unhashable type: 'list'",
then "The server could not do it: The origin web server returned an invalid or
incomplete response to Cloudflare." Charles asked for the cause from the Cloud
Run logs and the orders bucket, whether any request reached Betfair, why the
page showed Cloudflare's words and not the server's JSON, a fix for all three,
and a test that fails on the old behaviour. No login was attempted by the
build agent.

### Found
1. **Cause.** `default_client_factory` passed the certificate and key to
   betfairlightweight as `list(cert_files)`. betfairlightweight hands
   `cert_files` to the requests library unchanged as `cert=`; requests 2.34.2
   (the version the image build installed, from the build log) unpacks only a
   tuple and otherwise puts the value into the key of its connection pool,
   which must be hashable. A list is not: `TypeError: unhashable type: 'list'`
   inside the client, wrapped by betfairlightweight as `APIError`. Charles's
   guess was right; the point of failure is requests' connection-pool key, so
   it happened before any connection to Betfair existed.
2. **Nothing reached Betfair.** The one stored record,
   `betfair/2026-11-02/1793598819237-ed8cf86a.json`, is the login, FAILED,
   with that error, no HTTP status and no Betfair response; the Cloud Run log
   shows the one POST, 1.76 s (the five Secret Manager reads and the local
   failure), answered 502 with a 216-byte JSON body. The exception is raised
   where the pool is keyed, before a socket; no bytes left the server. The
   record could not say so on its own, which is fixed below.
3. **Cloudflare's words.** The server answered a clean 502 JSON (Cloud Run
   log). The Pages Function passed the 502 on. Cloudflare replaces an origin's
   502 or 504 with its own error page (its documentation: "Cloudflare returns
   a Cloudflare-branded HTTP 502 or 504 error when your origin web server
   responds with a standard HTTP 502 bad gateway or 504 gateway timeout
   error"), and for a request that asked for JSON that page is JSON with
   `status`, `detail` and `error_name: origin_bad_gateway`. The page's helper
   took that `detail` as the server's.

### Fixed
- `server/app/betfair.py`: the certificate pair goes as a tuple. Every record
  under `betfair/<UTC date>/` now carries `http`: the trail of every send the
  requests library attempted for that call (method, URL without its query,
  status and time, or the error where no response came), from a
  `RecordingSession` the client is built with; `null` where a client's session
  keeps no trail. Never a body, never a header. A failed call to Betfair is
  answered 424 (failed dependency), never 502.
- `functions/api/[[path]].js`: no 502 or 504 leaves the Function. A failure
  to reach the server is 503 in words; a 502 or 504 from Cloud Run's front
  door is 503 with the upstream status named and its first 200 characters.
- `src/api.js`: 424 shows the server's sentence as it is; any status without
  its own sentence shows its number first, so a body that is not the server's
  is seen for what it is.

### Tests
- `server/tests/test_betfair.py`: `default_client_factory` gives the client a
  tuple and a `RecordingSession`, and the exact requests call that failed,
  `get_connection_with_tls_context` (keys a pool, never connects), succeeds
  with the tuple and raises `TypeError: unhashable` with the list, so the test
  fails on the old code. The `RecordingSession` keeps the trail of a send that
  answered and of one that raised, and never a token, username, password or
  key. The login records carry the trail. 67 pytest cases.
- `src/pages-function.test.js`: 503, never 502, when the server does not
  answer; a 502 or 504 from upstream becomes 503 with the status named; 424
  passes through. `src/api.test.js`: 424 and Cloudflare's 502 body. 105
  vitest cases.

### Not changed
- No login attempted. The failed state stands on the live server until
  Charles clears it (`betfair-reset`) and logs in once, after the deploy of
  this commit replaces the instance.
- `requests` is not pinned: it arrives as a dependency of betfairlightweight
  and google-cloud-storage, 2.34.2 in the last build. The tuple is right for
  every version; a pin is for Charles to approve if he wants one.

## [0.6.2] — 2026-11-02 — three texts off the page

### Removed
- From the page, at Charles's ask of 2 November 2026, page only: the banner
  "This page records what a person did elsewhere. It places nothing."; the
  export section's "Worksheet, not yet the record. This browser is the only
  store, and the export is the only way out."; the footer's "Worksheet, not
  yet the record. Everything stays in this browser on this device, and nothing
  is sent anywhere. An entry is never edited or deleted: a correction is a new
  entry, and the history stays." The footer keeps the build line and the tag.
  The server panel keeps the mode and the placing status. No test asserted
  these texts, so none was removed; 104 vitest cases as before.
- `src/styles.css`: the `.export .worksheet` rule, which nothing used after
  the paragraph went.

### Not changed
- `server/**` and `cloudbuild.yaml`: untouched, so the trigger does not run
  and the server and its Betfair session are not redeployed.
- The notice inside the exported JSON file (`NOTICE` in `src/export.js`, a
  different text, in the file and not on the page) and its test. Left for
  Charles to rule on.
- README line 11, the README's own statement of what version 0 does.

## [0.6.1] — 2026-11-02 — one instance, always on

### Changed
- `cloudbuild.yaml`: `--min-instances=1`, `--max-instances=1`,
  `--no-cpu-throttling`. Charles's ruling at step 2, 2 November 2026: one
  standing Betfair session, kept alive by the keepAlive loop, which needs CPU
  between requests; the cost of an always-on instance accepted. The server
  deployed from this commit is the one Charles logs in against.

## [0.6.0] — 2026-11-02 — version 1, step 2: read only

### Why
Charles's word of 2 November 2026 for the first Betfair login, before racing,
with his rules: the Delayed key only; log in once with the certificate, keep
the session with keepAlive, never loop on a failure; read only,
listMarketCatalogue for today's GB and IE win markets; no order call; then the
resolver, tested at 08:00 UK on the real 08:00 slip.

### Added
- `server/app/betfair.py`: the session. Login once with the certificate on the
  Delayed key, at an operator's ask; keepAlive every fifteen minutes while
  logged in; a failed login latches as "failed" with the error in words and is
  never retried until an operator resets it; a failed keepAlive latches as
  "expired". listMarketCatalogue for one London day: event type 7, GB and IE,
  WIN, first to start, EVENT, MARKET_START_TIME, RUNNER_DESCRIPTION, at most
  200 markets, cached ten minutes. Every request and response recorded
  append-only under `betfair/<UTC date>/` in the orders bucket, never a
  secret, token-shaped runs redacted from errors. The certificate and key live
  in a private in-memory directory for the login call only.
- `server/app/resolver.py`: a slip line to a market and a runner, pure. Time
  and course from "13:40 Cork"; UK clock to UTC; venue and runner matched
  exactly after case and spacing; one market and one runner or a flag with the
  reason and the candidates. Resolutions stored under `resolutions/<date>/`.
- Endpoints: `betfair-login`, `betfair-logout`, `betfair-reset` as control
  actions; `GET /betfair/markets?date=`; `POST /resolve`. `/ready` carries the
  session state; `/admin/status`, `/info` and `/status` carry the session view.
  At instance stop a live session is logged out.
- The page: a server panel above the lines (status, log in, log out, clear,
  read the markets, resolve the lines on this page) and a chip on each line
  with its market and runner or the reason it did not resolve. `src/api.js`
  and `src/resolve.js`, pure.
- Tests: 18 more pytest cases (the session's one-login rule, the latch, the
  redaction, the certificate files removed, the catalogue request's filter and
  record, keepAlive expiry, logout; the resolver's parsing, clock and flags on
  real slip cells; the API end to end with a test double for the client) and 9
  more vitest cases. 65 pytest cases and 104 vitest cases in all. The
  resolver's matching against real markets is tested once the first real
  catalogue is stored and kept as a fixture: no invented markets.
- `server/Dockerfile`: the build proves `Europe/London` is known to the image.

### How the first login happens
The server's endpoints answer only to an operator through the page, and
Betfair blocks this machine, so the build agent cannot log in from here. The
operator's click on "Log in to Betfair" is the login; the catalogue read and
the resolutions are stored in the orders bucket, where the build agent reads
them back to report. Nothing logs in by itself.

### Not changed, for Charles
- Minimum instances stay at zero. The session dies with the instance when
  Cloud Run scales it away, and the next instance starts logged out. One
  standing session needs minimum one and CPU always allocated, which costs an
  always-on instance; Charles's call at step 2, as he said.

## [0.5.3] — 2026-11-02 — the trigger, the first deploy, and a correction

### Correction
- 0.5.1's README and CHANGELOG said no repository mapping for
  `chimeracloud/fb13` existed in `chiops` in any region. Wrong. The Cloud
  Build audit log shows Charles connected the repository at 01:20:00 UTC on
  2 November to the first-generation GitHub App installation in region
  europe-west2 (installation 117056298, repositories fsu1e and fb13). The
  build agent's create at 02:04 UTC ran in region global, where that
  installation has no mapping, and failed. The build agent had no read path
  for first-generation mappings and said more than it knew.

### Done in the cloud, 2 November 2026
- Trigger `fb13-main` created in region europe-west2 with
  `--build-config=cloudbuild.yaml`, branch `^main$`, filtered to `server/**`
  and `cloudbuild.yaml`, on the default compute service account. Id
  `2e7dd541-4aff-413a-b175-4e1ea52ea1be`.
- Run once by hand on main at Charles's word: build 19b2dac4 at 627ec3b,
  70 seconds, all four steps SUCCESS. Python 3.12.16; "47 passed". Image
  `europe-west2-docker.pkg.dev/chiops/fb13/fb13-trade-slip-api:627ec3b`.
  Cloud Run service `fb13-trade-slip-api`, revision
  `fb13-trade-slip-api-00001-zv6`, ready.
- Read back against `cloudbuild.yaml`: service account, image, the six
  environment variables, cpu 1, memory 512Mi, concurrency 20, timeout 600,
  port 8080, maximum 1 instance, minimum 0, ingress all, invoker IAM check
  off with no IAM binding on the service, labels app=fb13 and unit=fb13: all
  as the file. Two things on the service the file does not set, both platform
  defaults: startup CPU boost on the revision, and a service-level maximum of
  100 instances, which the revision's maximum of 1 governs. Recorded, not
  changed.
- `GET /health`: `{"ok":true,"service":"fb13-trade-slip-api","version":"0.5.2"}`.
  `GET /ready`: ready true, storage gcs, settings loaded at 02:23:33 UTC with
  no error, access configured true. `GET /admin/status` without a token: 401
  "no Access token". No Betfair login. Placing not enabled.
- The Pages build for bb4e8cc passed (Charles's screenshot). The Pages
  Function answers 401 without a token on every address.

### Recorded for Charles, not acted on
- The pages.dev addresses serve the page without Access; the API refuses there
  too and the page holds no data for a stranger. README, Known risks.
- FastAPI 0.150.0's test client warns that `httpx` with `starlette.testclient`
  is deprecated in favour of `httpx2`. The tests pass. A later pin change,
  with Charles.

### Changed
- README: the trigger row corrected and completed; the service row; the
  platform defaults; the pages.dev risk; the Access values deployed.
- `package.json` to 0.5.3. The page is unchanged.

## [0.5.2] — 2026-11-02 — the Access values

### Changed
- `cloudbuild.yaml`: `_CF_ACCESS_TEAM_DOMAIN` is
  `chimera-cape.cloudflareaccess.com` and `_CF_ACCESS_AUD` is
  `3f42e55e9c5fa60795f282b1777bf1f77f3a5755dbc67db86da6eef0e0ccfac9`, from
  Charles's message of 2 November 2026, matching what the page's login redirect
  showed from Cape Town that day. Neither is a secret. The server will accept
  only a token issued by that team for that application.
- README: the values are set; the risk note reads accordingly.

## [0.5.1] — 2026-11-02 — minimum instances zero; the first settings version

### Changed
- `cloudbuild.yaml`: `--min-instances=0`. Charles, 2 November 2026: maximum
  one instance, minimum zero until step 2, when it is revisited. Maximum stays
  one so an order can never be built twice by two instances.
- README: Access covers the page since 2 November (Charles checked; a plain
  request from Cape Town at 02:02 UTC was redirected to the chimera-cape
  team's login); the first settings version exists; the Pages builds for
  0.4.0 and 0.4.1 passed and 0.4.1 is live; the trigger is not yet created.

### Done in the cloud, 2 November 2026
- Trigger `fb13-main`: creation attempted after bb4e8cc was pushed (so that
  push could fire no build with the old minimum) and refused:
  `FAILED_PRECONDITION: Repository mapping does not exist`. No mapping for
  `chimeracloud/fb13` exists in `chiops`, first or second generation, in any
  region checked; every existing trigger uses the first-generation GitHub App
  mapping. Waits for the repository to be connected, then created with
  `--build-config=cloudbuild.yaml`, branch `^main$`, filtered to `server/**`
  and `cloudbuild.yaml`, on the default compute service account. Nothing was
  enabled or changed in the project while looking.
- The first settings version written by hand to
  `gs://chiops-fb13-config/settings/v/`: paper, placing disabled, page access
  not confirmed, the default caps, operators charles@chimerasportstrading.com
  and cloud@chimerasportstrading.com, at Charles's word. `page_access_confirmed`
  left false: Charles's word changes it.

### Approved by Charles, 2 November 2026
- The four decisions of 0.5.0 (placing starts disabled; create-and-read bucket
  roles; httpx test-only; one instance at most), with the minimum changed to
  zero.

## [0.5.0] — 2026-11-02 — version 1, step 1: the server shell

### Why
Charles's prompt of 1 November 2026 adds a small server to FB13 that will
build, place, cancel and check Betfair orders behind a Place button on each
line, paper by default. Step 1 is the shell: the settings, the caps, the kill
switch and the admin endpoint set, deployed and verified before any Betfair
call (CHI-POL-008, shell first). This commit makes no Betfair call.

### Added
- `server/`: a FastAPI service for Cloud Run in europe-west2, Python 3.12,
  with the thirteen endpoints of CHI-POL-008 (18 September 2026 amendment):
  the Set 1 admin endpoints, `/admin/incidents` as an empty-list stub, and the
  five observability endpoints. Structured JSON logs with severity,
  service_name and trace_id. Pydantic v2 bodies with `extra="forbid"`.
- The stored settings (`server/app/settings.py`): mode, `page_access_confirmed`,
  `placing_enabled`, the two caps, the operators. One create-only object per
  change in `gs://chiops-fb13-config/settings/v/`, newest in force, re-read
  every five seconds; the stored value governs. `mode` and
  `page_access_confirmed` have no API path. Defaults: paper, not confirmed,
  placing disabled, £5 at risk an order, £10 a mode a London day, no operators.
- The kill switch: `POST /admin/control/kill` and `/resume`, stored before
  applied, always recorded, even when pressed twice.
- The gate (`server/app/access.py`): the Cloudflare Access token on every
  request, verified against the team's keys, issuer, audience and expiry, then
  the operator list. 401, 503 or 403; `/health` and `/ready` open.
- The activity log (`server/app/activity.py`): append-only objects under
  `activity/<date>/`, a ring in memory, server-sent events on `/admin/events`,
  the newest fifty reloaded at start.
- `server/app/credentials.py`: `get_credential(name)` per CHI-POL-040, reading
  Secret Manager behind one interface. Five logical names, no value read.
- `server/app/storage.py`: create-only JSON objects (`if_generation_match=0`),
  with a memory store for tests. The service account cannot delete or
  overwrite in any case.
- `functions/api/[[path]].js`: the Pages Function that forwards
  `fb13.chimerasportstrading.com/api/*` to the Cloud Run service with the
  `Cf-Access-Jwt-Assertion` header, and refuses a request without one.
- `cloudbuild.yaml`: test on Python 3.12, build, push to
  `europe-west2-docker.pkg.dev/chiops/fb13`, deploy with every flag (one
  instance, 512 MiB, invoker check off, the two buckets, the Access values as
  substitutions). `server/Dockerfile`, `.dockerignore`.
- Tests: 47 pytest cases (version, storage, settings, access, activity, the
  app end to end with a signed test token) run by Cloud Build before the image
  is built; 8 vitest cases for the Pages Function, run by the Pages build. 94
  vitest cases in all.
- Cloud resources, created 2 November 2026 at Charles's approval: `fb13-sa`,
  `chiops-fb13-config`, `chiops-fb13-orders`, the Artifact Registry
  repository `fb13`, create-and-read bindings on the buckets, and
  `secretAccessor` for `fb13-sa` on `betfair-app-key-delayed`,
  `betfair-cert-pem`, `betfair-key-pem`, `betfair-username`,
  `betfair-password`. Nothing else changed on those secrets.

### Changed
- `package.json` to 0.5.0; the server reads its version from it at build time.
- `.gitignore`: Python caches.
- README: version 1 sections. The page is unchanged in behaviour.

### Decided by Charles, 2 November 2026
- Hostname and auth: the Pages Function route; the server verifies issuer and
  audience and accepts only emails on the stored operator list; Cloud Run open
  at IAM level because the token is the gate.
- Python 3.12. betfairlightweight 2.24.0 and the other pins approved.
- The DELAYED key for all REST work. Checked against Betfair's Application
  Keys page the same day: "Bet Placement (Live Exchange): Yes" for the Delayed
  key; it "operates on the live (production) Betfair Exchange". Not a stop.
- Caps on money at risk: stake for a back, liability for a lay; £5 an order,
  £10 a mode a London day; both modes, counted separately.
- The Place button (step 4) builds a LAY limit order at the slip's lay target
  moved to a valid tick, size = back stake × back price ÷ lay price, enabled
  only once the line's back leg is recorded as Placed; the confirm panel shows
  lay stake and liability; persistence LAPSE; the slip's Betfair cap per course
  respected; one order per line.
- First login: ask first; after racing; not the Live key unless he says so.
- Names approved; no new secrets; the five existing ones granted to fb13-sa.

### Decided by the build agent, open to Charles's reversal
- Placing starts disabled (`placing_enabled: false`) until an operator
  resumes: the FB13 form of `auto_start = FALSE`.
- Bucket roles are objectCreator and objectViewer rather than the objectAdmin
  proposed at step 0, so the service account cannot delete or overwrite.
- httpx 0.28.1 added as a test-only pin: FastAPI's test client needs it. Not
  in the image.
- One instance, minimum and maximum: one Betfair session from step 2, and an
  order can never be built twice by two instances. Costs an always-on instance.

### Recorded for Claude Strategy, not acted on
- CHI-PRO-003 (24 August 2026) assigns the Live key to the stream and the
  Delayed key to orders and account calls. Chimera_CBI_Corrections_For_CC.txt,
  as summarised in the version 1 prompt, assigned them the other way round.
  Charles ruled for CHI-PRO-003 on 2 November 2026. The Corrections document
  is not in the Bible clone.
- CHI-BRF-002 says a First Build builds no admin endpoint set. The version 1
  prompt asks for the admin shell at step 1; it is built to CHI-POL-008.
- CHI-BRF-002 says Python "3.13. NOT 3.14" and `python:3.12-slim` in the same
  row; CHI-BRF-004 says `python:3.13-slim`. Charles ruled 3.12, the fleet
  standard and what the CHI-BRF-004 amendment will say.
- Cloudflare Access was not covering fb13.chimerasportstrading.com at 01:24 UTC
  on 2 November 2026: a plain request answered 200 with no login redirect.
- Betfair's note that a Live key with no wagering activity can be deactivated:
  recorded in the README, nothing done.
- Interim structures (CHI-POL-043): Secret Manager read directly behind
  `get_credential` (CHI-POL-040 §6); `/admin/incidents` as a stub; the Access
  token gate in the unit itself.

## [0.4.1] — 2026-11-02 — the version and the commit on the page

### Why
Three real pastes in a row left one question open: which version was live
when the paste was made. Now the page and the paste both say.

### Added
- `src/build.js`: the version from `package.json`, and the short commit hash
  Cloudflare Pages hands every build as `CF_PAGES_COMMIT_SHA`, stamped in by
  `vite.config.js` through Vite's `define`. Nothing to set in Pages. Outside a
  Pages build the hash is empty and the page says "no commit hash" rather than
  inventing one.
- The footer: "FB13 trade slip, version 0.4.1, commit 7642519."
- The diagnostics carry the build that took the paste. The first line of the
  copied text reads "FB13 paste diagnostics, version 0.4.1, commit 7642519",
  and the panel's first line says the same after the time and the source.
  Diagnostics kept in the browser from an earlier version say "build not
  recorded".
- Tests, five: the version matches `package.json`, the hash is seven hex
  characters or empty, the label in words; the diagnostics' first line with a
  build, without a hash, and from before the build was recorded.

## [0.4.0] — 2026-11-02 — export (step 4)

### Added
- `src/export.js`: every entry as CSV and as JSON, each row carrying the date,
  the slot and the mode. The CSV is UTF-8 with a byte order mark, so a
  spreadsheet reads the £ and the ⚠, quoted per RFC 4180 with CRLF between
  rows; its columns in reading order: date, slot, race, horse, kind, mode,
  where, where kind, side, price, stake, BOG, the time placed, how, reference,
  recorded at (UK time and UTC), the other five cells of the line, the line's
  flag, the entry id and the line id. A not placed entry carries no mode,
  because none was stated. The JSON carries the page name, its version, the
  time of export (UTC and UK), the worksheet notice, the count, and each entry
  with its whole line embedded. The file is made in the browser and saved to
  the device through an anchor with a download name, by an object URL or,
  where a browser has none, a data URL. Nothing is sent anywhere.
- The page: an Export section at the foot with Export CSV and Export JSON, the
  count of entries, and the worksheet notice beside the buttons. Both buttons
  are disabled until there is an entry. The filename carries the UK date and
  time of the export, `fb13-entries-YYYY-MM-DD-HHMM.csv` or `.json`. The
  section says what was saved, or that the browser refused.
- Tests, eleven: CSV quoting (comma, quote, line break, CRLF, empty, missing,
  a number); the header; a placed entry and a not placed entry on the real
  Dove Tale and No Hard Feelings rows field by field, with the Betfair cell's
  line break kept inside quotes and the empty mode on not placed; an edit
  following the entry it corrects; an entry whose line is not on the page,
  flagged; the header alone with no entries; the JSON object and its
  round trip, the missing line as null; the filename in UK time either side
  of the clock change; and the download helper against a fake document.

### Step 5
- Tests have been written alongside each step from the real fixtures and run
  in every Pages build before `vite build`. 81 in all with this version.

## [0.3.3] — 2026-11-02 — the third real paste as a fixture

### Tests
- The text of the third real paste (1 November 2026, 22:42 UK, same browser,
  the 08:00 slip: Curragh, Huntingdon, Cork, Carlisle, Worcester) kept to the
  character (2,305) and read: 28 selections, none flagged, nothing in the
  note, 07:52 API on every line; West Away's Betfair cell "2.90 ⚠ check" kept
  with its line break and marked for a look, the only such row; Choctaw Nation
  and Thread Of Gold cell by cell; the codes BY, CE; B3, BetMGM; Betano, BTT;
  WH; the real Safari markup of its first row read by position.

### Recorded
- The first real browser copy of the 08:00 slip. The same shape as the 10:00
  slip's: no header row in the HTML table, tab separated text, five cells then
  an API line of three. No new bookmaker code in it.

## [0.3.2] — 2026-10-30 — the second real paste as a fixture

### Tests
- The text of the second real paste (15:48 UK, same browser, a different
  day's 10:00 slip: Bath, Punchestown, Stratford, Ffos Las, Southwell) kept to
  the character (1,889) and read: 22 selections, none flagged, nothing in the
  note; codes with a space inside kept as written and split only on the comma
  (LiveScore Bet, Virgin Bet; B3, LiveScore Bet; FB, PP); the two word course
  Ffos Las; Passage Guenot and Sevenkingsmustdie cell by cell; the real Safari
  markup of its first row read by position.

### Recorded
- New bookmaker codes in real data: PP, LiveScore Bet, Virgin Bet. Shown as
  they arrive, not decoded.

## [0.3.1] — 2026-10-30 — parsers for the real browser copy (B)

Checked against the real paste of 15:13 UK on 30 October 2026 (Gmail in Safari
27.2 on a Mac, the 10:00 slip), read from the "What was pasted" diagnostics:
text/html of 148,852 characters and text/plain of 2,776. The HTML table had no
header row, which is why 0.2.0 found no table and fell back to the text. The
text was tab separated, five cells then an API line of three, exactly the shape
assumed here. That text is kept as a fixture, to the character.

### Changed
- HTML path: a header row is used when present, as before. Without one, the
  table with the most rows of exactly seven cells is read and the cells are
  mapped by position: Race, Horse, Best price, Best BOG, Betfair, Lay target,
  Betfair cap. A row of another length is flagged "N cells, expected 7". A
  seven cell row whose first cell is not a race time (most likely a header
  row with other names) is flagged, not read as a bet. Line breaks inside a
  cell, whether `<br>` or block elements, are kept. Each result says how it
  was mapped (header or position).
- Plain text path with tabs: cells split on tabs; trailing empty cells from a
  trailing tab are dropped; a line whose first cell is a time and a course
  starts a row; five cells then an API line of three are joined, with the
  Betfair cell carrying its line break; seven cells on one line are a complete
  row; anything else is flagged with the counts seen and shown with the tabs
  as " | ". Asterisks round the horse or the lay target are optional. Header
  and rules lines become the note.
- Plain text path without tabs: unchanged, the email's own form with the
  horse between asterisks. Without tabs and without asterisks nothing is
  guessed: flagged "first line did not read" and shown.
- Any HH:MM before "API" was already accepted; now tested with 09:52.

### Tests
- Seventeen more: seven cells by position reading the same cells as the
  header, the header still preferred, a line break inside a cell written as
  divs, a six cell row flagged, a header with other names not read as a bet,
  the seven cell table inside a layout table, null without either; the two
  real lines tab separated, with and without asterisks, several selections
  including the no price read and check rows with the new code UN, seven
  cells on one line, a first line with no API line flagged, a pair with the
  counts off flagged, a trailing tab; and without tabs the asterisk form
  still read, 09:52 accepted, and the two real lines flagged and shown.
- From the real paste: the fixture is the diagnostics' text to the character
  (2,776); all 34 selections read with none flagged and nothing in the note;
  Dove Tale, Ash Hobbs (codes 10bet and Betano, course Down Royal), No Hard
  Feelings and October Hill (no price read), Wearing Stars (the check, codes
  10bet and B3), Pequenita, Serenity Blue cell by cell; the real Safari table
  markup of the first row, with its no-break spaces and the line break, read
  by position; and the HTML taken first when both types arrive.

### Recorded
- A second new bookmaker code in real data, 10bet. Shown as it arrives.

## [0.3.0] — 2026-10-30 — placed and not placed, the form, counters, history (step 3)

### Added
- `src/entries.js`: the placed form's defaults (mode paper, stake 50, time now
  in Europe/London, BOG unknown, nothing else chosen), its checks (where, side,
  a numeric price and how are required; a bookmaker name when where is Other;
  a numeric stake; HH:MM time; paper or real), entries as append-only records
  carrying the line, slot, date, the UTC instant and the UK time, and the
  counters (lines, placed, waiting, not placed, flagged) read from each line's
  latest entry.
- The page: four counters at the top; Placed and Not placed on every line,
  flagged lines included; the Placed form inline under the line with
  thumb-sized choices for where (Betfair, each code on that line as written,
  Other with a box for the name), side, BOG, how and mode, with real shown in
  red; a status chip and a PAPER or REAL chip on each line; the line's history
  under it, newest first, each entry with the UK time it was recorded; the
  footer now says an entry is never edited or deleted.
- Tests: the where options from the real Dove Tale and No Hard Feelings rows,
  the form's opening state, what it refuses to save, a complete entry field by
  field, a code kept as written, Other named, not placed, an edit kept as a
  second entry with the latest deciding the state, and the counters.

### Not yet
- Export (step 4).

## [0.2.1] — 2026-10-30 — diagnostics: what was pasted

### Why
The first real paste, from Gmail on Charles's Mac, read 34 lines as plain
text and every one was flagged "first line did not read". Nothing was dropped
or guessed. Unknown whether the clipboard held no usable table HTML or the
parser did not find the table; the real plain text has no asterisks round the
horse and reads "09:52 API" on the 10:00 slip, and its cells are probably tab
separated. Charles's ruling: read the real shape before changing the parser.

### Added
- `src/diagnostics.js` and a collapsed "What was pasted" section under the
  paste box, always present: each clipboard type received and its length, the
  text/plain with tabs as →, carriage returns as ␍ and line feeds as ¶, the
  first 4000 characters of the text/html as escaped text (never rendered), the
  user agent, the source (paste event or Read box), and a Copy diagnostics
  button with a read-only text box as the fallback. Kept in the browser with
  the lines. No network.
- Tests: the whitespace marks, the type list and lengths, the 4000 character
  cut, a paste with no types, and the plain text form of the whole thing.

### Recorded
- A new bookmaker code, UN, appears in real data. Shown as it arrives, not
  decoded, like the others.
- The API time varies by slot: 09:52 on the 10:00 slip, 08:52 on the 09:00.
  Both parsers already accept any HH:MM before "API".

## [0.2.0] — 2026-10-30 — paste, parse and show the lines (step 2)

### Added
- `src/parse.js`. The HTML path: finds the slip table (including inside a mail
  client's layout table), maps the seven columns by header text so order does
  not matter, keeps every cell as the text that arrived with `<br>` kept as a
  line break, flags a row with the wrong number of cells or a table missing a
  header and shows it raw, keeps everything outside the table as a note. The
  plain text path: a line starting with a time and a course starts a row, the
  line starting with "07:52 API" completes it, the pair is joined; a row with
  no second line or an unreadable first line is shown raw and flagged; header
  and lay rules text become the note. Bookmaker codes are split only to offer
  them in the "where" field; the cell itself stays verbatim.
- `src/storage.js`: browser storage under one key, every read and write in
  try/catch, the page tells the person when the browser refuses to save.
- The page: the paste box (contenteditable; reads text/html then text/plain
  from the clipboard; a Read box button for browsers that paste without
  handing the page the clipboard), counters for lines and flagged, each paste
  shown as a group with its time and note, each line showing slot, date and
  all seven columns with the Betfair check highlighted and "As pasted" under
  it, Add line for a bet not on the slip, a switch to other dates that have
  lines, and the worksheet notice.
- Tests from the real fixtures: the four HTML rows cell by cell, the codes,
  the check flag, reordered columns, a short row flagged, a missing header
  flagged, the note kept and unparsed, the slip inside a layout table, the
  three plain text selections equal to their HTML cells, header and lay rules
  as note, a missing second line flagged, an unreadable first line flagged,
  HTML preferred over text, text fallback, HTML without a table read as text,
  the empty paste, a hand-added line.

### Not yet
- Placed and Not placed, the form, the history (step 3). Export (step 4).

## [0.1.0] — 2026-10-30 — skeleton (step 1)

### Added
- Repository files: `.gitignore` (node_modules, dist, `reference/`),
  `.node-version` 22, `package.json` with exact pins (react 19.3.1, react-dom
  19.3.1, vite 8.3.4, @vitejs/plugin-react 6.1.2, vitest 5.0.5, jsdom 30.1.3),
  `vite.config.js` with the jsdom test environment.
- Skeleton page: masthead, the banner "This page records what a person did
  elsewhere. It places nothing.", slot and date fields (the date defaults to
  today in Europe/London), a placeholder where the paste box goes, a footer
  with the worksheet notice.
- `src/dates.js`: `todayInLondon` and `nowInLondon`, with tests, so the Pages
  test step has real tests to run from the first deploy rather than passing on
  an empty set.
- README with the Pages settings for Charles, this CHANGELOG, and
  `docs/status/latest.md`.

### Decisions recorded
- Charles, 30 October 2026: hostname fb13.chimerasportstrading.com; Node 22;
  the pins above; the date defaults to today in Europe/London, not the device
  date; the "where" field offers Betfair, each code on the line, and Other; no
  `package-lock.json` in version 0, sub-dependencies resolve at build time, to
  be revisited by generating a lock in CI; both parsers ship, and the plain
  text parser handles the email's two-lines-per-selection shape.

### For Claude Strategy
- CHI-BRF-002 §3.5 says Node 20. CHI-BRF-004 §5 says Node 22. FB12 and FB13
  build on 22, approved by Charles on 30 October 2026. Raise for the Bible so
  the two briefs agree.

## STRATEGY NOTES

No notes yet. Only Claude Strategy writes into this section; the build agent
reads it, acts on it and records what it did above.

---

*Born from complexity. Engineered for certainty.*
