CREATE TABLE "trust_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"skill_type" text NOT NULL,
	"score" numeric(4, 2) DEFAULT '0' NOT NULL,
	"autonomy_level" text DEFAULT 'building' NOT NULL,
	"approval_streak" integer DEFAULT 0 NOT NULL,
	"quality_rating_avg" numeric(4, 2),
	"gate_pass_rate" numeric(4, 2),
	"schema_pass_rate" numeric(4, 2),
	"task_count_window" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"skill_type" text NOT NULL,
	"current_level" text NOT NULL,
	"proposed_level" text NOT NULL,
	"trust_score" numeric(4, 2) NOT NULL,
	"approval_streak" integer NOT NULL,
	"evidence" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trust_scores" ADD CONSTRAINT "trust_scores_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_scores" ADD CONSTRAINT "trust_scores_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_proposals" ADD CONSTRAINT "trust_proposals_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_proposals" ADD CONSTRAINT "trust_proposals_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trust_scores_company_idx" ON "trust_scores" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trust_scores_agent_skill_unique" ON "trust_scores" USING btree ("agent_id","skill_type");--> statement-breakpoint
CREATE INDEX "trust_proposals_company_idx" ON "trust_proposals" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "trust_proposals_agent_idx" ON "trust_proposals" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "trust_proposals_status_idx" ON "trust_proposals" USING btree ("status");
