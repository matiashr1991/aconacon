import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, and, inArray, or, isNull, isNotNull, sql } from 'drizzle-orm';

type SaleLine = typeof schema.saleLine.$inferSelect;

/**
 * MatchingService — Profitability Engine
 * 
 * Strategy:
 * 1. PRIMARY: Use ERP-embedded cost (`purchase_cost_net_from_report`)
 *    - The ERP report already contains the purchase cost per line.
 *    - This is the most accurate cost because it reflects the ACTUAL purchase price
 *      at the time of sale, including any date-specific pricing.
 * 
 * 2. FALLBACK: Match against uploaded supplier price lists
 *    - Only used when ERP cost is missing (null/zero).
 *    - Matches by product_code → supplier_article_code.
 */
export class MatchingService {

  /**
   * Resolve costs for all sale_lines in a batch.
   * Returns summary stats.
   */
  static async resolveBatchCosts(batchId: string): Promise<{
    total: number;
    matched_erp: number;
    matched_supplier: number;
    unmatched: number;
  }> {
    // 1. Fetch ALL sale lines in this batch
    const lines = await db.select()
      .from(schema.saleLine)
      .where(eq(schema.saleLine.import_batch_id, batchId));

    const stats = {
      total: lines.length,
      matched_erp: 0,
      matched_supplier: 0,
      unmatched: 0,
    };

    if (lines.length === 0) return stats;

    // 2. Clear previous resolutions & profit for this batch
    const lineIds = lines.map(l => l.id);
    
    // Delete in batches to avoid huge IN clause
    for (let i = 0; i < lineIds.length; i += 500) {
      const chunk = lineIds.slice(i, i + 500);
      await db.delete(schema.saleLineProfit)
        .where(inArray(schema.saleLineProfit.sale_line_id, chunk));
      await db.delete(schema.saleCostResolution)
        .where(inArray(schema.saleCostResolution.sale_line_id, chunk));
    }

    // 3. Pre-fetch supplier price items for fallback matching
    const supplierPriceMap = await this.buildSupplierPriceMap();

    // 4. Process each line
    const profitInserts: (typeof schema.saleLineProfit.$inferInsert)[] = [];
    const resolutionInserts: (typeof schema.saleCostResolution.$inferInsert)[] = [];

    for (const line of lines) {
      const result = this.computeLineProfitability(line, supplierPriceMap);

      resolutionInserts.push({
        sale_line_id: line.id,
        resolution_mode: result.resolution_mode,
        match_method: result.match_method,
        supplier_price_item_id: result.supplier_price_item_id || null,
        resolved_cost_unit: result.cost_unit_net ? String(result.cost_unit_net) : null,
        resolved_cost_total: result.cost_total ? String(result.cost_total) : null,
        confidence: String(result.confidence),
        warning_flag: result.warning,
      });

      profitInserts.push({
        sale_line_id: line.id,
        cost_method: result.resolution_mode,
        cost_unit_gross: result.cost_unit_gross ? String(result.cost_unit_gross) : null,
        cost_unit_net: result.cost_unit_net ? String(result.cost_unit_net) : null,
        cost_unit_final: result.cost_unit_net ? String(result.cost_unit_net) : null,
        cost_total: result.cost_total ? String(result.cost_total) : null,
        sale_net_total: line.net_subtotal,
        gross_margin_amount: result.margin_amount ? String(result.margin_amount) : null,
        gross_margin_pct: result.margin_pct ? String(result.margin_pct) : null,
        coverage_status: result.coverage_status as any,
        coverage_reason: result.coverage_reason,
      });

      if (result.resolution_mode === 'sales_report') stats.matched_erp++;
      else if (result.resolution_mode === 'supplier_list') stats.matched_supplier++;
      else stats.unmatched++;
    }

    // 5. Bulk insert in batches
    for (let i = 0; i < profitInserts.length; i += 500) {
      await db.insert(schema.saleLineProfit).values(profitInserts.slice(i, i + 500));
      await db.insert(schema.saleCostResolution).values(resolutionInserts.slice(i, i + 500));
    }

    return stats;
  }

