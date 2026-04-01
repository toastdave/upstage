CREATE TYPE "public"."credit_entry_type" AS ENUM('grant', 'purchase', 'generation', 'adjustment', 'refund');--> statement-breakpoint
CREATE TYPE "public"."entitlement_status" AS ENUM('free', 'trialing', 'active', 'past_due', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'processing', 'succeeded', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."moderation_status" AS ENUM('pending', 'approved', 'flagged', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."project_type" AS ENUM('virtual_staging', 'empty_room_design', 'existing_room_redesign');--> statement-breakpoint
CREATE TYPE "public"."room_brief_status" AS ENUM('missing', 'draft', 'reviewed');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_event_id" text NOT NULL,
	"event_name" varchar(120) NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_event_provider_event_id_unique" UNIQUE("provider_event_id")
);
--> statement-breakpoint
CREATE TABLE "credit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"entry_type" "credit_entry_type" NOT NULL,
	"amount" integer NOT NULL,
	"balance_after" integer,
	"description" varchar(160),
	"reference_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_image" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" varchar(80) DEFAULT 'image/png' NOT NULL,
	"revised_prompt" text,
	"seed" integer,
	"width" integer,
	"height" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_image_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "generation_job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" varchar(120) NOT NULL,
	"project_id" uuid NOT NULL,
	"source_asset_id" uuid NOT NULL,
	"preset_id" text,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"provider" varchar(80) NOT NULL,
	"model" varchar(120) NOT NULL,
	"prompt" text NOT NULL,
	"negative_prompt" text,
	"style_label" varchar(120),
	"room_type" varchar(80),
	"aspect_ratio" varchar(16) DEFAULT '4:3' NOT NULL,
	"requested_count" integer DEFAULT 1 NOT NULL,
	"credit_cost" integer DEFAULT 0 NOT NULL,
	"provider_generation_id" text,
	"request_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"response_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_job_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "generation_preset" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" varchar(120) NOT NULL,
	"category" varchar(80) NOT NULL,
	"prompt_template" text NOT NULL,
	"default_aspect_ratio" varchar(16) DEFAULT '4:3' NOT NULL,
	"is_featured" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "generation_preset_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "moderation_review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reviewer_user_id" text,
	"source_asset_id" uuid,
	"generation_image_id" uuid,
	"status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"reason" varchar(120),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plan" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" varchar(48) NOT NULL,
	"name" varchar(80) NOT NULL,
	"monthly_price_cents" integer NOT NULL,
	"annual_price_cents" integer,
	"feature_flags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plan_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"slug" varchar(80) NOT NULL,
	"title" varchar(140) NOT NULL,
	"project_type" "project_type" NOT NULL,
	"property_type" varchar(80),
	"room_type" varchar(80),
	"style_intent" varchar(120),
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"location_label" varchar(160),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "project_collaborator" (
	"project_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" varchar(40) DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_collaborator_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "source_asset" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" text NOT NULL,
	"project_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"original_filename" varchar(180),
	"mime_type" varchar(80) NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"moderation_status" "moderation_status" DEFAULT 'pending' NOT NULL,
	"room_brief" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"room_brief_status" "room_brief_status" DEFAULT 'missing' NOT NULL,
	"room_brief_summary" text,
	"room_brief_generated_at" timestamp with time zone,
	"room_brief_reviewed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_asset_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_entitlement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"status" "entitlement_status" DEFAULT 'free' NOT NULL,
	"polar_customer_id" text,
	"polar_subscription_id" text,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_image" ADD CONSTRAINT "generation_image_job_id_generation_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."generation_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_source_asset_id_source_asset_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."source_asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_job" ADD CONSTRAINT "generation_job_preset_id_generation_preset_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."generation_preset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_review" ADD CONSTRAINT "moderation_review_reviewer_user_id_user_id_fk" FOREIGN KEY ("reviewer_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_review" ADD CONSTRAINT "moderation_review_source_asset_id_source_asset_id_fk" FOREIGN KEY ("source_asset_id") REFERENCES "public"."source_asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_review" ADD CONSTRAINT "moderation_review_generation_image_id_generation_image_id_fk" FOREIGN KEY ("generation_image_id") REFERENCES "public"."generation_image"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_collaborator" ADD CONSTRAINT "project_collaborator_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_collaborator" ADD CONSTRAINT "project_collaborator_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_asset" ADD CONSTRAINT "source_asset_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_asset" ADD CONSTRAINT "source_asset_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_entitlement" ADD CONSTRAINT "user_entitlement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_entitlement" ADD CONSTRAINT "user_entitlement_plan_id_plan_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plan"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account_idx" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_user_idx" ON "credit_ledger" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "generation_image_job_idx" ON "generation_image" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "generation_job_project_idx" ON "generation_job" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "generation_job_status_idx" ON "generation_job" USING btree ("status");--> statement-breakpoint
CREATE INDEX "moderation_review_status_idx" ON "moderation_review" USING btree ("status");--> statement-breakpoint
CREATE INDEX "project_owner_idx" ON "project" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "project_status_idx" ON "project" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "source_asset_project_idx" ON "source_asset" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "source_asset_owner_idx" ON "source_asset" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "user_entitlement_user_idx" ON "user_entitlement" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_value_idx" ON "verification" USING btree ("identifier","value");