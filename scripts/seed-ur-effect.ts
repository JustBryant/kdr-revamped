
import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import pkg from 'pg';
const { Pool } = pkg;
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding Ultra Rare Glow Card Effect...');

  const ultraRareGlow = await prisma.item.upsert({
    where: { externalId: 'effect_ur_glow' },
    update: {
      name: 'Ultra Rare Glow',
      description: 'A legendary holographic radiance that emanates from your signature card.',
      price: 5000,
      type: 'CARD_EFFECT',
      isSellable: true,
      imageUrl: '/images/effects/ur_glow_preview.png', // Placeholder or real preview
      metadata: {
        component: 'UltraRareGlow',
        color: '#d946ef'
      }
    },
    create: {
      externalId: 'effect_ur_glow',
      name: 'Ultra Rare Glow',
      description: 'A legendary holographic radiance that emanates from your signature card.',
      price: 5000,
      type: 'CARD_EFFECT',
      isSellable: true,
      imageUrl: '/images/effects/ur_glow_preview.png',
      metadata: {
        component: 'UltraRareGlow',
        color: '#d946ef'
      }
    }
  });

  console.log('Created/Updated Item:', ultraRareGlow.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
