# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 2 of 5). **Written:** 2026-11-02, 06:24 UTC, by the
build agent, from the clock.

**State:** 0.6.3 (cd5c624) is pushed; its Cloud Build run (4944dd11) failed
at the test step, 3 failed and 64 passed, so nothing was built or deployed.
The live server is still revision 00003-gv8 (0.6.1) in the failed Betfair
state from the first login at 05:53 UTC; the page is live at 0.6.3. The two
tests that reproduce the login failure passed. The three failures: the test's
fake HTTP trail carried the raw token (test only), and two tests read records
back in the wrong order because two objects written in the same millisecond
are named `{ms}-{hex}` and the hex decided. That is a real ordering fault, not
a test fault: "newest wins" could pick the wrong settings version or record.
Fixed at the root in 0.6.4, committed locally, not pushed: a clock-named
object from this process always takes a later millisecond than the one
before it. No login attempted; the build agent does not log in. Placing is
disabled. No order call exists.

**What 0.6.3 fixed (unchanged, waiting on the deploy):** the certificate pair
is a tuple; every Betfair record carries the HTTP trail; a failed Betfair call
is 424, never 502; the Pages Function and the page never pass Cloudflare's
502/504 page off as the server's words.

**Waiting for (from Charles), since 2 November 2026:**
- The word to push the 0.6.4 commit. The server push replaces the instance;
  there is no session to drop.
- After the deploy answers `/health` with 0.6.4: on the page, Refresh status;
  Clear the session state; Log in to Betfair, once; Read the markets for
  today. Then the build agent reads the stored records back and reports.
- At 08:00 UK: paste the real 08:00 slip, Resolve the lines on this page.
- Whether the pages.dev addresses should go behind Access.

**Last did:** pushed 6f910e6 and cd5c624 on Charles's word, watched the
build fail, read the three failures, fixed the fake and the naming, added the
test, updated README and CHANGELOG. `requests` stays unpinned, as Charles
ruled.

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
