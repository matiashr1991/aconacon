'use server';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

/**
 * Get distinct supplier names from the price list
 */
export async function getSuppliersAction() {
  try {
    const suppliers = await db
      .select({ 
        name: schema.stgSupplierPrice.supplier_name,
        code: schema.stgSupplierPrice.supplier_code
      })
      .from(schema.stgSupplierPrice)
      .groupBy(schema.stgSupplierPrice.supplier_name, schema.stgSupplierPrice.supplier_code);

    return { success: true, data: suppliers };
  } catch (error: any) {
    console.error('Error fetching suppliers:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all products for a specific supplier
 */
export async function getSupplierProductsAction(supplierName: string) {
  try {
    const products = await db
      .select()
      .from(schema.stgSupplierPrice)
      .where(eq(schema.stgSupplierPrice.supplier_name, supplierName))
      .orderBy(schema.stgSupplierPrice.article_desc);

    return { success: true, data: products };
  } catch (error: any) {
    console.error('Error fetching supplier products:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update a single product in the price list
 */
export async function updateSupplierProductAction(id: string, data: Partial<typeof schema.stgSupplierPrice.$inferInsert>) {
  try {
    await db
      .update(schema.stgSupplierPrice)
      .set({
        ...data,
        gross_price: data.gross_price ? String(data.gross_price) : undefined,
        discount_pct: data.discount_pct ? String(data.discount_pct) : undefined,
        net_price_discounted: data.net_price_discounted ? String(data.net_price_discounted) : undefined,
        fixed_internal_taxes: data.fixed_internal_taxes ? String(data.fixed_internal_taxes) : undefined,
        pct_internal_taxes: data.pct_internal_taxes ? String(data.pct_internal_taxes) : undefined,
        net_price_plus_internal_taxes: data.net_price_plus_internal_taxes ? String(data.net_price_plus_internal_taxes) : undefined,
        margin_hint: data.margin_hint ? String(data.margin_hint) : undefined,
      })
      .where(eq(schema.stgSupplierPrice.id, id));

    return { success: true };
  } catch (error: any) {
    console.error('Error updating product:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Bulk update products (more efficient for many changes)
 */
export async function bulkUpdatePriceListAction(updates: { id: string, data: any }[]) {
  try {
    await db.transaction(async (tx) => {
      for (const update of updates) {
        await tx
          .update(schema.stgSupplierPrice)
          .set({
            ...update.data,
            gross_price: update.data.gross_price ? String(update.data.gross_price) : undefined,
            discount_pct: update.data.discount_pct ? String(update.data.discount_pct) : undefined,
            net_price_discounted: update.data.net_price_discounted ? String(update.data.net_price_discounted) : undefined,
            fixed_internal_taxes: update.data.fixed_internal_taxes ? String(update.data.fixed_internal_taxes) : undefined,
            pct_internal_taxes: update.data.pct_internal_taxes ? String(update.data.pct_internal_taxes) : undefined,
            net_price_plus_internal_taxes: update.data.net_price_plus_internal_taxes ? String(update.data.net_price_plus_internal_taxes) : undefined,
            margin_hint: update.data.margin_hint ? String(update.data.margin_hint) : undefined,
          })
          .where(eq(schema.stgSupplierPrice.id, update.id));
      }
    });

    revalidatePath('/precios');
    revalidatePath('/reportes');
    return { success: true };
  } catch (error: any) {
    console.error('Error in bulk update:', error);
    return { success: false, error: error.message };
  }
}
