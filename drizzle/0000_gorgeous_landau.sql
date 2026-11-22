CREATE TYPE "public"."ai_report_status" AS ENUM('pending', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_report_type" AS ENUM('niche_analysis', 'subniches', 'video_ideas', 'competition', 'channel_strategy', 'research_report');--> statement-breakpoint
CREATE TYPE "public"."alert_type" AS ENUM('metric_change', 'rank_change', 'new_opportunity', 'system');--> statement-breakpoint
CREATE TYPE "public"."competition_level" AS ENUM('low', 'medium', 'high', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."data_confidence" AS ENUM('verified', 'estimated', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."data_source_status" AS ENUM('active', 'disabled', 'pending_approval');--> statement-breakpoint
CREATE TYPE "public"."data_source_type" AS ENUM('youtube_api', 'licensed_analytics', 'internal_taxonomy', 'ai', 'demo_fixture');--> statement-breakpoint
CREATE TYPE "public"."growth_trend" AS ENUM('fast_growing', 'stable', 'declining', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."monetization_potential" AS ENUM('low', 'medium', 'high', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."permission_scope" AS ENUM('cross_channel_aggregation', 'derived_metrics', 'historical_tracking', 'commercial_display', 'opportunity_scoring', 'ranking');--> statement-breakpoint
CREATE TYPE "public"."permission_status" AS ENUM('approved', 'denied', 'pending');--> statement-breakpoint
CREATE TYPE "public"."plan" AS ENUM('free', 'pro', 'team');--> statement-breakpoint
CREATE TYPE "public"."ranking_category" AS ENUM('top_performing', 'highest_growth', 'opportunity', 'low_competition', 'emerging', 'declining');--> statement-breakpoint
CREATE TYPE "public"."ranking_period" AS ENUM('7d', '30d', '90d', 'custom');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'canceled', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."video_format" AS ENUM('shorts', 'long_form', 'both', 'unknown');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text
);
--> statement-breakpoint
CREATE TABLE "ai_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"niche_id" uuid,
	"type" "ai_report_type" NOT NULL,
	"title" text NOT NULL,
	"prompt" text,
	"provider" text NOT NULL,
	"model" text,
	"status" "ai_report_status" DEFAULT 'pending' NOT NULL,
	"report" jsonb,
	"evidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"cost_usd" numeric(10, 6),
	"latency_ms" integer,
	"is_fallback" boolean DEFAULT false NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "api_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_key" text NOT NULL,
	"request_hash" text NOT NULL,
	"payload" jsonb NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"provider" text NOT NULL,
	"endpoint" text NOT NULL,
	"units" integer DEFAULT 0 NOT NULL,
	"quota_date" date NOT NULL,
	"status_code" integer,
	"latency_ms" integer,
	"cache_hit" boolean DEFAULT false NOT NULL,
	"request_id" text,
	"user_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_email" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"ip" text,
	"user_agent" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"queue" text DEFAULT 'default' NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb,
	"idempotency_key" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"error" text,
	"duration_ms" integer,
	"scheduled_for" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_authorizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"access_token_encrypted" text,
	"refresh_token_encrypted" text,
	"scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"authorized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "data_permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"data_source_id" uuid NOT NULL,
	"scope" "permission_scope" NOT NULL,
	"status" "permission_status" DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"approval_ref" text,
	"approved_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"type" "data_source_type" NOT NULL,
	"description" text,
	"terms_url" text,
	"status" "data_source_status" DEFAULT 'pending_approval' NOT NULL,
	"permits_cross_channel_aggregation" boolean DEFAULT false NOT NULL,
	"permits_derived_metrics" boolean DEFAULT false NOT NULL,
	"permits_historical_tracking" boolean DEFAULT false NOT NULL,
	"permits_commercial_display" boolean DEFAULT false NOT NULL,
	"retention_days" integer,
	"refresh_interval_hours" integer,
	"last_verified_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niche_keywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"weight" numeric(4, 2) DEFAULT '1' NOT NULL,
	"intent" text,
	"source" text DEFAULT 'internal_taxonomy' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niche_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche_id" uuid NOT NULL,
	"period" "ranking_period" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"avg_views" numeric(14, 2),
	"median_views" numeric(14, 2),
	"view_growth_pct" numeric(8, 2),
	"channel_growth_pct" numeric(8, 2),
	"video_performance_score" numeric(5, 2),
	"competition_score" numeric(5, 2),
	"engagement_rate" numeric(8, 4),
	"consistency_score" numeric(5, 2),
	"opportunity_score" numeric(5, 2),
	"sample_video_count" integer DEFAULT 0 NOT NULL,
	"sample_channel_count" integer DEFAULT 0 NOT NULL,
	"source_id" uuid NOT NULL,
	"confidence" "data_confidence" DEFAULT 'unknown' NOT NULL,
	"is_estimated" boolean DEFAULT true NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"inputs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niche_rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"niche_id" uuid NOT NULL,
	"ranking_version_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"category" "ranking_category" NOT NULL,
	"period" "ranking_period" NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"rank" integer NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"metrics" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"explanation" text,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT true NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niche_watchlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"niche_id" uuid NOT NULL,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"folder" text DEFAULT 'default' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "niches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"parent_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"formats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"primary_language" text,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"competition_level" "competition_level" DEFAULT 'unknown' NOT NULL,
	"growth_trend" "growth_trend" DEFAULT 'unknown' NOT NULL,
	"monetization_potential" "monetization_potential" DEFAULT 'unknown' NOT NULL,
	"opportunity_score" numeric(5, 2),
	"data_confidence" "data_confidence" DEFAULT 'unknown' NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ranking_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" text NOT NULL,
	"scoring_version" text NOT NULL,
	"description" text,
	"weights" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"query" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"provider_customer_id" text,
	"provider_subscription_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"seats" integer DEFAULT 1 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp with time zone,
	"image" text,
	"password_hash" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"plan" "plan" DEFAULT 'free' NOT NULL,
	"preferences" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "watchlist_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"watchlist_id" uuid NOT NULL,
	"type" "alert_type" NOT NULL,
	"message" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "youtube_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"country" text,
	"published_at" timestamp with time zone,
	"subscriber_count" bigint,
	"view_count" bigint,
	"video_count" bigint,
	"hidden_subscriber_count" boolean DEFAULT false NOT NULL,
	"niche_id" uuid,
	"source_id" uuid NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refresh_due_at" timestamp with time zone,
	"raw" jsonb
);
--> statement-breakpoint
CREATE TABLE "youtube_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" text NOT NULL,
	"channel_id" text,
	"channel_title" text,
	"title" text NOT NULL,
	"description" text,
	"thumbnail_url" text,
	"published_at" timestamp with time zone,
	"duration_seconds" integer,
	"view_count" bigint,
	"like_count" bigint,
	"comment_count" bigint,
	"category_id" text,
	"category_name" text,
	"default_language" text,
	"region_code" text,
	"format" "video_format" DEFAULT 'unknown' NOT NULL,
	"niche_id" uuid,
	"source_id" uuid NOT NULL,
	"is_fixture" boolean DEFAULT false NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refresh_due_at" timestamp with time zone,
	"raw" jsonb
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_snapshots" ADD CONSTRAINT "api_snapshots_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_authorizations" ADD CONSTRAINT "channel_authorizations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_permissions" ADD CONSTRAINT "data_permissions_data_source_id_data_sources_id_fk" FOREIGN KEY ("data_source_id") REFERENCES "public"."data_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_permissions" ADD CONSTRAINT "data_permissions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_keywords" ADD CONSTRAINT "niche_keywords_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_metrics" ADD CONSTRAINT "niche_metrics_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_metrics" ADD CONSTRAINT "niche_metrics_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_rankings" ADD CONSTRAINT "niche_rankings_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_rankings" ADD CONSTRAINT "niche_rankings_ranking_version_id_ranking_versions_id_fk" FOREIGN KEY ("ranking_version_id") REFERENCES "public"."ranking_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_rankings" ADD CONSTRAINT "niche_rankings_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_watchlists" ADD CONSTRAINT "niche_watchlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niche_watchlists" ADD CONSTRAINT "niche_watchlists_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niches" ADD CONSTRAINT "niches_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "niches" ADD CONSTRAINT "niches_parent_id_niches_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."niches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlist_alerts" ADD CONSTRAINT "watchlist_alerts_watchlist_id_niche_watchlists_id_fk" FOREIGN KEY ("watchlist_id") REFERENCES "public"."niche_watchlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_channels" ADD CONSTRAINT "youtube_channels_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_channels" ADD CONSTRAINT "youtube_channels_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_niche_id_niches_id_fk" FOREIGN KEY ("niche_id") REFERENCES "public"."niches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "youtube_videos" ADD CONSTRAINT "youtube_videos_source_id_data_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."data_sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_unique" ON "accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ai_reports_user_idx" ON "ai_reports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_reports_niche_idx" ON "ai_reports" USING btree ("niche_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_snapshots_hash_unique" ON "api_snapshots" USING btree ("request_hash");--> statement-breakpoint
CREATE INDEX "api_snapshots_expiry_idx" ON "api_snapshots" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "api_snapshots_resource_idx" ON "api_snapshots" USING btree ("resource_type","resource_key");--> statement-breakpoint
CREATE INDEX "api_usage_provider_date_idx" ON "api_usage" USING btree ("provider","quota_date");--> statement-breakpoint
CREATE INDEX "api_usage_created_idx" ON "api_usage" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_idempotency_unique" ON "background_jobs" USING btree ("idempotency_key") WHERE "background_jobs"."idempotency_key" is not null;--> statement-breakpoint
CREATE INDEX "background_jobs_status_idx" ON "background_jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_unique" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "channel_authorizations_unique" ON "channel_authorizations" USING btree ("user_id","channel_id");--> statement-breakpoint
CREATE INDEX "channel_authorizations_channel_idx" ON "channel_authorizations" USING btree ("channel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "data_permissions_unique" ON "data_permissions" USING btree ("data_source_id","scope");--> statement-breakpoint
CREATE INDEX "data_permissions_scope_idx" ON "data_permissions" USING btree ("scope","status");--> statement-breakpoint
CREATE UNIQUE INDEX "data_sources_key_unique" ON "data_sources" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "niche_keywords_unique" ON "niche_keywords" USING btree ("niche_id","keyword");--> statement-breakpoint
CREATE INDEX "niche_keywords_keyword_idx" ON "niche_keywords" USING btree ("keyword");--> statement-breakpoint
CREATE UNIQUE INDEX "niche_metrics_unique" ON "niche_metrics" USING btree ("niche_id","period","period_end","source_id");--> statement-breakpoint
CREATE INDEX "niche_metrics_niche_idx" ON "niche_metrics" USING btree ("niche_id");--> statement-breakpoint
CREATE INDEX "niche_metrics_period_idx" ON "niche_metrics" USING btree ("period","period_end");--> statement-breakpoint
CREATE UNIQUE INDEX "niche_rankings_unique" ON "niche_rankings" USING btree ("niche_id","source_id","category","period","period_start","ranking_version_id");--> statement-breakpoint
CREATE INDEX "niche_rankings_lookup_idx" ON "niche_rankings" USING btree ("category","period","period_start","rank");--> statement-breakpoint
CREATE INDEX "niche_rankings_niche_idx" ON "niche_rankings" USING btree ("niche_id");--> statement-breakpoint
CREATE UNIQUE INDEX "niche_watchlists_unique" ON "niche_watchlists" USING btree ("user_id","niche_id");--> statement-breakpoint
CREATE INDEX "niche_watchlists_user_idx" ON "niche_watchlists" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "niches_slug_unique" ON "niches" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "niches_category_idx" ON "niches" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "niches_parent_idx" ON "niches" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "niches_name_idx" ON "niches" USING btree ("name");--> statement-breakpoint
CREATE INDEX "niches_opportunity_idx" ON "niches" USING btree ("opportunity_score");--> statement-breakpoint
CREATE UNIQUE INDEX "ranking_versions_version_unique" ON "ranking_versions" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_searches_unique" ON "saved_searches" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_unique" ON "sessions" USING btree ("session_token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_user_unique" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_tokens_unique" ON "verification_tokens" USING btree ("identifier","token");--> statement-breakpoint
CREATE INDEX "watchlist_alerts_watchlist_idx" ON "watchlist_alerts" USING btree ("watchlist_id","is_read");--> statement-breakpoint
CREATE UNIQUE INDEX "youtube_channels_id_unique" ON "youtube_channels" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "youtube_channels_niche_idx" ON "youtube_channels" USING btree ("niche_id");--> statement-breakpoint
CREATE INDEX "youtube_channels_refresh_idx" ON "youtube_channels" USING btree ("refresh_due_at");--> statement-breakpoint
CREATE UNIQUE INDEX "youtube_videos_id_unique" ON "youtube_videos" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "youtube_videos_niche_idx" ON "youtube_videos" USING btree ("niche_id");--> statement-breakpoint
CREATE INDEX "youtube_videos_channel_idx" ON "youtube_videos" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "youtube_videos_published_idx" ON "youtube_videos" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "youtube_videos_format_idx" ON "youtube_videos" USING btree ("format");