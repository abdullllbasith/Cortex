import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { POPdfData } from './purchaseOrderService'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  logo: { fontSize: 18, fontWeight: 'bold', color: '#4338ca' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#64748b' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#334155' },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 100, color: '#64748b' },
  value: { flex: 1 },
  table: { marginTop: 8 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 6,
    fontWeight: 'bold',
    borderBottom: '1px solid #cbd5e1',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 6,
    borderBottom: '1px solid #e2e8f0',
  },
  colProduct: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colCost: { flex: 1, textAlign: 'right' },
  colTax: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  totals: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', width: 200, justifyContent: 'space-between', marginBottom: 4 },
  grandTotal: { fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  footer: { marginTop: 32, fontSize: 9, color: '#64748b' },
})

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function buildPurchaseOrderPdf(data: POPdfData) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.logo }, data.tenantName),
          React.createElement(Text, { style: { marginTop: 4, color: '#64748b' } }, data.tenantAddress ?? ''),
        ),
        React.createElement(
          View,
          { style: { alignItems: 'flex-end' } },
          React.createElement(Text, { style: styles.title }, 'PURCHASE ORDER'),
          React.createElement(Text, { style: styles.subtitle }, data.poNumber),
          React.createElement(Text, { style: styles.subtitle }, `Date: ${data.orderDate}`),
        ),
      ),
      React.createElement(
        View,
        { style: { flexDirection: 'row', gap: 24, marginBottom: 16 } },
        React.createElement(
          View,
          { style: { flex: 1 } },
          React.createElement(Text, { style: styles.sectionTitle }, 'Supplier'),
          React.createElement(Text, null, data.supplierName),
          data.supplierEmail
            ? React.createElement(Text, { style: { color: '#64748b' } }, data.supplierEmail)
            : null,
          data.supplierAddress
            ? React.createElement(Text, { style: { color: '#64748b' } }, data.supplierAddress)
            : null,
        ),
        React.createElement(
          View,
          { style: { flex: 1 } },
          React.createElement(Text, { style: styles.sectionTitle }, 'Deliver To'),
          React.createElement(Text, null, data.warehouseName),
          data.warehouseAddress
            ? React.createElement(Text, { style: { color: '#64748b' } }, data.warehouseAddress)
            : null,
          data.expectedDelivery
            ? React.createElement(
                Text,
                { style: { marginTop: 4 } },
                `Expected: ${data.expectedDelivery}`,
              )
            : null,
        ),
      ),
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.colProduct }, 'Product'),
          React.createElement(Text, { style: styles.colQty }, 'Qty'),
          React.createElement(Text, { style: styles.colCost }, 'Unit Cost'),
          React.createElement(Text, { style: styles.colTax }, 'Tax %'),
          React.createElement(Text, { style: styles.colTotal }, 'Total'),
        ),
        ...data.lines.map((line, i) =>
          React.createElement(
            View,
            { key: String(i), style: styles.tableRow },
            React.createElement(
              Text,
              { style: styles.colProduct },
              `${line.sku} — ${line.name}`,
            ),
            React.createElement(Text, { style: styles.colQty }, String(line.quantity)),
            React.createElement(Text, { style: styles.colCost }, money(line.unitCost, data.currency)),
            React.createElement(Text, { style: styles.colTax }, `${line.taxRate}%`),
            React.createElement(Text, { style: styles.colTotal }, money(line.totalCost, data.currency)),
          ),
        ),
      ),
      React.createElement(
        View,
        { style: styles.totals },
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, null, 'Subtotal'),
          React.createElement(Text, null, money(data.subtotal, data.currency)),
        ),
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, null, 'Tax'),
          React.createElement(Text, null, money(data.taxTotal, data.currency)),
        ),
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, null, 'Shipping'),
          React.createElement(Text, null, money(data.shippingCost, data.currency)),
        ),
        React.createElement(
          View,
          { style: [styles.totalRow, styles.grandTotal] },
          React.createElement(Text, null, 'Grand Total'),
          React.createElement(Text, null, money(data.grandTotal, data.currency)),
        ),
      ),
      data.terms
        ? React.createElement(
            View,
            { style: { ...styles.section, marginTop: 24 } },
            React.createElement(Text, { style: styles.sectionTitle }, 'Terms & Conditions'),
            React.createElement(Text, null, data.terms),
          )
        : null,
      data.notes
        ? React.createElement(
            View,
            { style: styles.section },
            React.createElement(Text, { style: styles.sectionTitle }, 'Notes'),
            React.createElement(Text, null, data.notes),
          )
        : null,
      React.createElement(
        Text,
        { style: styles.footer },
        'Generated by Cortex — Enterprise AI Operating System',
      ),
    ),
  )
}
