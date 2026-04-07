const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:131291Mr....@localhost:5432/econoremitos',
});

async function run() {
  console.log('🔄 Ejecutando TRUNCATE CASCADE para limpiar 148k+ filas...');
  try {
    // 1. Clear ALL sales related data (lines, profits, resolutions)
    await pool.query('TRUNCATE TABLE sale_line_profit, sale_cost_resolution, sale_line RESTART IDENTITY CASCADE');
    
    // 2. Clear Batch metadata where source_type is sales or null (legacy)
    const res = await pool.query("DELETE FROM import_batch WHERE source_type = 'sales' OR source_type IS NULL");
    
    console.log(`✅ Resultado: ${res.rowCount} lotes de venta eliminados y tablas vaciadas.`);
    
    // Verify count
    const check = await pool.query('SELECT count(*) FROM sale_line');
    console.log(`🔍 Filas restantes en sale_line: ${check.rows[0].count}`);
  } catch (err) {
    console.error('❌ Error SQL:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
