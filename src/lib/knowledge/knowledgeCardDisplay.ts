type EntityTab = 'customer' | 'product' | 'supplier' | 'knowledge' | 'contact'

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function joinParts(parts: Array<string | null | undefined>, separator = ' · '): string {
  return parts.filter(Boolean).join(separator)
}

export function buildKnowledgeCardTitle(
  item: Record<string, unknown>,
  entityType: EntityTab,
): string {
  switch (entityType) {
    case 'customer':
    case 'contact': {
      const profile = asRecord(item.profile)
      return String(
        profile.name ?? item.name ?? (entityType === 'contact' ? 'Untitled contact' : 'Untitled customer'),
      )
    }
    case 'product':
      return String(item.name ?? asRecord(item.catalog).name ?? 'Untitled product')
    case 'supplier':
      return String(item.name ?? 'Untitled supplier')
    case 'knowledge':
      return String(item.title ?? 'Untitled document')
    default:
      return 'Untitled'
  }
}

export function buildKnowledgeCardSnippet(
  item: Record<string, unknown>,
  entityType: EntityTab,
): string {
  switch (entityType) {
    case 'customer':
    case 'contact': {
      const profile = asRecord(item.profile)
      const snippet = joinParts([
        profile.company ? String(profile.company) : null,
        profile.tier ? `${profile.tier} tier` : null,
        profile.email ? String(profile.email) : null,
        profile.region ? String(profile.region) : null,
      ])
      return snippet || 'No profile details yet'
    }
    case 'product': {
      const catalog = asRecord(item.catalog)
      const snippet = joinParts([
        item.sku ? `SKU ${item.sku}` : catalog.sku ? `SKU ${catalog.sku}` : null,
        item.inventoryLevel != null ? `${item.inventoryLevel} in stock` : null,
        item.description ? String(item.description) : catalog.description ? String(catalog.description) : null,
        item.sellingPrice != null ? `$${Number(item.sellingPrice).toLocaleString()}` : null,
      ])
      return snippet || 'No product details yet'
    }
    case 'supplier': {
      const metrics = asRecord(item.reliabilityMetrics)
      const snippet = joinParts([
        item.performanceScore != null ? `Score ${item.performanceScore}/100` : null,
        metrics.onTimeDelivery != null ? `${metrics.onTimeDelivery}% on-time` : null,
        metrics.category ? String(metrics.category) : null,
      ])
      return snippet || 'No supplier metrics yet'
    }
    case 'knowledge': {
      const content = String(item.content ?? '').trim()
      if (content) return content.length > 140 ? `${content.slice(0, 137)}…` : content
      const meta = asRecord(item.metadata)
      return joinParts([meta.type ? String(meta.type) : null, meta.category ? String(meta.category) : null]) || 'No preview available'
    }
    default:
      return 'No preview available'
  }
}

export function mapListItemToKnowledgeCard(
  item: Record<string, unknown>,
  entityType: EntityTab,
) {
  return {
    id: String(item.id),
    entityType,
    title: buildKnowledgeCardTitle(item, entityType),
    snippet: buildKnowledgeCardSnippet(item, entityType),
    embeddingStatus: item.embeddingStatus as string | undefined,
    similarity: undefined as number | undefined,
    metadata: asRecord(item.metadata),
  }
}
