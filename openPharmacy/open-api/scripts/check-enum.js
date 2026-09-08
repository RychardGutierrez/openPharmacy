const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
(async () => {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT unnest(enum_range(NULL::pharmacy."MovementType")) AS v',
  );
  console.log('MovementType values:', rows);
  await prisma.$disconnect();
})();
