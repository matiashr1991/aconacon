'use server';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { ImportService } from '@/lib/services/import-service';

export async function getSalesBatches() {
  try {
    const batches = await db.query.importBatch.findMany({
      where: eq(schema.importBatch.source_type, 'sales'),
      orderBy: [desc(schema.importBatch.uploaded_at)]
    });

    if (batches.length === 0) return [];

    const batchIds = batches.map((b) => b.id);
    const counts = await db
      .select({
        import_batch_id: schema.saleLine.import_batch_id,
        row_count: sql<number>`count(*)::int`
      })
      .from(schema.saleLine)
      .where(inArray(schema.saleLine.import_batch_id, batchIds))
      .groupBy(schema.saleLine.import_batch_id);

    const countMap = new Map(counts.map((c) => [c.import_batch_id, Number(c.row_count || 0)]));

    return batches.map((batch) => ({
      ...batch,
      row_count: countMap.get(batch.id) ?? 0
    }));
  } catch (err) {
    console.error('Error fetching batches:', err);
    return [];
  }
}

/**
 * Excel serial date → JS Date
 * Excel serial: days since 1900-01-01 (with the Lotus 1-2-3 leap year bug)
 */
function excelSerialToDate(serial: number): Date | null {
  if (!serial || serial < 1) return null;
  // Excel epoch: Jan 1, 1900 (but Excel thinks 1900 was a leap year, so subtract 1 for dates > Feb 28 1900)
  const utcDays = serial - 25569; // 25569 = days between 1900-01-01 and 1970-01-01
  const date = new Date(utcDays * 86400000); // Convert days to ms
  return isNaN(date.getTime()) ? null : date;
}

function parseLatamDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  
  // Handle Excel serial numbers
  if (typeof val === 'number' && val > 30000 && val < 100000) {
    return excelSerialToDate(val);
  }
  
  const s = String(val).trim();
  if (!s) return null;

  // Handle common Latin formats: DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY
  const parts = s.split(/[\/\-\.]/);
  if (parts.length === 3) {
    let d = parseInt(parts[0], 10);
    let m = parseInt(parts[1], 10);
    let y = parseInt(parts[2], 10);

    if (m > 12 && d <= 12) {
      const temp = d;
      d = m;
      m = temp;
    }

    if (y < 100) y += 2000;
    const date = new Date(y, m - 1, d);
    if (!isNaN(date.getTime()) && date.getFullYear() === y && date.getMonth() === (m - 1)) {
      return date;
    }
  }

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function parseNumeric(val: any): string {
  if (val === null || val === undefined) return "0";
  if (typeof val === 'number') return isNaN(val) ? "0" : String(val);
  
  let str = String(val).trim();
  if (str === '') return "0";

  if (str.includes(',')) {
    // If it has a comma, assume comma is decimal and dot is thousands
    str = str.replace(/\./g, '').replace(/,/g, '.');
  } else {
    // Only dots. If more than 1 dot, they are thousands separators.
    const dotSegments = str.split('.');
    if (dotSegments.length > 2) {
       str = str.replace(/\./g, '');
    }
    // If exactly one dot, it is a decimal point. Do not remove it.
  }

  str = str.replace(/[^0-9.-]/g, '');
  const parts = str.split('.');
  if (parts.length > 2) {
    str = parts[0] + '.' + parts.slice(1).join('');
  }

  if (str === '' || str === '-' || str === '.') return "0";
  const num = Number(str);
  if (isNaN(num)) return "0";
  return String(Math.round(num * 10000) / 10000);
}

