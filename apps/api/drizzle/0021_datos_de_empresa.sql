ALTER TABLE "core"."empresa_config" ADD COLUMN "razon_social" text;--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD COLUMN "ruc" text;--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD COLUMN "direccion_fiscal" text;--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD COLUMN "telefono" text;--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD COLUMN "correo" text;--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD COLUMN "pie_de_documento" text;--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD COLUMN "logo_data_url" text;--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD CONSTRAINT "empresa_config_ruc" CHECK ("core"."empresa_config"."ruc" is null or "core"."empresa_config"."ruc" ~ '^[0-9]{11}$');--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD CONSTRAINT "empresa_config_razon_social_largo" CHECK ("core"."empresa_config"."razon_social" is null or length("core"."empresa_config"."razon_social") <= 200);--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD CONSTRAINT "empresa_config_direccion_largo" CHECK ("core"."empresa_config"."direccion_fiscal" is null or length("core"."empresa_config"."direccion_fiscal") <= 300);--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD CONSTRAINT "empresa_config_telefono_largo" CHECK ("core"."empresa_config"."telefono" is null or length("core"."empresa_config"."telefono") <= 50);--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD CONSTRAINT "empresa_config_correo_largo" CHECK ("core"."empresa_config"."correo" is null or length("core"."empresa_config"."correo") <= 200);--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD CONSTRAINT "empresa_config_pie_largo" CHECK ("core"."empresa_config"."pie_de_documento" is null or length("core"."empresa_config"."pie_de_documento") <= 1000);--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD CONSTRAINT "empresa_config_logo_largo" CHECK ("core"."empresa_config"."logo_data_url" is null or length("core"."empresa_config"."logo_data_url") <= 150000);--> statement-breakpoint
ALTER TABLE "core"."empresa_config" ADD CONSTRAINT "empresa_config_logo_formato" CHECK ("core"."empresa_config"."logo_data_url" is null or "core"."empresa_config"."logo_data_url" ~ '^data:image/(png|jpeg|webp);base64,');
