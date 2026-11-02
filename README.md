# FB13 Trade slip

**Chimera Sports Trading · First Build 13 · version 1, step 1 · the page records; the server shell is up; nothing places yet.**

Strategy concept and the trade slip concept: Mark Insley. Architecture and build: Charles Duckitt.

FB13 is the trade slip: each day's Early Doors lines pasted into one page, so
that a person can place each bet elsewhere, come back, and record what they
did in minutes, with every step kept.

**This page records what a person did elsewhere. It places nothing.** Version 0
has no server, no login to any bookmaker or exchange, no credential anywhere,
and makes no network request beyond loading itself. Storage is the browser's
own, so this version is a worksheet and not yet the record.

**Version 1 adds a small server** (Charles's prompt of 1 November 2026): a
Python service on Cloud Run in London that will build, place, cancel and check
Betfair orders behind a Place button on each slip line, paper by default. Step
1 of five is built: the settings, the caps, the kill switch and the admin
shell. **It makes no Betfair call.** See "Version 1: the server" below.

## Status

| Step | What | State |
| --- | --- | --- |
| 0 | Onboarding message to Charles | Sent 30 October 2026, approved |
| 1 | Repository files, skeleton page, Pages settings | Pushed 30 October 2026, 0.1.0 |
| 2 | Paste, parse and show the lines | Pushed 30 October 2026, 0.2.0; Pages build passed; live |
| 2a | Diagnostics: what was pasted | Pushed 30 October 2026, 0.2.1, for the first real paste from Gmail, which read nothing |
| 3 | Placed and Not placed, the form, counters, history | Pushed 30 October 2026, 0.3.0 |
| B | Parsers for the real browser copy: seven cells by position, tab separated text | Pushed 30 October 2026, 0.3.1; checked against three real pastes: 30 October (15:13 and 15:48 UK, the 10:00 slip) and 1 November 2026 (22:42 UK, the 08:00 slip) |
| B2 | The six-cell layout of the 08:00 slip, alongside the seven-cell one | Built 2 November 2026, 0.6.5, from the real paste of 07:40 UTC (22 rows, all refused by 0.6.4 as "6 cells"); kept as the fourth real fixture. The 0.6.5 and 0.6.6 Pages builds failed on tests (a CSV row split on commas; three CSV rows compared as literals without the nine new columns; a six-column header rule that caught the missing-column test); 0.6.7 fixes them |
| 4 | Export, worksheet notice | Pushed 2 November 2026, 0.4.0; Pages build passed |
| 4a | The version and the commit in the footer and on the diagnostics | Pushed 2 November 2026, 0.4.1; Pages build passed; live |
| 5 | Tests from the real fixtures run in the Pages build | Written alongside each step: 116 tests (9 for the Pages Function, 9 for the page's calls to its server, 6 for the six-cell layout from the fourth real paste, 4 for the test order's controls), run by every Pages build before `vite build` |
| v1 0 | Step 0 message: the plan, the secret names, the hostname, the questions | Sent 2 November 2026; Charles's rulings received the same day |
| v1 1 | The server shell: settings, caps, kill switch, the thirteen admin and observability endpoints, the Pages Function, the Cloud Build pipeline | Pushed 2 November 2026, 0.5.0; the first settings version written the same day; 0.5.1 sets minimum instances to zero until step 2; 0.5.2 the Access values. The trigger `fb13-main` was created in region europe-west2 and run once by hand the same day: the first deploy, revision 00001 at 627ec3b, answers `/health` and `/ready`. Live, placing disabled, no Betfair call |
| v1 2 | Read only: login and listMarketCatalogue to resolve slip lines | Built 2 November 2026, 0.6.0: the Betfair session on the Delayed key (an operator logs in from the page; nothing logs in by itself), the day's GB and IE win markets, the resolver, the server panel on the page. The first login, Charles's click at 05:53 UTC on 2 November, failed inside the client before anything was sent (the certificate pair passed as a list); 0.6.3 fixes it and the way the error reached the page. Charles clears the session state and logs in once after the deploy. The real 08:00 slip at 08:00 UK is the resolver's test |
| v1 3 | The paper order builder and its record; placing, cancelling, listCurrentOrders, still paper | Built 2 November 2026, 0.7.0: the builder with every refusal named, the paper ledger, the real path behind the stored mode and the kill switch, the test order (BACK 2.00 at 1000, placed and cancelled, real mode only with the sentence typed). No order sent. Real mode stays off until Charles writes the settings version |
| v1 4 | The page: Place button, confirm panel, order status, Place all with confirmation | Not started |
| v1 5 | Tests from real data | Server tests written alongside each step: 95 cases, run by every Cloud Build before the image is built; two of them reproduce the first login's failure of 2 November 2026 and fail on the old code, one the record order within a millisecond that failed the 0.6.3 build. The resolver and the order builder are tested against the first real catalogue, 2 November 2026 (`server/tests/fixtures/catalogue-2026-11-02.json`): all 30 markets resolve from their own time, venue and first runner |

Current state in detail: [docs/status/latest.md](docs/status/latest.md).

## What it does

- Two fields above the paste box: slot (08:00, 09:00 or 10:00 UK) and date.
  The date defaults to today in Europe/London, whatever the device's zone.
- A paste box. Copy the table from Mark's Early Doors email and paste it. The
  page reads the clipboard's HTML and finds the table: by its header row when
  one is present, otherwise by rows of exactly seven cells mapped by position
  (Race, Horse, Best price, Best BOG, Betfair, Lay target, Betfair cap). A line
  break inside a cell is kept. If there is no table it falls back to the plain
  text. With tabs (a browser copy of the table) cells split on tabs: the first
  line of a selection ends with the Betfair price and the second begins with
  the API time and holds the lay target and the cap, and the pair is joined.
  Without tabs only the email's own plain text form is read, where the horse
  sits between asterisks. Anything else is flagged and shown, not guessed. Any
  HH:MM is accepted before "API": the 10:00 slip reads at 09:52, the 09:00 at
  08:52.
- Every parsed line is shown for the person to check, with a count. A line
  that cannot be read is shown as it is and flagged. Nothing is dropped and
  nothing is guessed. Each paste is kept as a group with the time it was pasted
  and the note below the table, and can be removed only while nothing has been
  recorded against any of its lines. An Add line button covers a bet that is
  not on the slip. If the browser gives the page nothing on paste, the slip
  lands in the box and a Read box button parses it from there.
- Under the paste box, a collapsed section "What was pasted" shows what the
  last paste handed the page: each clipboard type and its length, the
  text/plain with tabs as → and line breaks as ¶, the first 4000 characters of
  the text/html as escaped text (never rendered), the browser's user agent,
  and a Copy diagnostics button. It is kept in the browser with the lines so
  it survives a reload. Nothing in it leaves the page. It exists because the
  first real paste, from Gmail on a Mac on 30 October 2026, read 34 lines as
  plain text and could parse none of them.
- Each line carries all seven columns with its slot and date, and two buttons:
  Placed and Not placed. Placed opens a form: where (Betfair, each bookmaker
  code on that line, or Other), side (back or lay), price obtained, whether the
  BOG price applied (yes, no, unknown), stake (default 50, editable), time
  (default now in Europe/London), how it was placed (by an app, by a person,
  automatic), mode (paper or real, required, default paper, stated by the
  person and never inferred), and an optional reference. Where, side, price
  and how have no default and must be chosen. Not placed records at once, with
  the time.
- Counters at the top: lines, placed, waiting, not placed, and flagged when any
  line is. A line's state is its latest entry. An edit is a new entry, never an
  overwrite, and each line's history stays visible under the line, newest
  first, with the UK time it was recorded.
- Export, at the foot of the page: Export CSV and Export JSON each save a file
  to the device with every entry on every date. Each CSV row carries the date,
  the slot, the race and horse, the kind (placed or not placed), the mode,
  where, side, price, stake, BOG, the time placed, how, the reference, the UK
  time and the UTC instant it was recorded, the line's other five cells and
  its flag. A not placed entry carries no mode, because none was stated. The
  JSON carries the same entries with the whole line embedded, the page version
  and the time of export. The file is made in the browser and saved to the
  device. The worksheet notice that sat beside the buttons, the banner above
  the counters and the footer notice were removed at Charles's ask on
  2 November 2026 (0.6.2); the exported JSON still carries its own notice.
- The footer names the build: "FB13 trade slip, version 0.4.1, commit
  7642519." The diagnostics carry the build that took the paste, on the first
  line of the copied text and of the panel, so a paste always says which
  version read it. The hash is the one Cloudflare Pages hands the build;
  outside a Pages build the page says "no commit hash".

## What it does not do

- The page places no bet, logs in nowhere, scrapes nothing and holds no
  credential. The server, at step 1, makes no Betfair call and has read no
  secret: it holds the settings and the kill switch.
- It does not decode the bookmaker codes on the slip (B3, WH, LD, CE, BY, FB,
  SI, SX, BTT, FR, Betano, BetMGM, Midnite, and UN, 10bet, PP, LiveScore Bet
  and Virgin Bet, seen in real data on 30 October 2026). They are shown exactly
  as they arrive, including a space inside a code; they are split only on the
  comma, and only to offer them in the "where" field. Charles holds the
  mapping.
- It sends nothing anywhere: no analytics, no third party script, no CDN, no
  fonts fetched. Since version 1 step 2 the page also calls `/api/*` on its own
  hostname, for the server panel, and nothing else.
- It never edits or deletes a history entry.
- It does not parse the text below the table (the lay rules). That is kept as
  a note.

## The input

Two layouts of the slip table are read. Both stay; a paste is read as whichever
it is.

**The six-cell layout** (first seen 2 November 2026, the real 08:00 slip):
one row per selection, six cells. Race | Horse | a price | a second price |
a decision | a button label. Charles's reading, to confirm with Mark: the
first price is about 3 to 4 percent under the Betfair price, probably the lay
target; the second is the next favourite's price. Nothing is assumed: the
page labels them **Price A** and **Price B**. The decision cell is "In" or
"Out", a middle dot, and a reason, as in
`In · clear favourite, Betfair 2.85, next 3.04, best 2.88` or
`Out · favourite 4.51 is longer than 4.0`. The cell is kept verbatim; beside
it the page extracts In or Out and, where the reason names them, the Betfair
price, the next price and the best bookmaker price (`best null` is null). A
reason in another shape gives the decision alone and says "prices not named
in the reason; none extracted". A cell that does not start with In or Out and
a middle dot is flagged and the row shown raw, never guessed. The button cell
is "Take out" or "Put in". There is no bookmaker column (the "where" field
offers Betfair and Other), no BOG, no API line and **no Betfair cap**: the
line says "none in this layout", and the order builder applies no course cap
to such a line. **No order is built from a six-cell line** until Charles
confirms with Mark which price is the lay target; when he does, the builder
would take Price A as the lay target and Price B not at all.

**The seven-cell layout** (30 October to 1 November 2026): Race, Horse, Best
price, Best BOG, Betfair, Lay target, Betfair cap.

| Column | What arrives | Kept as |
| --- | --- | --- |
| Race | Time and course, `11:35 Newmarket` | Text |
| Horse | Bold name | Text |
| Best price | A price and one or two bookmaker codes, `2.88 BetMGM, SI`; or `no price read` | Text, with the codes split out only to offer them in the "where" field |
| Best BOG | A price, or `–` | Text |
| Betfair | A price, sometimes `⚠ check`, then a line break and `07:52 API`; or `–` | Text, line break kept |
| Lay target | A bold price and `(13% under)` or `(5% under)`; or `–` | Text |
| Betfair cap | A pound amount, `£240` | Text |

Seven-cell columns are matched by header text when a header row is present,
so their order does not matter. Without a header they are taken in the order
above. Six-cell rows are taken in order; a six-column header naming race and
horse and at least one column the seven-cell layout does not have is kept out
of the rows and shown in the note (a six-column header made only of seven-cell
names is a seven-cell table missing a column, flagged as before). The HTML table is read
first, then tab-separated text (one line of six or seven cells, or the
seven-cell pair of lines), then the email's own untabbed text (seven-cell
only). A row with a different number of cells, a table missing one of the seven
headers, or, without a header, a row whose first cell is not a race time, is
flagged and shown raw. The export's CSV carries the six-cell layout's cells and
what was extracted in columns appended after the old ones.

