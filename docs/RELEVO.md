> **AVANCE 2026-11-15 (tarde), integrado en `main` con commits locales (sin GitHub):** C0, W1, W2, W3, W4, DB1a (migraciones 0006–0008), DB1b (0009–0012), S1 (ejecutor, puerta HTTP, auditoría), S2 (eventos y correlativos), S3a (dominio y repositorios de clientes, productos y sucursales). Suite completa en verde (278 integración, 141 unitarias de api, 71 web, 76 shared). **Abiertos al cierre de esta nota:** S3b, S4, S5, W5 (worktrees en `../capaz-erp-carriles/`). **Pendiente para Keny:** aplicar 0006–0012 en Neon (`NEON-MIGRACION.md`), resetear contraseña del dueño de Neon, GitHub, host (D7), revisión de seguridad (el contexto `sistema` de los consumidores de eventos tiene permisos de administrador; el módulo `core` está eximido de `puedeEscribir` en el ejecutor). **Pendiente de revisión humana:** todo lo visual (`/kit`, acceso, carcasa) a 390 y 1280 px, claro y oscuro, y la cookie de sesión por el proxy de Vite. **Resuelto el 2026-11-15:** `ejecutarDentro` ya permite emitir eventos y pedir correlativos (`conPuntoDeGuardado` en `infra/database/con-empresa.ts`); S9 importa pasando por el ejecutor. **Sigue abierta (S5):** `borrador_aprobar` no puede aprobar borradores de herramientas CRÍTICAS por HTTP, porque el ejecutor convierte «pide confirmación» dentro de `ejecutarDentro` en `error_interno`; los no críticos funcionan. Arreglo pendiente (carril S5b, antes de W8): o `borrador_aprobar` resume y confirma la propuesta como crítica, o el ejecutor reenvía `pendiente_confirmacion`; decidir con Keny. **Integrados además:** S3b, S4, S5, S6 (plataforma, nombres `plataforma_empresas_ver/crear`), S8 (automatizaciones; `regla_activar` es siempre crítica), S9 (CSV), W5, W6, W7. Suite: 386 integración, 181 unitarias api, 134 web, 76 shared. **Faltan:** S7 (conexiones), W8 (bandeja), W9 (consola), W10 (conecta y automatizaciones), X1 (despliegue), arreglo de borradores críticos (S5b).

# Relevo: dónde quedó Capaz ERP y cómo seguir

**Actualizado:** 2026-11-15 (planes versión 3; el código no cambió desde el 2026-11-14) · **Para:** el integrador y los agentes de carril. Léelo junto con `AGENTS.md`, que manda en las reglas.

## 1. En una frase

Capaz ERP es un **ERP completo, modular y multiempresa**, de apariencia tradicional y comportamiento de trabajador digital (el sistema hace el trabajo y la persona aprueba), para talleres gráficos y publicitarios de Perú. **Orden decidido por el usuario el 2026-11-15:** primero se termina la estructura del ERP (núcleo, carcasa, consola, conectores, automatizaciones y módulos clásicos); después se adaptan dentro de él el Registro por voz y el Cotizador. Hoy están hechos los cimientos del servidor y la base de datos; **no hay pantallas reales** ni módulos de negocio.

## 2. Estado exacto

| Pieza | Estado | Dónde |
|---|---|---|
| Fase 0 · repositorio, reglas, prueba de arquitectura | hecha | `AGENTS.md`, `apps/api/src/arquitectura/` |
| Fase 1 · configuración, registros, errores, contrato, dinero | hecha | `apps/api/src/infra/`, `packages/shared/src/` |
| Fase 2 · base, cuatro roles, aislamiento, `conEmpresa` | hecha | `apps/api/scripts/`, `drizzle/0000-0001`, `infra/database/` |
| Fase 3a · identidad con Better Auth (servidor) | hecha | `src/core/auth/`, `src/core/empresas/`, `drizzle/0005`, `src/db/esquema/auth.ts` |
| Fase 4 · módulos, contratación y permisos | hecha (falta `pnpm plataforma restablecer`, que pasa a la fase 9a) | `drizzle/0002-0004`, `src/core/modulos/`, `src/modules/*/*.manifest.ts`, `scripts/plataforma.ts` |
| Planes versión 3 y trabajo en paralelo | escritos el 2026-11-15 | `docs/PLAN-DE-CONSTRUCCION.md`, `docs/PLAN-PARALELO.md`, `docs/adr/ADR-015` (propuesto) |
| **Siguiente: ronda 0** · carriles **C0** (andamiaje y contratos) y **W1** (base web), en paralelo | por lanzar | `PLAN-PARALELO.md` §4 y §5 |
| Todo lo demás de la ola 1 (DB1, S1 a S9, W2 a W10) | pendiente | tablero en `PLAN-DE-CONSTRUCCION.md` §8 |

