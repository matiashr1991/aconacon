'use server';

import { db } from '@/db';
import { 
  importBatch, 
  supplier, 
  dimSupplier, 
  supplierPriceList, 
  stgSupplierPrice, 
  supplierProduct,
  supplierPriceItem
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { ImportService } from '@/lib/services/import-service';

// 1. Data Fetch Actions
export async function getSuppliersAction() {
  const result = await db.select().from(supplier).orderBy(supplier.name);
  return result;
}

export async function registerSupplierAction(name: string, external_code: string, tax_id: string) {
  try {
    const newSupplier = await db.insert(supplier).values({
      name,
      external_code,
      tax_id,
      active: true,
    }).returning();

    if (newSupplier.length > 0) {
      await db.insert(dimSupplier).values({
        id: newSupplier[0].id,
        name,
        code: external_code,
        tax_id,
        active: true,
      });
      return { success: true, data: newSupplier[0] };
    }
    throw new Error('Failed to create supplier in local database.');
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

// Pure utility proxy for client
export async function validateSupplierAction(data: any[]) {
  return ImportService.validateSupplierConsistency(data);
}

// Bulk backend process running ENTIRELY ON LOCAL DRIZZLE DB
export async function processSupplierImportAction(
  filename: string, 
  providerId: string, 
  rawData: any[], 
  mapping: Record<string, string>, 
  isStandardFormat: boolean
) {
  try {
    // 1. Start Batch
    const batch = await db.insert(importBatch).values({
      source_type: 'supplier_list',
      original_filename: filename,
      original_storage_path: 'local://' + filename,
      status: 'processing',
      notes: `Lote local de Importación inicial de ${rawData.length} filas.`,
      provider_id: providerId,
    }).returning();
    const batchId = batch[0].id;

    // 2. Map staging rows
    let mappedRows: any[] = [];
    if (isStandardFormat) {
      mappedRows = ImportService.mapStandardSupplierFields(rawData, batchId);
    } else {
      mappedRows = rawData.map((row, idx) => {
        const mapped: any = {
          import_batch_id: batchId,
          row_number: idx + 1,
        };
        Object.entries(mapping).forEach(([target, source]) => {
          if (source) mapped[target] = row[source];
        });
        
        // Small numeric cleans just in case mapping passed dirty strings
        const numerics = ['gross_price', 'discount_pct', 'net_price_discounted', 'fixed_internal_taxes', 'pct_internal_taxes', 'net_price_plus_internal_taxes'];
        for (const numF of numerics) {
            if (typeof mapped[numF] === 'string') {
                const cleaned = mapped[numF].replace(/[^0-9.-]+/g, '');
                mapped[numF] = cleaned ? parseFloat(cleaned) : null;
            } else if (!mapped[numF]) {
                mapped[numF] = null;
            }
        }
        
        return mapped;
      });
    }

    // 3. Auto-Archive existing active lists for this supplier
    await db.update(supplierPriceList)
      .set({ status: 'archived', effective_to: new Date().toISOString().split('T')[0] })
      .where(and(eq(supplierPriceList.supplier_id, providerId), eq(supplierPriceList.status, 'active')));

    // 3b. Create New Price List as the Current Active one
    const priceList = await db.insert(supplierPriceList).values({
      import_batch_id: batchId,
      supplier_id: providerId,
      effective_from: new Date().toISOString().split('T')[0],
      effective_to: null,
      status: 'active',
    }).returning();
    const priceListId = priceList[0].id;

    // 4. Chunk & Insert Staging data
    const chunkSize = 5000;
    for (let i = 0; i < mappedRows.length; i += chunkSize) {
      const chunk = mappedRows.slice(i, i + chunkSize);
      await db.insert(stgSupplierPrice).values(chunk);
    }

    // 5. PROMOTE STAGING TO PRICE ITEMS (NATIVE)
    // To match performance without blowing up memory, we fetch staging in chunks or do full if small enough.
    // 37k rows is manageable entirely in memory for Node.js
    const stgData = await db.select().from(stgSupplierPrice).where(eq(stgSupplierPrice.import_batch_id, batchId));
    
    // Retrieve ALL existing products for this provider to create an in-memory hash map (Super fast matching)
    const existingProducts = await db.select().from(supplierProduct).where(eq(supplierProduct.supplier_id, providerId));
    const productMap = new Map(existingProducts.map(sp => [sp.supplier_article_code?.toString() || '', sp]));
    
    const itemsToInsert: any[] = [];
    const newProductsToInsert: any[] = [];
    const productIdentitiesSeenInStg = new Set();
    
    // Check what products we need to create
    for (const raw of stgData) {
        const articleCode = raw.supplier_article_code?.toString() || raw.article_code?.toString() || '';
        
        if (!productMap.has(articleCode) && !productIdentitiesSeenInStg.has(articleCode)) {
            productIdentitiesSeenInStg.add(articleCode);
            newProductsToInsert.push({
                supplier_id: providerId,
                supplier_article_code: articleCode,
                supplier_article_code_secondary: raw.supplier_article_code_secondary || null,
                barcode: raw.barcode || null,
                supplier_product_description: raw.article_desc || null,
            });
        }
    }
    
    // Bulk insert new missing products
    if (newProductsToInsert.length > 0) {
        for (let i = 0; i < newProductsToInsert.length; i += chunkSize) {
            const chunk = newProductsToInsert.slice(i, i + chunkSize);
            const inserted = await db.insert(supplierProduct).values(chunk).returning();
            // Assign to Map so next pass can find the UUIDs
            for (const sp of inserted) {
                productMap.set(sp.supplier_article_code?.toString() || '', sp);
            }
        }
    }
    
    // Produce price items mapping
    for (const raw of stgData) {
       const articleCode = raw.supplier_article_code?.toString() || raw.article_code?.toString() || '';
       const product = productMap.get(articleCode);
       
       if (product) {
           itemsToInsert.push({
                supplier_price_list_id: priceListId,
                supplier_product_id: product.id,
                gross_unit_price: raw.gross_price?.toString() || null,
                discount_pct: raw.discount_pct?.toString() || null,
                net_unit_price: raw.net_price_discounted?.toString() || null,
                internal_fixed: raw.fixed_internal_taxes?.toString() || null,
                internal_pct: raw.pct_internal_taxes?.toString() || null,
                net_plus_internal: raw.net_price_plus_internal_taxes?.toString() || null,
                is_annulled: raw.canceled_flag || false,
           });
       }
    }
    
    // Bulk insert items
    for (let i = 0; i < itemsToInsert.length; i += chunkSize) {
        const chunk = itemsToInsert.slice(i, i + chunkSize);
        await db.insert(supplierPriceItem).values(chunk);
    }
    
    // 6. Finalize Batch Status
    await db.update(importBatch).set({ status: 'completed' }).where(eq(importBatch.id, batchId));
    
    return { success: true };
  } catch (err: any) {
    console.error('Import error:', err);
    return { success: false, error: err.message };
  }
}

// -------------------------------------------------------------
// NEW AUTOMATED BULK MASSIVE ENGINE
// -------------------------------------------------------------
export async function massiveSupplierImportAction(filename: string, rawData: any[]) {
  try {
    if (rawData.length === 0) throw new Error('Excel file is empty');
    
    // Auto-detect Code and Name from the verified Excel standard headers
    // Using mapping keys exactly like in parseStandardSupplierExcel
    const providerCode = rawData[0]['Código Proveedor']?.toString()?.trim();
    const providerNameRaw = rawData[0]['Razón Social']?.toString()?.trim() || 'Desconocido';
    
    if (!providerCode) {
      throw new Error(`File ${filename} is missing 'Código Proveedor' in the first data row.`);
    }

    // Upsert Provider
    let providerId: string;
    const existing = await db.select().from(supplier).where(eq(supplier.external_code, providerCode)).limit(1);
    
    if (existing && existing.length > 0) {
      providerId = existing[0].id;
    } else {
      // Create it seamlessly!
      const newSupplier = await db.insert(supplier).values({
        name: providerNameRaw,
        external_code: providerCode,
        tax_id: '',
        active: true,
      }).returning();
      providerId = newSupplier[0].id;

      await db.insert(dimSupplier).values({
        id: providerId,
        name: providerNameRaw,
        code: providerCode,
        tax_id: '',
        active: true,
      });
    }

    // Proceed to chew all the data entirely leveraging the ultra-fast backend sub-routine
    const res = await processSupplierImportAction(filename, providerId, rawData, {}, true);
    if (!res.success) throw new Error(res.error);

    return { success: true, supplierName: providerNameRaw, supplierCode: providerCode };
  } catch (err: any) {
    console.error(`Error processing bulk file ${filename}:`, err);
    return { success: false, error: err.message };
  }
}

