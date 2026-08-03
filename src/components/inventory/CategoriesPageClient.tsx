'use client'

import { useCallback, useState } from 'react'
import useSWR from 'swr'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronRight,
  FolderTree,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
import { PageHeader, Button, Card, CardBody, Badge, Input, toast, ConfirmDialog } from '@/components/ui'
import { swrFetcher } from '@/lib/api/apiClient'

interface CategoryTreeNode {
  id: string
  name: string
  slug: string
  parentId: string | null
  sortOrder: number
  description: string | null
  productCount: number
  directProductCount: number
  children: CategoryTreeNode[]
}

function CategoryRow({
  node,
  depth,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  onAddChild,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  node: CategoryTreeNode
  depth: number
  expanded: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onAddChild: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
}) {
  const hasChildren = node.children.length > 0

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/50 border border-transparent hover:border-slate-200 group"
      style={{ paddingLeft: `${depth * 20 + 12}px` }}
    >
      <GripVertical className="h-4 w-4 text-slate-300 shrink-0 cursor-grab opacity-0 group-hover:opacity-100" />
      <button type="button" onClick={onToggle} className="shrink-0 p-0.5">
        {hasChildren ? (
          expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
        ) : (
          <span className="w-4 inline-block" />
        )}
      </button>
      <FolderTree className="h-4 w-4 text-indigo-500 shrink-0" />
      <span className="font-medium text-sm flex-1 truncate">{node.name}</span>
      <Badge variant="default">{node.productCount}</Badge>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100">
        <Button type="button" variant="ghost" size="sm" onClick={onAddChild} title="Add subcategory">
          <Plus className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-red-500" />
        </Button>
      </div>
    </div>
  )
}

function TreeBranch({
  nodes,
  depth,
  expandedIds,
  toggleExpanded,
  ...handlers
}: {
  nodes: CategoryTreeNode[]
  depth: number
  expandedIds: Set<string>
  toggleExpanded: (id: string) => void
  onEdit: (node: CategoryTreeNode) => void
  onDelete: (node: CategoryTreeNode) => void
  onAddChild: (parentId: string | null) => void
  dragId: string | null
  setDragId: (id: string | null) => void
  onReparent: (dragId: string, targetParentId: string | null, siblingOrder: string[]) => void
}) {
  const { dragId, setDragId, onReparent, onEdit, onDelete, onAddChild } = handlers

  return (
    <>
      {nodes.map((node) => {
        const expanded = expandedIds.has(node.id)
        return (
          <div key={node.id}>
            <CategoryRow
              node={node}
              depth={depth}
              expanded={expanded}
              onToggle={() => toggleExpanded(node.id)}
              onEdit={() => onEdit(node)}
              onDelete={() => onDelete(node)}
              onAddChild={() => onAddChild(node.id)}
              onDragStart={(e) => {
                setDragId(node.id)
                e.dataTransfer.setData('text/plain', node.id)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.dataTransfer.dropEffect = 'move'
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                const dragged = dragId ?? e.dataTransfer.getData('text/plain')
                if (!dragged || dragged === node.id) return
                const siblingOrder = nodes.map((n) => (n.id === dragged ? node.id : n.id))
                if (!siblingOrder.includes(dragged)) siblingOrder.push(dragged)
                onReparent(dragged, node.parentId, siblingOrder)
                setDragId(null)
              }}
            />
            {expanded && node.children.length > 0 && (
              <TreeBranch
                nodes={node.children}
                depth={depth + 1}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
                {...handlers}
              />
            )}
          </div>
        )
      })}
    </>
  )
}

export function CategoriesPageClient() {
  const { data: tree = [], mutate, isLoading } = useSWR<CategoryTreeNode[]>(
    '/inventory/categories?tree=true',
    swrFetcher,
  )

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const [editor, setEditor] = useState<{ id?: string; name: string; parentId: string | null } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CategoryTreeNode | null>(null)
  const [saving, setSaving] = useState(false)

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const saveCategory = async () => {
    if (!editor?.name.trim()) {
      toast.error('Name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/inventory/categories', {
        method: editor.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          editor.id
            ? { id: editor.id, name: editor.name, parentId: editor.parentId }
            : { name: editor.name, parentId: editor.parentId },
        ),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Save failed')
      toast.success(editor.id ? 'Category updated' : 'Category created')
      setEditor(null)
      mutate()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const res = await fetch(`/api/inventory/categories?id=${deleteTarget.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error?.message ?? 'Delete failed')
      return
    }
    toast.success('Category deleted')
    setDeleteTarget(null)
    mutate()
  }

  const onReparent = async (id: string, parentId: string | null, siblingOrder: string[]) => {
    const res = await fetch('/api/inventory/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action: 'reorder', id, parentId, siblingOrder }),
    })
    const json = await res.json()
    if (!json.success) {
      toast.error(json.error?.message ?? 'Reorder failed')
      return
    }
    mutate()
  }

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Categories"
        subtitle="Organise products in a hierarchical catalogue"
        breadcrumbs={[
          { label: 'Inventory', href: '/inventory' },
          { label: 'Products', href: '/inventory/products' },
          { label: 'Categories' },
        ]}
        actions={
          <Button onClick={() => setEditor({ name: '', parentId: null })}>
            <Plus className="h-4 w-4 mr-2" /> Add root category
          </Button>
        }
      />

      <div className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-auto">
        <Card className="lg:col-span-2">
          <CardBody className="p-4">
            {isLoading && <p className="text-slate-500">Loading categories…</p>}
            {!isLoading && tree.length === 0 && (
              <p className="text-slate-500 text-sm">No categories yet. Create a root category to get started.</p>
            )}
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const dragged = dragId ?? e.dataTransfer.getData('text/plain')
                if (!dragged) return
                onReparent(dragged, null, tree.map((n) => n.id))
                setDragId(null)
              }}
            >
              <TreeBranch
                nodes={tree}
                depth={0}
                expandedIds={expandedIds}
                toggleExpanded={toggleExpanded}
                dragId={dragId}
                setDragId={setDragId}
                onReparent={onReparent}
                onEdit={(node) => setEditor({ id: node.id, name: node.name, parentId: node.parentId })}
                onDelete={setDeleteTarget}
                onAddChild={(parentId) => setEditor({ name: '', parentId })}
              />
            </div>
            <p className="text-xs text-slate-400 mt-4">Drag categories to reorder or drop on root area to promote to top level.</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-5 space-y-4">
            <h3 className="font-semibold">{editor?.id ? 'Edit Category' : editor ? 'New Category' : 'Category Editor'}</h3>
            {!editor ? (
              <p className="text-sm text-slate-500">Select a category to edit or click Add.</p>
            ) : (
              <>
                <Input
                  label="Name"
                  value={editor.name}
                  onChange={(e) => setEditor({ ...editor, name: e.target.value })}
                />
                <div className="flex gap-2">
                  <Button onClick={() => void saveCategory()} disabled={saving}>
                    {saving ? 'Saving…' : 'Save'}
                  </Button>
                  <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
                </div>
              </>
            )}
            <Link href="/inventory/products" className="text-sm text-indigo-600 hover:underline block">
              ← Back to products
            </Link>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete category?"
        description={`Delete "${deleteTarget?.name}"? Products will be unassigned.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => void confirmDelete()}
      />
    </div>
  )
}