**Verificación al 2026-11-15:** pruebas unitarias ejecutadas, 40 en `shared` y 85 en `api`. Las 82 de integración **no se ejecutaron** ese día (el contenedor `capaz-erp-db-1` estaba detenido); su recuento estático coincide. Último `pnpm check` completo en verde: cierre del 2026-11-14. Migraciones `0000` a `0005` en el repositorio; aplicadas en Neon según `docs/NEON-MIGRACION.md` §8.

**Git:** el repositorio no tiene commits; todo está sin confirmar. No hagas commits sin permiso del usuario (decisión D1). Sin commits no hay ramas ni worktrees: el trabajo en paralelo usa el **modo B** (copias de carpeta) de `PLAN-PARALELO.md` §2.5.

## 3. Cómo arrancar el entorno

```bash
cd capaz-erp
pnpm install
cp .env.example .env        # si no existe; el .env actual ya tiene valores de desarrollo
pnpm db:up                  # PostgreSQL 18 local, puerto 5450
pnpm db:preparar            # cuatro roles sin superusuario + bases capaz y capaz_test
pnpm db:migrar              # migraciones con capaz_owner
pnpm check                  # build de shared + typecheck + lint + pruebas unitarias + de integración
pnpm dev:api                # http://localhost:3001/api/health
```

Un agente de carril **no** hace esto por su cuenta: el integrador le deja el directorio preparado (`PLAN-PARALELO.md` §6.1) y no se levantan servidores de desarrollo dentro de un carril.

## 4. Mapa del código

```
apps/api/
  drizzle/                 migraciones 0000-0005: 0000 y 0003 a mano; 0001, 0002, 0004 y 0005 generadas (+ seguridad al final)
  scripts/                 config.ts, preparar-base.ts, migrar.ts, plataforma.ts (se ejecutan con node, Node 24)
  src/infra/               config, logger, http (contexto, filtro de errores, validación, decoradores), database (conEmpresa)
  src/core/auth/           Better Auth (auth.ts), guardia de identidad, lista blanca de rutas (rutas-permitidas.ts)
  src/core/empresas/       aprovisionamiento idempotente, GET /api/v1/yo, POST /api/v1/empresas
  src/core/modulos/        catálogo de manifiestos, regla de acceso, sincronización con core.modulos
  src/modules/             registro y cotizador: solo manifiesto
  src/configurar-app.ts    montaje común (orden: contexto, registro, Better Auth, cuerpo, pipes); lo usan main.ts y las pruebas
  src/db/esquema/          core.ts, core-modulos.ts, auth.ts (Drizzle; sin RLS ni permisos: van en SQL)
  src/pruebas/             utilidades de las pruebas de integración (solo contra localhost)
  src/arquitectura/        reglas de importación y tamaño, con su prueba
packages/shared/src/       respuesta, codigos, dinero, modulos, yo (contratos compartidos con la web)
apps/web/                  solo la pantalla de salud; la base web llega con el carril W1
docs/                      ver sección 7
```

## 5. Cosas que no son obvias (trampas ya pisadas)

