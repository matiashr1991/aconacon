'use server';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, or, ilike, desc, and } from 'drizzle-orm';

export async function getDashboardData(batchId: string, search?: string) {
  try {
    // 1. Fetch Batch
    const batch = await db.query.importBatch.findFirst({
      where: eq(schema.importBatch.id, batchId),
    });

    // 2. Fetch Sale Lines with profit data
    const rawLines = await db.query.saleLine.findMany({
      //@ts-ignore
      where: (fields: any, { and, eq, or, ilike }: any) => {
        const baseFilter = eq(fields.import_batch_id, batchId);
        if (search && search.trim() !== '') {
          return and(
            baseFilter,
            or(
              ilike(fields.product_code, `%${search}%`),
              ilike(fields.product_description, `%${search}%`),
              ilike(fields.customer, `%${search}%`),
              ilike(fields.supplier_text, `%${search}%`)
            )
          );
        }
        return baseFilter;
      },
      with: {
        profit: true,
        costResolutions: true,
      },
      limit: 100,
      orderBy: [desc(schema.saleLine.id)]
    });

    return {
      batch: batch || null,
      lines: rawLines,
      error: null
    };
  } catch (err: any) {
    console.error('Error fetching profitability detail:', err);
    return {
      batch: null,
      lines: [],
      error: err.message
    };
  }
}
