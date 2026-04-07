import { db } from '../db';
import * as schema from '../db/schema';
import { eq, or, isNull } from 'drizzle-orm';

async function main() {
  console.log('--- Limpieza Profunda de Ventas ---');
  
  try {
    // 1. First, clear all child records directly by batch type
    console.log('Borrando dependencias (profit, cost resolutions)...');
    await db.delete(schema.saleLineProfit);
    await db.delete(schema.saleCostResolution);
    
    // 2. Clear sale lines in chunks or just all at once if children are gone
    console.log('Borrando 148k+ lineas de venta...');
    await db.delete(schema.saleLine);
    console.log('Lineas eliminadas.');

    // 3. Delete the batches
    console.log('Borrando lotes...');
    const result = await db.delete(schema.importBatch).where(
      or(
        eq(schema.importBatch.source_type, 'sales'),
        isNull(schema.importBatch.source_type)
      )
    );
    console.log('Listo. Entorno limpio.');
  } catch (err) {
    console.error('Error durante la limpieza:', err);
  } finally {
    process.exit(0);
  }
}

main();
