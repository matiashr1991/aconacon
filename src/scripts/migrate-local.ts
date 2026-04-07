import { Client } from 'pg';


async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL });
  await client.connect();
  
  const sql = `
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS voucher_type text;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS source_document_type text;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS branch text;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS seller text;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS supplier_text text;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS gross_unit_sale_price numeric;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS sale_discount_pct numeric;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS net_unit_sale_price numeric;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS purchase_cost_gross_from_report numeric;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS purchase_cost_net_from_report numeric;
    ALTER TABLE public.sale_line ADD COLUMN IF NOT EXISTS purchase_cost_effective_date date;

    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'coverage_status_type') THEN
            CREATE TYPE public.coverage_status_type AS ENUM ('complete', 'partial', 'blocked');
        END IF;
    END$$;

    CREATE TABLE IF NOT EXISTS public.sale_cost_resolution (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        sale_line_id uuid,
        resolution_mode text,
        match_method text,
        supplier_price_item_id uuid,
        resolved_cost_unit numeric,
        resolved_cost_total numeric,
        confidence numeric,
        warning_flag boolean DEFAULT false
    );

    -- Ensure sale_line_profit has the required fields
    ALTER TABLE public.sale_line_profit ADD COLUMN IF NOT EXISTS coverage_status public.coverage_status_type;
    ALTER TABLE public.sale_line_profit ADD COLUMN IF NOT EXISTS coverage_reason varchar;
    ALTER TABLE public.sale_line_profit ADD COLUMN IF NOT EXISTS cost_method varchar;
    ALTER TABLE public.sale_line_profit ADD COLUMN IF NOT EXISTS gross_margin_pct numeric;

    -- Drop unit_price safely
    ALTER TABLE public.sale_line DROP COLUMN IF EXISTS unit_price;

    -- PURGE EVERYTHING
    TRUNCATE TABLE public.import_batch CASCADE;
    TRUNCATE TABLE public.supplier CASCADE;
    TRUNCATE TABLE public.dim_supplier CASCADE;
  `;
  
  try {
    await client.query(sql);
    console.log('SUCCESS: Migrations applied and base truncated on local PostgreSQL');
  } catch (err) {
    console.error('ERROR:', err);
  } finally {
    await client.end();
  }
}
run();
