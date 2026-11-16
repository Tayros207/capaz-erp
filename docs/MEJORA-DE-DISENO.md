# Propuesta · Mejorar el diseño de Capaz ERP

**Fecha:** 2026-11-16 · **Estado: PROPUESTA** (el usuario pidió mejorar el diseño porque lo ve «muy básico»; aún no aprobó el alcance). No toca código: lo ejecuta el integrador (modules-5a) cuando el usuario confirme.

## 1. Qué se ve hoy (capturas del kit y del acceso, 1280 px, claro)

- Fondo gris casi blanco, tarjetas blancas, borde fino y un único verde. Todo plano, sin jerarquía ni profundidad.
- Tipografía **del sistema** (`tokens.css` líneas 46–48): ninguna personalidad; títulos y texto se parecen.
- Botones y campos correctos pero genéricos; sin estados de foco y movimiento cuidados.
- Acceso: tarjeta blanca sobre azul liso; sin marca ni mensaje.
- Lo bueno: **todo el color, la fuente y la medida están en un solo archivo** (`apps/web/src/shared/estilos/tokens.css`) y los componentes usan nombres semánticos. Cambiar la identidad es barato y no rompe las pantallas.

## 2. Dirección propuesta

Una identidad «ERP moderno con apariencia familiar» (decisión del usuario del 2026-11-15), no un tema llamativo:

| Pieza | Hoy | Propuesta |
|---|---|---|
| **Tipografía** | Sistema | Una familia variable (p. ej. Inter o Manrope, licencia OFL, ya citada en `FRONTEND-INVESTIGACION.md`), números **tabulares** en montos y tablas, títulos más firmes |
| **Color** | Verde + gris | Neutros con un leve tono azul; un solo color de acción; **acento por módulo** (ya definido en tokens) usado en el menú, insignias y encabezados de cada módulo |
| **Profundidad** | Plana | Tres niveles: fondo, tarjeta, elemento flotante; sombras suaves y radios coherentes (6/10/14 px) |
| **Densidad** | Una sola | Tablas compactas en escritorio y tarjetas legibles en celular; ya existe el kit de tablero |
| **Menú lateral** | Azul noche | Mantener, con iconos por módulo, color de acento al activo y modo plegado |
| **Inicio** | Lista | Panel con cifras clave (cobrar hoy, caja, pedidos atrasados, borradores), accesos rápidos y actividad reciente |
| **Estados** | Mínimos | Vacíos con ilustración y una acción; cargas con esqueleto; errores con salida clara; toasts |
| **Movimiento** | Casi ninguno | Transiciones breves (120–200 ms) en hojas, menús y listas; respeta «reducir movimiento» |
| **Acceso y marca** | Tarjeta sobre azul | Logo Capaz, frase de valor, fondo con la identidad; misma pieza para registro y restablecer |
| **Modo oscuro** | Existe | Revisarlo pantalla por pantalla (contrastes) |

Accesibilidad que no se negocia: contraste AA, objetivo táctil de 44 px (ya fijado), foco visible, navegación por teclado, 390 y 1280 px.

## 3. Cómo se hace (orden, de más barato a más caro)

1. **Tokens y tipografía** (un archivo): nueva paleta, fuente, sombras, radios. Efecto inmediato en todo el sistema. Esfuerzo S.
2. **Piezas del kit** (`shared/ui`: botón, campo, tarjeta, insignia, tablero, hoja, diálogo, vacío, esqueleto): estados, foco, densidad, movimiento. Esfuerzo M.
3. **Carcasa** (menú, barra superior, migas, selector de empresa, barra inferior móvil). Esfuerzo M.
4. **Inicio con panel de cifras** y acceso con marca. Esfuerzo M.
5. **Pasada por módulo** (Finanzas, CRM, Pedidos, Inventario, Compras, Personal, Reportes, Plataforma): encabezados con acento, tablas, formularios. Esfuerzo M repartido, 1–2 módulos por carril.
6. **Revisión visual humana** a 390 y 1280 px, claro y oscuro (la hace el usuario; el constructor no puede).

