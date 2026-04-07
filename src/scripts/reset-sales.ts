import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

async function resetSales() {
  console.log('🔄 Iniciando el borrado de reportes de ventas...');
  
  try {
    // 1. Find all sales batches
    const salesBatches = await db.query.importBatch.findMany({
      where: eq(schema.importBatch.source_type, 'sales')
    });

    if (salesBatches.length === 0) {
      console.log('✅ No hay reportes de ventas cargados.');
      return;
    }

    console.log(`📍 Encontrados ${salesBatches.length} lotes de ventas.`);

    // 2. Delete batches. Cascade handles lines, resolutions, and profits.
    const deleted = await db.delete(schema.importBatch)
      .where(eq(schema.importBatch.source_type, 'sales'))
      .returning();

    console.log(`✅ Se eliminaron ${deleted.length} lotes de ventas.`);
    console.log('✨ Base de datos de ventas limpia y lista para nueva importación.');
    
  } catch (error) {
    console.error('❌ Error durante el borrado de ventas:', error);
  }
}

resetSales().then(() => process.exit(0));
