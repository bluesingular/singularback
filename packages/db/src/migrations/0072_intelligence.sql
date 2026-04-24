CREATE TABLE "intelligence_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"card_type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"urgency" integer DEFAULT 3 NOT NULL,
	"action_url" text,
	"status" text DEFAULT 'unread' NOT NULL,
	"insight_key" text NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activation_moments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"pack_slug" text NOT NULL,
	"trigger_key" text NOT NULL,
	"fired" boolean DEFAULT false NOT NULL,
	"fired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "intelligence_cards" ADD CONSTRAINT "intelligence_cards_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activation_moments" ADD CONSTRAINT "activation_moments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "intelligence_cards_company_idx" ON "intelligence_cards" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "intelligence_cards_status_idx" ON "intelligence_cards" USING btree ("status");--> statement-breakpoint
CREATE INDEX "intelligence_cards_insight_key_idx" ON "intelligence_cards" USING btree ("company_id","insight_key");--> statement-breakpoint
CREATE INDEX "activation_moments_company_pack_idx" ON "activation_moments" USING btree ("company_id","pack_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "activation_moments_unique_trigger" ON "activation_moments" USING btree ("company_id","pack_slug","trigger_key");
