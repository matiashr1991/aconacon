import { db } from '../db';
import { sql } from 'drizzle-orm';

async function resetSales() {
  console.log('🔄 Iniciando el borrado de reportes de ventas (SQL rápido)...');
  
  try {
    const result = await db.execute(sql`DELETE FROM import_batch WHERE source_type = 'sales'`);
    console.log('✅ Borrado completo.');
    console.log('✨ Base de datos de ventas limpia y lista para nueva importación.');
  } catch (error) {
    console.error('❌ Error durante el borrado de ventas:', error);
  }
}

resetSales().then(() => process.exit(0));
