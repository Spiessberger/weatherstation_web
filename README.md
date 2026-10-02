# Weather station web dashboard

A compact German/English dashboard for the local `climate-data-service`. It shows live outdoor and indoor conditions, retained fallback readings after a restart, 24-hour rainfall, the latest night minimum, bounded historical charts, range statistics, and paginated raw readings.

The production deployment uses one process: this project builds static files and the Rust service serves them beside its read-only API. Station-local dates and night boundaries use the service's fixed `Europe/Vienna` timezone.

## Requirements

- Node.js 20.19 or newer (or 22.12 or newer) and npm for building the frontend
- The sibling [`climate_data_service`](../climate_data_service) repository and its Rust 1.88 toolchain
- A serial device path for normal collection; the service may also start with a missing path and report the gateway offline

## Development

Start the Rust service on its default port in one terminal. Relative paths are resolved from the service repository in this example:

```sh
cd ../climate_data_service
cargo run --locked -- \
  --serial /dev/serial/by-id/YOUR_GATEWAY \
  --database ../climate.sqlite3
```

Then start Vite from this repository. It proxies `/live`, `/api/*`, and raw `/history/*` API routes to `127.0.0.1:8080` while keeping `/history-view` as a client route:

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. Use the Vite `--host` option only when development access from another trusted LAN device is intentional.

## Production build and single-process run

Build the frontend:

```sh
npm ci
npm run build
```

`dist/` is the complete static artifact; Node.js is not used at runtime. From this web repository, build and run the sibling service with paths relative to the current directory:

```sh
cargo build --locked --manifest-path ../climate_data_service/Cargo.toml --release
../climate_data_service/target/release/climate-data-service \
  --serial /dev/serial/by-id/YOUR_GATEWAY \
  --database ../climate.sqlite3 \
  --listen 0.0.0.0:8080 \
  --web-root ./dist
```

Open `http://RASPBERRY_PI_ADDRESS:8080` from the trusted local network. The service is intentionally read-only and unauthenticated; do not expose it directly to the public internet. `--web-root` may also be an absolute path, which is preferable in a service-manager configuration.

The service starts even when the configured serial path is absent and retries that exact path. In that state the UI can show retained SQLite readings, visibly marked as stored/stale, while gateway status remains offline.

## Checks

```sh
npm run check
npm test
npm run build

cd ../climate_data_service
cargo fmt --check
cargo check --locked --all-targets
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

The frontend tests cover locale and station-time formatting, live/retained selection, initial history recovery, exact chart-range application, rainfall grouping controls and labels, and cancellation between range, rainfall, and table requests. The Rust suite covers aggregate bounds, exact and calendar ranges, Vienna/DST boundaries, rainfall counter semantics, static delivery, and the existing live/raw APIs.

## Data and display semantics

- Times are Linux-host reception times. They are not sensor measurement timestamps.
- A null quantity is unavailable and is never displayed or aggregated as zero.
- Rain readings contain a cumulative station counter. The backend calculates interval rainfall from valid same-station counter changes and reports incomplete coverage when boundaries, long gaps, resets, or source changes make the estimate uncertain.
- Average wind is the arithmetic mean of available sustained-wind readings. Maximum sustained wind and maximum gust are separate.
- History date inputs are inclusive station-local calendar dates. The backend converts them across daylight-saving boundaries and returns the exact UTC interval used by both charts and table.
- History opens on the current Vienna calendar week (Monday–Sunday). Today, this week, this month, and this year select complete calendar periods; the navigation row moves one selected period backward or forward. Editing dates or applying a chart interval switches to a custom range; choose a preset to resume period navigation.
- Dragging across a chart proposes its visible exact interval. Applying that interval updates every history statistic, chart, and table page with the same half-open millisecond range; resetting the chart view does not reload data.
- Rainfall has its own **Group by** selector: Auto, Hourly, Daily, Weekly, and Monthly. Auto uses hourly buckets for up to two station-local dates, daily for up to six weeks, weekly for up to six calendar months, and monthly for longer ranges. Weeks start on Monday; days and months follow Vienna calendar boundaries, including daylight-saving changes.
- A manual rainfall grouping stays selected during period navigation and applied zooms. If it would exceed 600 bars, the service uses Auto and the graph explains the fallback; the manual choice returns for shorter ranges. Changing grouping reloads only the rainfall view and preserves the raw-reading table.
- Rainfall bars cover the intersection of each calendar period with the selected range. The inspector identifies partial periods and ongoing totals as “so far.” Gold indicates incomplete coverage, hollow grey markers mean unavailable rainfall, and a thin baseline mark represents a known zero. Future periods have no rainfall bar.
- Charts receive at most 600 buckets per series. The raw table loads deterministic 100-row pages on demand.

### Rainfall summary API

`GET /api/v1/history/weather/summary` accepts `rain_grouping=auto|hour|day|week|month` alongside its existing date or exact-instant range and `max_points` parameters. The parameter defaults to `auto`. The response retains the detailed weather `buckets` and adds:

- `rain_grouping`: the resolved grouping actually displayed.
- `available_rain_groupings`: explicit groupings that fit the 600-bucket limit for this range.
- `rain_buckets`: separate calendar buckets with exact clipped bounds, rainfall and coverage, `partial_period`, `ongoing`, `future`, and `observed_through_unix_ms`.

Rainfall continues to use the service’s existing counter semantics: each valid change is assigned to the bucket containing the later reading; gaps, resets, and source changes retain their coverage information. Grouping does not redistribute counter changes across periods.

Build and deploy the updated sibling `climate_data_service` together with this frontend; the rainfall view uses these additional API fields.

## Troubleshooting

- **UI loads but values do not:** open `/live` on the same host and check gateway availability, reading timestamps, and storage status.
- **Only stored values appear:** the service has retained history but has not received a valid reading in this process. Check the configured serial path and service logs.
- **History reports busy:** retry after the current aggregate finishes or select a shorter date range. Aggregate work is deliberately bounded for Raspberry Pi responsiveness.
- **Refreshing `/history-view` returns 404:** ensure the current service build is running with `--web-root` pointing at the contents of `dist/`; client routes should return `index.html`.
- **Language resets:** browser storage may be disabled or cleared. German is the intentional default.
