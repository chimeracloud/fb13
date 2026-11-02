# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 2 of 5). **Written:** 2026-11-02, 06:10 UTC, by the
build agent, from the clock.

**State:** the first Betfair login failed; the fix is built, committed
locally as 0.6.3, not pushed. Charles's click on the page at 05:53 UTC on
2 November 2026 was the first login. It failed inside the client before
anything was sent: `default_client_factory` passed the certificate pair as a
list, and the requests library (2.34.2 in the image) keys its connection pool
on the client certificate and unpacks only a tuple, so the pool key raised
`TypeError: unhashable type: 'list'`. The one stored record
(`betfair/2026-11-02/1793598819237-ed8cf86a.json`) is that login, FAILED, no
HTTP status, no Betfair response; the Cloud Run log shows the one POST
answered 502 with a 216-byte JSON body. The page showed Cloudflare's words
because Cloudflare replaces an origin's 502 or 504 with its own error page,
JSON with a `detail` when JSON was asked for. The live server (revision
00003-gv8, 0.6.1) stands in the failed state; no retry; the build agent did
not log in. Placing is disabled. No order call exists.

**Fixed in 0.6.3 (local):** the certificate pair is a tuple; every Betfair
record carries `http`, the trail of what the requests library sent and what
came back; a failed Betfair call is 424, never 502; the Pages Function answers
503 for a failure to reach the server and for a 502/504 from Cloud Run's
front door, and passes 424 through; the page shows 424 as the server's
sentence and any other status with its number. Two new server tests reproduce
the failure and fail on the old code; 67 pytest, 105 vitest.

**Waiting for (from Charles), since 2 November 2026:**
- The word to push 6f910e6 (status) and the 0.6.3 commit. The server push
  replaces the instance; there is no session to drop.
- After the deploy: on the page, Refresh status; Clear the session state;
  Log in to Betfair, once; Read the markets for today. Then the build agent
  reads the stored records back and reports the count, the first and last
  off, one sample market with runners, the session state and the HTTP trail.
- At 08:00 UK: paste the real 08:00 slip, Resolve the lines on this page.
- Whether the pages.dev addresses should go behind Access.
- Whether to pin `requests` (2.34.2 in the last build; not pinned today).

**Last did:** read the Cloud Run logs and the orders bucket, confirmed the
cause against the requests and betfairlightweight sources and Cloudflare's
documentation, built the fix and the tests, updated README and CHANGELOG.

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
