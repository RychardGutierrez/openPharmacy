/**
 * The SIN catalogs synchronized by SIAT-07. One entry per `sincronizar*` operation of the pinned
 * FacturacionSincronizacion WSDL. The operation name is also the value stored in
 * `siat_catalog_items.catalog`, so a new catalog needs no migration.
 *
 * `requiredForEmission`: SIAT-11 refuses to emit while one of these has no active code.
 * `public`: any signed-in role may read the codes (dropdowns). The others are ADMIN only.
 */
import { SIAT_OPERATIONS, type SiatOperation } from '../client/siat-operations';
import {
  activityDocumentSectorRow,
  activityRow,
  legendRow,
  parametricRow,
  productRow,
  type SiatCatalogItem,
  type SiatCatalogRow,
} from './siat-catalogs.payloads';

const S = SIAT_OPERATIONS.FacturacionSincronizacion;

export interface SiatCatalogEntry {
  /** URL segment: `GET /api/siat/catalogs/:slug`. */
  slug: string;
  operation: SiatOperation;
  /** Name of the list in the `respuestaConfiguracion` wrapper. */
  listKey: string;
  map: (item: SiatCatalogItem) => SiatCatalogRow | null;
  requiredForEmission: boolean;
  public: boolean;
}

const PARAMETRIC = 'listaCodigos';

export const SIAT_CATALOG_ENTRIES: readonly SiatCatalogEntry[] = [
  {
    slug: 'activities',
    operation: S.sincronizarActividades,
    listKey: 'listaActividades',
    map: activityRow,
    requiredForEmission: true,
    public: false,
  },
  {
    slug: 'legends',
    operation: S.sincronizarListaLeyendasFactura,
    listKey: 'listaLeyendas',
    map: legendRow,
    requiredForEmission: true,
    public: false,
  },
  {
    slug: 'activity-document-sectors',
    operation: S.sincronizarListaActividadesDocumentoSector,
    listKey: 'listaActividadesDocumentoSector',
    map: activityDocumentSectorRow,
    requiredForEmission: true,
    public: false,
  },
  {
    slug: 'products',
    operation: S.sincronizarListaProductosServicios,
    listKey: PARAMETRIC,
    map: productRow,
    requiredForEmission: false,
    public: false,
  },
  {
    slug: 'service-messages',
    operation: S.sincronizarListaMensajesServicios,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: false,
    public: false,
  },
  {
    slug: 'significant-events',
    operation: S.sincronizarParametricaEventosSignificativos,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: false,
    public: false,
  },
  {
    slug: 'cancellation-reasons',
    operation: S.sincronizarParametricaMotivoAnulacion,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: false,
    public: true,
  },
  {
    slug: 'countries',
    operation: S.sincronizarParametricaPaisOrigen,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: false,
    public: false,
  },
  {
    slug: 'document-types',
    operation: S.sincronizarParametricaTipoDocumentoIdentidad,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: true,
    public: true,
  },
  {
    slug: 'document-sectors',
    operation: S.sincronizarParametricaTipoDocumentoSector,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: true,
    public: false,
  },
  {
    slug: 'emission-types',
    operation: S.sincronizarParametricaTipoEmision,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: true,
    public: false,
  },
  {
    slug: 'room-types',
    operation: S.sincronizarParametricaTipoHabitacion,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: false,
    public: false,
  },
  {
    slug: 'payment-methods',
    operation: S.sincronizarParametricaTipoMetodoPago,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: true,
    public: true,
  },
  {
    slug: 'currencies',
    operation: S.sincronizarParametricaTipoMoneda,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: true,
    public: true,
  },
  {
    slug: 'pos-types',
    operation: S.sincronizarParametricaTipoPuntoVenta,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: false,
    public: false,
  },
  {
    slug: 'invoice-types',
    operation: S.sincronizarParametricaTiposFactura,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: true,
    public: false,
  },
  {
    slug: 'units',
    operation: S.sincronizarParametricaUnidadMedida,
    listKey: PARAMETRIC,
    map: parametricRow,
    requiredForEmission: true,
    public: true,
  },
];

/** Date-time synchronization (SIAT-07). Not a catalog: it feeds the SIAT clock. */
export const SIAT_TIME_OPERATION = S.sincronizarFechaHora;

export function findCatalogEntry(slug: string): SiatCatalogEntry | undefined {
  return SIAT_CATALOG_ENTRIES.find((entry) => entry.slug === slug);
}
