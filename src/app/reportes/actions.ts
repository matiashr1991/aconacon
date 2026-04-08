'use server';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, desc, or, lte, gte, sql, ilike, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getSalesBatchesAction() {
  try {
    const batches = await db.query.importBatch.findMany({
      where: eq(schema.importBatch.source_type, 'sales'),
      orderBy: [desc(schema.importBatch.uploaded_at)]
    });
    return { success: true, data: batches };
  } catch (error: any) {
    console.error('Error in getSalesBatches:', error);
    return { success: false, error: error.message };
  }
}

// Utility to build the where clause for sales
function buildSalesConditions(
  saleBatchId: string, 
  salesDateFrom?: string, 
  salesDateTo?: string,
  filters?: {
    seller?: string;
    supplier?: string;
    customer?: string;
    productCode?: string;
  }
) {
  const conditions = [];
  if (saleBatchId) conditions.push(eq(schema.saleLine.import_batch_id, saleBatchId));
  if (salesDateFrom) conditions.push(gte(schema.saleLine.sale_date, salesDateFrom));
  if (salesDateTo) conditions.push(lte(schema.saleLine.sale_date, salesDateTo));
  
  if (filters?.seller) conditions.push(eq(schema.saleLine.seller, filters.seller));
  if (filters?.supplier) conditions.push(eq(schema.saleLine.supplier_text, filters.supplier));
  if (filters?.customer) conditions.push(eq(schema.saleLine.customer, filters.customer));
  if (filters?.productCode) conditions.push(eq(schema.saleLine.product_code, filters.productCode));

  // Exclude credit notes from performance/profitability calculations
  conditions.push(eq(schema.saleLine.is_credit_note, false));
  
  return conditions;
}

export async function getProfitabilitySummaryAction(saleBatchId: string, salesDateFrom?: string, salesDateTo?: string) {
  try {
    const conditions = buildSalesConditions(saleBatchId, salesDateFrom, salesDateTo);
    const results = await db
      .select({
        totalSalesGross: sql<number>`sum(${schema.saleLine.net_subtotal}::numeric)`,
        totalCostAmount: sql<number>`sum(${schema.saleLineProfit.cost_total}::numeric)`,
        totalGrossMargin: sql<number>`sum(${schema.saleLineProfit.gross_margin_amount}::numeric)`,
        totalItems: sql<number>`count(${schema.saleLine.id})`,
        matchedItems: sql<number>`count(case when ${schema.saleLineProfit.coverage_status} = 'complete' then 1 end)`,
      })
      .from(schema.saleLine)
      .leftJoin(schema.saleLineProfit, eq(schema.saleLine.id, schema.saleLineProfit.sale_line_id))
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    if (!results || results.length === 0) return { success: true, data: null };
    
    const summary = results[0];
    const totalSales = Number(summary.totalSalesGross || 0);
    const totalMargin = Number(summary.totalGrossMargin || 0);
    const marginPct = totalSales !== 0 ? (totalMargin / Math.abs(totalSales)) * 100 : 0;

    return { 
      success: true, 
      data: {
        totalSalesGross: totalSales,
        totalCostAmount: Number(summary.totalCostAmount || 0),
        totalGrossMargin: totalMargin,
        marginPct: marginPct,
        totalItems: Number(summary.totalItems || 0),
        matchedItems: Number(summary.matchedItems || 0)
      }
    };
  } catch (error: any) {
    console.error('Error getProfitabilitySummary:', error);
    return { success: false, error: error.message };
  }
}

