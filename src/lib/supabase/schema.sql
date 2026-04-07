-- Commercial Analysis Platform (Aconcagua v2)
-- Database Schema

-- 1. Import Batches
CREATE TABLE IF NOT EXISTS import_batch (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type TEXT NOT NULL CHECK (source_type IN ('sales_report', 'supplier_price_list')),
    original_filename TEXT NOT NULL,
    file_hash TEXT,
    imported_at TIMESTAMPTZ DEFAULT now(),
    imported_by TEXT,
    period_year INTEGER,
    period_month INTEGER,
    supplier_id UUID, -- NULL for sales reports
    status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'validated', 'imported', 'with_warnings', 'failed')),
    notes TEXT,
    raw_config JSONB -- For mapping info
);

-- 2. Dimensions (Catalogs)
CREATE TABLE IF NOT EXISTS supplier (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_code TEXT UNIQUE,
    name TEXT NOT NULL,
    tax_id TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS product (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    internal_article_code TEXT UNIQUE NOT NULL,
    description TEXT,
    barcode TEXT,
    brand_id UUID REFERENCES brand(id),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Supplier Products & Price Lists
CREATE TABLE IF NOT EXISTS supplier_product (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES supplier(id) NOT NULL,
    product_id UUID REFERENCES product(id),
    supplier_article_code TEXT,
    supplier_article_code_secondary TEXT,
    supplier_product_description TEXT,
    barcode TEXT,
    UNIQUE(supplier_id, supplier_article_code)
);

CREATE TABLE IF NOT EXISTS supplier_price_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID REFERENCES import_batch(id),
    supplier_id UUID REFERENCES supplier(id) NOT NULL,
    effective_from DATE NOT NULL,
    effective_to DATE,
    source_date DATE,
    status TEXT DEFAULT 'active'
);

CREATE TABLE IF NOT EXISTS supplier_price_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_price_list_id UUID REFERENCES supplier_price_list(id) ON DELETE CASCADE,
    supplier_product_id UUID REFERENCES supplier_product(id) NOT NULL,
    gross_unit_price NUMERIC(15, 4),
    discount_pct NUMERIC(5, 2) DEFAULT 0,
    net_unit_price NUMERIC(15, 4),
    internal_fixed NUMERIC(15, 4) DEFAULT 0,
    internal_pct NUMERIC(5, 2) DEFAULT 0,
    net_plus_internal NUMERIC(15, 4),
    is_annulled BOOLEAN DEFAULT false
);

-- 4. Sales Data
CREATE TABLE IF NOT EXISTS sales_period (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    label TEXT,
    closed_at TIMESTAMPTZ,
    UNIQUE(year, month)
);

CREATE TABLE IF NOT EXISTS sale_line (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_batch_id UUID REFERENCES import_batch(id),
    sales_period_id UUID REFERENCES sales_period(id),
    sale_date DATE NOT NULL,
    voucher_type TEXT,
    voucher_number TEXT,
    branch TEXT,
    seller TEXT,
    customer TEXT,
    supplier_text TEXT,
    product_code TEXT,
    product_description TEXT,
    quantity NUMERIC(15, 4),
    gross_unit_sale_price NUMERIC(15, 4),
    sale_discount_pct NUMERIC(5, 2),
    net_unit_sale_price NUMERIC(15, 4),
    net_subtotal NUMERIC(15, 4),
    purchase_cost_gross_from_report NUMERIC(15, 4),
    purchase_cost_net_from_report NUMERIC(15, 4),
    purchase_cost_effective_date DATE,
    source_document_type TEXT,
    is_credit_note BOOLEAN DEFAULT false,
    raw_payload JSONB
);

-- 5. Cost Resolution & Matching Rules
CREATE TABLE IF NOT EXISTS sale_cost_resolution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_line_id UUID REFERENCES sale_line(id) ON DELETE CASCADE,
    resolution_mode TEXT CHECK (resolution_mode IN ('supplier_list', 'sales_report', 'manual')),
    supplier_price_item_id UUID REFERENCES supplier_price_item(id),
    resolved_cost_unit NUMERIC(15, 4),
    resolved_cost_total NUMERIC(15, 4),
    match_method TEXT CHECK (match_method IN ('article+supplier', 'barcode', 'supplier_code', 'manual', 'fallback')),
    confidence NUMERIC(3, 2),
    warning_flag BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS product_match_rule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id UUID REFERENCES supplier(id),
    source_product_code TEXT,
    source_description TEXT,
    target_product_id UUID REFERENCES product(id),
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for performance
CREATE INDEX idx_sale_line_period ON sale_line(sales_period_id);
CREATE INDEX idx_sale_line_product ON sale_line(product_code);
CREATE INDEX idx_supplier_price_item_list ON supplier_price_item(supplier_price_list_id);
CREATE INDEX idx_supplier_product_code ON supplier_product(supplier_article_code);