1. **La RLS forzada aplica también al dueño de la base.** Con `capaz_owner` sin `app.tenant_id` no se ve ninguna fila; por eso las pruebas siembran datos con `comoEmpresa(owner, …)`. Las funciones `security definer` no sirven (devuelven falso); por eso no existen.
2. **Una llave foránea no pasa por la RLS:** toda llave entre tablas con `tenant_id` es compuesta `(tenant_id, x_id)`. Una prueba de catálogo lo exige.
3. **Tabla nueva = migración con seguridad a mano.** `drizzle-kit generate` no genera `FORCE RLS` ni `GRANT`. Receta en `MODULOS-Y-MERCADO.md`, sección 8. Si olvidas `aplicar_aislamiento`, `catalogo.int.spec.ts` falla. **Solo el carril de datos escribe migraciones.**
4. **Lista de plataforma:** `capaz_sistema` solo tiene lo que dice `PERMITIDO` en `contratacion.int.spec.ts`. Al abrir una tabla a la plataforma, agrégala ahí; todo lo demás sigue cerrado. **Ojo:** esa prueba mira permisos de tabla (`has_table_privilege`), no de columna; el carril DB1 le agrega la comparación por columna.
5. **Nuevas tablas con `tenant_id`:** agrega su insert a `EJEMPLOS` en `aislamiento.int.spec.ts` con su modo (`completo`, `lectura` o `insercion`). Y todo índice debe empezar por `tenant_id` (la 0004 corrigió uno; la prueba de catálogo lo vigila). Un índice de parecido (`gin_trgm_ops`) también: lleva `tenant_id` delante.
6. **Una migración aplicada no se edita:** se escribe otra. Las migraciones a mano usan `drizzle-kit generate --custom --name=…`.
7. **Los scripts corren con Node 24 directamente** (`node scripts/migrar.ts`), con imports terminados en `.ts`. El servidor se compila con `nest build` (imports `.js`).
8. **`.env` en la raíz:** contiene las URL de los cuatro roles locales, secretos de desarrollo y las variables `NEON_*`. El servidor nunca lee la URL del dueño ni las de Neon. No imprimas ni registres sus valores.
9. **Las pruebas de integración se niegan a correr contra un host que no sea localhost** (`global-setup.ts`). No las apuntes a Neon.
10. **Pruebas por HTTP real:** `src/pruebas/app-de-pruebas.ts` levanta el servidor completo en un puerto libre contra la base de pruebas (se niega si la URL no es local) y da un cliente con cookies. Úsalo para toda ruta nueva.
11. **Drizzle devuelve las fechas de `tx.execute` como TEXTO**, no como `Date` (lo mordió el guardia): conviértelas con `new Date(...)`.
12. **`core/` no puede importar de `modules/`:** los manifiestos los ensambla `app.module.ts` con `ModulosModule.con([...])`. Lo deja listo el carril C0; después nadie más toca `app.module.ts`.
13. **Depurar pruebas por HTTP:** `DEBUG_PRUEBAS=1 npx vitest run -c vitest.int.config.ts <archivo>` enciende el registro del servidor (en pruebas está en silencio).
14. **Los scripts (`scripts/*.ts`) no pueden importar de `src/`** (Node no resuelve `.js`→`.ts`): son autocontenidos con SQL directo. Las pruebas sí importan los scripts con extensión `.ts`.
15. **Latencia a Neon medida: ~89 ms** por ida y vuelta desde esta máquina a São Paulo. El guardia hace 3 idas y vueltas por petición (membresía, contratación y asignaciones, sesión); con el servidor en São Paulo son milisegundos. Si hiciera falta, agrupar o cachear (no antes de medir en el host real).
16. **`process.env` y `pg`** solo en `infra/config`, `scripts/` y `pruebas/` / `infra/database` (la prueba de arquitectura lo hace cumplir).
17. **La base de pruebas tiene hoy nombre fijo (`capaz_test`).** Dos carriles de servidor no pueden probar a la vez hasta que C0 implemente `CAPAZ_TEST_DB` (una base por carril).
18. **El cálculo de acceso (rol, módulos, permisos) vive hoy privado dentro del guardia HTTP.** C0 lo extrae a `ServicioDeAcceso` para que también lo usen el relevo de eventos y las reglas automáticas.

## 6. Qué hacer ahora, en orden

