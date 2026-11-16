# Plan de integración de Cotizín y Tairos.RC («SF») dentro de Capaz ERP

**Fecha:** 2026-11-16 · **Estado: PROPUESTA.** Necesita las decisiones de la §7 antes de lanzar carriles. · **Para:** Moisés (dueño) y Keny (técnico) · **Autor:** arquitecto de integración. Este trabajo fue solo de análisis: no se tocó código, Neon ni migraciones.

**Qué reemplaza.** El orden y las fases de `INTEGRACION-DE-MODULOS.md` §4 (ya superados) y el «plan propio» de las fases 21 a 23 de `PLAN-DE-CONSTRUCCION.md` §7 (líneas 652 a 658). **Qué sigue vigente** de `INTEGRACION-DE-MODULOS.md`: «se copia, no se mueve». Cotizín y Tairos.RC siguen intactos durante el piloto.

**Rutas.** Para acortar, las rutas llevan un prefijo:

- `CAP/` = `/home/datayros/Documentos/work/modules/capaz-erp/`
- `COT/` = `/home/datayros/Documentos/work/referencias/cotizin-2026-11-14/`. Es la copia limpia, del mismo commit `63310f3` que el repositorio vivo, con sus cambios sin confirmar; ver `LEEME-COPIA.txt`.
- `SF/` = `/home/datayros/Documentos/work/modules/SF-registro-conversacional/` (Tairos.RC).

No se abrió ningún `.env` ni ninguna clave.

---

## 1. Resumen para el dueño

1. **Los dos productos encajan, cada uno a su manera.**
   - **Tairos.RC:** casi todo ya está en Capaz. Finanzas hace mejor la parte del dinero. Falta solo la **captura por voz y por texto**.
   - **Cotizín:** encaja como módulo «Cotizador». Pero hoy cubre **≈ 9 % de las ventas de Atlantisgraf**: el 61 % es troquelado y queda fuera de su alcance.
2. **La voz no es otro módulo de dinero.** Es una **capa de captura**: convierte lo dictado en **borradores** de las herramientas que Finanzas ya tiene. Tú lo apruebas en la misma pantalla (meta: 30 s) o después, en la bandeja.
3. **Capaz ya tiene casi todo lo que la voz necesita:** borradores con marca de «corregido», hora de inicio de la captura y origen «voz». Falta:
   - la pantalla de dictado;
   - el intérprete;
   - la medición.
4. **Recomiendo empezar la voz sin un modelo de IA de pago.** Se usaría el reconocimiento del navegador (el mismo de Tairos.RC) más el intérprete local de Tairos.RC, que tiene unas 176 pruebas. Si no llega al 70 %, se agrega el modelo con tu orden; ese modelo cobra por uso.
5. **Cotizador en dos cortes:**
   - **B1:** lista de precios 100 / 1.000 / 5.000, cotización rápida, imprimir, WhatsApp y «aceptada → pedido».
   - **B2:** cuadro de costos por partes, con pliegos y mermas. Solo si un piloto de tres trabajos **en Cotizín, tal como está hoy**, demuestra que lo usas.
6. **El motor de Cotizín se copia casi tal cual, con sus pruebas.** Deben salir los mismos números. Ejemplo: 2.500 volantes A5 dan costo S/ 225.15 y precio S/ 346.38.
7. **El puente casi existe ya:**
   - una cotización aceptada pasa a borrador de pedido;
   - el pedido se confirma con su adelanto;
   - queda la deuda por cobrar.

   Pedidos ya impide duplicar un pedido creado desde el mismo origen.
8. **Datos que se traen:**
   - De Tairos.RC, nada. Se empieza limpio, con un respaldo en Excel antes de apagarlo.
   - De Cotizín, solo los catálogos que confirmes como reales.
   - Clientes y productos, con el importador CSV que ya existe.
9. **Condición previa: Capaz desplegado con HTTPS** (tarea de Keny). Sin eso, el micrófono no funciona en el celular.
10. **Primera tanda: cuatro carriles en paralelo** (captura del núcleo, intérprete de Finanzas, motor del Cotizador y datos del Cotizador).
    - La voz queda usable en unas cuatro sesiones de agente.
    - El Cotizador B1 necesita unas seis más.

---

## 2. Qué hay hoy en cada producto (con evidencia)

### 2.1 Capaz: lo que ya existe y sirve a esta integración

| Pieza | Estado | Evidencia |
|---|---|---|
| Finanzas (`registro`), 23 herramientas: cuentas, categorías, movimientos, deudas, abonos, transferencias, caja del día y resumen | Integrado y probado. Incluye los casos de referencia a–h | `CAP/packages/shared/src/contratos/registro.ts:237-261` · `CAP/docs/FICHAS-OLA-2.md:358-366` · `CAP/apps/api/src/modules/registro/domain/casos-de-referencia.spec.ts` |
| El origen «voz» ya está previsto en los movimientos | Existe, sin uso | `CAP/packages/shared/src/contratos/registro.ts:12` |
| Bandeja de borradores. Guarda los `args` propuestos **y** los `argsOriginales`, la marca `corregido`, `capturaIniciadaEn` y los orígenes `voz` y `texto` | Existe | `CAP/packages/shared/src/contratos/borradores.ts:8,21,27,30` · `CAP/apps/api/src/core/borradores/proponer.ts:8-17,47-66` · `CAP/apps/api/src/core/borradores/repositorio.ts:81` (corregir marca `corregido`) |
| Formulario de corrección de la bandeja: genérico, un campo por argumento. Para un dictado mostraría identificadores en crudo | Existe; no sirve para voz tal cual | `CAP/apps/web/src/core/bandeja/formulario-correccion.tsx` |
| Pedidos (`ordenes`): IGV incluido (D17) y `pedido_crear` con `origenTipo`/`origenId` | Integrado | `CAP/packages/shared/src/contratos/ordenes.ts:37,57,161-173,212` |
| Pedidos rechaza un segundo pedido con el mismo origen. Es la base del puente idempotente | Integrado | `CAP/apps/api/drizzle/0016_ordenes.sql:81` · `CAP/apps/api/src/modules/ordenes/herramientas/pedidos-escritura.ts:59-62` |
| Proforma imprimible: un pedido en borrador con 7 días de vigencia, «mientras no llega el Cotizador» | Integrado | `CAP/apps/web/src/modules/ordenes/documentos.ts:9-11` · `CAP/docs/PROPUESTA-DE-MEJORAS.md:261,381` |
| Enlace de WhatsApp con mensaje | Integrado (en Pedidos) | `CAP/apps/web/src/modules/ordenes/documentos.ts:62-75` |
| Base de impresión: «Guardar como PDF» del navegador, con datos y logo de la empresa | Integrado | `CAP/apps/web/src/shared/impresion/` |
| Módulo `cotizador`: solo el manifiesto (familia ventas, orden 3, `enConstruccion: true`) y contratos vacíos | Reservado | `CAP/apps/api/src/modules/cotizador/cotizador.manifest.ts:3-20` · `CAP/packages/shared/src/contratos/cotizador.ts:3-4` |
| Productos del núcleo: un solo precio con IGV y la unidad en texto libre. Sin escalas por cantidad (B15 espera al Cotizador) | Integrado | `CAP/apps/api/src/db/esquema/core-maestros.ts:62-84` · `CAP/docs/PROPUESTA-DE-MEJORAS.md:210,386` |
| Importador CSV: solo `clientes` y `productos` | Integrado | `CAP/packages/shared/src/contratos/intercambio.ts:7` |
| Entrada pública que resuelve una clave con el grupo de sistema. Es el patrón para un futuro enlace público de la cotización | Integrado | `CAP/apps/api/src/core/conectores/entrada.controller.ts:24-30` |
| Tabla `core.uso` (uso y costo de la IA por empresa, con tope) | **No existe** | búsqueda sin resultados en `CAP/apps/api/src/db/esquema/` y en `drizzle/` |
| Dependencias de IA (`ai`, proveedor) y `big.js` | **No están** | búsqueda sin resultados en los `package.json` |
| Despliegue con HTTPS (X1) | **Pendiente.** Neon `production` tiene las migraciones hasta la 0022 y no tiene empresas ni usuarios | `CAP/docs/RELEVO.md:7` · `CAP/docs/NEON-MIGRACION.md:117` |

### 2.2 Tairos.RC («SF»)

**Qué es.** Un registro contable conversacional para imprentas.

- **Pila:** Next.js con Supabase. Solo soles (PEN), en céntimos.
- **Metas escritas:** menos de 10 s por registro y 90 % o más de acierto en el monto (`SF/BUSINESS_LOGIC.md:4,18-21,29`).
- **Documentación:** README, CLAUDE y GEMINI son de la plantilla de origen, no del producto (`SF/README.md:1-17`).
- **Último commit:** 2026-09-07.

**Dinero: 23 funciones SQL; 20 siguen vivas.** La migración 017 elimina tres funciones de la papelera (`SF/supabase/migrations/017_papelera_no_destruye.sql:39-40,77`).

