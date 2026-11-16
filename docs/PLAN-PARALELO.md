# Plan de trabajo en paralelo de Capaz ERP

**Versión 2 · 2026-11-15 (puerta entre la ola 1 y la ola 2) · Para: el integrador (agente principal) y los agentes de carril (Sonnet, esfuerzo medio).**

> **Estado:** la ola 1 está integrada en `main` salvo X1 (despliegue). Las secciones 4 y 5 traen ya las rondas y los carriles de la **ola 2**; el detalle congelado de cada módulo está en `docs/FICHAS-OLA-2.md` y el casi congelado de la ola 3 en `docs/FICHAS-OLA-3.md`. Lo aprendido en la ola 1 está en la sección 10.

`PLAN-DE-CONSTRUCCION.md` dice **qué** se construye y con qué especificación. Este documento dice **cómo lo construyen varios agentes a la vez sin pisarse**: carriles con propiedad exclusiva de archivos, contratos congelados, un solo escritor de migraciones, un integrador y una plantilla de brief. En lo que toca al trabajo simultáneo, **manda este documento** (también sobre «una fase por sesión» de `AGENTS.md`).

## 0. Cómo leer este documento (y gastar pocos tokens)

- **Agente de carril:** lee `AGENTS.md`, las secciones 2 y 8 de este documento, **tu ficha** de la sección 5 y lo que tu ficha diga en «Lee». Nada más. Para encontrar tu ficha: `grep -n '^### ' docs/PLAN-PARALELO.md` y lee solo ese tramo. En las olas 2 y 3 la ficha de la sección 5 es corta (propiedad, dependencias, verificación) y te manda a **una sección** de `docs/FICHAS-OLA-2.md`: lee esa sección y la §1 de ese documento, no el documento entero.
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
| `AGENTS.md`, `docs/PLAN-*.md`, `docs/FICHAS-OLA-*.md`, `docs/RELEVO.md`, `docs/adr/**` | Integrador y arquitecto | — |
| Pruebas con listas que cambian al tocar un manifiesto: `core/modulos/catalogo.spec.ts` (cuántos módulos hay, cuántos «en construcción», cuáles por defecto, familia y orden) | Integrador | La cambia el integrador en el mismo commit en que cambia `enConstruccion`, `porDefecto`, `familia` u `orden` de un manifiesto. Agregar herramientas o permisos a un módulo **no** obliga a tocar ninguna lista (`registro-agregar.spec.ts` y `registro.spec.ts` usan manifiestos propios) |
| `enConstruccion` y `porDefecto` de un manifiesto | Integrador | Los carriles `M-*-s` editan permisos, descripción y secciones de su manifiesto, **nunca** esas dos banderas |
| `apps/web/src/app/proveedores.tsx`, `apps/web/src/app/kit/**`, `apps/web/src/shared/**` | El carril de kit de la ola (K1, K2) mientras está abierto; después el integrador | Una pieza o un ayudante que falte: solicitud de cambio; no se crea dentro del módulo |
| `apps/api/src/pruebas/**`, `apps/api/src/core/herramientas/http-de-pruebas.ts` | Integrador (C1 los amplía) | Un ayudante de prueba que falte: solicitud de cambio |
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

**Contratos que se congelan para la ola 2** (los crea C1 o DB2; detalle en `FICHAS-OLA-2.md`):

| Contrato | Dónde | Lo crea |
|---|---|---|
| Eventos de `registro`, `crm` y `ordenes` | `packages/shared/src/contratos/{registro,crm,ordenes}.ts` (`eventosDe…`) | C1 |
| Origen `modulo` de un borrador | `contratos/borradores.ts`, `core/borradores/proponer.ts` | C1 (+ `CHECK` en DB2a) |
| `alcanceDe(ctx, modulo)` | `apps/api/src/core/modulos/alcance.ts` | C1 |
| `hoyDeLaEmpresa(tx)`, `instanteDeDia(dia)` | `apps/api/src/core/empresas/hoy.ts` | C1 |
| `activarModulo`, `darDeBajaModulo`, `agregarMiembro`, `AppDePruebas.obtener` | `core/herramientas/http-de-pruebas.ts`, `pruebas/app-de-pruebas.ts` | C1 |
| `core.exigir_modulo_en_escritura()`, esquemas `crm` y `ordenes`, tablas de la ola | `apps/api/drizzle/0013` a `0016` | DB2a, DB2b |
| Proveedor global de consultas, `datosOError`, `puedeEscribirEn`, piezas `CampoTextarea`, `CampoCantidad`, `CampoPrecio`, `NavegacionDeSeccion`, `Cifra`, `SelectorDeRegistro`, `Tablero` | `apps/web/src/shared/**`, `app/proveedores.tsx` | K1a, K1b |
| `calcularTotalesDePedido` | `packages/shared/src/contratos/ordenes.ts` | M-ordenes-s1 |

