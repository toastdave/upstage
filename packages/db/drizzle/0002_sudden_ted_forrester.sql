CREATE TABLE "user_preference" (
	"user_id" text PRIMARY KEY NOT NULL,
	"default_project_type" "project_type" DEFAULT 'virtual_staging' NOT NULL,
	"default_aspect_ratio" varchar(16) DEFAULT '4:3' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preset_preference" (
	"user_id" text NOT NULL,
	"preset_id" text NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp with time zone,
	"use_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preset_preference_user_id_preset_id_pk" PRIMARY KEY("user_id","preset_id")
);
--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preset_preference" ADD CONSTRAINT "user_preset_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preset_preference" ADD CONSTRAINT "user_preset_preference_preset_id_generation_preset_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."generation_preset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_preset_preference_user_idx" ON "user_preset_preference" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_preset_preference_preset_idx" ON "user_preset_preference" USING btree ("preset_id");