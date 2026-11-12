# SIAT spec sources — Anexo Técnico Ley 1733 (V3)

Pinned copies of the SIN specification files used by the `siat` module.
Do not edit these files by hand. Replace them only by downloading again and updating this table.

- **Annex version:** V3 (IVA Transparente). Latest entry in the Versionamiento is **0.4 (27/10/2026)**.
- **Retrieved:** 2026-11-11.
- **Environment:** the WSDLs were downloaded from the **pilot** host `pilotosiatservicios.impuestos.gob.bo/v2`. The production host is not yet confirmed. Do not treat these WSDLs as production endpoints.

## Files

| File | Source URL | SHA-256 |
|---|---|---|
| `wsdl/FacturacionCodigos.wsdl` | https://pilotosiatservicios.impuestos.gob.bo/v2/FacturacionCodigos?wsdl | `f4fb0fbdbbfd04ec16b7f607e72a4e1305c823efaf0f5b3182a7c50ed225f464` |
| `wsdl/FacturacionSincronizacion.wsdl` | https://pilotosiatservicios.impuestos.gob.bo/v2/FacturacionSincronizacion?wsdl | `da4510a70a159cd621cbaf5d2155ea7e26ec3200cc6115d593ae504545bcb6ac` |
| `wsdl/FacturacionOperaciones.wsdl` | https://pilotosiatservicios.impuestos.gob.bo/v2/FacturacionOperaciones?wsdl | `ecdddcf83cc99a63fc6fcc261ae5c36db9789d5632d35dc9503efff2405ec024` |
| `wsdl/ServicioFacturacionCompraVenta.wsdl` | https://pilotosiatservicios.impuestos.gob.bo/v2/ServicioFacturacionCompraVenta?wsdl | `8fc01968442f8cb012ecfb6053de91f57ef01261decc2dfe6863b6a108785b69` |
| `wsdl/ServicioFacturacionDocumentoAjuste.wsdl` | https://pilotosiatservicios.impuestos.gob.bo/v2/ServicioFacturacionDocumentoAjuste?wsdl | `128cdd8176730490d9fd9581fe7863a94e30f181504f02784a8e82c074442479` |
| `wsdl/imports/FacturacionCodigos--ServicioFacturacionCodigos.wsdl` | `…/v2/FacturacionCodigos?wsdl=ServicioFacturacionCodigos.wsdl` | `b110e0ad1589a779339ee2f097d3ff7d8846d7f9bceab9b19647af63a862b59f` |
| `wsdl/imports/FacturacionSincronizacion--ServicioFacturacionSincronizacion.wsdl` | `…/v2/FacturacionSincronizacion?wsdl=ServicioFacturacionSincronizacion.wsdl` | `0a1d542f46d92a3516a77c0679ca2babb514cd31632f0a9626ee03099c976fee` |
| `wsdl/imports/FacturacionOperaciones--ServicioFacturacionOperaciones.wsdl` | `…/v2/FacturacionOperaciones?wsdl=ServicioFacturacionOperaciones.wsdl` | `6b96981f74e16465bab0350b066fd8d9f001e001e19218f070bc9109d14dda0d` |
| `wsdl/imports/ServicioFacturacionCompraVenta--ServicioFacturacion.wsdl` | `…/v2/ServicioFacturacionCompraVenta?wsdl=ServicioFacturacion.wsdl` | `a51fcca25e282bd8fe04a6213509af78103991221efe5a971014409e62160ecd` |
| `wsdl/imports/ServicioFacturacionDocumentoAjuste--ServicioFacturacion.wsdl` | `…/v2/ServicioFacturacionDocumentoAjuste?wsdl=ServicioFacturacion.wsdl` | `6d16782af65441aa313c1354a6e2a54f188d504ab8b0012a1c04a603e747d64a` |
| `xsd/facturaComputarizadaCompraVenta.xsd` | Annex package `CompraVentaXML.zip`, provided by the project owner. Origin page: "Factura de Compra y Venta" under Documentos Fiscales Digitales on siatanexo.impuestos.gob.bo. Dated 2026-09-18 inside the zip. | `b9699df77a43523bca6e3c482aefc2712286c7747442b2f04f40ef5bf92c314f` |
| `examples/facturaComputarizadaCompraVenta.xml` | Same zip. Dated 2026-10-08 inside the zip. | `6aecb51b3d27e538db6294f498df883251ccb688fce3c0f969010407dc860a67` |
| `xsd/notaComputarizadaCreditoDebito.xsd` | https://siatanexo.impuestos.gob.bo/images/archivos_tecnicos/archivos_apoyo/CreditoDebitoXML.zip (linked from the "Nota Crédito - Débito" page). Downloaded 2026-11-11 **with TLS certificate verification skipped**, authorized by the project owner for this download only. | `644f8977708b64bd04ccf26fd0190890ea02ac598b71b7071159b2abc2b9d660` |
| `examples/notaComputarizadaCreditoDebito.xml` | Same zip, same download. | `07bda134bc8c6f44245e22778b56f7e83c2c63df782112751374fe060b4559a6` |
| `annex/versionamiento.txt` | Versionamiento section of siatanexo.impuestos.gob.bo, saved by the project owner. | `1a4b3d07bc1f41c9d4030aa6a65ea931fb1da0f7b738955ba6e5eb607a98ef5f` |

## Notes

- **Import paths.** The WSDLs import their schemas from the live URL (`?wsdl=<Name>.wsdl`). The files under `wsdl/imports/` have the same contents. The `--` prefix names them by service, because several services use the same name `ServicioFacturacion.wsdl`. Tooling that loads these WSDLs offline must rewrite the import locations to the local files.
- **Operations per WSDL**
  - `FacturacionCodigos`: cuis, cuisMasivo, cufd, cufdMasivo, verificarNit, notificaCertificadoRevocado, verificarComunicacion.
  - `FacturacionSincronizacion`: sincronizarFechaHora, sincronizarActividades, and the other sincronizarLista* / sincronizarParametrica* operations.
  - `FacturacionOperaciones`: registroPuntoVenta, consultaPuntoVenta, cierrePuntoVenta, registroEventoSignificativo, consultaEventoSignificativo, cierreOperacionesSistema, verificarComunicacion, and related operations.
  - `ServicioFacturacionCompraVenta`: recepcionFactura, recepcionAnexos, anulacionFactura, reversionAnulacionFactura, verificacionEstadoFactura, recepcionMasivaFactura, recepcionPaqueteFactura, validacionRecepcion*, verificarComunicacion.
  - `ServicioFacturacionDocumentoAjuste`: recepcionDocumentoAjuste, anulacionDocumentoAjuste, reversionAnulacionDocumentoAjuste, verificacionEstadoDocumentoAjuste, verificarComunicacion.
- **Covered schemas.** Computarizada Compra-Venta and Computarizada Nota de Crédito-Débito, each with an example XML. The Electrónica XSDs in the same zips are intentionally excluded because the Computarizada modality is used (D1 in the implementation plan).
- **TLS exception.** The Nota de Crédito-Débito zip was downloaded with certificate verification skipped, because the annex site's certificate chain is incomplete on this machine. The file hashes above are the reference. Re-download with verification enabled once the chain is fixed, and confirm the hashes still match.
- **Earlier copies.** A PHP client's `wsdls/` folder (github.com/arcquars/amyrit-in, last push 2025-10-28) is older. Its `ServicioFacturacionComputarizada` and `ServicioFacturacionElectronica` lack `reversionAnulacionFactura` and `recepcionAnexosSuministroEnergia`. Do not use those copies.
