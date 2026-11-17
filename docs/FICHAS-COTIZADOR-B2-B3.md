# Fichas · Cotizador B2 (cuadro por partes) y B3 (enlace público)

**Fecha:** 2026-11-17 · **Para:** el integrador y los agentes de carril · **Estado:** congeladas; orden del dueño («avanza ya con el cuadro por partes y el enlace público»).
Complementa `PLAN-INTEGRACION-PROFUNDA.md` (fase 6 y fase 9) y `PLAN-INTEGRACION-COTIZIN-Y-SF.md` §4.2. Manda `AGENTS.md`. Fuente de solo lectura: `/home/datayros/Documentos/work/referencias/cotizin-2026-11-14/`.

## 0. Idea en una frase

Lo que ya está (lista de precios, cotización rápida, versiones, puente a Pedidos) **no se toca**: el cuadro por partes es **otro modo** de la misma cotización (`versiones.modo = 'cuadro'`), con el motor que ya está copiado en `domain/motor/`, y el enlace público es **una puerta de solo lectura con dos acciones** (aprobar, rechazar) servida por la API sin sesión y sin JavaScript.

## 1. Reglas que aplican a todos los carriles

1. Las de `AGENTS.md`, sin excepción. En especial: una herramienta por operación, dinero en céntimos fuera del motor, `big.js` solo dentro del motor (R22, `frontera-del-motor.spec.ts`), archivos < 500 líneas, funciones < 50, sin dependencias nuevas, sin `security definer`.
2. **Nadie reescribe el motor.** `domain/motor/**` es de solo lectura para todos los carriles. Si falta algo, solicitud de cambio.
3. **Un dato se escribe una vez:** las tarifas, máquinas, formatos e ítems del taller son filas propias (una herramienta por fila, nunca «guardar la lista completa»: fallo conocido de Cotizín).
4. **El cliente nunca ve costos ni margen:** ni en el documento, ni en el enlace público, ni en ningún DTO que salga sin `cotizador:costos`.
5. Convivencia: hay otras sesiones en el mismo árbol. Cada carril trabaja en **su worktree** (`../capaz-erp-carriles/<id>`, rama `carril/<id>`), con `CAPAZ_TEST_DB=capaz_test_<id>`. Commits solo en su rama, por rutas explícitas. El integrador fusiona.
6. Archivos compartidos que **ningún carril edita** (solicitud de cambio al integrador): `apps/api/src/app.module.ts`, `infra/**`, `packages/shared/src/contratos/index.ts`, `apps/web/src/app/rutas.tsx`, `core/**`, `modules/<otro módulo>/**`, `graphify-out/**`.
7. Cada herramienta nueva: contrato Zod estricto en `packages/shared/src/contratos/<archivo del carril>.ts`, `ayuda` completa (título, para qué, cuándo, campos, ejemplos tecleado y hablado, errores comunes, relacionadas), permiso, criticidad, prueba de integración con dos empresas (aislamiento).

## 2. Carril **cot-db** · Migración `0027_cotizador_taller_y_enlaces` (carril de datos; va primero)

**Propiedad:** `apps/api/drizzle/**` (solo archivos nuevos `0027_*` y lo que genere `drizzle-kit`; `_journal.json` solo por `pnpm db:generar`, nunca a mano), `apps/api/src/db/esquema/cotizador.ts` (ampliar), `apps/api/src/infra/database/aislamiento-ejemplos.ts` y las pruebas `aislamiento`, `catalogo`, `contratacion` (agregar filas). Antes de `pnpm db:generar`: confirmar que `_journal.json` ya incluye la 0026 y avisar «reclamo 0027» (lo hace el integrador).

### 2.1 Tablas nuevas (esquema `cotizador`; todas con `tenant_id text not null`, `id uuid uuidv7()`, `unique(tenant_id, id)`, `creado_por`, `creado_en`, `actualizado_en` + disparador `core.tocar_actualizado_en`, `select core.aplicar_aislamiento('cotizador.<tabla>', 'completo')`, disparador `core.exigir_modulo_en_escritura('cotizador')`, índices que empiezan por `tenant_id`)