| Grupo | Funciones | Evidencia |
|---|---|---|
| Movimientos | `editar_transaccion` (no deja bajar el monto por debajo de lo cobrado), `anular_transaccion` (con pagos previos pide «devuelto» o «retenido»), `reactivar_transaccion`, `borrar_transaccion` y `restaurar_transaccion` (papelera), `abonado_de_transaccion` | `010_editar_transaccion.sql:34,57,114` · `015_anular_movimiento.sql:44,167` · `016_papelera.sql:84,133` |
| Abonos | `registrar_abono` (valida el saldo; `security definer`) | `001_tairos_core.sql:91` |
| Proformas | `crear_proforma`, `editar_proforma`, `convertir_proforma_en_orden` (precios en milésimas de sol, IGV sobre el total) | `005_proformas_y_categorias.sql:168,236,290` · `007_editar_proforma.sql:39` |
| Órdenes de trabajo | `crear_orden_trabajo`, `editar_orden_trabajo`, `cambiar_estado_orden`, `cobrar_orden_trabajo`, `subtotal_linea_centimos` (redondeo de `cantidad × milésimas / 10`) | `012_orden_registra_el_ingreso.sql:51,253,361` · `014_adelanto_al_cancelar.sql:47` · `009_ordenes_trabajo.sql:166-174` |
| Contactos y apoyo | `fusionar_contactos`, `unaccent_simple`, `categorias_validas`, `set_updated_at`, `handle_new_user` | `008_contactos_similares.sql:122` · `005:24,275` · `001:5` · `002_profiles.sql:24` |

**Datos.**

- Tablas: `contactos`, `transacciones` (ingreso o egreso; estado activa o anulada; papelera), `abonos`, `proformas` con líneas y `ordenes_trabajo` con líneas.
- Vista `v_saldos`: el saldo es monto − abonos.
- RLS **por usuario**, no por empresa (`001:16-88,148-165`).
- **No hay cuentas de caja ni de banco ni tabla de borradores:** el borrador vive en la pantalla.

**Flujo conversacional.**

1. Voz con la Web Speech API del navegador. El hook `useSpeechRecognition` (289 líneas, solo importa React) está configurado así:
   - idioma `es-PE`;
   - continuo en escritorio y por sesiones en Android;
   - exige contexto seguro (HTTPS);
   - recorta el texto a 400 caracteres.

   Evidencia: `SF/src/shared/hooks/useSpeechRecognition.ts:109,130,205-210`.
2. `POST /api/extract` (`SF/src/features/chat/components/ChatPage.tsx:462`).
3. `generateObject` del AI SDK con OpenRouter y un modelo pequeño (`SF/src/shared/lib/openrouter.ts:7` · `SF/src/app/api/extract/route.ts:75-107`).
   - Si el modelo falla, entra el respaldo local: `normalizeMontoToCentimos` y `enrichExtraction` (`route.ts:110-139`).
   - **No resuelve fechas relativas:** la fecha es la de hoy en Lima.
4. Tarjeta `ConfirmCard` editable.
5. `POST /api/transaccion` (`ChatPage.tsx:606-627`).

**Pantallas útiles.** Chat con micrófono, movimientos, deudas, contactos (con fusión), órdenes, proformas, papelera, clasificar, ajustes y exportar a Excel.

**Pruebas.**

- 52 archivos de Vitest, unos 918 casos.
- 10 archivos SQL, unas 249 aserciones.
- 16 pruebas e2e que **no se traen** (regla 8).
- **El intérprete local es lógica pura y portable:** `SF/src/features/extract/lib/*` (2.674 líneas con sus pruebas, sin Next ni Supabase), más `SF/src/shared/lib/{numeros-en-palabras,vocabulario-imprenta,similitud-nombres,categorias}.ts`.
- Bloques de prueba de ese intérprete: `normalize-monto` 42 · `infer-categoria` 27 · `enrich-extraction` 26 · `infer-descripcion` 23 · `detect-proforma` 14 · `detect-abono` 7 · `similitud-nombres` 32 · `numeros-en-palabras` 5. **Unos 176.**

**Uso real.**

- No hay métricas de acierto ni de tiempo; las metas solo están escritas.
- Hay evidencia indirecta de datos reales en la base del dueño:
  - «86 contactos para 108 movimientos» (`008_contactos_similares.sql:4-5`);
  - «108 movimientos en dos meses» (`017:6-7`);
  - duplicados reales como «Wilfredo / Wilfredo Ica» (`008:6-11`).
- El usuario decidió que esos datos son de prueba y que **se empieza limpio** (`CAP/docs/FINALIDAD-Y-OBJETIVOS-ERP.md:85`).

**Fallos de integridad que Capaz ya no repite.**

- `/api/abono` lee el saldo y luego inserta, sin bloqueo, así que dos abonos simultáneos pueden cobrar de más (`SF/src/app/api/abono/route.ts:34,56`; `006:21`: «registrar_abono no se llama desde ningún sitio»).
- Cada intento de confirmar genera un `client_request_id` nuevo, así que un reintento puede duplicar el registro (`ChatPage.tsx:627`).

Capaz bloquea la deuda antes de abonar (`CAP/docs/FICHAS-OLA-2.md:349`) y usa `Idempotency-Key`.

**Trabajo previo que queda superado.** En la copia de Cotizín hay un porte de 19 funciones de Tairos.RC a SQL, con equivalencia y ocho desviaciones corregidas (`COT/docs/REGISTRO-FUNCIONES-PORTADAS.md`, `COT/drizzle/0019_registro_funciones.sql`). Capaz reescribió Finanzas en TypeScript con casos de referencia (decisión D15, ADR-016), así que **se descarta**. Sirve solo como lista de fallos ya conocidos.

**No verificado.**

- No se ejecutó ninguna prueba; los conteos son estáticos.
- No se consultó la base real.
- La frase «nivel aceptable, no automatizado» no aparece en el repositorio de SF; está en `CAP/docs/FINALIDAD-Y-OBJETIVOS-ERP.md:15`.

### 2.3 Cotizín

**Qué es.** Un cotizador multiempresa para gráficas (hoja cortada y offset), con dos caminos (`COT/BUSINESS_LOGIC.md:5-21,91-97` · `COT/docs/ESTADO-DEL-PROYECTO.md:21-23`):

- **Por partes:** un cuadro de costos de tres columnas (100 / 1.000 / 5.000) con imposición y mermas.
- **Rápida:** una lista de precios con tres referencias por producto y una curva entre ellas.

Las versiones emitidas son inmutables. El PDF no muestra costos ni margen. Tiene enlace público con aprobar o rechazar, y WhatsApp.

**Qué calcula: motor puro, sin Next ni Neon.** Unas 1.300 líneas y unos 207 bloques de prueba.

| Motor | Qué hace | Evidencia |
|---|---|---|
| Costeo por factores | Seis factores: material, placa, impresión, diseño, acabado y otros. Precio = costo / (1 − margen), o costo × (1 + recargo) | `COT/src/features/cotizacion/services/calcular-cotizacion.ts` (151 líneas, 24 pruebas) |
| Imposición | Poses en dos orientaciones con sangrado, calle y pinza; pliego madre → pliego de máquina; formato máximo por máquina | `…/services/imposicion.ts` (191 líneas, 31 pruebas) |
| Mermas | Arranque fijo más un %, por etapa y hacia atrás | `…/services/mermas.ts` (57 líneas, 15 pruebas) |
| Cuadro directo (PRP-007, el camino principal hoy) | Tres columnas. Lo escrito a mano manda. Lo demás se deduce: impresión por millares, placa y diseño fijos, material con −2 % en 5.000 y el resto proporcional. Utilidad por columna, IGV y coherencia entre cantidades | `…/services/cuadro-directo.ts:21-29,207,244` (254 líneas, 23 pruebas) · `…/constants/deduccion.ts:8,11` |
| Escalar el cuadro y generar referencias | Corre el cuadro a 100, 1.000 y 5.000 | `…/services/escalar-cuadro.ts` · `generar-referencias.ts` |
| Precio por escala | Curva log-log por tramos, escalón, precio mínimo y «cotizar aparte» fuera de 100–5.000. Invariante B: el total siempre crece; bloquea | `COT/src/features/precio-por-escala/services/precio-por-escala.ts` · `validar-referencias.ts` |
| Precio rápido | Lista → ajuste del cliente → redondeo comercial (1, 5 o 10, hacia arriba) → ajuste de la cotización | `…/precio-por-escala/services/precio-rapido.ts:11-32` |
| Semáforo de margen | Verde a partir de 30 %, mínimo 15 % (semilla `es-PE`) | `…/services/semaforo.ts` · `COT/src/lib/semillas/es-PE.ts:22-23` |
| Dinero | `big.js` con `roundHalfUp` y modo estricto (rechaza `number`). Importes con 2 decimales, unitarios con 4 y cantidades con 3 | `COT/src/shared/utils/dinero.ts:4-17` · `impuesto.ts` (IGV aparte: el precio va sin IGV) |

**Herramientas: 41 en total, no «92».** `INTEGRACION-DE-MODULOS.md` §2 contaba nombres de campos.

