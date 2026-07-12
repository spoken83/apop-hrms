CREATE TYPE "public"."rate_table_type" AS ENUM('cpf', 'sdl', 'shg', 'fwl');--> statement-breakpoint
CREATE TABLE "rate_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"table_type" "rate_table_type" NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