Correcciones al contrato de la ola 1, ya en el código (el plan decía otra cosa): `siguienteNumero` **exige** `anio`; `ejecutarDentro` permite `emitir` y `siguienteNumero` (punto de guardado registrado como transacción en curso); el módulo `core` está eximido de `puedeEscribir` en el ejecutor (un módulo que no es `core`, no); `regla_activar` es siempre crítica; las herramientas con secretos no se pueden proponer como borrador (`HERRAMIENTAS_CON_SECRETOS`).

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

**Estado al 2026-11-15:** rondas 0 a 6 integradas, salvo X1 (espera el host, D7).

### 4.1 Ola 2 · grafo y rondas

```
C1 ──────────────┬──► M-registro-s1 ──► M-registro-s2 ──► M-registro-s3 ──┐
DB2a ──┬─────────┘         │                                              ├──► N1 ──► X2
       └──► DB2b ──┬──► M-crm-s1 ──► M-crm-s2 ────────────────────────────┤
                   └──► M-ordenes-s1 ──► M-ordenes-s2 ────────────────────┘
        (M-crm-s1 y M-ordenes-s1 esperan además a que M-registro-s1 diga «camino de módulo no núcleo validado»)

K1a ──► K1b ──┬──► M-registro-w1 (s1) ──► M-registro-w2 (s3)
              ├──► M-crm-w (crm-s2)
              └──► M-ordenes-w (ordenes-s2)
```

**Arrancan ya, en paralelo, sin ninguna decisión pendiente: C1, K1a y DB2a.** C1 trabaja en `packages/shared` y en archivos sueltos de `apps/api/src/{core,modules,pruebas}`; DB2a en `drizzle/`, `db/esquema/` y las tres pruebas de catálogo; K1a solo en `apps/web`. No comparten ningún archivo.

| Ronda | En paralelo (máximo 4) | Se puede lanzar cuando | Decisión que necesita |
|---|---|---|---|
| 7 | **C1 · K1a · DB2a** | ahora | ninguna |
| 8 | DB2b · M-registro-s1 · K1b | DB2a integrado (DB2b) · C1 y DB2a integrados (s1) · K1a integrado (K1b) | — |
| 9 | M-registro-s2 · M-crm-s1 · M-ordenes-s1 · M-registro-w1 | M-registro-s1 integrado **y validado** · DB2b integrado (crm, ordenes) · K1b integrado (w1) | **D17** antes de M-ordenes-s1 (precios con IGV) |
| 10 | M-registro-s3 · M-crm-s2 · M-ordenes-s2 | su parte anterior integrada · C1 integrado (eventos) | — |
| 11 | M-registro-w2 · M-crm-w · M-ordenes-w · N1 | M-registro-s3 · M-crm-s2 · M-ordenes-s2 · los tres `_resumen` integrados (N1) | — |
| 12 | X2 (cierre, integrador) | todo lo anterior integrado | revisión visual del usuario; X1 si se quiere uso real |

Reglas: **máximo cuatro carriles abiertos a la vez** (se mantiene: en la ola 1 el integrador pudo con cuatro y las correcciones propias que hizo vinieron de contratos, no de la cantidad); **un solo carril de datos abierto**; un carril partido (s1, s2, s3) **se integra parte por parte** y la parte siguiente se lanza en un directorio recién preparado desde `main`; un carril web no se lanza hasta que su servidor está integrado (los tipos de `llamar` salen de los contratos). Si M-registro-s1 informa que R2 o R3 de `FICHAS-OLA-2.md` no funcionan como están escritas, **no se lanzan** M-crm-s1 ni M-ordenes-s1 hasta que el integrador lo resuelva.