- 31 de cotización (`COT/src/features/cotizacion/herramientas/registro.ts:32-69`).
- 5 de empresa (`COT/src/features/empresa/herramientas/registro.ts:9-15`).
- 4 de entrega: `consultar_estado`, `anular_cotizacion`, `generar_enlace` y `revocar_enlace`.
- `consultar_ayuda`.
- Son críticas: `emitir`, `guardar_referencias`, `ajustar_precios_en_bloque` y `generar_enlace` (`comandos/emitir.ts:68-69`, etc.).

La capa genérica (registro, `ejecutar`, confirmación HMAC con huella, auditoría) **ya está portada** en `CAP/apps/api/src/core/herramientas`.

**Tablas** (`COT/src/shared/db/esquema/`):

- `configuracion_empresa`: utilidad, umbrales, redondeo, condiciones, mensaje de WhatsApp, impuesto y unidades.
- `formatos_pliego`, `maquinas`, `insumos_tarifas` e `items_del_cuadro`.
- `variantes_precio`: `p100`, `p1000`, `p5000`, modo intermedio y mínimo.
- `cotizaciones` y `cotizacion_versiones`: `entrada` y `resultado` en JSONB; inmutables al emitir mediante un disparador.
- `cotizacion_eventos` (solo inserción), `enlaces_cotizacion` (con una función `security definer`), `clientes` (con ajuste porcentual) y `contadores`.

Evidencia: `cotizacion.ts:31-158`, `empresa.ts:28-125` y `variantes.ts:11-24`.

**Pantallas.** `/cotizacion-rapida`, `/cotizar/[id]` (el cuadro), `/cotizaciones` (historial), `/precios`, `/clientes` y `/configuracion`, más la página pública `/c/[token]` con su PDF (`COT/src/app/`). Son 68 componentes `.tsx` en Next, Zustand y Tailwind 3. **Se rehacen** con el kit de Capaz.

**Qué depende de Next o de Neon.** 41 archivos de `features/` y `shared/`. Los motores (`services/`) no importan nada de eso: se comprobó buscando importaciones de `next`, `drizzle`, `neon`, `react` y `zustand`.

**Estado.**

- 979 pruebas unitarias y 164 de base de datos en verde al 2026-10-04 (`ESTADO-DEL-PROYECTO.md:7`).
- **El piloto en Atlantisgraf nunca se ejecutó** (`COT/docs/piloto/README.md:3`).
- **La voz no está construida.** El PRP-004 está aprobado, pero falta su fase 0 (`ESTADO-DEL-PROYECTO.md:116`), y no hay código de reconocimiento ni de IA en `src/`.
- Desde Lima, cada llamada tarda ≈ 3,3 s contra Neon `us-east-2` (`:93`).

**Alcance frente al negocio real.**

- La V1 cubre ≈ 9 % de las ventas de Atlantisgraf (`ESTADO-DEL-PROYECTO.md:201`).
- Troquel más troquelado suman el **61 %**, y se cotizan **por pieza** (`COT/docs/rescate/lista-de-productos-atlantisgraf.md:10-11,57`).
- 14 productos de gran formato **por m²** quedaron fuera del modelo (`COT/docs/precios-referenciales/productos-terminados.md:13`).

**Datos de catálogo.**

- 139 insumos y 236 variantes de precio cargados en la empresa de prueba «Empresa01» de Neon (`ESTADO-DEL-PROYECTO.md:17`).
- Las variantes salen de **precios de mercado, no de tarifas de Atlantisgraf**. Los puntos 100 / 1.000 / 5.000 están estimados con la curva (`productos-terminados.md:3-14`).

**No verificado.**

- No se ejecutaron pruebas.
- No se leyó la base de Cotizín en Neon (catálogos ni clientes).
- El repositorio vivo tiene 98 cambios sin confirmar. Son iguales a la copia según su `LEEME`, pero no se volvió a comparar.

---

## 3. Mapa de encaje

### 3.1 Tairos.RC frente a Capaz

Leyenda: **Cubre** = Capaz ya lo hace (no duplicar) · **En parte** · **No existe**. Destino: **Reutilizar** (se copia la lógica o las pruebas) · **Reescribir** · **Descartar**.

| Capacidad de Tairos.RC | En Capaz | Encaje | Qué se hace |
|---|---|---|---|
| Ingreso o egreso simple | `movimiento_registrar` | Cubre | Nada |
| Venta o compra a crédito (monto mayor que lo cobrado) | `deuda_crear` por cobrar o por pagar | Cubre (modelo mejor: la deuda es aparte) | Nada |
| Venta a crédito con adelanto en un solo registro | `deuda_crear` + `deuda_abonar` (dos pasos) | En parte | Herramienta nueva y aditiva `deuda_crear_con_adelanto` en `registro`, para que un dictado sea un solo borrador (§4.1) |
| Abono a una deuda | `deuda_abonar` (con bloqueo e idempotencia) | Cubre | Nada |
| Saldos, «quién me debe» | `deudas_listar`, estado de cuenta del cliente | Cubre | La consulta hablada es un agente de solo lectura, después (ARQUITECTURA-DE-IA §3, paso 4) |
| Editar un movimiento | Los movimientos son inmutables: se anula y se rehace | Diferente a propósito | Descartar |
| Anular con «devuelto» o «retenido» | `deuda_anular` exige anular antes los abonos (D16) | Diferente a propósito | Descartar |
| Reactivar, papelera, borrar | Se anula; nunca se borra | — | Descartar |
| Contactos y fusión de duplicados | `core.clientes`; la fusión (B6) está pendiente | En parte | Reutilizar `similitud-nombres.ts` para **resolver** el contacto al dictar. La fusión queda en B6 |
| Las 16 categorías del rubro (catálogo cerrado) | `registro.categorias` por empresa; 8 genéricas por defecto | En parte | El intérprete lleva sinónimos de las 16 hacia las 8 de Capaz. Las categorías finas son decisión del dueño (§7, D-I9) |
| Categorización automática (palabras clave + historial) | No existe | No existe | **Reutilizar** `infer-categoria.ts` y `sugerirPorHistorial` |
| Clasificar después (cambiar la categoría) | No existe (movimientos inmutables) | No existe | Después y opcional: `movimiento_recategorizar` |
| Proformas | Proforma = pedido en borrador imprimible; más adelante, la cotización | Cubre | Descartar |
| Órdenes de trabajo con estados | Pedidos (borrador → confirmado → en proceso → listo → entregado) | Cubre | Descartar |
| Cobrar el saldo de una orden | F3 (`pedido.entregado` → propone el abono): pendiente | En parte | Fuera de este plan (`FLUJO-ENTRE-MODULOS.md` F3) |
| Recibos | Recibo del abono (R1) | Cubre | Nada |
| Exportar a Excel | `reportes_exportar_csv` | Cubre | Nada |
| Datos de la imprenta (RUC, etc.) | Datos de la empresa (B2) | Cubre | Nada |
| Cuentas de caja y banco | Capaz las tiene; Tairos.RC no | Capaz es mejor | — |
| **Voz** (Web Speech, `es-PE`) | No existe | No existe | **Reutilizar** el hook detrás de una interfaz (§4.1) |
| **Texto libre → datos** (montos en palabras, el pronombre que invierte el verbo, abono, adelanto) | No existe | No existe | **Reutilizar** el intérprete local con sus unas 176 pruebas |
| Extracción con modelo (AI SDK) | No existe | No existe | **Reescribir** como adaptador del núcleo (fase A2, con orden del dueño) |
| Confirmar en el momento (tarjeta) | Bandeja (aprobar después) | En parte | La pantalla de dictado muestra el borrador y deja **aprobar ahí mismo**: lo exige la meta de 30 s |
| Soles | Solo soles | Cubre | Otras monedas: fuera (FINALIDAD §7) |

**Idea central: la captura es una capa, no un módulo.**

```
celular: micrófono (Web Speech) ── texto ──► captura_proponer (núcleo)
                                               │  elige el intérprete del módulo (hoy: registro)
                                               ▼
                         intérprete de Finanzas: monto, tipo, contacto, categoría, abono o adelanto
                                               │  (A1: reglas locales de Tairos.RC · A2: modelo + reglas de respaldo)
                                               ▼
              proponerBorrador(movimiento_registrar | deuda_abonar | deuda_crear | deuda_crear_con_adelanto)
                                               ▼
             tarjeta en la misma pantalla: Aprobar · Corregir · Después (bandeja) ──► la herramienta de siempre
```

El mismo contrato sirve después para dictar pedidos o cotizaciones (otro intérprete) y para WhatsApp (otro canal, por el conector de entrada).

### 3.2 Cotizín frente a Capaz

