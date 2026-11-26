/**
 * PROVISIONAL list of `codigoTipoPuntoVenta` values (SIAT-05, owner decision 2026-11-17).
 *
 * The real values come from `sincronizarParametricaTipoPuntoVenta`, which SIAT-07 syncs into
 * `siat_catalog_items`. Until then this mock list lets an admin register a point of sale.
 * SIAT-07 must replace it with the synced catalog and drop this file.
 *
 * Type 1 (comisionista) is registered with `registroPuntoVentaComisionista`, a different
 * operation with extra contract fields, so it is not offered here.
 */
export interface SiatPointOfSaleType {
  codigo: number;
  descripcion: string;
}

export const PROVISIONAL_POINT_OF_SALE_TYPES: readonly SiatPointOfSaleType[] = [
  { codigo: 2, descripcion: 'PUNTO VENTA VENTANILLA DE COBRANZA' },
  { codigo: 3, descripcion: 'PUNTO DE VENTA MOVILES' },
  { codigo: 4, descripcion: 'PUNTO DE VENTA YPFB' },
  { codigo: 5, descripcion: 'PUNTO DE VENTA CAJEROS' },
  { codigo: 6, descripcion: 'PUNTO DE VENTA CONJUNTA' },
];

export function isKnownPointOfSaleType(codigo: number): boolean {
  return PROVISIONAL_POINT_OF_SALE_TYPES.some((type) => type.codigo === codigo);
}
