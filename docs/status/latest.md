# FB13 — status

**Unit:** FB13 Trade slip, version 1 (step 3 of 5). **Written:** 2026-11-02, 13:48 UTC, by the
build agent, from the clock.

**State:** the £2 test order ran for real and passed. Charles wrote the
real-mode settings version himself at 13:27 UTC (`settings/v/1793626030000-4c261c4a.json`,
previous the seed), pressed Resume placing at 13:31:22 UTC, read the markets
at 13:34 UTC (28 markets: two of the morning's had closed), ran the test at
13:41:25 UTC and pressed the kill switch at 13:42:40 UTC. The four Betfair
calls (placeOrders, listCurrentOrders, cancelOrders, listCurrentOrders) each
answered 200 at api.betfair.com; bet 449945060703, BACK 2.00 at 1000 on
Sovereign Bay in the 19:30 Wolverhampton (1.264841684), EXECUTABLE with
nothing matched, cancelled in full one second later, then absent; verdict
"passed: placed, seen, cancelled, gone". Four Betfair records and one ledger
record hold it all, with the HTTP trails. The stored settings now read mode
real, access confirmed, placing disabled (four versions, the `previous`
chain intact). The day's real money at risk as the server counts it: 2.00;
paper 0.00. Server 0.7.3 (revision 00005-dhq), logged in; page 0.7.3.
Nothing pushed since dd7ebe3; three status commits are local.

**Waiting for (from Charles), since 2 November 2026:**
- Whether the stored mode goes back to paper before step 4's paper trials
  (with mode real, a Place from the page would be real). He writes it.
- Mark's answers at the handover: which of Price A and Price B is the lay
  target (the builder would take Price A), and what the Betfair cap means for
  a lay. No order is built from a six-cell line until then.
- Charles's word to start step 4 (the page's Place button, the confirm panel,
  order status, Place all with confirmation), and his approval of its design
  as proposed in the report of 13:48 UTC.
- Charles pastes the 08:00 slip into the page and presses Resolve.
- Whether the pages.dev addresses should go behind Access.

**Last did:** read the test order back from the ledger, the four Betfair
records, the settings versions and the revision's log; reported every step
with its HTTP trail, the order's state at each step, the cancel response,
the day's money at risk, and what was unexpected (the race was the 19:30,
not the 20:30 Charles had named; Betfair labels the order GIBRALTAR
REGULATOR; closed markets leave the catalogue). Made no Betfair call.

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
