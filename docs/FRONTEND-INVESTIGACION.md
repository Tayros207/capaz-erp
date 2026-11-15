# Investigación de frontend de Capaz ERP

**Fecha de consulta: 2026-11-14 · Estado: propuesta para que el usuario apruebe (no decide nada por sí sola).**
Alcance: pila de interfaz de la fase 6a y posteriores. Complementa `MODULOS-Y-MERCADO.md` sección 7 y `ARQUITECTURA-DE-MODULOS.md`. Regla 15 de `AGENTS.md`: **ninguna dependencia de este documento está aprobada**; todas son propuestas.

Convención de evidencia usada en todo el documento:
- **[V-código]** leído en el código local de Odoo (`/home/datayros/Documentos/work/modules/odoo/addons/web/static/src`, solo lectura).
- **[V-npm]** consultado con `npm view` el 2026-11-14 (versión, licencia, fecha de publicación).
- **[V-doc]** leído en documentación oficial (MDN, W3C, tailwindcss.com, base-ui.com, tanstack.com, ag-grid.com, repositorios en GitHub).
- **[V-prueba]** ejecutado por mí en Node 24.19 (solo formateo con `Intl`).
- **[Proveedor]** viene de un blog comercial o de comparativas SEO; es orientativo.
- **[Memoria]** conocimiento mío sin verificar hoy; confirmar antes de decidir.

---

## 1. Resumen ejecutivo

1. **Mantener Tailwind 4 como único sistema de CSS** y escribir un kit propio, pequeño y revisado a mano, en `apps/web/src/shared/ui`. Tokens semánticos en `@theme` con valores que cambian por tema mediante variables CSS (sección 6). Sin librería de componentes con estilos (Mantine, Ant, Chakra, DaisyUI): imponen su estética y pesan.
2. **Primitivas: empezar con `<dialog>` y `popover` nativos** (Baseline, [V-doc] MDN) para diálogo, hoja inferior y menús simples. Si aparece una necesidad que lo nativo no cubre bien (Select/Combobox accesible, menú con navegación por flechas, Drawer con gestos), adoptar **`@base-ui/react` 1.9.0** (MIT, 1.0 estable desde 2025-12-11, tiene Dialog, Drawer, Combobox, Select, Menu, Popover, Toast [V-doc]). Radix queda como alternativa equivalente; React Aria solo si se necesita su selector de fechas.
3. **Tablas: `@tanstack/react-table` 9.3.1** (sin estilos, MIT, solo se empaqueta lo que se importa) con `<table>` HTML propio; virtualización (`@tanstack/react-virtual`) solo cuando una lista supere unos cientos de filas. **Descartar AG Grid Community** (agrupar, pivot y rango son Enterprise [V-doc]) y Glide (canvas, no accesible).
4. **Formularios: Zod compartido + estado local** para formularios cortos (cero dependencias); **React Hook Form** solo para fichas largas, si el usuario lo aprueba. La validación de verdad vive en el servidor y en `@capaz/shared`.
5. **Gráficos: SVG propio** (barras, línea, anillo) hasta que Reportes exija más; entonces probar Recharts 3.x. **Iconos: `lucide-react`** o un archivo de SVG propios. **Fuentes: Fontsource variable** (Manrope e Inter). **Toasts, paleta de comandos y hoja inferior: propios** (patrones ARIA simples); `sonner` es el reemplazo si se prefiere no escribirlo. **Descartar `vaul`** (su autor lo declara sin mantenimiento [V-doc]).
6. **Pruebas sin e2e: Vitest + Testing Library + Zod de contrato, y una página interna `/kit` de componentes** para la revisión visual a 390 y 1280 px. **Storybook no**: su modo de pruebas usa Playwright por defecto [V-doc], lo que choca con la regla 8.
7. **Lo más distintivo para "trabajador digital"**: bandeja de revisión con aprobar/corregir de un clic, indicador de guardado, cola de escrituras en serie (`scope` de TanStack Query [V-doc]) y captura de voz por grabar-y-subir (no por Web Speech API, que no sirve en Firefox y envía audio a Google en Chrome [V-doc]).
8. **Presupuesto sugerido**: JS inicial de la ruta de entrada menor de 150 KB comprimido; cada módulo en su propio trozo (React Router lazy). Las cifras de tamaño de cada paquete de este documento son **tamaño desempaquetado de npm**, no de bundle; el tamaño real se mide en la prueba de 1 día (sección 10).

---

## 2. Estado actual del frontend (verificado)

[V-código local] `apps/web` tiene React 19.3.1, React Router 8.5.1, Tailwind 4.3.5 (plugin de Vite), Vitest 4.1.2 y `src/{index.css, main.tsx, pages/inicio.tsx}`. Hay un `@theme` provisional «Pliego» (papel, tinta, cian, magenta, amarillo) en `src/index.css`; `MODULOS-Y-MERCADO.md` §7 fija otro lenguaje (menú azul noche, acento esmeralda, Manrope e Inter). **Contradicción a resolver por el usuario**: cuál de los dos es el visual definitivo (pregunta 1, sección 11).

Aviso de versiones [V-npm]: la última de `vitest` en el registro es **5.1.0**, pero el proyecto usa 4.1.2 y `AGENTS.md` dice Vitest 4. No actualizar sin aprobación.

---

## 3. Comparativa por categoría

Tamaño = `dist.unpackedSize` de npm (no es lo que llega al navegador). Veredictos: **adoptar** (recomendado), **probar** (prototipar en la prueba de 1 día), **descartar**.

### 3.1 CSS / sistema de interfaz

| Opción | Licencia | Tamaño | Accesibilidad | Madurez 2026 | Encaje con Tailwind 4 + React 19 | Veredicto | Fuente |
|---|---|---|---|---|---|---|---|
| Tailwind 4.3.5 | MIT | 0.8 MB (solo build) | Neutra (no trae componentes) | Muy alta | Es la base ya instalada | **Adoptar** (ya elegido) | [V-npm], [V-doc] tailwindcss.com/docs/theme |
| shadcn/ui (copiar y poseer) | MIT | no es paquete; genera archivos | Hereda de la primitiva (Base UI o Radix) | Alta; **desde jul 2026 usa Base UI por defecto** [Proveedor: blogs] (el changelog oficial lista la entrada pero no pude leer su cuerpo) | Excelente; su CLI apunta a Tailwind 4 | **Probar** como fuente de ideas y de patrones de archivo, no como dependencia: usar su CLI traería dependencias (`clsx`, `tailwind-merge`, `cva`, Radix/Base UI) sin aprobar | ui.shadcn.com/docs/changelog |
| Radix UI (`radix-ui` 1.8.1) | MIT | 0.1 MB (agregador) | Alta | Alta; ahora compite con Base UI | Bueno | Alternativa a Base UI | [V-npm] |
| Base UI (`@base-ui/react` 1.9.0) | MIT | 10.4 MB (muchos componentes; se importa por pieza) | Alta (tema central del proyecto) | 1.0 estable 2025-12-11; versión mensual hasta 1.9.0 (2026-10-09) | Sin estilos; usa clases | **Adoptar si lo nativo no alcanza** | [V-npm], [V-doc] base-ui.com/react/overview/releases |
| React Aria Components 1.22.1 | Apache-2.0 | 6.9 MB | La más rigurosa (APG, 30+ idiomas, 13 calendarios) [V-doc] | Alta | Sin estilos; hay plugin Tailwind (poco documentado en la página) | **Probar solo para fechas/combobox** | [V-npm], react-aria.adobe.com |
| Ark UI 5.40.0 / Park UI | MIT | 3.3 MB | Buena (Zag.js) [Memoria] | Media | Correcto | Descartar: sin ventaja sobre Base UI para nosotros | [V-npm] |
| Mantine 9.8.0 | MIT | 10.7 MB | Buena | Alta | Tiene su propio CSS; mezclar con Tailwind duplica | Descartar | [V-npm] |
| Ant Design 6.7.0 | MIT | 49 MB | Media [Memoria] | Muy alta | Estética propia, CSS-in-JS; choca con Tailwind | Descartar | [V-npm] |
| Chakra UI 3.38.0 | MIT | 2.8 MB | Buena | Alta | Sistema de estilos propio (Panda/Emotion) | Descartar | [V-npm] |
| DaisyUI 5.8.0 | MIT | 2.9 MB | Variable [Memoria] | Alta | Plugin de Tailwind; clases semánticas rápidas pero estética reconocible y poco control de densidad | Descartar (riesgo de aspecto "genérico") | [V-npm] |
| UnoCSS 66.13.0 / Panda CSS 2.5.0 | MIT | pequeños | n/a | Alta | Duplican lo que Tailwind ya resuelve | Descartar | [V-npm] |
| Open Props 1.7.23 | MIT | 1.3 MB | n/a | Alta | Variables CSS sueltas; solapa con `@theme` | Descartar (solo leer su escala como inspiración) | [V-npm] |