export async function getProfitabilityLinesAction(saleBatchId: string, page = 1, limit = 50, salesDateFrom?: string, salesDateTo?: string, searchQuery?: string) {
  try {
    const offset = (page - 1) * limit;
    const conditions = buildSalesConditions(saleBatchId, salesDateFrom, salesDateTo);
    
    if (searchQuery) {
      conditions.push(or(
        ilike(schema.saleLine.product_description, `%${searchQuery}%`),
        ilike(schema.saleLine.product_code, `%${searchQuery}%`),
        ilike(schema.saleLine.customer, `%${searchQuery}%`)
      )!);
    }

    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(schema.saleLine)
      .where(conditions.length > 0 ? and(...conditions) : undefined);
    const totalCount = Number(countResult[0].count);

    const data = await db
      .select({
        saleLineId: schema.saleLine.id,
        productCode: schema.saleLine.product_code,
        productName: schema.saleLine.product_description,
        quantity: schema.saleLine.quantity,
        saleGrossUnitPrice: schema.saleLine.gross_unit_sale_price,
        saleDiscountPct: schema.saleLine.sale_discount_pct,
        saleUnitPrice: schema.saleLine.net_unit_sale_price,
        saleNetTotal: schema.saleLine.net_subtotal,
        costUnitGross: schema.saleLineProfit.cost_unit_gross,
        costUnitNet: schema.saleLineProfit.cost_unit_net,
        costTotal: schema.saleLineProfit.cost_total,
        grossMargin: schema.saleLineProfit.gross_margin_amount,
        marginPct: schema.saleLineProfit.gross_margin_pct,
        status: schema.saleLineProfit.coverage_status,
        costMethod: schema.saleLineProfit.cost_method,
        vendedor: schema.saleLine.seller,
        sucursal: schema.saleLine.branch,
        customer: schema.saleLine.customer,
        supplierText: schema.saleLine.supplier_text,
      })
      .from(schema.saleLine)
      .leftJoin(schema.saleLineProfit, eq(schema.saleLine.id, schema.saleLineProfit.sale_line_id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(schema.saleLine.product_code)
      .limit(limit)
      .offset(offset);

    return { success: true, data, metadata: { total: totalCount, page, limit, totalPages: Math.ceil(totalCount / limit) } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getProfitabilityGroupedByProductAction(saleBatchId: string, salesDateFrom?: string, salesDateTo?: string, searchQuery?: string) {
  try {
    const conditions = buildSalesConditions(saleBatchId, salesDateFrom, salesDateTo);
    if (searchQuery) {
      conditions.push(or(
        ilike(schema.saleLine.product_description, `%${searchQuery}%`),
        ilike(schema.saleLine.product_code, `%${searchQuery}%`)
      )!);
    }

    const data = await db
      .select({
        productCode: schema.saleLine.product_code,
        productName: sql<string>`MAX(${schema.saleLine.product_description})`,
        totalQuantity: sql<number>`SUM(${schema.saleLine.quantity}::numeric)`,
        totalSalesGross: sql<number>`SUM(${schema.saleLine.net_subtotal}::numeric)`,
        totalCostAmount: sql<number>`SUM(${schema.saleLineProfit.cost_total}::numeric)`,
        totalGrossMargin: sql<number>`SUM(${schema.saleLineProfit.gross_margin_amount}::numeric)`,
        marginPct: sql<number>`
          CASE WHEN ABS(SUM(${schema.saleLine.net_subtotal}::numeric)) > 0 
          THEN (SUM(${schema.saleLineProfit.gross_margin_amount}::numeric) / ABS(SUM(${schema.saleLine.net_subtotal}::numeric))) * 100 
          ELSE 0 END`
      })
      .from(schema.saleLine)
      .leftJoin(schema.saleLineProfit, eq(schema.saleLine.id, schema.saleLineProfit.sale_line_id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(schema.saleLine.product_code)
      .orderBy(sql`SUM(${schema.saleLine.net_subtotal}::numeric) DESC`)
      .limit(searchQuery ? 500 : 100);

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Group profitability by supplier.
 * Uses the supplier_text field from the ERP report (e.g. "8 - DI BERNARDINI WALTER GABRIEL")
 * instead of complex JOIN chains through cost resolutions.
 */
export async function getProfitabilityGroupedBySupplierAction(saleBatchId: string, salesDateFrom?: string, salesDateTo?: string, searchQuery?: string) {
  try {
    const conditions = buildSalesConditions(saleBatchId, salesDateFrom, salesDateTo);
    
    if (searchQuery) {
      conditions.push(ilike(schema.saleLine.supplier_text, `%${searchQuery}%`));
    }

    const data = await db
      .select({
        supplierName: sql<string>`COALESCE(NULLIF(TRIM(${schema.saleLine.supplier_text}), ''), 'SIN PROVEEDOR')`,
        totalQuantity: sql<number>`SUM(${schema.saleLine.quantity}::numeric)`,
        totalSalesGross: sql<number>`SUM(${schema.saleLine.net_subtotal}::numeric)`,
        totalCostAmount: sql<number>`SUM(${schema.saleLineProfit.cost_total}::numeric)`,
        totalGrossMargin: sql<number>`SUM(${schema.saleLineProfit.gross_margin_amount}::numeric)`,
        marginPct: sql<number>`
          CASE WHEN ABS(SUM(${schema.saleLine.net_subtotal}::numeric)) > 0 
          THEN (SUM(${schema.saleLineProfit.gross_margin_amount}::numeric) / ABS(SUM(${schema.saleLine.net_subtotal}::numeric))) * 100 
          ELSE 0 END`
      })
      .from(schema.saleLine)
      .leftJoin(schema.saleLineProfit, eq(schema.saleLine.id, schema.saleLineProfit.sale_line_id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`COALESCE(NULLIF(TRIM(${schema.saleLine.supplier_text}), ''), 'SIN PROVEEDOR')`)
      .orderBy(sql`SUM(${schema.saleLine.net_subtotal}::numeric) DESC`)
      .limit(searchQuery ? 500 : 100);

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Group profitability by customer.
 * Uses the customer field (e.g. "611 - GUERRERO MARIA CRISTINA").
 */
export async function getProfitabilityGroupedByCustomerAction(saleBatchId: string, salesDateFrom?: string, salesDateTo?: string, searchQuery?: string) {
  try {
    const conditions = buildSalesConditions(saleBatchId, salesDateFrom, salesDateTo);
    
    if (searchQuery) {
      conditions.push(ilike(schema.saleLine.customer, `%${searchQuery}%`));
    }

    const data = await db
      .select({
        customerName: sql<string>`COALESCE(NULLIF(TRIM(${schema.saleLine.customer}), ''), 'SIN CLIENTE')`,
        totalQuantity: sql<number>`SUM(${schema.saleLine.quantity}::numeric)`,
        totalSalesGross: sql<number>`SUM(${schema.saleLine.net_subtotal}::numeric)`,
        totalCostAmount: sql<number>`SUM(${schema.saleLineProfit.cost_total}::numeric)`,
        totalGrossMargin: sql<number>`SUM(${schema.saleLineProfit.gross_margin_amount}::numeric)`,
        marginPct: sql<number>`
          CASE WHEN ABS(SUM(${schema.saleLine.net_subtotal}::numeric)) > 0 
          THEN (SUM(${schema.saleLineProfit.gross_margin_amount}::numeric) / ABS(SUM(${schema.saleLine.net_subtotal}::numeric))) * 100 
          ELSE 0 END`
      })
      .from(schema.saleLine)
      .leftJoin(schema.saleLineProfit, eq(schema.saleLine.id, schema.saleLineProfit.sale_line_id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`COALESCE(NULLIF(TRIM(${schema.saleLine.customer}), ''), 'SIN CLIENTE')`)
      .orderBy(sql`SUM(${schema.saleLine.net_subtotal}::numeric) DESC`);

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Group profitability by seller.
 */
export async function getProfitabilityGroupedBySellerAction(
  saleBatchId: string, 
  salesDateFrom?: string, 
  salesDateTo?: string,
  searchQuery?: string
) {
  try {
    const conditions = buildSalesConditions(saleBatchId, salesDateFrom, salesDateTo);
    if (searchQuery) {
      conditions.push(ilike(schema.saleLine.seller, `%${searchQuery}%`));
    }

    const data = await db
      .select({
        sellerName: sql<string>`COALESCE(NULLIF(TRIM(${schema.saleLine.seller}), ''), 'SIN VENDEDOR')`,
        totalQuantity: sql<number>`SUM(${schema.saleLine.quantity}::numeric)`,
        totalSalesGross: sql<number>`SUM(${schema.saleLine.net_subtotal}::numeric)`,
        totalCostAmount: sql<number>`SUM(${schema.saleLineProfit.cost_total}::numeric)`,
        totalGrossMargin: sql<number>`SUM(${schema.saleLineProfit.gross_margin_amount}::numeric)`,
        marginPct: sql<number>`
          CASE WHEN ABS(SUM(${schema.saleLine.net_subtotal}::numeric)) > 0 
          THEN (SUM(${schema.saleLineProfit.gross_margin_amount}::numeric) / ABS(SUM(${schema.saleLine.net_subtotal}::numeric))) * 100 
          ELSE 0 END`
      })
      .from(schema.saleLine)
      .leftJoin(schema.saleLineProfit, eq(schema.saleLine.id, schema.saleLineProfit.sale_line_id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(sql`COALESCE(NULLIF(TRIM(${schema.saleLine.seller}), ''), 'SIN VENDEDOR')`)
      .orderBy(sql`SUM(${schema.saleLineProfit.gross_margin_amount}::numeric) DESC`);

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Generic Performance Drill-down Action
 * Sorts by Gross Margin DESC (Mayor a Menor) as requested.
 */
export async function getPerformanceDataAction(
  saleBatchId: string,
  groupBy: 'seller' | 'supplier' | 'product' | 'customer',
  salesDateFrom?: string,
  salesDateTo?: string,
  filters?: {
    seller?: string;
    supplier?: string;
    customer?: string;
  }
) {
  try {
    const conditions = buildSalesConditions(saleBatchId, salesDateFrom, salesDateTo, filters);
    
    let groupColumn;
    let selectFields: any = {
      totalQuantity: sql<number>`SUM(${schema.saleLine.quantity}::numeric)`,
      totalSalesNet: sql<number>`SUM(${schema.saleLine.net_subtotal}::numeric)`,
      totalCostAmount: sql<number>`SUM(${schema.saleLineProfit.cost_total}::numeric)`,
      totalGrossMargin: sql<number>`SUM(${schema.saleLineProfit.gross_margin_amount}::numeric)`,
      marginPct: sql<number>`
        CASE WHEN ABS(SUM(${schema.saleLine.net_subtotal}::numeric)) > 0 
        THEN (SUM(${schema.saleLineProfit.gross_margin_amount}::numeric) / ABS(SUM(${schema.saleLine.net_subtotal}::numeric))) * 100 
        ELSE 0 END`
    };

    if (groupBy === 'seller') {
      groupColumn = sql`COALESCE(NULLIF(TRIM(${schema.saleLine.seller}), ''), 'SIN VENDEDOR')`;
      selectFields.id = groupColumn;
      selectFields.name = groupColumn;
    } else if (groupBy === 'supplier') {
      groupColumn = sql`COALESCE(NULLIF(TRIM(${schema.saleLine.supplier_text}), ''), 'SIN PROVEEDOR')`;
      selectFields.id = groupColumn;
      selectFields.name = groupColumn;
    } else if (groupBy === 'product') {
      groupColumn = schema.saleLine.product_code;
      selectFields.id = groupColumn;
      // We concat code and description for better entity naming
      selectFields.name = sql<string>`MAX(${schema.saleLine.product_description})`; 
      selectFields.code = schema.saleLine.product_code;
    } else {
      groupColumn = sql`COALESCE(NULLIF(TRIM(${schema.saleLine.customer}), ''), 'SIN CLIENTE')`;
      selectFields.id = groupColumn;
      selectFields.name = groupColumn;
    }

    const data = await db
      .select(selectFields)
      .from(schema.saleLine)
      .leftJoin(schema.saleLineProfit, eq(schema.saleLine.id, schema.saleLineProfit.sale_line_id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(groupColumn)
      .orderBy(sql`SUM(${schema.saleLineProfit.gross_margin_amount}::numeric) DESC NULLS LAST`)
      .limit(200);

    // Post-filter: Remove items with $0 margin AND $0 sales to avoid "garbage" in rankings
    // but keep them if they have units (optional, but requested to clean up)
    const filteredData = (data as any[]).filter(item => {
      const margin = Number(item.totalGrossMargin || 0);
      const sales = Number(item.totalSalesNet || 0);
      return Math.abs(margin) > 0.01 || Math.abs(sales) > 0.01;
    });

    return { success: true, data: filteredData };
  } catch (error: any) {
    console.error('Error Performance Drill-down:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetches unique filter values for the performance dashboard.
 */
export async function getPerformanceFiltersAction(saleBatchId: string) {
  try {
    const sellers = await db
      .selectDistinct({ value: schema.saleLine.seller })
      .from(schema.saleLine)
      .where(and(eq(schema.saleLine.import_batch_id, saleBatchId), sql`${schema.saleLine.seller} IS NOT NULL`))
      .orderBy(schema.saleLine.seller);

    const suppliers = await db
      .selectDistinct({ value: schema.saleLine.supplier_text })
      .from(schema.saleLine)
      .where(and(eq(schema.saleLine.import_batch_id, saleBatchId), sql`${schema.saleLine.supplier_text} IS NOT NULL`))
      .orderBy(schema.saleLine.supplier_text);

    return { 
      success: true, 
      data: { 
        sellers: sellers.map(s => s.value).filter(Boolean),
        suppliers: suppliers.map(s => s.value).filter(Boolean)
      } 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function runProfitabilityMatchAction(saleBatchId: string) {
  try {
    const { MatchingService } = await import('@/lib/services/matching-service');
    
    console.log(`Starting profitability analysis for batch ${saleBatchId}`);
    const result = await MatchingService.resolveBatchCosts(saleBatchId);

    revalidatePath('/reportes');
    return { 
      success: true, 
      matched_erp: result.matched_erp,
      matched_supplier: result.matched_supplier,
      unmatched: result.unmatched,
      total: result.total 
    };
  } catch (error: any) {
    console.error('Error in runProfitabilityMatchAction:', error);
    return { success: false, error: error.message };
  }
}

export async function getDrilldownLinesAction(
  saleBatchId: string, 
  filterType: 'product' | 'supplier', 
  filterValue: string,
  salesDateFrom?: string,
  salesDateTo?: string
) {
  try {
    const conditions = buildSalesConditions(saleBatchId, salesDateFrom, salesDateTo);
    
    if (filterType === 'product') {
      conditions.push(eq(schema.saleLine.product_code, filterValue));
    } else {
      conditions.push(eq(schema.saleLine.supplier_text, filterValue));
    }

    const data = await db
      .select({
        saleLineId: schema.saleLine.id,
        saleDate: schema.saleLine.sale_date,
        vendedor: schema.saleLine.seller,
        sucursal: schema.saleLine.branch,
        customer: schema.saleLine.customer,
        productCode: schema.saleLine.product_code,
        productName: schema.saleLine.product_description,
        quantity: schema.saleLine.quantity,
        // Pricing & Bonuses
        saleGrossUnitPrice: schema.saleLine.gross_unit_sale_price,
        saleDiscountPct: schema.saleLine.sale_discount_pct,
        saleUnitPrice: schema.saleLine.net_unit_sale_price,
        saleNetTotal: schema.saleLine.net_subtotal,
        costUnitGross: schema.saleLineProfit.cost_unit_gross,
        costUnitNet: schema.saleLineProfit.cost_unit_net,
        costTotal: schema.saleLineProfit.cost_total,
        grossMargin: schema.saleLineProfit.gross_margin_amount,
        marginPct: schema.saleLineProfit.gross_margin_pct,
      })
      .from(schema.saleLine)
      .leftJoin(schema.saleLineProfit, eq(schema.saleLine.id, schema.saleLineProfit.sale_line_id))
      .where(and(...conditions))
      .orderBy(desc(schema.saleLine.sale_date));

    return { success: true, data };
  } catch (error: any) {
    console.error('Error in getDrilldownLinesAction:', error);
    return { success: false, error: error.message };
  }
}
