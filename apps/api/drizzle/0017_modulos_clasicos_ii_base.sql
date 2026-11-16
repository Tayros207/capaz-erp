-- ===== A mano: esquemas de los módulos de la ola 3 (Clásicos II). El disparador genérico ya existe (0013). =====
create schema if not exists insumos;
--> statement-breakpoint
create schema if not exists compras;
--> statement-breakpoint
create schema if not exists personal;
--> statement-breakpoint
grant usage on schema insumos, compras, personal to capaz_app;
