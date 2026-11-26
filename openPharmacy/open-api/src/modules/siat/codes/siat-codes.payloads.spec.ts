import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SiatProtocolError } from '../client/siat-errors';
import type { SiatResult } from '../client/siat-soap-envelope';
import {
  cierrePuntoVentaRequest,
  consultaPuntoVentaRequest,
  consultaPuntoVentaResponse,
  cufdRequest,
  cufdResponse,
  cuisRequest,
  cuisResponse,
  parseSiatDateTime,
  registroPuntoVentaRequest,
} from './siat-codes.payloads';
import { cuisState } from './siat-cuis-policy';

const identity = { nit: '1234567', codigoSistema: 'SYS', codigoModalidad: 2 };
const WSDL_DIR = join(__dirname, '..', 'spec', 'v3', 'wsdl', 'imports');

/** Field names of a WSDL complexType, in document order. */
function wsdlFields(file: string, type: string): string[] {
  const wsdl = readFileSync(join(WSDL_DIR, file), 'utf8');
  const start = wsdl.indexOf(`<xs:complexType name="${type}">`);
  const body = wsdl.slice(start, wsdl.indexOf('</xs:complexType>', start));
  return [...body.matchAll(/<xs:element[^>]*name="([^"]+)"/g)].map((m) => m[1]);
}

const without = (fields: string[], name: string) =>
  fields.filter((f) => f !== name);
const keysOf = (payload: Record<string, unknown>) =>
  Object.keys(Object.values(payload)[0] as Record<string, unknown>);

describe('SIAT-05 request payloads follow the pinned WSDL field order', () => {
  // codigoAmbiente is inserted by the client, so it is absent here.
  it.each([
    [
      'cuis',
      'FacturacionCodigos--ServicioFacturacionCodigos.wsdl',
      'solicitudCuis',
      cuisRequest(identity, 0, 1),
    ],
    [
      'cufd (SIAT-06)',
      'FacturacionCodigos--ServicioFacturacionCodigos.wsdl',
      'solicitudCufd',
      cufdRequest(identity, 0, 1, 'C'),
    ],
    [
      'registroPuntoVenta',
      'FacturacionOperaciones--ServicioFacturacionOperaciones.wsdl',
      'solicitudRegistroPuntoVenta',
      registroPuntoVentaRequest(identity, {
        codigoSucursal: 0,
        codigoTipoPuntoVenta: 5,
        cuis: 'C',
        descripcion: 'd',
        nombrePuntoVenta: 'n',
      }),
    ],
    [
      'consultaPuntoVenta',
      'FacturacionOperaciones--ServicioFacturacionOperaciones.wsdl',
      'solicitudConsultaPuntoVenta',
      consultaPuntoVentaRequest(identity, 0, 'C'),
    ],
    [
      'cierrePuntoVenta',
      'FacturacionOperaciones--ServicioFacturacionOperaciones.wsdl',
      'solicitudCierrePuntoVenta',
      cierrePuntoVentaRequest(identity, 0, 3, 'C'),
    ],
  ])('%s', (_name, file, type, payload) => {
    expect(keysOf(payload)).toEqual(
      without(wsdlFields(file, type), 'codigoAmbiente'),
    );
  });
});

describe('SIAT-05 response mappers', () => {
  const result = (payload: Record<string, unknown>): SiatResult => ({
    transaccion: true,
    mensajes: [],
    payload,
  });

  it('reads codigo and fechaVigencia from RespuestaCuis', () => {
    expect(
      cuisResponse(
        result({
          codigo: 'ABC',
          fechaVigencia: '2027-11-17T08:00:00.000-04:00',
        }),
      ),
    ).toEqual({
      codigo: 'ABC',
      fechaVigencia: new Date('2027-11-17T12:00:00.000Z'),
    });
    expect(cuisResponse(result({ transaccion: 'false' }))).toBeNull();
  });

  it('treats a dateTime without zone as Bolivia time and rejects garbage', () => {
    expect(parseSiatDateTime('2027-01-01T00:00:00')).toEqual(
      new Date('2027-01-01T04:00:00Z'),
    );
    expect(() => parseSiatDateTime('tomorrow')).toThrow(SiatProtocolError);
  });

  it('maps listaPuntosVentas whether SIAT returns one entry or several', () => {
    const one = {
      codigoPuntoVenta: '1',
      nombrePuntoVenta: 'Caja 1',
      tipoPuntoVenta: 'CAJEROS',
    };
    expect(
      consultaPuntoVentaResponse(result({ listaPuntosVentas: one })),
    ).toEqual([
      {
        codigoPuntoVenta: 1,
        nombrePuntoVenta: 'Caja 1',
        tipoPuntoVenta: 'CAJEROS',
      },
    ]);
    expect(
      consultaPuntoVentaResponse(
        result({ listaPuntosVentas: [one, { ...one, codigoPuntoVenta: '2' }] }),
      ),
    ).toHaveLength(2);
    expect(consultaPuntoVentaResponse(result({}))).toEqual([]);
  });
});

describe('cufdResponse (SIAT-06)', () => {
  const result = (payload: Record<string, unknown>): SiatResult => ({
    transaccion: true,
    mensajes: [],
    payload,
  });
  const full = {
    codigo: 'BQUFDQ0NBQ0E=',
    codigoControl: '7C2E9B8A1D3F4E5',
    direccion: 'AV. 6 DE AGOSTO 123',
    fechaVigencia: '2026-11-21T00:05:12.345-04:00',
    transaccion: 'true',
  };

  it('maps the codes and validity; codigoInterno is optional (not in the pinned WSDL)', () => {
    expect(cufdResponse(result(full))).toEqual({
      codigo: 'BQUFDQ0NBQ0E=',
      codigoControl: '7C2E9B8A1D3F4E5',
      direccion: 'AV. 6 DE AGOSTO 123',
      fechaVigencia: new Date('2026-11-21T04:05:12.345Z'),
      codigoInterno: null,
    });
    expect(
      cufdResponse(result({ ...full, codigoInterno: 'A' }))?.codigoInterno,
    ).toBe('A');
  });

  it.each([['codigo'], ['codigoControl'], ['direccion'], ['fechaVigencia']])(
    'is null without %s',
    (field) => {
      const payload: Record<string, unknown> = { ...full };
      delete payload[field];
      expect(cufdResponse(result(payload))).toBeNull();
    },
  );
});

describe('cuisState', () => {
  const now = new Date('2026-11-17T00:00:00Z');
  const at = (d: number) => new Date(now.getTime() + d * 86_400_000);
  const windows = { cuisRenewDays: 5, cuisAlertDays: 15 };

  it.each([
    [null, 'missing'],
    [at(-0.001), 'expired'],
    [at(0), 'expired'],
    [at(5), 'renew'],
    [at(5.01), 'alert'],
    [at(15), 'alert'],
    [at(15.01), 'valid'],
  ])('%s → %s', (validUntil, expected) => {
    expect(cuisState(validUntil, now, windows)).toBe(expected);
  });
});
