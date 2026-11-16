# Ficha · Estado de cuenta de la empresa (pausar, dar de baja, quitar módulo)

**Versión 1 · 2026-11-16 · Estado: CONGELADA COMO DISEÑO, sin construir.** Se lanza solo con confirmación directa del usuario (ronda 3 de `PROPUESTA-DE-MEJORAS.md`, junto con A4–A6). Lleva **una migración**, que también hay que aplicar en Neon. Las reglas comunes R1 a R18 de `FICHAS-OLA-2.md` §1 valen igual.

## 1. Problema

Hoy el estado existe solo **por módulo** (`core.empresa_modulos.estado`: `prueba`, `activo`, `suspendido`, `baja`; funciones `activar/suspender/dar_baja/reactivar_modulo` en `0003_modulos_funciones.sql`). No hay forma de pausar o dar de baja **toda la empresa** de una vez, y el operador debe tocar módulo por módulo. Esta ficha agrega un estado a nivel cuenta, sin tocar el de los módulos.

## 2. Reglas de producto

| Acción | Efecto | Se deshace |
|---|---|---|
| **Pausar cuenta** | La empresa entra y lee todo; **no puede escribir** en ningún módulo (mora u otro motivo temporal) | Reactivar |
| **Dar de baja la cuenta** | Igual que pausa en efecto (solo lectura, **no se borra nada**), pero marca que la relación terminó | Reactivar |
| **Quitar un módulo** | Ya existe: `plataforma_modulo_dar_de_baja`. Solo ese módulo queda en lectura | `plataforma_modulo_reactivar` |
| **Reactivar cuenta** | Vuelve a `activa`; los módulos conservan su propio estado | — |

1. Estados de cuenta: `activa`, `prueba`, `pausada`, `baja`. Toda cuenta nueva nace `activa` (o `prueba` si el alta lo indica).
2. **El estado de cuenta manda sobre el del módulo:** un módulo escribe solo si la cuenta está `activa` o `prueba` **y** el módulo está activo (o en prueba vigente). Cambiar la cuenta **no modifica** el estado de ningún módulo (así reactivar devuelve todo como estaba).
3. **Motivo obligatorio** en pausar y dar de baja (texto, mínimo 5 caracteres). Reactivar acepta motivo opcional.
4. **Historial de solo inserción:** quién, cuándo, estado anterior y nuevo, motivo.
5. **Nunca se borran datos.** Borrar una cuenta de verdad queda fuera de la consola (decisión aparte, con exportación previa).
6. **Solo la plataforma** cambia el estado de cuenta; la empresa no puede reactivarse sola. Si la cuenta está pausada o de baja, los usuarios de la empresa ven un aviso fijo («Cuenta pausada: solo lectura. Contacta a tu proveedor») y no el error técnico.
7. Un operador **no puede pausar ni dar de baja la empresa Datayros** (la de la propia plataforma). Evita quedarse sin consola.

## 3. Datos (una migración, p. ej. `00NN_estado_de_cuenta.sql`)

Convenciones: dinero y fechas como en la ola 2; `tenant_id` con RLS forzada vía `core.aplicar_aislamiento()` o, si es solo de plataforma, permisos por columna a `capaz_sistema` como `core.empresa_modulos`.

| Objeto | Detalle |
|---|---|
| `core.empresa_cuenta` | `tenant_id` PK · `estado` text not null default `'activa'` con `check (estado in ('activa','prueba','pausada','baja'))` · `motivo` text · `cambiado_en` timestamptz · `cambiado_por` text. Se **rellena una fila `activa` por cada empresa existente** en la misma migración |
| `core.empresa_cuenta_eventos` | Solo inserción: `id` uuidv7 · `tenant_id` · `evento` (`pausa`,`baja`,`reactivacion`,`alta`) · `estado_anterior` · `estado_nuevo` · `motivo` · `actor` · `creado_en`. Sin UPDATE ni DELETE para ningún rol |
| Trigger | Igual que `empresa_modulos_registrar_evento`: registra el evento al cambiar `estado` |
| Funciones | `core.pausar_cuenta(tenant, motivo, actor)`, `core.dar_baja_cuenta(...)`, `core.reactivar_cuenta(tenant, motivo, actor)`. Sin `security definer` (ADR-011); permisos para `capaz_sistema`, como las de módulos |
| `core.modulo_activo(tenant, modulo)` | **Se modifica**: devuelve falso también si la cuenta no está `activa`/`prueba`. Es el único punto donde se aplica la regla 2 |
| Alta de empresa | Crear la fila de `core.empresa_cuenta` en el mismo paso que crea la empresa |

