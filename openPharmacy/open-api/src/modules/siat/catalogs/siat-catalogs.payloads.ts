/**
 * Request and response mappers for the `sincronizar*` operations (SIAT-07, FacturacionSincronizacion).
 *
 * The five response shapes all come in a `respuestaConfiguracion` wrapper, but the item type differs:
 * activities, activity ↔ document sector, legends, products/services and parametric codes. Each
 * mapper turns one item into a `SiatCatalogRow`. Items with no usable code are skipped.
 *
 * SIAT sends a list with one item as an object, not an array, so `toArray` normalizes it.
 */
import { createHash } from 'node:crypto';
import type { SiatValue } from '../client/siat-soap-envelope';
import type { SiatIdentity } from '../codes/siat-codes.payloads';

export interface SiatCatalogRow {
  /** Unique within the catalog. Composite keys join the parent code with `:`. */
  code: string;
  parentCode: string | null;
  description: string;
  extra: Record<string, unknown> | null;
}

export type SiatCatalogItem = Record<string, unknown>;

/** `SolicitudSincronizacion`, in WSDL field order. `codigoAmbiente` is inserted by the client. */
export function sincronizacionRequest(
  id: Pick<SiatIdentity, 'nit' | 'codigoSistema'>,
  codigoSucursal: number,
  codigoPuntoVenta: number,
  cuis: string,
): Record<string, SiatValue | undefined> {
  return {
    SolicitudSincronizacion: {
      codigoPuntoVenta,
      codigoSistema: id.codigoSistema,
      codigoSucursal,
      cuis,
      nit: id.nit,
    },
  };
}

/** Normalizes a list from the response: missing → [], one object → [object], array → objects only. */
export function toArray(value: unknown): SiatCatalogItem[] {
  const items = Array.isArray(value) ? value : value ? [value] : [];
  return items.filter(
    (item): item is SiatCatalogItem =>
      item !== null && typeof item === 'object' && !Array.isArray(item),
  );
}

/** Scalar to string. The XML parser may return numbers for numeric elements. */
function str(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim() !== '') return value.trim();
  return null;
}

function strings(value: unknown): string[] {
  const list = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];
  return list.map(str).filter((v): v is string => v !== null);
}

/** `codigoCaeb` is the activity code (economic activity). */
export function activityRow(item: SiatCatalogItem): SiatCatalogRow | null {
  const code = str(item.codigoCaeb);
  if (!code) return null;
  return {
    code,
    parentCode: null,
    description: str(item.descripcion) ?? '',
    extra: { tipoActividad: str(item.tipoActividad) },
  };
}

/** Activity ↔ document sector: the pair is the key, the activity is the parent. */
export function activityDocumentSectorRow(
  item: SiatCatalogItem,
): SiatCatalogRow | null {
  const activity = str(item.codigoActividad);
  const sector = str(item.codigoDocumentoSector);
  if (!activity || !sector) return null;
  return {
    code: `${activity}:${sector}`,
    parentCode: activity,
    description: str(item.tipoDocumentoSector) ?? '',
    extra: { codigoDocumentoSector: Number(sector) },
  };
}

/**
 * Legends have no code in SIAT. Each one is keyed by its activity and a hash of its text, so the
 * same text re-synced gets the same key.
 */
export function legendRow(item: SiatCatalogItem): SiatCatalogRow | null {
  const activity = str(item.codigoActividad);
  const description = str(item.descripcionLeyenda);
  if (!activity || !description) return null;
  const hash = createHash('sha256')
    .update(description)
    .digest('hex')
    .slice(0, 16);
  return {
    code: `${activity}:${hash}`,
    parentCode: activity,
    description,
    extra: null,
  };
}

/** Products and services, keyed by activity and product code. `nandina` is a list of codes. */
export function productRow(item: SiatCatalogItem): SiatCatalogRow | null {
  const activity = str(item.codigoActividad);
  const product = str(item.codigoProducto);
  if (!activity || !product) return null;
  return {
    code: `${activity}:${product}`,
    parentCode: activity,
    description: str(item.descripcionProducto) ?? '',
    extra: { codigoProducto: product, nandina: strings(item.nandina) },
  };
}

/**
 * Parametric catalogs (`parametricasDto`): `codigoClasificador` is the code. Service messages use
 * `codigo` in their own type, so both are accepted.
 */
export function parametricRow(item: SiatCatalogItem): SiatCatalogRow | null {
  const code = str(item.codigoClasificador) ?? str(item.codigo);
  if (!code) return null;
  return {
    code,
    parentCode: null,
    description: str(item.descripcion) ?? '',
    extra: null,
  };
}

/**
 * Collapses rows that share a code. SIAT should not send duplicates; when it does, the last one
 * wins and the caller logs the count.
 */
export function uniqueRows(rows: SiatCatalogRow[]): {
  rows: Map<string, SiatCatalogRow>;
  duplicates: number;
} {
  const map = new Map<string, SiatCatalogRow>();
  let duplicates = 0;
  for (const row of rows) {
    if (map.has(row.code)) duplicates += 1;
    map.set(row.code, row);
  }
  return { rows: map, duplicates };
}
