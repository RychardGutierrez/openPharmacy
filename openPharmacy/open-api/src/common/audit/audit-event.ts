/**
 * Audit event types tracked by the system.
 *
 * Each event maps to a single row in the `auth.audit_logs` table. The naming
 * follows `{ACTION}_{RESULT}` for auth flows and `{ENTITY}_{ACTION}` for
 * entity changes so filtering by event is straightforward.
 *
 * NOTE: this union lives in `common/audit` because multiple modules (auth,
 * users, etc.) write security-audit rows. Keep it in sync with the actual
 * values written to the database.
 */
export type AuditEvent =
  // Auth events
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAIL'
  | 'LOGIN_LOCKED'
  | 'REFRESH_SUCCESS'
  | 'REFRESH_FAIL'
  | 'LOGOUT'
  // User-management events
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_ACTIVATED'
  // Product-catalog events
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DEACTIVATED'
  | 'PRODUCT_ACTIVATED'
  | 'PRODUCT_BULK_IMPORTED'
  // Lot / inventory events
  | 'LOT_CREATED'
  | 'LOT_UPDATED'
  | 'LOT_VOIDED'
  | 'STOCK_DEDUCTED_FEFO';
