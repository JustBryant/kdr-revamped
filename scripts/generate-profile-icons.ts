
import { ItemType } from '@prisma/client';
import "dotenv/config";
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = (process.env.DATABASE_URL || '').replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Starting Profile Icon generation...');

    // 1. Get all TCG cards
    const cards = await prisma.card.findMany({
        where: {
            variant: 'TCG'
        },
        select: {
            id: true,
            konamiId: true,
            name: true,
            imageUrlCropped: true,
            artworks: true,
            primaryArtworkIndex: true,
            variant: true,
        }
    });

    console.log(`Found ${cards.length} TCG cards from DB.`);
    
    const validCards = cards.filter(c => c.konamiId);
    console.log(`Found ${validCards.length} valid cards with konamiId.`);

    const profileIconType = 'PROFILE_ICON' as any;
    
    // Batch processing to avoid overwhelming the DB
    const batchSize = 100;
    for (let i = 0; i < validCards.length; i += batchSize) {
        const batch = validCards.slice(i, i + batchSize);
        
        for (const card of batch) {
            // STRICTLY use the artworks array from the DB as the source of truth
            const artworks = card.artworks as any[] | null;
            
            if (artworks && Array.isArray(artworks)) {
                // Expansion: Create a unique icon per artwork
                for (let artworkIndex = 0; artworkIndex < artworks.length; artworkIndex++) {
                    const selectedArt = artworks[artworkIndex];
                    if (!selectedArt) continue;
                    
                    const imageUrl = selectedArt.image_url_cropped || selectedArt.imageUrlCropped;
                    if (!imageUrl) continue;

                    // UNIQUE EXTERNAL ID LOGIC:
                    // Primary artwork (Index 0) uses the original ID to avoid duplication
                    // Alternative artworks use the suffix ID
                    const externalId = artworkIndex === 0 
                        ? `icon_${card.konamiId}`
                        : `icon_${card.konamiId}_art_${artworkIndex}`;
                    
                    // Name formatting: "Name Icon" for first, "Name Icon #2" for others
                    const suffix = artworkIndex === 0 ? "" : ` #${artworkIndex + 1}`;
                    const iconName = `${card.name} Icon${suffix}`;

                    await prisma.item.upsert({
                        where: { externalId },
                        update: {
                            name: iconName,
                            imageUrl: imageUrl,
                        },
                        create: {
                            externalId,
                            name: iconName,
                            description: `A profile icon featuring ${card.name}${artworkIndex > 0 ? ` (Artwork ${artworkIndex + 1})` : ''}.`,
                            price: 100,
                            type: profileIconType,
                            imageUrl: imageUrl,
                            isSellable: true,
                        }
                    });
                }
            }
        }
        
        console.log(`Processed ${Math.min(i + batchSize, validCards.length)} / ${validCards.length}`);
    }

    console.log('Profile Icon generation complete.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
