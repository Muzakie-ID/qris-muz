ALTER TABLE "projects" ADD COLUMN "unique_code_min" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "unique_code_max" integer DEFAULT 999 NOT NULL;