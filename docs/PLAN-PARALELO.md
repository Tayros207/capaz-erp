# Plan de trabajo en paralelo de Capaz ERP

**Versión 1 · 2026-11-15 · Para: el integrador (agente principal) y los agentes de carril (Sonnet, esfuerzo medio).**

`PLAN-DE-CONSTRUCCION.md` dice **qué** se construye y con qué especificación. Este documento dice **cómo lo construyen varios agentes a la vez sin pisarse**: carriles con propiedad exclusiva de archivos, contratos congelados, un solo escritor de migraciones, un integrador y una plantilla de brief. En lo que toca al trabajo simultáneo, **manda este documento** (también sobre «una fase por sesión» de `AGENTS.md`).

## 0. Cómo leer este documento (y gastar pocos tokens)

- **Agente de carril:** lee `AGENTS.md`, las secciones 2 y 8 de este documento, **tu ficha** de la sección 5 y lo que tu ficha diga en «Lee». Nada más. Para encontrar tu ficha: `grep -n '^### ' docs/PLAN-PARALELO.md` y lee solo ese tramo.
- **Integrador:** secciones 1 a 4, 6 y 7.
- Idea central: **dos carriles nunca editan el mismo archivo.** Por eso integrar no produce conflictos: si aparece uno, alguien se salió de su carril.

## 1. Papeles

| Papel | Quién | Hace | No hace |
|---|---|---|---|
| **Usuario** | Moisés | Decide lo de `PLAN-DE-CONSTRUCCION.md` §9, autoriza commits y dependencias, hace la revisión visual | — |
| **Arquitecto** | Fable | Escribe y corrige los planes y las fichas; revisa en la puerta entre olas | No construye |
| **Integrador** | El agente principal (o una persona) | Prepara el directorio de cada carril, lanza los agentes con el brief, revisa informes y diffs, integra en `main` en orden, corre la suite completa, es dueño de los archivos compartidos y de los contratos, instala dependencias aprobadas, actualiza tablero y relevo | No escribe código de carril salvo C0 si así se decide |
| **Agente de carril** | Sonnet, esfuerzo medio | Ejecuta su ficha al pie de la letra en su directorio, verifica, informa y para | No integra, no decide arquitectura, no toca archivos ajenos, ni Neon, ni dependencias |
| **Carril de datos** | Un solo agente a la vez (DB1, DB2, DB3) | Único que escribe migraciones, esquema de Drizzle y listas de las pruebas de catálogo | No escribe código de negocio |
| **Sesión de Neon** | Otra sesión, con `docs/NEON-MIGRACION.md` | Aplica en Neon las migraciones ya integradas en `main` | No toca `src/` ni `drizzle/` |

## 2. Reglas anti-conflicto

### 2.1 Propiedad exclusiva
1. Cada ficha trae «Propiedad exclusiva»: rutas que **solo ese carril** puede crear o modificar mientras está abierto. Todo lo demás es de solo lectura para él.
2. Crear un archivo **fuera** de esas rutas también está prohibido, aunque sea nuevo.
3. Al integrarse un carril, sus archivos quedan **congelados**: otro carril puede importarlos, no editarlos. Los cambia un carril posterior que los reciba en su ficha, o el integrador.
4. Si un carril necesita algo de un archivo ajeno (una exportación que falta, una columna, un permiso en un manifiesto), **no lo toca**: lo escribe en su informe como **solicitud de cambio** (`archivo · qué · por qué · qué paso bloquea`) y sigue con lo que no dependa de eso, o para.

### 2.2 Archivos compartidos: dueño único