| Tabla | Columnas (además de las comunes) | Restricciones |
|---|---|---|
| `formatos_pliego` | `nombre text`, `nombre_normalizado text`, `ancho_cm numeric(7,2)`, `alto_cm numeric(7,2)`, `tipo text` (`madre` \| `maquina`), `archivado_en timestamptz` | `check tipo in ('madre','maquina')`, `check ancho_cm > 0 and alto_cm > 0`, único parcial `(tenant_id, nombre_normalizado) where archivado_en is null` |
| `maquinas` | `nombre`, `nombre_normalizado`, `formato_max_ancho_cm numeric(7,2)`, `formato_max_alto_cm numeric(7,2)`, `pinza_cm numeric(7,2)`, `sangrado_cm numeric(7,2)`, `calle_cm numeric(7,2)`, `etapas jsonb not null default '[]'` (lista de `{ nombre, mermaPct, arranque }` como texto), `archivado_en` | medidas `>= 0`, único parcial por nombre normalizado activo |
| `tarifas` | `factor text` (`material`,`impresion`,`planchas`,`diseno`,`acabado`,`indirectos`), `nombre`, `nombre_normalizado`, `unidad text`, `costo_unitario numeric(14,4)`, `escala_por_defecto text` (`fija`,`por_pliego`,`por_unidad`), `formato_id uuid null` → `(tenant_id, formato_id)` a `formatos_pliego`, `articulo_id uuid null` (**sin** llave foránea: par blando hacia `insumos.articulos`, R6), `archivado_en` | checks de `factor` y `escala`, `costo_unitario >= 0`, único parcial por nombre normalizado activo |
| `items_del_cuadro` | `nombre`, `nombre_normalizado`, `factor text`, `despues_de text`, `posicion integer`, `fija boolean default false`, `archivado_en` | checks de `factor` y `despues_de` (mismos seis valores), `posicion >= 0`, único parcial por nombre normalizado activo |
| `enlaces` | `cotizacion_id uuid not null` → `(tenant_id, cotizacion_id)` a `cotizaciones`, `version integer not null`, `token_hash text not null`, `vence_en timestamptz not null`, `revocado_en timestamptz`, `vistas integer not null default 0`, `ultima_vista_en timestamptz` | `unique(token_hash)` (global: el token identifica a la empresa), índice `(tenant_id, cotizacion_id, version)`, `check version >= 1`, `check vistas >= 0` |

### 2.2 Cambios en tablas existentes

- `listas_de_precio`: índice único parcial `uq_cotizador_listas_producto (tenant_id, producto_id) where archivado_en is null and producto_id is not null` (B11 del plan).
- `eventos`: `usuario_id` pasa a **nullable** (los eventos del cliente desde el enlace no tienen usuario); nuevos tipos permitidos en el check: `'vista'`, `'enlace_generado'`, `'enlace_revocado'`; columna nueva `canal text not null default 'ui'` con `check canal in ('ui','enlace','sistema')`.
- `versiones`: sin cambios (`modo = 'cuadro'`, `entrada` y `resultado` ya existen).

### 2.3 Lo que puede hacer el grupo de sistema (`capaz_sistema`), y nada más

```sql
-- Resolver el token sin sesión: solo estas columnas, solo lectura (mismo patrón que core.claves_api en 0010).
select core.abrir_a_plataforma('cotizador.enlaces', null, 'token_hash, tenant_id, cotizacion_id, version, vence_en, revocado_en');
```
Todo lo demás (leer la versión, contar la vista, registrar aprobada o rechazada) ocurre **dentro de `conEmpresa({ empresaId, usuarioId: 'enlace' })`** con el rol de la aplicación, como hace `core/conectores/entrada.controller.ts`. **Ninguna función `security definer`.** Agregar `cotizador.enlaces` a la lista `PERMITIDO` de `contratacion.int.spec.ts` con solo esas columnas.

