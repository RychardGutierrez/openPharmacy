import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

/**
 * DEMO SIN catalog rows for local development (SIAT-08), so the "Codificación SIN" pickers can be
 * tried without a SIAT pilot token. Never runs with NODE_ENV=production.
 *
 * The codes are deliberately fake (they start with 99) and every description starts with
 * "(DEMO)". A real catalog sync never returns them, so it marks them inactive instead of renaming
 * them, and a product still using them fails validation on its next save. Do not use real-looking
 * codes here: a real sync would overwrite their meaning silently.
 *
 * Run alone (does not touch any other data): npx tsx prisma/seed-siat-catalogs.ts
 */

const ACTIVITIES = 'sincronizarActividades';
const PRODUCTS = 'sincronizarListaProductosServicios';
const UNITS = 'sincronizarParametricaUnidadMedida';

const DEMO_ACTIVITY = '999990';
const DEMO_ACTIVITY_2 = '999991';

interface DemoRow {
  catalog: string;
  code: string;
  description: string;
  parentCode?: string;
  extra?: Record<string, unknown>;
}

const DEMO_ROWS: DemoRow[] = [
  {
    catalog: ACTIVITIES,
    code: DEMO_ACTIVITY,
    description:
      '(DEMO) Venta al por menor de productos farmacéuticos y medicinales',
    extra: { tipoActividad: 'P' },
  },
  {
    catalog: ACTIVITIES,
    code: DEMO_ACTIVITY_2,
    description: '(DEMO) Venta al por menor de cosméticos y artículos de tocador',
    extra: { tipoActividad: 'S' },
  },
  ...[
    ['9900001', '(DEMO) Medicamentos de venta libre'],
    ['9900002', '(DEMO) Medicamentos con receta médica'],
    ['9900003', '(DEMO) Medicamentos controlados (psicotrópicos y estupefacientes)'],
    ['9900004', '(DEMO) Suplementos y vitaminas'],
    ['9900005', '(DEMO) Material de curación'],
  ].map(([code, description]) => productRow(DEMO_ACTIVITY, code, description)),
  ...[
    ['9900011', '(DEMO) Cosméticos'],
    ['9900012', '(DEMO) Artículos de higiene personal'],
  ].map(([code, description]) => productRow(DEMO_ACTIVITY_2, code, description)),
  ...[
    ['9901', '(DEMO) UNIDAD'],
    ['9902', '(DEMO) CAJA'],
    ['9903', '(DEMO) FRASCO'],
    ['9904', '(DEMO) BLISTER'],
    ['9905', '(DEMO) SOBRE'],
    ['9906', '(DEMO) TUBO'],
  ].map(([code, description]) => ({ catalog: UNITS, code, description })),
];

/** Same key shape as the real sync: `activity:product`, parent = activity (SIAT-07). */
function productRow(activity: string, code: string, description: string): DemoRow {
  return {
    catalog: PRODUCTS,
    code: `${activity}:${code}`,
    description,
    parentCode: activity,
    extra: { codigoProducto: code, nandina: [] },
  };
}

export async function seedSiatDemoCatalogs(prisma: PrismaClient): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.log('↷ SIAT demo catalogs skipped (NODE_ENV=production)');
    return;
  }
  const now = new Date();
  for (const row of DEMO_ROWS) {
    const data = {
      description: row.description,
      parent_code: row.parentCode ?? null,
      ...(row.extra ? { extra: row.extra as object } : {}),
      active: true,
      synced_at: now,
    };
    await prisma.siatCatalogItem.upsert({
      where: { catalog_code: { catalog: row.catalog, code: row.code } },
      update: data,
      create: { catalog: row.catalog, code: row.code, ...data },
    });
  }
  console.log(
    `✓ SIAT demo catalogs: ${DEMO_ROWS.length} rows (activities, products, units). Codes start with 99`,
  );
}

// Standalone run: only the demo catalogs, nothing else in the seed.
if (process.argv[1]?.replace(/\\/g, '/').endsWith('prisma/seed-siat-catalogs.ts')) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  seedSiatDemoCatalogs(prisma)
    .catch((error) => {
      console.error('SIAT demo catalog seed failed:', error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