Prueba de catálogo (`catalogo.int.spec.ts`): las dos tablas nuevas tienen RLS o permisos exactos esperados; ninguna función nueva es `security definer` ni ejecutable por `PUBLIC`.

## 4. Herramientas (plataforma, `definirHerramientaDePlataforma`)

| Herramienta | Criticidad | Confirmación |
|---|---|---|
| `plataforma_cuenta_pausar` (`empresa`, `motivo`) | Crítica | Resumen: «Pausar la cuenta de «X»: verá todo pero no podrá escribir» |
| `plataforma_cuenta_dar_de_baja` (`empresa`, `motivo`) | Crítica | Resumen con aviso de que no se borran datos |
| `plataforma_cuenta_reactivar` (`empresa`, `motivo?`) | Crítica | — |
| `plataforma_empresas_ver` (existente) | — | Incluye `estadoCuenta` y `motivo` |

Mismos permisos y auditoría que `herramientas-de-modulos.ts`. Una por archivo de ayuda en `ayudas.ts` (con ejemplo y qué evitar).

## 5. Pantalla (consola, solo operadores)

- **Lista de empresas:** columna «Cuenta» con semáforo (verde activa, azul prueba, ámbar pausada, gris baja) y filtro por estado.
- **Ficha de la empresa:** arriba el estado de cuenta con tres botones (Pausar, Dar de baja, Reactivar; solo los que aplican). Debajo, una fila por módulo **con su nombre** (no el código) y un interruptor de estado. Cada acción abre una hoja de confirmación con el motivo obligatorio y el resumen del efecto.
- **Historial** visible en la ficha (cuenta y módulos juntos, ordenado por fecha).
- Del lado de la empresa: aviso fijo de solo lectura (regla 6). Sin botones de acción.
- Kit de interfaz existente; 390 y 1280 px, claro y oscuro; revisión visual humana.

## 6. Pruebas de referencia (integración, sin e2e)

1. Una cuenta `activa` con módulo activo escribe; tras `pausar_cuenta` la misma escritura falla con el código de «módulo/cuenta no disponible» y la **lectura sigue funcionando**.
2. Tras `reactivar_cuenta`, vuelve a escribir sin tocar el estado del módulo (comprobar que `empresa_modulos` no cambió).
3. `dar_baja_cuenta` no borra filas de ningún esquema (conteos antes y después iguales).
4. El motivo vacío o de menos de 5 caracteres se rechaza.
5. Cada cambio genera una fila en `empresa_cuenta_eventos` con actor y estados correctos; no se puede actualizar ni borrar el historial.
6. Un usuario de empresa **no puede** llamar a las tres herramientas (403) ni ver otra empresa.
7. No se puede pausar ni dar de baja la empresa de la plataforma.
8. Aislamiento entre empresas: pausar A no afecta a B.
9. Idempotencia: pausar una cuenta ya pausada no duplica eventos.

## 7. Fuera de alcance

Cobro automático, suspensión automática por mora (siempre la decide una persona; el sistema solo la propone, decisión 9 de `PROPUESTA-DE-MEJORAS.md`), borrado definitivo, acceso de soporte a la cuenta.

## 8. Esfuerzo y riesgo

Servidor S (migración, 3 funciones, 3 herramientas, ajuste a `modulo_activo`) + pantalla S–M. **Riesgo medio**: toca la función que decide si se puede escribir; por eso la prueba 1 y 2 y la suite completa deben correr en verde antes de integrar. Aplicar la migración también en Neon (la aplica quien tenga la sesión de Neon).
