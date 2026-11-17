# Plan de integración profunda · Cotizador (Cotizín) y registro conversacional (SF) dentro de Capaz

**Fecha:** 2026-11-17 · **Versión 2** (revisada por el arquitecto sobre la propuesta de Sonnet del mismo día) · **Para:** Moisés (dueño), Keny (técnico) y el agente que construye · **Estado:** aprobado para construir las fases 0 a 2.
Complementa `PLAN-DE-CIERRE-COTIZADOR-Y-VOZ.md` (qué se copió y qué falta) y `FLUJO-ENTRE-MODULOS.md` (eventos entre módulos). No reemplaza ADR-017.

## 0. Qué cambió frente a la versión 1

| Punto | Versión 1 decía | Verificado en el código y la base |
|---|---|---|
| B6 (Neon) | Faltan 0023 y 0024 | **Ya aplicadas** (`NEON-MIGRACION.md` §8, filas del 16 y 17 de noviembre). Lo pendiente es la **0025**, que es de la sesión de maestros ampliados |
| B9 (sin commit) | Solo `CampoUnidad` | También: sesión de 4 horas en `core/auth/auth.ts` y la adopción de `CampoUnidad` en producto, pedidos, insumos y compras. **Y hay archivos de otra sesión** (0025, `core-maestros-ampliados.ts`, contrato `maestros-ampliados.ts`) que **no son nuestros** |
| Fase 1 | Producto sin lista → obliga a «Fijar precio» antes de cotizar | `cotizacion_crear` ya acepta **líneas manuales con `productoId`**: un producto del catálogo se cotiza con su precio de catálogo sin crear nada. Fijar precios por escala pasa a ser opcional |
| Fase 3 | «Construir» el puente y los eventos F2/F3 | El puente cotización aceptada → borrador de pedido **ya existe y es idempotente** (`ordenes/consumidores.ts`). Queda el recorrido manual y F3 |
| B5 | Falta la tarjeta de medición en Inicio | Ya está en `main` (commit «Tarjeta de dictado y medición en Inicio»). Falta solo verla en pantalla |
| Convivencia | No la contemplaba | **Dos sesiones en el mismo árbol.** Este plan reparte archivos (§5) para no pisarse |

## 1. El problema de fondo

Los motores de Cotizín y las reglas de Tairos.RC ya están copiados e integrados con sus pruebas. Lo que falta es que **se sientan parte de un solo ERP**: hoy cada uno trabaja con sus propios datos y la persona tiene que volver a teclear lo que otro módulo ya sabe.

El caso que lo mostró: en *Cotización rápida*, el campo «Producto» busca en `cotizador.listas_de_precio`, no en `core.productos`. En Cotizín eso era correcto porque **la lista de precios era el catálogo**. En Capaz hay un catálogo propio (nombre, unidad, precio unitario **con IGV**, afecto o no) y el Cotizador trabaja con tres precios de referencia **sin IGV**. Son dos mundos sin puente: la columna `producto_id` de la lista existe pero ninguna pantalla la llena, y una empresa con 150 productos y 0 listas no puede cotizar nada.

## 2. Brechas verificadas

