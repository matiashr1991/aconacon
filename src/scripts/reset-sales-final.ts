import { db } from '../db';
import * as schema from '../db/schema';
import { eq } from 'drizzle-orm';

async function resetSales() {
  console.log('🔄 Iniciando el borrado de reportes de ventas (Clean Mode)...');
  
  try {
    // No .returning() to avoid memory issues with thousands of rows
    await db.delete(schema.importBatch)
      .where(eq(schema.importBatch.source_type, 'sales'));

    console.log('✅ Borrado completo.');
    console.log('✨ Base de datos de ventas limpia y lista para nueva importación.');
    
  } catch (error) {
    console.error('❌ Error durante el borrado de ventas:', error);
  }
}

resetSales().then(() => process.exit(0));