| Archivo o carpeta | Dueño | Cómo se cambia |
|---|---|---|
| `package.json` (los cuatro), `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Integrador | Solo con dependencia aprobada por el usuario (regla 15). Los carriles ejecutan `pnpm install --frozen-lockfile` y nada más |
| `apps/api/src/app.module.ts`, `configurar-app.ts`, `main.ts` | Integrador (los deja listos C0) | Solicitud de cambio |
| `apps/api/src/infra/**`, `.env.example` | Integrador | Solicitud de cambio. Excepción: las tres pruebas `aislamiento`, `catalogo` y `contratacion` de `infra/database/` son del carril de datos |
| `apps/api/drizzle/**`, `apps/api/drizzle.config.ts`, `apps/api/src/db/esquema/**` | Carril de datos | Solicitud de cambio de esquema → migración nueva |
| `packages/shared/src/` salvo `contratos/<area>.ts` | Integrador (C0) | Solicitud de cambio. `index.ts` y `contratos/index.ts` reexportan con `export *`: nadie necesita tocarlos para agregar un contrato |
| `packages/shared/src/contratos/<area>.ts` | El carril de esa área | Lo edita su dueño |
| `apps/api/src/modules/<codigo>/<codigo>.manifest.ts` | C0 en la ola 1; el carril `M-<codigo>-s` en su ola | Un permiso nuevo del núcleo: solicitud de cambio a `manifiesto-core.ts` |
| `apps/api/src/core/auth/**`, `core/modulos/**` | Integrador | Solicitud de cambio |
| `apps/web/src/app/rutas.tsx`, `app/proveedores.tsx`, `main.tsx`, `index.html`, `vite.config.ts`, `shared/estilos/tokens.css` | W1 mientras está abierto; después el integrador | Solicitud de cambio. Cada área tiene su propio `rutas.tsx` ya registrado |
| `apps/web/src/shared/ui/**` | W1 y W2 (cada uno sus archivos) | Una pieza nueva la pide el carril que la necesita; la hace el integrador o un carril de kit |
| `AGENTS.md`, `docs/PLAN-*.md`, `docs/RELEVO.md`, `docs/adr/**` | Integrador y arquitecto | — |
| `graphify-out/**` | Integrador | Los carriles **no** ejecutan `graphify update`; el integrador lo hace en `main` tras integrar |

### 2.3 Migraciones: un solo escritor, numeración en serie
- **Esquema elegido: carril de datos único.** Solo DB1, DB2 y DB3 ejecutan `pnpm db:generar`. Como nadie más genera, los números (`0006`, `0007`…), el diario (`meta/_journal.json`) y las instantáneas de `drizzle-kit` nunca chocan, y el orden en que Neon las recibe es el orden de `main`.
- Las tablas de cada ola están especificadas de antemano (`PLAN-DE-CONSTRUCCION.md` §6.4 y fichas 14 a 19): el carril de datos no diseña, transcribe.
- Va **antes** que los carriles que usan esas tablas, por tandas cortas (DB1a, DB1b) para no hacerlos esperar.
- Una migración integrada **no se edita**: un cambio es otra migración, pedida por solicitud de cambio de esquema y encolada por el integrador.
- Ningún carril referencia una migración por su número en código o pruebas: por nombre de tabla.
- Tras integrar una tanda, el integrador avisa a la sesión de Neon. Ningún carril ni el integrador aplican nada en Neon.

### 2.4 Dependencias
Regla 15: ninguna dependencia nueva sin aprobación del usuario. Si un carril cree necesitar una, **para y lo dice**; la alternativa sin dependencia suele estar escrita en su ficha. Aprobada, la instala el integrador en `main` (versión exacta, sin `^`) **antes** de lanzar el carril.

### 2.5 Dónde trabaja cada carril

**Modo A (recomendado; requiere el permiso de commits, D1):** una rama y un worktree por carril.
```bash
# El integrador, desde capaz-erp/ (ID en minúsculas: s1, w4…)
git worktree add ../capaz-erp-carriles/<id> -b carril/<id> main
cp .env ../capaz-erp-carriles/<id>/.env && echo "CAPAZ_TEST_DB=capaz_test_<id>" >> ../capaz-erp-carriles/<id>/.env
cd ../capaz-erp-carriles/<id> && pnpm install --frozen-lockfile && pnpm --filter @capaz/shared build && pnpm db:preparar   # crea capaz_test_<id>
```
El agente hace commits **solo en su rama** (`carril <ID>: resumen`). Integrar = fusionar la rama en `main`.

**Modo B (sin commits):** una copia de carpeta por carril.
```bash
rsync -a --exclude node_modules --exclude dist --exclude .git ./ ../capaz-erp-carriles/<id>/
# después, lo mismo que en el modo A: .env con CAPAZ_TEST_DB, pnpm install --frozen-lockfile, build de shared, db:preparar
```
Integrar = copiar a `main` **solo las rutas de propiedad del carril** (`rsync -a` de esas rutas) tras comprobar con `diff -rq` (sin `node_modules` ni `dist`) que no cambió nada fuera de ellas. Funciona porque la propiedad es exclusiva; se pierde el historial y deshacer es a mano.

En ambos modos los directorios viven en `/home/datayros/Documentos/work/modules/capaz-erp-carriles/`. El `.env` nunca se sube ni se imprime.

### 2.6 Base de pruebas por carril
Las pruebas de integración migran y usan la base que diga `CAPAZ_TEST_DB` (C0 lo implementa; por defecto `capaz_test`). Cada carril de servidor usa `capaz_test_<id>` en el mismo PostgreSQL local (puerto 5450). Sin esto, dos carriles con migraciones distintas se rompen las pruebas entre sí. Las pruebas migran solas esa base al empezar. **La base de desarrollo `capaz` solo la migra el integrador, desde `main`** (`pnpm db:migrar`): ningún carril ejecuta `pnpm db:migrar` a secas. Nadie apunta pruebas a Neon (las pruebas ya se niegan). Los carriles **no levantan** `pnpm dev:api` ni `pnpm dev:web` (los puertos son compartidos): las pruebas usan puertos libres.

### 2.7 Orden de integración y suite completa
1. Un carril se integra cuando su informe trae la verificación en verde **y** el integrador pasa la lista de la sección 6.2.
2. Dentro de una ronda: primero datos, luego servidor, luego web; entre carriles del mismo tipo, en el orden de la tabla de rondas (sección 4).
3. **La suite completa (`pnpm check` en `main`, con la base por defecto) la corre el integrador después de cada integración**, no al final de la ronda. Si falla, se revierte esa integración y vuelve al carril con el error.
4. El agente de carril corre el comando de verificación de su ficha en su directorio. Un carril abierto no se «actualiza» con `main` por su cuenta: si necesita algo recién integrado, lo dice y el integrador lo rebasa o le prepara el directorio de nuevo.

### 2.8 Ante un conflicto
- **Dos carriles tocaron el mismo archivo:** gana el dueño según 2.2 y las fichas; el cambio del otro se rechaza y se rehace como solicitud de cambio.
- **Un contrato congelado no alcanza:** el carril para ese paso; el integrador decide, cambia el contrato en `main`, avisa a los carriles abiertos que lo usan y actualiza la sección 6 del plan.
- **La suite falla en `main` tras integrar:** revertir, no parchear en `main`.
- **El plan y el código se contradicen:** el carril para y pregunta; no elige por su cuenta.
- **Dos planes se contradicen:** manda `PLAN-DE-CONSTRUCCION.md` en el qué y este documento en el cómo.

## 3. Contratos congelados

| Contrato | Dónde | Lo crea | Especificación |
|---|---|---|---|
| Manifiesto con `familia` y `orden`; `Yo` con familia | `packages/shared/src/{modulos,yo}.ts` | C0 | Plan §6.1 |
| `Milesimas`, `importe`, `paginaSchema`, `listadoSchema` | `packages/shared/src/{dinero,listado}.ts` | C0 | Plan §6.1 |
| Contrato de herramienta, canales, criticidades, ayuda, cuerpo HTTP | `packages/shared/src/herramientas.ts` | C0 | Plan §6.1 |
| Mapas `CONTRATOS`, `CONTRATOS_DE_PLATAFORMA`, `EVENTOS` y un archivo vacío por área | `packages/shared/src/contratos/` | C0 | Plan §6.1 |
| Manifiesto de conector | `packages/shared/src/conectores.ts` | C0 | Plan §6.1 |
| `Herramienta`, `definirHerramienta`, `ContextoDeHerramienta`, `RegistroDeHerramientas` | `apps/api/src/core/herramientas/{tipos,registro}.ts` | C0 | Plan §6.2 |
| `ServicioDeAcceso.contextoDe` | `apps/api/src/core/modulos/acceso.service.ts` | C0 | Plan §6.2 |
| `Consumidor`, `TareaPeriodica`, `EventoEntregado` | `apps/api/src/core/eventos/tipos.ts` | C0 | Plan §6.2 |
| `EjecutorDeHerramientas.ejecutar` | `core/herramientas/ejecutor.ts` | S1 | Plan §6.2 |
| `emitir`, registros de consumidores y tareas, `siguienteNumero` | `core/eventos/`, `core/correlativos/` | S2 | Plan §6.2 |
| `proponerBorrador` | `core/borradores/proponer.ts` | S5 | Plan §6.2 |
| `FuenteDeTiempo` y su registro | `core/automatizaciones/tipos.ts` | S8 | Plan §6.2 |
| Tablas, políticas y permisos | `apps/api/drizzle/`, `src/db/esquema/` | DB1 | Plan §6.4 |
| Tokens semánticos, kit base, cliente, sesión, registro de rutas | `apps/web/src/shared/**`, `app/rutas.tsx` | W1 | Plan §6.3 |
| Kit de datos | `apps/web/src/shared/ui/datos/` | W2 | Plan §6.3 |
| `llamar` | `apps/web/src/shared/api/herramientas.ts` | W5 | Plan §6.3 |

Un carril puede programar contra una firma aunque su implementación aún no esté integrada **solo si su ficha lo dice**. Los contratos de las áreas (`contratos/<area>.ts`) no están congelados para su dueño mientras su carril está abierto; al integrarse, sí.

## 4. Grafo de dependencias y qué arranca ya

```
C0 ──► DB1a ──┬──► S1 ──┬──► S3b ──► S9
              │         ├──► S4
              ├──► S2 ──┤     (S3b y S7 también necesitan S2)
              └──► S3a  │
       DB1b ────────────┼──► S5 ──► S8   (S8 también necesita S2)
   (tras DB1a; no       ├──► S6
    espera a S1)        └──► S7

W1 ──┬──► W2 ──────────────┬──► W7 (S3b, W4, W5)        W6 a W10 necesitan la decisión D3
     ├──► W3               ├──► W8 (S5, W5)
     └──► W4 (C0) ─────────┼──► W9 (S6)
          W5 (S1, W1) ─────┴──► W6 (S4, W4) · W10 (S7, S8, S9, W2)

X1 ──► necesita D7 (host) y al menos W4
```

**Arrancan ya, en paralelo, sin ninguna decisión pendiente: C0 y W1.** C0 trabaja en `apps/api` y `packages/shared`; W1 solo en `apps/web`.

| Ronda | En paralelo (máximo 4) | Se puede lanzar cuando | Decisión que necesita |
|---|---|---|---|
| 0 | **C0 · W1** | ahora | ninguna (modo B si no hay permiso de commits) |
| 1 | DB1a · W2 · W3 | C0 integrado (DB1a) · W1 integrado (W2, W3) | — |
| 2 | S1 · S2 · S3a · W4 | DB1a integrado · C0 y W1 integrados | — |
| 3 | DB1b · S3b · S4 · W5 | S1 integrado (y S2 para S3b) | — |
| 4 | S5 · S6 · S7 · W7 | DB1b y S1 (S7: también S2) · W7: S3b, W2, W4, W5 | D3 para W7 |
| 5 | S8 · S9 · W6 · W8 | S5 y S2 · S3b · S4, W4, W5 · S5, W2, W5 | D3 para W6 y W8 |
| 6 | W9 · W10 · X1 | S6 · S7, S8, S9 · host decidido | D3 para W9 y W10 · D7 para X1 |

Reglas de la tabla: no más de **cuatro** carriles abiertos a la vez (lo que un integrador revisa bien y lo que cuesta en tokens una ronda); **un solo carril de datos abierto**; si falta D3, todo lo demás sigue y solo esperan W6 a W10 (o se hacen con cargadores de ruta si el usuario la rechaza). Antes de lanzar S3b, S4, S5, S6, S7 se confirma que S1 no pidió cambios de contrato.

## 5. Carriles

Esfuerzo para un Sonnet de esfuerzo medio: **S** media sesión · **M** una sesión · **L** dos sesiones (el carril viene partido en a y b). Si una sesión llega al 70 % de su contexto sin terminar, **hace un corte limpio**: deja la verificación en verde hasta donde llegó y describe lo que falta.

Comandos de verificación (se citan por nombre en las fichas):
- **VERIF-SERVIDOR:** `pnpm check` en el directorio del carril (con su `CAPAZ_TEST_DB`).
- **VERIF-WEB:** `pnpm --filter @capaz/shared build && pnpm --filter web typecheck && pnpm --filter web lint && pnpm --filter web test && pnpm --filter web build && pnpm --filter api test` (lo último corre la prueba de arquitectura, que también vigila `apps/web/src`; no usa base).
- **VERIF-DATOS:** dentro de `apps/api`, `node scripts/migrar.ts --base capaz_test_<id>` dos veces seguidas (idempotente); después `pnpm check` en la raíz y `pnpm db:generar` (no debe generar nada).

---

### C0 · Andamiaje y contratos
- **Fase:** P · **Esfuerzo:** M · **Depende de:** nada · **Quién:** el integrador, o un solo Sonnet; mientras dura, nadie más trabaja en `apps/api` ni en `packages/shared`.
- **Propiedad exclusiva:** `packages/shared/src/**` · `apps/api/src/app.module.ts` · `apps/api/src/core/modulos/**` · `apps/api/src/core/auth/guardia.ts` · `apps/api/src/core/empresas/empresas.controller.ts` · `apps/api/src/core/herramientas/{tipos.ts,registro.ts,herramientas.module.ts}` · `apps/api/src/core/eventos/tipos.ts` · los `<area>.module.ts` vacíos de `core/{auditoria,eventos,correlativos,clientes,productos,sucursales,miembros,borradores,plataforma,conectores,automatizaciones,intercambio}` · `apps/api/src/modules/**` · `apps/api/src/infra/config/**` · `apps/api/src/pruebas/**` · `apps/api/scripts/preparar-base.ts` · `.env.example`.
- **Lee:** plan, fase P y §6.1, §6.2 · `packages/shared/src/{modulos,yo,dinero,index}.ts` · `apps/api/src/core/auth/guardia.ts` · `apps/api/src/core/modulos/*.ts` · `apps/api/src/pruebas/*.ts` · `cotizin/src/shared/herramientas/{tipos,registro}.ts` (copia de referencia).
- **Pasos:**
  1. `packages/shared`: `FAMILIAS`, `FAMILIAS_CLASICAS`, `NOMBRE_DE_FAMILIA`; `familia` y `orden` en `manifiestoDeModuloSchema` (con la regla «nulo solo en `core`»); `familia` y `orden` en `moduloDeYoSchema`.
  2. `dinero.ts`: `milesimasSchema`, `Milesimas`, `importe`. `listado.ts`. `herramientas.ts`. `conectores.ts`.
  3. `contratos/`: los 20 archivos de área con `export const contratosDe<Area> = {} as const;` y `export const eventosDe<Area> = {} as const;`, e `index.ts` con los mapas y tipos de §6.1. `src/index.ts` reexporta todo.
  4. Pruebas unitarias de 1 a 3 (lista en la fase P, entrega 1).
  5. Manifiestos: `familia` y `orden` en `registro` y `cotizador`; siete manifiestos nuevos en construcción con su `<codigo>.module.ts` vacío (fase P, entrega 2); permisos nuevos en `manifiesto-core.ts` (entrega 3).
  6. `core/herramientas/tipos.ts` y `registro.ts` según §6.2, portando de Cotizín la validación de nombre, ayuda y críticas; `herramientas.module.ts` global que exporta `RegistroDeHerramientas`. Prueba unitaria del registro (repetidos, crítica sin `resumir`, permiso fuera del manifiesto).
  7. `core/modulos/acceso.service.ts`: mover ahí la consulta de membresía y `cargarAcceso` del guardia; el guardia lo llama. **Sin cambiar comportamiento.**
  8. `core/eventos/tipos.ts`. Un `<area>.module.ts` vacío por carpeta nueva de `core/`. `app.module.ts` importa todos los módulos y pasa los nueve manifiestos a `ModulosModule.con([...])`.
  9. `empresas.controller.ts`: `yo` incluye `familia` y `orden`.
  10. `infra/config/config.ts`: las cinco variables de §6.2 con sus pruebas; `.env.example`.
  11. `CAPAZ_TEST_DB` en `src/pruebas/{base-de-pruebas,app-de-pruebas,global-setup}.ts` y en `scripts/preparar-base.ts`; `app-de-pruebas.ts` pone `RELEVO_ACTIVO=false`.
- **Pruebas exigidas:** las de los pasos 4 y 6; las 82 de integración siguen pasando sin tocar sus aserciones (salvo `yo`, que gana dos campos).
- **Verificación:** VERIF-SERVIDOR dos veces: sin `CAPAZ_TEST_DB` y con `CAPAZ_TEST_DB=capaz_test_c0` (tras `pnpm db:preparar`); y `pnpm db:generar` no genera nada.
- **Hecho cuando:** `yo` de una empresa nueva lista los nueve módulos con su familia, y agregar un contrato a un archivo de área no obliga a tocar ningún índice.
- **Parar y preguntar si:** lo de la fase P; o `as const satisfies` con mapas vacíos no compila en TypeScript 6.0.3 como está escrito (proponer la forma equivalente, no improvisarla en silencio).

### DB1 · Datos de la ola 1
- **Fase:** D (tandas DB1a y DB1b) · **Esfuerzo:** M + M (una sesión por tanda) · **Depende de:** C0 integrado. DB1b además de DB1a integrado.
- **Propiedad exclusiva:** `apps/api/drizzle/**` · `apps/api/drizzle.config.ts` · `apps/api/src/db/esquema/**` · `apps/api/src/infra/database/{aislamiento,catalogo,contratacion}.int.spec.ts`.
- **Lee:** plan, fase D y §6.4 (solo su tanda) · `docs/MODULOS-Y-MERCADO.md` §8 · `apps/api/drizzle/0002_modulos_y_contratacion.sql` (modelo de «generado + seguridad al final») · `apps/api/src/db/esquema/core-modulos.ts` (modelo de estilo) · las tres pruebas de su propiedad.
- **Pasos (por tanda):**
  1. Un archivo de esquema por migración (nombres en la fase D, paso 1) y su `export *` en `src/db/esquema/index.ts`.
  2. Por cada migración: `pnpm db:generar --name=<nombre>`; revisar el SQL generado; añadir al final el bloque «Seguridad a mano» con `aplicar_aislamiento`, `abrir_a_plataforma`, permisos por columna y disparadores exactamente como dice §6.4.
  3. DB1a: `0006_herramientas`, `0007_eventos_y_contadores`, `0008_datos_maestros`. DB1b: `0009_plataforma`, `0010_conexiones`, `0011_automatizaciones_y_borradores`.
  4. `EJEMPLOS`: una entrada por tabla nueva con `tenant_id`, con su modo. `PERMITIDO`: lo que `capaz_sistema` recibe a nivel de tabla.
  5. DB1a: prueba nueva `PERMITIDO_POR_COLUMNA` (fase D, paso 4).
  6. Prueba nueva: `capaz_sistema` no puede `select carga from core.eventos_salida` (DB1a) ni `select credenciales_cifradas from core.conexiones` (DB1b), y sí puede leer las columnas permitidas.
  7. Comprobación manual de la red de seguridad: quitar un `aplicar_aislamiento`, ver fallar la prueba de catálogo, reponerlo. Decirlo en el informe.
- **Pruebas exigidas:** catálogo, aislamiento y plataforma en verde con las tablas nuevas; las del paso 5 y 6.
- **Verificación:** VERIF-DATOS.
- **Hecho cuando:** lo anterior, y el informe lista las migraciones nuevas para la sesión de Neon.
- **Parar y preguntar si:** lo de la fase D; o una columna de §6.4 es ambigua (no elegir tipo ni restricción por cuenta propia).

### S1 · Herramientas
- **Fase:** 5a · **Esfuerzo:** L (S1a ejecutor; S1b puerta HTTP y herramientas) · **Depende de:** DB1a integrado.
- **Propiedad exclusiva:** `apps/api/src/core/herramientas/**` (sin cambiar las firmas exportadas de `tipos.ts` ni de `registro.ts`) · `apps/api/src/core/auditoria/**` · `apps/api/src/core/empresas/herramientas/**` · `apps/api/src/core/empresas/empresas.module.ts` · `packages/shared/src/contratos/{empresa,modulos,auditoria}.ts`.
- **Lee:** plan, fase 5a y §6.2 · `cotizin/src/shared/herramientas/**` y `cotizin/src/app/api/herramientas/route.ts` · `apps/api/src/infra/database/con-empresa.ts` · `apps/api/src/infra/http/{contexto,error-de-negocio}.ts` · `apps/api/src/pruebas/app-de-pruebas.ts` · `apps/api/src/core/auth/auth.int.spec.ts` (modelo de prueba por HTTP).
- **Pasos S1a:**
  1. Portar `confirmacion.ts` y `errores-de-zod.ts` con sus pruebas.
  2. `auditoria/`: escritor de `core.auditoria` (éxito dentro de la transacción; rechazo en transacción propia).
  3. `ejecutor.ts`: `EjecutorDeHerramientas` con el orden de la fase 5a, punto 1, y la transacción única del punto 2. Idempotencia y confirmaciones contra sus tablas. `ejecutarDentro` comparte todo salvo abrir la transacción, con una prueba de una herramienta que ejecuta otra (éxito y rechazo).
  4. `core/herramientas/pruebas.ts`: `herramientaDePrueba()` para registrar herramientas con contrato en línea en un `RegistroDeHerramientas` suelto (no se agregan contratos de prueba a `@capaz/shared`).
  5. Portar `ejecutar.test.ts` de Cotizín caso por caso; tabla en el informe: caso · portado o «no aplica» y por qué.
- **Pasos S1b:**
  6. `herramientas.controller.ts`: `POST /api/v1/herramientas/:nombre` (fase 5a, punto 6). El contexto sale de `contextoActual()`; sin empresa responde `sin_empresa`.
  7. Contratos y herramientas `empresa_ver_configuracion`, `empresa_actualizar_configuracion`, `modulo_solicitar` (en `core/empresas/herramientas/`) y `auditoria_listar` (en `core/auditoria/`), registradas con un proveedor por carpeta.
  8. Pruebas por HTTP real de la lista de la fase 5a.
- **Verificación:** VERIF-SERVIDOR.
- **Hecho cuando:** lo de la fase 5a, y el informe dice explícitamente **«contratos de §6.2 suficientes»** o lista los cambios pedidos.
- **Parar y preguntar si:** lo de la fase 5a.

### S2 · Eventos y correlativos
- **Fase:** 8 · **Esfuerzo:** M · **Depende de:** DB1a integrado. No depende de S1.
- **Propiedad exclusiva:** `apps/api/src/core/eventos/**` (sin cambiar `tipos.ts`) · `apps/api/src/core/correlativos/**`.
- **Lee:** plan, fase 8 y §6.2 · `apps/api/src/infra/database/{con-empresa,database.service}.ts` · `apps/api/src/core/modulos/acceso.service.ts` · `apps/api/src/infra/config/config.ts`.
- **Pasos:**
  1. `emisor.ts`: `emitir` (el mapa de eventos es inyectable para poder probar con eventos de prueba) y la señal al relevo tras confirmar.
  2. `registro-de-consumidores.ts` y `registro-de-tareas.ts`.
  3. `relevo.ts`: `procesarLote()`, reserva corta con el grupo `sistema`, entrega en `conEmpresa`, reintentos, `fallido_en`, arranque y parada con el ciclo de vida de Nest, apagado si `RELEVO_ACTIVO` es falso.
  4. `mantenimiento.ts` como tarea periódica.
  5. `correlativos/siguiente-numero.ts`.
  6. Pruebas de la fase 8 (todas de integración; reloj inyectado).
- **Verificación:** VERIF-SERVIDOR.
- **Hecho cuando:** lo de la fase 8.
- **Parar y preguntar si:** lo de la fase 8; o el contexto `sistema` necesita permisos que `ServicioDeAcceso` no puede dar.

### S3 · Datos maestros (servidor)
- **Fase:** 7 (servidor) · **Esfuerzo:** L (S3a dominio y repositorios; S3b herramientas y eventos) · **Depende de:** S3a: DB1a. S3b: S1 y S2 integrados.
- **Propiedad exclusiva:** `apps/api/src/core/{clientes,productos,sucursales}/**` · `apps/api/src/core/empresas/empresas.service.ts` · `packages/shared/src/contratos/{clientes,productos,sucursales}.ts` · `docs/COMO-CREAR-UN-MODULO.md`.
- **Lee:** plan, fase 7 y §6.4 (`0008`) · `apps/api/src/db/esquema/core-maestros.ts` · `cotizin/src/features/clientes/` · para S3b: `core/herramientas/tipos.ts`, una herramienta de S1 como modelo, `core/eventos/emisor.ts`.
- **Pasos S3a:** 1. `domain/` de las tres entidades con pruebas unitarias (normalización, documento, código de sucursal). 2. `repositories/` (crear, editar, ver, listar con cursor, buscar por parecido con `similarity`, archivar, restaurar), probados contra base real con dos empresas. 3. Sucursal principal en `EmpresasService.asegurar`.
- **Pasos S3b:** 4. Contratos de las herramientas de la fase 7 con `paginaSchema` y `listadoSchema`. 5. Herramientas y su proveedor por entidad. 6. Eventos `cliente.*` y `producto.*`. 7. Pruebas por HTTP de la fase 7. 8. Escribir `docs/COMO-CREAR-UN-MODULO.md`.
- **Verificación:** VERIF-SERVIDOR.
- **Hecho cuando:** lo de la fase 7 (servidor).
- **Parar y preguntar si:** falta una columna; o el índice de parecido no se usa con el filtro por empresa y la búsqueda tarda (medir con 10 000 filas de prueba y traer el número, no optimizar por cuenta propia).

### S4 · Miembros e invitaciones
- **Fase:** 6b (servidor) · **Esfuerzo:** M · **Depende de:** S1 integrado.
- **Propiedad exclusiva:** `apps/api/src/core/miembros/**` · `packages/shared/src/contratos/miembros.ts`.
- **Lee:** plan, fase 6b · `apps/api/src/core/auth/{auth,rutas-permitidas}.ts` · la API de servidor del plugin de organización en `node_modules/better-auth` (versión instalada) · migración `0002` (tablas `usuario_modulos`, `empresa_modulos`).
- **Pasos:** 1. Contratos. 2. Servicio que usa `auth.api.*` del plugin de organización para invitar, anular, cambiar rol y quitar, y `core.usuario_modulos` para asignar. 3. Las cinco reglas de la fase 6b como funciones puras con pruebas. 4. Herramientas y proveedor. 5. Pruebas por HTTP de la fase 6b.
- **Verificación:** VERIF-SERVIDOR.
- **Hecho cuando:** lo de la fase 6b (servidor).
- **Parar y preguntar si:** la API de servidor de Better Auth no permite una operación sin abrir su ruta pública; o hace falta leer `auth.*` con `capaz_app`.

### S5 · Borradores
- **Fase:** 13 (servidor) · **Esfuerzo:** M · **Depende de:** S1 y DB1b integrados.
- **Propiedad exclusiva:** `apps/api/src/core/borradores/**` · `packages/shared/src/contratos/borradores.ts`.
- **Lee:** plan, fase 13 y §6.2 · `core/herramientas/ejecutor.ts` · `apps/api/src/db/esquema/core-automatizaciones.ts`.
- **Pasos:** 1. `proponer.ts` con la firma congelada. 2. Repositorio. 3. Contratos y las cinco herramientas. 4. `borrador_aprobar`: ejecutar la propuesta con `ejecutarDentro` y marcar aprobado en la misma transacción; reenviar `confirmacion`; si rechaza, responder ese rechazo. 5. Evento `borrador.propuesto` (si S2 no está integrado, dejar la llamada tras una interfaz y decirlo). 6. Pruebas de la fase 13.
- **Verificación:** VERIF-SERVIDOR.
- **Hecho cuando:** lo de la fase 13 (servidor).
- **Parar y preguntar si:** `ejecutarDentro` no alcanza para aprobar en una sola transacción (es un cambio de contrato para el integrador); o se pide guardar el motivo del rechazo en el borrador.

### S6 · Plataforma (servidor)
- **Fase:** 9a · **Esfuerzo:** M · **Depende de:** S1 y DB1b integrados.
- **Propiedad exclusiva:** `apps/api/src/core/plataforma/**` · `packages/shared/src/contratos/plataforma.ts`.
- **Lee:** plan, fase 9a · `docs/PLATAFORMA-Y-PLANES.md` · `apps/api/scripts/plataforma.ts` (misma lógica, por línea de comandos) · migraciones `0002`, `0003` y `0009` · `contratacion.int.spec.ts`.
- **Pasos:** 1. `GuardiaDePlataforma` y controlador. 2. Registro y ejecutor de plataforma (grupo `sistema`, auditoría en `core.auditoria_plataforma`, confirmación para lo crítico reutilizando `confirmacion.ts`). 3. Contratos y herramientas de la fase 9a. 4. Pruebas.
- **Verificación:** VERIF-SERVIDOR.
- **Hecho cuando:** lo de la fase 9a.
- **Parar y preguntar si:** una herramienta necesita un permiso de `capaz_sistema` que la lista de plataforma no trae (solicitud de cambio de esquema; no dar permisos por cuenta propia).

### S7 · Conexiones
- **Fase:** 11a (puntos 1 a 5) · **Esfuerzo:** M · **Depende de:** S1, S2 y DB1b integrados.
- **Propiedad exclusiva:** `apps/api/src/core/conectores/**` · `apps/api/src/modules/webhooks/**` · `packages/shared/src/contratos/conexiones.ts`.
- **Lee:** plan, fase 11a · `docs/adr/ADR-014-conectores-y-automatizaciones.md` · `packages/shared/src/conectores.ts` · migración `0010`.
- **Pasos:** 1. `cifrado.ts` con pruebas (ida y vuelta, clave equivocada, versión). 2. `RegistroDeConectores` y sincronización de `core.conectores`. 3. Herramientas de conexión y de claves de API. 4. Ruta de entrada. 5. Consumidor de salida con validación de destino y firma. 6. Manifiesto real de `webhooks`. 7. Pruebas con servidor simulado (`node:http`) de la fase 11a.
- **Verificación:** VERIF-SERVIDOR.
- **Hecho cuando:** un webhook de salida llega firmado al servidor simulado y uno de entrada repetido se guarda una vez.
- **Parar y preguntar si:** lo de la fase 11a; o un secreto aparece en un registro o en una respuesta durante las pruebas.

### S8 · Automatizaciones
- **Fase:** 11a (puntos 6 a 9) · **Esfuerzo:** M · **Depende de:** S2 y S5 integrados.
- **Propiedad exclusiva:** `apps/api/src/core/automatizaciones/**` · `packages/shared/src/contratos/automatizaciones.ts`.
- **Lee:** plan, fase 11a · migración `0011` · `core/borradores/proponer.ts` · `core/eventos/tipos.ts` · `core/herramientas/ejecutor.ts`.
- **Pasos:** 1. `tipos.ts` con `FuenteDeTiempo` y su registro. 2. Evaluador puro de condiciones y sustitución de plantillas, con pruebas unitarias. 3. Motor: disparo por evento, por tiempo (tarea periódica) y manual; modos; límite diario; `regla_probar`. 4. Fuente `core.prueba_de_modulo_vence`. 5. Contratos y herramientas. 6. Pruebas de la fase 11a.
- **Verificación:** VERIF-SERVIDOR.
- **Hecho cuando:** una regla por tiempo deja un borrador en la bandeja, una sola vez.
- **Parar y preguntar si:** una condición pedida no cabe en los seis operadores (no añadir expresiones).

### S9 · Importar y exportar
- **Fase:** 11b · **Esfuerzo:** M · **Depende de:** S3b integrado.
- **Propiedad exclusiva:** `apps/api/src/core/intercambio/**` · `packages/shared/src/contratos/intercambio.ts`.
- **Lee:** plan, fase 11b · herramientas de `core/clientes` y `core/productos`.
- **Pasos:** 1. `csv.ts` (leer y escribir) con pruebas unitarias. 2. Mapas de columnas por entidad. 3. Las tres herramientas, reutilizando el dominio de S3. 4. Pruebas por HTTP.
- **Verificación:** VERIF-SERVIDOR.
- **Hecho cuando:** lo de la fase 11b.
- **Parar y preguntar si:** se pide Excel (D10).

### W1 · Base web
- **Fase:** 6a-1 · **Esfuerzo:** M · **Depende de:** nada. **Sin dependencias nuevas.**
- **Propiedad exclusiva:** `apps/web/**` salvo `apps/web/package.json`.
- **Lee:** plan, fase 6a y §6.3 · `docs/FRONTEND-INVESTIGACION.md` §6.3, §6.4 y §6.7 (solo esas) · `apps/web/src/**` (3 archivos) · `packages/shared/src/{yo,respuesta,dinero}.ts` · `cotizin/src/shared/utils/tema.ts` y `cotizin/src/shared/components/erp/kit/` (referencia propia).
- **Pasos:**
  1. Carpetas de la sección 5 del plan. `shared/estilos/tokens.css` con los tokens de §6.3, valores provisionales propios, claro y oscuro, `--color-*: initial`. Script en línea anti-parpadeo en `index.html`.
  2. Kit base de §6.3, un archivo por pieza en `shared/ui/`. Objetivos táctiles de 44 px, foco visible, etiquetas y errores asociados, `aria-label` en español en todo botón de icono.
  3. `shared/api/cliente.ts`, `shared/sesion/`, `shared/formato/` con pruebas unitarias de lo puro.
  4. `app/rutas.tsx` y `app/proveedores.tsx`; `app/carcasa/carcasa.tsx` mínimo (solo el hueco de contenido); un `rutas.tsx` vacío por área: `core/{acceso,inicio,clientes,productos,bandeja,conecta,automatizaciones,invitaciones}`, `core/ajustes/{empresa,historial,usuarios,sucursales}`, `modules/{registro,crm,ordenes,insumos,compras,personal,reportes,cotizador}`, `plataforma`. Cada uno muestra «En construcción» con `EstadoVacio`.
  5. Guarda de rutas con `destinoSegunSesion` (con pruebas).
  6. `/kit` (solo si `import.meta.env.DEV`): `app/kit/kit-base.tsx` con cada pieza en todos sus estados y `app/kit/kit-datos.tsx` vacío para W2.
  7. Borrar `pages/inicio.tsx` e `index.css` antiguos, ya reemplazados.
- **Pruebas exigidas:** unitarias de guardas, formato, tema y cliente (con `fetch` simulado). Sin pruebas de DOM (D4).
- **Verificación:** VERIF-WEB.
- **Hecho cuando:** la aplicación abre, `/kit` muestra todas las piezas, y el informe trae la lista de revisión visual (cada pieza, a 390 y 1280 px, claro y oscuro).
- **Parar y preguntar si:** `@theme` con variables por tema no cambia los colores al cambiar `data-tema` en Tailwind 4.3 (probar la variante `@theme inline` y reportar cuál funcionó); o una pieza pide una dependencia.

### W2 · Kit de datos
- **Fase:** 6a-2 · **Esfuerzo:** M · **Depende de:** W1 integrado.
- **Propiedad exclusiva:** `apps/web/src/shared/ui/datos/**` · `apps/web/src/app/kit/kit-datos.tsx`.
- **Lee:** plan §6.3 · `apps/web/src/shared/ui/` (lo de W1) · `packages/shared/src/listado.ts`.
- **Pasos:** 1. Las ocho piezas de datos de §6.3. `Lista<T>` recibe columnas tipadas y filas; a menos de 640 px muestra tarjetas con el mismo orden de lectura; cabeceras con `scope` y `aria-sort`. 2. Lógica pura aparte (orden, selección, estado de `Ficha`) con pruebas unitarias. 3. Mostrar todo en `/kit` con datos marcados «Ejemplo».
- **Verificación:** VERIF-WEB.
- **Hecho cuando:** una lista de 200 filas de ejemplo ordena y pagina en `/kit` sin desbordar a 390 px.
- **Parar y preguntar si:** una pieza supera 150 líneas por accesibilidad (D6).

### W3 · Acceso
- **Fase:** 3b · **Esfuerzo:** M · **Depende de:** W1 integrado. Sin dependencias nuevas: los formularios llaman con `pedir` y la sesión llega por el cargador de la ruta.
- **Propiedad exclusiva:** `apps/web/src/core/acceso/**`.
- **Lee:** plan, fase 3b · `apps/api/src/core/auth/{rutas-permitidas.ts,auth.int.spec.ts}` (forma de las peticiones y respuestas) · `packages/shared/src/yo.ts` · `cotizin/src/app/(auth)/`.
- **Pasos:** 1. `core/acceso/api.ts`: registrarse, iniciar y cerrar sesión, crear empresa, con `pedir`. 2. Las tres pantallas con el kit. 3. Rutas en `core/acceso/rutas.tsx`. 4. Pruebas unitarias de validación y de mensajes por código de error.
- **Verificación:** VERIF-WEB.
- **Hecho cuando:** lo de la fase 3b.
- **Parar y preguntar si:** lo de la fase 3b.

### W4 · Carcasa
- **Fase:** 6a-3 · **Esfuerzo:** M · **Depende de:** C0 y W1 integrados. Sin dependencias nuevas: `yo` llega por el cargador de la ruta.
- **Propiedad exclusiva:** `apps/web/src/app/carcasa/**` · `apps/web/src/core/inicio/**`.
- **Lee:** plan, fase 6a-3 · `packages/shared/src/{modulos,yo}.ts` · `apps/web/src/shared/{ui,sesion}/`.
- **Pasos:** 1. Función pura `menuDesdeYo(yo)` → núcleo, familias (las clásicas siempre) y ajustes, con el estado y la acción de cada módulo; pruebas unitarias con los seis motivos de acceso y `enConstruccion`. 2. Barra superior, menú lateral, barra inferior móvil, modo solo iconos. 3. `/inicio`. 4. Selector de empresa. 5. Redirección de módulo sin acceso. 6. «Solicitar» queda preparado detrás de una función; se conecta a `modulo_solicitar` cuando W5 esté integrado (decirlo en el informe si aún no lo está).
- **Verificación:** VERIF-WEB.
- **Hecho cuando:** lo de la fase 6a-3.
- **Parar y preguntar si:** lo de la fase 6a.

### W5 · Herramientas en pantalla
- **Fase:** 5b · **Esfuerzo:** S · **Depende de:** S1 y W1 integrados. Sin dependencias nuevas: la cola de escrituras es el porte de Cotizín y las lecturas usan el cargador de la ruta.
- **Propiedad exclusiva:** `apps/web/src/shared/api/herramientas.ts` · `apps/web/src/shared/api/llamador/**` · `apps/web/src/core/ajustes/{empresa,historial}/**`.
- **Lee:** plan, fase 5b y §6.3 · `cotizin/src/shared/hooks/use-llamador.tsx` · `cotizin/src/shared/utils/estado-del-llamador.ts` y su prueba · `packages/shared/src/contratos/{empresa,auditoria}.ts`.
- **Pasos:** 1. `llamar` y el estado del llamador (portado con sus pruebas). 2. Indicador de guardado. 3. Flujo de confirmación en dos pasos. 4. Las dos pantallas.
- **Verificación:** VERIF-WEB.
- **Hecho cuando:** lo de la fase 5b.
- **Parar y preguntar si:** persistir la cola entre recargas exige una dependencia (no se hace en esta fase).

### W6 a W10 · Pantallas de la ola 1
Necesitan D3 (`@tanstack/react-query`, para listas con caché); si el usuario la rechaza, el integrador lo dice en el brief y las lecturas se hacen con cargadores de ruta de React Router. Misma forma para las cinco: **Lee** su fase del plan, los contratos de su área en `packages/shared/src/contratos/`, `docs/COMO-CREAR-UN-MODULO.md` y `/kit`. **Pasos:** 1. `api.ts` del área con `llamar`. 2. Pantallas solo con piezas del kit (sin estilos sueltos). 3. Rutas en su `rutas.tsx`. 4. Pruebas unitarias de la lógica pura. **Verificación:** VERIF-WEB. **Parar y preguntar si:** falta una pieza en el kit o un dato en un contrato (solicitud de cambio; no crear la pieza dentro del área).

| Carril | Fase | Esfuerzo | Depende de (integrados) | Propiedad exclusiva (`apps/web/src/`) | Hecho cuando |
|---|---|---|---|---|---|
| **W6 · Usuarios y accesos** | 6b (web) | M | S4, W4, W5 | `core/ajustes/usuarios/**`, `core/invitaciones/**` | El de la fase 6b |
| **W7 · Datos maestros** | 7 (web) | M | S3b, W2, W4, W5 | `core/clientes/**`, `core/productos/**`, `core/ajustes/sucursales/**` | Se crea un cliente y un producto desde 390 px |
| **W8 · Bandeja** | 13 (web) | S | S5, W2, W5 | `core/bandeja/**` | El de la fase 13 |
| **W9 · Consola de plataforma** | 9b | M | S6, W2, W5 | `plataforma/**` | El de la fase 9b |
| **W10 · Conecta y automatizaciones** | 11c | M | S7, S8, S9, W2, W5 | `core/conecta/**`, `core/automatizaciones/**` | Se importa un CSV y se prueba una regla desde la pantalla |

### X1 · Despliegue
- **Fase:** 10a · **Esfuerzo:** M · **Depende de:** D7 (host) y W4 integrado · **Propiedad exclusiva:** `Dockerfile`, `.dockerignore`, `docs/DESPLIEGUE.md`. Servir la web desde la API toca `configurar-app.ts`: es una solicitud de cambio al integrador. **Parar y preguntar si:** hay que crear cuentas, dominios o cualquier recurso de pago.

### Carriles de las olas 2 y 3 (módulos clásicos)
No se lanzan sin ADR-015 aprobado (D2) ni sin pasar la puerta de revisión del arquitecto. Forma fija por módulo:

| Carril | Propiedad exclusiva | Depende de | Sigue |
|---|---|---|---|
| **DB2 / DB3** (datos de la ola) | la del carril de datos | puerta de revisión | Fichas 14 a 19 del plan; crea los esquemas nuevos y los agrega a `schemaFilter` y a las tres pruebas |
| **M-`<codigo>`-s** | `apps/api/src/modules/<codigo>/**` · `packages/shared/src/contratos/<codigo>.ts` | su tanda de datos | `docs/COMO-CREAR-UN-MODULO.md` y la ficha del módulo |
| **M-`<codigo>`-w** | `apps/web/src/modules/<codigo>/**` | su `-s` integrado | La ficha del módulo y el kit |

En paralelo dentro de la ola 2: `registro`, `crm` y `ordenes` (no se importan entre sí). En la ola 3: `insumos`, `personal` y `reportes`; `compras` después de `insumos`.

## 6. El integrador

### 6.1 Lanzar un carril
1. Comprobar en la tabla de rondas que sus dependencias están **integradas** y que su decisión, si la tiene, está tomada.
2. Preparar el directorio (2.5) y, si es de servidor, su base (`pnpm db:preparar` con su `CAPAZ_TEST_DB`).
3. Lanzar el agente (Sonnet, esfuerzo medio) con el brief de la sección 7, sin añadir contexto de la conversación. Con permiso de commits se puede usar el aislamiento por worktree de la herramienta de agentes.
4. Apuntar el carril como «abierto» en el tablero del plan (§8).

### 6.2 Lista de verificación de integración
1. El informe tiene el formato de `PLAN-DE-CONSTRUCCION.md` §0 (incluye «solicitudes de cambio») y la verificación pegada, en verde.
2. **Propiedad:** la lista de archivos cambiados (`git diff --stat main...carril/<id>` o `diff -rq`) está entera dentro de la propiedad del carril. Uno solo fuera: se devuelve.
3. **Compartidos intactos:** sin cambios en `package.json`, `pnpm-lock.yaml`, `app.module.ts`, `infra/`, `drizzle/` (salvo el carril de datos), contratos congelados.
4. **Reglas:** sin `process.env` ni `pg` fuera de su sitio (lo cubre la prueba); sin secretos en el diff (buscar `postgres://`, `SECRET`, `CLAVE=`); sin servicios externos; sin dependencias.
5. **Regla 12:** ningún nombre de pantalla o componente, texto, icono, color o medida tomado de otro ERP; en carriles web, mirar los nombres de archivos y los textos.
6. **Seguridad, a mano:** leer entero todo diff que toque `core/herramientas`, `core/auth`, `core/plataforma`, `core/conectores` o `drizzle/`. Preguntas fijas: ¿algo sale de los argumentos que debería salir de la sesión?, ¿alguna consulta fuera de `conEmpresa`?, ¿algún permiso nuevo para `capaz_sistema`?, ¿algún dato sensible en auditoría o registros?
7. **Pruebas:** las «Pruebas exigidas» de la ficha existen y prueban lo que dicen (abrir dos al azar).
8. Integrar en el orden de 2.7; `pnpm install --frozen-lockfile`; `pnpm db:migrar`; **`pnpm check` completo en `main`**.
9. Si es el carril de datos: `pnpm db:generar` no genera nada; avisar a la sesión de Neon con la lista de migraciones.
10. Tablero del plan (§8) y `docs/RELEVO.md` al día; `graphify update .`.
11. Solicitudes de cambio del informe: resolverlas o encolarlas. Revisión visual pendiente: sumarla a la lista del usuario.
12. Cerrar: quitar el worktree o la copia y borrar la base `capaz_test_<id>`. Liberar los carriles que dependían de este.

### 6.3 Puerta entre olas
Antes de la ola 2 y de la ola 3: informe al usuario (qué quedó, qué se usa de verdad, decisiones abiertas), revisión del arquitecto de las fichas siguientes contra lo aprendido, y confirmación del usuario de que la ola siguiente sigue siendo la prioridad.

## 7. Plantilla de brief

El integrador copia esto, cambia lo que va entre `<>` y no añade nada más. El brief no depende de la conversación.

```
Eres el agente del carril <ID · nombre> de Capaz ERP. Trabajas SOLO en este directorio: <ruta del worktree o copia>.
Modelo: Sonnet, esfuerzo medio. Escribe en español.

Lee, en este orden y nada más:
1. AGENTS.md
2. docs/PLAN-PARALELO.md: secciones 2 y 8, y tu ficha «<ID> · <nombre>» (búscala con grep -n '^### ' docs/PLAN-PARALELO.md)
3. Lo que tu ficha diga en «Lee».

Tu trabajo es ejecutar los pasos de tu ficha, <todos | la parte <a|b>>, tal como están escritos.
- Solo puedes crear o modificar archivos de tu «Propiedad exclusiva». Todo lo demás es de solo lectura.
- No decidas arquitectura. Si un paso no se puede cumplir como está escrito, o se cumple un «Parar y preguntar si», PARA y repórtalo.
- No instales dependencias, no toques Neon, no edites migraciones (salvo que seas el carril de datos), no levantes servidores de desarrollo.
- Commits: <no hagas ninguno | solo en la rama carril/<id>, con el mensaje «carril <ID>: resumen»>.
- Las versiones instaladas son más nuevas que tu memoria: lee la API en node_modules antes de usarla.

Estado de partida: <dependencias ya integradas; p. ej. «C0 y DB1a integrados; S1 aún no»>.
Base de pruebas: <CAPAZ_TEST_DB ya está en tu .env | no aplica>.

Termina cuando el comando de verificación de tu ficha esté en verde. Entrega un informe con este formato:
qué se hizo · qué se verificó (comando y resultado) · qué no se hizo y por qué · desviaciones del plan ·
solicitudes de cambio a archivos ajenos (archivo · qué · por qué · qué paso bloquea) · revisión visual pendiente · qué necesita el usuario.
```

## 8. Reglas para ahorrar tokens (agente de carril)

1. **Lee solo lo que dice tu brief.** No abras el plan entero, ni las versiones archivadas, ni `FRONTEND-INVESTIGACION.md` completo, ni `MODULOS-Y-MERCADO.md` salvo la sección que cite tu ficha.
2. **No re-explores el repositorio.** Las rutas están en tu ficha. Si necesitas ubicar algo, primero `graphify query "<pregunta>"` (existe `graphify-out/`); después una búsqueda acotada a una carpeta. Nunca un listado recursivo de todo.
3. **No releas archivos grandes ni lo que acabas de editar.** De un archivo largo lee el tramo que necesitas. No abras `pnpm-lock.yaml`, `drizzle/meta/*.json`, `graphify-out/graph.json` ni `node_modules` enteros: de una librería, solo el archivo de tipos o la página de documentación de la función que vas a usar.
4. **De la copia de Cotizín, solo los archivos que nombra tu ficha.**
5. **Corre las pruebas de tu carpeta mientras trabajas** (`npx vitest run <ruta>`; para integración `npx vitest run -c vitest.int.config.ts <ruta>` dentro de `apps/api`) y la verificación completa una vez, al final. No pegues salidas largas: el resumen y los fallos.
6. **No escribas documentación** que tu ficha no pida. No reformatees ni «mejores» archivos que no son tu tarea.
7. **No delegues tu carril entero en otro agente** ni lances subagentes para explorar.
8. **Si te atascas dos veces en lo mismo, para** y repórtalo con el error exacto: preguntar cuesta menos que insistir.
9. **El informe es corto:** el formato pedido, sin repetir el plan.

## 9. Decisiones abiertas y qué carriles esperan

La lista completa, con recomendación, está en `PLAN-DE-CONSTRUCCION.md` §9. Resumen de bloqueos:

| Decisión | Carriles que esperan | Mientras tanto |
|---|---|---|
| D1 · permiso de commits | ninguno | Modo B (copias) |
| D2 · ADR-015 | DB2, DB3 y todos los `M-*` (olas 2 y 3) | Toda la ola 1 avanza |
| D3 · `@tanstack/react-query` | W6 a W10 | Todo lo demás avanza; rechazada, se hacen con cargadores de ruta |
| D4 · pruebas de componentes | ninguno | Solo pruebas de lógica pura |
| D5 · identidad visual | ninguno | Tokens con valores provisionales; el cierre visual espera |
| D7 · host | X1 | — |
| D10 · Excel | ninguno | Solo CSV |
| D11, D12 · voz y proveedores | fases 21 y 22, WhatsApp, pagos | — |
