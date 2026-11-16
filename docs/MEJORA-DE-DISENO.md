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
