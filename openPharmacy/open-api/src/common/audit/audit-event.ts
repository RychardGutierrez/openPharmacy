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
  | 'PASSWORD_CHANGED'
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
  | 'PRODUCT_PRICE_CHANGED'
  // Lot / inventory events
  | 'LOT_CREATED'
  | 'LOT_UPDATED'
  | 'LOT_VOIDED'
  | 'STOCK_DEDUCTED_FEFO'
  // Shift / cash-register events
  | 'SHIFT_OPENED'
  | 'SHIFT_CLOSED'
  | 'SHIFT_REOPEN_REQUESTED'
  | 'SHIFT_REOPENED'
  | 'SHIFT_REOPEN_REQUEST_REJECTED'
  // Sales events
  | 'SALE_COMPLETED'
  | 'SALE_RX_MISSING'
  | 'SALE_CANCELLED'
  | 'RETURN_COMPLETED'
  // Supplier-management events
  | 'SUPPLIER_CREATED'
  | 'SUPPLIER_UPDATED'
  | 'SUPPLIER_DEACTIVATED'
  | 'SUPPLIER_ACTIVATED'
  // Purchase-order events
  | 'PURCHASE_ORDER_CREATED'
  | 'PURCHASE_ORDER_SUBMITTED'
  | 'PURCHASE_ORDER_UPDATED'
  | 'PURCHASE_ORDER_RECEIVED'
  // Inventory adjustment events
  | 'INVENTORY_ADJUSTMENT_REQUESTED'
  | 'INVENTORY_ADJUSTMENT_APPROVED'
  | 'INVENTORY_ADJUSTMENT_REJECTED'
  // Stock integrity events
  | 'LOT_INITIAL_STOCK_CREATED'
  | 'SALE_MOVEMENT_CREATED'
  // Reporting / export events
  | 'REPORT_REQUESTED'
  | 'REPORT_GENERATED'
  | 'REPORT_FAILED'
  | 'REPORT_DOWNLOADED'
  // Configuration events
  | 'CONFIG_UPDATED'
  // SIAT settings (SIAT-04). Secret values are recorded as [REDACTED].
  | 'SIAT_CONFIG_UPDATED'
  // SIAT branches, points of sale and CUIS (SIAT-05). The CUIS code is never recorded.
  | 'SIAT_BRANCH_CREATED'
  | 'SIAT_BRANCH_UPDATED'
  | 'SIAT_POS_REGISTERED'
  | 'SIAT_POS_UPDATED'
  | 'SIAT_POS_CLOSED'
  | 'SIAT_CUIS_OBTAINED'
  | 'SIAT_CUIS_RENEWED'
  // Manual or scheduled catalog sync (SIAT-07). The summary is recorded, not the codes.
  | 'SIAT_CATALOGS_SYNCED'
  // CUFD requested by an ADMIN (SIAT-06). Scheduled renewals are not audited: siat_cufd and
  // siat_request_log already record them. The CUFD codes are never recorded.
  | 'SIAT_CUFD_REQUESTED';
