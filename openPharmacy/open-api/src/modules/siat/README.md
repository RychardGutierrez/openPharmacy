# SIAT Module

Integration with the Servicio de Impuestos Nacionales (SIN) electronic invoicing services (SIAT, Anexo Técnico Ley 1733, V3).

**Status: SIAT-01 done (spec, types, validator). SIAT-02 done (data model). SIAT-03 done except the live pilot run (token pending). SIAT-04 done (settings and secrets). SIAT-05 done (branches, points of sale, CUIS). SIAT-06 done (CUFD lifecycle). SIAT-07 done (catalogs and clock). SIAT-08 implemented, pilot check pending (product homologation, see [Product homologation](#product-homologation-siat-08)).** Endpoints: the SIAT settings (see [Settings](#settings-siat-04)), branches / points of sale (see [Branches, points of sale and CUIS](#branches-points-of-sale-and-cuis-siat-05)) and the CUFD request (see [CUFD](#cufd-siat-06)), and the catalogs and clock (see [Catalogs and clock](#catalogs-and-clock-siat-07)). `SiatModule` is imported in `AppModule` and by `ShiftsModule`. With no token configured it starts normally and SIAT calls report `not-configured`.

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
| `codes/` | `SiatCodesService` (CUIS lifecycle), the CUIS policy, the renewal job, `SiatCufdService` with the CUFD policy and job (SIAT-06), `SIAT_CLOCK`, typed payloads for `cuis`, `cufd` and the point-of-sale operations. |
| `catalogs/` | SIN catalogs and date-time (SIAT-07): the registry of the 17 catalogs, the `sincronizar*` payloads and mappers, `SiatCatalogSyncService`, `SiatCatalogsService` (reads and readiness), the daily job and the controller. |
| `codes/siat-offset-clock.ts`, `codes/siat-time-sync.service.ts` | `OffsetSiatClock` (the SIAT clock, `SIAT_CLOCK`) and the clock sample from `sincronizarFechaHora` (SIAT-07). |
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
| **tipoEmision** | Code of the emission type | Synced from `sincronizarParametricaTipoEmision` (SIAT-07, `siat_catalog_items`) |

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
- **Point-of-sale types come from the synced catalog** (`sincronizarParametricaTipoPuntoVenta`, SIAT-07). Comisionista is excluded, because it uses another operation. Until the first sync, `types` and registration answer 409 `SIAT_CATALOG_NOT_SYNCED`.
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
  - A changed code emits `siat.cuis.renewed` (`SIAT_CUIS_RENEWED_EVENT`). `SiatCufdService` listens for it and requests a new CUFD (see [CUFD](#cufd-siat-06)): the annex requires a new CUFD after a CUIS renewal, and invoice numbering restarts per CUIS.
  - Audit events `SIAT_CUIS_OBTAINED` and `SIAT_CUIS_RENEWED` are written. The code itself is never audited or returned.
- **Renewal job** (`SiatCuisRenewalJob`). Runs every hour and covers active, open points of sale. It does nothing while `SIAT_ENABLED` is false and is disabled under `NODE_ENV=test`.
- **Clock.** `SIAT_CLOCK` is the SIAT clock from SIAT-07 (see [Catalogs and clock](#catalogs-and-clock-siat-07)). Tests inject `fixedSiatClock`.
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
| `GET` | `/api/siat/points-of-sale/types` | `codigoTipoPuntoVenta` from the synced catalog (409 until synced) |
| `POST` | `/api/siat/points-of-sale` | `registroPuntoVenta` + CUIS |
| `PATCH` | `/api/siat/points-of-sale/:id` | Rename, retire or reactivate (a closed one cannot be reactivated) |
| `POST` | `/api/siat/points-of-sale/:id/cuis` | Get or renew the CUIS (`{ "force": true }` asks SIAT even when valid) |
| `GET` | `/api/siat/points-of-sale/reconcile?branchId=` | `consultaPuntoVenta` compared with the stored rows |
| `POST` | `/api/siat/points-of-sale/:id/close` | `cierrePuntoVenta` (`{ "confirm": true }`) |

All are ADMIN only and audited (`SIAT_BRANCH_*`, `SIAT_POS_*`). The shift side is described in `modules/shifts/README.md`.

**Fase I note.** Create at least one extra point of sale in the pilot to show multi-point-of-sale support. Fase I counts CUIS requests per point of sale.

## CUFD (SIAT-06)

`SiatCufdService` (`codes/siat-cufd.service.ts`) keeps a valid CUFD for every active point of sale. The rules are pure functions in `codes/siat-cufd-policy.ts`.

### Reading the CUFD for an invoice

- **`currentCufd(posId, at)`** returns the CUFD valid **at `at`**: the most recently issued row with `valid_from <= at < valid_until`.
  - It never calls SIAT, so emission never waits on it.
  - After a rotation two CUFDs overlap, and the newest wins.
  - Offline emission (SIAT-17) passes the emission time and gets the CUFD that was valid then.
  - The CUF (`codigoControl`) and `fechaEmision` must come from the **same** CUFD. That mismatch is the most common Fase I rejection.
- **`requireCufd(posId, at)`** does the same lookup, and answers **409** `SIAT_CUFD_UNAVAILABLE` when nothing is valid.
- The returned record holds the codes. It is for internal use only (CUF, invoice header): no endpoint returns it.

### When a new CUFD is requested

The policy checks the **latest** CUFD of the point of sale, in this order:

| State | When | Action | Can still issue |
|---|---|---|---|
| `missing` | No CUFD was ever stored | Request | No |
| `expired` | The latest CUFD is past `valid_until` | Request | No |
| `stale` | Requested with a CUIS that was replaced since (`cuis_id`) | Request | Yes, while valid |
| `rotate` | Requested before today's rotation time (`SIAT_CUFD_ROTATE_AT`, default **00:05 Bolivia time**, UTC-4) | Request | Yes |
| `renew` | Fewer than `SIAT_CUFD_RENEW_BEFORE_MIN` (60) minutes left | Request | Yes |
| `valid` | None of the above | Nothing | Yes |

- **Two requests a day, on purpose.** A CUFD lasts 24 h from its request. With the defaults, the safety net renews at about 23:05, and the rotation renews again at 00:05.
  - The safety net guarantees an overlap, so there is never a gap at rotation time.
  - The rotation keeps one CUFD per Bolivian calendar day.
  - The test `a point of sale is never without a valid CUFD across midnight` checks this minute by minute.
- **`valid_from`** is the time the SIAT answer arrived (`SIAT_CLOCK`), so a CUFD never claims validity from before SIAT issued it.
- **`cuis_id`** records the CUIS used for the request. **`codigo_interno`** stores `codigoInterno` when SIAT returns it. The annex page lists that field, but the pinned WSDL `respuestaCufd` does not.

### `ensureCufd(posId, { source, force })`

- **CUIS first.** It gets the CUIS through `SiatCodesService.cuisCode` **before** opening its transaction. That call takes its own row lock on the same point of sale, so calling it inside the transaction would deadlock.
- **Concurrency.** The request runs under `SELECT … FOR UPDATE` on the point-of-sale row, and the state is checked again inside the lock. Concurrent callers (shift open, admin, job, CUIS event) therefore cause a single SIAT request.
- **Failures.**
  - `cufd` is a write, so the client never retries it.
  - If SIAT fails while the stored CUFD is still usable (`renew`, `rotate`, `stale`), that CUFD is kept (`renewalFailed: true`).
  - With `force`, or when nothing usable is stored, the error is thrown.
  - A response without `codigo`, `codigoControl`, `direccion` or `fechaVigencia` raises `SiatRejectedError` (**422**), and nothing is stored.
- **CUIS renewal.** `onCuisRenewed` listens to `siat.cuis.renewed` and requests a CUFD with the new CUIS. It never throws. If the event is lost, the `stale` state makes the next sweep do it.

### Job and retries (`SiatCufdJob`)

- **Schedule.** The job sweeps every `SIAT_CUFD_SWEEP_MS` (1 min) and covers active, open points of sale of active branches.
  - The policy decides what is due, so there is no cron entry, and the rotation happens within one interval of 00:05.
  - It does nothing while `SIAT_ENABLED` is false, and it is disabled under `NODE_ENV=test`.
- **Backoff.** After a failed request, that point of sale waits 1, 2, 4, 8 … minutes, capped at `SIAT_CUFD_RETRY_MAX_MS` (15 min), before the next attempt.
  - A success resets the wait.
  - Each attempt is in `siat_request_log`, and failures are logged with their attempt number.
  - The backoff lives in memory, per API instance.
- **No CUFD at all.** When a point of sale has no valid CUFD and the request fails, the job logs an error and emits **`siat.cufd.unavailable`** (`SIAT_CUFD_UNAVAILABLE_EVENT`) once per outage. SIAT-17 (contingency) and SIAT-27 (alerts) will subscribe to it.

### Shifts and admin

- **Shift open** (`SiatShiftGate`). With SIAT enabled, once the CUIS is usable, `ensureCufd(ON_DEMAND)` runs.
  - The shift opens if the result is usable, which includes a stored CUFD that is still valid while SIAT is down.
  - Otherwise it answers 409 `SIAT_POS_NOT_READY`.
  - Owner decision (2026-11-26): no shift without a CUFD until SIAT-17 adds contingency.
- `GET /api/siat/points-of-sale` now includes `cufd: { state, validUntil, minutesLeft }`.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/siat/points-of-sale/:id/cufd` | Get a CUFD when the stored one needs renewal. `{ "force": true }` always asks SIAT, for operations and the Fase I CUFD counts (SIAT-25). Returns the status, never the codes |

- **Audit.** It is ADMIN only. A newly issued CUFD is audited as `SIAT_CUFD_REQUESTED`, without the codes. Scheduled renewals are not audited, because `siat_cufd` and `siat_request_log` already record them.

| Variable | Default | Meaning |
|---|---|---|
| `SIAT_CUFD_ROTATE_AT` | `00:05` | Daily rotation, Bolivia time (`HH:mm`) |
| `SIAT_CUFD_RENEW_BEFORE_MIN` | `60` | Safety net: renew with fewer minutes left |
| `SIAT_CUFD_SWEEP_MS` | `60000` | Job interval |
| `SIAT_CUFD_RETRY_MAX_MS` | `900000` | Cap for the retry backoff |

## Catalogs and clock (SIAT-07)

Synchronizes the 17 SIN catalogs (`sincronizar*` operations of `FacturacionSincronizacion`) and the SIAT date-time. Each invoice field that takes a code is checked against these tables before SIAT sees it.

### Catalogs

| Slug | Operation | Required for emission | Public |
|---|---|---|---|
| `activities` | `sincronizarActividades` | yes | yes (SIAT-08) |
| `legends` | `sincronizarListaLeyendasFactura` | yes | no |
| `activity-document-sectors` | `sincronizarListaActividadesDocumentoSector` | yes | no |
| `products` | `sincronizarListaProductosServicios` | no | yes (SIAT-08) |
| `service-messages` | `sincronizarListaMensajesServicios` | no | no |
| `significant-events` | `sincronizarParametricaEventosSignificativos` | no | no |
| `cancellation-reasons` | `sincronizarParametricaMotivoAnulacion` | no | yes |
| `countries` | `sincronizarParametricaPaisOrigen` | no | no |
| `document-types` | `sincronizarParametricaTipoDocumentoIdentidad` | yes | yes |
| `document-sectors` | `sincronizarParametricaTipoDocumentoSector` | yes | no |
| `emission-types` | `sincronizarParametricaTipoEmision` | yes | no |
| `room-types` | `sincronizarParametricaTipoHabitacion` | no | no |
| `payment-methods` | `sincronizarParametricaTipoMetodoPago` | yes | yes |
| `currencies` | `sincronizarParametricaTipoMoneda` | yes | yes |
| `pos-types` | `sincronizarParametricaTipoPuntoVenta` | no | no |
| `invoice-types` | `sincronizarParametricaTiposFactura` | yes | no |
| `units` | `sincronizarParametricaUnidadMedida` | yes | yes |

The "required" set is the team's reading of what SIAT-11 emits. It is not yet confirmed against the Fase I checklist.

- **Keys.** The stored `catalog` is the operation name. Activities use `codigoCaeb`. Activity ↔ sector uses `codigoActividad:codigoDocumentoSector`. Products use `codigoActividad:codigoProducto`, with `nandina` in `extra`. Parametric catalogs use `codigoClasificador`. **Legends have no code in SIAT**, so each one is keyed by its activity and the first 16 hex characters of the SHA-256 of its text.
- **Idempotent.** A sync writes only rows whose content changed. Codes that leave the SIN list are set `active=false`. They are never deleted, because old invoices refer to them. They are reactivated if they come back.
- **One transaction per catalog**, under `pg_advisory_xact_lock(hashtext('siat-catalog:' || catalog))`, so several API instances never write the same catalog at once.
- **Failures change nothing.** A refused request (`transaccion=false`) or an empty list while active codes exist is recorded in `siat_catalog_sync.last_error`, and the active codes stay. One failing catalog does not stop the others.
- **Calls** use the CUIS of casa matriz (branch 0, point of sale 0), with `codigoPuntoVenta` 0. The client never retries writes, and these are reads, so they retry as usual.
- **Legend for an invoice.** `SiatCatalogsService.randomLegend(activity)` picks one of the active legends of the activity at random (SIAT expert rule).
- **Readiness.** `assertReadyForEmission()` answers 409 `SIAT_CATALOGS_MISSING` with `missing`. The list holds the required catalogs with no active code, and `defaultActivity` when `SIAT_DEFAULT_ACTIVITY` is not set. It also holds `activity:<code>` when that activity has no active code, and `legends:<code>` when it has no legend. SIAT-11 calls it before emitting. It does not block enabling SIAT (owner decision).

### Clock

- `OffsetSiatClock` is `SIAT_CLOCK`. `now()` is the server time plus an offset held in memory. The offset is loaded from `siat_time_offset` at startup, and it is 0 until the first sample.
- A sample calls `sincronizarFechaHora` **without retries**. The offset is the SIN time minus the midpoint of the request and response times. A sample whose round trip is above `SIAT_CLOCK_MAX_RTT_MS` (2 s) is discarded.
- **Every offset is applied.** Above `SIAT_CLOCK_WARN_MS` (5 s) the sample is logged as a warning and emits `siat.clock.drift` (`SIAT_CLOCK_DRIFT_EVENT`). Above 5 minutes it is logged as an error. SIAT-20 and SIAT-27 subscribe to the event.
- **Stays on server time:** the request log timing and the token expiry dates in the settings. They are not SIAT timestamps.

### Jobs (`SiatSyncJob`)

- **Clock:** every `SIAT_CLOCK_SYNC_MS` (1 h).
- **Catalogs:** once a day after `SIAT_CATALOG_SYNC_AT` (Bolivia time, default 01:00). A sweep every 5 min runs the sync when some catalog has no success since that time. A failing catalog is retried at most every 30 min.
- Both are no-ops while `SIAT_ENABLED` is false, and they are disabled under `NODE_ENV=test`. The manual sync works as soon as the settings are complete, so catalogs can be loaded before SIAT is enabled.

### Endpoints

| Method | Route | Role | Purpose |
|---|---|---|---|
| `GET` | `/api/siat/catalogs` | ADMIN | Per-catalog counts and sync state, `failing`, `missingForEmission` and the clock |
| `GET` | `/api/siat/catalogs/:catalog` | Any role for public catalogs, ADMIN otherwise | Active codes. Query: `parentCode`, `search`, `includeInactive`, `page`, `pageSize` (max 200) |
| `POST` | `/api/siat/catalogs/sync` | ADMIN | Sync now: every catalog and the clock. Audited as `SIAT_CATALOGS_SYNCED` with counts only |

- **Settings response.** `GET /api/siat/settings` does not include catalog status. `SiatSettingsService` would then depend on the catalogs, which depend on it. The "Catálogos y hora SIAT" card reads `GET /api/siat/catalogs` instead.
- **Point-of-sale types** (`GET /points-of-sale/types` and registration) read the synced `pos-types` catalog.

| Variable | Default | Meaning |
|---|---|---|
| `SIAT_CATALOG_SYNC_AT` | `01:00` | Daily catalog sync, Bolivia time (`HH:mm`) |
| `SIAT_CLOCK_SYNC_MS` | `3600000` | Clock re-sample interval |
| `SIAT_CLOCK_WARN_MS` | `5000` | Drift threshold for the warning and `siat.clock.drift` |
| `SIAT_CLOCK_MAX_RTT_MS` | `2000` | Largest round trip accepted for a clock sample |

## Product homologation (SIAT-08)

Products carry `sin_activity_code`, `sin_product_code` and `sin_unit_code`
(migration `20261126230000_siat_08_product_homologation`), with defaults per category in
`pharmacy.product_sin_defaults`. The rules, endpoints and the `PRODUCT_NOT_HOMOLOGATED` sale guard
are in [`modules/products/README.md`](../products/README.md#sin-homologation-siat-08).

What this module provides for it:

- `activities` and `products` are now **public** catalogs, so PHARMACIST can search them through
  `GET /api/siat/catalogs/:catalog` when coding products. They hold no secrets.
- `SiatCatalogsService.validateSinCodes({activityCode, productCode, unitCode})` returns the
  failing fields. The product code is looked up as `activity:product`, which also proves that it
  belongs to the activity, as the SIN requires.
- `SiatCatalogsService.hasActiveCodes(slug)` tells whether a catalog has been synced. Product
  validation is skipped until `activities` is synced.
- A code that later leaves the SIN list (`active=false`) stays on products that already use it.
  New writes are rejected. Reporting stale codes is not implemented yet.

## Buyers and NIT verification (SIAT-10)

Code lives in `buyers/`. The rules are pure functions in `buyers/siat-buyer-rules.ts` (`resolveBuyer`), so the builder (SIAT-11), the outbox (SIAT-14) and the POS (SIAT-16) all apply the same ones.

### Buyer rules (`resolveBuyer`)

| Rule | Behavior |
|---|---|
| Document type | Must be an active code of the `document-types` catalog (`SIAT_DOC_TYPE`: 1 CI, 2 CEX, 3 PAS, 4 OD, 5 NIT). Until it is synced, `resolve` answers 409 `SIAT_CATALOG_NOT_SYNCED` |
| Number | At most 20 characters (XSD). CI and NIT are digits only. CEX, PAS and OD allow letters, digits and `-` (uppercased) |
| Complemento | CI only, at most 5 letters or digits, trimmed and uppercased. On any other type: 422 `SIAT_BUYER_COMPLEMENT_NOT_ALLOWED` |
| S/N | No buyer, number `0`, or the name `S/N` with no number: becomes `SIAT_SN_BUYER` (`S/N`, number `0`) when the total is at most **Bs 1,000.00** |
| Bs 1,000 limit | Above Bs 1,000.00 an anonymous buyer gets 422 `SIAT_BUYER_REQUIRED`. Totals are compared in cents |
| `codigoExcepcion` | `null` by default. It is `1` only for a NIT buyer whose stored check failed **and** whose request has `confirmInvalidNit: true`. If the check failed and there is no confirmation: 422 `SIAT_NIT_INVALID`. A confirmation for a CI, an anonymous buyer, or a valid or unchecked NIT: 422 `SIAT_NIT_EXCEPTION_NOT_ALLOWED` |
| Special codes | Numbers 99001 (exempt entities), 99002 (control tributario) and 99003 ("VENTAS MENORES DEL DÍA" consolidation) are ADMIN only (403 `SIAT_BUYER_SPECIAL_CODE_FORBIDDEN`), use the NIT type, and are never verified or stored as customers. 99002 and 99003 have default names |
| `codigoCliente` | Given, or the document number (plus `-complemento`) |

### NIT verification (`SiatNitVerificationService`)

- Only NITs are sent to `verificarNit`. CI, CEX, PAS and OD numbers never reach SIAT. NIT `0` and the special codes are refused (422 `SIAT_NIT_FORMAT`) with no call.
- The request uses the CUIS of the caller's **open-shift point of sale** and the `codigoSucursal` of its branch. `SolicitudVerificarNit` has no `codigoPuntoVenta`. With no open shift: 409 `SHIFT_NOT_OPEN`. With a shift that has no point of sale: 409 `SIAT_SHIFT_WITHOUT_POS`.
- `valid` is `transaccion`. The annex lists no NIT-specific response codes, so the SIN messages are returned and stored as they come.
- **Cache** (`siat.siat_nit_verifications`, migration `siat_10_nit_verifications`). One row per NIT, holding the last answer.
  - A valid answer is reused for 24 h (`cached: true`, no SIAT call).
  - A failed answer is never served from the cache. It backs a `codigoExcepcion` confirmation in `resolve` for 30 minutes.
  - SIAT errors store nothing.
- Each SIAT answer is audited as `SIAT_NIT_VERIFIED` (NIT, valid, codes, point of sale). Cache hits are not audited.

### `codigoExcepcion` audit

`SiatBuyerService.recordExceptionUse(tx, { userId, saleId, invoiceId?, buyer })` writes `SIAT_CODIGO_EXCEPCION_USED` with the user and the sale through `createInTx`. SIAT-14 must call it inside the transaction that creates the invoice, so the audit row exists if and only if the invoice does. It does nothing when `codigoExcepcion` is not 1.

### Customers

`SiatCustomersService.search` is a prefix search on `doc_number`, at most 10 rows. `upsertFromInvoice(tx, buyer)` creates or refreshes the customer keyed on (`doc_type`, `doc_number`, `complement`) inside the invoice transaction (SIAT-14). A missing email does not erase a known one. Anonymous and special buyers are never stored.

### Endpoints

| Method | Route | Roles | Purpose |
|---|---|---|---|
| `POST` | `/api/siat/buyers/verify-nit` | CASHIER, PHARMACIST | `{ nit }` → `{ nit, valid, cached, verifiedAt, codigoEstado, messages }` |
| `POST` | `/api/siat/buyers/resolve` | CASHIER, PHARMACIST, ADMIN | `{ buyer?, total, confirmInvalidNit? }` → the normalized buyer, `codigoExcepcion` and `nitCheck` (`VALID`, `INVALID`, `UNCHECKED`, or null for a non-NIT buyer). Never calls SIAT |
| `GET` | `/api/siat/buyers/customers?docNumber=&docType=` | CASHIER, PHARMACIST, ADMIN | Customer autocomplete |

## Data model

Tables live in their own PostgreSQL schema, `siat` (SIAT-02, migration `20261112155757_siat_02_data_model`).

| Table | Purpose | Rules |
|---|---|---|
| `siat_branches` | Branches registered with the SIN | `codigo_sucursal` unique. `0` is the casa matriz. Standalone for now; `sedes` has no table yet and can link to it later |
| `siat_points_of_sale` | Points of sale per branch | Unique (`branch_id`, `codigo_punto_venta`). `tipo_punto_venta` is null for PoS `0`, which is not created with `registroPuntoVenta`. `active=false` = retired, `closed_at` = closed in SIAT (SIAT-05). Referenced by `auth.shifts.point_of_sale_id` |
| `siat_cuis` | CUIS history | At most one `active` row per point of sale (partial unique index `siat_cuis_one_active_per_pos`, raw SQL in the migration) |
| `siat_cufd` | Full CUFD history | Never delete or update rows: offline invoices and packages refer to old CUFDs. `source` is `SCHEDULED`, `ON_DEMAND` or `EVENT`. `codigo_interno` and `cuis_id` added by SIAT-06 (migration `20261126155118_siat_06_cufd`) |
| `siat_catalog_items` | Synchronized SIN catalogs | Unique (`catalog`, `code`). `catalog` is a string (the sync operation name), so a new catalog needs no migration. Codes are strings. `parent_code` (activity), `active` (false = left the SIN list, never deleted) and `updated_at` added by SIAT-07 (migration `siat_07_catalogs`) |
| `siat_catalog_sync` | Freshness of each catalog | One row per catalog: last attempt, last success, item count and last error (SIAT-07) |
| `siat_request_log` | One row per call attempt, bodies redacted | Indexed by `created_at`, `correlation_id`, (`service`, `operation`, `created_at`) and (`point_of_sale_id`, `created_at`). Partitioning is left for SIAT-27, when volume is known |
| `siat_time_offset` | Clock samples from `sincronizarFechaHora` | The latest row is the current offset. `offset_ms = siat_time - server_time` |
| `siat_invoices` | Invoices and credit notes, and the outbox the worker claims (SIAT-09, migration `siat_09_invoices`) | See "Invoices (SIAT-09)" below |
| `siat_invoice_items` | Line snapshots of an invoice | Unique (`invoice_id`, `line_number`). Frozen once the invoice has its XML |
| `siat_invoice_sequences` | Next number per (CUIS, document type) | Reserved with `SiatInvoiceSequenceRepository.reserveNumber` |
| `pharmacy.customers` | Buyers for autocomplete (SIAT-10) | Unique (`doc_type`, `doc_number`, `complement`). `complement` is `''` when absent. Written by `SiatCustomersService.upsertFromInvoice` |
| `siat_nit_verifications` | Last `verificarNit` answer per buyer NIT (SIAT-10, migration `siat_10_nit_verifications`) | `nit` primary key. Valid answers are reused for 24 h. Failed ones back a `codigoExcepcion` confirmation for 30 minutes |

### Invoices (SIAT-09)

- **Snapshots.** An invoice stores its buyer and each line (SIN codes, description, quantity, unit, price) as columns. The XML is built only from them, never from `products` or `customers`, so later edits never change an issued invoice. `customer_id` is a convenience link only.
- **V3 amounts.** Columns use the V3 XSD names (IVA Transparente): `sub_total_neto`, `descuento_adicional`, `monto_gift_card`, `total_precio_neto`, `iva`, `monto_a_pagar`, `monto_total_moneda`. The old `montoTotal` no longer exists. The line price is `precio_neto_unitario`. A credit note stores its returned amounts in the same columns, and reads the originals from `original_invoice_id`.
- **Numbering.** One counter per CUIS and document type. Numbers restart with each CUIS, and invoices and credit notes do not share a series. Unique (`point_of_sale_id`, `cuis_id`, `document_type`, `numero_factura`). Call `reserveNumber` inside the transaction that inserts the invoice: the upsert locks the counter row, and a rollback gives the number back. A rejected number is never reused: an `OBSERVED` invoice is re-emitted as a new row with a new number, linked by `replaces_invoice_id`.
- **Nullable until later.** `cuf` (SIAT-12, it depends on `tipo_emision`), `fecha_emision` and `xml` are null while the invoice is `PENDING`. `cuf` is unique.
- **Never update what SIAT received.** Once `siat_reception_code` is set, a trigger (`siat_invoices_freeze_received`) rejects changes to the number, CUF, dates, buyer, amounts, links, XML and hash. Status, attempts, cancellation and package fields stay writable. Another trigger rejects updating or deleting an invoice's items once it has its XML. Corrections are a cancellation plus a new invoice, or a credit note.
- **Checks.** `tipo_emision` is 1 (online) or 2 (offline). An `INVOICE` needs `sale_id`. A `CREDIT_NOTE` needs `return_id` and `original_invoice_id`. Links to sales, returns and other invoices are `RESTRICT`, so a delete can never unlink a tax document.
- **Worker index.** (`status`, `locked_until`).
- **Deferred.** `event_id` and `package_id` have no foreign key yet: SIAT-17 and SIAT-18 add the tables and the keys. `sales.requires_invoice` and `sales.invoice_id` exist but nothing writes them until SIAT-14.

The seed (`npm run db:seed`) creates casa matriz `0` and point of sale `0` for development, and skips them when `NODE_ENV=production`.

**DEMO SIN catalogs (SIAT-08).** `prisma/seed-siat-catalogs.ts` adds 2 activities, 7 products and 6 units so the product "Codificación SIN" pickers work without a pilot token. It runs from the seed, or alone with `npx tsx prisma/seed-siat-catalogs.ts`, which touches nothing else. It is skipped in production. The codes are fake (they start with `99`) and the descriptions start with "(DEMO)". A real sync never returns them, so it marks them inactive. Products that still use them then fail validation on their next save. Replace them with real codes before the pilot.

## Open items

- Nota de Crédito-Débito XSD and example XML are pinned. The original zip was downloaded with TLS verification skipped (see `SOURCES.md`). Re-download with verification enabled, and confirm the hashes match.
- Pages still to save: Generación CUF, Algoritmo de Redondeo, Código Error SIAT, Contingencia, and the Anexo Técnico Versionamiento page with the old-to-V3 diff.
- Confirm the production host and whether it differs from the pilot.
- SIAT-10 constants to confirm in the annex or in pilot:
  - the document type of the S/N buyer (`SIAT_SN_BUYER`, now CI with number `0`);
  - the document type and names for 99001/99002/99003;
  - whether a `transaccion=false` from `verificarNit` can mean something other than an invalid NIT (for example a CUIS problem). Today that would still allow the `codigoExcepcion` confirmation.