## Version 1: the server

Charles's prompt of 1 November 2026, "FB13 version 1: Betfair order placing,
paper first", with his rulings of 2 November. FB13 stays a standalone First
Build: nothing shared with another unit, no recorders, no FSU dependency.

### Safety, as built so far

- **Paper unless the stored settings say real.** `mode` has no API path at
  all: Charles changes it by writing a new settings version to the bucket, by
  his own word. The API rejects a body that names it. Paper builds the exact
  order, records it and sends nothing (step 3).
- **Caps on money at risk**: the stake for a back, the liability for a lay.
  Defaults £5 at risk an order and £10 a mode a London day; both stored
  settings, both apply in both modes and are counted separately per mode. An
  order above either is refused (step 3 counts; step 1 stores).
- **The kill switch**: `POST /admin/control/kill` stops all placing, paper and
  real, at once, and is stored before it is applied. `resume` is the separate
  inverse. Placing starts **disabled** and stays so until an operator resumes,
  so nothing can place because a code default said so. Cancelling open orders
  will be a separate, deliberate call (step 3).
- **Real mode stays off until Charles confirms that Cloudflare Access covers
  the page.** `page_access_confirmed` is a second protected field, false until
  he writes it true. Real placing needs both fields.
- **Every change to the settings is a new object** with who, when and why;
  nothing is overwritten and the service account cannot delete.
