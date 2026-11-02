# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 3 of 5). **Written:** 2026-11-02, 13:09 UTC, by the
build agent, from the clock.

**State:** version 0.7.3 is live on both sides. Charles's word: the seven
commits above ec4c6d2 were pushed as main (tip dd7ebe3) at about 13:03 UTC.
Cloud Build 2d309569 (trigger fb13-main): 96 pytest passed on Python 3.12.16,
image built, revision fb13-trade-slip-api-00005-dhq deployed at 13:05:45 UTC
and serving 100%; /health answered 0.7.3 at 13:06:12 UTC. The Pages check for
dd7ebe3 passed at 13:05:05 UTC; the live bundle is 0.7.3, stamped dd7ebe3.
The old revision gave its Betfair session back at instance stop (logout
record 13:05:59 UTC, by instance_stop). Charles logged in again himself from
the page at 13:06:41 UTC and read the markets at 13:06:46 UTC (30 markets);
both records kept with their HTTP trail. Mode paper, placing disabled. No
order of any kind has been sent. Nothing logged in by itself.

**Waiting for (from Charles), since 2 November 2026:**
- Charles pastes the 08:00 slip into the page (0.7.3, six-cell layout read)
  and presses Resolve.
- Charles's word for real mode: he writes the settings version himself
  (the exact object and command are in the report of 2 November), then the £2
  test order from the page, with the sentence typed; then the kill switch.
- The Betfair cap's meaning and Price A and B, confirmed at the handover with
  Mark.
- Whether the pages.dev addresses should go behind Access.

**Last did:** pushed main (seven commits) on Charles's word; watched the
trigger build, /health and the Pages check; read the new revision's logs and
the four newest records to confirm that the login on the new instance was
Charles's own click, not the server's. This status commit is local, unpushed.
Before that: pushed ec4c6d2 alone (0.6.7 live 12:39 UTC); fixed the three
server test failures as 0.7.3 after one-off tests-only Cloud Builds.

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
