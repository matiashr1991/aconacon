import { pgTable, uuid, varchar, text, numeric, timestamp, boolean, integer, jsonb, date, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ----------------- ENUMS -----------------

export const sourceTypeEnum = pgEnum('source_type', ['sales', 'supplier_list', 'purchases']);
export const importStatusEnum = pgEnum('import_status', ['pending', 'processing', 'completed', 'failed', 'dry_run_loaded', 'candidate_loaded', 'official_loaded']);
export const coverageStatusEnum = pgEnum('coverage_status_type', ['complete', 'partial', 'blocked']);

// ----------------- IMPORT PIPELINE -----------------

export const importBatch = pgTable('import_batch', {
  id: uuid('id').defaultRandom().primaryKey(),
  source_type: sourceTypeEnum('source_type'),
  original_filename: varchar('original_filename'),
  original_storage_path: text('original_storage_path'),
  status: importStatusEnum('status').default('pending'),
  provider_id: uuid('provider_id'),
  notes: text('notes'),
  uploaded_at: timestamp('uploaded_at', { withTimezone: true }).defaultNow(),
});

// ----------------- SUPPLIERS -----------------

export const supplier = pgTable('supplier', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  external_code: text('external_code'),
  tax_id: text('tax_id'),
  active: boolean('active').default(true),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const dimSupplier = pgTable('dim_supplier', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name'),
  code: varchar('code'),
  tax_id: varchar('tax_id'),
  active: boolean('active').default(true),
});

export const supplierProduct = pgTable('supplier_product', {
  id: uuid('id').defaultRandom().primaryKey(),
  supplier_id: uuid('supplier_id').references(() => supplier.id),
  supplier_article_code: text('supplier_article_code'),
  supplier_article_code_secondary: text('supplier_article_code_secondary'),
  barcode: text('barcode'),
  supplier_product_description: text('supplier_product_description'),
});

// ----------------- PRICE LISTS -----------------

export const supplierPriceList = pgTable('supplier_price_list', {
  id: uuid('id').defaultRandom().primaryKey(),
  import_batch_id: uuid('import_batch_id').references(() => importBatch.id),
  supplier_id: uuid('supplier_id').references(() => supplier.id),
  status: text('status').default('active'),
  effective_from: date('effective_from'),
  effective_to: date('effective_to'),
});

export const supplierPriceItem = pgTable('supplier_price_item', {
  id: uuid('id').defaultRandom().primaryKey(),
  supplier_price_list_id: uuid('supplier_price_list_id').references(() => supplierPriceList.id),
  supplier_product_id: uuid('supplier_product_id').references(() => supplierProduct.id),
  gross_unit_price: numeric('gross_unit_price'),
  discount_pct: numeric('discount_pct'),
  net_unit_price: numeric('net_unit_price'),
  internal_fixed: numeric('internal_fixed'),
  internal_pct: numeric('internal_pct'),
  net_plus_internal: numeric('net_plus_internal'),
  is_annulled: boolean('is_annulled').default(false),
});

export const stgSupplierPrice = pgTable('stg_supplier_price', {
  id: uuid('id').defaultRandom().primaryKey(),
  import_batch_id: uuid('import_batch_id').references(() => importBatch.id),
  row_number: integer('row_number'),
  supplier_code: varchar('supplier_code'),
  supplier_name: text('supplier_name'),
  article_code: varchar('article_code'),
  article_desc: text('article_desc'),
  barcode: varchar('barcode'),
  gross_price: numeric('gross_price'),
  discount_pct: numeric('discount_pct'),
  net_price_discounted: numeric('net_price_discounted'),
  fixed_internal_taxes: numeric('fixed_internal_taxes'),
  pct_internal_taxes: numeric('pct_internal_taxes'),
  net_price_plus_internal_taxes: numeric('net_price_plus_internal_taxes'),
  supplier_article_code: varchar('supplier_article_code'),
  supplier_article_code_secondary: varchar('supplier_article_code_secondary'),
  margin_hint: numeric('margin_hint'),
  canceled_flag: boolean('canceled_flag').default(false),
});

// ----------------- SALES & PERIODS -----------------

export const salesPeriod = pgTable('sales_period', {
  id: uuid('id').defaultRandom().primaryKey(),
  year: integer('year'),
  month: integer('month'),
  label: text('label'),
});

/**
 * sale_line — Matches the REAL Supabase DB structure.
 * Columns aligned with what the ERP report provides.
 */
export const saleLine = pgTable('sale_line', {
  id: uuid('id').defaultRandom().primaryKey(),
  import_batch_id: uuid('import_batch_id').references(() => importBatch.id, { onDelete: 'cascade' }),
  sales_period_id: uuid('sales_period_id').references(() => salesPeriod.id),
  
  // Dates
  sale_date: date('sale_date'),

  // Document identity
  voucher_type: text('voucher_type'),         // FCVTA, PRVTA, DVVTA, etc.
  voucher_number: text('voucher_number'),
  source_document_type: text('source_document_type'),
  is_credit_note: boolean('is_credit_note').default(false),

  // Commercial context
  branch: text('branch'),                     // Descripcion Sucursal
  seller: text('seller'),                     // Descripcion Vendedor
  customer: text('customer'),                 // "611 - GUERRERO MARIA CRISTINA"
  supplier_text: text('supplier_text'),        // "8 - DI BERNARDINI WALTER GABRIEL"

  // Product
  product_code: text('product_code'),
  product_description: text('product_description'),

  // Quantities & Prices (Sale side)
  quantity: numeric('quantity'),
  gross_unit_sale_price: numeric('gross_unit_sale_price'),   // Precio Unitario Bruto
  sale_discount_pct: numeric('sale_discount_pct'),           // Bonificacion %
  net_unit_sale_price: numeric('net_unit_sale_price'),        // Precio Neto Unitario
  net_subtotal: numeric('net_subtotal'),                     // Subtotal Neto

  // Cost from ERP Report (embedded in the sales report)
  purchase_cost_gross_from_report: numeric('purchase_cost_gross_from_report'), // Precio de compra Bruto
  purchase_cost_net_from_report: numeric('purchase_cost_net_from_report'),     // Precio de compra Neto
  purchase_cost_effective_date: date('purchase_cost_effective_date'),

  // Audit
  raw_payload: jsonb('raw_payload'),
});

export const saleCostResolution = pgTable('sale_cost_resolution', {
  id: uuid('id').defaultRandom().primaryKey(),
  sale_line_id: uuid('sale_line_id').references(() => saleLine.id, { onDelete: 'cascade' }),
  resolution_mode: text('resolution_mode'),   // CHECK: supplier_list, sales_report, manual
  match_method: text('match_method'),         // CHECK: article+supplier, barcode, supplier_code, manual, fallback
  supplier_price_item_id: uuid('supplier_price_item_id').references(() => supplierPriceItem.id),
  resolved_cost_unit: numeric('resolved_cost_unit'),
  resolved_cost_total: numeric('resolved_cost_total'),
  confidence: numeric('confidence'),
  warning_flag: boolean('warning_flag').default(false),
});

export const saleLineProfit = pgTable('sale_line_profit', {
  id: uuid('id').defaultRandom().primaryKey(),
  sale_line_id: uuid('sale_line_id').references(() => saleLine.id, { onDelete: 'cascade' }),
  cost_method: varchar('cost_method'),
  matched_snapshot_id: uuid('matched_snapshot_id'),
  cost_unit_gross: numeric('cost_unit_gross'),
  cost_unit_net: numeric('cost_unit_net'),
  cost_unit_internal_taxes: numeric('cost_unit_internal_taxes'),
  cost_unit_final: numeric('cost_unit_final'),
  cost_total: numeric('cost_total'),
  sale_net_total: numeric('sale_net_total'),
  gross_margin_amount: numeric('gross_margin_amount'),
  gross_margin_pct: numeric('gross_margin_pct'),
  coverage_status: coverageStatusEnum('coverage_status'),
  coverage_reason: varchar('coverage_reason'),
});

// ----------------- RELATIONS -----------------

export const importBatchRelations = relations(importBatch, ({ many }) => ({
  saleLines: many(saleLine),
}));

export const dbSchemaRelations = relations(saleLine, ({ one, many }) => ({
  importBatch: one(importBatch, { fields: [saleLine.import_batch_id], references: [importBatch.id] }),
  costResolutions: many(saleCostResolution),
  profit: many(saleLineProfit),
}));

export const profitRelations = relations(saleLineProfit, ({ one }) => ({
  saleLine: one(saleLine, { fields: [saleLineProfit.sale_line_id], references: [saleLine.id] })
}));

export const resolutionRelations = relations(saleCostResolution, ({ one }) => ({
  saleLine: one(saleLine, { fields: [saleCostResolution.sale_line_id], references: [saleLine.id] })
}));