Buenas prácticas de tokens con Tailwind 4 [V-doc] tailwindcss.com/docs/theme y /docs/dark-mode:
- `@theme` define tokens y genera utilidades (`bg-superficie`) y también variables CSS.
- `@theme inline` hace que la utilidad use el **valor** y no la variable; **no sirve para tokens que cambian en modo oscuro** si apunta a literales. Para tema por variables: definir las variables en `:root` / `[data-tema="oscuro"]` y mapearlas en `@theme inline` con `var(--...)`, o definirlas directamente en `@theme` y redefinirlas bajo el selector oscuro (ver §6; la combinación exacta se valida en la prueba de 1 día porque las fuentes no coinciden).
- Modo oscuro: por defecto sigue `prefers-color-scheme`; para un interruptor manual usar `@custom-variant dark (&:where([data-tema=oscuro], [data-tema=oscuro] *));` (forma oficial con atributo de datos).
- `--color-*: initial;` borra la paleta por defecto para que nadie use `bg-red-500` en lugar de un token semántico (recomendado para que los agentes de IA solo puedan usar nombres semánticos).

### 3.2 Tablas, listas y rejillas

| Opción | Licencia | Tamaño | Accesibilidad | Madurez | Encaje | Veredicto | Fuente |
|---|---|---|---|---|---|---|---|
| `<table>` HTML propio + TanStack Table 9.3.1 | MIT | 0.12 MB desempaq.; ~25 KB brotli el paquete completo, menos por funciones elegidas [V-doc] | Total control del HTML (`<th scope>`, `aria-sort`, `caption`) | v9 estable desde 2026-08-04 [V-doc] (v8→v9 trae `features` explícitas y cambio de nombre `useReactTable`→`useTable`) | Sin estilos; compatible con React Compiler [V-doc] | **Adoptar** para listas con orden/filtro/agrupar/paginar | [V-npm], tanstack.com/blog/announcing-tanstack-table-v9 |
| `@tanstack/react-virtual` 3.14.26 | MIT | 64 KB | Hay que mantener `aria-rowcount`/`aria-rowindex` | Alta | Bueno | **Probar** solo con listas de cientos de filas | [V-npm] |
| AG Grid Community 36.3.0 | MIT | 21.9 MB | Buena | Muy alta | Agrupar por filas, pivot, rango y servidor son **Enterprise (de pago)** [V-doc] | **Descartar** (regla 14: nada de pago) | [V-npm], ag-grid.com |
| Glide Data Grid 6.0.3 | MIT | 3.7 MB | Canvas: deficiente para lectores de pantalla [Memoria] | Media | Hoja tipo Excel | Descartar | [V-npm] |
| Lista de tarjetas en móvil (propia) | n/a | 0 | Controlable | n/a | A 390 px una tabla ancha no sirve; Odoo también cambia a tarjetas [V-código `views/kanban`, `views/card`] | **Adoptar**: `Lista` renderiza tabla en escritorio y tarjetas en móvil | n/a |

### 3.3 Formularios

| Opción | Licencia | Tamaño | Accesibilidad | Madurez | Encaje | Veredicto | Fuente |
|---|---|---|---|---|---|---|---|
| Estado local + Zod (`safeParse`) + `FormData` | MIT | 0 extra | La da el HTML nativo si se usa `label`, `aria-invalid`, `aria-describedby` | n/a | Zod 4.6.7 ya compartido [V-npm] | **Adoptar** para formularios cortos | [V-npm] |
| React Hook Form 7.92.0 + `@hookform/resolvers` 7.0.6 | MIT | 1.7 MB + 1.2 MB | Neutra | Muy alta | Los agentes de IA lo conocen bien. **No verifiqué** que el resolver 7.0.6 funcione con Zod 4.6.7 | **Probar** para fichas largas | [V-npm] |
| TanStack Form 1.33.5 | MIT | 0.57 MB | Neutra | Media-alta; tipado fuerte | Misma familia que Query | Probar solo si RHF falla en la prueba | [V-npm] |

### 3.4 Gráficos

| Opción | Licencia | Tamaño | Accesibilidad | Madurez | Encaje | Veredicto | Fuente |
|---|---|---|---|---|---|---|---|
| SVG propio (`Grafico`: barras, línea, anillo, indicador) | n/a | 0 | Se pone `role="img"` + `aria-label` + tabla de datos oculta | n/a | Colores por token, claro/oscuro sin trabajo extra | **Adoptar** (V1) | n/a |
| Recharts 3.10.1 | MIT | 7.5 MB (se importa por pieza) | Capa de accesibilidad incluida en v3 [Memoria] | Alta | Bueno | **Probar** cuando Reportes lo exija | [V-npm] |
| visx 4.0.0 | MIT | 12 KB (meta) | Depende de lo que se arme | Alta | Más bajo nivel; mucho código propio | Descartar (SVG propio da lo mismo) | [V-npm] |
| uPlot 1.6.32 | MIT | 0.55 MB | Canvas: mala | Media (última publicación 2025-03-14) | Series temporales enormes | Descartar | [V-npm] |
| Apache ECharts 6.1.0 | Apache-2.0 | 60 MB | Tiene modo accesible [Memoria] | Muy alta | Pesado | Descartar para V1 | [V-npm] |
| Tremor 3.18.7 | Apache-2.0 | 0.5 MB | n/a | Última versión conocida; **no verifiqué soporte de Tailwind 4/React 19** | Estética de "panel genérico" | Descartar | [V-npm] |
| Observable Plot 0.6.19 | ISC | 1.7 MB | SVG, aceptable | Alta | Orientado a exploración, no a producto | Descartar | [V-npm] |

### 3.5 Iconos, fuentes y fechas/monedas

