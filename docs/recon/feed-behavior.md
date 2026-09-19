# Upstream feed behavior

Evidence gathered against the live service. Every claim here was observed, not
inferred from documentation. The service publishes no terms of use:
`licenseInfo` and `accessInformation` are both empty.

## The service

```
https://services.arcgis.com/NummVBqZSIJKUeVR/arcgis/rest/services/Train_Watch_Layer/FeatureServer/0
```

Public, anonymous, no token, CORS `*`, capabilities `Query`.

Discovery chain, for re-deriving it: Instant App `820ec3acdbcb41d29fc2a7d4062c0820`,
webmap `dc01417834d14b5581fc420a535c8276`, feature layer item
`5bd3d1ad9a1e43578b38eeceaa4ed627`, owner `MyCityHouston`.

Verified at the start of this work: HTTP 200, 1.9 KB for the 11-code filtered
query, all 11 codes present, all `clear`, all `sensorStatus: UP`.

## Shape

A state table, not an event log. Exactly 56 rows, fixed OBJECTIDs 2 through 57,
one per crossing, updated in place. Nothing is retained.

The `crossingStatus` domain is `clear` or `blocked`. Confirmed from the
webmap renderer's two `uniqueValueInfos` classes rather than guessed from
observed values.

## No history exists

- `extractChanges` returns 405, "Change tracking is not enabled."
- The `historicMoment` parameter is accepted and silently ignored.
- `hasVersionedData`, `archivingInfo`, and `changeTrackingInfo` are all null.
- No archive layer exists among the organization's 2301 services.

The poller is the only possible source of history. A transition it fails to
record cannot be recovered from any source.

## Update cadence

Measured gaps between service edits: 29.8, 30.2, 29.9, 30.1 seconds. The
interval is 30 seconds and regular.

It is a heartbeat rather than a change signal. `lastEditDate` advances on every
tick whether or not any row changed. The webmap sets `refreshInterval: 0.5` to
match.

Detection latency measured against the feed's own `startTime` ran 21 to 60
seconds, so the upstream pipeline is genuinely realtime.

## Cost

`x-esri-query-request-units: 2` per query, regardless of filter or field
selection. The organization budget header read `usage=178;max=14400` per
minute. One query per minute is negligible against that.

Filtering to the 11 codes with `returnGeometry=false` cuts the response from
32.4 KB to 2.1 KB.

## Field semantics

| Field | While clear | While blocked |
|---|---|---|
| `startTime` | null | epoch ms, authoritative blockage start |
| `trainStart` | null | the same instant, as a string |
| `endTime`, `clearTime` | null | rolling prediction, revised each tick |
| `timeToClear` | null | countdown string, for example "5 MIN" |
| `incidentType` | null | `ROAD_CLOSED` |
| `direction` | null | `BOTH_DIRECTIONS`, a road closure, not a heading |
| `trainTravelDirection`, `trainMovement`, `polyline`, `predictedStart` | null | still null |

Blockage start is free from the feed. Blockage end is not. Train heading is
absent entirely and can only come from crossing ordering.

## Four traps

**`timeUpdated` is not a freshness signal.** Scheduled batch writes contaminate
it. 12 of 56 rows carry values on exact clock boundaries with zero seconds,
where chance would give about one. An earlier analysis concluded from this
field that the corridor sensors were dead. That conclusion was wrong and was
withdrawn. Derive freshness from the poller's own `observed_at` and from the
service-level `editingInfo.lastEditDate` heartbeat.

**The ETag is a table-version token shared across query shapes.** An ETag taken
from a `returnCountOnly` query returns 304 against the full feature query,
verified. Replay an ETag only against a byte-identical URL. It also tracks the
30-second heartbeat rather than semantic change, so it rarely saves a fetch.

**`timeToClear` and `endTime` are unreliable.** One crossing reported "6 MIN"
with `endTime` at 18:26:08, then cleared by 18:20:06. Under a minute against a
six-minute prediction. Advisory only.

**Two crossings are named "Post Oak".** OBJECTID 6 is `440652H`, "POST OAK
SOUTHBOUND FRONTAGE", a different corridor about 16 km south. The corridor one
is OBJECTID 19, `743673P`, "POST OAK ROAD". Match on `code`, never on street.

## The open question

All 11 corridor crossings report `sensorType: V`. Across 50 snapshots at 30
seconds, covering 25 minutes from 13:12 to 13:37 Houston local:

- `sensorType: T`, 5 crossings, all downtown: 4 state changes.
- `sensorType: V`, 51 crossings including all 11 corridor: 0 state changes.

**This is not evidence of a sensor fault.** An earlier reading argued that if V
behaved like T one would expect roughly 30 transitions. That assumed equal base
rates and is withdrawn. Downtown carries near-continuous port rail traffic. The
northwest corridor is sporadic, concentrated in early morning, afternoon, and
late evening. That asymmetry alone explains the observation, and a 25-minute
null sample against sporadic traffic is close to uninformative.

Status: genuinely unknown. The poller observes continuously across all three
windows and answers it in about a day. Do not attempt to resolve it with more
short manual samples.

## Time

Houston is UTC-5 during CDT, confirmed empirically: a page read "Clear at 1:12
PM" when fetched at 18:12 UTC.

| Active window, local | UTC |
|---|---|
| early morning, about 05:00 to 08:00 | 10:00 to 13:00 |
| afternoon, about 12:00 to 17:00 | 17:00 to 22:00 |
| late evening, about 21:00 to 00:00 | 02:00 to 05:00 next day |

Two traps. The late evening window crosses UTC midnight. The change from CDT to
CST in early November shifts every row an hour later in UTC.

Neither trap reaches the poller. The cron is `* * * * *`, so it polls
continuously and never aligns to a local window. There is no schedule to drift.
The traps bind presentation and any later windowed analysis only. Store every
timestamp in UTC, render in `America/Chicago`, and never derive a local hour by
subtracting a fixed offset.

## Geography

The 11 crossings span 12.44 km northwest to southeast. Adjacent gaps run 0.84
to 1.54 km. At the stated 25 mph, roughly 40 km/h, a full traverse takes about
18.7 minutes and adjacent crossings block 1.3 to 2.3 minutes apart. That
interval sets the poll cadence needed for ordering once direction work begins.

## Not yet reachable

`https://www.fra.dot.gov/blockedcrossings/` remains unreachable from this
environment. `fra.dot.gov` fails TLS at the egress proxy and
`railroads.dot.gov` returns 403.

Verified and useful regardless: the ArcGIS `code` field is the federal crossing
identifier. Post Oak is `743673P` in both systems, so FRA data joins to
`crossing.dot_code` with no mapping layer.

Unverified expectation, to confirm before building anything against it: FRA's
reporter is a public complaint portal, self-reported rather than sensor
derived, so it cannot serve live status. Its value would be independent ground
truth on whether these crossings get blocked in practice.
