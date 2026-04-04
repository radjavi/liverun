ALTER TABLE "runs" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "race_id" text;--> statement-breakpoint
ALTER TABLE "runs" ADD COLUMN "planned_start_time" timestamp with time zone;