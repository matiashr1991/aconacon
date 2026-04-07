'use server';

import { db } from '@/db';
import { supplier, supplierProduct, supplierPriceItem, supplierPriceList } from '@/db/schema';
import { eq, or, ilike, and, sql, desc, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

export async function getSuppliersFilterAction() {
  try {
    const data = await db.select({
      id: supplier.id,
      name: supplier.name,
      code: supplier.external_code
    }).from(supplier);
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getProductsCatalogAction(
  searchQuery: string = '',
  supplierId: string = 'ALL',
  page: number = 1,
  limit: number = 50
) {
  try {
    const offset = (page - 1) * limit;

    // Base query logic combining Product, Active Price Item, and Supplier
    const baseConditions = [
      eq(supplierPriceList.status, 'active'), // ONLY ACTIVE LISTS!
      eq(supplierPriceItem.is_annulled, false) // Ensure item isn't marked as deleted inside active list
    ];

    if (supplierId && supplierId !== 'ALL') {
      baseConditions.push(eq(supplier.id, supplierId));
    }

    if (searchQuery.trim() !== '') {
      const q = `%${searchQuery.trim()}%`;
      baseConditions.push(
        or(
          ilike(supplierProduct.supplier_product_description, q),
          ilike(supplierProduct.supplier_article_code, q),
          ilike(supplierProduct.barcode, q)
        )! // using ! to assert type for TS
      );
    }

    // Get total count
    const countResult = await db.select({ count: sql<number>`count(*)` })
      .from(supplierProduct)
      .innerJoin(supplierPriceItem, eq(supplierProduct.id, supplierPriceItem.supplier_product_id))
      .innerJoin(supplierPriceList, eq(supplierPriceItem.supplier_price_list_id, supplierPriceList.id))
      .innerJoin(supplier, eq(supplierProduct.supplier_id, supplier.id))
      .where(and(...baseConditions));

    const totalCount = Number(countResult[0].count);

    // Get Data
    const data = await db.select({
      productId: supplierProduct.id,
      priceItemId: supplierPriceItem.id,
      supplierId: supplier.id,
      supplierName: supplier.name,
      supplierCode: supplier.external_code,
      productCode: supplierProduct.supplier_article_code,
      productName: supplierProduct.supplier_product_description,
      barcode: supplierProduct.barcode,
      listPrice: supplierPriceItem.gross_unit_price,
      discountPercent: supplierPriceItem.discount_pct,
      internalTaxes: supplierPriceItem.internal_fixed,
      finalNetPrice: supplierPriceItem.net_plus_internal
    })
    .from(supplierProduct)
    .innerJoin(supplierPriceItem, eq(supplierProduct.id, supplierPriceItem.supplier_product_id))
    .innerJoin(supplierPriceList, eq(supplierPriceItem.supplier_price_list_id, supplierPriceList.id))
    .innerJoin(supplier, eq(supplierProduct.supplier_id, supplier.id))
    .where(and(...baseConditions))
    .orderBy(supplier.name, supplierProduct.supplier_product_description)
    .limit(limit)
    .offset(offset);

    return { 
      success: true, 
      data,
      metadata: {
        total: totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error: any) {
    console.error("Error getProductsCatalogAction:", error);
    return { success: false, error: error.message };
  }
}

export async function updateProductAction(
  productId: string,
  priceItemId: string,
  payload: {
    name: string;
    barcode: string;
    listPrice: number;
    discountPercent: number;
    internalTaxes: number;
  }
) {
  try {
    // 1. Update Product Details
    await db.update(supplierProduct)
      .set({
        supplier_product_description: payload.name,
        barcode: payload.barcode || null
      })
      .where(eq(supplierProduct.id, productId));

    // 2. Compute the new math
    const finalPrice = payload.listPrice * (1 - payload.discountPercent / 100) + payload.internalTaxes;

    // 3. Update the Price Item directly (stamping effective date NOW)
    await db.update(supplierPriceItem)
      .set({
        gross_unit_price: payload.listPrice.toString(),
        discount_pct: payload.discountPercent.toString(),
        internal_fixed: payload.internalTaxes.toString(),
        net_plus_internal: finalPrice.toString()
      })
      .where(eq(supplierPriceItem.id, priceItemId));

    revalidatePath('/productos');
    return { success: true };
  } catch (error: any) {
    console.error("Error updateProductAction:", error);
    return { success: false, error: error.message };
  }
}