Reglas: sin e2e (regla del usuario); las pruebas existentes de lógica siguen en verde; sin dependencias nuevas salvo la fuente y, si se aprueba, un conjunto de iconos (ya hay `iconos.tsx`); no copiar diseño de otro ERP (regla 12).

## 4. Decisiones que necesita el usuario

1. **Identidad:** ¿mantener «azul noche + esmeralda» (la actual, refinada) o probar otra? Pendiente desde `FRONTEND-INVESTIGACION.md` (pregunta 1; quedó entre «Pliego» y «azul noche»).
2. **Referencias:** una o dos pantallas de otros sistemas que le gusten (para fijar el nivel de «no básico»). Sin esto el resultado es mi criterio.
3. **Alcance:** solo los pasos 1–4 (rápido, todo el sistema cambia de aspecto) o también el 5 (pulido por módulo).
4. **Prioridad frente a la ronda 1** (documentos imprimibles, datos de empresa, adelanto): ¿antes, en paralelo o después? Recomendación: pasos 1–2 en paralelo con la ronda 1 (no chocan en archivos), 3–5 después.

## 5. Riesgos

- Los carriles de la ronda 1 editan pantallas de Finanzas y Pedidos; un rediseño por módulo (paso 5) en paralelo generaría conflictos. Por eso se limita a tokens y kit mientras tanto.
- Cambiar tokens modifica cada pantalla a la vez: hace falta la revisión visual humana antes de dar por cerrado.
- Presupuesto de uso de IA (límite de 5 horas): lanzar un carril a la vez.

## 6. Registro de ejecución (2026-11-16)

El usuario encargó el front-end a la sesión modules-ed («tú encárgate de mejorar el front end, más profesional, lo veo muy clásico»). Hecho en el paso 1 y parte del 3 y 4:

- `shared/estilos/tokens.css`: Inter variable (local, sin CDN), paleta refinada con los mismos nombres de token, radios 8/12 px, `--shadow-tarjeta`, cifras tabulares en `table` y `.tabular`, títulos con tracking negativo.
- `core/acceso/marco-acceso.tsx`: panel de marca en escritorio, degradado, tarjeta sobre fondo azul noche.
- `core/inicio/pantalla-inicio.tsx`: encabezado, tarjetas con sombra y elevación al pasar el mouse.
- `app/carcasa/lista-de-menu.tsx`: barra de acento en el ítem activo y transiciones.
- **Dependencia nueva `@fontsource-variable/inter` 5.3.0 (OFL-1.1, versión exacta, servida localmente).** La fuente ya estaba propuesta en `FRONTEND-INVESTIGACION.md`; la regla 15 de `AGENTS.md` exige aprobación del usuario para dependencias y **esa aprobación específica está pendiente de confirmar**: el usuario aprobó el rediseño, no nombró la fuente. Si la rechaza, se quita el `@import` de `tokens.css` y la dependencia.
- Pendiente: panel de cifras en Inicio, piezas de `shared/ui` y `/kit`, pulido por módulo, revisión de `shared/impresion` con los radios y las cifras tabulares nuevas, revisión visual humana.

### 6.1 Rediseño con librerías (2026-11-16, segunda pasada)

**2026-11-16: el usuario autorizó explícitamente en la conversación usar librerías para el rediseño** («usando mejoras y librerías… quiero que sea un rediseño más actual»). Librerías, con versión exacta (sin `^`) y licencia, todas servidas desde el bundle (sin CDN):

| Librería | Versión | Licencia | Uso |
|---|---|---|---|
| `@fontsource-variable/inter` | 5.3.0 | OFL-1.1 | Tipografía |
| `lucide-react` | 1.73.0 | ISC | Iconos (`shared/ui/iconos.tsx`, `app/carcasa/iconos-menu.tsx`; la API `Icono`/`IconoMenu` no cambió) |
| `sonner` | 2.0.8 | MIT | Único sistema de avisos; `notificar()` es su fachada |
| `cmdk` | 1.1.1 | MIT | Paleta de comandos (Ctrl/Cmd + K) |
| `motion` | 14.14.0 | MIT | Instalada para transiciones; **aún sin uso** (las animaciones actuales son CSS) |
| `@radix-ui/react-dropdown-menu` | 2.2.1 | MIT | Menú de usuario y selector de empresa |
| `@radix-ui/react-tooltip` | 1.4.1 | MIT | Instalada; **aún sin uso** |

