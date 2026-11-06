ALTER TABLE "devices" ADD COLUMN "app_version" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "last_crash" text;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "last_crash_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "pending_commands" jsonb DEFAULT '[]'::jsonb NOT NULL;