| Opción | Licencia | Tamaño | Accesibilidad | Madurez | Encaje | Veredicto | Fuente |
|---|---|---|---|---|---|---|---|
| `lucide-react` 1.73.0 | ISC | 39 MB desempaq. (se importa por icono, árbol sacudible) | Decorativos con `aria-hidden`; con significado, `aria-label` | Publicado a diario (2026-11-14) | Trazo uniforme, buen peso | **Adoptar** (importar siempre por nombre) | [V-npm] |
| Phosphor 2.1.10 / Tabler 3.52.0 | MIT | 33 MB / 18.7 MB | Igual | Alta | Más estilos de trazo; más superficie | Descartar (una sola familia basta) | [V-npm] |
| SVG propios (archivo `iconos.tsx`) | n/a | ~0 | Igual | n/a | 30 a 50 iconos cubren V1; evita dependencia | **Alternativa sin dependencia** | n/a |
| `@fontsource-variable/manrope` y `/inter` 5.3.0 | OFL-1.1 | 97 KB / 1.9 MB (todos los alfabetos; el navegador baja solo los usados por `unicode-range` [Memoria]) | Texto legible, `font-display: swap` | Alta | Variables: 1 archivo por familia | **Adoptar** la variante *variable* (el §7 del documento de mercado nombra `@fontsource/manrope`, la versión no variable; la variable es más ligera en pedidos) | [V-npm] |
| `Intl` nativo (es-PE) | n/a | 0 | n/a | Baseline | **[V-prueba]** `es-PE` da `S/ 1,234.50`, fecha `14 nov. 2026`, relativo `ayer` | **Adoptar** | MDN |

### 3.6 Interacción: toasts, comandos, hoja inferior, arrastrar

| Opción | Licencia | Tamaño | Accesibilidad | Madurez | Encaje | Veredicto | Fuente |
|---|---|---|---|---|---|---|---|
| `notificar()` propio (región `aria-live="polite"` + popover) | n/a | ~1 KB | Controlada | n/a | Sin dependencia; control de posición sobre la barra inferior móvil | **Adoptar** | n/a |
| sonner 2.0.8 | MIT | 174 KB | Buena [Memoria] | Publicado 2026-08-09; 13.2k estrellas [V-doc] | Muy extendido; los agentes lo conocen | **Probar** (alternativa a escribir `notificar()`) | [V-npm] |
| `PaletaDeComandos` propia (patrón combobox/listbox ARIA) | n/a | ~3 KB | Se copia el **patrón de roles** que usa Odoo: `role="combobox"`, `aria-activedescendant`, `aria-expanded`, lista `role="listbox"` [V-código `core/commands/command_palette.xml`] | n/a | Encaja con "primero comandos" | **Adoptar** | n/a |
| cmdk 1.1.1 | MIT | 82 KB | Buena [Memoria] | **Última publicación 2025-08-27**; no encontré aviso de abandono; su FAQ pide React 18, **no vi mención de React 19** | Alternativa si se quiere filtrado difuso hecho | Probar | [V-npm], github.com/dip/cmdk |
| `HojaInferior` propia sobre `<dialog>` (+ CSS `transform`) | n/a | ~2 KB | `showModal()` vuelve el resto `inert` y maneja Esc [V-doc] | Baseline desde 2022 [V-doc] | Gesto de arrastrar para cerrar opcional | **Adoptar** | MDN `<dialog>` |
| Base UI Drawer | MIT | dentro de Base UI | Alta | Preview en 1.2.0, estable en 1.3.0 [V-doc] | Si se adopta Base UI | Alternativa | base-ui.com |
| vaul 1.1.2 | MIT | 184 KB | Buena | **README: «This repo is unmaintained»; última publicación 2024-12-14** [V-doc][V-npm] | n/a | **Descartar** | github.com/emilkowalski/vaul |
| `@dnd-kit/core` 6.3.1 + `sortable` 10.0.0 | MIT | 1.1 MB + 0.23 MB | Teclado, lectores y regiones vivas incluidos [V-doc] | Estable pero **sin publicar desde 2024-12-05** [V-npm]; el repo apunta al nuevo `@dnd-kit/react` **0.5.3 (0.x)** | Para Tablero (kanban) | **Probar** cuando llegue Tablero; siempre con alternativa de botones «Mover a…» (WCAG 2.5.7, AA [V-doc]) | github.com/clauderic/dnd-kit |

---

## 4. Patrones de Odoo y de otros sistemas que conviene reescribir propios

**Regla:** se estudia el patrón (estructura, comportamiento, nombres de roles ARIA, variables), se escribe desde cero en React y no se copia código, CSS, íconos ni textos (LGPL-3, ADR-006, regla 12). Todo lo marcado [V-código] lo leí en `addons/web/static/src`.

### 4.1 Odoo (cliente web)

| Patrón en Odoo [V-código] | Qué se observó | Pieza propia de Capaz | Cómo reescribirlo |
|---|---|---|---|
| Panel de control (`search/control_panel/control_panel.xml`) | Una barra con 3 zonas: migas de pan + botones principales (izquierda), acciones / acciones de selección (centro), paginador + conmutador de vistas (derecha). En móvil los botones se agrupan en un menú desplegable y el conmutador pasa a menú; las migas suben a la barra superior | `EncabezadoDePagina` | Un componente con 3 ranuras (`izquierda`, `centro`, `derecha`) que usa CSS (contenedores `@container`) y no JS para cambiar de disposición. Móvil: botón principal único + menú «más» |
| Migas de pan (`search/breadcrumbs`) | Historial de pantallas navegable | `MigasDePan` | `<nav aria-label="Ruta">` con `<ol>`; el último elemento lleva `aria-current="page"` |
| Búsqueda, filtros, agrupar (`search/search_bar`, `search_model.js`, `custom_group_by_item`) | Una caja con «facetas» (fichas) combinables; menús de filtro y agrupar; favoritos | `BarraDeBusqueda` + `Facetas` | Estado de búsqueda = objeto serializable en la URL (`?q=&estado=&agrupar=`) para que el botón Atrás y los enlaces funcionen. Cada faceta es un botón con `aria-label` «Quitar filtro X» |
| Paginador (`core/pager`) | «1-80 / 200» con anterior y siguiente | `Paginador` | Texto «1–80 de 200», botones de 44 px, `aria-label` en español |
| Vistas: lista, ficha, kanban, gráfico, pivote, calendario (`views/*`) | Una «vista» es un componente que recibe datos y estado de búsqueda | Plantillas `Lista`, `Ficha`, `Tablero`, `Grafico`; **pivote y calendario no entran en V1** | Cada plantilla es un componente de página; los módulos aportan columnas/campos como datos tipados, no XML |
| Campos por tipo (`views/fields/*`: monetary, many2one, statusbar, badge, priority, progress_bar, phone, relative_date, percentage, email, url, copy_clipboard…) | Un componente por tipo de dato, mismo contrato de props (`standard_field_props.js`) | `Monto`, `ClienteSelect`, `EstadoPill`, `Telefono`, `FechaRelativa`, `Progreso`, `Correo`, `Enlace`, `CopiarTexto` | Contrato común `{valor, modo: 'lectura'|'edicion', onCambio, error}`. Dinero: ver §7 |
| Barra de estados (`views/fields/statusbar`) | Lista de pasos como `role="radiogroup"`; cada paso `role="radio"`, `aria-checked`, `aria-current="step"`; los pasos que no caben pasan a un menú «Más…» | `BarraDeEstado` | Misma semántica de roles (patrón ARIA, no código). En móvil: solo el paso actual + menú con los demás |
| Avisos y diálogos (`core/notifications`, `core/dialog`, `core/confirmation_dialog`) | Notificaciones temporales; diálogo de confirmación con título, cuerpo, aceptar/cancelar | `notificar()`, `confirmar()` | `confirmar({titulo, cuerpo, peligro, textoConfirmar})` devuelve una promesa; para lo crítico exige escribir una palabra (§8.5) |
| Paleta de comandos (`core/commands`) | Combobox con categorías, prefijos de espacio de nombres, estado de carga y mensaje de vacío; en móvil el diálogo es `lg` | `PaletaDeComandos` | `Ctrl/Cmd+K`; categorías: «Ir a», «Crear», «Acciones»; el mismo registro de comandos alimenta voz y agente (ADR-005/009: una sola puerta) |
| Teclas rápidas (`core/hotkeys/hotkey_plugin.js`) | Registro central; se ignoran si hay un campo con foco salvo opt-in; Alt muestra superposiciones con la tecla | `useAtajo()` | Un solo `keydown` en `window`; no dispara dentro de `input`/`textarea` salvo `permitirEnCampo`; mostrar atajos en tooltips |
| Hoja inferior móvil (`core/bottom_sheet`) | Se cierra al arrastrar hacia abajo y se adapta al teclado virtual | `HojaInferior` | `<dialog>` + `dvh`/`visualViewport` para el teclado; animar con `transform`; respetar `prefers-reduced-motion` |
| Deslizador de acciones (`core/action_swiper`) | Gesto táctil izquierda/derecha con umbral (`swipeEffectiveThreshold = 10 px`), ignora si hay scroll horizontal, solo si el dispositivo es táctil | `DeslizarParaActuar` | Pointer Events (no solo `touch`); **siempre con botón equivalente visible** (WCAG 2.5.7); deshacer 5 s después de aprobar |
| Modo sin conexión y PWA (`core/offline`, `core/pwa`) | El almacenamiento local cifrado **se desactiva fuera de contexto seguro** (`FakeIndexedDB` en `offline_plugin.js`); error propio `NonSecureContextError` | `useConexion()` + cola de escrituras | Misma lección: **sin HTTPS no hay modo offline ni micrófono**; mostrar aviso claro |
| Variables de densidad y tokens | Existe una escala de densidad según el tipo de pantalla (táctil vs. escritorio) | Tokens `--tam-texto`, `--alto-control`, `--radio-*`, `--ancho-modal-*`, `--curva-entrada/salida` | Se toma solo la **idea** de una escala por tipo de puntero. **Todos los valores (tamaños, radios, anchos, curvas) son propios de Capaz y se definen en §6; no se copia ninguna cifra de Odoo** |
| Accesibilidad (`aria-*` en `control_panel.xml`, `list_renderer.xml`) | Roles en conmutador y estado; **varios botones solo con ícono y `title`**; el texto de `aria-label` está en inglés fijo («Statusbar», «Delete row») | Reglas del kit | Todo botón de ícono lleva `aria-label` en español; probar con lector de pantalla |