Las rondas 13 a 18 (ola 3) están en `FICHAS-OLA-3.md` §7 y se confirman en su puerta.

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

### Carriles de la ola 2 (módulos clásicos I)

Forma común. **Lee siempre:** `docs/FICHAS-OLA-2.md` §1 y la sección que diga tu ficha; `docs/COMO-CREAR-UN-MODULO.md` (carriles `M-*-s`). **Verificación:** VERIF-SERVIDOR, VERIF-WEB o VERIF-DATOS según el tipo. **Parar y preguntar si:** lo que diga tu sección de las fichas; el código y la ficha se contradicen; hace falta tocar un archivo fuera de tu propiedad.

Modelos de código que un carril `M-*-s` abre (y ningún otro): `apps/api/src/core/clientes/herramientas/{clientes-escritura,clientes-lectura,cliente-mapeo,herramientas-de-clientes}.ts` (herramientas y proveedor), `core/clientes/repositories/clientes.repository.ts` (repositorio), `core/borradores/repositorio.ts` (cursor por instante), `core/sucursales/herramientas/sucursales-herramientas.ts` (crítica con `resumir`), `core/clientes/herramientas/datos-maestros.int.spec.ts` (prueba por HTTP), `core/herramientas/http-de-pruebas.ts`, `core/modulos/alcance.ts`, `core/empresas/hoy.ts` y el archivo de esquema de su módulo. Un carril `M-*-w` abre `apps/web/src/core/clientes/` (modelo de pantallas), `/kit` (`app/kit/*.tsx`) y los contratos de su módulo.

### C1 · Paso previo de servidor
- **Fase:** puerta · **Esfuerzo:** S · **Depende de:** nada · **Quién:** el integrador o un solo Sonnet.
- **Propiedad exclusiva:** `packages/shared/src/contratos/{registro,crm,ordenes,borradores}.ts` · `apps/api/src/app.module.ts` · `apps/api/src/modules/registro/registro.module.ts` · `apps/api/src/core/modulos/alcance.ts` (+ su prueba) · `apps/api/src/core/empresas/hoy.ts` (+ su prueba) · `apps/api/src/core/borradores/proponer.ts` · `apps/api/src/core/conectores/enviar.ts` (+ su prueba) · `apps/api/src/pruebas/app-de-pruebas.ts` · `apps/api/src/core/herramientas/http-de-pruebas.ts` · `apps/web/src/core/bandeja/logica.ts` (una línea).
- **Sigue:** `FICHAS-OLA-2.md` §2. Al integrarse, los archivos de contratos de `registro`, `crm` y `ordenes` pasan a ser de sus carriles `M-*-s`.

### DB2 · Datos de la ola 2
- **Fase:** D (tandas DB2a y DB2b) · **Esfuerzo:** M + M · **Depende de:** nada (DB2a) · DB2a integrado (DB2b).
- **Propiedad exclusiva:** la del carril de datos (`apps/api/drizzle/**`, `drizzle.config.ts`, `src/db/esquema/**`, las tres pruebas `aislamiento`, `catalogo` y `contratacion`).
- **Lee:** `FICHAS-OLA-2.md` §3 (solo su tanda) · `docs/MODULOS-Y-MERCADO.md` §8 · `apps/api/drizzle/0008_datos_maestros.sql` (modelo) · `src/db/esquema/core-maestros.ts` · las tres pruebas.
- **DB2a:** `0013_modulos_clasicos_base`, `0014_registro`. **DB2b:** `0015_crm`, `0016_ordenes`.
- **Verificación:** VERIF-DATOS. **Hecho cuando:** lo de §3, la comprobación manual de la red de seguridad (quitar un `aplicar_aislamiento` y ver fallar la prueba) y la lista de migraciones para la sesión de Neon.

### M-registro-s · Finanzas ligeras (servidor), en tres partes
- **Fase:** 14 · **Esfuerzo:** M + M + S · **Depende de:** s1: C1 y DB2a · s2: s1 integrado · s3: s2 integrado.
- **Propiedad exclusiva:** `apps/api/src/modules/registro/**` (menos `enConstruccion` y `porDefecto` del manifiesto) · `packages/shared/src/contratos/registro.ts` (sin cambiar `eventosDeRegistro`).
- **Sigue:** `FICHAS-OLA-2.md` §4.1 a §4.6. s1 debe cerrar su informe con **«camino de módulo no núcleo validado»** o con la lista de lo que falló.

