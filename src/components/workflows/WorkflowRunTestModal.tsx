'use client'

import { useEffect, useState } from 'react'
import { Button, Modal, Textarea } from '@/components/ui'
import { DEFAULT_WORKFLOW_TEST_INPUT } from '@/lib/workflows/testInput'

interface WorkflowRunTestModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onRun: (inputData: Record<string, unknown>) => void
  running?: boolean
}

export function WorkflowRunTestModal({ open, onOpenChange, onRun, running }: WorkflowRunTestModalProps) {
  const [json, setJson] = useState(JSON.stringify(DEFAULT_WORKFLOW_TEST_INPUT, null, 2))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setJson(JSON.stringify(DEFAULT_WORKFLOW_TEST_INPUT, null, 2))
      setError(null)
    }
  }, [open])

  function handleRun() {
    try {
      const parsed = JSON.parse(json) as Record<string, unknown>
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setError('Test data must be a JSON object')
        return
      }
      setError(null)
      onRun(parsed)
    } catch {
      setError('Invalid JSON — check commas and quotes')
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title="Test run data"
      description="Variables like {{customer.email}} need customer data. Edit the sample below, then run."
      footer={(
        <>
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={running}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleRun} disabled={running}>
            {running ? 'Running…' : 'Run with test data'}
          </Button>
        </>
      )}
    >
      <Textarea
        label="Test input (JSON)"
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={14}
        className="font-mono text-xs"
      />
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
        In production, activate the workflow and create a customer — the system passes this data automatically.
      </p>
    </Modal>
  )
}