| # | Brecha | Evidencia | Estado |
|---|---|---|---|
| B1 | Catálogo y lista de precios no conectados | `pantalla-rapida.tsx` y `hoja-linea-cotizacion.tsx` buscan con `listarListas`; `hoja-lista.tsx` no permite elegir producto | **Abierta · prioridad máxima** |
| B2 | Cotizador sin el cuadro «por partes» | `cotizador.manifest.ts`: 4 secciones | Abierta, condicionada al piloto |
| B3 | Datos de demostración sin precios de cotizar | `scripts/sembrar-demo.ts` no siembra nada de `cotizador` | Abierta |
| B4 | Cadena cotización → pedido → deuda → cobro sin recorrer a mano | Puente existe y está probado por integración; nadie lo recorrió en pantalla | Abierta (solo verificación) |
| B5 | Voz: HTTPS para el micrófono del celular; ruido de nombres | Informe s5c | Abierta, depende de HTTPS |
| B6 | Neon sin 0023/0024 | **Cerrada** el 2026-11-17 | Pendiente solo la 0025 (otra sesión) |
| B7 | Pantallas nuevas sin revisión a 390/1280, claro/oscuro, PDF | Sesión integradora | Abierta (persona) |
| B8 | Despliegue y seguridad de producción | §4 fase 7 | Abierta (Keny) |
| B9 | Cambios hechos sin commit | `git status`: 8 archivos modificados y 2 nuevos nuestros | Abierta · fase 0 |
| B10 | Unidad del catálogo (`UND`) y de la lista (`unidad`) no coinciden | `CampoUnidad` guarda `UND`; `listas_de_precio.unidad` por defecto `unidad` | **Nueva** · se resuelve en fase 1 |
| B11 | Nada impide dos listas activas para el mismo producto | No hay índice ni comprobación sobre `producto_id` | **Nueva** · comprobación en código (fase 1) e índice en 0026 (fase 7) |

## 3. Principios (no cambian)

1. **Un dato se escribe una vez.** Lo que un módulo produce, el otro lo recibe como borrador o enlace de un clic.
2. **El sistema propone, la persona aprueba.** Nada automático escribe dinero.
3. **No se pierde ninguna función** de Cotizín ni de Tairos.RC. Las listas sin producto siguen funcionando.
4. **Sin llaves foráneas entre esquemas de módulos** salvo hacia `core` (ya existe `listas_de_precio.producto_id → core.productos`). Los módulos se hablan por eventos y herramientas con permisos.
5. **El catálogo manda.** El producto vive en `core.productos`; la lista de precios del Cotizador es **una capa de precios por escala sobre ese producto**, no otro catálogo.
6. **Los precios del Cotizador van sin IGV** (como Cotizín); el catálogo y Pedidos van con IGV (D17). La conversión la hace **el servidor, una sola vez, en una función pura con prueba**; ninguna pantalla divide por 1,18.
7. Cada fase termina con `pnpm check` en verde y la prueba manual de «Hecho cuando».

## 4. Fases

### Fase 0 · Cerrar lo suelto (una hora)

- Commit **por rutas explícitas** (nunca `git add -A`) de lo nuestro: `apps/web/src/shared/ui/campo-unidad.tsx`, `apps/web/src/shared/formato/unidades.ts`, los cuatro formularios que lo adoptan (`core/productos/formulario-producto.tsx`, `modules/ordenes/hoja-linea.tsx`, `modules/insumos/hoja-articulo.tsx`, `modules/compras/hoja-linea.tsx`), `apps/api/src/core/auth/auth.ts` (sesión de 4 h), `docs/NEON-MIGRACION.md` y este plan. Con una prueba unitaria de `unidades.ts` (`esUnidadConocida`) y una de `campo-unidad.tsx` (elegir «Otra…» muestra el campo libre).
- **No se tocan ni se confirman** los archivos de la sesión de maestros ampliados: `0025_maestros_ampliados.sql`, `meta/0025_snapshot.json`, `meta/_journal.json`, `db/esquema/index.ts`, `db/esquema/core-maestros-ampliados.ts`, `contratos/maestros-ampliados.ts`, `graphify-out/**`.
- `ORIGENES_PERMITIDOS` documentado en `.env.example` si aún no lo está.
- **Hecho cuando:** `git status` muestra solo los archivos de la otra sesión y `pnpm check` está en verde.

### Fase 1 · Catálogo ↔ Cotizador (B1, B10, B11) · prioridad máxima

**Objetivo:** en *Cotización rápida* y en la hoja de línea de una cotización se busca **cualquier producto del catálogo** y se cotiza al instante, tenga o no lista de precios.

