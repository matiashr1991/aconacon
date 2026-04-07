'use server';

import { db } from '@/db';
import * as schema from '@/db/schema';
import { eq, sql, desc } from 'drizzle-orm';

export async function getDashboardStatsAction() {
  try {
    // 1. Fetch Sales Aggregates (using net_subtotal for consistency)
    const salesAgg = await db
      .select({
        total: sql<number>`sum(${schema.saleLine.net_subtotal}::numeric)`,
      })
      .from(schema.saleLine);

    // 2. Fetch Profit Aggregates
    const profitAgg = await db
      .select({
        total: sql<number>`sum(${schema.saleLineProfit.cost_total}::numeric)`,
      })
      .from(schema.saleLineProfit);

    // 3. Batch Count
    const batchCountResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.importBatch);

    // 4. Recent Activity
    const recentActivity = await db.query.importBatch.findMany({
      orderBy: [desc(schema.importBatch.uploaded_at)],
      limit: 5,
    });

    const totalSales = Number(salesAgg[0]?.total || 0);
    const totalCost = Number(profitAgg[0]?.total || 0);
    const batchCount = Number(batchCountResult[0]?.count || 0);

    return {
      success: true,
      data: {
        totalSales,
        totalCost,
        importCount: batchCount,
        matchRate: totalSales !== 0 ? (totalCost / totalSales) * 100 : 0,
        recentActivity: recentActivity.map(b => ({
          ...b,
          created_at: b.uploaded_at // for backward compatibility in UI
        }))
      }
    };
  } catch (error: any) {
    console.error('Error in getDashboardStatsAction:', error);
    return { success: false, error: error.message };
  }
}