### 2.4 Verificación (VERIF-DATOS)
`node scripts/migrar.ts --base capaz_test_cotdb` dos veces (idempotente); `pnpm check`; `pnpm db:generar` no genera nada; `aislamiento.int.spec.ts` con una fila de ejemplo por tabla nueva; `catalogo.int.spec.ts` en verde (índices por `tenant_id`, llaves compuestas); `contratacion.int.spec.ts` en verde con la fila nueva. **No se aplica en Neon** (lo decide el dueño; Keny revisa la 0027 antes).

## 3. Carril **cot-s3** · Ajustes del taller (servidor y pantalla)

**Depende de:** cot-db integrado. **Propiedad:** `apps/api/src/modules/cotizador/{domain/taller*.ts, herramientas/taller-*.ts, repositories/taller*.ts}`, `packages/shared/src/contratos/cotizador-taller.ts` (nuevo), `apps/web/src/modules/cotizador/{taller-*.tsx, logica-taller*.ts, api-taller.ts}`, y **una `Edit` puntual** en `herramientas/herramientas-de-cotizador.ts` (registrar), en `cotizador.manifest.ts` (sección `{ id: 'taller', nombre: 'Taller', ruta: '/m/cotizador/taller', construida: true }`) y en `apps/web/src/modules/cotizador/rutas.tsx` (una ruta) y `marco.tsx` si las secciones se listan ahí.

**Herramientas (permiso `cotizador:configurar` para escribir, `cotizador:ver` para leer; criticidad normal; archivar idempotente):**
`formatos_pliego_listar`, `formato_pliego_crear`, `formato_pliego_editar`, `formato_pliego_archivar`; `maquinas_listar`, `maquina_crear`, `maquina_editar`, `maquina_archivar`; `tarifas_listar` (filtro por `factor` y `buscar`), `tarifa_crear`, `tarifa_editar` (**crítica** si cambia `costoUnitario`: resumen «Cambiarás el costo de «X»: 0.45 → 0.52»), `tarifa_archivar`; `items_cuadro_listar`, `item_cuadro_crear`, `item_cuadro_editar`, `item_cuadro_archivar`, `items_cuadro_reordenar` (lista de ids → posiciones); `taller_sembrar` (`cotizador:configurar`, idempotente: si la empresa no tiene filas, carga `semilla-es-pe.ts` del motor: formatos, máquinas, tarifas e ítems **marcados como ilustrativos** en `datos_extra`/`nota`; si ya hay filas, no hace nada y lo dice).
Medidas y costos viajan **como texto** (`'0.45'`, `'70'`) validados con los esquemas del motor (`formatoPliegoSchema`, `maquinaSchema`, `insumoTarifaSchema`, `itemDeEmpresaSchema` de `domain/motor/base/empresa.ts`); en la base van como `numeric`; Drizzle los devuelve como texto. Nunca `number` para un costo.
Nombre normalizado con `normalizarNombre` de `domain/lista.ts`. Choque de nombre → `conflicto` con la fila existente.

**Pantalla `/m/cotizador/taller`:** cuatro pestañas (Tarifas, Máquinas, Formatos, Ítems del cuadro) con lista + hoja inferior de alta/edición (`HojaInferior`, `Campo`, `CampoSelect`, `CampoUnidad`), archivar con confirmación, botón «Cargar valores de ejemplo (Perú)» que llama `taller_sembrar` y avisa que son ilustrativos. Móvil primero.

**Pruebas:** integración de cada herramienta con dos empresas; unitarias de la lógica de pantalla; `pnpm check` en verde.

## 4. Carril **cot-s4** · El cuadro por partes (servidor)