**1.1 Servidor · herramienta nueva `cotizador_productos_buscar`** (módulo `cotizador`, permiso `cotizador:ver`, lectura).
- Entrada: `texto` (1 a 120), `limite` (1 a 20, por defecto 8).
- Busca en `core.productos` activos por parecido (misma consulta que `productos_buscar`: `pg_trgm` + contiene + código exacto; copiar la consulta al repositorio del Cotizador, **no importar** `core/productos`), les une su lista activa por `producto_id` (`left join`), y **además** devuelve las listas activas **sin producto** cuyo nombre coincida (para no perder las listas heredadas de Cotizín).
- Salida: `items[]` con `{ productoId | null, listaId | null, nombre, unidad, origen: 'lista' | 'catalogo' | 'sin_precio', lista?: ListaDePrecioDto, precioCatalogoSinIgvMilesimas?: number, afectoIgv?: boolean }`.
  - `origen = 'lista'`: hay lista activa (con o sin producto). Se cotiza por escala, como hoy.
  - `origen = 'catalogo'`: producto sin lista con `precioUnitarioMilesimas > 0`. Se cotiza como **línea manual** con el precio del catálogo pasado a sin IGV.
  - `origen = 'sin_precio'`: producto sin lista y sin precio. Solo se puede «Fijar precio».
- Función pura `precioDeCatalogoSinIgv(milesimas, afectoIgv, igvPorcentaje)` en `domain/igv.ts` (o archivo nuevo `domain/catalogo.ts`): si no está afecto, devuelve el mismo; si lo está, `round(milesimas × 100 / (100 + igv))`. Prueba unitaria con 1.180 → 1.000, 100 → 85 (redondeo), no afecto → igual.
- Contrato en `packages/shared/src/contratos/cotizador.ts` (`cotizador_productos_buscar`), esquema Zod estricto.
- Prueba de integración: dos empresas; producto con lista, producto sin lista con precio, producto sin precio, lista sin producto, producto archivado (no aparece), lista archivada (el producto sale como `catalogo`), y aislamiento (la empresa B no ve nada de A).

**1.2 Servidor · una lista activa por producto (B11).**
- En `lista_precio_crear` y `lista_precio_editar`: si llega `productoId` y ya hay **otra** lista activa con ese producto → `conflicto` con el nombre de la lista existente. Repositorio: `listaActivaDeProducto(tx, ctx, productoId, salvo?)`.
- Al crear con `productoId` y sin `unidad` explícita, la unidad se toma del producto (B10).
- Prueba de integración para el conflicto y para la unidad heredada.
- El índice único parcial `(tenant_id, producto_id) where archivado_en is null and producto_id is not null` va en la **migración 0026**, que escribe el carril de datos **después** de que la sesión de maestros ampliados libere `db:generar` (§5). Hasta entonces manda la comprobación en código.

**1.3 Web · cotización rápida (`pantalla-rapida.tsx`).**
- El selector «Producto» llama a `cotizador_productos_buscar`. Cada opción muestra el detalle: «precios por escala», «S/ X por UND, precio del catálogo» o «sin precio».
- `origen = 'lista'`: todo como hoy (`precio_consultar`, 100 a 5.000).
- `origen = 'catalogo'`: muestra una insignia «Precio del catálogo», el precio unitario sin IGV, y el cálculo importe / IGV / total lo hace la pantalla **solo para mostrar** (importe = cantidad × unitario; IGV = importe × igv/100 redondeado); al crear, la línea va como `{ tipo: 'manual', productoId, descripcion, unidad, cantidadMilesimas, precioUnitarioMilesimas }` y **el servidor recalcula**. Sin límite 100 a 5.000. Si `configurar`, botón secundario «Fijar precios por escala» que abre `HojaDeLista` con el producto, nombre y unidad ya puestos.
- `origen = 'sin_precio'`: estado vacío «Este producto no tiene precio» con el botón «Fijar precio» (abre `HojaDeLista` con el producto puesto) si `configurar`; si no, texto que diga a quién pedirlo.
- Textos de ayuda: «Busca en tu catálogo de productos.» / «Ningún producto se parece a eso». Si `configurar`, `alCrear` lleva a `/productos/nuevo` con el texto escrito (o abre la hoja de nuevo producto si existe exportada).
- `logica.ts`: `argumentosDeCotizacionRapida` recibe la opción elegida y arma la línea de lista o la manual. Prueba unitaria de ambos casos.

