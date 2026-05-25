import React from 'react'
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { PayrollLineItem } from './payrollTypes'

export interface PaySlipPdfData {
  tenantName: string
  employeeName: string
  employeeNumber: string
  department: string | null
  designation: string | null
  month: number
  year: number
  earnings: PayrollLineItem[]
  deductions: PayrollLineItem[]
  grossSalary: number
  totalDeductions: number
  netSalary: number
  workingDays: number
  presentDays: number
  leaveDeductions: number
  taxDeducted: number
}

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  logo: { fontSize: 16, fontWeight: 'bold', color: '#4338ca' },
  title: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 10, color: '#64748b', marginTop: 2 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#334155' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottom: '1px solid #e2e8f0' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 6, fontWeight: 'bold' },
  colName: { flex: 3 },
  colAmount: { flex: 1, textAlign: 'right' },
  netBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#eef2ff',
    borderRadius: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  netLabel: { fontSize: 12, fontWeight: 'bold' },
  netAmount: { fontSize: 16, fontWeight: 'bold', color: '#4338ca' },
  meta: { fontSize: 9, color: '#64748b', marginTop: 24 },
})

function money(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function periodLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function buildPaySlipPdf(data: PaySlipPdfData) {
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
          React.createElement(Text, { style: styles.subtitle }, 'Confidential payslip'),
        ),
        React.createElement(
          View,
          { style: { alignItems: 'flex-end' } },
          React.createElement(Text, { style: styles.title }, 'PAYSLIP'),
          React.createElement(Text, { style: styles.subtitle }, periodLabel(data.month, data.year)),
        ),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Employee'),
        React.createElement(Text, null, data.employeeName),
        React.createElement(Text, { style: styles.subtitle }, data.employeeNumber),
        data.department ? React.createElement(Text, { style: styles.subtitle }, data.department) : null,
        data.designation ? React.createElement(Text, { style: styles.subtitle }, data.designation) : null,
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Attendance'),
        React.createElement(Text, { style: styles.subtitle }, `Working days: ${data.workingDays} · Present: ${data.presentDays}`),
        data.leaveDeductions > 0
          ? React.createElement(Text, { style: styles.subtitle }, `Leave deductions: ${money(data.leaveDeductions)}`)
          : null,
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Earnings'),
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.colName }, 'Component'),
          React.createElement(Text, { style: styles.colAmount }, 'Amount'),
        ),
        ...data.earnings.map((e, i) =>
          React.createElement(
            View,
            { key: `e-${i}`, style: styles.row },
            React.createElement(Text, { style: styles.colName }, e.component),
            React.createElement(Text, { style: styles.colAmount }, money(e.amount)),
          ),
        ),
        React.createElement(
          View,
          { style: { ...styles.row, fontWeight: 'bold', marginTop: 4 } },
          React.createElement(Text, { style: styles.colName }, 'Gross salary'),
          React.createElement(Text, { style: styles.colAmount }, money(data.grossSalary)),
        ),
      ),
      React.createElement(
        View,
        { style: styles.section },
        React.createElement(Text, { style: styles.sectionTitle }, 'Deductions'),
        ...data.deductions.map((d, i) =>
          React.createElement(
            View,
            { key: `d-${i}`, style: styles.row },
            React.createElement(Text, { style: styles.colName }, d.component),
            React.createElement(Text, { style: styles.colAmount }, money(d.amount)),
          ),
        ),
        React.createElement(
          View,
          { style: { ...styles.row, fontWeight: 'bold', marginTop: 4 } },
          React.createElement(Text, { style: styles.colName }, 'Total deductions'),
          React.createElement(Text, { style: styles.colAmount }, money(data.totalDeductions)),
        ),
      ),
      React.createElement(
        View,
        { style: styles.netBox },
        React.createElement(Text, { style: styles.netLabel }, 'Net pay'),
        React.createElement(Text, { style: styles.netAmount }, money(data.netSalary)),
      ),
      React.createElement(
        Text,
        { style: styles.meta },
        'This is a system-generated payslip. Please contact HR for discrepancies.',
      ),
    ),
  )
}
