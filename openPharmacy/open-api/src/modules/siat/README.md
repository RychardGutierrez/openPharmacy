# SIAT Module

Integration with the Servicio de Impuestos Nacionales (SIN) electronic invoicing services (SIAT, Anexo Técnico Ley 1733, V3).

**Status: SIAT-01 done (spec, types, validator). SIAT-02 done (data model). SIAT-03 done except the live pilot run (token pending). SIAT-04 done (settings and secrets). SIAT-05 done (branches, points of sale, CUIS).** Endpoints: the SIAT settings (see [Settings](#settings-siat-04)) and branches / points of sale (see [Branches, points of sale and CUIS](#branches-points-of-sale-and-cuis-siat-05)). `SiatModule` is imported in `AppModule` and by `ShiftsModule`. With no token configured it starts normally and SIAT calls report `not-configured`.

## Layout

| Path | Purpose |
|---|---|
| `spec/v3/` | Pinned SIN files: XSD, WSDL, example XML and the Versionamiento. `spec/v3/SOURCES.md` records the URL, date and SHA-256 of each file. |
| `types/generated/` | TypeScript types generated from the XSD. **Do not edit by hand.** |
| `codegen/` | `xsd-to-ts` generator. Supports only the XSD constructs used by the V3 schemas, and throws on anything else. |
| `xml/` | `SiatXsdValidator`, which validates a document against an XSD before it is sent. |
| `config/` | `readSiatConfig` for the `SIAT_*` variables, the `SIAT_CONFIG` token, and `codigoAmbiente` (1 production, 2 pilot). |
| `client/` | The SOAP client engine: operation registry, envelope builder and parser, HTTP transport, errors, the request-log port, and `SiatHealthService`. See [SIAT client](#siat-client). |
| `client/__fixtures__/recorded/` | Real pilot responses saved by `npm run siat:live-check -- --record`. Token-free. |
| `persistence/` | `PrismaSiatRequestLogSink`, which writes request log rows to `siat.siat_request_log`. |
| `codes/` | `SiatCodesService` (CUIS lifecycle), the CUIS policy, the renewal job, `SIAT_CLOCK`, typed payloads for `cuis` and the point-of-sale operations, and the provisional point-of-sale type list. |
| `points-of-sale/` | `SiatPointsOfSaleService` and controller (branches, points of sale) and `SiatShiftGate` (used by `shifts`). |
| `siat.module.ts` | Nest module that wires all of the above. |

## Commands

```bash
npm run siat:verify-spec   # hashes of spec/v3 files must match SOURCES.md
npm run siat:types         # regenerate types/generated from spec/v3/xsd
npm test -- siat           # validator and generator tests
npm run siat:live-check    # manual: verificarComunicacion on the pilot (needs SIAT_TOKEN in .env)
npm run siat:live-check -- --record   # same, and saves the responses as test fixtures
```

`siat:live-check` only runs with `SIAT_ENV=pilot`, never prints the token, and is not part of `npm test`.

The generator test fails when the committed types are stale, so run `npm run siat:types` after changing the XSD.

## Library decisions

| Need | Choice | Reason | Rejected |
|---|---|---|---|
| XSD validation | `xmllint-wasm` 5.3.0 | libxml2 compiled to WebAssembly. No native build, so it works on Windows dev machines, in Docker and in CI. MIT. The README documents the `schema` and `preload` inputs. | `libxmljs2` (native, large, last published 2025-06) |
| XML parse (generator) | `fast-xml-parser` 5.12.0, dev dependency | Pure JS, widely used. Parses the XSD into a tree. | `xml2js` (older, heavier) |
| SOAP client | Plain HTTPS (`node:https`) with hand-built SOAP 1.1 envelopes and `fast-xml-parser` for responses. | The WSDLs import their schemas from live URLs (`?wsdl=...`). The `soap` package would fetch them at startup and would not give us explicit connect and total timeouts with an outcome for each failure. The operation names are checked against the pinned WSDLs by a test. | `soap` 1.14.0 (fetches WSDL imports at runtime); Go SDK style hand-built envelopes are the same approach, which we use |
| XSD to TypeScript | In-repo generator | `cxsd` and `xsd2ts` are unmaintained (last published 2022). `xsd2ts` is UNLICENSED. | Hand-written types |

`ctx7` does not index `xmllint-wasm`, so the choice above relies on the package README and not on `ctx7` docs.

## Generated types

Each `xs:sequence` gets an `..._FIELD_ORDER` constant. XSD sequences are order-sensitive, so serialize in that order.

Money fields are generated as `number`. Use decimal-safe arithmetic for IVA and totals (SIAT-11), and round as the "Algoritmo de Redondeo" page specifies. That page is not saved yet.

## Glossary

Terms marked *pending* are not in the annex pages saved so far. Add them when the page is saved.

| Term | Meaning | Source |
|---|---|---|
| **CUIS** | Código Único de Inicio de Sistemas. One valid code per branch or point of sale. Renewable from the fifth day before it expires. | Solicitud CUIS page |
| **CUFD** | Código Único de Facturación Diaria. Issued by the SIN each day. | Solicitud CUFD page, codigos table |
| **CUF** | Código Único de Factura. Identifies each invoice in the anulación and verificación services. The generation algorithm is pending (Generación CUF page). | Anulación Factura and Verificación Estado pages (`cuf` parameter) |
| **CAFC** | Código de autorización de emisión de facturas de contingencia. Null for normal invoices. | Recepción Paquete Factura table (`cafc`) |
| **codigoAmbiente** | `1` production, `2` pruebas y piloto. | Solicitud CUIS page |
| **codigoModalidad** | `1` Electrónica en Línea, `2` Computarizada en Línea. This project uses `2` (decision D1). | Solicitud CUIS page |
| **codigoSucursal** | `0` casa matriz, `1..n` branches. | Solicitud CUIS page |
| **codigoPuntoVenta** | Point of sale number. Send `0` when the transaction does not use a point of sale. | Solicitud CUIS page |
| **codigoDocumentoSector** | Code for the invoice's document sector. Compra-Venta is `1`, and the XSD fixes it to that value. | XSD (`fixed="1"`) |
| **tipoFacturaDocumento** | Code for the invoice type or adjustment document being sent. | Recepción pages |
| **tipoEmision** | *pending* | Not in the saved pages |

## V3 differences

The full diff needs the old annex, which is not saved. What we have so far:

- **Versionamiento 0.1 (15/10/2026):** all XSD and XML were adapted to IVA Transparente. Every XML gained the `codigoInterno` field, which the CUFD response returns.
- **Versionamiento 0.2 (22/10/2026) and 0.4 (27/10/2026):** XSD changes for other sectors. Version 0.4 allows a discount of zero on Nota de Crédito-Débito, Nota de Crédito-Débito ICE and Factura Comercial de Exportación de Hidrocarburos. These do not affect the Computarizada Compra-Venta schema.
- **Verified in the Compra-Venta XSD:** `codigoInterno` and `montoGiftCard`, `descuentoAdicional` and `codigoDocumentoSector` (fixed to `1`) are all present, and the example XML validates against it.

**Known inconsistency:** the header comment in both pinned XSDs (Compra-Venta and Nota de Crédito-Débito) still reads `XSD ver.23/08/2021`, but their content is the V3 version. Trust the content, and the SHA-256 in `SOURCES.md`, not the comment.

**Nota de Crédito-Débito (Computarizada):** the document references the original invoice (`numeroFactura`, `cuf`, `fechaEmisionFactura`, and the original amounts), and it lists the returned amounts and the detail lines. Its detail element needs at least two lines (`minOccurs="2"`), and its `codigoDocumentoSector` is fixed to `24`.

## Services

The WSDL files in `spec/v3/wsdl` describe these operations. The pilot host is `https://pilotosiatservicios.impuestos.gob.bo/v2`, and it is not yet confirmed as the production host.

| WSDL | Operations |
|---|---|
| `FacturacionCodigos` | cuis, cuisMasivo, cufd, cufdMasivo, verificarNit, notificaCertificadoRevocado, verificarComunicacion |
| `FacturacionSincronizacion` | sincronizarFechaHora, sincronizarActividades, and the other `sincronizarLista*` and `sincronizarParametrica*` operations |
| `FacturacionOperaciones` | registroPuntoVenta, consultaPuntoVenta, cierrePuntoVenta, registroEventoSignificativo, consultaEventoSignificativo, cierreOperacionesSistema, verificarComunicacion |
| `ServicioFacturacionCompraVenta` | recepcionFactura, recepcionAnexos, anulacionFactura, reversionAnulacionFactura, verificacionEstadoFactura, recepcionMasivaFactura, recepcionPaqueteFactura, validacionRecepcion*, verificarComunicacion |
| `ServicioFacturacionDocumentoAjuste` | recepcionDocumentoAjuste, anulacionDocumentoAjuste, reversionAnulacionDocumentoAjuste, verificacionEstadoDocumentoAjuste, verificarComunicacion |

The WSDLs import their schemas from the live URL (`?wsdl=<Name>.wsdl`). The copies under `spec/v3/wsdl/imports/` are the same files. Loading them offline requires rewriting the import locations.

## SIAT client

- **Engine, not domain methods.** `SiatSoapClient.invoke(operation, payload, options)` sends one operation and returns a typed `SiatResult` (`transaccion`, `codigoEstado`, `mensajes`, and the raw `payload`). Typed payloads for each operation come with the tickets that use them (SIAT-06, SIAT-07, SIAT-11, and so on).
- **Operations.** `client/siat-operations.ts` declares all 49 operations of the pinned WSDLs. The 30 `read` operations can be retried. The 19 `write` operations are never retried. Operations that issue codes (CUIS, CUFD, notifications) are `write`, because a retry could create a second code. A test checks the list against the WSDLs.
- **Retries and timeouts.** Connect timeout (`SIAT_CONNECT_TIMEOUT_MS`, default 5 s) and total timeout (`SIAT_TOTAL_TIMEOUT_MS`, default 20 s). Reads retry with exponential backoff (`SIAT_READ_RETRIES`, `SIAT_RETRY_BASE_MS`).
- **Outcome of a failure.** `SiatUnavailableError.outcome` is `not-sent` when the request never reached SIAT (refused connection, connect timeout). It is `unknown` when the request was written and then timed out. A timeout does not mean the invoice was rejected, so the caller verifies the status before resending (SIAT-14).
- **Request log.** Every attempt writes a row to `siat.siat_request_log` with the token redacted, a correlation id, the duration, the outcome, the optional point of sale (`options.pointOfSaleId`), and the caller's metadata. A failed log write is logged and does not change the call's result.
- **Payload shape.** Pass one request wrapper, as in the WSDL: `{ SolicitudCuis: { codigoModalidad, ... } }`, with fields in XSD sequence order. `verificarComunicacion` takes `{}`.
- **codigoAmbiente comes from `SIAT_ENV`.** The client inserts it into the wrapper (1 production, 2 pilot) for every operation that has it, and replaces any value sent by the caller. Switching `SIAT_ENV` changes the endpoints and `codigoAmbiente` with no code change. The insertion position is checked against every request type in the WSDLs. `codigoSistema` and `nit` come from the SIAT settings (`SIAT_CREDENTIALS`, see below); each domain ticket puts them in its own request payload.
- **Credentials per call.** The client asks `SIAT_CREDENTIALS` (`ConfigSiatCredentialsSource`) for `{ token, nit, codigoSistema }` on every call, so a token saved in Settings applies to the next call with no restart and no cache. Scripts and tests use `staticSiatCredentials(...)`.
- **Authentication header.** `apikey: TokenApi <token>`, as stated in the annex page "Solicitud Token" (`headers.put("apikey", Arrays.asList("TokenApi " + pToken));`). The token is generated per NIT in the SIAT portal (a separate pilot token exists) with a chosen duration. Renewing it deactivates the old one, so the new token must be loaded the same day.
- **Errors over HTTP.** The global exception filter maps `SiatUnavailableError` to **503** (with `outcome`), and `SiatFaultError` / `SiatProtocolError` to **502**, so a SIAT outage is never a generic 500. SIN fault texts are not sent to the browser.
- **Health check.** `SiatHealthService.checkConnection(service?)` calls `verificarComunicacion` with no retries and never throws. It returns `ok`, `rejected`, `unavailable`, `not-configured` or `error`. For the banner (SIAT-20) and "Test connection" (SIAT-04).
- **Not covered yet.** The production host is not known (needed only at go-live). Fixtures are written by hand from the WSDL until `siat:live-check -- --record` is run with the pilot token.

## Settings (SIAT-04)

ADMIN edits the SIAT settings in **Configuración > Facturación SIAT** (`/settings`). Values live in `pharmacy.config` as keys of the `siat` group (`modules/config/config.keys.ts`).

| Key | Notes |
|---|---|
| NIT | **No SIAT key: SIAT uses `PHARMACY_NIT`** (same value). Edited in the General tab, digits only, and cannot be cleared while `SIAT_ENABLED` is true |
| `SIAT_SYSTEM_CODE` | Código de sistema from the SIN |
| `SIAT_TOKEN` | Token delegado. **Encrypted** with `EncryptionService` (`CONFIG_ENCRYPTION_KEY`), write-only, never returned |
| `SIAT_TOKEN_EXPIRES_AT` | `YYYY-MM-DD`, required with every new token. Valid through that date, counted in La Paz time |
| `SIAT_MODALITY` | Only `2` (Computarizada en Línea, decision D1). Defaults to 2 |
| `SIAT_RAZON_SOCIAL`, `SIAT_MUNICIPIO`, `SIAT_TELEFONO`, `SIAT_DEFAULT_ACTIVITY` | Razón social exactly as in the Padrón, not `PHARMACY_NAME` |
| `SIAT_ENABLED` | Master switch. Can be true only when NIT, system code, razón social, municipio, activity and a non-expired token are set (`SIAT_NOT_READY` with `missing`) |
| `SIAT_EMAIL_INVOICES` | Send invoices by email |

`SIAT_ENV` stays an environment variable, so production can never be switched to the pilot from the UI.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/siat/settings` | Values, token status (`configured`, `source`, `expiresAt`, `expired`, `daysUntilExpiry`), environment (`PILOTO`/`PRODUCCION`) and readiness. Never the token |
| `PATCH` | `/api/siat/settings` | Partial update. An empty `token` keeps the stored one. Audited as `SIAT_CONFIG_UPDATED`, secrets as `[REDACTED]` |
| `POST` | `/api/siat/settings/test-connection` | `verificarComunicacion` (no retries) plus the CUIS **stored** for casa matriz 0 / PoS 0. It does not request a CUIS (SIAT-05) |

All three are ADMIN only. The generic `/api/config` endpoints neither return nor accept `siat` keys (`CONFIG_KEY_NOT_IN_GROUP`), so the SIAT audit event cannot be bypassed.

- **Token source.** The encrypted setting wins. `SIAT_TOKEN` in `.env` is only a fallback when `SIAT_ENV=pilot` (local work and `siat:live-check`); it is rejected at startup in production.
- **Missing `CONFIG_ENCRYPTION_KEY`.** Saving a token answers 503 `CONFIG_ENCRYPTION_KEY_MISSING`. If the key changes, the stored token can no longer be read: SIAT calls fail with `SiatConfigError` and the token must be loaded again.

## Branches, points of sale and CUIS (SIAT-05)

### Decisions

- **`sedes` stays separate.** `siat_branches` is the SIAT branch table, and `sedes` is still a scaffold. Linking them is pending item M1.
- **Shift to point of sale.** `auth.shifts.point_of_sale_id` is a nullable foreign key to `siat.siat_points_of_sale` (migration `20261117043007_siat_05_pos_cuis`). The cashier can pick one, and if only one is active it is used automatically. Several shifts may be open on the same point of sale.
- **Renewal window follows the annex, not the original ticket.** The "Solicitud CUIS" page allows renewal only "a partir del quinto día anterior a su vencimiento". Renewal therefore starts 5 days before expiry (`SIAT_CUIS_RENEW_DAYS`, max 5), and from 15 days out the job only logs a warning (`SIAT_CUIS_ALERT_DAYS`). Requesting earlier would just return the same code.
- **Point-of-sale types are a provisional list** (`codes/siat-point-of-sale-types.ts`: 2–6, without 1 = comisionista, which uses another operation). SIAT-07 replaces it with the synced `sincronizarParametricaTipoPuntoVenta` catalog.
- **Branches are created by ADMIN** (`POST /siat/branches`), exactly as registered in the Padrón. Creating a branch also creates its point of sale 0. Nothing is sent to SIAT.

### CUIS rules (`SiatCodesService.ensureCuis`)

| Stored CUIS | What happens |
|---|---|
| More than 15 days left | Returned with no SIAT call (`valid`) |
| 15 days left or less | Returned with no SIAT call (`alert`). The job logs a warning |
| 5 days left or less, expired, or none | `cuis` is requested from SIAT |

- **"CUIS vigente".** A response with a `codigo` is stored whether `transaccion` is true or false. A known code only updates `valid_until`. A different code deactivates the old row and inserts the new one in the same transaction (at most one active row, by the partial unique index).
- **Concurrency.** The request runs inside a transaction that first takes `SELECT … FOR UPDATE` on the point-of-sale row. A second caller waits, then finds the stored CUIS. The transaction timeout is `SIAT_TOTAL_TIMEOUT_MS` + 15 s.
- **Failures.**
  - `cuis` is a write, so it is never retried.
  - If SIAT fails while the stored CUIS is still valid, that CUIS is kept (`renewalFailed: true`), and the job tries again within the hour.
  - A timed-out request heals itself: the next call gets the same code back as "vigente".
  - With `force`, or when nothing usable is stored, the error is thrown.
  - A response with no `codigo` raises `SiatRejectedError`, returned as **422** with the SIN message codes only.
- **Renewal side effects.**
  - A changed code emits `siat.cuis.renewed` (`SIAT_CUIS_RENEWED_EVENT`). **SIAT-06 must listen for it and request a new CUFD**: the annex requires a new CUFD after a CUIS renewal, and invoice numbering restarts per CUIS.
  - Audit events `SIAT_CUIS_OBTAINED` and `SIAT_CUIS_RENEWED` are written. The code itself is never audited or returned.
- **Renewal job** (`SiatCuisRenewalJob`). Runs every hour and covers active, open points of sale. It does nothing while `SIAT_ENABLED` is false and is disabled under `NODE_ENV=test`.
- **Clock.** `SIAT_CLOCK` (system clock) is injected so tests can use `fixedSiatClock`. SIAT-07 can replace it with a clock corrected by the SIAT time offset.
- **Configuration errors.** A missing token, NIT or system code returns **409** `SIAT_NOT_CONFIGURED` with `missing`, before any SIAT call.

### Point-of-sale operations

`registroPuntoVenta`, `consultaPuntoVenta` and `cierrePuntoVenta` all send the **branch CUIS**, which is the CUIS of point of sale 0 of that branch. It is obtained first when needed.

- **Register.** SIAT assigns `codigoPuntoVenta`. The point of sale is stored as soon as SIAT answers, and its CUIS is requested next. If that CUIS request fails, the point of sale stays and the response reports `cuis.state: 'missing'`. Retry with `POST :id/cuis`.
- **Close (final).** The SIN never reuses the number, and SIAT closes a point of sale only when it has no valid CUIS or CUFD. The flow:
  1. Retire the point of sale (`PATCH active=false`). This also stops CUIS renewal.
  2. Wait for its codes to expire.
  3. `POST :id/close` with `{ "confirm": true }`.

  The API refuses with 409 when shifts are open, when the point of sale is still active, or when a CUIS or CUFD is still valid. Point of sale 0 cannot be closed.
- **Reconcile.** Reports `matched`, `remoteOnly` and `localOnly`, and changes nothing.

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/siat/branches` | List branches |
| `POST` | `/api/siat/branches` | Create a branch (Padrón data) and its point of sale 0 |
| `PATCH` | `/api/siat/branches/:id` | Edit name, address, municipality, phone, `active`. `codigoSucursal` is fixed |
| `GET` | `/api/siat/points-of-sale` | Points of sale with CUIS state, `validUntil`, `daysLeft`, open shifts |
| `GET` | `/api/siat/points-of-sale/types` | Provisional `codigoTipoPuntoVenta` list |
| `POST` | `/api/siat/points-of-sale` | `registroPuntoVenta` + CUIS |
| `PATCH` | `/api/siat/points-of-sale/:id` | Rename, retire or reactivate (a closed one cannot be reactivated) |
| `POST` | `/api/siat/points-of-sale/:id/cuis` | Get or renew the CUIS (`{ "force": true }` asks SIAT even when valid) |
| `GET` | `/api/siat/points-of-sale/reconcile?branchId=` | `consultaPuntoVenta` compared with the stored rows |
| `POST` | `/api/siat/points-of-sale/:id/close` | `cierrePuntoVenta` (`{ "confirm": true }`) |

All are ADMIN only and audited (`SIAT_BRANCH_*`, `SIAT_POS_*`). The shift side is described in `modules/shifts/README.md`.

**Fase I note.** Create at least one extra point of sale in the pilot to show multi-point-of-sale support. Fase I counts CUIS requests per point of sale.

## Data model

Tables live in their own PostgreSQL schema, `siat` (SIAT-02, migration `20261112155757_siat_02_data_model`).

| Table | Purpose | Rules |
|---|---|---|
| `siat_branches` | Branches registered with the SIN | `codigo_sucursal` unique. `0` is the casa matriz. Standalone for now; `sedes` has no table yet and can link to it later |
| `siat_points_of_sale` | Points of sale per branch | Unique (`branch_id`, `codigo_punto_venta`). `tipo_punto_venta` is null for PoS `0`, which is not created with `registroPuntoVenta`. `active=false` = retired, `closed_at` = closed in SIAT (SIAT-05). Referenced by `auth.shifts.point_of_sale_id` |
| `siat_cuis` | CUIS history | At most one `active` row per point of sale (partial unique index `siat_cuis_one_active_per_pos`, raw SQL in the migration) |
| `siat_cufd` | Full CUFD history | Never delete rows: offline invoices and packages refer to old CUFDs. `source` is `SCHEDULED`, `ON_DEMAND` or `EVENT` |
| `siat_catalog_items` | Synchronized SIN catalogs | Unique (`catalog`, `code`). `catalog` is a string (the sync operation name), so a new catalog needs no migration. Codes are strings |
| `siat_request_log` | One row per call attempt, bodies redacted | Indexed by `created_at`, `correlation_id`, (`service`, `operation`, `created_at`) and (`point_of_sale_id`, `created_at`). Partitioning is left for SIAT-27, when volume is known |
| `siat_time_offset` | Clock samples from `sincronizarFechaHora` | The latest row is the current offset. `offset_ms = siat_time - server_time` |

The seed (`npm run db:seed`) creates casa matriz `0` and point of sale `0` for development, and skips them when `NODE_ENV=production`.

## Open items

- Nota de Crédito-Débito XSD and example XML are pinned. The original zip was downloaded with TLS verification skipped (see `SOURCES.md`). Re-download with verification enabled, and confirm the hashes match.
- Pages still to save: Generación CUF, Algoritmo de Redondeo, Código Error SIAT, Contingencia, and the Anexo Técnico Versionamiento page with the old-to-V3 diff.
- Confirm the production host and whether it differs from the pilot.
