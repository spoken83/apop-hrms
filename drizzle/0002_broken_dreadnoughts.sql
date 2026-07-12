CREATE TYPE "public"."adjustment_kind" AS ENUM('allowance', 'bonus', 'deduction');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status" AS ENUM('draft', 'confirmed');--> statement-breakpoint
CREATE TYPE "public"."payslip_line_type" AS ENUM('basic', 'hourly_pay', 'ot', 'ph_pay', 'allowance', 'bonus', 'npl_deduction', 'deduction', 'cpf_ee', 'cpf_er', 'sdl', 'shg_cdac', 'shg_sinda', 'shg_mbmf', 'shg_ecf', 'net_pay');--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"period_month" text NOT NULL,
	"status" "payroll_run_status" DEFAULT 'draft' NOT NULL,
	"advice_code" text NOT NULL,
	"rate_table_versions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmed_at" timestamp,
	"cpf_submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslip_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payslip_id" uuid NOT NULL,
	"line_type" "payslip_line_type" NOT NULL,
	"label" text NOT NULL,
	"amount_cents" integer NOT NULL,
	"trace" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payslips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"employment_id" uuid NOT NULL,
	"ow_cents" integer DEFAULT 0 NOT NULL,
	"aw_cents" integer DEFAULT 0 NOT NULL,
	"ow_subject_cents" integer DEFAULT 0 NOT NULL,
	"aw_subject_cents" integer DEFAULT 0 NOT NULL,
	"gross_cents" integer DEFAULT 0 NOT NULL,
	"cpf_ee_cents" integer DEFAULT 0 NOT NULL,
	"cpf_er_cents" integer DEFAULT 0 NOT NULL,
	"sdl_cents" integer DEFAULT 0 NOT NULL,
	"shg_fund" text,
	"shg_cents" integer DEFAULT 0 NOT NULL,
	"net_cents" integer DEFAULT 0 NOT NULL,
	"ezpay_status" text DEFAULT 'E' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"employment_id" uuid NOT NULL,
	"kind" "adjustment_kind" NOT NULL,
	"amount_cents" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslip_lines" ADD CONSTRAINT "payslip_lines_payslip_id_payslips_id_fk" FOREIGN KEY ("payslip_id") REFERENCES "public"."payslips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payslips" ADD CONSTRAINT "payslips_employment_id_employments_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_adjustments" ADD CONSTRAINT "run_adjustments_run_id_payroll_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_adjustments" ADD CONSTRAINT "run_adjustments_employment_id_employments_id_fk" FOREIGN KEY ("employment_id") REFERENCES "public"."employments"("id") ON DELETE no action ON UPDATE no action;