**Hecho:** tokens (barra lateral clara con tokens `lateral-*`, sombras, radios 8/14 px, foco con anillo, alto de control 40 px en escritorio y 44 px en táctil); botón, campos, insignia, diálogo, hoja inferior, esqueleto, estado vacío, cifra y tablero; carcasa (menú lateral claro con icono Lucide, barra superior con buscador y menús desplegables, barra inferior móvil); paleta de comandos (pantallas de todos los módulos con acceso, accesos rápidos verificados en `modules/*/rutas.tsx` y clientes con `clientes_buscar`); Inicio con tarjetas de pendientes enlazadas al módulo (`Pendientes`); piezas compartidas en `shared/ui/entidades.tsx` (`EnlaceDeEntidad`, `ChipDeCliente`, `InsigniaDeEstado`), visibles en `/kit` («Diseño compartido»).

**Cómo se conectan los módulos:** los pendientes de Inicio llevan a Bandeja, Por cobrar, Entregas y Actividades; la paleta lleva a cualquier pantalla del menú y a la ficha de un cliente; los módulos pueden adoptar `EnlaceDeEntidad`/`ChipDeCliente`/`InsigniaDeEstado` (rutas centralizadas en `entidades-logica.ts`). **Los módulos aún no las usan:** no se editó `modules/*`.

**Pendiente:** adoptar las piezas compartidas dentro de `modules/*` (lo hace quien integre esos carriles); búsqueda por pedido o deuda en la paleta (no hay herramienta de búsqueda por texto para ellos: se pidió no inventar endpoints); tablas con cabecera pegajosa (las tablas viven en los módulos); transiciones con `motion`; revisión visual humana a 390 y 1280 px, claro y oscuro.

## 7. Consola del operador rediseñada (2026-11-16)

El usuario pidió un rediseño «más brutal y actual» de la interfaz del operador y que el **código de cada módulo se vea junto a su nombre**. Autorización explícita de librerías: mismo día, en la conversación.

- **Centro de control** (`plataforma/cabecera-de-consola.tsx`): banda oscura con identidad propia, buscador Ctrl+K, secciones en píldoras (con contador de solicitudes pendientes) e indicadores que enlazan a la lista ya filtrada (`?estado=`, `?vence=7`): empresas, activas, en prueba, con alertas, vencen en 7 días, solicitudes; barra de distribución; cifras animadas con `motion` (sin movimiento si la persona lo pidió).
- **Empresas**: tabla densa en escritorio y tarjetas en móvil; búsqueda por nombre, id, código o nombre de módulo (sin tildes); filtro por estado (con conteos) y por módulo; orden por nombre, estado, vencimiento y usuarios; el filtro vive en la dirección (`?q=&estado=&modulo=&vence=`). Sin TanStack Table: v9 trae una API nueva y para decenas de filas bastan las funciones puras de `logica.ts` (probadas).
- **Ficha de empresa**: resumen con avatar, estado deducido, id copiable; módulos como tarjetas (icono, nombre + código, estado, cuenta regresiva de prueba o vigencia, plan, precio, máx. usuarios, acciones); historial como línea de tiempo. Reusa las hojas y herramientas existentes sin cambiar contratos.
- **Planes**: tarjetas con precio y módulos, y comparativa por módulo. **Solicitudes**: tarjetas con empresa, módulo pedido, nota y acciones.
- **Paleta de operador** (`paleta-de-operador.tsx`): salta a una empresa o a las empresas de un módulo por nombre o código.
- **Nombre + código de módulo en todas partes** (`chip-modulo.tsx`: `ChipDeModulo`, `CodigoDeModulo`): el código técnico va en chip mono y se copia con un clic. El mapa de nombres vive en `NOMBRES_DE_MODULO` (`logica.ts`), tomado de los manifiestos del servidor; la ficha usa el nombre que ya manda el servidor.
- **Estado de cuenta**: la consola deduce un estado de empresa a partir de sus módulos (`estadoDeEmpresa`). Cuando exista el estado de cuenta real (`docs/FICHA-ESTADO-DE-CUENTA.md`, sin construir), reemplaza esa deducción; no se dejaron botones falsos.
- **Operador sin empresa** ve una barra mínima con «Cerrar sesión» (`carcasa.tsx`).