- **No secret anywhere in this repository, in a log or in an answer.** The
  server names the secrets it may read (names only) and has read none.

### The hostname and the gate

One hostname: the page's. The page will call `/api/*` on
`fb13.chimerasportstrading.com`; the Pages Function forwards it to the Cloud
Run service with the Access token; the server verifies the token on every
request (RS256 against the team's published keys at
`https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, issuer, audience,
expiry) and then requires the token's email to be on the stored operator list.
No token, 401. Unconfigured, 503. Not an operator, 403. Only `/health` and
`/ready` answer without a token. Cloud Run's invoker check is off because this
is the gate (Charles's ruling 1).

The server needs two values from the Access application: the team domain and
the application's audience tag. Both sit in `cloudbuild.yaml` as
`_CF_ACCESS_TEAM_DOMAIN` and `_CF_ACCESS_AUD`, set from Charles's message of
2 November 2026: team `chimera-cape.cloudflareaccess.com`, audience
`3f42e55e9c5fa60795f282b1777bf1f77f3a5755dbc67db86da6eef0e0ccfac9`. Neither
is a secret: the audience is in every token and in the login redirect, which
is where the same two values were seen from Cape Town that day. The server
accepts only a token issued by that team for that application.

### The stored settings

One JSON object per change in `gs://chiops-fb13-config/settings/v/`, named by
its time, create-only; the newest is in force. Names from one process never
share a millisecond (0.6.4), so the order of names is the order of writes
and "newest" means the last written. Hydrated at start and re-read
every five seconds, so the stored value governs.

```json
{
  "values": {
    "schema": 1,
    "mode": "paper",
    "page_access_confirmed": false,
    "placing_enabled": false,
    "caps": {"per_order_at_risk_gbp": 5.0, "per_day_at_risk_gbp": 10.0},
    "operators": []
  },
  "updated_at": "2026-11-02T12:00:00.000Z",
  "updated_by": "who",
  "reason": "why",
  "change": "config, kill, resume, or by hand",
  "previous": "the object this replaces, or null"
}
```

| Field | Changed by |
| --- | --- |
| `mode`, `page_access_confirmed` | Charles only, by hand (below). No API path |
| `placing_enabled` | `POST /admin/control/kill` and `/resume`, by an operator |
| `caps`, `operators` | `PUT /admin/config`, by an operator |

A stored value that is not valid falls to the safe side (paper, disabled, the
default caps, nobody signed in) and is reported in `/admin/config` and
`/status`, never silently.

**By hand.** To change a protected field, or to seed the first operators,
Charles (or the build agent at his word) writes a new object with a name later
than the newest, for example with `gcloud storage cp` from a local file to
`gs://chiops-fb13-config/settings/v/<13-digit-ms>-<8-hex>.json`, carrying the
full `values` object and `"updated_by": "charles"`. The server picks it up
within five seconds. Nothing is deleted or overwritten. The first version was
written this way on 2 November 2026: paper, placing disabled, page access not
confirmed, the default caps, and the two operators Charles named.

### Step 2: read only

Charles's rules of 2 November 2026, as built:

- **The Delayed key only.** The Live key is not named anywhere in this
  repository. Betfair's documentation says the Delayed key places bets on the
  live exchange and is the key to test with; FB13 reads with it in step 2 and,
  by Charles's ruling 3, will place with it from step 3.
- **One login, with the certificate, kept with keepAlive.** An operator asks
  from the server panel on the page (`betfair-login`); nothing logs in by
  itself, not at start, not on a request. The certificate and key are written
  to a private directory on the container's in-memory filesystem for the login
  call only and removed as soon as it returns. While logged in, a keepAlive is
  sent every fifteen minutes. **A failed login latches**: the state becomes
  "failed" with the error in words, and no further login is attempted until an
  operator clears it (`betfair-reset`) and asks again. Never a retry loop. A
  failed keepAlive marks the session "expired", with the same rule.
- **Every request and response is recorded**, append-only, in the orders
  bucket under `betfair/<UTC date>/`, with the time and the operator: login,
  keepAlive, logout, listMarketCatalogue (the full catalogue as Betfair sent
  it). From 0.6.3 each record also carries `http`, the trail of every send the
  requests library attempted for that call (method, URL without its query,
  status and time, or the error where no response came), so the record itself
  says whether anything reached Betfair; `null` where the client's session
  keeps no trail. Never a secret: the session token, key, username and
  password are not written anywhere, and any token-shaped run of characters
  in an error is redacted before it is stored or logged.
- **A failed call to Betfair is answered 424** (failed dependency), never 502
  or 504. Cloudflare replaces an origin's 502 and 504 with its own error page,
  and when the request asked for JSON that page is JSON with a `detail` of its
  own. That is how the first login's error reached the page on 2 November 2026
  as "The origin web server returned an invalid or incomplete response to
  Cloudflare" instead of the server's words. The server never answers 502 or
  504; the Pages Function never passes one on (below).
- **The market call** is listMarketCatalogue for one London day's horse
  racing (event type 7), countries GB and IE, market type WIN, sorted first to
  start, with EVENT, MARKET_START_TIME and RUNNER_DESCRIPTION. Step 2 was read
  only; step 3 (below) adds the order calls, sent only in real mode.
- **The resolver** (`server/app/resolver.py`, pure functions): a slip line's
  race cell "13:40 Cork" is a UK local time and a course; the time becomes the
  UTC instant Betfair shows, the course is matched to the market's venue, and
  the horse to a runner name, exactly, after normalising case and spacing
  only. One market at that time and venue, one runner with that name: resolved
  to a market id and a selection id. Anything else is flagged with the reason
  and the candidates, never guessed: no market at that time, a different venue
  at that time (named), two markets, a runner not in the market (the runners
  named), a runner twice. What was asked and answered is stored under
  `resolutions/<date>/`.
- **The page's server panel** (above the lines): refresh the status; log in,
  log out, clear the session state; read the day's markets (count, first and
  last off, venues, every market with its runners and ids); resolve the
  parsed lines on the page for the selected date. Each line then shows a chip,
  "Betfair: resolved" with the market id, runner and selection id, or
  "Betfair: not resolved" with the reason. The resolution is held in memory
  only and asked for again next time.
