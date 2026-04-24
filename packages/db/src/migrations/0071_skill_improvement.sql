CREATE TABLE "skill_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"skill_type" text NOT NULL,
	"version" text NOT NULL,
	"prompt_body" text NOT NULL,
	"frontmatter" jsonb NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"benchmark_score" numeric(4, 2),
	"benchmark_item_count" integer,
	"parent_version_id" uuid,
	"created_by_agent_id" uuid,
	"activated_at" timestamp with time zone,
	"trigger_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "golden_datasets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"skill_type" text NOT NULL,
	"input" jsonb NOT NULL,
	"expected_output" jsonb NOT NULL,
	"quality_score" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_versions" ADD CONSTRAINT "skill_versions_created_by_agent_id_agents_id_fk" FOREIGN KEY ("created_by_agent_id") REFERENCES "public"."agents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "golden_datasets" ADD CONSTRAINT "golden_datasets_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "skill_versions_company_skill_idx" ON "skill_versions" USING btree ("company_id","skill_type");--> statement-breakpoint
CREATE INDEX "skill_versions_status_idx" ON "skill_versions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "golden_datasets_company_skill_idx" ON "golden_datasets" USING btree ("company_id","skill_type");