**1.4 Web · hoja de línea de cotización (`hoja-linea-cotizacion.tsx`).** Mismo selector y mismos tres casos; una línea `catalogo` se guarda como manual con `productoId`. Hoy la hoja ya tiene el modo manual: solo se le llena desde el producto.

**1.5 Web · lista de precios.**
- `hoja-lista.tsx`: selector «Producto del catálogo (opcional)» con `productos_buscar` (ya existe en `core/productos/api.ts`; la web sí puede llamarlo porque es una herramienta con su permiso). Al elegirlo rellena nombre y unidad. Campo «Unidad» pasa a `CampoUnidad`. Envía `productoId`.
- `pantalla-precios.tsx`: columna o chip «Producto» con `EnlaceDeEntidad` a `/productos/:id` cuando hay `productoId`; filtro «Sin producto» para enlazar las heredadas.
- `ListaDePrecioDto`: ya trae `productoId`; agregar `productoNombre` (nullable) en `aListaDto` leyendo con `left join` (o segunda consulta por ids) para no hacer N llamadas desde la pantalla.
- Ficha del producto (`core/productos/pantalla-ficha.tsx`): **una sola `Edit` puntual** que agregue un enlace «Ver precio en el Cotizador» (a `/m/cotizador/precios?producto=<id>`) cuando el módulo está activo. Avisar a la sesión de maestros ampliados antes de tocarlo (§5).

**Hecho cuando:** con «Distribuidora Los Nogales» (150 productos, 0 listas) se busca un producto, se cotiza con su precio de catálogo y se crea la cotización en menos de un minuto; después se le fijan precios por escala desde la misma pantalla y la siguiente consulta sale por escala. Con «Gráfica Andina» sus dos listas heredadas siguen apareciendo. `pnpm check` en verde.

### Fase 2 · Datos de demostración coherentes (B3)

- Archivo nuevo `apps/api/scripts/demo/cotizador.ts`, llamado desde `sembrar-demo.ts` (una línea): para cada empresa demo con el módulo `cotizador` activo, crea listas enlazadas a 8 o 10 de sus productos con precios derivados del precio de catálogo (100 → unitario × 100 × 1,15; 1.000 → × 1.000; 5.000 → × 5.000 × 0,85, todo sin IGV y respetando la invariante B). La mitad con `precios_fijados_en` 100 días atrás para que salgan «Revisar». Deja productos sin lista a propósito (para probar el caso `catalogo`) y uno sin precio (caso `sin_precio`).
- Dos clientes con ajuste especial (+5 % y −10 %) por empresa.
- Idempotente: si la lista existe (por `producto_id` o nombre), no se duplica.
- **Hecho cuando:** `pnpm demo` (o el comando que use `sembrar-demo.ts`) corre dos veces sin error y cualquier empresa demo puede cotizar sin cargar nada a mano.

### Fase 3 · Cadena comercial de punta a punta (B4) · solo verificación y F3

