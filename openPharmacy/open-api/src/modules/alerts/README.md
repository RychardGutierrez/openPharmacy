# Alerts Module

Operational alert retrieval and server-sent alert updates.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/alerts` | Read current alerts |
| `SSE` | `/api/alerts/stream` | Subscribe to alert events |

The module currently focuses on lot-expiry alerts and composes data from the
lots and configuration modules. It is read-oriented; alert acknowledgement and
user-specific persistence are not part of the current controller surface.
