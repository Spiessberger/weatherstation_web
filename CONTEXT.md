# Weather Station Dashboard

This context describes the observations and summaries shown by the local weather station dashboard.

## Language

**Reading**:
A complete sensor report received by the climate data service at a recorded instant. A reading may contain unavailable quantities.
_Avoid_: Sample, measurement

**Reception time**:
The UTC instant when the Linux service received a reading. It is the dashboard's observation time because the station does not provide a measurement timestamp.
_Avoid_: Measurement time, sensor time

**Live reading**:
A reading received by the currently running service process. Its age and gateway availability determine whether the dashboard presents it as current.
_Avoid_: Latest reading

**Retained reading**:
The newest committed historical reading used when the current process has no live reading. It always remains visibly identified as retained data.
_Avoid_: Live fallback, cached live reading

**Rain counter**:
The cumulative millimetre value reported by one station source. It is not rainfall for an individual reading or time range.
_Avoid_: Rain amount

**Rainfall**:
An estimated amount over a time window, calculated from valid positive changes in one station source's rain counter. Its coverage states whether boundary, gap, reset, or source-change uncertainty exists.
_Avoid_: Rain counter

**Night window**:
The most recently started station-local interval from 18:00 through 06:00 the following day. Before 06:00 it is ongoing; from 06:00 until 18:00 the last completed window is used.
_Avoid_: Calendar night, overnight day

**Station time**:
The IANA timezone used for local dates and night boundaries. This station uses `Europe/Vienna`, including daylight-saving transitions.
_Avoid_: Browser time, fixed UTC offset
