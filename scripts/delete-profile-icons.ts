
import { prisma } from '../lib/prisma';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  console.log('Starting deletion of all PROFILE_ICON items...');
  const result = await prisma.item.deleteMany({
    where: {
      type: 'PROFILE_ICON' as any,
    },
  });
  console.log(`Successfully deleted ${result.count} PROFILE_ICON items.`);
}

main()
  .catch((e) => {
    console.error('Error deleting items:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
