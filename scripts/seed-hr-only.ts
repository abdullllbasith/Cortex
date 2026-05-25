/**
 * Seed HR, CRM contacts, dashboard activity, and backfill sales_events for existing tenants.
 * Safe to re-run — skips sections already present.
 */
import { PrismaClient } from '@prisma/client'
import {
  backfillSalesEventContacts,
  seedCrmContactsForTenant,
  seedDashboardActivity,
  seedHrForTenant,
} from '../prisma/seedHr'

const prisma = new PrismaClient()

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: {
      id: true,
      slug: true,
      users: { where: { role: 'OWNER', isActive: true }, take: 1, select: { id: true } },
    },
  })

  for (const tenant of tenants) {
    const owner = tenant.users[0]
    if (!owner) {
      console.warn(`  ⚠ ${tenant.slug}: no owner user — skip`)
      continue
    }
    console.log(`Seeding ${tenant.slug}…`)
    await seedCrmContactsForTenant(prisma, tenant.id, owner.id)
    await seedHrForTenant(prisma, tenant.id, owner.id, tenant.slug)
    await seedDashboardActivity(prisma, tenant.id, owner.id)
    await backfillSalesEventContacts(prisma, tenant.id)
    console.log(`  ✓ ${tenant.slug} done`)
  }

  console.log('✅ HR supplemental seed complete')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
