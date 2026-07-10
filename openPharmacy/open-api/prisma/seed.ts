import 'dotenv/config';
import { PrismaClient, UserRole, ProductCategory } from '../prisma/generated/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // ─── Roles ────────────────────────────────────────────────────────────────
  const roles = [
    { name: UserRole.ADMIN, description: 'System administrator with full access' },
    { name: UserRole.PHARMACIST, description: 'Licensed pharmacist' },
    { name: UserRole.CASHIER, description: 'Cashier for point of sale' },
    { name: UserRole.TECHNICIAN, description: 'Pharmacy technician' },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log('✓ Roles created');

  // ─── Users ────────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      full_name: 'Carlos Mendoza',
      ci: '1234567',
      email: 'admin@openpharmacy.com',
      passwordHash,
      roleName: UserRole.ADMIN,
      reg_number: null,
    },
    {
      full_name: 'Maria Fernandez',
      ci: '7654321',
      email: 'pharmacist@openpharmacy.com',
      passwordHash,
      roleName: UserRole.PHARMACIST,
      reg_number: 'FARM-2024-001',
    },
    {
      full_name: 'Juan Perez',
      ci: '9876543',
      email: 'cashier@openpharmacy.com',
      passwordHash,
      roleName: UserRole.CASHIER,
      reg_number: null,
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { full_name: user.full_name },
      create: user,
    });
  }
  console.log('✓ Users created');

  // ─── Products ─────────────────────────────────────────────────────────────
  const products = [
    {
      dci_name: 'Paracetamol',
      commercial_name: 'Paragesic',
      laboratory: 'Laboratorios Phoenix',
      form: 'Tableta',
      concentration: '500mg',
      barcode: '7791234567890',
      category: ProductCategory.OTC,
      sale_price: 12.5,
      cost_price: 8.0,
      min_stock: 100,
    },
    {
      dci_name: 'Ibuprofeno',
      commercial_name: 'Ibuprom',
      laboratory: 'Medix',
      form: 'Tableta',
      concentration: '400mg',
      barcode: '7791234567891',
      category: ProductCategory.OTC,
      sale_price: 18.0,
      cost_price: 11.0,
      min_stock: 80,
    },
    {
      dci_name: 'Amoxicilina',
      commercial_name: 'Amoxil',
      laboratory: 'GSK',
      form: 'Cápsula',
      concentration: '500mg',
      barcode: '7791234567892',
      category: ProductCategory.PRESCRIPTION,
      sale_price: 35.0,
      cost_price: 22.0,
      min_stock: 50,
    },
    {
      dci_name: 'Omeprazol',
      commercial_name: 'Omepral',
      laboratory: 'Mi Pharma',
      form: 'Cápsula',
      concentration: '20mg',
      barcode: '7791234567893',
      category: ProductCategory.OTC,
      sale_price: 22.0,
      cost_price: 14.0,
      min_stock: 60,
    },
    {
      dci_name: 'Losartan',
      commercial_name: 'Losartan',
      laboratory: 'Microsules',
      form: 'Tableta',
      concentration: '50mg',
      barcode: '7791234567894',
      category: ProductCategory.PRESCRIPTION,
      sale_price: 28.0,
      cost_price: 18.0,
      min_stock: 70,
    },
    {
      dci_name: 'Metformina',
      commercial_name: 'Metformin',
      laboratory: 'Biopinox',
      form: 'Tableta',
      concentration: '850mg',
      barcode: '7791234567895',
      category: ProductCategory.PRESCRIPTION,
      sale_price: 25.0,
      cost_price: 16.0,
      min_stock: 60,
    },
    {
      dci_name: 'Ambroxol',
      commercial_name: 'Mucosolvan',
      laboratory: 'Abbott',
      form: 'Jarabe',
      concentration: '120ml',
      barcode: '7791234567896',
      category: ProductCategory.OTC,
      sale_price: 32.0,
      cost_price: 20.0,
      min_stock: 40,
    },
    {
      dci_name: 'Diclofenaco',
      commercial_name: 'Diclofen',
      laboratory: 'Ketonal',
      form: 'Tableta',
      concentration: '100mg',
      barcode: '7791234567897',
      category: ProductCategory.OTC,
      sale_price: 15.0,
      cost_price: 9.0,
      min_stock: 90,
    },
    {
      dci_name: 'Ciprofloxacino',
      commercial_name: 'Ciproxina',
      laboratory: 'Bayer',
      form: 'Tableta',
      concentration: '500mg',
      barcode: '7791234567898',
      category: ProductCategory.PRESCRIPTION,
      sale_price: 42.0,
      cost_price: 28.0,
      min_stock: 30,
    },
    {
      dci_name: 'Loratadina',
      commercial_name: 'Clarityne',
      laboratory: 'Bayer',
      form: 'Tableta',
      concentration: '10mg',
      barcode: '7791234567899',
      category: ProductCategory.OTC,
      sale_price: 20.0,
      cost_price: 12.0,
      min_stock: 70,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { barcode: product.barcode },
      update: { sale_price: product.sale_price },
      create: product,
    });
  }
  console.log('✓ Products created');

  console.log('\nSeeding complete!');
  console.log('─────────────────────────────────────────────');
  console.log('Users:');
  console.log('  admin@openpharmacy.com / password123 (ADMIN)');
  console.log('  pharmacist@openpharmacy.com / password123 (PHARMACIST)');
  console.log('  cashier@openpharmacy.com / password123 (CASHIER)');
  console.log('─────────────────────────────────────────────');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
