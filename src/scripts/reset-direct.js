const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgres://postgres:131291Mr....@localhost:5432/econoremitos',
});

async function run() {
  console.log('🔄 Ejecutando DELETE directo por SQL...');
  try {
    const res = await pool.query("DELETE FROM import_batch WHERE source_type = 'sales'");
    console.log(`✅ Resultado: ${res.rowCount} filas de lotes eliminadas.`);
  } catch (err) {
    console.error('❌ Error SQL:', err);
  } finally {
    await pool.end();
  }
}

run();
