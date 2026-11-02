# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 3 of 5). **Written:** 2026-11-02, 13:21 UTC, by the
build agent, from the clock.

**State:** version 0.7.3 live on both sides (server revision
fb13-trade-slip-api-00005-dhq, deployed 13:05:45 UTC; page bundle 0.7.3,
dd7ebe3). Charles confirmed that the 13:06:41 UTC login and the 13:06:46 UTC
markets read were his clicks, and gave the go for real mode and the £2 test
order, on the 20:30 Wolverhampton (market 1.264841699, 6f Hcap, 13 runners in
his catalogue read). The config bucket holds exactly one settings version,
`settings/v/1793584951000-5d98ec34.json` (the seed of 02:02 UTC: paper,
placing disabled, access not confirmed, caps 5/10, the two operators); no
kill, resume or PUT /admin/config has written another. The build agent gave
Charles the settings command with `previous` set to that object (the same
object his earlier command of 07:38 UTC named) and the page steps. Mode is
still paper, placing disabled; no order of any kind has been sent.

**Waiting for (from Charles), since 2 November 2026:**
- Charles writes the settings version himself (mode real, access confirmed,
  placing disabled), presses Refresh status, Resume placing, runs the £2 test
  order on the 20:30 Wolverhampton with the sentence typed, and presses the
  kill switch. Then the build agent reads the records back and reports.
- Charles pastes the 08:00 slip into the page and presses Resolve.
- The Betfair cap's meaning and Price A and B, confirmed at the handover with
  Mark.
- Whether the pages.dev addresses should go behind Access.

**Last did:** read the config bucket (one version), the settings code (the
newest object by name is in force, re-read within five seconds on any
request; `previous` is the full object name), the test-order path's
refusals in order, and the 13:06 catalogue record for the 20:30
Wolverhampton; wrote the command and the steps. Did not write the version,
did not enable placing, made no Betfair call. Before that: pushed main
(seven commits) on Charles's word; 0.7.3 live; confirmed the login was his.

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
