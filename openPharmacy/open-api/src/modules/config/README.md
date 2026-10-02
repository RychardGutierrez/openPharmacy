# Configuration Module

Pharmacy configuration values, runtime-safe configuration, and logo assets.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/config` | Read editable configuration |
| `GET` | `/api/config/runtime` | Read safe runtime configuration |
| `GET` | `/api/config/logo/:filename` | Serve a stored logo |
| `GET` | `/api/config/:key` | Read one configuration value |
| `PATCH` | `/api/config/:key` | Update one value |
| `PATCH` | `/api/config` | Update multiple values atomically |
| `POST` | `/api/config/logo` | Upload a pharmacy logo |

Sensitive configuration is encrypted at rest and runtime responses expose only
safe values. Updates are audited. Logo storage validates uploaded files and
serves only stored assets through the dedicated logo route.
