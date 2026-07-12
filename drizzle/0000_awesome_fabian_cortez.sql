CREATE TYPE "public"."employment_type" AS ENUM('monthly', 'hourly');--> statement-breakpoint
CREATE TYPE "public"."id_type" AS ENUM('nric', 'fin');--> statement-breakpoint
CREATE TYPE "public"."race" AS ENUM('chinese', 'malay', 'indian', 'eurasian', 'other');--> statement-breakpoint
CREATE TYPE "public"."residency_status" AS ENUM('citizen', 'pr', 'wp', 'spass', 'ep');--> statement-breakpoint
CREATE TABLE "employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"full_name" text NOT NULL,
	"id_type" "id_type" NOT NULL,
	"id_number" text NOT NULL,
	"dob" date NOT NULL,
	"nationality" text NOT NULL,
	"residency_status" "residency_status" NOT NULL,
	"race" "race",
	"shg_opt_out" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"bank_name" text,
	"bank_account_no" text,
	"email" text,
	"mobile" text,
	"pass_expiry_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_id_number_unique" UNIQUE("id_number")
);
--> statement-breakpoint
CREATE TABLE "employments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"employee_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"employment_type" "employment_type" NOT NULL,
	"base_salary" numeric(10, 2),
	"hourly_rate" numeric(7, 2),
	"contractual_hours_per_week" numeric(5, 2),
	"is_scheduled" boolean DEFAULT true NOT NULL,
	"role_title" text NOT NULL,
	"outlet_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"uen" text,
	"csn" text,
	"ssic" text,
	"sector" text DEFAULT 'services' NOT NULL,
	"bank_name" text,
	"bank_account_no" text,
	"xero_tenant_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "employments" ADD CONSTRAINT "employments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employments" ADD CONSTRAINT "employments_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employments" ADD CONSTRAINT "employments_outlet_id_outlets_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."outlets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outlets" ADD CONSTRAINT "outlets_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;