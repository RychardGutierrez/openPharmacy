/**
 * Typed requests and response mappers for the operations SIAT-05 uses: `cuis` (FacturacionCodigos)
 * and `registroPuntoVenta`, `consultaPuntoVenta`, `cierrePuntoVenta` (FacturacionOperaciones).
 *
 * Field order follows the pinned WSDL request types (alphabetical). `codigoAmbiente` is inserted
 * by `SiatSoapClient` from `SIAT_ENV`, so it is never set here.
 */
import { SiatProtocolError } from '../client/siat-errors';
import type { SiatResult, SiatValue } from '../client/siat-soap-envelope';

type Payload = Record<string, SiatValue | undefined>;

/** Identity shared by every request: NIT, código de sistema and modality from the settings. */
export interface SiatIdentity {
  nit: string;
  codigoSistema: string;
  codigoModalidad: number;
}

export function cuisRequest(
  id: SiatIdentity,
  codigoSucursal: number,
  codigoPuntoVenta: number,
): Payload {
  return {
    SolicitudCuis: {
      codigoModalidad: id.codigoModalidad,
      codigoPuntoVenta,
      codigoSistema: id.codigoSistema,
      codigoSucursal,
      nit: id.nit,
    },
  };
}

export function registroPuntoVentaRequest(
  id: SiatIdentity,
  input: {
    codigoSucursal: number;
    codigoTipoPuntoVenta: number;
    /** CUIS of the branch (point of sale 0). */
    cuis: string;
    descripcion: string;
    nombrePuntoVenta: string;
  },
): Payload {
  return {
    SolicitudRegistroPuntoVenta: {
      codigoModalidad: id.codigoModalidad,
      codigoSistema: id.codigoSistema,
      codigoSucursal: input.codigoSucursal,
      codigoTipoPuntoVenta: input.codigoTipoPuntoVenta,
      cuis: input.cuis,
      descripcion: input.descripcion,
      nit: id.nit,
      nombrePuntoVenta: input.nombrePuntoVenta,
    },
  };
}

export function consultaPuntoVentaRequest(
  id: SiatIdentity,
  codigoSucursal: number,
  cuis: string,
): Payload {
  return {
    SolicitudConsultaPuntoVenta: {
      codigoSistema: id.codigoSistema,
      codigoSucursal,
      cuis,
      nit: id.nit,
    },
  };
}

export function cierrePuntoVentaRequest(
  id: SiatIdentity,
  codigoSucursal: number,
  codigoPuntoVenta: number,
  cuis: string,
): Payload {
  return {
    SolicitudCierrePuntoVenta: {
      codigoPuntoVenta,
      codigoSistema: id.codigoSistema,
      codigoSucursal,
      cuis,
      nit: id.nit,
    },
  };
}

/** `RespuestaCuis`. `codigo` is present both for a new CUIS and for "CUIS vigente". */
export function cuisResponse(
  result: SiatResult,
): { codigo: string; fechaVigencia: Date } | null {
  const codigo = text(result.payload.codigo);
  const vigencia = text(result.payload.fechaVigencia);
  if (!codigo || !vigencia) return null;
  return { codigo, fechaVigencia: parseSiatDateTime(vigencia) };
}

export function registroPuntoVentaResponse(result: SiatResult): number | null {
  const value = text(result.payload.codigoPuntoVenta);
  return value !== undefined && /^\d+$/.test(value) ? Number(value) : null;
}

export interface SiatRemotePointOfSale {
  codigoPuntoVenta: number;
  nombrePuntoVenta: string;
  tipoPuntoVenta: string;
}

export function consultaPuntoVentaResponse(
  result: SiatResult,
): SiatRemotePointOfSale[] {
  const raw = result.payload.listaPuntosVentas;
  // The parser only forces arrays for mensajesList, so one entry comes back as an object.
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return items
    .filter((item): item is Record<string, unknown> => typeof item === 'object')
    .map((item) => ({
      codigoPuntoVenta: Number(text(item.codigoPuntoVenta) ?? NaN),
      nombrePuntoVenta: text(item.nombrePuntoVenta) ?? '',
      tipoPuntoVenta: text(item.tipoPuntoVenta) ?? '',
    }))
    .filter((item) => Number.isInteger(item.codigoPuntoVenta));
}

/**
 * Parses an `xs:dateTime` from SIAT. A value without a zone is Bolivia time (UTC-4, no DST).
 */
export function parseSiatDateTime(value: string): Date {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/.test(value);
  const date = new Date(hasZone ? value : `${value}-04:00`);
  if (Number.isNaN(date.getTime())) {
    throw new SiatProtocolError(`SIAT returned an invalid dateTime: ${value}`);
  }
  return date;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}