- **The session and the instance.** One instance, always on, CPU always
  allocated (Charles, 2 November 2026): the session lives as long as the
  instance, kept by keepAlive. A redeploy replaces the instance, logs the old
  session out at shutdown, and the new instance starts logged out: an operator
  logs in again, by hand. So the server is not redeployed during racing.

### Step 3: the order builder, paper first

Built 2 November 2026 (0.7.0) from Charles's rulings. No order has been sent.

- **What a Place builds.** From a slip line whose back leg is recorded as
  Placed: the market and runner from the resolver; a LAY LIMIT order at the
  slip's lay target moved down to a valid Betfair tick (never above the
  target); size = back stake x back price / lay price, down to the penny;
  liability = size x (price - 1), the money at risk; persistence LAPSE;
  `customerOrderRef` `FB13-YYYYMMDD-HHMM-<12 hex of the line>` (31
  characters) and `customerStrategyRef` `FB13-HHMM` (the slot). The exact
  placeOrders body is shown before anything is sent, with a sixteen-character
  ticket; a Place must present that ticket, and a build that differs is
  refused. `POST /orders/build` returns the order and every reason it would be
  refused, so the confirm panel (step 4) can show both.
- **Refusals, each named**: the kill switch; the stored mode (real needs the
  stored mode real and Charles's Access confirmation); the line not resolved;
  the race already started; a cell that does not read as a number; a lay
  target outside 1.01 to 1000; a size below Betfair's minimum-bet rule (size
  at or above the currency minimum, or payout at or above the minimum payout,
  from betfairlightweight's currency table); a size above the slip's Betfair
  cap for the course; liability above the per-order cap; the day's money at
  risk for the mode above the per-day cap; the line already placed that day in
  that mode (cancelled or not). Paper and real are counted separately.
- **Paper** builds the exact order, records it under `orders/<date>/` in the
  orders bucket as `placed` with `sent: false`, and sends nothing. **Real**
  sends it through the session and records Betfair's report (`placed` with
  the bet id, or `place_failed`). Cancel is a separate, deliberate call by
  reference (`cancelled`, `cancel_failed`). A refused Place is recorded too.
