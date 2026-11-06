CREATE TYPE "public"."delivery_status" AS ENUM('PENDING', 'DELIVERED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('PENDING', 'MATCHED', 'LATE_MATCHED', 'UNMATCHED', 'NOT_APPLICABLE');--> statement-breakpoint
CREATE TYPE "public"."parse_status" AS ENUM('PARSED', 'UNPARSED', 'IGNORED');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('PENDING', 'PAID', 'EXPIRED', 'CANCELLED', 'LATE_PAID');--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"prefix" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor" text NOT NULL,
	"action" text NOT NULL,
	"target" text,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_nonces" (
	"device_id" text NOT NULL,
	"nonce" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_pairing_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"token_hash" text NOT NULL,
	"device_name" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_pairing_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"secret_enc" text NOT NULL,
	"last_heartbeat_at" timestamp with time zone,
	"listener_ok" boolean,
	"battery" integer,
	"charging" boolean,
	"queued" integer,
	"source_app_versions" jsonb,
	"clock_skew_ms" integer,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parsers" (
	"id" text PRIMARY KEY NOT NULL,
	"package_name" text,
	"pattern" text NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"auto_match" boolean DEFAULT true NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_events" (
	"id" text PRIMARY KEY NOT NULL,
	"device_id" text,
	"package_name" text NOT NULL,
	"title" text,
	"text" text,
	"big_text" text,
	"sub_text" text,
	"notification_key" text,
	"app_version" text,
	"posted_at" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone,
	"hash" text NOT NULL,
	"is_test" boolean DEFAULT false NOT NULL,
	"parse_status" "parse_status" NOT NULL,
	"parsed_amount" bigint,
	"parser_id" text,
	"qris_source_id" text,
	"match_status" "match_status" NOT NULL,
	"transaction_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"webhook_url" text,
	"webhook_secret_enc" text NOT NULL,
	"default_expiry_min" integer DEFAULT 15 NOT NULL,
	"default_return_url" text,
	"default_qris_source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qris_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"raw_payload" text NOT NULL,
	"merchant_name" text NOT NULL,
	"nmid" text,
	"source_package" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"qris_source_id" text NOT NULL,
	"merchant_ref" text NOT NULL,
	"base_amount" bigint NOT NULL,
	"unique_code" integer NOT NULL,
	"final_amount" bigint NOT NULL,
	"qris_payload" text NOT NULL,
	"status" "transaction_status" DEFAULT 'PENDING' NOT NULL,
	"idempotency_key" text,
	"return_url" text,
	"metadata" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"code_locked_until" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"matched_event_id" text,
	"manual_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"project_id" text NOT NULL,
	"transaction_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "delivery_status" DEFAULT 'PENDING' NOT NULL,
	"attempt" integer DEFAULT 0 NOT NULL,
	"last_status_code" integer,
	"last_error" text,
	"next_retry_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_nonces" ADD CONSTRAINT "device_nonces_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_qris_source_id_qris_sources_id_fk" FOREIGN KEY ("qris_source_id") REFERENCES "public"."qris_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_default_qris_source_id_qris_sources_id_fk" FOREIGN KEY ("default_qris_source_id") REFERENCES "public"."qris_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_qris_source_id_qris_sources_id_fk" FOREIGN KEY ("qris_source_id") REFERENCES "public"."qris_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_hash_uq" ON "api_keys" USING btree ("key_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "device_nonces_uq" ON "device_nonces" USING btree ("device_id","nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_events_hash_uq" ON "payment_events" USING btree ("hash");--> statement-breakpoint
CREATE UNIQUE INDEX "qris_sources_package_uq" ON "qris_sources" USING btree ("source_package");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_pending_amount_uq" ON "transactions" USING btree ("qris_source_id","final_amount") WHERE "transactions"."status" = 'PENDING';--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_idempotency_uq" ON "transactions" USING btree ("project_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "transactions_lock_idx" ON "transactions" USING btree ("qris_source_id","final_amount","code_locked_until");--> statement-breakpoint
CREATE INDEX "transactions_expiry_idx" ON "transactions" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "webhook_deliveries_due_idx" ON "webhook_deliveries" USING btree ("status","next_retry_at");