- Recorrido manual con datos de demo: cotización rápida → emitir → aceptar → aparece el borrador de pedido en la bandeja → aprobar → pedido y deuda → cobrar. Registrar cada tropiezo en `docs/FICHAS-OLA-4.md` §11.
- Comprobar que la línea `catalogo` (manual, sin IGV) llega al pedido **con IGV** y el total coincide con la cotización (el puente ya manda `igvPorcentaje`).
- F3 de `FLUJO-ENTRE-MODULOS.md` (pedido entregado → proponer cobro del saldo) si el recorrido lo pide; F2 (oportunidad del CRM → borrador de pedido) queda fuera de este plan.
- `ChipDeCliente`, `EnlaceDeEntidad`, `InsigniaDeEstado` en las listas del Cotizador que aún no los usen.
- **Hecho cuando:** el recorrido completo se hace sin volver a teclear cliente ni monto, y dos entregas del mismo evento no duplican borradores (ya hay prueba; repetirla a mano).

### Fase 4 · Voz y captura (B5)

- Ruido de nombres: decisión D3. Verificar en pantalla la tarjeta de medición de Inicio (ya está en código).
- Prueba con micrófono en escritorio; en celular, solo tras HTTPS (fase 7).
- **Pista V** (dueño): 30 a 50 dictados reales y 10 registros cronometrados. Meta: 70 % sin corregir, 30 s por registro.
- **Hecho cuando:** «le cobré 250 a Gráfica Norte por unos volantes» llega como borrador correcto y se aprueba con un clic.

### Fase 5 · Revisión visual (B7)

- `/dictar`, las cuatro pantallas del Cotizador y las hojas nuevas a 390 y 1280 px, claro y oscuro; imprimir una cotización a PDF.
- **Hecho cuando:** sin desbordes, contraste correcto y el PDF no muestra costos ni margen.

### Fase 6 · Cotizador «por partes» (B2) · condicionada al piloto

Igual que la versión 1: solo si el piloto de tres trabajos lo pide. **Hecho cuando:** 2.500 volantes A5 dan 225,15 de costo y 346,38 de precio.

### Fase 7 · Producción (B8) · con Keny

1. **Migraciones:** la 0025 (maestros ampliados, otra sesión) y la **0026** (índice único de lista por producto, de este plan): ensayo en rama de Neon, revisión de Keny y confirmación del dueño; después production. Las 0023 y 0024 ya están.
2. **Despliegue:** front estático con HTTPS automático; API NestJS en un host de procesos; front y API bajo el mismo dominio padre para cookies `Secure` + `SameSite`.
3. **Seguridad:** HTTPS en el borde; `ORIGENES_PERMITIDOS` con el dominio real; secretos fuera del repo; sesión de 4 h (ya en código, se confirma en fase 0); contraseñas de demostración fuera de producción.
4. Túnel con acceso por correo solo para probar el micrófono antes del despliegue.
**Hecho cuando:** login, dictado desde el celular y una cotización completa funcionan sobre HTTPS en el dominio real.

### Fase 8 · Coexistencia y apagado

Sin cambios respecto a la versión 1: el dinero se anota solo en Capaz desde el día 1 del piloto; copia de seguridad y Excel de Tairos.RC antes de apagarlo; apagado de Tairos.RC cuando la voz cumpla la meta dos semanas seguidas y de Cotizín cuando «por partes» no se use 30 días; pausar 90 días y luego borrar.

## 5. Quién construye qué y cómo conviven las dos sesiones

| Carril | Quién | Fases | Propiedad exclusiva |
|---|---|---|---|
| **cot-1** (este plan) | Sonnet, esfuerzo medio, lanzado por el integrador | 0, 1 y 2 | `apps/api/src/modules/cotizador/**`, `apps/web/src/modules/cotizador/**`, `packages/shared/src/contratos/cotizador.ts`, `apps/api/scripts/demo/cotizador.ts` (nuevo) + una línea en `sembrar-demo.ts`, `apps/web/src/shared/ui/campo-unidad.tsx`, `apps/web/src/shared/formato/unidades.ts`, los cuatro formularios ya modificados de la fase 0, `core/auth/auth.ts` (solo el commit), **una `Edit` puntual** en `core/productos/pantalla-ficha.tsx` |
| **maestros ampliados** | Sesión `modules-capaz-erp-9c` | ajena a este plan | Migración 0025, `db/esquema/core-maestros-ampliados.ts`, `contratos/maestros-ampliados.ts`, archivos nuevos en `core/clientes/**` y `core/productos/**` y sus pantallas; una línea en `db/esquema/index.ts`, `contratos/index.ts` y los `*.module.ts` |
| **datos** | Carril de datos, cuando 9c libere `db:generar` | 0026 | `apps/api/drizzle/**`, `db/esquema/cotizador.ts` |
| **personas** | Moisés, Keny | 3 a 8 | — |