- **The test order** (Charles, 2 November 2026): one BACK of 2.00 at the
  maximum price 1000, which cannot match. placeOrders, then listCurrentOrders
  to see it (EXECUTABLE, nothing matched), then cancelOrders, then
  listCurrentOrders to see it gone; one record, `test_order`, with the four
  steps and a verdict. Refused unless the stored mode is real, the kill switch
  is off, Access is confirmed, the session is logged in, the market is in
  today's catalogue and not yet run, the caps hold, and the operator typed
  exactly: `I confirm the real test order: back 2.00 at 1000`. Its references
  are `FB13-TEST`; it is never a line's order; its 2.00 counts toward the real
  day's money at risk. The page's server panel carries its controls, enabled
  only when the stored mode is real.
- **Choices made by the build agent, awaiting Charles's ruling**: tick down,
  never up; the slip's Betfair cap read as the most that may be laid at that
  course in backer's stake; a line placed once that day stays placed,
  cancelled or not; the day's money at risk counts cancelled orders and the
  test order; the minimum-bet figures from betfairlightweight 2.24.0 (GBP
  minimum size 1, minimum payout 10; Betfair's pages show 1 in one version
  and 2 in another).

### Endpoints

Thirteen of the shell, per CHI-POL-008 with its 18 September 2026 amendment,
plus step 2's three actions and two content endpoints, plus step 3's six.

| Endpoint | What | Token |
| --- | --- | --- |
| `GET /health` | liveness | open |
| `GET /ready` | storage answers and settings loaded; 503 otherwise | open |
| `GET /info` | name, version, commit, Python, pins, credential names (never values), Access configuration | operator |
| `GET /metrics` | Prometheus text | operator |
| `GET /status` | one screen of plain text | operator |
| `GET /admin/status` | health, version, uptime, mode, placing, caps | operator |
| `GET /admin/config` | the settings in force, with where they came from | operator |
| `PUT /admin/config` | `{"caps": {...}, "operators": [...], "reason": "..."}`; 422 for `mode` or anything else | operator |
| `GET /admin/stats` | counters; order counts begin at step 3 | operator |
| `GET /admin/activity` | the last 100 events, newest first | operator |
| `GET /admin/events` | the same, live, server-sent events, five minutes a request | operator |
| `GET /admin/incidents` | `[]` until the Incident FSU exists (CHI-POL-043) | operator |
| `POST /admin/control/{kill,resume}` | the kill switch and its inverse; `{"reason": "..."}` optional; any other action 404 | operator |
| `POST /admin/control/betfair-login` | log in once, with the certificate, on the Delayed key; 424 with the error if it fails, 409 thereafter until reset | operator |
| `POST /admin/control/betfair-logout` | give the session back | operator |
| `POST /admin/control/betfair-reset` | clear a failed, expired or logged-out state; logs nothing in | operator |
| `GET /betfair/markets?date=YYYY-MM-DD` | the day's GB and IE win markets with runners and a summary; London today by default; 409 when not logged in | operator |
| `POST /resolve` | `{"date": "...", "lines": [{"id", "race", "horse"}]}`: each line to a market and runner, or a flag | operator |
| `POST /orders/build` | `{"date", "slot", "line": {"id", "race", "horse", "lay_target", "betfair_cap"}, "back": {"price", "stake", "where"}}`: the order a Place would send, its ticket, and every refusal; nothing sent or stored | operator |
| `POST /orders/place` | the same body plus `"ticket"` and `"reason"`: paper records and sends nothing; real sends; 409 with the refusals | operator |
| `POST /orders/cancel` | `{"date", "order_ref", "reason"}`: a separate, deliberate call; 404 unknown, 409 already cancelled | operator |
| `GET /orders?date=` | the day's ledger: records, the day's money at risk per mode, the caps | operator |
| `GET /orders/current?date=` | open orders: the paper ledger's in paper mode; Betfair's listCurrentOrders for FB13's references in real mode | operator |
| `POST /orders/test` | `{"date", "market_id", "selection_id", "confirmation"}`: the test order, real mode only, the sentence typed; 409 otherwise, 424 if a step fails (the record says what stands) | operator |

### Storage

| Bucket | Holds | Created |
| --- | --- | --- |
| `gs://chiops-fb13-config` | `settings/v/` versions; `activity/<date>/` events | 2 November 2026 |
| `gs://chiops-fb13-orders` | from step 2: `betfair/<UTC date>/` every request to Betfair and every response, `resolutions/<date>/` what the resolver was asked and answered; from step 3: `orders/<date>/` every order event (placed, refused, cancelled, place_failed, cancel_failed, test_order), each with the exact order and, when sent, Betfair's report | 2 November 2026 |

Both: London, uniform access, public access prevented, object versioning on.
`fb13-sa` holds `roles/storage.objectCreator` and `roles/storage.objectViewer`
on each and nothing else, so it can create and read, never overwrite or delete.
Append-only is enforced by IAM, not only by code.

### Credentials

The server reads credentials through one interface, `get_credential(name)`
(CHI-POL-040); the interim implementation behind it reads Secret Manager in
`chiops`. Five existing secrets, by Charles's ruling 7, no new ones:

