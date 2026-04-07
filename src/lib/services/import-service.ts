import { db } from '../../db';
import { 
  importBatch, 
  saleLine, 
  supplierPriceList, 
  stgSupplierPrice, 
  supplierProduct, 
  supplierPriceItem,
  salesPeriod
} from '../../db/schema';
import { eq, and } from 'drizzle-orm';

export class ImportService {
  /**
   * Starts a new import batch
   */
  static async startBatch(data: {
    source_type: 'sales' | 'supplier_list' | 'purchases';
    filename: string;
    row_count?: number;
    provider_id?: string;
  }) {
    const result = await db.insert(importBatch).values({
      source_type: data.source_type,
      original_filename: data.filename,
      original_storage_path: 'local://' + data.filename,
      status: 'pending',
      notes: `Importación inicial de ${data.row_count || 0} filas.`,
      provider_id: data.provider_id,
    }).returning();

    return result[0];
  }

  /**
   * Updates batch status
   */
  static async updateBatchStatus(id: string, status: 'pending' | 'processing' | 'completed' | 'failed', notes?: string) {
    await db.update(importBatch)
      .set({
        status,
        notes,
      })
      .where(eq(importBatch.id, id));
  }

  /**
   * Validates supplier file consistency (One provider rule)
   */
  static validateSupplierConsistency(data: any[]) {
    const providerCodes = new Set(data.map(d => d['Código Proveedor']).filter(Boolean));
    const providerNames = new Set(data.map(d => d['Razón Social']).filter(Boolean));

    if (providerCodes.size > 1 || providerNames.size > 1) {
      throw new Error(`Se detectaron múltiples proveedores en el mismo archivo (${Array.from(providerNames).join(', ')}). El estándar requiere un solo proveedor por archivo.`);
    }

    if (providerCodes.size === 0) {
      throw new Error('No se detectó ningún Código de Proveedor válido en el archivo.');
    }

    return {
      code: String(Array.from(providerCodes)[0]),
      name: String(Array.from(providerNames)[0]),
    };
  }

  /**
   * Maps standard supplier fields to staging schema
   */
  static mapStandardSupplierFields(data: any[], batchId: string) {
    return data.map((row, index) => ({
      import_batch_id: batchId,
      row_number: index + 4, // Rows start at 4
      supplier_code: String(row['Código Proveedor'] || ''),
      supplier_name: String(row['Razón Social'] || ''),
      article_code: String(row['Artículo'] || ''),
      article_desc: String(row['Descripción Artículo'] || ''),
      barcode: String(row['Código de barras'] || ''),
      gross_price: Number(row['Precio Unitario'] || 0),
      discount_pct: Number(row['Bonific.'] || 0),
      net_price_discounted: Number(row['Precio Neto Bonificado'] || 0),
      fixed_internal_taxes: Number(row['Internos Fijos'] || 0),
      pct_internal_taxes: Number(row['Internos %'] || 0),
      net_price_plus_internal_taxes: Number(row['Precio Neto + I. Internos'] || 0),
      supplier_article_code: String(row['Cod. Art. Proveedor'] || ''),
      supplier_article_code_secondary: String(row['Cod. Art. Proveedor Secundario'] || ''),
      margin_hint: Number(row['Margen'] || 0),
      canceled_flag: row['Anulado'] ? (String(row['Anulado']).toUpperCase() === 'SI' || String(row['Anulado']).toUpperCase() === 'TRUE') : false,
    }));
  }

  /**
   * Creates a supplier price list record
   */
  static async createSupplierPriceList(data: {
    import_batch_id: string;
    supplier_id: string;
    effective_from: string;
    effective_to?: string;
  }) {
    const result = await db.insert(supplierPriceList).values({
      import_batch_id: data.import_batch_id,
      supplier_id: data.supplier_id,
      effective_from: data.effective_from,
      effective_to: data.effective_to,
      status: 'active'
    }).returning();

    return result[0];
  }

