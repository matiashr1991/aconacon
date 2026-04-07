import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';
import { MatchingService } from '../lib/services/matching-service';

async function main() {
  console.log('--- Reseteando y Recalculando Rentabilidad (Fix Margen Real) ---');

  // 1. Obtener todos los batches de ventas
  const batches = await db.query.importBatch.findMany({
    where: eq(schema.importBatch.source_type, 'sales')
  });

  console.log(`Se encontraron ${batches.length} lotes de ventas.`);

  for (const batch of batches) {
    console.log(`\nProcesando lote: ${batch.filename} (${batch.id})`);
    
    // El método resolveBatchCosts ya limpia lo anterior y recalcula con la nueva lógica
    const results = await MatchingService.resolveBatchCosts(batch.id);
    
    console.log(`  - Total: ${results.total}`);
    console.log(`  - Éxito (ERP): ${results.matched_erp}`);
    console.log(`  - Éxito (Catálogo): ${results.matched_supplier}`);
    console.log(`  - Sin Costo: ${results.unmatched}`);
  }

  console.log('\n--- Recálculo Completado con éxito ---');
  process.exit(0);
}

main().catch(err => {
  console.error('Error durante el recálculo:', err);
  process.exit(1);
});
