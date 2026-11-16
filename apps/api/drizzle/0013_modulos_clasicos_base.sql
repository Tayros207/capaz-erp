ALTER TABLE "core"."borradores" DROP CONSTRAINT "borrador_origen";--> statement-breakpoint
ALTER TABLE "core"."productos" ADD CONSTRAINT "productos_empresa_id" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "core"."sucursales" ADD CONSTRAINT "sucursales_empresa_id" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "core"."borradores" ADD CONSTRAINT "borrador_origen" CHECK ("core"."borradores"."origen" IN ('voz', 'texto', 'agente', 'regla', 'conector', 'importacion', 'modulo'));
--> statement-breakpoint
-- ===== A mano: esquemas de los módulos de la ola 2 y disparador genérico de solo lectura =====
create schema if not exists crm;
--> statement-breakpoint
create schema if not exists ordenes;
--> statement-breakpoint
grant usage on schema crm, ordenes to capaz_app;
--> statement-breakpoint
-- «Módulo en baja = solo lectura». El código del módulo llega como argumento del disparador.
-- Sin `grant execute` (igual que core.tocar_actualizado_en); adentro llama a core.exigir_modulo.
create or replace function core.exigir_modulo_en_escritura() returns trigger
language plpgsql set search_path = core, pg_temp as $$
begin
  perform core.exigir_modulo(tg_argv[0]);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