Hallazgo útil: Odoo cambia de componente según `uiService.isSmall` (JS). En Capaz conviene **preferir CSS** (contenedores y `@media (pointer: coarse)`) y dejar JS solo para el contenido que realmente cambia de estructura.

### 4.2 Otros sistemas (solo patrones; **no copiar**)

Lo que sigue lo verifiqué solo en parte; las páginas de Primer y Polaris que pude leer eran de navegación.

| Sistema | Qué estudiar | Estado de la evidencia | Pieza de Capaz |
|---|---|---|---|
| Frappe UI (ERPNext) | Kit MIT con Vue 3 + Tailwind (>=3.4 <4) + Reka UI; `List` con filas, celdas, grupos y orden; tokens con modo oscuro [V-doc GitHub]. Sus apps (CRM, Helpdesk) son referencia de ERP con pocos clics | Leído su README | `Lista` con grupos; tokens |
| Shopify Polaris | Ahora «construido sobre web components» [V-doc]; patrones conocidos: tabla con acciones masivas, barra de guardado contextual, estados vacíos con acción | Solo el primer dato verificado; el resto [Memoria] | `BarraDeSeleccion`, `BarraDeGuardado` |
| Atlassian Design System | Tabla dinámica, edición en línea, banner, lozenge (etiqueta de estado), flag (aviso) [V-doc]; la Tabla (Table) está marcada como «Caution» en su página | Leído el índice de componentes | `EstadoPill`, edición en línea |
| GitHub Primer | Prioriza «flujo, foco y experiencia rápida y compacta»; `DataTable`, `ActionList`, tokens con modos de color [V-doc, solo navegación] | Parcial | Densidad, `ListaDeAcciones` |
| Linear / Stripe Dashboard / Notion | Patrones por memoria: Linear (teclado primero, paleta, vistas guardadas), Stripe (tablas densas con filtros en fichas, detalle en panel lateral), Notion (bloques, vistas de base de datos) | **[Memoria], no consulté ninguna fuente hoy** | Paleta, fichas de filtro, panel lateral de detalle |

---

## 5. Patrones de producto para el «trabajador digital»

### 5.1 Bandeja de revisión de borradores
- Pieza: `BandejaDeRevision`. Cada borrador es una tarjeta con: qué entendió el agente (fuente: voz, WhatsApp, documento), campos clave en grande (monto, contacto, categoría), indicador de confianza **solo si es útil y calibrado** (si no, no mostrarlo: un porcentaje falso es peor que ninguno), y dos botones: **Aprobar** (primario, 44 px) y **Corregir** (abre `HojaInferior` con la ficha).
- Aprobar con un clic registra la herramienta con `ejecutar()` (regla 3). Tras aprobar: aviso «Aprobado · Deshacer» durante 5 s; el deshacer es una operación real y auditable, no un truco visual.
- Atajos de teclado en escritorio: `A` aprobar, `C` corregir, `J/K` siguiente/anterior. Móvil: **deslizar para aprobar** con botón equivalente (patrón de `action_swiper` de Odoo, que ya impone umbral e ignora scroll horizontal [V-código]; WCAG 2.5.7 exige alternativa sin arrastre, AA [V-doc]).
- Lote: «Aprobar todos los de confianza alta» solo si el usuario lo activa; confirmar con recuento («Vas a aprobar 12 borradores por S/ 3,420.00»).

### 5.2 Captura por voz (decisión de ingeniería importante)
Comparativa con lo verificado:

| Aspecto | Web Speech API (`SpeechRecognition`) | Grabar audio (`MediaRecorder`) y subir |
|---|---|---|
| Soporte | **No es Baseline** [V-doc MDN]; Chrome parcial, Safari parcial (con prefijo y Siri activo), **Firefox desactivado por defecto** [Proveedor: caniuse vía resultados] | **Baseline «ampliamente disponible» desde 2021** [V-doc MDN] |
| Privacidad | En Chrome el audio se envía a un servicio web de reconocimiento y **no funciona sin conexión** [V-doc MDN] | El audio va a **nuestro** servidor; nosotros elegimos proveedor (§6 de `MODULOS-Y-MERCADO.md`) |
| Calidad con ruido de taller | No controlable | Controlable, comparable (pista V del plan de voz) |
| Formato | Texto ya transcrito | Chrome/Firefox suelen dar WebM; **Safari históricamente MP4**; usar `MediaRecorder.isTypeSupported()` y `recorder.mimeType` [V-doc MDN con parte de memoria del documento leído] |
| Cambiar proveedor | Imposible | Sí (interfaz de conector) |

**Recomendación:** grabar y subir como camino principal (consistente con la decisión «el reconocimiento es un conector más»), y **Web Speech API solo como mejora opcional de vista previa en vivo** si el usuario la quiere. Respaldo siempre: caja de texto (teclado o dictado del teléfono).

Requisitos y estados del componente `BotonDeVoz`:
- `getUserMedia` exige **contexto seguro** (HTTPS o `localhost`); el permiso se pide con un gesto del usuario. Si se niega: `NotAllowedError`; si no hay micrófono: `NotFoundError` [V-doc MDN].
- Estados visibles y anunciados: `inactivo` → `pidiendo permiso` → `grabando` (contador de tiempo, nivel de volumen, botón «Detener») → `subiendo` (progreso, cancelable) → `transcribiendo` → `borrador listo` o `error` (mensaje en español + «Reintentar» + «Escribir en su lugar»).
- Accesibilidad: botón con `aria-pressed`, estado en `aria-live="polite"`, ningún efecto solo visual; no depender del color; tamaño 56 px en móvil.
- Mala señal: guardar el audio local (IndexedDB) hasta confirmar la subida; reintentar con espera creciente; mostrar «Pendiente de enviar (2)».
- Límites: duración máxima y tamaño; avisar antes de cortar.
- iOS Safari: el micrófono solo desde un gesto y en pestaña activa; **no verifiqué** el comportamiento con la app instalada como PWA.