| Capacidad de Cotizín | En Capaz | Encaje | Qué se hace |
|---|---|---|---|
| Motores (costeo, imposición, mermas, cuadro directo, escalado, precio por escala, precio rápido, semáforo) | No existen | No existe | **Reutilizar casi tal cual**, con sus pruebas como equivalencia, en `modules/cotizador/domain/motor/` |
| Registro de herramientas, `ejecutar`, confirmación en dos pasos, auditoría | `core/herramientas` | Cubre | Descartar lo de Cotizín |
| Better Auth, organizaciones, RLS, `conEmpresa`, correlativos | Núcleo | Cubre | Descartar |
| Clientes (tabla propia con teléfono) | `core.clientes` | Cubre | Descartar la tabla. El **ajuste % por cliente** sí va al Cotizador |
| Lista de precios (tres referencias por producto) | `core.productos` tiene un solo precio | En parte | Tabla `cotizador.listas_de_precio` ligada a `core.productos` (llave compuesta hacia el núcleo, R6) |
| Tarifas de insumos, formatos de pliego, máquinas, ítems del cuadro | `insumos.articulos` es inventario, no costeo | No existe | Tablas propias del Cotizador (B2). Enlazarlas al inventario, después |
| Configuración (utilidad, semáforo, redondeo, condiciones, mensaje) | Datos de empresa B2; IGV por pedido (18 %) | En parte | `cotizador.configuracion` |
| Versiones inmutables y eventos de estado | No existen | No existe | **Reescribir** (tablas, disparador y herramientas) |
| PDF con `@react-pdf/renderer` | Base de impresión del navegador | En parte | Reescribir sobre la base de impresión. **Sin** dependencia nueva |
| Enlace público con aprobar o rechazar (función `security definer`) | La regla 18 prohíbe ese patrón | No existe | Reescribir con el grupo de sistema y una política explícita (B3, después, con revisión de seguridad) |
| WhatsApp | El patrón de Pedidos (`documentos.ts:62-75`) | Cubre | Reutilizar el patrón |
| Historial y «Volver a cotizar» | No existen | No existe | Reescribir (B1) |
| Ajuste de precios en bloque | No existe | No existe | B1+ (después) |
| Proforma → pedido | La proforma de Pedidos es temporal | En parte | La cotización pasa a ser el primer documento de la venta. La proforma de Pedidos se queda para el pedido sin cotización |
| Unidades del rubro (millar, pliego, m²) | Unidad en texto; B12 (conversión) pendiente | En parte | Lista fija de unidades sugeridas en el contrato del Cotizador. La conversión es B12 |
| Precio por m² (gran formato) | No existe ni en Cotizín | No existe | Diseño nuevo y opcional (B1+), no es un porte |
| Pantallas (Next, Zustand, Tailwind 3) | — | — | Reescribir con el kit (`shared/ui`), React Router y react-query. Se conservan textos e ideas, que son del dueño |
| Pruebas e2e (Playwright) | Prohibidas (regla 8) | — | Descartar |
| Porte del Registro dentro de Cotizín (`features/registro`, 0016–0020, `scripts/migracion-sf/`) | Superado por `registro` | — | Descartar |

**El Cotizador alimenta a Pedidos.** No se importa nada entre módulos:

1. La persona marca la cotización como aceptada.
2. El Cotizador emite el evento `cotizacion.aceptada`, que lleva las líneas.
3. Un consumidor de `ordenes` **propone** el borrador de `pedido_crear` con `origenTipo: 'cotizacion'`.
4. La persona lo aprueba.
5. «Confirmar y cobrar adelanto».
6. `registro` propone la deuda (ya existe).

Si se aprueba dos veces, el índice único de origen lo rechaza (`0016_ordenes.sql:81`).

---

## 4. Propuesta de integración por fases con carriles

**Principios.**

- Método de `PLAN-PARALELO.md`:
  - propiedad exclusiva de archivos;
  - un solo carril escribe migraciones;
  - contratos congelados al integrar;
  - un máximo de 13 herramientas por sesión (R15);
  - cuatro carriles abiertos como máximo.
- Antes de lanzar, el arquitecto escribe `docs/FICHAS-OLA-4.md` con los contratos y las tablas columna por columna, a partir de esta sección. Es una sola sesión y solo de documentos.

### 4.1 Fase A · Captura por voz y por texto sobre `registro`

**A1 · Sin modelo de pago.** Recomendado como primer corte.

**Contrato del núcleo.** Propuesta; la congela `FICHAS-OLA-4.md`. Va en `packages/shared/src/contratos/captura.ts`:

```ts
export const CANALES_DE_CAPTURA = ['voz', 'texto'] as const;          // 'whatsapp', después
captura_proponer: contrato(
  z.strictObject({
    texto: z.string().trim().min(1).max(500),                         // Tairos recorta a 400 y acepta hasta 500
    canal: z.enum(CANALES_DE_CAPTURA),
    capturaIniciadaEn: z.iso.datetime(),                              // al tocar el micrófono; no futura ni de hace más de 15 min
    modulo: z.enum(['registro']).default('registro'),                 // crece con cada intérprete
    modo: z.enum(['ingreso', 'egreso']).optional(),                   // el botón que tocó la persona (Tairos: ChatPage.tsx:462)
  }),
  z.strictObject({
    borradores: z.array(z.strictObject({ id: z.string(), herramienta: z.string(), resumen: z.string(), args: z.unknown() })),
    faltan: z.array(z.string()),                                      // «el monto», «si entró o salió», «cliente nuevo: Cristina»
    pista: z.string().nullable(),                                     // la ayuda de incomplete-input-hint de Tairos
    interpretadoCon: z.enum(['reglas', 'modelo']),
  }),
),
borradores_metricas: contrato(
  z.strictObject({ desde: dia, hasta: dia, origen: z.enum(['voz', 'texto']).optional() }),
  z.strictObject({ propuestos, aprobadosSinCorregir, aprobadosCorregidos, descartados, pendientes, pctSinCorregir, medianaSegundosHastaResolver }),
),
```

**`captura_proponer`:**

- `modulo: 'core'`, criticidad normal e idempotente (`Idempotency-Key`). Así un reintento no duplica, que es justo el fallo de Tairos.RC.
- No mueve dinero: solo propone.
- **Comprueba dentro** que la persona tiene el permiso de escritura del módulo destino (`registro:editar`) y que el módulo está vigente. El núcleo está eximido de `puedeEscribir` (`RELEVO.md:13`, punto 2), y no debe proponer borradores que su autor no podrá aprobar.

**Registro de intérpretes en el núcleo** (`core/captura/`), con el mismo patrón que los consumidores:

```ts
export type InterpreteDeCaptura = {
  modulo: string;
  interpretar(tx: Transaccion, ctx: ContextoDeHerramienta, e: { texto: string; modo?: 'ingreso' | 'egreso'; extraccion?: unknown }):
    Promise<{ propuestas: Array<Pick<PropuestaDeBorrador, 'herramienta' | 'args' | 'resumen'>>; faltan: string[]; pista: string | null }>;
  esquemaParaModelo?: z.ZodType; instrucciones?: string;   // solo A2
};
export interface ModeloDeLenguaje { extraer(esquema: z.ZodType, instrucciones: string, texto: string): Promise<unknown | null> } // A1: implementación nula
```

**Intérprete de Finanzas** (`modules/registro/dictado/`). Hace dos cosas:

- Porta tal cual las reglas de Tairos.RC: montos, números en palabras, vocabulario de imprenta, detección de abono, categoría y descripción.
- Resuelve los nombres a identificadores **leyendo sus propias tablas y `core.clientes`**.

| Dictado (ejemplos tomados de las pruebas de Tairos.RC) | Intención | Borrador propuesto |
|---|---|---|
| «Ingreso 500 soles, cliente Juan, flyers» | Ingreso | `movimiento_registrar { tipo: 'ingreso', montoCentimos: 50000, contactoId: Juan si existe, categoriaId, descripcion: 'flyers', origen: 'voz' }` |
| «le compré a Pacheco unas cartulinas… 350 soles» | Egreso | `movimiento_registrar { tipo: 'egreso', montoCentimos: 35000, contactoId: Pacheco, categoría «Compras» }` |
| «Juan me abonó 100» | Abono | `deuda_abonar { id: la deuda abierta más antigua por cobrar de Juan, montoCentimos: 10000 }`. Si hay varias, `faltan` dice cuál |
| «Contrato 240, adelanto 100, cliente Cristina» | Venta con adelanto | `deuda_crear_con_adelanto { tipo: 'por_cobrar', totalCentimos: 24000, adelantoCentimos: 10000, contactoId }` (herramienta nueva) |
| «le debo a Pacheco 500 de papel» | Deuda por pagar | `deuda_crear { tipo: 'por_pagar', totalCentimos: 50000 }` |
| Contacto que no existe | — | Un movimiento lo deja vacío y guarda el nombre en la descripción. Una deuda devuelve `faltan: ['cliente nuevo: «X»']` y la pantalla ofrece «Crear cliente y seguir» (`clientes_crear`) |
| «/proforma…», órdenes | — | No entra en A1: `pista` lo manda a Pedidos |

**Herramienta nueva en `registro`:** `deuda_crear_con_adelanto`.

- Es aditiva: no cambia ningún contrato integrado.
- `mueveDinero`, idempotente, permiso `registro:editar`.
- Crea la deuda y el abono en **una** transacción.
- Emite `deuda.creada`, `movimiento.registrado` y `deuda.abonada`.

**Pantalla de dictado** (`apps/web/src/core/captura/`):

