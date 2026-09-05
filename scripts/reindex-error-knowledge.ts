/**
 * Re-index BusinessKnowledge rows stuck in ERROR/PENDING/FAILED.
 * Usage: npx tsx --tsconfig tsconfig.scripts.json scripts/reindex-error-knowledge.ts
 */
import { EmbeddingStatus } from '@prisma/client'
import { prisma } from '../src/lib/db/prismaClient'
import { generateEmbeddingsBatch } from '../src/lib/embeddings/embeddingService'
import {
  hashEmbeddingContent,
  toVectorLiteral,
  truncateForEmbedding,
} from '../src/lib/embeddings/types'

async function main() {
  const broken = await prisma.businessKnowledge.findMany({
    where: {
      embeddingStatus: {
        in: [EmbeddingStatus.ERROR, EmbeddingStatus.FAILED, EmbeddingStatus.PENDING],
      },
    },
    select: {
      id: true,
      tenantId: true,
      title: true,
      content: true,
      type: true,
      embeddingStatus: true,
    },
    orderBy: { updatedAt: 'desc' },
  })

  console.log(`Found ${broken.length} knowledge docs needing re-index`)
  for (const row of broken.slice(0, 30)) {
    console.log(
      ` - [${row.embeddingStatus}] ${row.title} chars=${(row.content ?? '').length}`,
    )
  }

  if (broken.length === 0) {
    console.log('Nothing to re-index')
    return
  }

  console.log('Embedding model:', process.env.EMBEDDING_MODEL || 'nvidia/nemotron-3-embed-1b:free')

  let indexed = 0
  let errors = 0

  for (const row of broken) {
    const content = truncateForEmbedding(`${row.type}: ${row.title}\n${row.content}`)
    const contentHash = hashEmbeddingContent(`${row.type}: ${row.title}\n${row.content}`)
    try {
      const [vector] = await generateEmbeddingsBatch([content])
      const vectorLiteral = toVectorLiteral(vector)
      const now = new Date()
      await prisma.$executeRaw`
        UPDATE business_knowledge
        SET embedding = ${vectorLiteral}::vector,
            "embeddingStatus" = ${EmbeddingStatus.INDEXED}::text,
            "embeddingContentHash" = ${contentHash},
            "embeddingUpdatedAt" = ${now}
        WHERE id = ${row.id}
      `
      indexed++
      console.log(`OK  ${row.title}`)
    } catch (err) {
      errors++
      const message = err instanceof Error ? err.message : String(err)
      console.error(`ERR ${row.title}: ${message.slice(0, 200)}`)
      await prisma.businessKnowledge.update({
        where: { id: row.id },
        data: { embeddingStatus: EmbeddingStatus.ERROR },
      })
    }
  }

  const stillBroken = await prisma.businessKnowledge.count({
    where: {
      embeddingStatus: { in: [EmbeddingStatus.ERROR, EmbeddingStatus.FAILED] },
    },
  })
  console.log(`Done. newlyIndexed=${indexed}, failed=${errors}, still ERROR/FAILED=${stillBroken}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
