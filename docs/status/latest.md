# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 3 of 5). **Written:** 2026-11-02, 12:39 UTC, by the
build agent, from the clock.

**State:** the page is 0.6.7, live: ec4c6d2 (the six-cell layout and its two
test fixes) was pushed alone by hash on Charles's word; the Cloudflare Pages
check passed at 12:39:00 UTC and the live bundle showed 0.6.7, stamped
ec4c6d2, at 12:39:29 UTC. The Pages builds of 0.6.5 and 0.6.6 had failed on
tests; before this push the suite passed in a one-off tests-only Cloud Build
(3eea2314, node v22.23.4, 112 tests). origin/main = ec4c6d2. Above it, unpushed: the four server commits
of step 3 (9014251 status, 0c693e1 0.7.0, bece150 0.7.1, 3dd34e6 0.7.2) and
this fix, 0.7.3. The server's pytest suite on 3dd34e6 failed 3 of 96 in the
same kind of build (2a7447ab): one real bug (a Betfair session error was
never recognised, because the scrubber redacted the error code before the
check) and two tests that still asserted step 2's wording or one refusal
where the builder names two. Fixed in 0.7.3 (288b9b6), and green in its own
tests-only runs: the server suite 96 passed on Python 3.12.16 (f4eef1e9), the
page suite 116 passed on node v22.23.4 (fbd88e0a). The live server is 0.6.4 (revision 00004-9vw), logged in since
06:41 UTC, mode paper, placing disabled, untouched. No order of any kind has
been sent.

**Waiting for (from Charles), since 2 November 2026:**
- Charles pastes the 08:00 slip into the page (now 0.6.7, six-cell layout read)
  and presses Resolve on the current instance (server 0.6.4).
- Later, his word to push the server commits (9014251, 0c693e1, bece150,
  3dd34e6, 288b9b6 and this status commit), both suites green in the cloud on
  288b9b6. That deploy replaces the instance and drops the
  Betfair session; he logs in again.
- After the deploy: Charles writes the settings version for real mode himself
  (the exact object and command are in the report of 2 November), then the £2
  test order from the page, with the sentence typed; then the kill switch.
- The Betfair cap's meaning and Price A and B, confirmed at the handover with
  Mark.
- Whether the pages.dev addresses should go behind Access.

**Last did:** pushed ec4c6d2 alone by hash (12:3x UTC); the Pages check passed
at 12:39:00 UTC and 0.6.7 went live at 12:39:29 UTC; no Cloud Build fired (the
commit touches no server file); the live server and the session untouched.
Before that: confirmed 0.7.3 green in the cloud (above), and ran the
tests in one-off tests-only Cloud Builds (a `git archive`
of the exact commit, an inline config with one step, no trigger, no deploy, no
new resource: the staging bucket `chiops_cloudbuild` already existed), read the
logs after each finished, and fixed the three server failures as 0.7.3:
`server/app/betfair.py` reads the raw error for the word SESSION and the
scrubber keeps Betfair's error codes; the two stale tests assert what the code
does. Before that: 0.6.7, the second page-test fix, read from the tests.

**Found and reported, not acted on:**
- The record of a failed Betfair call read "[redacted] token=[redacted]": the
  scrubber took the error code for a token. 0.7.3 keeps a run of capitals and
  underscores; Charles may rule otherwise.
- `gcloud builds log --stream` needs the gcloud beta component, which is not
  installed on Charles's machine; the log is read once the build ends.
- The pages.dev addresses serve the page without Access. The API refuses
  there too; the page holds no data for a stranger. Charles decides.
- Platform defaults on the service that `cloudbuild.yaml` does not set:
  startup CPU boost; a service-level maximum of 100 (the revision's 1 governs).
- FastAPI's test client warns that httpx is deprecated in favour of httpx2.
- `page_access_confirmed` stays false until Charles writes it true.
  `chimeracloud/fb13` is a public GitHub repository.

**Declined:** installing the gcloud beta component; logging in to Betfair from
the build agent's side; touching the live server or the session. No build or
test ran on Charles's machine.
