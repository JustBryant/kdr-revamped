
import { ItemType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import 'dotenv/config';

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
        
        await Promise.all(batch.map(async (card) => {
            const externalId = `icon_${card.konamiId}`;
            
            // STRICTLY use the artworks array from the DB as the source of truth
            const artworks = card.artworks as any[] | null;
            const index = card.primaryArtworkIndex ?? 0;
            let imageUrl = null;
            
            if (artworks && Array.isArray(artworks)) {
                const selectedArt = artworks[index] || artworks[0];
                if (selectedArt) {
                    // USER REQUIREMENT: STRICTLY use image_url_cropped from the object. Skip if missing.
                    imageUrl = selectedArt.image_url_cropped || selectedArt.imageUrlCropped;
                }
            }

            // CRITICAL: Skip any card that does not have a valid cropped image in its artworks field
            if (!imageUrl) {
                return;
            }
            
            await prisma.item.upsert({
                where: { externalId },
                update: {
                    name: `${card.name} Icon`,
                    imageUrl: imageUrl,
                },
                create: {
                    externalId,
                    name: `${card.name} Icon`,
                    description: `A profile icon featuring ${card.name}.`,
                    price: 100,
                    type: profileIconType,
                    imageUrl: imageUrl,
                    isSellable: true,
                }
            });
        }));
        
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
