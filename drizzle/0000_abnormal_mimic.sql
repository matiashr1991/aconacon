CREATE TYPE "public"."coverage_status_type" AS ENUM('complete', 'partial', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."import_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'dry_run_loaded', 'candidate_loaded', 'official_loaded');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('sales', 'supplier_list', 'purchases');--> statement-breakpoint
CREATE TABLE "dim_supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar,
	"code" varchar,
	"tax_id" varchar,
	"active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_type" "source_type",
	"original_filename" varchar,
	"original_storage_path" text,
	"status" "import_status" DEFAULT 'pending',
	"provider_id" uuid,
	"notes" text,
	"uploaded_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sale_cost_resolution" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_line_id" uuid,
	"resolution_mode" text,
	"match_method" text,
	"supplier_price_item_id" uuid,
	"resolved_cost_unit" numeric,
	"resolved_cost_total" numeric,
	"confidence" numeric,
	"warning_flag" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "sale_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_batch_id" uuid,
	"sales_period_id" uuid,
	"sale_date" date,
	"voucher_type" text,
	"voucher_number" text,
	"source_document_type" text,
	"is_credit_note" boolean DEFAULT false,
	"branch" text,
	"seller" text,
	"customer" text,
	"supplier_text" text,
	"product_code" text,
	"product_description" text,
	"quantity" numeric,
	"gross_unit_sale_price" numeric,
	"sale_discount_pct" numeric,
	"net_unit_sale_price" numeric,
	"net_subtotal" numeric,
	"purchase_cost_gross_from_report" numeric,
	"purchase_cost_net_from_report" numeric,
	"purchase_cost_effective_date" date,
	"raw_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "sale_line_profit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_line_id" uuid,
	"cost_method" varchar,
	"matched_snapshot_id" uuid,
	"cost_unit_gross" numeric,
	"cost_unit_net" numeric,
	"cost_unit_internal_taxes" numeric,
	"cost_unit_final" numeric,
	"cost_total" numeric,
	"sale_net_total" numeric,
	"gross_margin_amount" numeric,
	"gross_margin_pct" numeric,
	"coverage_status" "coverage_status_type",
	"coverage_reason" varchar
);
--> statement-breakpoint
CREATE TABLE "sales_period" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"year" integer,
	"month" integer,
	"label" text
);
--> statement-breakpoint
CREATE TABLE "stg_supplier_price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_batch_id" uuid,
	"row_number" integer,
	"supplier_code" varchar,
	"supplier_name" text,
	"article_code" varchar,
	"article_desc" text,
	"barcode" varchar,
	"gross_price" numeric,
	"discount_pct" numeric,
	"net_price_discounted" numeric,
	"fixed_internal_taxes" numeric,
	"pct_internal_taxes" numeric,
	"net_price_plus_internal_taxes" numeric,
	"supplier_article_code" varchar,
	"supplier_article_code_secondary" varchar,
	"margin_hint" numeric,
	"canceled_flag" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "supplier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"external_code" text,
	"tax_id" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "supplier_price_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_price_list_id" uuid,
	"supplier_product_id" uuid,
	"gross_unit_price" numeric,
	"discount_pct" numeric,
	"net_unit_price" numeric,
	"internal_fixed" numeric,
	"internal_pct" numeric,
	"net_plus_internal" numeric,
	"is_annulled" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "supplier_price_list" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_batch_id" uuid,
	"supplier_id" uuid,
	"status" text DEFAULT 'active',
	"effective_from" date,
	"effective_to" date
);
--> statement-breakpoint
CREATE TABLE "supplier_product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid,
	"supplier_article_code" text,
	"supplier_article_code_secondary" text,
	"barcode" text,
	"supplier_product_description" text
);
--> statement-breakpoint
ALTER TABLE "sale_cost_resolution" ADD CONSTRAINT "sale_cost_resolution_sale_line_id_sale_line_id_fk" FOREIGN KEY ("sale_line_id") REFERENCES "public"."sale_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_cost_resolution" ADD CONSTRAINT "sale_cost_resolution_supplier_price_item_id_supplier_price_item_id_fk" FOREIGN KEY ("supplier_price_item_id") REFERENCES "public"."supplier_price_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_import_batch_id_import_batch_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batch"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line" ADD CONSTRAINT "sale_line_sales_period_id_sales_period_id_fk" FOREIGN KEY ("sales_period_id") REFERENCES "public"."sales_period"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_line_profit" ADD CONSTRAINT "sale_line_profit_sale_line_id_sale_line_id_fk" FOREIGN KEY ("sale_line_id") REFERENCES "public"."sale_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stg_supplier_price" ADD CONSTRAINT "stg_supplier_price_import_batch_id_import_batch_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_price_item" ADD CONSTRAINT "supplier_price_item_supplier_price_list_id_supplier_price_list_id_fk" FOREIGN KEY ("supplier_price_list_id") REFERENCES "public"."supplier_price_list"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_price_item" ADD CONSTRAINT "supplier_price_item_supplier_product_id_supplier_product_id_fk" FOREIGN KEY ("supplier_product_id") REFERENCES "public"."supplier_product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_price_list" ADD CONSTRAINT "supplier_price_list_import_batch_id_import_batch_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."import_batch"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_price_list" ADD CONSTRAINT "supplier_price_list_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_product" ADD CONSTRAINT "supplier_product_supplier_id_supplier_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."supplier"("id") ON DELETE no action ON UPDATE no action;