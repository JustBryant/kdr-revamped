import { PrismaClient, ItemType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

dotenv.config();

let connectionString = process.env.DATABASE_URL || '';
if ((connectionString.startsWith('"') && connectionString.endsWith('"')) || (connectionString.startsWith("'") && connectionString.endsWith("'"))) {
  connectionString = connectionString.slice(1, -1);
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('--- Seeding Icon Effects ---');

    const effects = [
        {
            name: 'Ultra Rare Icon Glow',
            description: 'A radiant golden aura that emanates from your profile icon.',
            type: ItemType.ICON_EFFECT,
            price: 5000,
            imageUrl: '', 
            metadata: {
                variant: 'UR_GLOW',
                intensity: 'high',
                color: '#FFD700'
            }
        },
        {
            name: 'Shatterfoil Icon Overlay',
            description: 'Prismatic shards that dance across your profile icon.',
            type: ItemType.ICON_EFFECT,
            price: 4500,
            imageUrl: '',
            metadata: {
                variant: 'SHATTERFOIL',
                pattern: 'prismatic'
            }
        }
    ];

    for (const effect of effects) {
        // Find by name and type
        const existing = await prisma.item.findFirst({
            where: { name: effect.name, type: effect.type }
        });

        if (existing) {
            await prisma.item.update({
                where: { id: existing.id },
                data: effect as any
            });
            console.log(`Updated Icon Effect: ${existing.name} (${existing.id})`);
        } else {
            const item = await prisma.item.create({
                data: effect as any,
            });
            console.log(`Created Icon Effect: ${item.name} (${item.id})`);
        }
    }

    console.log('--- Seeding Complete ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