**Depende de:** cot-s3 integrado. **Propiedad:** `apps/api/src/modules/cotizador/{domain/cuadro*.ts, herramientas/cuadro-*.ts, repositories/cuadro*.ts}`, `packages/shared/src/contratos/cotizador-cuadro.ts` (nuevo), `Edit` puntual en `herramientas-de-cotizador.ts`, y **`cotizaciones-emision.ts` + `cotizacion-mapeo.ts`** (ampliar emisión y DTO para `modo = 'cuadro'`; son del Cotizador y en esta ronda solo los toca s4).

**Modelo:** una cotización en modo cuadro es una fila de `cotizaciones` con una `versiones.modo = 'cuadro'`; `versiones.entrada` guarda el `Cuadro` del motor (`cuadroSchema` de `domain/motor/costeo/tipos/borrador.ts`) y, al emitir, `versiones.resultado` guarda la `Emision` (configuración congelada, cálculo, imposición, cuadro directo). `version_lineas` se generan al emitir desde las columnas a enviar (una línea por columna: cantidad, descripción del trabajo, precio **sin IGV** en céntimos vía `adaptador-de-dinero.ts`), para que **todo lo que ya existe** (documento, WhatsApp, aceptar, puente a Pedidos, cobro) funcione sin cambios.

**Herramientas (permiso `cotizador:editar`; sobre una cotización `id` en borrador con modo cuadro; cada una devuelve la vista del cuadro recalculada, con costos solo si `cotizador:costos`):**
- `cuadro_iniciar` → crea cotización + versión 1 modo cuadro, `entrada` = cuadro vacío con la plantilla elegida (`constantes/plantillas.ts`) y la configuración del taller; opcional `clienteId`, `titulo`.
- `cuadro_ver` (lectura).
- `cuadro_fijar_trabajo` (producto, descripción, cantidad, pieza ancho × alto cm, tintas, caras).
- `cuadro_fijar_imposicion` (máquina del catálogo por id → copia pinza, sangrado, calle, formato máximo y etapas; pliego madre y de máquina por id de formato o medidas a mano). El motor recalcula la fila automática de papel y la de planchas (`imposicion.ts`, `mermas.ts`).
- `cuadro_linea_agregar` (desde una tarifa por id → copia nombre, unidad, costo, escala; o a mano), `cuadro_linea_editar`, `cuadro_linea_quitar`.
- `cuadro_fijar_costo_directo` (las tres columnas: cantidades, celdas a mano, ítems, utilidad por columna), `cuadro_fijar_columnas_a_enviar`.
- `cuadro_fijar_utilidad` (pct y base), `cuadro_fijar_precio_final` (importe o `null`).
- `cuadro_calcular` (lectura: recibo de costos: por factor, costo, precio sugerido, precio, utilidad, margen, unitario, semáforo, desglose de pliegos).
- `cuadro_generar_referencias` (lectura: los tres precios 100 / 1.000 / 5.000 escalando el cuadro, `escalar-cuadro.ts` + `generar-referencias.ts`) y `cuadro_guardar_referencias` (crea o actualiza la lista de precios enlazada al producto del catálogo si se indica `productoId`; respeta «una lista por producto» y la invariante B; crítica si edita una existente).
- Emitir: **se amplía `cotizacion_emitir`** (no se crea otra): si la versión es modo cuadro, valida que el cuadro esté completo (trabajo, imposición, al menos una fila, utilidad posible), congela la `Emision`, exige `motivoMargenBajo` si el semáforo está en rojo (ya existe el mecanismo), genera `version_lineas` y totales en céntimos. `cotizacion_nueva_version` y `cotizacion_duplicar` copian `entrada` para modo cuadro.