### M-crm-s · CRM (servidor), en dos partes
- **Fase:** 15 · **Esfuerzo:** M + M · **Depende de:** s1: C1, DB2b y M-registro-s1 validado · s2: s1 integrado.
- **Propiedad exclusiva:** `apps/api/src/modules/crm/**` · `packages/shared/src/contratos/crm.ts` (sin cambiar `eventosDeCrm`).
- **Sigue:** `FICHAS-OLA-2.md` §5.1 a §5.4.

### M-ordenes-s · Pedidos (servidor), en dos partes
- **Fase:** 16 · **Esfuerzo:** M + M · **Depende de:** s1: C1, DB2b, M-registro-s1 validado y D17 · s2: s1 integrado.
- **Propiedad exclusiva:** `apps/api/src/modules/ordenes/**` · `packages/shared/src/contratos/{ordenes.ts,ordenes.spec.ts}` (sin cambiar `eventosDeOrdenes`).
- **Sigue:** `FICHAS-OLA-2.md` §6.1 a §6.4.

### K1 · Kit y base web de la ola 2, en dos partes
- **Fase:** 6a (ampliación) · **Esfuerzo:** M + M · **Depende de:** nada (K1a) · K1a integrado (K1b). Sin dependencias nuevas.
- **Propiedad exclusiva:** `apps/web/src/app/proveedores.tsx` · `apps/web/src/app/kit/{kit-ola-2.tsx,pagina-kit.tsx}` · archivos **nuevos** en `apps/web/src/shared/{api,ui,formato,sesion}/` (no se edita ninguna pieza existente).
- **Lee:** `FICHAS-OLA-2.md` §7 · `apps/web/src/shared/ui/{campo,campo-monto,campo-comun}.tsx` · `apps/web/src/plataforma/marco.tsx` (navegación) · `apps/web/src/core/clientes/{api.ts,consultas.tsx,use-retardo.ts}` y `core/productos/logica.ts` (lo que se sube a `shared`, sin tocar los originales).
- **Verificación:** VERIF-WEB.

### M-registro-w · M-crm-w · M-ordenes-w · Pantallas de los módulos

| Carril | Esfuerzo | Depende de (integrados) | Propiedad exclusiva (`apps/web/src/`) | Sigue |
|---|---|---|---|---|
| **M-registro-w1** | M | M-registro-s1, K1b | `modules/registro/**` | `FICHAS-OLA-2.md` §4.7 (w1) |
| **M-registro-w2** | M | M-registro-s3, M-registro-w1 | `modules/registro/**` | §4.7 (w2) |
| **M-crm-w** | M | M-crm-s2, K1b | `modules/crm/**` | §5.4 |
| **M-ordenes-w** | L (dos sesiones) | M-ordenes-s2, K1b | `modules/ordenes/**` | §6.4 |

Común: `api.ts` con `llamar`, `claves.ts`, `logica.ts` con pruebas unitarias, pantallas y hojas con piezas del kit, rutas en su `rutas.tsx`. **No** crean `QueryClient`, **no** copian `datosOError` ni `use-retardo` (están en `shared`). Verificación: VERIF-WEB. El módulo sigue «Próximamente» en el menú hasta que el integrador quite `enConstruccion` al integrar el carril: para revisarlo antes, el integrador lo quita en el directorio de revisión, no el carril.

### N1 · Inicio y bandeja con pendientes
- **Esfuerzo:** S · **Depende de:** M-registro-s3, M-crm-s2 y M-ordenes-s2 integrados.
- **Propiedad exclusiva:** `apps/api/src/core/borradores/**` · `packages/shared/src/contratos/borradores.ts` · `apps/web/src/app/carcasa/**` · `apps/web/src/core/inicio/**` · `apps/web/src/core/bandeja/**`.
- **Sigue:** `FICHAS-OLA-2.md` §8. Verificación: VERIF-SERVIDOR y VERIF-WEB.

### X2 · Cierre de la ola 2
- **Quién:** el integrador. **Sigue:** `FICHAS-OLA-2.md` §9. Propiedad: `apps/api/src/pruebas/recorridos/**`, las banderas de los manifiestos y `core/modulos/catalogo.spec.ts`.