  /**
   * Core profitability computation for a single line.
   */
  private static computeLineProfitability(
    line: SaleLine,
    supplierPriceMap: Map<string, { net_unit_price: number; gross_unit_price: number; item_id: string }>
  ) {
    const qty = Math.abs(Number(line.quantity) || 0);
    // CRITICAL FIX: Use net_unit_sale_price * qty to ensure discounts are reflected in margin calculation
    const saleNetSubtotal = (Number(line.net_unit_sale_price) || 0) * qty;

    // ---- STRATEGY 1: ERP Cost from Report ----
    const erpCostNet = Number(line.purchase_cost_net_from_report) || 0;
    const erpCostGross = Number(line.purchase_cost_gross_from_report) || 0;

    if (erpCostNet > 0) {
      const costTotal = erpCostNet * qty;
      const marginAmount = saleNetSubtotal - costTotal;
      const marginPct = saleNetSubtotal !== 0
        ? (marginAmount / Math.abs(saleNetSubtotal)) * 100
        : 0;

      return {
        resolution_mode: 'sales_report' as const,
        match_method: 'fallback' as const, // ERP embedded data
        supplier_price_item_id: null,
        cost_unit_gross: erpCostGross,
        cost_unit_net: erpCostNet,
        cost_total: costTotal,
        margin_amount: marginAmount,
        margin_pct: Math.round(marginPct * 100) / 100,
        confidence: 0.95,
        warning: false,
        coverage_status: 'complete',
        coverage_reason: 'erp_report_cost',
      };
    }

    // ---- STRATEGY 2: Supplier Price List Matching ----
    const productCode = (line.product_code || '').trim();
    let match = productCode ? supplierPriceMap.get(productCode) : undefined;

    if (!match && productCode && /^\d+$/.test(productCode)) {
      match = supplierPriceMap.get(productCode.padStart(13, '0'));
    }

    if (match) {
      const costTotal = match.net_unit_price * qty;
      const marginAmount = saleNetSubtotal - costTotal;
      const marginPct = saleNetSubtotal !== 0
        ? (marginAmount / Math.abs(saleNetSubtotal)) * 100
        : 0;

      return {
        resolution_mode: 'supplier_list' as const,
        match_method: 'article+ean+secondary' as const,
        supplier_price_item_id: match.item_id,
        cost_unit_gross: match.gross_unit_price,
        cost_unit_net: match.net_unit_price,
        cost_total: costTotal,
        margin_amount: marginAmount,
        margin_pct: Math.round(marginPct * 100) / 100,
        confidence: 0.7,
        warning: false,
        coverage_status: 'complete',
        coverage_reason: 'supplier_price_list_match',
      };
    }

    // ---- NO MATCH ----
    return {
      resolution_mode: 'manual' as const,
      match_method: 'manual' as const,
      supplier_price_item_id: null,
      cost_unit_gross: 0,
      cost_unit_net: 0,
      cost_total: 0,
      margin_amount: null,
      margin_pct: null,
      confidence: 0,
      warning: true,
      coverage_status: 'blocked',
      coverage_reason: 'no_cost_data_available',
    };
  }

  /**
   * Build a lookup map: product_code -> best supplier price.
   * Uses the latest active price list for each supplier.
   */
  private static async buildSupplierPriceMap(): Promise<
    Map<string, { net_unit_price: number; gross_unit_price: number; item_id: string }>
  > {
    const map = new Map<string, { net_unit_price: number; gross_unit_price: number; item_id: string }>();

    try {
      const items = await db
        .select({
          item_id: schema.supplierPriceItem.id,
          article_code: schema.supplierProduct.supplier_article_code,
          barcode: schema.supplierProduct.barcode,
          secondary_code: schema.supplierProduct.supplier_article_code_secondary,
          net_unit_price: schema.supplierPriceItem.net_unit_price,
          gross_unit_price: schema.supplierPriceItem.gross_unit_price,
        })
        .from(schema.supplierPriceItem)
        .innerJoin(
          schema.supplierProduct,
          eq(schema.supplierPriceItem.supplier_product_id, schema.supplierProduct.id)
        )
        .innerJoin(
          schema.supplierPriceList,
          eq(schema.supplierPriceItem.supplier_price_list_id, schema.supplierPriceList.id)
        )
        .where(
          and(
            eq(schema.supplierPriceItem.is_annulled, false),
            eq(schema.supplierPriceList.status, 'active')
          )
        );

      for (const item of items) {
        const netPrice = Number(item.net_unit_price) || 0;
        const grossPrice = Number(item.gross_unit_price) || 0;
        
        if (netPrice <= 0) continue;

        const record = {
          net_unit_price: netPrice,
          gross_unit_price: grossPrice,
          item_id: item.item_id,
        };

        const addKey = (k: string | null) => {
          const clean = (k || '').trim();
          if (clean && !map.has(clean)) {
            map.set(clean, record);
          }
        };

        addKey(item.article_code);
        addKey(item.barcode);
        addKey(item.secondary_code);

        // Keep the zero-padded version of article_code for robust matching
        const cleanCode = (item.article_code || '').trim();
        if (cleanCode && /^\d+$/.test(cleanCode) && cleanCode.length < 13) {
          addKey(cleanCode.padStart(13, '0'));
        }
      }
    } catch (err) {
      console.error('Error building supplier price map:', err);
    }

    return map;
  }
}