**Caso de referencia obligatorio:** `armar-caso-de-referencia.ts` de Cotizín, rehecho **solo con herramientas de Capaz por HTTP** (`pruebas-de-cotizador.ts`): 2.500 volantes A5 → costo **225,15**, precio **346,38**, 172 pliegos madre, semáforo igual que en Cotizín (C1 y C12 de `PLAN-INTEGRACION-COTIZIN-Y-SF.md` §6.1). Si un valor no coincide, el carril **para** y lo informa; no se ajusta ningún número esperado.

## 5. Carril **cot-w2** · Pantalla del cuadro

**Depende de:** cot-s4 integrado. **Propiedad:** `apps/web/src/modules/cotizador/{cuadro/**, api-cuadro.ts, logica-cuadro*.ts}`, `Edit` puntual en `rutas.tsx` (`m/cotizador/cuadro/nuevo`, `m/cotizador/cuadro/:id`), en `pantalla-rapida.tsx` (enlace «Cotizar por partes») y en `pantalla-ficha-cotizacion.tsx` (si `modo = 'cuadro'`, botón «Abrir el cuadro» y recibo de costos con permiso).

**Pantalla:** tres columnas desde 1.280 px (Trabajo e imposición · Cuadro de costos por factor · Recibo y precio), una a la vez en el celular con pestañas; selector de máquina, pliego y tarifa con `SelectorDeRegistro`; filas por factor con subtotal; recibo con semáforo (`InsigniaDeEstado` con tono); panel de utilidad; «Precios 100 / 1.000 / 5.000» con «Guardar en la lista de precios»; «Emitir» con el diálogo de motivo cuando el margen está en rojo. Costos y margen solo si `cotizador:costos`. Ideas de flujo de `cotizin/src/features/cotizacion/components/*` (solo lectura; sin copiar textos, estilos ni cifras de diseño).

## 6. Carril **cot-b3** · Enlace público (servidor + web)

**Depende de:** cot-db integrado (puede ir **en paralelo** con cot-s3 y cot-s4). **Propiedad:** `apps/api/src/modules/cotizador/{domain/enlaces*.ts, herramientas/enlaces-*.ts, repositories/enlaces*.ts, publico/**}` (controlador público y plantilla HTML), `packages/shared/src/contratos/cotizador-enlaces.ts` (nuevo), `Edit` puntual en `herramientas-de-cotizador.ts`, `cotizador.module.ts` (registrar el controlador) y `cotizaciones-estado.ts` (al anular, revocar los enlaces vivos: una llamada), `apps/web/src/modules/cotizador/{hoja-enlace.tsx, logica-enlace*.ts, api-enlaces.ts}` y `Edit` puntual en `pantalla-ficha-cotizacion.tsx` (botón «Enlace para el cliente»).

**Token:** 32 bytes aleatorios en base64url; en la base solo `sha256(token)` (`token_hash`). El token completo se devuelve **una sola vez** al generarlo. Vigencia por defecto 30 días (1 a 365).

**Herramientas (`cotizador:emitir`):** `enlace_generar` (**crítica**, resumen «¿Envío la cotización COT-… v2 por S/ X al cliente?»; solo versión emitida y no anulada; registra evento `enlace_generado` y, si la cotización está `emitida`, la pasa a `enviada` reutilizando la regla de `cotizacion_marcar_enviada`), `enlaces_listar` (de una cotización: vence, vistas, última vista, revocado), `enlace_revocar` (idempotente; evento `enlace_revocado`). `cotizacion_anular` revoca todos los enlaces vivos.

