import { XMLParser } from 'fast-xml-parser';
import { SiatFaultError, SiatProtocolError } from './siat-errors';
import type { SiatOperation } from './siat-operations';

/** Target namespace of every SIAT service (see the WSDL targetNamespace of the imported schemas). */
export const SIAT_NAMESPACE = 'https://siat.impuestos.gob.bo/';

/** A SIAT payload value. `null` becomes `xsi:nil="true"`, and arrays repeat their element. */
export type SiatValue =
  | string
  | number
  | boolean
  | null
  | SiatValue[]
  | { [key: string]: SiatValue | undefined };

export interface SiatMessage {
  codigo: number;
  descripcion: string;
}

export interface SiatResult {
  /** `transaccion` from the response: true when SIAT accepted the request. */
  transaccion: boolean;
  codigoEstado?: number;
  /** `mensajesList` entries. Empty when there are none. */
  mensajes: SiatMessage[];
  /** The response wrapper object (for example `RespuestaCuis`), kept for typed mapping by callers. */
  payload: Record<string, unknown>;
}

/**
 * Builds a SOAP 1.1 document/literal envelope for one operation.
 * The payload is written in the order the caller gives it, so pass keys in XSD sequence order.
 */
export function buildEnvelope(
  operation: SiatOperation,
  payload: Record<string, SiatValue | undefined>,
): string {
  const body = Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([name, value]) => elementXml(name, value as SiatValue))
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ' +
    'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    '<soap:Body>' +
    `<ns1:${operation.name} xmlns:ns1="${SIAT_NAMESPACE}">${body}</ns1:${operation.name}>` +
    '</soap:Body>' +
    '</soap:Envelope>'
  );
}

/**
 * Reads a SIAT SOAP response. Returns the typed result, or throws SiatFaultError for a SOAP fault
 * and SiatProtocolError for anything that does not match the expected shape.
 */
export function parseResponse(
  xml: string,
  operation: SiatOperation,
): SiatResult {
  const parsed = parseXml(xml);
  const envelope = asRecord(parsed.Envelope);
  const body = asRecord(envelope?.Body);
  if (!body) {
    throw new SiatProtocolError(
      `Response for ${operation.name} is not a SOAP envelope`,
    );
  }

  const fault = asRecord(body.Fault);
  if (fault) {
    throw new SiatFaultError(
      text(fault.faultcode) ?? 'unknown',
      text(fault.faultstring) ?? '',
    );
  }

  const wrapper = asRecord(body[`${operation.name}Response`]);
  if (!wrapper) {
    throw new SiatProtocolError(
      `Response for ${operation.name} has no ${operation.name}Response element`,
    );
  }

  // The wrapper holds one Respuesta* object, such as RespuestaCuis. Find it by its child fields.
  const payload =
    asRecord(
      Object.values(wrapper).find((value) => asRecord(value) !== undefined),
    ) ?? {};
  const transaccion = bool(payload.transaccion);
  if (transaccion === undefined) {
    throw new SiatProtocolError(
      `Response for ${operation.name} has no transaccion field`,
    );
  }

  return {
    transaccion,
    codigoEstado: number(payload.codigoEstado),
    mensajes: toList(payload.mensajesList).map((item) => ({
      codigo: number(item.codigo) ?? 0,
      descripcion: text(item.descripcion) ?? '',
    })),
    payload,
  };
}

/** Escapes text for XML element content. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function elementXml(name: string, value: SiatValue): string {
  if (value === null) {
    return `<${name} xsi:nil="true"/>`;
  }
  if (Array.isArray(value)) {
    return value.map((item) => elementXml(name, item)).join('');
  }
  if (typeof value === 'object') {
    const inner = Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .map(([key, v]) => elementXml(key, v as SiatValue))
      .join('');
    return `<${name}>${inner}</${name}>`;
  }
  return `<${name}>${escapeXml(String(value))}</${name}>`;
}

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false,
  trimValues: true,
  // Lists are always arrays, even with one entry.
  isArray: (name) => name === 'mensajesList',
});

function parseXml(xml: string): Record<string, unknown> {
  try {
    return parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new SiatProtocolError('Response is not well-formed XML');
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function number(value: unknown): number | undefined {
  if (
    typeof value === 'string' &&
    value.trim() !== '' &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  return undefined;
}

function bool(value: unknown): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function toList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asRecord(item) ?? {});
}