- El hook de Tairos.RC va detrás de la interfaz `ReconocedorDeVoz { iniciar, detener, estado, texto }`. La implementación es `ReconocedorWebSpeech`; otro proveedor se cambia sin tocar la pantalla.
- La pantalla tiene:
  - un botón grande de micrófono;
  - el texto editable;
  - los botones «Ingreso» y «Egreso»;
  - el envío.
- Por cada borrador muestra una **tarjeta propia de Finanzas** (no el formulario genérico, que mostraría identificadores), con selectores de contacto, categoría y cuenta. Las acciones son:
  - **«Aprobar»** (`borrador_aprobar`);
  - **«Corregir y aprobar»** (`borrador_corregir` y luego `borrador_aprobar`; así queda marcado `corregido`);
  - **«Después»** (se queda en la bandeja).
- Sin contexto seguro, muestra el aviso de Tairos.RC («hace falta HTTPS»).
- Ofrece siempre el **texto** como respaldo.

**Medición.** Todo sale de `core.borradores` y no hace falta ninguna tabla nueva:

- **% sin corregir** = aprobados con `corregido = false` / (aprobados + descartados), con origen `voz`.
- **Tiempo** = `capturaIniciadaEn` → `resueltoEn`, en los aprobados en la misma sesión.

`borradores_metricas` lo entrega, y una tarjeta en Inicio o en Reportes lo muestra.

**A2 · Con modelo. Solo si A1 no llega a la meta y con orden del dueño (regla 14).**

- Un adaptador `ModeloDeLenguaje` en `infra/ia/` con AI SDK y el proveedor que se elija.
- `esquemaParaModelo` del intérprete: se porta `SF/src/features/extract/schemas/extraction-schema.ts`.
- Las reglas locales siguen como respaldo, igual que en `SF/src/app/api/extract/route.ts:110-139`.
- Una tabla `core.uso` (empresa, día, llamadas, unidades, costo estimado, tope mensual): **lleva migración**.
- Al llegar al tope, la captura sigue funcionando con las reglas locales.
- **Qué necesita, sin configurar nada aquí:**
  - aprobar las dependencias (`ai` y el paquete del proveedor);
  - cuenta y clave del proveedor (las guarda Keny en el `.env` del host);
  - un tope de gasto mensual;
  - aceptar que el texto dictado sale hacia ese proveedor.
- **Reconocimiento en el servidor** (Whisper u otro), solo si la pista V lo justifica: otra implementación de `ReconocedorDeVoz` que graba y sube el audio, y lo descarta después de transcribirlo (ARQUITECTURA-DE-IA §4).

**Cómo se mide sin gastar.** El intérprete (reglas o modelo) se mide **fuera de línea** con las transcripciones correctas de la pista V (30 a 50 dictados reales con sus datos esperados): acierto en monto, tipo, contacto y categoría. El reconocimiento del navegador se mide **en vivo** durante el piloto, o reproduciendo los audios frente al celular. Así, A1 frente a A2 se decide con datos y sin pagar primero.

### 4.2 Fase B · Cotizador

**B1: lista de precios, cotización rápida y puente.** Es el corte de más valor por esfuerzo.

**Tablas.** Esquema `cotizador`, **una sola migración**: `0023_cotizador`, que escribe el carril DB5. Cada tabla lleva:

- `tenant_id`;
- `core.aplicar_aislamiento`;
- el disparador `core.exigir_modulo_en_escritura('cotizador')`;
- llaves compuestas hacia `core.clientes` y `core.productos`;
- índices que empiezan por `tenant_id`.

| Tabla | Columnas clave | Corte |
|---|---|---|
| `configuracion` (una fila por empresa) | `utilidad_pct` y `utilidad_base` (venta o costo), umbrales verde y mínimo, `redondeo_comercial` (ninguno, 1, 5, 10), `igv_pct` (18), `condiciones` en JSONB, `mensaje_whatsapp`, `unidades` (unidad, ciento, millar, pliego, m², hora, juego, talonario) | B1 |
| `listas_de_precio` | `producto_id` (hacia `core.productos`, opcional), `nombre`, `p100_centimos`, `p1000_centimos`, `p5000_centimos`, `modo_intermedio` (curva o escalón), `precio_minimo_centimos`, `origen_version_id`, `a_confirmado`, `archivado_en`, `actualizado_en` | B1 |
| `ajustes_de_cliente` | `cliente_id` (hacia `core.clientes`), `porcentaje` | B1 |
| `cotizaciones` | `numero` y `anio` (correlativo `cotizador.cotizacion`), `cliente_id`, foto de `cliente_nombre`, `estado` (borrador, emitida, enviada, aceptada, rechazada, anulada), `version_actual`, `creado_por` | B1 |
| `versiones` | `cotizacion_id` (llave compuesta), `version`, `modo` (rápida o cuadro), `entrada` y `resultado` en JSONB, `subtotal_centimos`, `igv_centimos`, `total_centimos`, `costo_centimos` (solo se muestra con `cotizador:costos`), `margen_pct`, `motivo_margen_bajo`, `emitida_en`. **Disparador: inmutable una vez emitida** | B1 |
| `version_lineas` | Descripción, unidad, `cantidad_milesimas`, `precio_unitario_milesimas` (sin IGV), `importe_centimos`, `producto_id`, `lista_id`, opción (100, 1.000 o 5.000) | B1 |
| `eventos` (solo inserción) | Emitida, enviada, aceptada, rechazada, anulada, `usuario_id`, `motivo` | B1 |
| `tarifas`, `formatos_pliego`, `maquinas`, `items_del_cuadro` | Las columnas de Cotizín (`empresa.ts:60-125`, `items-del-cuadro.ts`) | B2: van en la misma migración si D-I2 lo aprueba, para pasar por Neon una sola vez |

**Lo que sale del módulo, en céntimos enteros:** precio, IGV y total. **Lo que se queda dentro del motor:**

- costos unitarios con 4 decimales;
- medidas en centímetros;
- porcentajes.

Esos valores viajan como texto en JSONB o como `numeric` y se calculan con `big.js`, con un solo adaptador a céntimos. Es la desviación de la regla 9 ya prevista en D12 (`PLAN-DE-CONSTRUCCION.md:657,760`). El enlace público (`enlaces`) **no** entra en la 0023 (B3).

**Herramientas B1.** Nombres propios de Capaz (`entidad_accion`), repartidos en dos sesiones por la regla R15:

- **s1 · Precios y configuración (9):**
  - `cotizador_iniciar`;
  - `cotizador_configurar`;
  - `listas_precio_listar`;
  - `lista_precio_ver`;
  - `lista_precio_crear`;
  - `lista_precio_editar` (crítica, valida el invariante B);
  - `lista_precio_archivar`;
  - `precio_consultar` (lectura; lo que hace la «rápida»);
  - `ajuste_cliente_fijar`.
- **s2 · Cotizaciones (12):**
  - `cotizacion_crear`, desde la lista o con líneas a mano;
  - `cotizacion_editar` y `cotizacion_ver`;
  - `cotizaciones_listar`;
  - `cotizacion_emitir` (crítica; pide motivo si el margen está en rojo);
  - `cotizacion_nueva_version`;
  - `cotizacion_duplicar`;
  - `cotizacion_marcar_enviada`;
  - `cotizacion_aceptar`, con la opción elegida;
  - `cotizacion_rechazar`;
  - `cotizacion_anular` (crítica);
  - `cotizador_resumen`.
- **Permisos:** los cuatro del manifiesto, más `cotizador:configurar` para la lista y la configuración.

**Eventos** (`eventosDeCotizador`):

- `cotizacion.emitida`;
- `cotizacion.aceptada`: `{ id, codigo, version, clienteId, igvPorcentaje, totalCentimos, lineas: [{ productoId, descripcion, unidad, cantidadMilesimas, precioUnitarioMilesimas, afectoIgv }] }`, con los precios ya **con IGV** para Pedidos;
- `cotizacion.rechazada`;
- `cotizacion.anulada`.

**Conversión al pedido.**

- Una línea por opción aceptada: cantidad 1, unidad «lote», descripción con la cantidad («2.500 volantes A5 4/4 couché 150 g») y precio = **total con IGV**.
- Así el importe es exacto y el pedido conserva, céntimo a céntimo, la base y el IGV de la cotización. La demostración y el caso están en la §6.3.

**Pantallas B1** (`apps/web/src/modules/cotizador/`, rutas `m/cotizador/…`):

- `rapida`: buscador de productos con sus tres precios, cantidad y precio con IGV, y «Crear cotización».
- `cotizaciones`: lista con estados.
- `cotizaciones/:id`: líneas, cliente, condiciones, emitir, imprimir, WhatsApp, aceptada o rechazada y nueva versión.
- `precios`: lista, ficha, nuevo y archivar. Marca «Revisar» cuando la referencia tiene más de 90 días.
- `ajustes`.

El documento «Cotización» se imprime con la base de impresión, **sin costos ni margen**.

**B2: cuadro de costos por partes.** Condicionado al piloto (§7, D-I2).

