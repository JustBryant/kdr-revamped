
import { prisma } from '../lib/prisma'

async function backfillDefaultIcons() {
  const defaultIconName = "Blue-Eyes White Dragon";
  
  const defaultIcon = await prisma.item.findFirst({
    where: { 
      name: { contains: defaultIconName, mode: 'insensitive' },
      type: 'PROFILE_ICON'
    }
  });

  if (!defaultIcon) {
    console.log("No Blue-Eyes White Dragon profile icon found in the Item table.");
    return;
  }

  const users = await prisma.user.findMany({
    select: { id: true, name: true }
  });

  console.log(`Checking ${users.length} users for default icon ownership...`);

  let count = 0;
  for (const user of users) {
    const existing = await (prisma as any).userItem.findUnique({
      where: {
        userId_itemId: {
          userId: user.id,
          itemId: defaultIcon.id
        }
      }
    });

    if (!existing) {
      await (prisma as any).userItem.create({
        data: {
          userId: user.id,
          itemId: defaultIcon.id
        }
      });
      console.log(`Granted Blue-Eyes icon to user: ${user.name}`);
      count++;
    }
  }

  console.log(`Backfill complete. Granted icons to ${count} users.`);
}

backfillDefaultIcons()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
