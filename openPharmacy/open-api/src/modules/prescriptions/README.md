# Prescriptions Module

HTTP boundary for prescription records associated with regulated-product sales.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/prescriptions` | Create a prescription |
| `GET` | `/api/prescriptions` | List prescriptions |
| `GET` | `/api/prescriptions/:id` | Read a prescription |
| `PATCH` | `/api/prescriptions/:id` | Update a prescription |
| `DELETE` | `/api/prescriptions/:id` | Remove a prescription |

## Implementation status

The controller and DTO surface currently exist, but the service is still a
scaffold and returns placeholder responses. Full prescription persistence,
doctor/product relationships, controlled-product enforcement, and audit rules
remain pending. Sales currently records a soft `SALE_RX_MISSING` audit event
for applicable products rather than enforcing this module at checkout.
