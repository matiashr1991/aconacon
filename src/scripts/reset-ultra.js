const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:131291Mr....@localhost:5432/econoremitos',
});

async function run() {
  console.log('🔄 Ejecutando TRUNCATE CASCADE...');
  try {
    // Truncate the lines and resolutions (fastest way to clear bulk data)
    await pool.query('TRUNCATE TABLE sale_line_profit, sale_cost_resolution, sale_line CASCADE');
    // Then delete the batch metadata for sales
    const res = await pool.query("DELETE FROM import_batch WHERE source_type = 'sales'");
    console.log(`✅ Resultado: ${res.rowCount} lotes de venta eliminados.`);
  } catch (err) {
    console.error('❌ Error SQL:', err);
  } finally {
    await pool.end();
  }
}

run();