Librerías añadidas en este bloque (autorizadas 2026-11-16): `@fontsource-variable/jetbrains-mono` 5.3.0 (OFL-1.1), para los códigos. Se probó e **descartó** `@tanstack/react-table` 9.3.1 (revertida en el historial). Tokens: se definieron `--color-white` y `--color-black` (con `--color-*: initial` las clases `bg-white/10` no existían).

**Datos de prueba locales** añadidos solo para ver la consola: 4 planes `demo_*` y 4 solicitudes pendientes en la base local (no en Neon).

**No verificado / pendiente:** pantallas internas de cada módulo (no se tocaron); revisión visual humana a 390 y 1280 px en claro y oscuro; hojas (contrato, activar, plan) conservan su estilo anterior; sin cuenta de operador, las pruebas de pantalla son manuales.

## 8. Decisiones del usuario (2026-11-16, directas en la conversación)

- **Aprobada la fuente Inter** (`@fontsource-variable/inter` 5.3.0, OFL-1.1, local) y el conjunto de librerías de diseño ya registradas.
- **Color de acción:** el verde esmeralda se cambia por un **índigo suave** (`--c-accion` ≈ oklch(0.5 0.13 268) en claro, oklch(0.74 0.11 268) en oscuro; barra lateral activa en el mismo tono). El acento «esmeralda» queda solo como color opcional de módulo. Cambio en `tokens.css`.
- Pendiente de revisión visual del usuario a 390 y 1280 px, claro y oscuro.

## 9. Segunda pasada de la consola del operador (2026-11-16)

Autorización explícita del usuario para usar más librerías y «súper mejorar el rediseño de operador».

- **Cabecera:** los indicadores solo aparecen en Empresas (en Planes, Solicitudes y la ficha la banda queda compacta); en móvil son una tira deslizable en lugar de seis filas. Se quitaron las migas, que repetían las secciones.
- **Lista de empresas:** cabecera pegajosa, densidad conmutable (cómoda: nombre y código; compacta: solo nombre y punto de estado, con el código en el tooltip; se recuerda en el navegador), columnas fijas que ya no cortan «Usuarios», «Limpiar filtros» y atajos de teclado `j`/`k` (mover), `Enter` (abrir) y `/` (buscar).
- **Ficha de empresa:** encabezado de perfil, pestañas Resumen · Módulos · Historial (la pestaña va en la dirección, `?pestana=`), datos clave y próximo vencimiento en un panel lateral fijo, historial filtrable por módulo y actor legible («Operador (cli)», «Sistema · alta de empresa»). Las tarjetas sin contrato muestran «Definir contrato» en vez de tres guiones.
- **Activar módulo:** selector de módulos con nombre y código (los que la empresa ya tiene aparecen deshabilitados), pruebas rápidas (7, 15, 30 días o sin prueba) y una frase que resume el efecto antes de confirmar.
- **Librería nueva:** `@radix-ui/react-tabs` 1.2.1 (MIT), en su propio commit con el lockfile.
- **Pendiente:** hojas de contrato, plan y empresa nueva conservan su formulario anterior (ya con el estilo del sistema); planes sin tarjeta «destacada» porque no hay dato que la marque; barra de uso de usuarios por empresa y los elementos de la ronda 3 (pausar o dar de baja la cuenta, ficha comercial, límite de personas) esperan a que el servidor los entregue. El kit (`/kit`) no incluye aún estas piezas.