  /**
   * Bulk inserts sales lines
   */
  static async insertSalesLines(lines: any[]) {
    const chunkSize = 500;
    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize);
      try {
        await db.insert(saleLine).values(chunk);
      } catch (error) {
        console.error('Error inserting sales lines chunk:', error);
        throw error;
      }
    }
  }

  /**
   * Bulk inserts staging supplier price items
   */
  static async insertStgSupplierPrices(items: any[]) {
    const chunkSize = 500;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      try {
        await db.insert(stgSupplierPrice).values(chunk);
      } catch (error) {
        console.error('Error inserting stg supplier prices chunk:', error);
        throw error;
      }
    }
  }

  /**
   * Promotes staging supplier prices to canonical price items
   */
  static async promoteStagingToPriceItems(batchId: string, priceListId: string) {
    // 0. Get Supplier ID from List
    const listResult = await db.select({ supplier_id: supplierPriceList.supplier_id })
      .from(supplierPriceList)
      .where(eq(supplierPriceList.id, priceListId))
      .limit(1);
    
    const supplierId = listResult[0]?.supplier_id;
    if (!supplierId) throw new Error('Supplier not found for price list');

    // 1. Fetch from staging
    const stgItems = await db.select()
      .from(stgSupplierPrice)
      .where(eq(stgSupplierPrice.import_batch_id, batchId));

    if (!stgItems || stgItems.length === 0) return;

    // 2. Resolve/Create Supplier Products
    const priceItems: any[] = [];
    
    for (const raw of stgItems) {
      // Find or Create Supplier Product
      let spResult = await db.select({ id: supplierProduct.id })
        .from(supplierProduct)
        .where(and(
          eq(supplierProduct.supplier_id, supplierId),
          eq(supplierProduct.supplier_article_code, raw.supplier_article_code || '')
        ))
        .limit(1);

      let spId = spResult[0]?.id;

      if (!spId) {
        const newSpResult = await db.insert(supplierProduct).values({
          supplier_id: supplierId,
          supplier_article_code: raw.supplier_article_code || null,
          supplier_article_code_secondary: raw.supplier_article_code_secondary || null,
          barcode: raw.barcode || null,
          supplier_product_description: raw.article_desc || null,
        }).returning({ id: supplierProduct.id });
        
        spId = newSpResult[0].id;
      }

      // Prepare Price Item
      priceItems.push({
        supplier_price_list_id: priceListId,
        supplier_product_id: spId,
        gross_unit_price: raw.gross_price?.toString() || null,
        discount_pct: raw.discount_pct?.toString() || null,
        net_unit_price: raw.net_price_discounted?.toString() || null,
        internal_fixed: raw.fixed_internal_taxes?.toString() || null,
        internal_pct: raw.pct_internal_taxes?.toString() || null,
        net_plus_internal: raw.net_price_plus_internal_taxes?.toString() || null,
        is_annulled: raw.canceled_flag || false,
      });
    }

    // 3. Insert in chunks
    const chunkSize = 100;
    for (let i = 0; i < priceItems.length; i += chunkSize) {
      const chunk = priceItems.slice(i, i + chunkSize);
      await db.insert(supplierPriceItem).values(chunk);
    }
  }

  /**
   * Gets or creates a sales period
   */
  static async getOrCreatePeriod(year: number, month: number, label: string) {
    const periodResult = await db.select({ id: salesPeriod.id })
      .from(salesPeriod)
      .where(and(
        eq(salesPeriod.year, year),
        eq(salesPeriod.month, month)
      ))
      .limit(1);

    if (periodResult.length > 0) return periodResult[0].id;

    const newPeriodResult = await db.insert(salesPeriod).values({ year, month, label }).returning({ id: salesPeriod.id });
    return newPeriodResult[0].id;
  }

  /**
   * Suggests mappings for sales reports based on common ERP headers
   */
  static suggestSalesMapping(columns: string[]): Record<string, string> {
    const synonyms: Record<string, string[]> = {
      sale_date: ['fecha', 'fecha venta', 'emisión', 'doc. fecha', 'fecha comprobante', 'f.venta', 'fecha comprob'],
      voucher_number: ['comprobante', 'nro. comp.', 'numero', 'factura', 'nro factura', 'nro comprobante', 'num', 'nro'],
      product_code: ['codigo', 'cod. art.', 'articulo', 'sku', 'cod. producto', 'cód. art.', 'producto codigo', 'insumo', 'codigo de articulo'],
      product_description: ['descripcion', 'detalle', 'nombre articulo', 'desc. prod.', 'artículo nombre', 'articulo'],
      quantity: ['cantidad', 'cant.', 'unidades', 'cant. bultos', 'cant', 'bultos'],
      gross_unit_sale_price: ['precio unit.', 'p. unitario', 'precio', 'venta unit.', 'p.unit', 'precio venta', 'precio neto unitario'],
      net_subtotal: ['subtotal', 'neto', 'gravado', 'neto gravado', 'importe', 'total neto', 'neto gravado'],
      purchase_cost_net_from_report: ['costo', 'costo neto', 'costo reposicion', 'costo repo', 'costo unitario', 'ctro costos', 'precio de compra neto'],
      customer: ['cliente', 'razon social', 'nombre', 'destinatario', 'cliente'],
    };

    const mapping: Record<string, string> = {};

    columns.forEach(col => {
      const normalized = col.toLowerCase().trim();
      
      for (const [target, labels] of Object.entries(synonyms)) {
        if (labels.includes(normalized)) {
          mapping[target] = col;
          break;
        }
        if (!mapping[target] && labels.some(l => normalized.includes(l))) {
          mapping[target] = col;
        }
      }
    });

    return mapping;
  }
}
