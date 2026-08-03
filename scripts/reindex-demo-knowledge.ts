/**
 * Re-index demo tenant knowledge with current embedding model.
 * Usage: npx tsx --tsconfig tsconfig.scripts.json scripts/reindex-demo-knowledge.ts
 */
import { prisma } from '../src/lib/db/prismaClient'
import { indexAllTenantKnowledge } from '../src/lib/embeddings/knowledgeIndexer'

async function main() {
  const tenant =
    (await prisma.tenant.findUnique({ where: { slug: 'demo' } })) ??
    (await prisma.tenant.findFirst({
      where: { users: { some: { email: 'demo@saios.app' } } },
    }))

  if (!tenant) {
    console.error('Demo tenant not found')
    process.exit(1)
  }

  console.log('Re-indexing tenant', tenant.slug, tenant.id)
  console.log('Embedding model:', process.env.EMBEDDING_MODEL || 'nvidia/nemotron-3-embed-1b:free')

  const results = await indexAllTenantKnowledge(tenant.id)
  console.log(JSON.stringify(results, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