### 5.3 Estados vacíos que enseñan, y «ejemplo»
- `EstadoVacio`: ilustración sobria (SVG propio simple, no genérico), una frase que dice **qué va a aparecer aquí y por qué es útil**, y **una acción primaria** («Dicta tu primer gasto»). Odoo hace algo parecido con `no_content_helpers.xml` y con ejemplos de kanban (`kanban_examples_dialog`) [V-código].
- Datos de ejemplo: insignia **«Ejemplo»** visible (texto, no solo color), borde punteado, nunca se mezclan con datos reales en totales ni reportes, y se borran con un clic («Quitar ejemplos»). Los ejemplos viven solo en el cliente o en una marca `es_ejemplo` en el servidor; decidir con el usuario (pregunta 8).

### 5.4 Indicador de guardado y cola de escrituras
- `IndicadorDeGuardado` con 4 estados: `guardado` · `guardando…` · `sin conexión, se enviará` · `error, reintentar`. Siempre visible en la barra superior de la ficha; texto + icono; cambios anunciados con `aria-live="polite"` sin repetir en cada pulsación.
- Cola en serie: TanStack Query ofrece `scope: { id }` en mutaciones; las que comparten `id` **se ejecutan una tras otra** y las siguientes esperan pausadas [V-doc]. Usar un `id` por ficha o por entidad. Con `retry` activado, las mutaciones que fallan por falta de red se reintentan **en el orden original** al volver la conexión [V-doc]. Para sobrevivir a recargas hay que persistir las mutaciones pausadas (`dehydrate`/`hydrate`, `persistQueryClient`) y registrar `setMutationDefaults` con un `mutationFn` por defecto para evitar «No mutationFn found» [V-doc]. Eso exige paquetes adicionales (`@tanstack/query-persist-client-core` y un almacenamiento) que **no verifiqué ni están aprobados**.
- Idempotencia: cada escritura lleva una clave de idempotencia generada en el cliente para que un reintento no duplique un gasto (requiere soporte del servidor; pregunta 9).
- Odoo desactiva la persistencia sin contexto seguro [V-código]; hacer lo mismo y avisarlo.

### 5.5 Confirmaciones críticas en dos pasos
- Reservar para acciones **irreversibles o de dinero/legal** (anular comprobante, borrar empresa, enviar a SUNAT cuando exista). Para el resto, usar «Deshacer» (menos fricción, igual de seguro si el deshacer es real).
- Paso 1: diálogo que **repite el efecto con cifras** («Anularás la factura F001-123 por S/ 1,180.00»). Paso 2: escribir una palabra o mantener pulsado 1,5 s (alternativa con teclado: escribir la palabra). Botón destructivo con texto del verbo, nunca «Aceptar».

---

## 6. Arquitectura frontend propuesta

### 6.1 Estructura de carpetas

```
apps/web/src/
  app/                  rutas, proveedores, carcasa
    rutas.tsx           árbol de rutas con lazy() por módulo
    proveedores.tsx     QueryClient, tema, i18n, notificaciones
    carcasa/            AppShell, MenuLateral, BarraSuperior, BarraInferiorMovil
  core/                 lo transversal sin interfaz propia
    api/                cliente HTTP tipado (usa @capaz/shared), manejo de errores
    sesion/             usuario, empresa, permisos (vienen del servidor)
    cola/               cola de escrituras, useConexion, reintentos
    i18n/               textos es-PE, formatos (dinero, fecha, relativo)
    tema/               script anti-parpadeo, useTema
    atajos/             useAtajo, registro de comandos
  shared/               kit reutilizable, sin lógica de negocio
    ui/                 Boton, Campo, Tabla, Lista, Ficha, HojaInferior, ...
    tokens.css          @theme claro/oscuro (único lugar de colores)
    hooks/              useMedia, useDebounce
  modules/              un directorio por módulo (igual que apps/api)
    registro/
      paginas/          Bandeja.tsx, Captura.tsx
      componentes/
      api.ts            hooks de TanStack Query del módulo
      index.ts          exporta rutas + comandos + entradas de menú
  main.tsx
```
Reglas: `modules/x` **no importa** de `modules/y` (igual que la regla 7 de la API); `shared` no importa de `modules` ni de `core/sesion`; todo módulo declara en `index.ts` sus rutas, entradas de menú y comandos de la paleta (manifiesto de frontend). Archivos de más de 500 líneas se dividen (regla 11).

### 6.2 ¿Paquete compartido de UI?
- **Ahora:** dentro de `apps/web/src/shared/ui`. Solo hay una aplicación; un paquete aparte añade configuración sin beneficio.
- **Cuando exista una segunda interfaz** (consola de plataforma, portal de clientes, `PLATAFORMA-Y-PLANES.md`): mover a `packages/ui` con exportaciones por componente. Lo que sí va en `@capaz/shared` desde ya: esquemas Zod, códigos de error, tipo `Centimos` y formateadores puros (sin React). Pregunta 4.

### 6.3 Tokens de diseño (ejemplo corto de `@theme`)

Capas: primitivos (paleta cruda) → semánticos (superficie, texto, borde, acción, estados) → de componente (solo si hace falta). Las utilidades solo usan nombres semánticos; se borra la paleta por defecto.

```css
/* shared/tokens.css */
@import "tailwindcss";
@custom-variant dark (&:where([data-tema=oscuro], [data-tema=oscuro] *));

@theme {
  --color-*: initial;                       /* nadie usa bg-red-500 */

  /* semánticos: los valores cambian por tema mediante variables */
  --color-fondo:       var(--c-fondo);
  --color-superficie:  var(--c-superficie);
  --color-borde:       var(--c-borde);
  --color-texto:       var(--c-texto);
  --color-texto-suave: var(--c-texto-suave);
  --color-accion:      var(--c-accion);      /* esmeralda */
  --color-accion-texto:var(--c-accion-texto);
  --color-peligro:     var(--c-peligro);
  --color-aviso:       var(--c-aviso);
  --color-menu:        var(--c-menu);        /* azul noche */

  --font-sans: "Inter Variable", system-ui, sans-serif;
  --font-titulo: "Manrope Variable", "Inter Variable", system-ui, sans-serif;
  --radius-control: 0.5rem;
  --radius-tarjeta: 0.75rem;
  --shadow-elevada: 0 1px 2px rgb(0 0 0 / .06), 0 4px 12px rgb(0 0 0 / .08);
}

:root {                                      /* claro */
  --c-fondo: oklch(0.985 0.003 250);
  --c-superficie: oklch(1 0 0);
  --c-borde: oklch(0.9 0.008 250);
  --c-texto: oklch(0.22 0.02 255);
  --c-texto-suave: oklch(0.45 0.02 255);
  --c-accion: oklch(0.52 0.12 165);
  --c-accion-texto: oklch(1 0 0);
  --c-peligro: oklch(0.55 0.2 27);
  --c-aviso: oklch(0.6 0.14 80);
  --c-menu: oklch(0.25 0.06 255);
  --alto-control: 2.75rem;                   /* 44 px */
  --tam-texto: 1rem;
}
:root[data-tema=oscuro] {
  --c-fondo: oklch(0.18 0.015 255);
  --c-superficie: oklch(0.23 0.02 255);
  --c-borde: oklch(0.32 0.02 255);
  --c-texto: oklch(0.95 0.005 250);
  --c-texto-suave: oklch(0.74 0.015 250);
  --c-accion: oklch(0.72 0.14 165);
  --c-accion-texto: oklch(0.18 0.015 255);
  --c-peligro: oklch(0.72 0.17 27);
  --c-aviso: oklch(0.8 0.13 85);
  --c-menu: oklch(0.15 0.04 255);
}
@media (pointer: fine) { :root { --alto-control: 2.25rem; --tam-texto: 0.9rem; } } /* densidad escritorio */
```
Notas honestas: (a) los valores de color son **ilustrativos, no verificados contra el contraste**; se miden con la prueba de §10; (b) el patrón `@theme` con `var(--c-…)` más variables en `:root` es el que describe la documentación para tokens que cambian en runtime, pero **no lo compilé** en este proyecto; (c) la densidad de la maqueta (14.5 px escritorio / 16 px táctil) es propia: decidir si se usa `pointer: fine`/`coarse` o interruptor manual (pregunta 6).

