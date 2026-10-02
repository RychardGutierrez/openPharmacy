# Doctors Module

HTTP boundary for doctor records used by prescription workflows.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/doctors` | Create a doctor |
| `GET` | `/api/doctors` | List doctors |
| `GET` | `/api/doctors/:id` | Read a doctor |
| `PATCH` | `/api/doctors/:id` | Update a doctor |
| `DELETE` | `/api/doctors/:id` | Remove a doctor |

## Implementation status

The controller and DTO surface currently exist, but the service is still a
scaffold and returns placeholder responses. Database persistence, validation
rules, role restrictions, and audit behavior should be completed before this
module is treated as production-ready.
