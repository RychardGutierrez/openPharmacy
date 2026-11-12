/**
 * SIAT SOAP operations, as declared in the pinned WSDLs (spec/v3/wsdl).
 *
 * `read` operations have no side effects, so the client may retry them with backoff.
 * `write` operations create or change SIAT state (an invoice, a code, an event, a cancellation).
 * They are never retried automatically. A `write` that may have been received surfaces as an
 * `unknown` outcome, and the caller verifies its status first.
 *
 * Operations that create codes (cuis, cufd, *Masivo, notificaCertificadoRevocado) are `write`,
 * because each call can issue a new code. A retry could issue a second one.
 */
export type SiatServiceName =
  | 'FacturacionCodigos'
  | 'FacturacionSincronizacion'
  | 'FacturacionOperaciones'
  | 'ServicioFacturacionCompraVenta'
  | 'ServicioFacturacionDocumentoAjuste';

export type SiatOperationKind = 'read' | 'write';

export interface SiatOperation {
  readonly service: SiatServiceName;
  readonly name: string;
  readonly kind: SiatOperationKind;
}

const op = (
  service: SiatServiceName,
  name: string,
  kind: SiatOperationKind,
): SiatOperation => ({
  service,
  name,
  kind,
});

export const SIAT_OPERATIONS = {
  FacturacionCodigos: {
    cuis: op('FacturacionCodigos', 'cuis', 'write'),
    cuisMasivo: op('FacturacionCodigos', 'cuisMasivo', 'write'),
    cufd: op('FacturacionCodigos', 'cufd', 'write'),
    cufdMasivo: op('FacturacionCodigos', 'cufdMasivo', 'write'),
    notificaCertificadoRevocado: op(
      'FacturacionCodigos',
      'notificaCertificadoRevocado',
      'write',
    ),
    verificarNit: op('FacturacionCodigos', 'verificarNit', 'read'),
    verificarComunicacion: op(
      'FacturacionCodigos',
      'verificarComunicacion',
      'read',
    ),
  },
  FacturacionSincronizacion: {
    sincronizarActividades: op(
      'FacturacionSincronizacion',
      'sincronizarActividades',
      'read',
    ),
    sincronizarFechaHora: op(
      'FacturacionSincronizacion',
      'sincronizarFechaHora',
      'read',
    ),
    sincronizarListaActividadesDocumentoSector: op(
      'FacturacionSincronizacion',
      'sincronizarListaActividadesDocumentoSector',
      'read',
    ),
    sincronizarListaLeyendasFactura: op(
      'FacturacionSincronizacion',
      'sincronizarListaLeyendasFactura',
      'read',
    ),
    sincronizarListaMensajesServicios: op(
      'FacturacionSincronizacion',
      'sincronizarListaMensajesServicios',
      'read',
    ),
    sincronizarListaProductosServicios: op(
      'FacturacionSincronizacion',
      'sincronizarListaProductosServicios',
      'read',
    ),
    sincronizarParametricaEventosSignificativos: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaEventosSignificativos',
      'read',
    ),
    sincronizarParametricaMotivoAnulacion: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaMotivoAnulacion',
      'read',
    ),
    sincronizarParametricaPaisOrigen: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaPaisOrigen',
      'read',
    ),
    sincronizarParametricaTipoDocumentoIdentidad: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaTipoDocumentoIdentidad',
      'read',
    ),
    sincronizarParametricaTipoDocumentoSector: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaTipoDocumentoSector',
      'read',
    ),
    sincronizarParametricaTipoEmision: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaTipoEmision',
      'read',
    ),
    sincronizarParametricaTipoHabitacion: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaTipoHabitacion',
      'read',
    ),
    sincronizarParametricaTipoMetodoPago: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaTipoMetodoPago',
      'read',
    ),
    sincronizarParametricaTipoMoneda: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaTipoMoneda',
      'read',
    ),
    sincronizarParametricaTipoPuntoVenta: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaTipoPuntoVenta',
      'read',
    ),
    sincronizarParametricaTiposFactura: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaTiposFactura',
      'read',
    ),
    sincronizarParametricaUnidadMedida: op(
      'FacturacionSincronizacion',
      'sincronizarParametricaUnidadMedida',
      'read',
    ),
    verificarComunicacion: op(
      'FacturacionSincronizacion',
      'verificarComunicacion',
      'read',
    ),
  },
  FacturacionOperaciones: {
    registroPuntoVenta: op(
      'FacturacionOperaciones',
      'registroPuntoVenta',
      'write',
    ),
    registroPuntoVentaComisionista: op(
      'FacturacionOperaciones',
      'registroPuntoVentaComisionista',
      'write',
    ),
    consultaPuntoVenta: op(
      'FacturacionOperaciones',
      'consultaPuntoVenta',
      'read',
    ),
    cierrePuntoVenta: op('FacturacionOperaciones', 'cierrePuntoVenta', 'write'),
    cierreOperacionesSistema: op(
      'FacturacionOperaciones',
      'cierreOperacionesSistema',
      'write',
    ),
    registroEventoSignificativo: op(
      'FacturacionOperaciones',
      'registroEventoSignificativo',
      'write',
    ),
    consultaEventoSignificativo: op(
      'FacturacionOperaciones',
      'consultaEventoSignificativo',
      'read',
    ),
    verificarComunicacion: op(
      'FacturacionOperaciones',
      'verificarComunicacion',
      'read',
    ),
  },
  ServicioFacturacionCompraVenta: {
    recepcionFactura: op(
      'ServicioFacturacionCompraVenta',
      'recepcionFactura',
      'write',
    ),
    recepcionAnexos: op(
      'ServicioFacturacionCompraVenta',
      'recepcionAnexos',
      'write',
    ),
    recepcionMasivaFactura: op(
      'ServicioFacturacionCompraVenta',
      'recepcionMasivaFactura',
      'write',
    ),
    recepcionPaqueteFactura: op(
      'ServicioFacturacionCompraVenta',
      'recepcionPaqueteFactura',
      'write',
    ),
    validacionRecepcionMasivaFactura: op(
      'ServicioFacturacionCompraVenta',
      'validacionRecepcionMasivaFactura',
      'read',
    ),
    validacionRecepcionPaqueteFactura: op(
      'ServicioFacturacionCompraVenta',
      'validacionRecepcionPaqueteFactura',
      'read',
    ),
    verificacionEstadoFactura: op(
      'ServicioFacturacionCompraVenta',
      'verificacionEstadoFactura',
      'read',
    ),
    anulacionFactura: op(
      'ServicioFacturacionCompraVenta',
      'anulacionFactura',
      'write',
    ),
    reversionAnulacionFactura: op(
      'ServicioFacturacionCompraVenta',
      'reversionAnulacionFactura',
      'write',
    ),
    verificarComunicacion: op(
      'ServicioFacturacionCompraVenta',
      'verificarComunicacion',
      'read',
    ),
  },
  ServicioFacturacionDocumentoAjuste: {
    recepcionDocumentoAjuste: op(
      'ServicioFacturacionDocumentoAjuste',
      'recepcionDocumentoAjuste',
      'write',
    ),
    anulacionDocumentoAjuste: op(
      'ServicioFacturacionDocumentoAjuste',
      'anulacionDocumentoAjuste',
      'write',
    ),
    reversionAnulacionDocumentoAjuste: op(
      'ServicioFacturacionDocumentoAjuste',
      'reversionAnulacionDocumentoAjuste',
      'write',
    ),
    verificacionEstadoDocumentoAjuste: op(
      'ServicioFacturacionDocumentoAjuste',
      'verificacionEstadoDocumentoAjuste',
      'read',
    ),
    verificarComunicacion: op(
      'ServicioFacturacionDocumentoAjuste',
      'verificarComunicacion',
      'read',
    ),
  },
} as const;

/** Every declared operation, flattened. Tests check this list against the pinned WSDLs. */
export const ALL_SIAT_OPERATIONS: readonly SiatOperation[] = Object.values(
  SIAT_OPERATIONS,
).flatMap((group) => Object.values(group));

/** The SOAP endpoint of a service: base URL plus the service path, as in each WSDL's soap:address. */
export function endpointFor(baseUrl: string, service: SiatServiceName): string {
  return `${baseUrl}/${service}`;
}
