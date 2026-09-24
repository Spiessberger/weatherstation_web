# Serve the dashboard and derived history from the climate service

The Raspberry Pi deployment uses the existing Rust climate data service as its single HTTP process: it serves the compiled dashboard on the same origin and computes bounded historical summaries beside the SQLite data. This avoids a second server runtime, CORS, and transferring unbounded raw readings to a browser, while preserving the existing raw history API for the reading table and diagnostics. The frontend remains an independently built static artifact supplied through a configured web-root path.
