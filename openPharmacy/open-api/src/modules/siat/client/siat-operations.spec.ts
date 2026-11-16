import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import { SIAT_SPEC_V3_DIR } from '../xml/siat-xsd-validator';
import {
  ALL_SIAT_OPERATIONS,
  SIAT_OPERATIONS,
  type SiatOperation,
  type SiatServiceName,
} from './siat-operations';
import { insertCodigoAmbiente } from './siat-soap-envelope';

type XsdNode = Record<string, unknown>;

const asList = (value: unknown): XsdNode[] =>
  value === undefined
    ? []
    : Array.isArray(value)
      ? (value as XsdNode[])
      : [value as XsdNode];
const localName = (type: string): string => type.split(':').pop() ?? type;

/** complexType definitions of a service, from its imported schema WSDL. */
function complexTypes(service: SiatServiceName): Map<string, XsdNode> {
  const dir = join(SIAT_SPEC_V3_DIR, 'wsdl', 'imports');
  const file = readdirSync(dir).find((f) => f.startsWith(`${service}--`));
  if (!file) throw new Error(`No imported schema for ${service}`);
  const parsed = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    removeNSPrefix: true,
  }).parse(readFileSync(join(dir, file), 'utf8')) as XsdNode;
  const schema = ((parsed.definitions as XsdNode).types as XsdNode)
    .schema as XsdNode;
  return new Map(
    asList(schema.complexType).map((t) => [String(t.name), t] as const),
  );
}

/** Element names of a complexType in XML order, base type fields first. */
function fieldsOf(types: Map<string, XsdNode>, typeName: string): string[] {
  const type = types.get(typeName);
  if (!type) throw new Error(`Unknown type ${typeName}`);
  const extension = (type.complexContent as XsdNode | undefined)?.extension as
    | XsdNode
    | undefined;
  const sequence = (extension ?? type).sequence as XsdNode | undefined;
  const own = asList(sequence?.element).map((e) => String(e.name));
  const base = extension
    ? fieldsOf(types, localName(String(extension.base)))
    : [];
  return [...base, ...own];
}

/** Fields of the operation's request wrapper (Solicitud*), or [] when the request is empty. */
function requestFields(operation: SiatOperation): string[] {
  const types = complexTypes(operation.service);
  const request = types.get(operation.name);
  if (!request) throw new Error(`No request type ${operation.name}`);
  const [wrapper] = asList((request.sequence as XsdNode | undefined)?.element);
  return wrapper ? fieldsOf(types, localName(String(wrapper.type))) : [];
}

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

  describe('codigoAmbiente', () => {
    const cases = ALL_SIAT_OPERATIONS.map(
      (op) => [`${op.service}.${op.name}`, op] as const,
    );

    it.each(cases)(
      '%s: hasCodigoAmbiente matches the WSDL request type',
      (_label, operation) => {
        expect(operation.hasCodigoAmbiente).toBe(
          requestFields(operation).includes('codigoAmbiente'),
        );
      },
    );

    it.each(cases.filter(([, op]) => op.hasCodigoAmbiente))(
      '%s: the client inserts it at its WSDL position',
      (_label, operation) => {
        const wsdlOrder = requestFields(operation);
        const callerFields = Object.fromEntries(
          wsdlOrder
            .filter((name) => name !== 'codigoAmbiente')
            .map((name) => [name, 'x']),
        );

        expect(Object.keys(insertCodigoAmbiente(callerFields, 2))).toEqual(
          wsdlOrder,
        );
      },
    );
  });
});
