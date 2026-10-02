# Reports Module

Report preview, generation, storage, downloads, and notifications.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/reports` | Create a report job or generate synchronously |
| `POST` | `/api/reports/preview` | Preview report data |
| `GET` | `/api/reports` | List report jobs |
| `GET` | `/api/reports/:id` | Read report job status |
| `GET` | `/api/reports/:id/download` | Download an authorized report |
| `SSE` | `/api/reports/stream` | Stream job status events |
| `GET` | `/api/reports/d/:token` | Download through a signed email link |

## Implementation notes

- Excel output uses ExcelJS and PDF output uses Puppeteer/Chromium.
- Small reports can be generated synchronously; larger jobs are queued in the
  `pharmacy.report_jobs` table and claimed by an in-process worker.
- Signed download links are time limited and use a dedicated HMAC secret when
  configured, falling back to the access secret.
- Generated files and job status are retained according to report settings in
  the environment configuration.

The module depends on configuration, mailer, audit, report repositories,
generators, a worker, and notification services. See `.env.example` for
report thresholds, limits, retention, and Chromium configuration.
