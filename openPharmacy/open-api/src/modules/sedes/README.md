# SEDES Module

Management boundary for pharmacy branches and regulatory location data.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/sedes` | Create a branch |
| `GET` | `/api/sedes` | List branches |
| `GET` | `/api/sedes/:id` | Read a branch |
| `PATCH` | `/api/sedes/:id` | Update a branch |
| `DELETE` | `/api/sedes/:id` | Remove a branch |

## Implementation status

The controller and DTO surface currently exist, but the service is still a
scaffold and returns placeholder responses. Persistence, branch activation,
controlled-product compliance data, role restrictions, and audit behavior are
not yet complete.
