import React from 'react'
import { z } from 'zod'
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer'
import { supabase } from '@/lib/supabase/client'
import { WorkflowContext } from '../../core/WorkflowContext'
import type { NodeHandler, WorkflowEngineContext } from '../../types'
import { nodeError, validateConfig } from '../utils'

const schema = z.object({
  documentType: z.enum(['invoice', 'purchase_order', 'quotation', 'report']),
  template: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
  outputVariable: z.string().default('document.url'),
})

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12 },
  title: { fontSize: 18, marginBottom: 12, fontWeight: 'bold' },
  row: { marginBottom: 6 },
})

function buildDocument(type: string, data: Record<string, unknown>) {
  const title = type.replace(/_/g, ' ').toUpperCase()
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.title }, title),
      ...Object.entries(data).map(([k, v]) =>
        React.createElement(
          View,
          { key: k, style: styles.row },
          React.createElement(Text, null, `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`),
        ),
      ),
    ),
  )
}

export const generateDocumentHandler: NodeHandler = async ({ inputData, config }, engineCtx) => {
  const cfg = validateConfig(schema, config, 'action.generate_document')
  const ctx = new WorkflowContext(engineCtx as WorkflowEngineContext)
  const docData = (ctx.interpolate(cfg.data ?? inputData) ?? {}) as Record<string, unknown>

  const element = buildDocument(cfg.documentType, docData)
  const buffer = await renderToBuffer(element)
  const fileName = `${cfg.documentType}-${engineCtx.executionId}-${Date.now()}.pdf`
  const storagePath = `workflows/${engineCtx.tenantId}/${fileName}`

  let publicUrl: string

  if (supabase) {
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true })
    if (error) throw nodeError('action.generate_document', error.message)
    const { data: urlData } = supabase.storage.from('documents').getPublicUrl(data.path)
    publicUrl = urlData.publicUrl
  } else {
    publicUrl = `data:application/pdf;base64,${buffer.toString('base64').slice(0, 200)}…`
    ctx.appendLog('Supabase not configured — document URL is dev placeholder')
  }

  ctx.setVariable(cfg.outputVariable, publicUrl)
  ctx.appendLog(`Generated ${cfg.documentType} PDF`)

  return {
    outputData: {
      ...inputData,
      documentType: cfg.documentType,
      documentUrl: publicUrl,
      path: storagePath,
    },
  }
}