- **s3:** tarifas, formatos, máquinas e ítems.
- **s4:** el cuadro. Herramientas equivalentes a `fijar_trabajo`, `fijar_imposicion`, `agregar/editar/quitar_linea`, `fijar_costo_directo`, ítems, `fijar_utilidad`, `fijar_precio_final`, `fijar_columnas_a_enviar`, `calcular`, `generar_referencias` y `guardar_referencias`, más el caso de referencia armado **solo con herramientas** (`COT/src/features/cotizacion/testing/armar-caso-de-referencia.ts`).
- **w2:** la pantalla del cuadro (tres columnas desde 1.280 px; una a la vez en el celular) y los ajustes del taller.

No repetir los fallos ya conocidos de Cotizín (`ESTADO-DEL-PROYECTO.md:163-180`):

- catálogos que se guardan con la lista completa, en lugar de fila por fila;
- borrador sin versión esperada, en lugar de usar huella.

**B3: enlace público con aprobar o rechazar.** Después, si se decide.

- Tabla `cotizador.enlaces` (con el hash del token) y una política explícita para `capaz_sistema`, con el mismo patrón que la entrada de conectores.
- Ruta pública sin JavaScript.
- **Lleva migración y revisión de seguridad de Keny.**

### 4.3 Fase C · Puente cotización → pedido

- Consumidor `ordenes_cotizacion_aceptada` en el archivo nuevo `CAP/apps/api/src/modules/ordenes/consumidores.ts`, que hoy no existe.
- Regla R5: solo lee sus tablas y `proponerBorrador('pedido_crear', { clienteId, lineas, notas: 'Cotización COT-… v…', origenTipo: 'cotizacion', origenId })`.
- Si ya hay un pedido vivo con ese origen, no hace nada.
- Opcional: con `cotizacion.anulada` y el pedido aún en borrador, propone `pedido_cancelar`.
- **Sin migración.**

### 4.4 Carriles, tandas y costos

Esfuerzo: S, M o L. Costo de IA de construcción: B (bajo), M (medio) o A (alto), en tokens de agente; una «sesión» es un carril de Sonnet de esfuerzo medio. **«Neon»** = hay una migración nueva que la sesión de Neon debe aplicar.

| Tanda | Carril | Qué hace | Propiedad exclusiva | Depende de | Esfuerzo / IA | Neon |
|---|---|---|---|---|---|---|
| 0 | Usuario | Decisiones de la §7. **Pista V:** 30 a 50 dictados reales y 10 registros cronometrados en Tairos.RC. **Piloto de tres trabajos en Cotizín**, tal como está | — | — | — / — | — |
| 0 | Keny | **X1:** host, dominio con HTTPS y despliegue de Capaz. Si D12 se aprueba, instalar `big.js` en `main` (versión exacta) | Integrador | D7 | M / B | — |
| 0 | Arquitecto | `docs/FICHAS-OLA-4.md`: contratos de captura y del Cotizador, tablas columna por columna, casos de referencia y «parar y preguntar». ADR-017 (captura como capa del núcleo; Cotizador en cortes) | Documentos | Decisiones D-I1 a D-I4 | S / M | — |
| **1** | **C3 · Captura (núcleo)** | `captura_proponer`, `RegistroDeInterpretes`, puerto `ModeloDeLenguaje` con implementación nula, `borradores_metricas`. Prueba por HTTP con dos empresas, sin módulo, solo lectura, idempotencia | `apps/api/src/core/captura/**` · `apps/api/src/core/borradores/**` (N1 ya cerró) · `packages/shared/src/contratos/captura.ts` (nuevo) | Ficha | M / M | No |
| **1** | **M-registro-s5a · Reglas de dictado** | Porta las reglas puras de Tairos.RC con sus unas 176 pruebas tal cual, más la tabla de sinónimos de categorías | `apps/api/src/modules/registro/dictado/**` | Ficha | S–M / B | No |
| **1** | **M-cotizador-s0 · Motor** | Copia los motores, tipos y utilidades de dinero e impuesto con sus unos 207 bloques de prueba **sin cambiar ningún esperado**. Adaptador único a céntimos con sus pruebas | `apps/api/src/modules/cotizador/domain/**` | D12 (`big.js`) instalado | M / B–M | No |
| **1** | **DB5 · Datos del Cotizador** | `0023_cotizador` (B1, más B2 si D-I2), listas de las pruebas `aislamiento`, `catalogo` y `contratacion`, y la consulta real con `capaz_app` | Carril de datos (`drizzle/**`, `src/db/esquema/**`, las tres pruebas) | Ficha y D-I1 | M / M | **Sí** |
| 2 | M-registro-s5b · Intérprete y herramienta | Registra el intérprete de Finanzas en C3; resuelve contacto, categoría, cuenta y deuda abierta; crea `deuda_crear_con_adelanto`; 15 a 20 casos «frase → borrador» | `apps/api/src/modules/registro/**` (sin las banderas) · `contratos/registro.ts` (solo agregar) | C3 y s5a integrados | M / M | No |
| 2 | W11 · Pantalla de dictado | `ReconocedorDeVoz` y `ReconocedorWebSpeech` (porte del hook), pantalla, tarjetas de Finanzas, aviso de HTTPS y lógica pura con pruebas. Pide al integrador la ruta y el botón de micrófono en la carcasa | `apps/web/src/core/captura/**` | C3 integrado; s5b para probar de punta a punta | M / M | No |
| 2 | M-cotizador-s1 · Precios y configuración | Nueve herramientas (§4.2), repositorios y contratos | `apps/api/src/modules/cotizador/**` (sin `domain/motor` ni las banderas) · `contratos/cotizador.ts` | DB5 y s0 | M / M | No |
| 3 | M-cotizador-s2 · Cotizaciones | Doce herramientas, eventos (los congela al integrar), disparador de inmutabilidad probado | La misma | s1 | M / M | No |
| 3 | M-ordenes-s3 · Puente | Consumidor y su prueba «A emite, B propone, dos entregas = un borrador» | `apps/api/src/modules/ordenes/**` | Contrato de eventos de s2 | S / B | No |
| 3 | M-cotizador-w1 · Pantallas B1 | Las pantallas de B1 y el documento imprimible | `apps/web/src/modules/cotizador/**` | s2 (y K3 si faltan piezas) | L (dos sesiones) / A | No |
| 3 | X4 · Integrador | Recorrido de punta a punta (dictado → movimiento; cotización → pedido → deuda), banderas, `catalogo.spec.ts` y tablero | `apps/api/src/pruebas/recorridos/**`, manifiestos | Todo lo anterior | S / B | — |
| Después | A2 · Modelo | `infra/ia/**` (adaptador) y DB6 (`core.uso`) | Integrador y carril de datos | Orden del dueño, dependencias y clave | M / M | **Sí** |
| Después | B2 · Cuadro | `M-cotizador-s3`, `s4` y `w2`; K3 (pieza de cuadro de columnas) | Las del módulo | Piloto de Cotizín y D-I2 | L + L / A | Solo si no entró en la 0023 |
| Después | B3 · Enlace público | DB7, `M-cotizador-s5` y revisión de seguridad | — | Decisión D-I10 | M / M | **Sí** |
| Después | Importar catálogos de Cotizín | Herramienta `listas_precio_importar` (crítica, con vista previa) o un guion puntual | El módulo | D-I6 | S / B | No |

**Cuentas aproximadas:**

- Voz A1: unas 4 sesiones (C3, s5a, s5b, W11).
- Cotizador B1 con el puente: unas 6 (DB5, s0, s1, s2, s3 de `ordenes`, w1 en dos).
- B2: unas 4 o 5.
- A2: unas 2.
- B3: 2 o 3.

**Dependencias, en una línea:**

```
C3 ─► s5b ─► W11 (de punta a punta)          s5a ─► s5b
s0 ─┐
DB5 ─► s1 ─► s2 ─► (w1, ordenes-s3) ─► X4
```

### 4.5 Si el presupuesto aprieta: qué primero y qué dejar

1. **Primero, la voz A1** (C3, s5a, s5b y W11). Ataca el dolor principal y la meta del piloto, no tiene costo por uso y permite apagar Tairos.RC.
2. **Después, el Cotizador B1 y el puente.** Si hay que recortar más, se quedan fuera `cotizacion_duplicar`, `ajuste_cliente_fijar` y la marca «Revisar» de los 90 días.
3. **Se deja para después sin perder nada:**
   - A2 (modelo);
   - B2 (cuadro por partes): mientras tanto se sigue usando Cotizín para lo «por partes»;
   - B3 (enlace público);
   - el precio por m²;
   - los intérpretes de voz para pedidos y cotizaciones;
   - WhatsApp.
4. **No hacer:** reconstruir en Capaz la papelera, «reactivar» ni «devuelto o retenido» de Tairos.RC, que ya se descartaron a propósito.

---

## 5. Plan de datos y de coexistencia

### 5.1 Qué se importa

