CREATE TABLE "alert_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"rule_id" integer NOT NULL,
	"device_id" text NOT NULL,
	"kind" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_id" text NOT NULL,
	"kind" text NOT NULL,
	"threshold" double precision,
	"cooldown_min" integer DEFAULT 30 NOT NULL,
	"email" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"online" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "faults" (
	"id" serial PRIMARY KEY NOT NULL,
	"time" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" text NOT NULL,
	"code" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "readings" (
	"time" timestamp with time zone DEFAULT now() NOT NULL,
	"device_id" text NOT NULL,
	"temp_c" double precision NOT NULL,
	"device_uptime_ms" integer,
	CONSTRAINT "readings_device_id_time_pk" PRIMARY KEY("device_id","time")
);
--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_rule_id_alert_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."alert_rules"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faults" ADD CONSTRAINT "faults_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "readings" ADD CONSTRAINT "readings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "readings_time_idx" ON "readings" USING btree ("time");