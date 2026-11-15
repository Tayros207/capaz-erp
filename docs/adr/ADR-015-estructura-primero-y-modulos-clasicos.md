# ADR-015: Estructura del ERP primero; familias, esquemas y módulos clásicos

**Estado:** ACEPTADO por Moisés el 2026-11-15 (redactado por el arquitecto de planes). Ajustes del usuario: la voz se implementa más adelante, empezando con captura tecleada; Registro y Cotizador se suben después y solo si encajan · **Decide:** Moisés · **Relacionado:** ADR-003, ADR-008, ADR-011, ADR-013, ADR-014

> Este ADR no cambia ningún ADR aceptado. Recoge lo que la decisión del usuario del 2026-11-15 («primero el ERP completo; Registro por voz y Cotizador se adaptan después») obliga a ajustar en tres ADR aceptados, y pide aprobarlo. Mientras siga en «propuesto», la ola 1 se construye igual (no depende de él); **las olas 2 y 3 no arrancan sin su aprobación.**

## Contexto

Decisión del usuario (2026-11-15): Capaz es un ERP completo, de apariencia tradicional y comportamiento de trabajador digital. Primero se termina la estructura (núcleo, permisos, carcasa, consola, conectores, automatizaciones y módulos clásicos); después se adaptan dentro de él el Registro por voz y el Cotizador. Compras va con Insumos. El menú muestra desde el inicio las familias clásicas con los módulos no contratados bloqueados.

Lo comprobado en el código (2026-11-15) que no encaja con ese orden:

1. `manifiestoDeModuloSchema` (`packages/shared/src/modulos.ts`) no tiene familia: el menú por familias no se puede construir.
2. Solo existen los esquemas `core`, `registro`, `cotizador` (y `auth`). Están fijados en ADR-003 y ADR-011, en `drizzle.config.ts` (`schemaFilter`), en la migración `0000` (permisos de uso) y en tres pruebas (`catalogo`, `aislamiento`, `contratacion`).
3. ADR-008 dice «voz primero» para el Registro; el nuevo orden pone la voz al final.
4. «Finanzas ligeras» y «Registro» son el mismo dinero (caja, cuentas por cobrar y por pagar, abonos). Construir dos módulos duplicaría las reglas de dinero, lo que ADR-008 quiere evitar.

## Decisión propuesta

### 1. Orden de construcción
Etapas y olas de `PLAN-DE-CONSTRUCCION.md` versión 3: ola 1 estructura; ola 2 Finanzas y Ventas clásicas; ola 3 Inventario, Compras, Personal y Reportes; ola 4 Registro por voz, Cotizador y puente; después crecer; facturación SUNAT al final. Sustituye la «ruta al piloto» de la versión 2 del plan y **la frase «voz primero» de ADR-008** (el resto de ADR-008 sigue: lógica de dinero en TypeScript con equivalencia contra el SQL de Tairos.RC).

### 2. Familias en el manifiesto
El manifiesto de módulo gana `familia` (`ventas`, `compras`, `inventario`, `produccion`, `finanzas`, `personal`, `analisis`, `conexiones`; nulo solo en `core`) y `orden`. Las cinco clásicas (`ventas`, `compras`, `inventario`, `finanzas`, `personal`) se muestran siempre en el menú. Un módulo aún sin construir existe como manifiesto con `enConstruccion: true`: se ve bloqueado, no se puede contratar por error y no tiene tablas.

### 3. Un esquema de base por módulo contratable
Amplía la lista de ADR-003 y ADR-011. Esquemas nuevos: `crm`, `ordenes`, `insumos`, `compras`, `personal`. `reportes` y `webhooks` no tienen esquema propio. Reglas:
- Los crea **una** migración del carril de datos al empezar cada ola (`create schema`, `grant usage … to capaz_app`), junto con el alta en `schemaFilter` y en las listas de esquemas de las pruebas de catálogo, de aislamiento y de plataforma.
- `capaz_sistema` no recibe acceso a ninguno (misma garantía que hoy para `registro` y `cotizador`); la prueba de roles se amplía a todos.
- Los conectores y las automatizaciones siguen en `core` (ADR-014).

### 4. Finanzas ligeras es el módulo `registro`, en dos pasos
- **Paso clásico (ola 2):** movimientos, cuentas por cobrar y por pagar, abonos y caja del día, con pantallas tradicionales y pruebas de equivalencia contra las funciones SQL de Tairos.RC (ADR-008).
- **Paso de voz (ola 4):** captura por voz, agente e interpretación sobre las mismas herramientas, usando la bandeja de borradores del núcleo.
Un solo módulo, un solo esquema (`registro`) y una sola implementación de las reglas de dinero. En el menú aparece en la familia Finanzas con el nombre «Registro».

### 5. Ventas clásica
Familia Ventas = `crm` (oportunidades y actividades) + `ordenes` (pedidos con líneas, estados y entrega) y, en la ola 4, `cotizador`. El Cotizador no duplica el pedido: una cotización aceptada **emite un evento** que crea el pedido (puente, fase 23).

### 6. Bandeja de borradores en el núcleo
`core.borradores` guarda una **propuesta de llamada a una herramienta** (quién la propuso: voz, texto, agente, regla, conector o importación) que una persona aprueba, corrige o descarta desde la pantalla. Es la pieza que da el comportamiento de trabajador digital a todos los módulos, y la que usan los modos `borrador` y `pide_aprobacion` de las automatizaciones (ADR-014). El Registro por voz será un productor más de borradores.

## Alternativas descartadas
- **Todo en el esquema `core`:** rompe «un esquema por módulo» y hace imposible quitar a la plataforma el acceso por esquema.
- **Módulo «finanzas» nuevo y `registro` aparte para la voz:** dos implementaciones del dinero.
- **Módulo de ventas genérico con su propia cotización:** dos modelos de cotización cuando llegue el Cotizador.
- **No mostrar los módulos hasta que existan:** contradice la decisión del menú por familias desde el inicio.

## Consecuencias
- La fase P del plan cambia el contrato del manifiesto y agrega manifiestos en construcción para `crm`, `ordenes`, `compras`, `insumos`, `personal`, `reportes` y `webhooks`.
- Documentos que quedan desfasados: `FINALIDAD-Y-OBJETIVOS-ERP.md` §7 (excluía inventario y personal de la V1) e `INTEGRACION-DE-MODULOS.md` §4 (fases con voz primero) llevan una nota al inicio. ADR-008 **no se edita**: al aprobarse este ADR, su frase «voz primero» queda sustituida por el punto 1.
- Pregunta abierta: `registro` hoy se entrega por defecto en prueba de 30 días a toda empresa nueva (`registro.manifest.ts`); con el nuevo orden estará «en construcción» durante la ola 1. Recomendación: quitar `porDefecto` hasta cerrar la ola 2 (decisión D9 del plan).
