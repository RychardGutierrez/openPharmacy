# Dashboard Module

Read-only operational metrics and live sale notifications for the dashboard.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/dashboard/kpis` | Summary KPIs |
| `GET` | `/api/dashboard/low-stock` | Products below minimum stock |
| `GET` | `/api/dashboard/expiring` | Expiry and near-expiry lots |
| `GET` | `/api/dashboard/recent-sales` | Recent sale summaries |
| `GET` | `/api/dashboard/sales-trend` | Sales trend data |
| `GET` | `/api/dashboard/units-sold` | Units-sold aggregation |
| `SSE` | `/api/dashboard/stream` | Live sale events |

The repository performs read aggregations. The stream endpoint is backed by an
event subject and should emit only after the originating sale transaction has
committed. Dashboard endpoints are read-only and do not mutate inventory or
financial state.