Escala sugerida: texto 12/13/14.5/16/18/22/28; espaciado base 4 px (`--spacing`); radios 8/12 px y completo; sombras 2 niveles; duraciones 120/200/320 ms; curvas de entrada/salida propias (`ease-out` estándar de CSS como punto de partida), todo bajo `@media (prefers-reduced-motion: reduce)` sin animaciones de desplazamiento.

### 6.4 Tema claro/oscuro sin parpadeo
Un script **inline y bloqueante** en `index.html`, antes del CSS, que lee `localStorage.tema` (`claro | oscuro | sistema`), consulta `matchMedia('(prefers-color-scheme: dark)')` y pone `data-tema` en `<html>` antes del primer pintado; `color-scheme: light dark` en `:root` para controles nativos. Envolver `localStorage` en `try/catch`. React solo lee el atributo después. [Memoria: patrón estándar; probarlo en 390 y 1280 px con la caché vacía.]

### 6.5 i18n mínimo
- Ahora: diccionario TypeScript por módulo (`es-PE`), funciones `t('clave', params)` propias de ~30 líneas y **plurales con `Intl.PluralRules`**; sin librería. Textos nunca sueltos en JSX en pantallas de producción; los identificadores de claves en español sin tildes.
- Preparado para otros: `LocaleActual` en `core/i18n`; los formateadores reciben el locale. Si se llegara a necesitar mensajes con sintaxis ICU, evaluar `react-intl`/`i18next` entonces (**no consultados hoy**).

### 6.6 Dinero en céntimos (verificado)
**[V-prueba]** en Node 24.19: `Intl.NumberFormat('es-PE',{style:'currency',currency:'PEN'}).format("1234.50")` da `S/ 1,234.50`. Función exacta sin decimales flotantes: partir los `bigint` de céntimos en soles y céntimos y pasar **una cadena decimal** a `format`:

```ts
// core/i18n/dinero.ts  (puro; el tipo Centimos viene de @capaz/shared)
const f = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
export function formatearCentimos(c: bigint): string {
  const neg = c < 0n, a = neg ? -c : c;
  return f.format(`${neg ? '-' : ''}${a / 100n}.${String(a % 100n).padStart(2, '0')}`);
}
```
Resultados probados: `123450n → S/ 1,234.50`, `5n → S/ 0.05`, `-99999999999999999n → -S/ 999,999,999,999,999.99`. **Trampa que cometí y corregí en la prueba:** dividir `123450n / 100n` descarta los céntimos; no convertir nunca a `number`. Qué **no verifiqué**: que todos los navegadores objetivo acepten una cadena decimal en `format()` (es parte de Intl.NumberFormat v3; confirmar en Safari de iOS). Entrada del usuario: un `InputDeMonto` que parsea texto a céntimos con regex y rechaza más de 2 decimales.

### 6.7 Accesibilidad WCAG 2.2 AA (reglas del kit)
Niveles verificados en el texto oficial [V-doc W3C WCAG 2.2]: **2.5.8 Tamaño de objetivo (mínimo) AA**, **2.4.11 Foco no oculto (mínimo) AA**, **2.5.7 Movimientos de arrastre AA**, **3.3.8 Autenticación accesible (mínimo) AA**, **2.4.13 Apariencia del foco AAA** (algunos blogs lo ponen en AA: se equivocan).
- Tamaño táctil: el AA pide 24×24 px; **nuestra regla propia es 44 px** (corresponde al AAA 2.5.5; lo adoptamos por uso con guantes/taller).
- Foco: anillo visible de 2 px con contraste ≥3:1 en ambos temas; con barras fijas (cabecera, barra inferior móvil) usar `scroll-padding` para no ocultar el foco (2.4.11).
- Arrastrar (Tablero, deslizar): siempre alternativa por botones (2.5.7).
- Contraste: texto 4.5:1, grande y componentes 3:1; verificar en claro y oscuro. No usar solo color para estados (`EstadoPill` lleva texto).
- Tablas: `<caption>` o `aria-label`, `<th scope="col">`, `aria-sort`, en móvil las tarjetas conservan el orden de lectura.
- Autenticación: permitir pegar y gestores de contraseñas (3.3.8).
- Etiquetas de campos, errores asociados con `aria-describedby`, mensajes en español. `lang="es"` ya está en `index.html` [V-código].

### 6.8 Rendimiento
- `React Router` con `lazy()` por módulo (cada `modules/x` es un trozo); precargar el siguiente al pasar el cursor o en reposo. Prefetch de datos con Query.
- Presupuesto propuesto (a confirmar): entrada <150 KB JS comprimido; cada módulo <60 KB; LCP <2.5 s y INP <200 ms en un teléfono de gama media con 4G lenta (objetivos de Core Web Vitals [Memoria]; medir con Lighthouse en la prueba).
- Fuentes: `font-display: swap`, solo pesos variables necesarios, precarga de la fuente del texto.
- Medir el bundle con `vite build` + un visualizador (**no instalado**; alternativa sin dependencia: revisar tamaños de `dist/assets`).
- No cargar librerías de gráficos ni de arrastre en la ruta de entrada.

### 6.9 Pruebas sin e2e y revisión visual
- Componentes: Vitest + `@testing-library/react` 16.3.3 + `@testing-library/user-event` 14.6.10 + `@testing-library/jest-dom` 7.0.1, con `jsdom` 31.0.1 o `happy-dom` 21.0.4 [V-npm]. Probar por comportamiento (roles, texto), no por clases.
- Accesibilidad automática: `axe-core` 4.14.0 [V-npm] puede llamarse directo desde la prueba; `jest-axe` 11.0.0 existe pero `vitest-axe` está en 0.1.0 sin cambios desde 2025-01 [V-npm]; verificar compatibilidad antes de decidir. axe no detecta todo (no sustituye la revisión con lector de pantalla).
- Contrato: esquemas Zod de `@capaz/shared` probados con casos válidos e inválidos; el mismo esquema valida respuesta de API en el cliente.
- Revisión visual: **página interna `/kit`** (solo en desarrollo, fuera del build de producción por `import.meta.env.DEV`) con todos los componentes y estados (vacío, cargando, error, largo, teclado, oscuro), que una persona abre a 390 y 1280 px. Cumple la regla 17 sin navegador automatizado.
- **Storybook no recomendado:** su modo de pruebas usa Playwright por defecto [V-doc storybook.js.org/docs/writing-tests] y las pruebas visuales automáticas pasan por Chromatic (servicio externo, regla 14); la página `/kit` hace el 90 % de lo útil sin dependencias (`@storybook/react-vite` 10.6.7 [V-npm], desempaquetado 32 KB pero arrastra un ecosistema grande [Memoria]).

