# SalesEvent emission audit

`SalesEvent` records power analytics (revenue, margin, product velocity). Every stock-out sale path must emit one event per product line.

## Covered paths

| Path | Emitter | Notes |
|------|---------|-------|
| `orderService.deliverOrder()` | `emitSalesEventsFromOrderLines` | Primary order-to-cash path; uses `lineTotal` as revenue, `costPrice × qty` as cost |
| `orderService.fulfillOrder()` (DELIVERED) | Delegates to `deliverOrder()` | Same as above |
| `stockEngine.recordTransaction()` (SALE) | `emitSalesEvent` inline | Fires when `referenceType !== 'sales_order'` (POS, adjustments, manual sales) |
| `inventoryCatalogService` | None direct | Reads ledger SALE rows for analytics only |

## Intentionally skipped (duplicate prevention)

| Path | Reason |
|------|--------|
| `stockEngine.recordTransaction()` with `referenceType: 'sales_order'` | `deliverOrder()` emits per line with correct revenue/margin |
| `reorderService` SALE aggregates | Read-only demand calculation, not customer sales |

## Adding a new sale path

1. After stock is deducted, call `emitSalesEvent()` or `emitSalesEventsFromOrderLines()`.
2. Pass `referenceType` + `referenceId` for idempotency.
3. Use **line total** (after discount/tax) as `revenue`, not `unitPrice × quantity`, when discounts apply.