| Dato | Origen | ¿Se importa? (recomendación) | Cómo |
|---|---|---|---|
| Movimientos, deudas, abonos, órdenes y proformas | Tairos.RC (Supabase) | **No.** Se empieza limpio (decisión del 2026-11-10) | Antes de apagarlo: exportar a Excel (`SF/src/app/api/export`) y que Keny haga una copia de la base. Se archivan fuera del repositorio |
| Contactos | Tairos.RC | Solo si el dueño quiere su lista de clientes reales | CSV → importador existente (`clientes`), revisando antes los duplicados («Wilfredo / Wilfredo Ica») |
| Clientes | Cotizín | No: son de prueba (`ESTADO-DEL-PROYECTO.md:139`, «los registros actuales son de prueba») | Si hay alguno real: CSV → importador `clientes` |
| Nombres de productos | Cotizín | Solo los que el dueño vende de verdad | CSV → importador `productos` |
| Lista de precios (236 variantes) | Cotizín (Neon) | **No por defecto:** son precios de mercado estimados, no tarifas de Atlantisgraf | Si el dueño la quiere: CSV exportado por Keny desde la consola de Neon → `listas_precio_importar`, marcada «Revisar» |
| Tarifas, formatos, máquinas e ítems del cuadro | Cotizín | Solo con B2 y solo lo que el dueño confirme como real | Pocas filas: a mano en «Ajustes del taller», o con el mismo CSV |
| Configuración (utilidad 35 %, semáforo 30/15, redondeo, condiciones, mensaje) | Cotizín | Se vuelve a escribir | Una pantalla |
| Cotizaciones e historial | Cotizín | No | Quedan consultables en Cotizín mientras siga encendido |

Ningún agente lee las bases de Cotizín ni de Tairos.RC ni sus credenciales: exporta Keny o el dueño.

### 5.2 Coexistencia, apagado y vuelta atrás

| | Tairos.RC | Cotizín |
|---|---|---|
| **Durante el piloto** | Sigue intacto. **Regla: desde el día 1 del piloto, el dinero se anota solo en Capaz.** Tairos.RC queda de respaldo si Capaz se cae, y lo que se anote ahí se vuelve a dictar en Capaz el mismo día (evita el doble registro y las cifras partidas) | Sigue intacto. Con B1 en uso, las cotizaciones rápidas se hacen en Capaz y lo «por partes» sigue en Cotizín hasta B2 |
| **Cuándo se apaga** | Cuando la voz cumpla la meta (§6.4) durante dos semanas seguidas **y** pasen 14 días sin usar el respaldo | Sin B2: cuando lo «por partes» no se use en 30 días. Con B2: cuando los tres trabajos del piloto den en Capaz el mismo precio que en Cotizín y pasen 14 días sin usarlo |
| **Cómo** | Exportar a Excel, copiar la base, **pausar** el proyecto de Supabase 90 días y después borrarlo | Exportar en CSV y PDF lo que se quiera conservar, pausar el despliegue y la base 90 días y después borrar |
| **Vuelta atrás** | Reactivar Supabase. Lo anotado en Capaz durante el piloto no se sincroniza: se vuelve a teclear (por eso rige la regla de un solo sistema) | Cotizín sigue disponible hasta su apagado. Lo cotizado en Capaz se queda en Capaz |
| **Costo mientras conviven** | Una base de Supabase más. No se verificó cuánto cuesta | Una base en Neon (`us-east-2`) y su despliegue. No se verificó cuánto cuestan |

---

## 6. Pruebas de equivalencia y criterios de éxito

### 6.1 Cotizador: casos de referencia (números reales de Cotizín → resultado esperado en Capaz)

Las pruebas de Cotizín se copian **sin tocar ningún esperado**. Si una cambia, el carril para y pregunta.

| # | Entrada | Esperado | Evidencia |
|---|---|---|---|
| C1 | 2.500 volantes A5 (14,8 × 21) 4/4; madre 70 × 100, máquina 35 × 50; sangrado y calle 0,3; pinza 2; tiraje con 3 % + 40 hojas | 4 poses; 625 netos → 645 → 685 pliegos de máquina; **172 pliegos madre** | `COT/src/features/cotizacion/testing/caso-de-referencia.ts:6-90` · `services/cuadro.test.ts:118-121` · `mermas.test.ts:18-30` |
| C2 | Las seis filas de C1 (papel a 0,45; 8 planchas a 5,00; 0,8 h a 30,00; diseño 40,00; barniz 28,00; corte 15,75) | Subtotales 77.40 / 40.00 / 24.00 / 40.00 / 28.00 / 15.75; **costo 225.15** | `services/calcular-cotizacion.test.ts:35-47` |
| C3 | C2 con 35 % sobre la venta | **Precio 346.38**, utilidad 121.23, unitario 0.1386, margen 35.00 %, verde | `calcular-cotizacion.test.ts:50-53` · `cuadro.test.ts:179-182` |
| C4 | C2 con un recargo de 35 % sobre el costo | **303.95**, margen 25.93 %, ámbar (con umbrales 20/10: verde) | `calcular-cotizacion.test.ts:67-82` · `cuadro.test.ts:193-198` |
| C5 | El cuadro de C1 a 100, 1.000 y 5.000 | **144.86 / 220.34 / 555.83** | `cuadro.test.ts:231-233` |
| C6 | Escalar C1 a otra cantidad | 75 pliegos madre en lugar de 172; fila por pliego 0.348 (= 0,8 × 298 / 685) | `escalar-cuadro.test.ts:63-69,145` |
| C7 | Lista 190 / 580 / 1.200, curva | 100 → 190.00 · 200 → 265.86 · 500 → 414.50 · 1.000 → 580.00 · 1.500 → 696.59 · **2.500 → 877.39** · 5.000 → 1.200.00 | `COT/src/features/precio-por-escala/services/precio-por-escala.test.ts:24-48` |
| C8 | La misma lista en escalón, 2.500 unidades | **1.450.00** | `precio-por-escala.test.ts:113-117` |
| C9 | Mínimo 250 y 100 unidades | **250.00**, con el mínimo aplicado | `precio-por-escala.test.ts:135-137` |
| C10 | Referencias 190 / 150 / 400 | Rechazo `total_no_crece` (invariante B) | `validar-referencias.test.ts:23-25` |
| C11 | Precio de lista 793.26 con redondeo de 1, 5 y 10 | 794.00 / 795.00 / 800.00; 994.37 a 5 → 995.00 | `precio-rapido.test.ts:70-81` |
| C12 | El caso C1 armado **solo con herramientas de Capaz**, por HTTP | 225.15 / 346.38, igual que en Cotizín | Porte de `COT/src/features/cotizacion/testing/armar-caso-de-referencia.ts` (B2) |
| C13 | Adaptador a céntimos | `'346.38'` → 34638; ningún `number` con decimales | Prueba nueva de s0 |

### 6.2 Captura: casos

- **Se copian tal cual** las unas 176 pruebas de las reglas de Tairos.RC. Ejemplos:
  - «Ingreso 500 soles, cliente Juan, flyers» → 50000;
  - «egreso 45.50 tinta negra» → 4550;
  - «ingreso de mil quinientos soles» → 150000;
  - «Contrato 240, adelanto 100, cliente Cristina» → total 24000 y adelanto 10000;
  - «contrato 100 adelanto 100» → el adelanto queda en `null`.

  Evidencia: `SF/src/features/extract/lib/normalize-monto.test.ts:23-30,44-49,138-147` y `enrich-extraction.test.ts:50-68`.
- **Casos nuevos «frase → borrador»** (s5b), de 15 a 20, con los ejemplos de la tabla de la §4.1: herramienta y `args` exactos, con contactos y categorías sembrados.
- **Por HTTP** (C3 y s5b):
  1. un dictado deja un borrador `origen: 'voz'` con `capturaIniciadaEn`;
  2. al aprobarlo nace el movimiento;
  3. con la misma `Idempotency-Key` se obtiene un solo borrador;
  4. un `member` sin `registro` recibe `modulo_no_disponible`;
  5. un `member` de solo lectura no puede proponer;
  6. otra empresa no ve nada;
  7. «Corregir y aprobar» deja `corregido = true` y `borradores_metricas` lo cuenta.
- Los casos a–h de Finanzas **no cambian** y deben seguir en verde.

### 6.3 Puente: casos

- **P1.**
  - Cotización aceptada: precio sin IGV 346.38, IGV 18 % = 62.35 (la mitad sube).
  - Línea del pedido: cantidad 1 y precio 408.73 con IGV.
  - `calcularTotalesDePedido` da subtotal **346.38**, IGV **62.35** y total **408.73**.
  - Lo mismo con C5: 144.86 → 170.93; 220.34 → 260.00; 555.83 → 655.88.
  - **Por qué siempre coincide:** si el IGV se redondea al céntimo (error de 0,5 como máximo), al dividir el total entre 1,18 el error queda por debajo de 0,43. Al redondear se recupera siempre el mismo precio sin IGV.
- **P2.** El mismo evento entregado dos veces deja un solo borrador. Aprobar dos borradores con el mismo origen deja un solo pedido (`0016_ordenes.sql:81`).
- **P3.** Una cotización anulada antes de aceptarse no propone nada.

### 6.4 «Hecho cuando», medible

