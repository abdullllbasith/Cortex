import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { InvoicePdfData } from './invoiceTypes'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  logo: { fontSize: 18, fontWeight: 'bold', color: '#4338ca' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 4 },
  subtitle: { fontSize: 10, color: '#64748b' },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#334155' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    padding: 6,
    fontWeight: 'bold',
    borderBottom: '1px solid #cbd5e1',
  },
  tableRow: { flexDirection: 'row', padding: 6, borderBottom: '1px solid #e2e8f0' },
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 1, textAlign: 'right' },
  colTotal: { flex: 1, textAlign: 'right' },
  totals: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', width: 220, justifyContent: 'space-between', marginBottom: 4 },
  grandTotal: { fontSize: 12, fontWeight: 'bold', marginTop: 4 },
  dueBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 4,
    alignSelf: 'flex-end',
    width: 220,
  },
  footer: { marginTop: 32, fontSize: 9, color: '#64748b' },
})

function money(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
}

export function buildInvoicePdf(data: InvoicePdfData) {
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
          data.tenantAddress
            ? React.createElement(Text, { style: { marginTop: 4, color: '#64748b' } }, data.tenantAddress)
            : null,
        ),
        React.createElement(
          View,
          { style: { alignItems: 'flex-end' } },
          React.createElement(Text, { style: styles.title }, 'INVOICE'),
          React.createElement(Text, { style: styles.subtitle }, data.invoiceNumber),
          React.createElement(Text, { style: styles.subtitle }, `Issue date: ${data.issueDate}`),
          React.createElement(Text, { style: styles.subtitle }, `Due date: ${data.dueDate}`),
        ),
      ),
      React.createElement(
        View,
        { style: { marginBottom: 16 } },
        React.createElement(Text, { style: styles.sectionTitle }, 'Bill To'),
        React.createElement(Text, null, data.customerName),
        data.customerEmail
          ? React.createElement(Text, { style: { color: '#64748b' } }, data.customerEmail)
          : null,
        data.customerCompany
          ? React.createElement(Text, { style: { color: '#64748b' } }, data.customerCompany)
          : null,
      ),
      React.createElement(
        View,
        null,
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.colDesc }, 'Description'),
          React.createElement(Text, { style: styles.colQty }, 'Qty'),
          React.createElement(Text, { style: styles.colPrice }, 'Unit'),
          React.createElement(Text, { style: styles.colTotal }, 'Total'),
        ),
        ...data.lines.map((line, i) =>
          React.createElement(
            View,
            { key: i, style: styles.tableRow },
            React.createElement(Text, { style: styles.colDesc }, line.description),
            React.createElement(Text, { style: styles.colQty }, String(line.quantity)),
            React.createElement(Text, { style: styles.colPrice }, money(line.unitPrice, data.currency)),
            React.createElement(Text, { style: styles.colTotal }, money(line.lineTotal, data.currency)),
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
          React.createElement(Text, null, 'Discount'),
          React.createElement(Text, null, `-${money(data.discountTotal, data.currency)}`),
        ),
        React.createElement(
          View,
          { style: styles.totalRow },
          React.createElement(Text, null, 'Tax'),
          React.createElement(Text, null, money(data.taxTotal, data.currency)),
        ),
        React.createElement(
          View,
          { style: [styles.totalRow, styles.grandTotal] },
          React.createElement(Text, null, 'Total'),
          React.createElement(Text, null, money(data.total, data.currency)),
        ),
      ),
      React.createElement(
        View,
        { style: styles.dueBox },
        React.createElement(Text, { style: { fontWeight: 'bold', marginBottom: 4 } }, 'Amount Due'),
        React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#4338ca' } },
          money(data.amountDue, data.currency)),
        data.amountPaid > 0
          ? React.createElement(Text, { style: { marginTop: 4, fontSize: 9 } },
              `Paid: ${money(data.amountPaid, data.currency)}`)
          : null,
      ),
      data.bankDetails
        ? React.createElement(
            View,
            { style: styles.footer },
            React.createElement(Text, { style: { fontWeight: 'bold', marginBottom: 4 } }, 'Payment Instructions'),
            React.createElement(Text, null, data.bankDetails),
          )
        : null,
      data.terms
        ? React.createElement(
            View,
            { style: { ...styles.footer, marginTop: 12 } },
            React.createElement(Text, { style: { fontWeight: 'bold', marginBottom: 4 } }, 'Payment Terms'),
            React.createElement(Text, null, data.terms),
          )
        : null,
      data.notes
        ? React.createElement(
            View,
            { style: { ...styles.footer, marginTop: 12 } },
            React.createElement(Text, { style: { fontWeight: 'bold', marginBottom: 4 } }, 'Notes'),
            React.createElement(Text, null, data.notes),
          )
        : null,
    ),
  )
}
