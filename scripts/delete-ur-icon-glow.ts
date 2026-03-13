
import { PrismaClient } from '@prisma/client';
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
    const deleted = await prisma.item.deleteMany({
        where: { name: 'Ultra Rare Icon Glow' }
    });
    console.log(`Deleted ${deleted.count} items.`);
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