| Logical name | Secret | Also readable by |
| --- | --- | --- |
| `betfair_app_key` | `betfair-app-key-delayed` | fsu1b-sa |
| `betfair_cert_pem` | `betfair-cert-pem` | the default compute SA, backtest-tool, chimera-flumine-sa, fb11-sa, fb9-sa, fsu100, fsu1a-ingest-sa, fsu1b-sa, fsu9-sa |
| `betfair_key_pem` | `betfair-key-pem` | the same |
| `betfair_username` | `betfair-username` | the same |
| `betfair_password` | `betfair-password` | the same |

`fb13-sa` was granted `roles/secretmanager.secretAccessor` on these five on
2 November 2026; nothing else on them changed. No value has been read, and no
value is ever logged, stored or returned.

**Which key.** Charles ruled on 2 November 2026: the Delayed key for all of
FB13's REST work (resolve, place, cancel, list), because CHI-PRO-003 is filed
and later than the document that said otherwise, and because it avoids a
session clash with the Live key's users. Betfair's own documentation was
checked that day ("Application Keys", developer docs): the comparison table
gives "Bet Placement (Live Exchange): Yes" for the Delayed key; the prose says
"The Delayed App Key operates on the live (production) Betfair Exchange and
not a testbed/sandbox environment"; and "Complete any testing using your
Delayed Application key" is the step before a Live key is activated. So a
Delayed key places orders. Its price data is delayed and limited to three
levels, which FB13 does not read: the lay price comes from the slip. The Live
key is not named anywhere in this repository and is never used without
Charles's word.

**Recorded, not acted on** (the prompt asks for this): the project's notes say
a Live application key with no wagering activity can be deactivated by
Betfair. FB13 does nothing about it.

**Sessions.** FB13 holds its own login and never borrows another service's
session token (the 17 May 2026 conflict). The first login is step 2 and waits
for Charles's word, after racing (CHI-BRF-002: never open a Betfair session
without asking).

### Cloud resources

Created on 2 November 2026 by the build agent at Charles's approval; nothing
else in the project was changed.

| Resource | Name |
| --- | --- |
| Service account | `fb13-sa@chiops.iam.gserviceaccount.com` |
| Buckets | `chiops-fb13-config`, `chiops-fb13-orders` (europe-west2) |
| Artifact Registry | `europe-west2-docker.pkg.dev/chiops/fb13`, image `fb13-trade-slip-api` |
| Cloud Run service | `fb13-trade-slip-api`, europe-west2, created by the first build on 2 November 2026 (build 19b2dac4, revision `fb13-trade-slip-api-00001-zv6`, image `:627ec3b`). Reached by the page through `https://fb13-trade-slip-api-991649774709.europe-west2.run.app` |
| Cloud Build trigger | `fb13-main`, **region europe-west2**: `chimeracloud/fb13`, `^main$`, `cloudbuild.yaml`, filtered to `server/**` and `cloudbuild.yaml`, on the default compute service account like the other `-main` triggers. Created with `--build-config` on 2 November 2026 (id `2e7dd541-4aff-413a-b175-4e1ea52ea1be`). The region matters: Charles connected the repository to the first-generation GitHub App installation that lives in europe-west2 (the Cloud Build audit log, 01:20:00 UTC that day), so a first attempt in region global failed with "Repository mapping does not exist". The other `-main` triggers are global; this one builds in London |

## Where it runs

Cloudflare Pages, at **fb13.chimerasportstrading.com** behind Cloudflare
Access. Charles creates the Pages project and the Access application. Until
they exist the pages.dev address serves the same page.

Pages settings:

| Setting | Value |
| --- | --- |
| Repository, production branch | `chimeracloud/fb13`, `main` |
| Root directory | repository root |
| Build command | `npm test && npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` (also in `.node-version`) |

The build runs the tests first (`vitest run`), so a failing test fails the
deploy. Pages installs dependencies itself before the build command. Nothing is
built or tested on Charles's machine. Pages also hands the build the commit it
is building as `CF_PAGES_COMMIT_SHA`; `vite.config.js` stamps its first seven
characters into the page. Nothing to set.

**The Pages Function.** `functions/api/[[path]].js` runs for every request to
`fb13.chimerasportstrading.com/api/*` and for nothing else; the static page is
served as before. It forwards the request to the Cloud Run service with the
`Cf-Access-Jwt-Assertion` header Cloudflare Access puts on every request it
lets through, and returns the answer. Without that header it answers 401 and
the server is never called. The origin is Cloud Run's fixed URL for the
service, `https://fb13-trade-slip-api-991649774709.europe-west2.run.app`; the
Pages variable `FB13_API_ORIGIN` overrides it should the service move. Nothing
to set today. Pages picks the `functions/` directory up on its own. No 502 or
504 leaves the Function, because Cloudflare would replace it with its own
error page on the way to the browser: a failure to reach the server is
answered 503 in words, and a 502 or 504 from Cloud Run's front door is
answered 503 with the upstream status named (0.6.3, from the first login's
failure).

**The server.** Cloud Run, `fb13-trade-slip-api`, `europe-west2` (London:
Betfair blocks South African addresses), project `chiops`, service account
`fb13-sa`. Deployed by Cloud Build from `cloudbuild.yaml` on every push to
`main` that touches `server/**` or that file (trigger `fb13-main`, region
europe-west2, where the repository is connected). The tests run first, in the
cloud, on Python 3.12; the image is built only when they pass; the deploy
carries every flag the service must have, so the live service always matches
the file. Read back after the first deploy on 2 November 2026: every flag as
the file, plus two platform defaults the file does not set, startup CPU boost
on the revision and a service-level maximum of 100 instances, which the
revision's maximum of 1 governs. Recorded, not changed. One instance, always on, CPU always allocated
(Charles, 2 November 2026, at step 2): one standing Betfair session, kept
alive between requests; and at most one, so an order can never be built twice
by two instances. Its invoker IAM check is off: the Access token, verified on every
request, is the gate (Charles, 2 November 2026).