### Carriles de la ola 3 (módulos clásicos II)
No se lanzan hasta pasar la puerta de la ola 3. Misma forma que la ola 2: C2 (eventos y ayudantes), DB3a y DB3b (datos), K2 (kit: gráficos y editor de líneas), `M-insumos-s/-w`, `M-compras-s/-w` (después de `insumos`), `M-personal-s/-w`, `M-reportes-s/-w`, `M-registro-s4` (consumidores nuevos) y X3. Alcance, tablas, herramientas, rondas y la lista de lo que falta decidir: `docs/FICHAS-OLA-3.md`.

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

Añadidos tras la ola 1 (sección 10):

13. **El plan se corrige en la misma integración.** Si el carril se desvió con motivo (un nombre de herramienta, un parámetro obligatorio, una exención), el integrador corrige la ficha o el contrato escrito **en ese commit**. Una desviación que solo vive en el informe se pierde.
14. **Módulos (olas 2 y 3):** toda herramienta del carril declara `modulo: '<codigo>'` (nunca `'core'`); `consumidores.ts` no importa el ejecutor ni escribe en tablas (R5); ninguna herramienta nueva maneja secretos sin estar en `HERRAMIENTAS_CON_SECRETOS`; toda herramienta que crea un ingreso, un egreso o un abono lleva `mueveDinero: true`.
15. **Tamaño:** ninguna función nueva pasa de 50 líneas ni un componente de 150 (la prueba de arquitectura solo vigila las 500 líneas por archivo: esto se mira a mano, abriendo los dos archivos más largos del diff).
16. **Pruebas con servidores simulados:** al menos un caso usa un **nombre de host**, no solo `127.0.0.1` (un literal de IP se salta la resolución de nombres y dejó pasar un fallo en la ola 1).
17. **Banderas y listas:** al integrar un `M-*-w`, quitar `enConstruccion` de su manifiesto y ajustar `core/modulos/catalogo.spec.ts` en el mismo commit.

### 6.3 Puerta entre olas
Antes de la ola 2 y de la ola 3: informe al usuario (qué quedó, qué se usa de verdad, decisiones abiertas), revisión del arquitecto de las fichas siguientes contra lo aprendido, y confirmación del usuario de que la ola siguiente sigue siendo la prioridad.

**Puerta de la ola 2: pasada por el arquitecto el 2026-11-15.** Entregas: `docs/FICHAS-OLA-2.md` (congelada), `docs/FICHAS-OLA-3.md` (casi congelada), `docs/adr/ADR-016` (propuesto), secciones 4.1, 5 y 10 de este documento. Falta del lado del usuario: D17 (antes de la ronda 9) y lo demás de la sección 9. **Puerta de la ola 3:** además de lo anterior, resolver la tabla de `FICHAS-OLA-3.md` §6 y cerrar sus tablas columna por columna.

## 7. Plantilla de brief

El integrador copia esto, cambia lo que va entre `<>` y no añade nada más. El brief no depende de la conversación.

