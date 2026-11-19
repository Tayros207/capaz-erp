ALTER TABLE "ordenes"."pedido_eventos" DROP CONSTRAINT "evento_tipo";--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" ADD COLUMN "detalle" jsonb;--> statement-breakpoint
ALTER TABLE "ordenes"."pedido_eventos" ADD CONSTRAINT "evento_tipo" CHECK ("ordenes"."pedido_eventos"."tipo" IN ('creado', 'editado', 'confirmado', 'estado', 'cancelado', 'nota', 'datos_editados'));