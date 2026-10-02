# Billing Module

HTTP boundary for billing documents associated with completed pharmacy sales.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/billing` | Create a billing record |
| `GET` | `/api/billing` | List billing records |
| `GET` | `/api/billing/:id` | Read a billing record |
| `PATCH` | `/api/billing/:id` | Update a billing record |
| `DELETE` | `/api/billing/:id` | Remove a billing record |

## Implementation status

The controller and DTO surface currently exist, but the service is still a
scaffold and returns placeholder responses. Tax-document validation,
integration with sales, persistence, authorization, and audit behavior must be
implemented before production use.