---

## 7. Cómo debe lucir y sentirse (2026)

Resumen de tendencias frente a la evidencia: **no verifiqué ninguna con fuentes fuertes**; son criterios de diseño, no hechos. Las cifras de mercado ya citadas en `MODULOS-Y-MERCADO.md` §2.1 no se repiten.

1. **Densidad adaptable:** dos densidades (cómoda en táctil, compacta en escritorio) por token, no por componente. es una práctica común en interfaces adaptables.
2. **Oscuro de verdad:** superficies elevadas más claras, bordes en lugar de sombras, texto 90 % blanco (no #FFF), acento esmeralda con luminosidad más alta.
3. **Primero comandos:** `Ctrl+K` para ir y crear; la voz usa el mismo registro.
4. **IA con aprobación, no chat:** el agente deja borradores en la bandeja; nunca un chat flotante genérico. Cada borrador muestra de dónde salió (origen), y «Corregir» enseña al sistema (registrar la corrección).
5. **Microinteracciones sobrias:** 120 a 200 ms, solo `transform`/`opacity`, respetar `prefers-reduced-motion`; confirmar acciones con cambio de estado visible (la fila aprobada se desliza y deja un hueco «Aprobado · Deshacer»).
6. **Móvil real:** una mano, objetivos de 44 px, acciones principales abajo (barra inferior), hojas inferiores en vez de modales, teclado virtual que no tapa el campo.
7. **Evitar el aspecto «genérico de IA»:** no degradados morados, no tarjetas idénticas con icono en círculo, no emojis; usar jerarquía tipográfica (Manrope en títulos), cifras tabulares (`font-variant-numeric: tabular-nums`) en tablas y montos, color de acento usado con moderación, y vocabulario del oficio gráfico (pliego, tinta, orden de trabajo) en estados vacíos y etiquetas.
8. **Identidad:** resolver el choque «Pliego» vs. «azul noche + esmeralda» (pregunta 1).

---

## 8. Dependencias propuestas (versión exacta consultada en npm, 2026-11-14)

Ninguna está aprobada. Versiones exactas para fijar (sin `^`) si se aprueban. La alternativa sin dependencia es lo que se haría si el usuario dice «no».

| Paquete | Versión | Licencia | Para qué | Prioridad | Alternativa sin dependencia |
|---|---|---|---|---|---|
| `@tanstack/react-query` | 5.107.1 | MIT | Datos, caché, mutaciones en serie | **Necesaria** (ya nombrada en la pila de §7 de mercado) | `fetch` + estado propio (mucho código) |
| `@tanstack/react-table` | 9.3.1 | MIT | Orden, filtro, agrupar, paginar | Alta | Tabla propia con `Array.sort/filter` para listas simples |
| `zod` | 4.6.7 | MIT | Esquemas compartidos | **Ya es parte de la pila** | n/a |
| `lucide-react` | 1.73.0 | ISC | Iconos | Alta | `iconos.tsx` con SVG propios |
| `@fontsource-variable/manrope` | 5.3.0 | OFL-1.1 | Fuente de títulos | Alta | Fuentes del sistema (pierde la identidad) |
| `@fontsource-variable/inter` | 5.3.0 | OFL-1.1 | Fuente de texto | Alta | `system-ui` |
| `zustand` | 5.1.0 | MIT | Estado de pantalla (ya nombrado) | Media | `useState` + contexto |
| `@base-ui/react` | 1.9.0 | MIT | Select/Combobox/Menu/Drawer accesibles | **Condicional**: solo si `<dialog>`/`popover` no alcanzan | `<dialog>`, `popover`, `<select>` nativos |
| `@tanstack/react-virtual` | 3.14.26 | MIT | Listas largas | Condicional | Paginación (suele bastar) |
| `react-hook-form` + `@hookform/resolvers` | 7.92.0 + 7.0.6 | MIT | Fichas largas | Condicional; **compatibilidad con Zod 4.6.7 sin verificar** | `FormData` + `safeParse` |
| `sonner` | 2.0.8 | MIT | Toasts | Opcional | `notificar()` propio |
| `@dnd-kit/core` + `@dnd-kit/sortable` | 6.3.1 + 10.0.0 | MIT | Tablero | Solo al llegar Tablero | Botones «Mover a…» (siempre necesarios) |
| `recharts` | 3.10.1 | MIT | Gráficos | Solo si Reportes lo exige | SVG propio |
| Pruebas (dev): `@testing-library/react` 16.3.3, `@testing-library/user-event` 14.6.10, `@testing-library/jest-dom` 7.0.1, `jsdom` 31.0.1, `axe-core` 4.14.0 | — | MIT | Pruebas de componentes y accesibilidad | Alta (dev) | `vitest` solo, sin DOM (poco útil para UI) |
| Descartadas | `vaul` (sin mantenimiento), AG Grid (de pago para lo útil), Mantine, Ant, Chakra, DaisyUI, UnoCSS, Panda, Open Props, Tremor, ECharts, uPlot, Storybook | | | | |
| Verificar antes de decidir | `cmdk` 1.1.1 (sin publicar desde 2025-08; React 19 no confirmado) | | | | `PaletaDeComandos` propia |

Mínimo para empezar la fase 6a: `@tanstack/react-query`, `lucide-react`, las dos fuentes y las dependencias de prueba. Todo lo demás se pide cuando la pieza lo exija.

---

## 9. Riesgos, lo que NO verifiqué, y preguntas abiertas

### 9.1 Riesgos
1. **Escribir un kit propio cuesta tiempo** (2 personas + agentes). Mitigación: kit pequeño y priorizado (Boton, Campo, Lista, Ficha, HojaInferior, EstadoVacio) y adopción de Base UI en cuanto una pieza propia pase de ~150 líneas por accesibilidad.
2. **Accesibilidad de componentes propios** (selectores, menús): es donde más se falla. Por eso la condicionalidad de Base UI.
3. **TanStack Table v9 es reciente** (estable 2026-08-04 [V-doc]) y los agentes de IA pueden escribir sintaxis de v8 (`useReactTable`): exigir leer la guía de migración de v9 antes de usarla (regla 1 de `AGENTS.md`).
4. **Mala señal en taller:** cola y reintentos no persistentes se pierden al recargar; la persistencia añade paquetes y complejidad.
5. **Voz:** diferencias de formato (Safari MP4) y permisos; HTTPS obligatorio.
6. **Dependencias estancadas:** `cmdk` y `@dnd-kit/core` sin publicaciones recientes; `vaul` abandonado [V-npm/V-doc].
7. **Tailwind 4 `@theme` + variables en runtime**: la combinación es delicada; probar antes de extender.

### 9.2 Lo que no verifiqué
- Tamaños reales de bundle (solo tamaño desempaquetado de npm).
- Compatibilidad de `@hookform/resolvers` 7.0.6 con Zod 4.6.7; de `cmdk` con React 19; de Tremor con Tailwind 4; de `vitest-axe`/`jest-axe` con Vitest 4.
- Contenido del cuerpo de «Base UI as the Default» de shadcn (julio 2026): solo vi el título; el resto viene de blogs [Proveedor].
- Linear, Stripe, Notion y Polaris en detalle; contenido de Primer más allá de su portada; licencias de Primer, Polaris y Atlassian (el ADR-006 ya dice que se confirmen).
- Core Web Vitals objetivos y práctica del script anti-parpadeo: de memoria, no medidos.
- Comportamiento de micrófono en iOS Safari como PWA; soporte de `format(string)` en navegadores objetivo.
- Calidad de lectura con lector de pantalla (NVDA, VoiceOver): requiere persona.
- Código de Odoo: leí cabeceras y plantillas de `control_panel`, `action_swiper`, `bottom_sheet`, `statusbar`, `command_palette`, `hotkey_plugin`, `offline_plugin` y `primary_variables.scss`; **no** leí `list_renderer.js` ni el modelo de datos completo. No copié nada.

### 9.3 Preguntas abiertas para el usuario
1. **Identidad visual:** ¿«Pliego» (papel cálido, CMY) o «azul noche + esmeralda» (maqueta v2)? El CSS actual y el documento de mercado dicen cosas distintas.
2. **Primitivas:** ¿aprobar `@base-ui/react` ya, o empezar solo con `<dialog>`/`popover` nativos y decidir tras la prueba?
3. **Formularios:** ¿cero dependencias (Zod + FormData) o aprobar React Hook Form?
4. **Paquete de UI:** ¿`apps/web/src/shared/ui` ahora (recomendado) o `packages/ui` desde el inicio por la consola de plataforma?
5. **Dependencias mínimas** (§8): ¿aprobar `@tanstack/react-query`, `@tanstack/react-table`, `lucide-react`, las dos fuentes variables y las de pruebas?
6. **Densidad:** ¿automática por `pointer` (escritorio compacto / táctil cómodo) o con un interruptor manual de usuario?
7. **Voz:** ¿grabar y subir como camino principal, con Web Speech API solo opcional? ¿Quién provee HTTPS en el piloto (no hay micrófono sin él)?
8. **Datos de ejemplo:** ¿viven solo en el cliente o con marca `es_ejemplo` en el servidor?
9. **Escrituras con mala señal:** ¿se acepta una clave de idempotencia por escritura (cambio en la API) y persistir la cola en el dispositivo?
10. **Storybook:** ¿se confirma el descarte en favor de la página `/kit`?
11. **Aprobar-con-deslizar:** ¿en V1 o solo botones al inicio?
12. **Vitest 5.1.0 está publicado:** ¿se mantiene 4.1.2 hasta nueva orden?

---

## 10. Plan de prueba de 1 día (descrito, no ejecutado)

Objetivo: validar en un día que la pila funciona en claro/oscuro a 390 y 1280 px, sin tocar el código de producción: rama o carpeta aparte con aprobación del usuario para las dependencias.

**Mañana (4 h): base**
1. (30 min) `tokens.css` con el `@theme` de §6.3, script anti-parpadeo en `index.html`, interruptor Claro/Oscuro/Sistema. **Criterio:** recargar con caché vacía en oscuro no muestra destello blanco; `bg-fondo`, `text-texto` cambian con el tema (si no cambian, probar la variante `@theme inline`).
2. (60 min) Ruta `/kit` solo en desarrollo con: `Boton` (4 tipos, 3 tamaños, cargando, desactivado), `Campo` (texto, monto, teléfono, error), `EstadoPill`, `Monto` con `formatearCentimos`, iconos (`lucide-react` y 5 SVG propios), fuentes variables.
3. (90 min) `Lista` con TanStack Table v9: 200 filas de ejemplo, orden, filtro, agrupar, paginar; tabla a 1280 px y tarjetas a 390 px; con y sin `@tanstack/react-virtual` a 2000 filas.
4. (60 min) `HojaInferior` sobre `<dialog>` (arrastrar para cerrar, teclado virtual simulado con campo al fondo), `PaletaDeComandos` propia, `notificar()` propio; opcionalmente sonner y Base UI Drawer lado a lado para comparar.

**Tarde (4 h): trabajador digital y medición**
5. (60 min) `BandejaDeRevision` con 5 borradores de ejemplo («Ejemplo» marcado): aprobar, corregir, deslizar con botón equivalente, deshacer 5 s.
6. (45 min) `BotonDeVoz` con `MediaRecorder`: todos los estados (permiso negado, sin micrófono, subiendo simulado, error). Probar en un teléfono real por HTTPS; anotar tipo MIME obtenido en Android y en iPhone.
7. (45 min) `IndicadorDeGuardado` + mutaciones con `scope` contra una API simulada que falla el 40 % de las veces; modo avión en el navegador; ver orden de reintentos.
8. (30 min) Pruebas con Vitest: `formatearCentimos`, `Lista` (orden/filtro), `Campo` (aria-invalid), axe en 3 componentes.
9. (60 min) Medición y revisión visual (ver abajo).

**Cómo revisarla (persona, a mano)**
- Chrome DevTools en modo dispositivo: **390 × 844** y **1280 × 800**, claro y oscuro (4 combinaciones) por cada sección del `/kit`. Marcar en una tabla: sin desbordamiento horizontal, texto legible, foco visible con Tab, objetivos de 44 px (regla visual o inspección), sin destello al recargar.
- Teclado: Tab, Shift+Tab, Esc, flechas en paleta y menús, `Ctrl+K`.
- Lector de pantalla (NVDA en Windows o VoiceOver en iPhone si hay): bandeja, tabla, paleta, estado de guardado.
- Contraste: inspector de Chrome (selector de color con ratio) sobre texto y bordes en ambos temas.
- Rendimiento: `vite build`, anotar tamaño de la entrada y de cada trozo; Lighthouse móvil en la ruta `/kit` y en una ruta mínima.
- **Salida esperada:** una tabla «pieza · 390 claro · 390 oscuro · 1280 claro · 1280 oscuro · notas», más una decisión por cada fila de la sección 8 (adoptar, quedarse en propio, descartar) y la lista de lo que falló.

---

## 11. Fuentes consultadas (2026-11-14)

Oficiales o de documentación ([V-doc]):
- Tailwind: https://tailwindcss.com/docs/theme · https://tailwindcss.com/docs/dark-mode
- Base UI: https://base-ui.com/react/overview/releases
- shadcn/ui changelog: https://ui.shadcn.com/docs/changelog
- React Aria: https://react-aria.adobe.com/
- TanStack Table v9: https://tanstack.com/blog/announcing-tanstack-table-v9 · Query mutaciones: https://tanstack.com/query/latest/docs/framework/react/guides/mutations
- AG Grid: https://www.ag-grid.com/javascript-data-grid/community-vs-enterprise/
- vaul: https://github.com/emilkowalski/vaul · sonner: https://github.com/emilkowalski/sonner · cmdk: https://github.com/dip/cmdk · dnd-kit: https://github.com/clauderic/dnd-kit · Frappe UI: https://github.com/frappe/frappe-ui
- MDN: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition · https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Recording_API · https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog · https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat
- W3C WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Storybook: https://storybook.js.org/docs/writing-tests
- Atlassian: https://atlassian.design/components · Primer: https://primer.style/product/getting-started/ · Polaris: https://shopify.dev/docs/api/polaris

Blogs y resultados de búsqueda ([Proveedor], orientativos): comparativas shadcn/Base UI/Radix en dev.to, pkgpulse, uxmagic y daisyui.com/compare (la fecha «julio 2026» del cambio de valor por defecto de shadcn coincide con el título del changelog oficial, pero el detalle no lo leí); caniuse (vía resultados de búsqueda) para el soporte de SpeechRecognition; InfoQ para el beta de TanStack Table v9 (la nota oficial de agosto lo declara estable).

Código local (solo lectura): `/home/datayros/Documentos/work/modules/odoo/addons/web/static/src/` (`search/control_panel`, `core/action_swiper`, `core/bottom_sheet`, `core/commands`, `core/hotkeys`, `core/offline`, `views/fields/statusbar`, `scss/primary_variables.scss`).
