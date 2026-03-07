import { prisma } from '../lib/prisma'

async function main(){
  const users = await prisma.user.findMany({ where: { password: { not: null } }, take: 5, select: { id: true, email: true, name: true } })
  console.log(JSON.stringify(users, null, 2))
}

main().catch(e => { console.error(e); process.exit(1) })