**Controlador público `apps/api/src/modules/cotizador/publico/enlaces-publicos.controller.ts`** (`@Publica()`, `Cache-Control: no-store`, limitador de fallos por IP como `entrada.controller.ts`, respuestas **HTML** sin JavaScript, textos en español, HTML escapado siempre):
- `GET /api/v1/c/:token` → resuelve `sha256(token)` con `db.sistema` (solo las columnas abiertas); inexistente, vencido o revocado → **la misma** página «Esta cotización ya no está disponible» (404, sin distinguir); válido → dentro de `conEmpresa({ empresaId, usuarioId: 'enlace' })`: suma una vista, registra `vista` (canal `enlace`, `usuario_id` nulo) **como máximo una vez por hora por enlace**, y muestra: empresa (razón social, logo si hay), número y versión, cliente, líneas u opciones con cantidad y precio **con IGV** y el IGV aparte, condiciones, «válida hasta», estado actual, y dos formularios `POST` (aprobar con la opción elegida, rechazar con nota opcional) si el estado es `emitida` o `enviada`; si ya está aceptada, rechazada o anulada, lo dice y no muestra botones. Nunca costos, margen, lista ni ajuste.
- `POST /api/v1/c/:token/aprobar` y `POST /api/v1/c/:token/rechazar` (`application/x-www-form-urlencoded`): resuelven otra vez; aplican la **misma lógica de dominio** que `cotizacion_aceptar` y `cotizacion_rechazar` (extraer esa lógica a `domain/`/repositorio compartido si hoy vive dentro de la herramienta; la herramienta y el controlador llaman a la misma función), con `usuario_id` nulo y canal `enlace`, y emiten `cotizacion.aceptada` / `cotizacion.rechazada` igual que la herramienta (así el puente a Pedidos propone el borrador). Responden `303` a `GET /api/v1/c/:token`.
- `GET /api/v1/c/:token/imprimir` → la misma página con `@media print` para «Guardar como PDF». Sin dependencia nueva.
- Configuración: la URL pública base sale de `BETTER_AUTH_URL` (ya existe en `infra/config`); el enlace es `${BETTER_AUTH_URL}/api/v1/c/<token>`. Si el dueño quiere un dominio corto, se agrega `URL_PUBLICA` por solicitud de cambio.

**Web:** en la ficha de una cotización emitida, «Enlace para el cliente» abre una hoja con «Generar enlace» (confirmación), muestra el enlace una sola vez con «Copiar» y «Enviar por WhatsApp» (usa `mensajeWhatsapp` con `{enlace}`), la lista de enlaces con vistas y «Revocar». El estado de la cotización se refresca.

**Pruebas:** HTTP real: generar → GET muestra; token inventado → 404 igual que vencido y revocado; aprobar → estado `aceptada` y borrador de pedido propuesto (reusar `recorridos/cotizador.int.spec.ts` como guía, no editarlo); rechazar con nota; segunda aprobación no cambia nada; 30 fallos por IP bloquean; otra empresa no ve el enlace; el HTML no contiene «costo» ni «margen» ni la lista; `contratacion.int.spec.ts` sigue en verde.

## 7. Orden, rondas e integración

```
cot-db ──► cot-s3 ──► cot-s4 ──► cot-w2
   └──────► cot-b3 (en paralelo con s3 y s4)
```
Máximo tres carriles abiertos. El integrador: prepara cada worktree (`git worktree add ../capaz-erp-carriles/<id> -b carril/<id> main`, copia `.env` con `CAPAZ_TEST_DB`, `pnpm install --frozen-lockfile`, build de shared, `pnpm db:preparar`), fusiona en `main` en ese orden, corre `pnpm check` tras cada fusión, agrega los `export *` nuevos en `contratos/index.ts`, actualiza `catalogo.spec.ts` si cambia el número de secciones, y corre `graphify update .` al final.

## 8. Hecho cuando

- **B2:** el caso de referencia da 225,15 / 346,38 / 172 pliegos por herramientas de Capaz; desde la pantalla se arma un cuadro, se emite, se imprime sin costos, se acepta y llega a Pedidos; «Guardar referencias» crea la lista enlazada al producto y la cotización rápida la usa.
- **B3:** desde la ficha se genera el enlace, se abre en una ventana sin sesión, el cliente aprueba y en la bandeja aparece el borrador de pedido; un enlace revocado o vencido muestra el mismo aviso que uno inventado; Keny revisa la 0027 y el controlador público antes de producción.
