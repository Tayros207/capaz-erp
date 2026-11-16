# Flujo entre módulos · que el trabajo sea fluido, rápido y sin volver a teclear

**Fecha:** 2026-11-16 · **Estado: PROPUESTA** (el usuario pidió que módulos y componentes estén comunicados para que el trabajo sea más ágil). Complementa `PROPUESTA-DE-MEJORAS.md` (B1, C-C2, C-I5) y `MEJORA-DE-DISENO.md`. No construye nada: lo ejecuta el integrador por carriles.

## 1. Principio

Un dato se escribe **una vez**. Lo que un módulo produce, el siguiente lo recibe como **borrador** (el sistema propone, la persona aprueba, R5) o como **enlace de un clic**. Los módulos no se importan entre sí: se hablan por eventos y por herramientas con permisos (R6).

## 2. Qué ya se comunica (verificado en el código)

| Evento | Quién lo emite | Quién reacciona |
|---|---|---|
| `pedido.confirmado` | Pedidos | Finanzas (propone la deuda) |
| `adelanto.registrado` | Pedidos | Finanzas |
| `pedido.cancelado` | Pedidos | Finanzas |
| `compra.recibida` | Compras | Inventario (entrada) y Finanzas (deuda por pagar) |
| `adelanto.registrado` | Personal | Finanzas (borrador de egreso «Sueldos») |

## 3. Qué falta, por valor para el trabajo diario

| # | Flujo | Hoy | Propuesta | Esfuerzo |
|---|---|---|---|---|
| F1 | **Ficha 360 del cliente**: pedidos, deudas, abonos, oportunidades en una pantalla, con «Debe S/ X» arriba | Cada dato en su módulo | B1 de la propuesta de mejoras; `ChipDeCliente` ya enlaza a ella | M |
| F2 | **Oportunidad ganada → borrador de pedido** | Se vuelve a teclear | C-C2: evento `oportunidad.ganada` → Pedidos propone el borrador con cliente y monto | S |
| F3 | **Pedido entregado → proponer cobro del saldo** y recibo | Hay que acordarse | Evento `pedido.entregado` → Finanzas propone el abono por el saldo | S |
| F4 | **Insumo bajo el mínimo → borrador de orden de compra** al proveedor habitual | Aviso sin acción | C-I5; evento `insumo.bajo_minimo` → Compras | S–M |
| F5 | **Deuda vencida → actividad de cobranza en CRM** y botón «Escribir por WhatsApp» con el mensaje redactado | Nada | Automatización por tiempo (ya hay marco) + C-C1, C-C5 | S |
| F6 | **Compra recibida → actualizar costo** | `existencias_recibir` ya guarda el último costo; falta mostrarlo (C-I4) | Pantalla de valor del inventario | S |
| F7 | **Pedido confirmado → reservar/consumir insumos** y avisar si falta | No existe | C-P9; depende de unidades (B12) | M–L |
| F8 | **Personal → adelanto → egreso en Finanzas** | **YA EXISTE** y está probado: `adelanto.registrado` → consumidor `registro_adelanto_registrado` propone un borrador de egreso «Sueldos» | Nada que construir (no hay aprobación aparte) | — |

## 4. En pantalla (componentes)

1. **Una sola paleta (Ctrl+K)** ya existe: ampliar a pedidos, deudas y proveedores cuando haya búsqueda en el servidor (herramientas `*_buscar`).
2. **Piezas compartidas** (`shared/ui/entidades.tsx`: `EnlaceDeEntidad`, `ChipDeCliente`, `InsigniaDeEstado`) **deben usarse en todas las listas y fichas** de los módulos: cliente → ficha, pedido → pedido, deuda → deuda, mismo color para el mismo estado.
3. **Acciones cruzadas en la ficha**: desde un cliente, «Nuevo pedido», «Cobrar», «Nueva oportunidad» con el cliente ya puesto (parámetro en la ruta, sin reescribir datos).
4. **Cifras de Inicio como enlaces** con filtro puesto (ya hecho para pendientes; extender a todas).
5. **Un solo aviso** (`notificar`, Sonner) y una sola hoja de confirmación en todos los módulos.
6. **Menos clics**: formularios que recuerdan el último cliente/cuenta, teclado (Enter guarda, Esc cierra), valores por defecto del módulo, y «guardar y nuevo».
7. **Velocidad percibida**: carga por esqueletos, `staleTime` compartido en las consultas, prefetch al pasar el mouse por un enlace de entidad, y actualización optimista en acciones simples (mover etapa, marcar entrega).

## 5. Orden recomendado

1. **Ronda 1 (en curso):** documentos, recibo, adelanto.
2. **Ronda 2:** F1 (ficha 360), F2, F3 y las acciones cruzadas (4.3); adopción de las piezas compartidas en todos los módulos (4.2).
3. **Ronda 3:** F5, F4, F6 y velocidad percibida (4.7).
4. **Después:** F7 junto con unidades de medida.

## 6. Reglas para construirlo

- Cada evento nuevo se declara en `EVENTOS` de `@capaz/shared` con su esquema Zod y se prueba con una prueba de integración «A emite, B propone borrador» (idempotente: dos entregas no crean dos borradores).
- Sin llaves foráneas entre esquemas de módulos (par `origen_tipo` + `origen_id`).
- Todo lo automático deja **borrador**, nunca escribe dinero por su cuenta (decisión de producto: «el sistema propone, la persona aprueba»).
- Sin e2e. Las verificaciones de pantalla son manuales a 390 y 1280 px.
