const { PrismaClient } = require('@prisma/client');
(async () => {
  const prisma = new PrismaClient();
  try {
    const rows = await prisma.$queryRaw`SELECT id, migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 50`;
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