| Producto | Técnico (en la suite) | En uso real (piloto de 30 días, en el host con HTTPS) |
|---|---|---|
| **Registro por voz** (Tairos.RC dentro de Capaz) | §6.2 completa en verde; `pnpm check` en `main` | Al menos 100 dictados; **70 % o más aprobados sin corregir**; **mediana de 30 s o menos** desde que se toca el micrófono hasta que se aprueba; 0 duplicados; Tairos.RC sin usarse 14 días. Línea base: los 10 registros cronometrados de la pista V |
| **Cotizador B1** | C7 a C11 y C13; P1 a P3; R17 completas | Al menos 10 cotizaciones reales emitidas en Capaz; al menos una convertida en pedido por el puente; cotización rápida en menos de 2 min (la meta de Cotizín, `COT/BUSINESS_LOGIC.md` §5) |
| **Cotizador B2** | C1 a C6 y C12 | Los tres trabajos del piloto de Cotizín rehechos en Capaz dan **el mismo precio** que en Cotizín |

---

## 7. Decisiones que necesito del dueño

| # | Decisión | Opciones | Recomendación | Qué bloquea |
|---|---|---|---|---|
| **D-I1** | ¿El Cotizador se construye **dentro** de Capaz, o Cotizín sigue aparte, conectado por API o webhook? | (a) Módulo de Capaz. (b) Cotizín aparte, que avisa a Capaz al aprobar | **(a), en cortes.** La opción (b) obliga a **modificar Cotizín**, que debía quedar intacto. También duplica clientes, productos, base y despliegue, justo lo que el ERP quiere evitar (FINALIDAD §2, motivo 2). Y Cotizín tarda unos 3,3 s por llamada | DB5 y todo el Cotizador |
| **D-I2** | Alcance del Cotizador | B1 solo; B1 + B2; nada todavía | **B1 ahora. B2 solo si el piloto de tres trabajos en Cotizín demuestra uso** (hoy cubre unos 9 % de las ventas; el troquelado, el 61 %, queda fuera) | Tablas B2 en la 0023; carriles B2 |
| **D-I3** | Orden | Voz primero; Cotizador primero; en paralelo | **En paralelo y con prioridad a la voz.** La primera tanda lleva las dos cosas, pero si falta presupuesto se recorta el Cotizador, no la voz | La forma de las tandas |
| **D-I4** | Reconocimiento de voz | Web Speech del navegador; grabar y subir a un servicio (D11 recomendaba esto); los dos | **Web Speech primero:** gratis, ya probado en Tairos.RC y portable en poco. Grabar y subir queda diseñado detrás de la misma interfaz y se construye solo si la pista V lo pide. **Avisos:** puede fallar en iPhone con Safari; el audio lo procesa el proveedor del navegador; exige HTTPS | W11 |
| **D-I5** | Modelo de IA para interpretar | Sin modelo (reglas locales); con modelo desde el día 1 | **Sin modelo primero (A1), medir con la pista V, y el modelo (A2) solo si no se llega al 70 %.** Para A2 hace falta: proveedor (hoy Tairos.RC usa OpenRouter con un modelo pequeño), clave (Keny), tope mensual, dependencias aprobadas y aceptar que el texto sale hacia el proveedor. El proveedor se elige comparando con los mismos dictados, no de memoria | A2 |
| **D-I6** | Datos de Cotizín | Importar todo; solo catálogos; nada | **Solo los catálogos que confirmes como reales.** La lista de 236 variantes, no (son precios de mercado estimados). Los clientes, no (son de prueba) | Importación |
| **D-I7** | `big.js` para el motor (D12) | Aprobar `big.js@7.0.1` (lo que usa Cotizín); reescribir el motor con enteros | **Aprobar.** Copiar el motor con sus pruebas es lo más barato y lo más seguro; reescribirlo cuesta más y arriesga los números | M-cotizador-s0 |
| **D-I8** | Despliegue con HTTPS antes del piloto de voz (con Keny, D7) | Ahora; después | **Ahora.** Sin HTTPS el micrófono del celular no funciona y no hay piloto | El piloto de voz (no la construcción) |
| **D-I9** | Categorías de Finanzas para el rubro | Las 8 genéricas de Capaz; las 16 del rubro de Tairos.RC | **Las 8 genéricas, con los sinónimos del intérprete.** Crear las finas solo si quieres reportes por esos rubros | s5a |
| **D-I10** | Enlace público con aprobar o rechazar (B3) | Sí; después; no | **Después.** Mientras tanto se envía el documento por WhatsApp y la persona marca «aceptada» | B3 |
| **D-I11** | Reglas de convivencia y apagado (§5.2) | Las propuestas; otras | **Las propuestas:** un solo sistema para el dinero desde el día 1 del piloto | El inicio del piloto |
| **D-I12** | Piloto de tres trabajos en Cotizín y pista V (los hace el dueño, sin código) | Hacerlos ya; después | **Ya:** no cuestan construcción y deciden D-I2 y D-I5 | B2 y A2 |

**Decisiones técnicas para Keny** (con recomendación):

- `deuda_crear_con_adelanto` como herramienta nueva, en lugar de dos borradores dependientes.
- `captura_proponer` comprueba el permiso del módulo destino dentro, por la exención del núcleo.
- La política de `capaz_sistema` para B3.
- Si `pedido.confirmado` debe llevar el origen, para marcar la cotización como «convertida». Es un cambio de un contrato congelado de `ordenes`; opcional.

---

## 8. Riesgos

| # | Riesgo | Efecto | Mitigación |
|---|---|---|---|
| 1 | **Encaje del Cotizador con Atlantisgraf** (unos 9 % de las ventas; el troquelado por pieza queda fuera) | Construir algo que casi no se usa | Piloto de tres trabajos en Cotizín antes de B2. B1 sirve para cualquier producto con precios de referencia. Después, cantidades de referencia propias por producto (pendiente en `COT/docs/ESTADO-DEL-PROYECTO.md:148`) |
| 2 | **Voz con ruido real y sin medir** | No llegar al 70 % | Pista V antes de construir A2; texto siempre disponible; reglas y modelo intercambiables |
| 3 | **Web Speech:** HTTPS obligatorio; Safari en iPhone poco fiable; el audio va al proveedor del navegador | Sin piloto, o con una queja de privacidad | X1 antes del piloto; Chrome en Android como canal del piloto; avisarlo en la política de privacidad (Ley 29733: no verificado legalmente) |
| 4 | **Reglas locales insuficientes sin modelo** | A1 no llega a la meta | Medirlo fuera de línea con las transcripciones de la pista V **antes** de decidir A2 |
| 5 | **Presupuesto de IA** (B2 y w1 son L/A) | Quedarse a medias | Cortes B1 y B2; §4.5; cuatro carriles como máximo; fichas cortas que apuntan a **una** sección |
| 6 | **Dos aritméticas** (`big.js` dentro del motor y céntimos fuera) | Diferencias de un céntimo | Un solo adaptador probado (C13); lo que sale del módulo, siempre en céntimos; P1 demuestra que el puente no pierde |
| 7 | **Doble registro durante la convivencia** | Cifras partidas entre Tairos.RC y Capaz | Regla de un solo sistema (D-I11) |
| 8 | **Datos reales en Tairos.RC**, aunque se declararon de prueba (108 movimientos, contactos con duplicados) | Perder historia al apagar | Excel y copia de la base antes de apagar; pausar 90 días antes de borrar |
| 9 | **Capaz no está desplegado** (Neon `production` sin empresas; falta X1) | Nada se puede usar de verdad | X1 en la tanda 0 (Keny). Las migraciones nuevas (0023, y la de `core.uso` si llega A2) pasan por la sesión de Neon |
| 10 | **Exención del núcleo en `puedeEscribir`** (`RELEVO.md:13`) | Que `captura_proponer` deje proponer a quien no puede escribir | Comprobación explícita dentro de la herramienta y su prueba (§6.2, casos 4 y 5) |
| 11 | **Repetir los fallos conocidos de Cotizín** (catálogos guardados con la lista completa, borrador sin versión esperada) | Ediciones perdidas | Herramientas por fila y huella en las críticas (B2) |
| 12 | **Cambio de contratos congelados** (`registro`, `ordenes`) | Conflictos entre carriles | Solo cambios aditivos; los recibe el carril dueño en su ficha; el integrador corrige el plan en la misma integración |
| 13 | **Regla 12** | Copiar de otro ERP | Cotizín y Tairos.RC son del dueño y se pueden portar. Nada se toma de otros ERP (nombres, textos ni diseño) |
| 14 | **Lo no verificado de este plan** | Decidir sobre datos supuestos | No se ejecutaron pruebas de ningún repositorio (conteos estáticos); no se consultaron las bases de Tairos.RC ni de Cotizín; costos de Supabase, Neon de Cotizín, modelo y voz sin verificar; el estado del repositorio vivo de Cotizín después de la copia del 14-nov sin comparar |

**Siguiente paso, si apruebas:** el dueño responde la §7 (sobre todo D-I1, D-I2, D-I5 y D-I8) y hace la pista V y el piloto de Cotizín. Keny se encarga de X1. El arquitecto escribe `FICHAS-OLA-4.md` y ADR-017. Después, el integrador lanza la tanda 1.