1. **Usuario:** responder lo que pueda de la sección 8, sobre todo D1 (commits) y D3 (`@tanstack/react-query`).
2. **Integrador:** levantar la base local (`pnpm db:up`) y confirmar `pnpm check` en verde antes de lanzar nada.
3. **Ronda 0, en paralelo:** carril **C0** (andamiaje y contratos; `apps/api` y `packages/shared`) y carril **W1** (base web; `apps/web`). Brief en `PLAN-PARALELO.md` §7.
4. **Ronda 1:** DB1a (migraciones `0006` a `0008`) en cuanto C0 esté integrado; W2 y W3 en cuanto W1 esté integrado. Avisar a la sesión de Neon cuando DB1a entre en `main`.
5. **Rondas 2 a 6:** según la tabla de `PLAN-PARALELO.md` §4, sin pasar de cuatro carriles abiertos.
6. **Cierre de la ola 1:** uso interno en Atlantisgraf y puerta de revisión antes de la ola 2 (que necesita ADR-015 aprobado).

## 7. Documentación

| Documento | Para qué |
|---|---|
| `AGENTS.md` | Reglas no negociables y comandos |
| `docs/PLAN-DE-CONSTRUCCION.md` | **Qué se construye, en qué orden y con qué especificación** (versión 3; manda) |
| `docs/PLAN-PARALELO.md` | **Cómo trabajan varios agentes a la vez:** carriles, propiedad de archivos, integración, brief |
| `docs/MODULOS-Y-MERCADO.md` | Catálogo de módulos, mercado, olas, receta de migraciones (§8) |
| `docs/PLAN-CIMIENTOS.md`, `ARQUITECTURA-DE-MODULOS.md`, `ARQUITECTURA-DE-IA.md`, `PLATAFORMA-Y-PLANES.md`, `INTEGRACION-DE-MODULOS.md` | Qué y por qué |
| `docs/FINALIDAD-Y-OBJETIVOS-ERP.md` | Finalidad y metas del piloto (su alcance de la V1 quedó superado por el orden nuevo) |
| `docs/adr/` | Decisiones 001 a 015. La 013 fija extensibilidad y escalabilidad; la 014 (conectores y automatizaciones) está **aceptada** desde el 2026-11-15; la **015 está propuesta** y pide aprobación |
| `docs/REFERENCIAS.md` | Referencias de solo lectura (regla 12: solo ideas genéricas) |
| `docs/FRONTEND-INVESTIGACION.md` | Investigación de la pila de interfaz (propuesta; los carriles web leen solo las secciones que cita su ficha) |
| `docs/NEON-MIGRACION.md` | Procedimiento y registro de la migración a Neon (lo ejecuta otra sesión) |
| `docs/worklog/2026-11-14.md` | Registro del día: qué se hizo, verificación y pendientes |
| `docs/archivo/` | Versiones 1 y 2 del plan (solo historial) |

## 8. Decisiones del usuario que siguen abiertas

La lista completa, con recomendación y lo que bloquea cada una, está en `PLAN-DE-CONSTRUCCION.md` §9 (D1 a D14). Las que más mueven:

1. **D1 · Autorizar commits** (uno base y uno por carril). Sin ellos se trabaja con copias de carpeta.
2. **D3 · Aprobar `@tanstack/react-query`** para la web. Sin respuesta esperan los carriles W6 a W10 (las pantallas con listas).
3. **D2 · Aprobar ADR-015** (familias, un esquema por módulo, Finanzas = `registro` en dos pasos, Ventas = CRM + Pedidos, bandeja en el núcleo). Sin ella no arrancan las olas 2 y 3.
4. **D5 · Identidad visual** («Pliego» o «azul noche + esmeralda»). No detiene a nadie: la carcasa usa tokens con valores provisionales.
5. **D7 · Host del servidor** en São Paulo. Solo detiene el despliegue.
6. **D9 · `registro` en prueba de 30 días por defecto** mientras sigue en construcción.
7. **D13 · Higiene:** resetear la contraseña del rol dueño de Neon (pasó por el chat); decidir sobre la rama `ensayo-migraciones`; quitar `@nestjs/mau` (0.x, sin uso).
8. **Pista V (D11):** grabar 30 a 50 dictados reales del taller y cronometrar 10 registros actuales. Cuanto antes, mejor; no necesita código.
9. La imagen de la interfaz de referencia que el usuario mencionó nunca llegó a la conversación.
