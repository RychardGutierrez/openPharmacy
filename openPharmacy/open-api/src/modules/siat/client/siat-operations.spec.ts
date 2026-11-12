import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SIAT_SPEC_V3_DIR } from '../xml/siat-xsd-validator';
import {
  ALL_SIAT_OPERATIONS,
  SIAT_OPERATIONS,
  type SiatServiceName,
} from './siat-operations';

const SERVICES: SiatServiceName[] = [
  'FacturacionCodigos',
  'FacturacionSincronizacion',
  'FacturacionOperaciones',
  'ServicioFacturacionCompraVenta',
  'ServicioFacturacionDocumentoAjuste',
];

/** Operation names declared in a pinned WSDL. */
function wsdlOperations(service: SiatServiceName): string[] {
  const xml = readFileSync(
    join(SIAT_SPEC_V3_DIR, 'wsdl', `${service}.wsdl`),
    'utf8',
  );
  return [...xml.matchAll(/<wsdl:operation name="([^"]+)"/g)]
    .map((m) => m[1])
    .sort();
}

describe('SIAT operation registry', () => {
  it.each(SERVICES)('matches the pinned WSDL operations of %s', (service) => {
    const declared = Object.keys(SIAT_OPERATIONS[service]).sort();

    expect(declared).toEqual(wsdlOperations(service));
  });

  it('declares every operation of the five pinned WSDLs (49 in total)', () => {
    const fromWsdl = SERVICES.flatMap((service) => wsdlOperations(service));

    expect(fromWsdl).toHaveLength(49);
    expect(ALL_SIAT_OPERATIONS).toHaveLength(49);
  });

  it('marks read and write operations as documented', () => {
    const reads = ALL_SIAT_OPERATIONS.filter((op) => op.kind === 'read').length;
    const writes = ALL_SIAT_OPERATIONS.filter(
      (op) => op.kind === 'write',
    ).length;

    expect({ reads, writes }).toEqual({ reads: 30, writes: 19 });
  });

  it('never marks code-issuing or invoice-changing operations as read', () => {
    const mustBeWrite = [
      SIAT_OPERATIONS.FacturacionCodigos.cuis,
      SIAT_OPERATIONS.FacturacionCodigos.cufd,
      SIAT_OPERATIONS.ServicioFacturacionCompraVenta.recepcionFactura,
      SIAT_OPERATIONS.ServicioFacturacionCompraVenta.anulacionFactura,
      SIAT_OPERATIONS.ServicioFacturacionDocumentoAjuste
        .recepcionDocumentoAjuste,
      SIAT_OPERATIONS.FacturacionOperaciones.registroEventoSignificativo,
    ];

    expect(mustBeWrite.every((op) => op.kind === 'write')).toBe(true);
  });
});
