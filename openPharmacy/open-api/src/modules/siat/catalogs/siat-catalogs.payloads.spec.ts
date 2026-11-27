import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  activityDocumentSectorRow,
  activityRow,
  legendRow,
  parametricRow,
  productRow,
  sincronizacionRequest,
  toArray,
  uniqueRows,
} from './siat-catalogs.payloads';
import { SIAT_CATALOG_ENTRIES } from './siat-catalogs.registry';

describe('toArray', () => {
  it('turns a single object (one-item list) into a one-item array', () => {
    expect(toArray({ codigoClasificador: 2 })).toEqual([
      { codigoClasificador: 2 },
    ]);
  });

  it('returns [] for a missing list and drops non-object entries', () => {
    expect(toArray(undefined)).toEqual([]);
    expect(toArray('')).toEqual([]);
    expect(toArray([{ a: 1 }, 'x', null])).toEqual([{ a: 1 }]);
  });
});

describe('sincronizacionRequest', () => {
  it('writes SolicitudSincronizacion in WSDL field order, without codigoModalidad', () => {
    const request = sincronizacionRequest(
      { nit: '1234567', codigoSistema: 'SYS' },
      0,
      0,
      'CUIS-1',
    );
    expect(Object.keys(request.SolicitudSincronizacion as object)).toEqual([
      'codigoPuntoVenta',
      'codigoSistema',
      'codigoSucursal',
      'cuis',
      'nit',
    ]);
  });
});

describe('row mappers', () => {
  it('maps an activity by codigoCaeb', () => {
    expect(
      activityRow({
        codigoCaeb: 47730,
        descripcion: 'Venta de productos farmacéuticos',
        tipoActividad: 'PRINCIPAL',
      }),
    ).toEqual({
      code: '47730',
      parentCode: null,
      description: 'Venta de productos farmacéuticos',
      extra: { tipoActividad: 'PRINCIPAL' },
    });
  });

  it('keys an activity ↔ document sector by the pair, with the activity as parent', () => {
    expect(
      activityDocumentSectorRow({
        codigoActividad: '47730',
        codigoDocumentoSector: 1,
        tipoDocumentoSector: 'FACTURA COMPRA VENTA',
      }),
    ).toMatchObject({
      code: '47730:1',
      parentCode: '47730',
      extra: { codigoDocumentoSector: 1 },
    });
  });

  it('keys a legend by its activity and a stable hash of its text', () => {
    const item = {
      codigoActividad: '47730',
      descripcionLeyenda: 'Ley N° 453: tienes derecho a un trato equitativo.',
    };
    const first = legendRow(item);
    const second = legendRow({ ...item });
    expect(first?.code).toMatch(/^47730:[0-9a-f]{16}$/);
    expect(first?.code).toBe(second?.code);
    expect(first?.parentCode).toBe('47730');
    expect(legendRow({ ...item, descripcionLeyenda: 'Otra' })?.code).not.toBe(
      first?.code,
    );
  });

  it('keeps nandina as a list whether SIAT sends one entry or several', () => {
    const base = {
      codigoActividad: '1',
      codigoProducto: 99,
      descripcionProducto: 'X',
    };
    expect(productRow({ ...base, nandina: '3004.90' })?.extra).toEqual({
      codigoProducto: '99',
      nandina: ['3004.90'],
    });
    expect(
      productRow({ ...base, nandina: ['3004.90', '3004.20'] })?.extra,
    ).toEqual({
      codigoProducto: '99',
      nandina: ['3004.90', '3004.20'],
    });
    expect(productRow({ ...base })?.extra).toEqual({
      codigoProducto: '99',
      nandina: [],
    });
  });

  it('reads parametric codes from codigoClasificador, or codigo for service messages', () => {
    expect(
      parametricRow({ codigoClasificador: 2, descripcion: 'VENTANILLA' }),
    ).toMatchObject({
      code: '2',
      description: 'VENTANILLA',
    });
    expect(parametricRow({ codigo: 7, descripcion: 'Mensaje' })?.code).toBe(
      '7',
    );
  });

  it('skips items without a usable code', () => {
    expect(activityRow({ descripcion: 'sin código' })).toBeNull();
    expect(parametricRow({ descripcion: 'sin código' })).toBeNull();
  });
});

describe('uniqueRows', () => {
  it('keeps the last row for a duplicated code and counts the duplicates', () => {
    const { rows, duplicates } = uniqueRows([
      { code: 'A', parentCode: null, description: 'first', extra: null },
      { code: 'A', parentCode: null, description: 'last', extra: null },
    ]);
    expect(duplicates).toBe(1);
    expect(rows.get('A')?.description).toBe('last');
  });
});

describe('catalog registry', () => {
  it('covers the 17 catalogs of the pinned WSDL, each with a unique slug', () => {
    const slugs = SIAT_CATALOG_ENTRIES.map((entry) => entry.slug);
    expect(slugs).toHaveLength(17);
    expect(new Set(slugs).size).toBe(17);
  });

  it('only exposes operations that exist in the pinned sync WSDL', () => {
    const wsdl = readFileSync(
      join(
        __dirname,
        '..',
        'spec',
        'v3',
        'wsdl',
        'imports',
        'FacturacionSincronizacion--ServicioFacturacionSincronizacion.wsdl',
      ),
      'utf8',
    );
    for (const entry of SIAT_CATALOG_ENTRIES) {
      expect(wsdl).toContain(`<xs:complexType name="${entry.operation.name}">`);
    }
  });
});
