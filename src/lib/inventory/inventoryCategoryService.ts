import { prisma } from '@/lib/db/prisma'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function listCategories(tenantId: string) {
  return prisma.category.findMany({
    where: { tenantId },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, parentId: true, createdAt: true },
  })
}

export async function createCategory(
  tenantId: string,
  data: { name: string; slug?: string; parentId?: string | null },
) {
  const slug = data.slug ?? `${slugify(data.name)}-${Date.now().toString(36)}`
  return prisma.category.create({
    data: {
      tenantId,
      name: data.name,
      slug,
      parentId: data.parentId ?? null,
    },
  })
}

export async function updateCategory(
  tenantId: string,
  categoryId: string,
  data: { name?: string; slug?: string; parentId?: string | null },
) {
  const existing = await prisma.category.findFirst({ where: { id: categoryId, tenantId } })
  if (!existing) throw new Error('Category not found')

  return prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
    },
  })
}

export async function deleteCategory(tenantId: string, categoryId: string) {
  const existing = await prisma.category.findFirst({ where: { id: categoryId, tenantId } })
  if (!existing) throw new Error('Category not found')

  const childCount = await prisma.category.count({ where: { parentId: categoryId, tenantId } })
  if (childCount > 0) throw new Error('Cannot delete category with subcategories')

  const productCount = await prisma.product.count({ where: { categoryId, tenantId } })
  if (productCount > 0) {
    await prisma.product.updateMany({
      where: { categoryId, tenantId },
      data: { categoryId: null },
    })
  }

  await prisma.category.delete({ where: { id: categoryId } })
  return { deleted: true }
}