## Dependencies

Exact pins, each released at least two weeks before 30 October 2026. Nothing
else is added without Charles.

| Package | Version | Released |
| --- | --- | --- |
| react, react-dom | 19.3.1 | 2026-10-14 |
| vite | 8.3.4 | 2026-10-08 |
| @vitejs/plugin-react | 6.1.2 | 2026-10-05 |
| vitest | 5.0.5 | 2026-10-15 |
| jsdom | 30.1.3 | 2026-10-15 |

Node 22 (CHI-BRF-004). jsdom 30 needs Node 22.22.2 or later; Pages' default
Node 22 build is 22.23.4 as of 30 October 2026.

Server: Python 3.12, the fleet standard (Charles, 2 November 2026). Exact
pins, each released at least two weeks before 2 November 2026 and approved by
Charles that day. betfairlightweight ships in the image from step 1 so the
build is proven before step 2 uses it.

| Package | Version | Released |
| --- | --- | --- |
| fastapi | 0.150.0 | 2026-10-19 |
| uvicorn | 0.54.0 | 2026-09-25 |
| pydantic | 2.14.1 | 2026-10-11 |
| google-cloud-storage | 3.17.1 | 2026-10-15 |
| google-cloud-secret-manager | 2.31.0 | 2026-10-01 |
| PyJWT | 2.15.1 | 2026-09-28 |
| cryptography | 50.0.2 | 2026-09-30 |
| betfairlightweight | 2.24.0 | 2026-09-04 |
| pytest (tests only) | 9.1.1 | 2026-06-19 |
| httpx (tests only: FastAPI's test client needs it) | 0.28.1 | 2024-12-06 |

Direct dependencies are pinned; what they pull in resolves at build time, as
on the page. No lock file yet (the same decision as the page, 30 October 2026).

## Known risks

- **No `package-lock.json` in version 0** (Charles, 30 October 2026). The six
  direct dependencies are exact-pinned, but their sub-dependencies resolve at
  build time, so two builds days apart can differ underneath. To be revisited
  by generating a lock in CI.
- **Course names.** Betfair's venue is "Chelmsford City"; a slip that says
  "Chelmsford" is flagged, not guessed, with the venue named. Which names
  Mark's slip uses is known only from real slips; the first real resolve at
  08:00 UK on 2 November 2026 is the test.
- **The build agent's order choices** (step 3, above) stand until Charles
  rules: tick down; the Betfair cap as size; placed once a day; the day's
  risk counting cancelled orders; the minimum-bet figures from the library's
  table. With the caps at 5.00 an order, a slip line at the page's default
  stake of 50 is refused in paper too (liability 35.78 at 1.67/1.75).
- **Browser storage.** Entries live in this browser on this device. Clearing
  site data, a different browser, or the browser evicting storage loses them.
  Export is the only way out in version 0.
- **The slip's layout changes.** The 08:00 slip of 2 November 2026 arrived in
  a new six-cell layout and 0.6.4 refused all 22 rows, correctly. 0.6.5 reads
  it; what its two prices mean, and whether a Betfair cap exists elsewhere, is
  confirmed with Mark. A further change would be refused the same way, shown
  raw, until read.
- **The clipboard's shape.** Confirmed from three real pastes, 30 October and
  1 November 2026 (Gmail in Safari 27.2 on a Mac, the 10:00 and 08:00 slips):
  both text/html and text/plain arrive; the HTML table has no header row, so
  the cells are read by position; the text is tab separated, five cells on the
  first line and three on the API line, and the check marker travels inside
  the Betfair cell. Mail
  on an iPhone has not yet been tried and may hand the page something else.
  The "What was pasted" section will show it. Flagged rows are shown raw,
  never guessed.
- **Cloudflare Access covers the page since 2 November 2026.** Charles checked
  it; a plain request from Cape Town at 02:02 UTC that day was redirected to
  the chimera-cape team's login, where at 01:24 UTC the same request had been
  answered 200 with no redirect. The stored `page_access_confirmed` stays
  false until Charles writes it true; real mode needs it.
- **The Access values are deployed** and `/ready` reports sign-in configured.
  A wrong value would show as 401 on every call through the page; not yet
  exercised through the page by an operator.
- **The pages.dev addresses are not behind Access.** `fb13-d7g.pages.dev` and
  the per-deployment addresses served the page to a plain request from Cape
  Town at 02:48 UTC on 2 November 2026. The API refuses there too (401, no
  token) and the page holds no data for a stranger, since browser storage is
  per origin; but Access covers the custom hostname only. Charles decides
  whether to add `fb13-d7g.pages.dev` and `*.fb13-d7g.pages.dev` to the
  Access application.
- **The operator list holds two addresses**, from the first settings version
  written by hand at Charles's word on 2 November 2026. Others are added by a
  new version, never by editing.
- **The resolver's matching is untested against real markets** until the
  first real catalogue is stored and kept as a fixture; the parsing, the
  clock and the flags are tested. Course names on the slip and Betfair's
  venue names are expected to agree for GB and IE courses; where they do not,
  the line is flagged with the venues Betfair has at that time, and Charles
  decides any mapping.
- **Every redeploy of the server drops the Betfair session.** The instance is
  replaced, the old one logs out at shutdown, and an operator logs in again on
  the new one. Server pushes therefore wait for a time outside racing, and the
  trigger ignores page-only commits. Maximum one instance, so two can never
  build the same order.
- **The Delayed key is shared.** fsu1b-sa may also read `betfair-app-key-delayed`.
  FB13 keeps its own login session and never borrows another's, but Betfair
  may still treat two sessions on one key as it did on 17 May, 31 July and 11
  August 2026, whose cause the Bible records as unidentified. The first login
  waits for Charles's word (CHI-BRF-002).

## Repository layout

```
index.html            the one page
src/main.jsx          mounts the app
src/App.jsx           the page: paste box, lines, the form, history, export
src/parse.js          the slip parser, both paths, pure functions
src/entries.js        the placed form's defaults and checks, append-only entries, counters
src/storage.js        browser storage, every call in try/catch
src/diagnostics.js    what the last paste handed the page, as text
src/export.js         every entry as CSV and JSON, and the download to the device
src/dates.js          today and now in Europe/London
src/build.js          the version and the short commit hash stamped into the page
src/styles.css        mobile first, system fonts, no fetches
src/*.test.js         tests, run by the Pages build before vite build
src/fixtures/         real pastes, kept as fixtures; nothing invented
docs/status/latest.md status, overwritten whenever the unit reports (CHI-POL-053)
reference/            read-only clones (the Bible, FB11), never committed

functions/api/[[path]].js   the Pages Function: /api/* to the server, with the Access token
src/pages-function.test.js  its tests (vitest, Node environment)
src/api.js                  the page's calls to /api/*, every answer in words, never a throw
src/resolve.js              what the page sends to resolve and how an answer reads
src/orders.js               the test order's controls: the sentence, the body, the summary
server/app/main.py          the FastAPI app: the endpoints, the gate, the middleware
server/app/betfair.py       the Betfair session: one login, keepAlive, listMarketCatalogue, every call recorded
server/app/resolver.py      a slip line to a market and a runner, pure functions, flags never guesses
server/app/settings.py      the stored settings: mode, caps, kill switch, operators; create-only versions
server/app/access.py        Cloudflare Access token verification and the operator check
server/app/activity.py      the append-only activity log and the server-sent events
server/app/storage.py       create-only JSON objects in GCS, and a memory store for tests
server/app/orders.py        step 3: the order builder, the ledger, the real path, the test order
server/tests/fixtures/      the first real catalogue, 2 November 2026, read back from the orders bucket
server/app/credentials.py   get_credential(name): Secret Manager behind one interface (CHI-POL-040)
server/app/metrics.py       counters and the Prometheus text
server/app/models.py        request bodies, Pydantic v2, extra forbidden
server/app/logconfig.py     JSON logs with severity, service_name, trace_id
server/app/version.py       the version from package.json, the commit from Cloud Build
server/tests/               pytest, run by Cloud Build before the image is built
server/requirements.txt     runtime pins; requirements-dev.txt the test-only pins; pytest.ini; Dockerfile
cloudbuild.yaml             test, build, push, deploy; every flag the service must have
.dockerignore               the image takes server/app, server/requirements.txt and package.json only
```

## Policies

- CHI-POL-032: a standalone First Build. Its own repository, its own page,
  nothing shared with or consumed from any other First Build.
- CHI-POL-031: other repositories are read only, cloned into `reference/`,
  which is gitignored.
- CHI-POL-047: STRATEGY NOTES sections below and in the CHANGELOG; only Claude
  Strategy writes into them.
- CHI-POL-053: `docs/status/latest.md`, overwritten whenever the unit reports.
- CHI-BRF-002 says a First Build skips the admin shell. Charles's version 1
  prompt asks for it (step 1: "settings, caps, kill switch and the admin
  shell"), so it is built, to CHI-POL-008 with its 18 September 2026 amendment
  (thirteen endpoints). The conflict is recorded in the CHANGELOG for Claude
  Strategy.
- CHI-POL-008: the shell first, deployed and verified before any content. Step
  1 is exactly that. `auto_start` has its FB13 form in `placing_enabled`, which
  is false until an operator resumes, and the stored value governs.
- CHI-POL-040: one credential interface, `get_credential(name)` in
  `server/app/credentials.py`; the interim implementation reads Secret Manager.
  Interim, recorded here and in the CHANGELOG.
- CHI-POL-043: `GET /admin/incidents` returns an empty list until the Incident
  FSU exists. Interim structure.
- CHI-PRO-003 (24 August 2026) says the Live key is for the stream and the
  Delayed key for orders; Chimera_CBI_Corrections_For_CC.txt, as summarised in
  the prompt, said the opposite. Charles ruled on 2 November 2026: the Delayed
  key for all of FB13's REST work. Recorded in the CHANGELOG for Claude
  Strategy.
- Node 22 per CHI-BRF-004. CHI-BRF-002 says 20; the conflict is recorded in the
  CHANGELOG for Claude Strategy.
- Python 3.12 per Charles (2 November 2026), the fleet standard and what the
  CHI-BRF-004 amendment will say. CHI-BRF-002 says "3.13. NOT 3.14" and
  `python:3.12-slim` in the same row; CHI-BRF-004 says `python:3.13-slim`.
  Recorded.

## STRATEGY NOTES

No notes yet. Only Claude Strategy writes into this section; the build agent
reads it, acts on it and records what it did in the CHANGELOG.

---

*Born from complexity. Engineered for certainty.*
