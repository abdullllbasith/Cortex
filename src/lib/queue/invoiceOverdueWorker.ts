import {
  scheduleInvoiceOverdueJobs,
  startInvoiceOverdueWorker,
} from '@/lib/finance/invoiceOverdueScheduler'

async function main() {
  console.log('[invoiceOverdueWorker] Starting finance invoice overdue worker...')
  await scheduleInvoiceOverdueJobs()
  const worker = startInvoiceOverdueWorker()
  if (!worker) {
    console.error('[invoiceOverdueWorker] Failed to start — Redis unavailable')
    process.exit(1)
  }
  worker.on('completed', (job) => console.log(`[invoiceOverdueWorker] Job ${job.id} completed`))
  worker.on('failed', (job, err) => console.error(`[invoiceOverdueWorker] Job ${job?.id} failed`, err))
}

main().catch((err) => {
  console.error('[invoiceOverdueWorker] Fatal error', err)
  process.exit(1)
})