function formatDateForDB(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function processSalesImportAction(filename: string, mappedRows: any[], fallbackPeriod?: string) {
  try {
    const defaultDateString = fallbackPeriod ? `${fallbackPeriod}-01` : new Date().toISOString().split('T')[0];
    const defaultDate = new Date(defaultDateString);
    
    console.log(`Starting import for ${filename} with ${mappedRows.length} rows`);
    
    // 1. Create a new Import Batch
    const [batch] = await db.insert(schema.importBatch).values({
      source_type: 'sales',
      original_filename: filename,
      status: 'pending'
    }).returning();

    const saleLines = mappedRows.map((row: any, rowIndex: number) => {
      try {
        // A. Handle primary date
        const parsedDate = parseLatamDate(row.sale_date);
        let saleDate = parsedDate || defaultDate;
        
        // B. Ensure it matches fallbackPeriod if provided
        if (fallbackPeriod) {
          const [pYear, pMonth] = fallbackPeriod.split('-').map(Number);
          const targetMonth = pMonth - 1;
          if (saleDate.getFullYear() !== pYear || saleDate.getMonth() !== targetMonth) {
             const day = saleDate.getDate();
             const lastDayOfTarget = new Date(pYear, targetMonth + 1, 0).getDate();
             saleDate = new Date(pYear, targetMonth, Math.min(day, lastDayOfTarget));
          }
        }

        // C. Credit Note Detection
        const voucherType = String(row.voucher_type || '').toUpperCase().trim();
        const descComp = String(row.comprobante_desc || '').toUpperCase().trim();
        
        const isCreditNote = voucherType.includes('DVVTA') || 
                             voucherType.includes('NC') ||
                             descComp.includes('NOTA DE CREDITO') || 
                             descComp.includes('DEVOLUCION');

        // D. Quantity — use Bultos con Cargo (already signed in the Excel)
        const rawQty = Number(parseNumeric(row.quantity));
        // Bultos con Cargo is already negative for credit notes in the ERP

        // E. Build customer field: "code - name"
        const customerCode = String(row.customer_code || '').trim();
        const customerName = String(row.customer_name || '').trim();
        const customerFull = customerCode && customerName 
          ? `${customerCode} - ${customerName}` 
          : customerName || customerCode || '';

        // F. Product
        const productCode = String(row.product_code || '').trim();
        const productDesc = String(row.product_description || '').trim();

        if (!productDesc && !productCode) {
          return null; // Skip empty rows
        }

        // G. Costs from ERP report
        const purchaseCostGross = parseNumeric(row.purchase_cost_gross);
        const purchaseCostNet = parseNumeric(row.purchase_cost_net);

        return {
          id: crypto.randomUUID(),
          import_batch_id: batch.id,
          sale_date: formatDateForDB(saleDate),
          
          voucher_type: voucherType || null,
          voucher_number: String(row.voucher_number || ''),
          source_document_type: voucherType || null,
          is_credit_note: isCreditNote,

          branch: String(row.branch || '').trim() || null,
          seller: String(row.seller || '').trim() || null,
          customer: customerFull || null,
          supplier_text: String(row.supplier_text || '').trim() || null,

          product_code: productCode,
          product_description: productDesc,

          quantity: String(rawQty),
          gross_unit_sale_price: parseNumeric(row.gross_unit_sale_price),
          sale_discount_pct: parseNumeric(row.sale_discount_pct),
          net_unit_sale_price: parseNumeric(row.net_unit_sale_price),
          net_subtotal: parseNumeric(row.net_subtotal),

          purchase_cost_gross_from_report: purchaseCostGross !== "0" ? purchaseCostGross : null,
          purchase_cost_net_from_report: purchaseCostNet !== "0" ? purchaseCostNet : null,

          raw_payload: row,
        };
      } catch (err) {
        console.error(`Error processing row ${rowIndex}:`, err);
        throw new Error(`Error en fila ${rowIndex + 1}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }).filter(Boolean);

    // 3. Diagnostic
    if (saleLines.length === 0) {
      throw new Error(`Se han filtrado todas las filas enviadas porque estaban en blanco o no tenían el código o detalle de artículo mapeado. Mapee las columnas obligatorias.`);
    }

    if (saleLines.length > 0 && saleLines[0]) {
      console.log('--- DIAGNOSTIC: FIRST PAYLOAD ---');
      console.log(JSON.stringify(saleLines[0], null, 2));
    }

    // 4. Insert
    console.log(`Inserting ${saleLines.length} lines for batch ${batch.id}`);
    try {
      await ImportService.insertSalesLines(saleLines);
    } catch (insertErr: any) {
      console.error('--- CRITICAL INSERT ERROR ---');
      console.error('Postgres Error:', insertErr);
      if (insertErr && typeof insertErr === 'object') {
        console.error('SQLSTATE:', insertErr.code);
        console.error('Detail:', insertErr.detail);
        console.error('Constraint:', insertErr.constraint);
      }
      throw insertErr;
    }

    // 5. Complete
    await db.update(schema.importBatch)
      .set({
        status: 'completed',
        notes: `${saleLines.length} filas importadas`
      })
      .where(eq(schema.importBatch.id, batch.id));

    return { success: true };
  } catch (error: any) {
    console.error('Error in processSalesImportAction:', error);
    let innerError = "";
    if (error && typeof error === 'object') {
      innerError += error.code ? `[DB Code: ${error.code}] ` : "";
      innerError += error.detail ? `Detail: ${error.detail} ` : "";
      innerError += error.hint ? `Hint: ${error.hint} ` : "";
    }
    const cleanMsg = error.message ? error.message.substring(0, 500) : String(error);
    return { 
      success: false, 
      error: `Error Crítico: ${innerError} - ${cleanMsg}` 
    };
  }
}

import { revalidatePath } from 'next/cache';

export async function deleteBatchAction(batchId: string) {
  try {
    await db.delete(schema.importBatch).where(eq(schema.importBatch.id, batchId));
    revalidatePath('/ventas');
    revalidatePath('/reportes');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting batch:', error);
    const cleanMsg = error.message ? error.message.substring(0, 500) : String(error);
    return { success: false, error: `Error al eliminar: ${cleanMsg}` };
  }
}