```
Eres el agente del carril <ID · nombre> de Capaz ERP. Trabajas SOLO en este directorio: <ruta del worktree o copia>.
Modelo: Sonnet, esfuerzo medio. Escribe en español.

Lee, en este orden y nada más:
1. AGENTS.md
2. docs/PLAN-PARALELO.md: secciones 2 y 8, y tu ficha «<ID> · <nombre>» (búscala con grep -n '^### ' docs/PLAN-PARALELO.md)
3. Lo que tu ficha diga en «Lee». <Olas 2 y 3: docs/FICHAS-OLA-2.md §1 y §<n> (búscalas con grep -n '^## \|^### ' docs/FICHAS-OLA-2.md); no leas las demás secciones.>

Tu trabajo es ejecutar los pasos de tu ficha, <todos | la parte <a|b>>, tal como están escritos.
- Solo puedes crear o modificar archivos de tu «Propiedad exclusiva». Todo lo demás es de solo lectura.
- No decidas arquitectura. Si un paso no se puede cumplir como está escrito, o se cumple un «Parar y preguntar si», PARA y repórtalo.
- No instales dependencias, no toques Neon, no edites migraciones (salvo que seas el carril de datos), no levantes servidores de desarrollo.
- Commits: <no hagas ninguno | solo en la rama carril/<id>, con el mensaje «carril <ID>: resumen»>.
- Las versiones instaladas son más nuevas que tu memoria: lee la API en node_modules antes de usarla.

Estado de partida: <dependencias ya integradas; p. ej. «C0 y DB1a integrados; S1 aún no»>.
<Carril partido: «Haces SOLO la parte s2. La parte s1 ya está integrada: sus archivos existen; puedes editarlos porque son de tu propiedad, sin cambiar lo que ya hace.»>
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

La lista completa, con recomendación, está en `PLAN-DE-CONSTRUCCION.md` §9. D1 a D6, D9, D10 y D13 quedaron resueltas el 2026-11-15. Bloqueos vigentes:

| Decisión | Carriles que esperan | Mientras tanto |
|---|---|---|
| D7 · host (con Keny) | X1 y, con él, el uso real al cierre de cada ola | Todo se prueba en local |
| D15 · equivalencia con Tairos.RC por casos de referencia | ninguno (M-registro-s2 se construye así) | Rechazada: se añade un carril de equivalencia por SQL después de s2 |
| D16 · anular una deuda exige anular antes sus abonos | ninguno (así está en la ficha) | — |
| **D17 · los precios de un pedido incluyen IGV** | **M-ordenes-s1** (ronda 9) | Las rondas 7 y 8 no dependen de ella |
| D18 · estado «Listo» en los pedidos | ninguno (así está en la ficha) | — |
| D19 · `registro` por defecto con 30 días de prueba | X2 | Se deja como está |
| D20 · nombre visible del módulo `registro` | ninguno (una línea del manifiesto) | Sigue «Registro» |
| D21 · ADR-016 | ninguno si se aprueba como está | — |
| D22 · arreglar ya el envío de webhooks a nombres de host | ninguno (va dentro de C1) | — |
| D23 · revisión visual por tandas de la ola 1 | M-*-w conviene lanzarlos con el kit ya revisado | Se lanzan igual; el riesgo es rehacer |
| D24 · qué significa «avisar» | ninguno en la ola 2 (N1 muestra pendientes) | — |
| D11, D12, D14 | fases 21 y 22, WhatsApp, pagos, ola 5 | — |

## 10. Lecciones de la ola 1

Sacadas del código, de los commits del integrador (los que no son «carril …» ni «Integrar carril …») y de las notas de `RELEVO.md`.

### 10.1 Qué salió bien (se mantiene)

1. **Propiedad exclusiva de archivos.** Veinticuatro carriles o partes de carril integrados sin que el historial muestre un conflicto de fusión. De 73 commits, el integrador escribió código propio en siete.
2. **Un solo escritor de migraciones.** `0006` a `0012` en serie, con el diario y las instantáneas de `drizzle-kit` intactos. Las pruebas de catálogo cumplieron su papel de red.
3. **Una base de pruebas por carril** (`CAPAZ_TEST_DB`): cuatro carriles de servidor probando a la vez sin pisarse.
4. **Validar el contrato con un carril antes de abrir el abanico** (S1 antes de S3b a S9): los cambios de contrato que aparecieron fueron dos, no diez.
5. **Carriles L partidos en a y b** con corte limpio: ninguna sesión se quedó sin contexto a medias.
6. **La receta escrita desde el código real** (`COMO-CREAR-UN-MODULO.md`, por S3b), no desde el plan.
7. **Pruebas por HTTP real** con dos empresas y un `member` de solo lectura como plantilla fija.

### 10.2 Qué se corrige en el método

| # | Qué pasó | Evidencia | Corrección para la ola 2 |
|---|---|---|---|
| 1 | **Contratos congelados leyendo, no usando.** `ejecutarDentro` no dejaba emitir eventos ni pedir correlativos; `borrador_aprobar` no podía aprobar herramientas críticas | commits `65150ad`, `a73e172` (S5b) | El primer carril de módulo (M-registro-s1) valida el camino «módulo no núcleo» antes de lanzar `crm` y `ordenes`; los contratos nuevos (eventos, ayudantes) los pone C1 **copiados de la ficha** |
| 2 | **Archivos compartidos sin dueño previsto** que obligaron al integrador a meterse: una lista en `catalogo.spec.ts`, el cableado de «Solicitar» en la carcasa, la guarda de `/invitacion/:id`, `.env.example`, el tamaño del grupo de conexiones de sistema | commits `1e3e004`, `de1874a`, `1887629`, `f9ffeb1` | Dueño escrito para cada lista y bandera (§2.2); pasos previos C1 y K1 que dejan hecho lo compartido antes de abrir carriles |
| 3 | **Seis áreas web crearon su propio `QueryClient`** y copiaron `datosOError`, `ErrorDeApi` y `use-retardo` | `core/{clientes,productos,bandeja,conecta,automatizaciones}/consultas.tsx`, `plataforma/marco.tsx` | K1a: proveedor global y ayudantes en `shared`; los carriles `M-*-w` tienen prohibido duplicarlos |
| 4 | **Piezas del kit que faltaban** se descubrieron al construir pantallas (`CampoTextarea`) | nota de `RELEVO.md` | K1 va antes que cualquier pantalla de módulo; la lista de piezas sale de las fichas de pantallas |
| 5 | **Desviaciones del plan que solo quedaron en informes:** `plataforma_empresas_ver/crear` (el plan decía `empresa_ver/crear`), `siguienteNumero` con `anio` obligatorio, `core` eximido de `puedeEscribir`, las herramientas de `webhooks` declaradas como `core` | código frente a `PLAN-DE-CONSTRUCCION.md` §6.2 y fases 5a, 9a y 11a | Punto 13 de la lista de integración: el plan se corrige en la misma integración |
| 6 | **Un permiso de infraestructura que el plan no vio:** `pg_trgm` vive en `public` y `capaz_app` no tenía `usage` | migración `0012` | El carril de datos prueba con `capaz_app` **una consulta real** de cada capacidad nueva, no solo el catálogo |
| 7 | **Límites de tamaño que ninguna prueba vigila:** componentes de más de 50 líneas (W10), avisos de lint corregidos en un commit aparte (S8) | nota de `RELEVO.md`, commit `e05d274` | Punto 15 de la lista de integración; tope de 13 herramientas por sesión (R15) |
| 8 | **Pruebas que solo usan `127.0.0.1`:** el envío de webhooks falla con cualquier nombre de host en Node 24 (`ERR_INVALID_IP_ADDRESS` en el `lookup` propio) y ninguna prueba lo vio. Falla cerrado, pero la función no sirve en producción | `core/conectores/enviar.ts`; comprobado con un guion aparte | Arreglo dentro de C1 (paso 8) y punto 16 de la lista de integración |
| 9 | **Listas de seguridad escritas a mano** (`HERRAMIENTAS_CON_SECRETOS`) | `core/borradores/proponer.ts` | Punto 14 de la lista de integración; candidata a ser un campo del contrato de herramienta en la puerta de la ola 3 |
| 10 | **Nada revisado en navegador ni contra Neon.** Más de veinte pantallas (y sus hojas) esperan revisión visual y siete migraciones esperan a Neon | `RELEVO.md` | Revisión visual por tandas antes de la ronda 11 (D23); la sesión de Neon aplica `0006`–`0012` antes de recibir `0013` |
| 11 | **`RELEVO.md` creció como bitácora:** su cuerpo (secciones 1 a 6) describe el estado anterior a la ola 1 y contradice las notas de arriba | `RELEVO.md` | El integrador reescribe el cuerpo en X2; mientras tanto mandan las notas fechadas del principio |
| 12 | **Sonnet y el contexto.** Dos carriles de una sola sesión salieron con más de 2 000 líneas nuevas (S7: 13 herramientas, 25 archivos, 2 479 líneas; W10: 32 archivos, 2 086), el doble que el resto; W10 es justo el que dejó componentes por dividir. El repositorio no guarda cuánto contexto gastó cada sesión: es una inferencia por tamaño | `git show --shortstat` de cada carril | Fichas cortas que apuntan a **una** sección; ayudantes de prueba ya hechos (C1); lista de modelos de código cerrada (§5) |

### 10.3 Lo que no cambia aunque tiente

- Cuatro carriles a la vez, no más: lo que limitó la ola 1 fueron los contratos, y subir el paralelismo multiplica justo eso.
- Un carril no «arregla de paso» un archivo ajeno, aunque el arreglo sea de una línea.
- Ningún carril de módulo escribe migraciones, ni siquiera «solo un índice».
