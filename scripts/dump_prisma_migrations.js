const { prisma } = require('../lib/prisma')
(async () => {
  try {
    const rows = await prisma.$queryRaw`SELECT id, migration_name, checksum, started_at, finished_at, rolled_back_at, applied_steps_count FROM "_prisma_migrations" ORDER BY started_at DESC LIMIT 50`;
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('ERROR', e);
    process.exit(1);
  } finally {
    try { await prisma.$disconnect(); } catch (e) {}
  }
})();
