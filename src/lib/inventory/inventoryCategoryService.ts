import { prisma } from '@/lib/db/prisma'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export interface CategoryTreeNode {
  id: string
  name: string
  slug: string
  parentId: string | null
  sortOrder: number
  description: string | null
  imageUrl: string | null
  depth: number
  path: string[]
  productCount: number
  directProductCount: number
  children: CategoryTreeNode[]
}

interface CategoryRow {
  id: string
  name: string
  slug: string
  parentId: string | null
  sortOrder: number
  description: string | null
  imageUrl: string | null
  depth: number
  path: string[]
  directProductCount: bigint
}

/** Recursive CTE tree with product counts per category (direct + subtree). */
export async function getCategoryTree(tenantId: string): Promise<CategoryTreeNode[]> {
  const rows = await prisma.$queryRaw<CategoryRow[]>`
    WITH RECURSIVE category_tree AS (
      SELECT
        c.id,
        c.name,
        c.slug,
        c."parentId",
        c."sortOrder",
        c.description,
        c."imageUrl",
        0 AS depth,
        ARRAY[c.id]::text[] AS path
      FROM categories c
      WHERE c."tenantId" = ${tenantId} AND c."parentId" IS NULL

      UNION ALL

      SELECT
        c.id,
        c.name,
        c.slug,
        c."parentId",
        c."sortOrder",
        c.description,
        c."imageUrl",
        ct.depth + 1,
        ct.path || c.id
      FROM categories c
      INNER JOIN category_tree ct ON c."parentId" = ct.id
      WHERE c."tenantId" = ${tenantId}
    )
    SELECT
      ct.id,
      ct.name,
      ct.slug,
      ct."parentId",
      ct."sortOrder",
      ct.description,
      ct."imageUrl",
      ct.depth,
      ct.path,
      COALESCE(pc.cnt, 0)::bigint AS "directProductCount"
    FROM category_tree ct
    LEFT JOIN (
      SELECT "categoryId", COUNT(*)::bigint AS cnt
      FROM products
      WHERE "tenantId" = ${tenantId} AND "isActive" = true
      GROUP BY "categoryId"
    ) pc ON pc."categoryId" = ct.id
    ORDER BY ct.depth ASC, ct."sortOrder" ASC, ct.name ASC
  `

  const nodeMap = new Map<string, CategoryTreeNode>()
  const roots: CategoryTreeNode[] = []

  for (const row of rows) {
    const node: CategoryTreeNode = {
      id: row.id,
      name: row.name,
      slug: row.slug,
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      description: row.description,
      imageUrl: row.imageUrl,
      depth: row.depth,
      path: row.path,
      directProductCount: Number(row.directProductCount),
      productCount: Number(row.directProductCount),
      children: [],
    }
    nodeMap.set(row.id, node)
  }

  for (const row of rows) {
    const node = nodeMap.get(row.id)!
    if (row.parentId && nodeMap.has(row.parentId)) {
      nodeMap.get(row.parentId)!.children.push(node)
    } else if (!row.parentId) {
      roots.push(node)
    }
  }

  function rollupCounts(node: CategoryTreeNode): number {
    let total = node.directProductCount
    for (const child of node.children) {
      total += rollupCounts(child)
    }
    node.productCount = total
    return total
  }
  for (const root of roots) rollupCounts(root)

  return roots
}

export async function listCategoriesFlat(tenantId: string) {
  return prisma.category.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      sortOrder: true,
      description: true,
      imageUrl: true,
      createdAt: true,
      _count: { select: { products: true } },
    },
  })
}

export async function createCategory(
  tenantId: string,
  data: { name: string; slug?: string; parentId?: string | null; description?: string | null },
) {
  const slug = data.slug ?? `${slugify(data.name)}-${Date.now().toString(36)}`
  const maxOrder = await prisma.category.aggregate({
    where: { tenantId, parentId: data.parentId ?? null },
    _max: { sortOrder: true },
  })
  return prisma.category.create({
    data: {
      tenantId,
      name: data.name,
      slug,
      parentId: data.parentId ?? null,
      description: data.description ?? null,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  })
}

export async function updateCategory(
  tenantId: string,
  categoryId: string,
  data: {
    name?: string
    slug?: string
    parentId?: string | null
    description?: string | null
    sortOrder?: number
  },
) {
  const existing = await prisma.category.findFirst({ where: { id: categoryId, tenantId } })
  if (!existing) throw new Error('Category not found')

  if (data.parentId !== undefined && data.parentId) {
    if (data.parentId === categoryId) throw new Error('Category cannot be its own parent')
    const descendants = await getDescendantIds(tenantId, categoryId)
    if (descendants.includes(data.parentId)) {
      throw new Error('Cannot move category under its own descendant')
    }
  }

  return prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  })
}

async function getDescendantIds(tenantId: string, categoryId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH RECURSIVE descendants AS (
      SELECT id FROM categories WHERE id = ${categoryId} AND "tenantId" = ${tenantId}
      UNION ALL
      SELECT c.id FROM categories c
      INNER JOIN descendants d ON c."parentId" = d.id
      WHERE c."tenantId" = ${tenantId}
    )
    SELECT id FROM descendants WHERE id != ${categoryId}
  `
  return rows.map((r) => r.id)
}

export async function reorderCategory(
  tenantId: string,
  categoryId: string,
  data: { parentId?: string | null; sortOrder?: number; siblingOrder?: string[] },
) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, tenantId } })
  if (!category) throw new Error('Category not found')

  const parentId = data.parentId !== undefined ? data.parentId : category.parentId

  if (data.siblingOrder?.length) {
    await prisma.$transaction(
      data.siblingOrder.map((id, index) =>
        prisma.category.updateMany({
          where: { id, tenantId, parentId: parentId ?? null },
          data: { sortOrder: index, ...(id === categoryId && data.parentId !== undefined ? { parentId } : {}) },
        }),
      ),
    )
    return { updated: true }
  }

  return updateCategory(tenantId, categoryId, {
    parentId: data.parentId,
    sortOrder: data.sortOrder,
  })
}

export async function deleteCategory(tenantId: string, categoryId: string) {
  const existing = await prisma.category.findFirst({ where: { id: categoryId, tenantId } })
  if (!existing) throw new Error('Category not found')

  const childCount = await prisma.category.count({ where: { parentId: categoryId, tenantId } })
  if (childCount > 0) throw new Error('Cannot delete category with subcategories')

  await prisma.product.updateMany({
    where: { categoryId, tenantId },
    data: { categoryId: null },
  })

  await prisma.category.delete({ where: { id: categoryId } })
  return { deleted: true }
}

export async function resolveCategoryIdByName(
  tenantId: string,
  name: string,
): Promise<string | null> {
  if (!name.trim()) return null
  const cat = await prisma.category.findFirst({
    where: { tenantId, name: { equals: name.trim(), mode: 'insensitive' } },
    select: { id: true },
  })
  return cat?.id ?? null
}