Reglas de convivencia:
1. **Nadie corre `pnpm db:generar`** hasta que la sesión 9c avise. cot-1 no necesita migración.
2. Commits **solo por rutas explícitas** y solo de los archivos propios. Mensaje: `carril cot-1: <resumen>`.
3. Pruebas de integración de cot-1 con `CAPAZ_TEST_DB=capaz_test_cot` (crearla con `pnpm db:preparar` tras exportar la variable) para no chocar con la base de pruebas de 9c.
4. Si cot-1 necesita algo de un archivo ajeno: **solicitud de cambio** en su informe, no lo toca.
5. El integrador corre `graphify update .` al final; los carriles no.

## 6. Decisiones

| # | Decisión | Resuelta así (o recomendación) |
|---|---|---|
| D1 | ¿Precios del Cotizador sin IGV o con IGV? | **Resuelta por este plan:** sin IGV en el Cotizador, con IGV en catálogo y Pedidos; convierte el servidor en una función pura con prueba (§3.6). Cambiarlo rompería 284 pruebas del motor |
| D2 | Producto sin lista: ¿un precio o tres puntos? | **Resuelta:** ninguno obligatorio. Se cotiza con el precio del catálogo; los tres puntos son una mejora opcional («Fijar precios por escala») |
| D3 | ¿Quitar «· Wilfredo» del caso 7 del dictado? | Dejarlo hasta la pista V |
| D4 | ¿Importar contactos o productos de Cotizín o Tairos.RC? | Solo contactos reales y productos que realmente se venden, por CSV (herramientas de intercambio ya existen) |
| D5 | Host de la API en producción | Uno con despliegue desde GitHub y HTTPS incluido; lo define Keny |
| D6 | ¿Lista activa única por producto? | **Sí** (comprobación en código ahora, índice en 0026 después) |

## 7. Qué no se hace

- No se toca Cotizín ni Tairos.RC.
- No se crea un segundo catálogo ni se copia el precio del catálogo dentro de la lista: la lista **enlaza**, no duplica.
- Sin modelo de pago para la voz hasta ver la pista V.
- Troquelado por pieza y gran formato por m²: fuera hasta después del piloto.
- Sin HTTPS dentro de controllers o services.
- cot-1 no escribe migraciones ni toca archivos de la sesión 9c.

## 8. Riesgos

| Riesgo | Mitigación |
|---|---|
| Redondeo al pasar el precio de catálogo (con IGV) a sin IGV y de vuelta en el pedido: diferencia de un céntimo | La conversión es una función pura con prueba; el recorrido de la fase 3 compara el total de la cotización con el del pedido y, si difieren, se anota el caso en `FICHAS-OLA-4.md` §11 y se decide (redondear al crear la lista o aceptar un céntimo) |
| Dos sesiones en el mismo árbol | §5: propiedad exclusiva, commits por ruta, bases de prueba distintas, sin `db:generar` |
| Listas de demo con precios inventados | Siempre derivadas del catálogo y marcadas «Revisar» por fecha; nunca se cargan en producción |
| Dos listas activas para un producto antes de la 0026 | Comprobación en código en crear y editar, con prueba |
| Confundir catálogo y lista de precios | Un solo selector en pantalla con el origen a la vista («precios por escala», «precio del catálogo», «sin precio») |
