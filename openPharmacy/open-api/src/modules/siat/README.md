# SIAT Module

Integration with the Servicio de Impuestos Nacionales (SIN) electronic invoicing services (SIAT, Anexo Técnico Ley 1733, V3).

**Status: SIAT-01 done (spec, types, validator). SIAT-03 in progress (client engine).** The module has no HTTP endpoints yet. The SOAP client is built but not yet used by a domain module. Persistence of the request log comes with SIAT-02 (see `docs/documentation/SIAT_Tickets.md`).

## Layout

| Path | Purpose |
|---|---|
| `spec/v3/` | Pinned SIN files: XSD, WSDL, example XML and the Versionamiento. `spec/v3/SOURCES.md` records the URL, date and SHA-256 of each file. |
| `types/generated/` | TypeScript types generated from the XSD. **Do not edit by hand.** |
| `codegen/` | `xsd-to-ts` generator. Supports only the XSD constructs used by the V3 schemas, and throws on anything else. |
| `xml/` | `SiatXsdValidator`, which validates a document against an XSD before it is sent. |
| `config/` | `readSiatConfig` for the `SIAT_*` variables, the `SIAT_CONFIG` token, and `codigoAmbiente` (1 production, 2 pilot). |
| `client/` | The SOAP client engine: operation registry, envelope builder and parser, HTTP transport, errors, and the request-log port. See [SIAT client](#siat-client). |
| `siat.module.ts` | Nest module that wires the client. Not yet imported by the application module. |

## Commands

```bash
npm run siat:verify-spec   # hashes of spec/v3 files must match SOURCES.md
npm run siat:types         # regenerate types/generated from spec/v3/xsd
npm test -- siat           # validator and generator tests
```

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
- **Request log.** Every attempt writes a row with the token redacted, a correlation id, the duration, the outcome, and the caller's metadata. The interim sink writes these rows to the application log. SIAT-02 replaces it with `siat_request_log`. A failed log write does not change the call's result.
- **Authentication header.** Sent as `apikey: TokenApi <token>`, the format used by the open-source PHP client. Confirm it against the V3 annex before the first live call.
- **Not covered yet.** The `verificarComunicacion` health check method (SIAT-20). The connect-timeout path has no test of its own; only the total timeout and a refused connection are tested. The production host is not confirmed.

## Open items

- Nota de Crédito-Débito XSD and example XML are pinned. The original zip was downloaded with TLS verification skipped (see `SOURCES.md`). Re-download with verification enabled, and confirm the hashes match.
- Pages still to save: Generación CUF, Algoritmo de Redondeo, Código Error SIAT, Contingencia, and the Anexo Técnico Versionamiento page with the old-to-V3 diff.
- Confirm the production host and whether it differs from the pilot.
