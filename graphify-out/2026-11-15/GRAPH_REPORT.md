# Graph Report - capaz-erp  (2026-11-15)

## Corpus Check
- 749 files · ~421,080 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 5, .map 2, .example 1)

## Summary
- 1114 nodes · 1719 edges · 78 communities (61 shown, 17 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 71 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `9ddea559`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AGENTS.md (reglas del constructor)
- database.service.ts
- src/index.ts
- web/package.json
- kit-ola-2.tsx
- base-de-pruebas.ts
- preparar-base.ts
- compilerOptions
- scripts
- reglas.ts
- shared/package.json
- compilerOptions
- config/config.ts
- FORCE ROW LEVEL SECURITY con politica unica
- Registro de herramientas con ejecutar() unico
- scripts
- compilerOptions
- app.module.ts
- ADR-003: PostgreSQL y Drizzle; alojamiento en Neon
- compilerOptions
- devDependencies
- Fase 8: eventos entre modulos y correlativos (outbox)
- db
- ADR-011: Cuatro roles de base, esquema auth y sin security definer sobre RLS
- catalogo.spec.ts
- Monolito modular (una app, una base)
- ADR-007: Pruebas sin e2e
- Odoo 20.0 Community (referencia de solo lectura)
- api/.oxlintrc.json
- tsconfig.build.json
- nest-cli.json
- web/.oxlintrc.json
- pnpm-workspace.yaml
- config.d.ts
- web/tsconfig.json
- herramientas-de-intercambio.ts
- Fichas congeladas de la ola 2 · Clásicos I (Finanzas ligeras, CRM, Pedidos)
- borradores.int.spec.ts
- config.js
- logger.ts
- pantalla-inicio.tsx
- ejecutor.ts
- favicon.svg (purple lightning-bolt logo, 48x46 favicon)
- EjecutorDeHerramientas
- motor.ts
- 5. Carriles
- Transaccion
- con-empresa.int.spec.ts
- proponer.ts
- .ejecutarDentro
- drizzle-orm
- Fichas de la ola 3 · Clásicos II (Inventario, Compras, Personal, Reportes)
- proponerBorrador
- LoggerDeNest
- 2. Reglas anti-conflicto
- filtro-de-errores.ts
- Plan de trabajo en paralelo de Capaz ERP
- llamar
- HerramientasDeIntercambio
- 10. Lecciones de la ola 1
- 6. El integrador
- carcasa.tsx
- main.ts
- dependencies
- barra-superior.tsx
- guarda.ts
- api/package.json
- con-empresa.ts
- rutaSiguiente
- react-router
- drizzle-kit
- @nestjs/mau@^0.2.6
- @types/express@^5.0.0
- @types/node@^24.0.0
- typescript@^6.0.3

## God Nodes (most connected - your core abstractions)
1. `5. Carriles` - 30 edges
2. `EjecutorDeHerramientas` - 25 edges
3. `compilerOptions` - 22 edges
4. `vitest` - 20 edges
5. `compilerOptions` - 18 edges
6. `AGENTS.md (reglas del constructor)` - 18 edges
7. `scripts` - 17 edges
8. `@nestjs/common` - 17 edges
9. `Transaccion` - 16 edges
10. `compilerOptions` - 15 edges

## Surprising Connections (you probably didn't know these)
- `1. Reglas comunes de todo módulo clásico` --references--> `EjecutorDeHerramientas`  [INFERRED]
  docs/FICHAS-OLA-2.md → apps/api/src/core/herramientas/ejecutor.ts
- `S1 · Herramientas` --references--> `contextoActual()`  [INFERRED]
  docs/PLAN-PARALELO.md → apps/api/src/infra/http/contexto.ts
- `W1 · Base web` --references--> `destinoSegunSesion()`  [INFERRED]
  docs/PLAN-PARALELO.md → apps/web/src/shared/sesion/guarda.ts
- `1. Reglas comunes de todo módulo clásico` --references--> `lectura()`  [INFERRED]
  docs/FICHAS-OLA-2.md → apps/api/src/core/intercambio/herramientas-de-intercambio.ts
- `4.1 Manifiesto (lo edita M-registro-s1)` --references--> `lectura()`  [INFERRED]
  docs/FICHAS-OLA-2.md → apps/api/src/core/intercambio/herramientas-de-intercambio.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Estrategia de pruebas sin e2e** — docs_adr_adr_007_pruebas_sin_e2e_integracion_postgres, docs_adr_adr_007_pruebas_sin_e2e_pruebas_contrato, docs_adr_adr_007_pruebas_sin_e2e_pruebas_arquitectura, docs_adr_adr_007_pruebas_sin_e2e_revision_visual_manual, docs_adr_adr_007_pruebas_sin_e2e_pruebas_equivalencia [EXTRACTED 1.00]
- **Defensa en capas del aislamiento multiempresa** — docs_adr_adr_004_multiempresa_y_rls_force_rls, docs_adr_adr_004_multiempresa_y_rls_con_empresa, docs_adr_adr_011_cuatro_roles_de_base_capaz_app, docs_adr_adr_012_convenciones_de_datos_fk_compuestas [INFERRED 0.85]
- **Puerta unica de operaciones por herramientas** — docs_adr_adr_005_registro_de_herramientas_registro_herramientas, docs_adr_adr_009_la_puerta_http_son_las_herramientas_endpoint_herramientas, docs_adr_adr_009_la_puerta_http_son_las_herramientas_mapa_de_contratos, docs_adr_adr_005_registro_de_herramientas_auditoria [INFERRED 0.85]
- **Puertas unicas: base, operaciones y sesion** — conempresa, ejecutar_herramientas, rls_aislamiento_tenant, roles_de_base_capaz [INFERRED 0.85]
- **Contratacion y control de acceso por modulo** — consola_de_plataforma, planes_y_precios, empresa_modulos_contratacion, tres_niveles_de_control [INFERRED 0.85]
- **Flujo voz a borrador a aprobacion** — registro_por_voz, agente_propone_usuario_aprueba, ejecutar_herramientas, modulo_registro [INFERRED 0.85]

## Communities (78 total, 17 thin omitted)

### Community 0 - "AGENTS.md (reglas del constructor)"
Cohesion: 0.06
Nodes (48): ADR 001 a 012, Agente: instrucciones, conocimiento, herramientas, disparadores, AGENTS.md (reglas del constructor), apps/api AGENTS.md (ESM, Vitest), apps/api README (plantilla NestJS), apps/web index.html (entrada de la SPA), apps/web README (plantilla React Vite), Atlantisgraf (cliente piloto) (+40 more)

### Community 1 - "database.service.ts"
Cohesion: 0.17
Nodes (8): BaseDeDatos, ConEmpresa, DatabaseService, DatabaseStatus, HealthController, ADR-0011, HealthResponse, @nestjs/common

### Community 2 - "src/index.ts"
Cohesion: 0.11
Nodes (28): traducir(), 8. N1 · Inicio y bandeja con pendientes, Codigo, codigoDeEstado(), CODIGOS, esCodigo(), estadoHttp(), aCentimos() (+20 more)

### Community 3 - "web/package.json"
Cohesion: 0.05
Nodes (39): dependencies, @capaz/shared, react, react-dom, react-router, @tanstack/react-query, devDependencies, oxlint (+31 more)

### Community 4 - "kit-ola-2.tsx"
Cohesion: 0.07
Nodes (13): buscarEn(), Cantidades(), Cifras(), COLUMNAS, KitOla2(), Navegacion(), PERSONAS, Retardo() (+5 more)

### Community 5 - "base-de-pruebas.ts"
Cohesion: 0.16
Nodes (14): pg@^8.23.1, estadoDe(), A, B, EJEMPLOS, ESQUEMAS, ADR-0011, ADR-0012 (+6 more)

### Community 6 - "preparar-base.ts"
Cohesion: 0.14
Nodes (24): Credencial, Rol, baseDe(), cargarEnv(), conBase(), credencialDe(), credencialesDeRoles(), ROLES (+16 more)

### Community 7 - "compilerOptions"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental (+14 more)

### Community 8 - "scripts"
Cohesion: 0.09
Nodes (22): description, engines, node, name, packageManager, private, scripts, build (+14 more)

### Community 9 - "reglas.ts"
Cohesion: 0.16
Nodes (16): ./e.js, analizar(), analizarServidor(), analizarWeb(), Archivo, capaDe(), Config, esCodigo() (+8 more)

### Community 10 - "shared/package.json"
Cohesion: 0.11
Nodes (20): dependencies, zod@^4.6.7, devDependencies, @types/node@^24.0.0, typescript@^6.0.3, vitest@^4.1.2, exports, files (+12 more)

### Community 11 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "config/config.ts"
Cohesion: 0.20
Nodes (9): Config, CONFIG, ConfigInvalida, esquemaDeConfig, leerConfig(), leerConfigDelEntorno(), secreto, base (+1 more)

### Community 13 - "FORCE ROW LEVEL SECURITY con politica unica"
Cohesion: 0.14
Nodes (16): Migraciones drizzle-kit generate mas SQL propio, ADR-004: Multiempresa con tenant_id y RLS forzada, Better Auth (id de organizacion = tenant_id), conEmpresa(ctx, fn) unica puerta a la base, tenant_id en toda tabla de negocio, Integracion contra PostgreSQL real con rol capaz_app, ADR-012: Convenciones de datos, Migracion entre empresas: quitar FORCE y reaplicar aplicar_aislamiento (+8 more)

### Community 14 - "Registro de herramientas con ejecutar() unico"
Cohesion: 0.13
Nodes (18): ADR-002: Web y API separadas (React+Vite y NestJS), sin Next.js, Contratos Zod en packages/shared (fuente unica de verdad), Interfaz React 19 + Vite + Tailwind 4 + React Router, ADR-005: Registro unico de herramientas; el agente sin permisos especiales, Rechazo de argumentos reservados (empresaId, usuarioId, permisos, canal), core.auditoria (solo insercion), Canales ui, agente, mcp, sistema, Confirmacion con token firmado de un solo uso, solo desde la pantalla (+10 more)

### Community 15 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, db:generar, db:migrar, db:migrar:test, db:preparar, format, lint (+9 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "app.module.ts"
Cohesion: 0.13
Nodes (7): @nestjs/core@^12.4.2, AppModule, ConfigModule, DatabaseModule, HealthModule, HttpModule, @nestjs/core

### Community 18 - "ADR-003: PostgreSQL y Drizzle; alojamiento en Neon"
Cohesion: 0.14
Nodes (13): Mismo origen en produccion: la API sirve la web compilada, Servidor NestJS 12 (ESM), API REST /api/v1, Pagina publica de cotizaciones en HTML simple por WhatsApp, ADR-003: PostgreSQL y Drizzle; alojamiento en Neon, Cloudflare R2 (archivos), Condiciones de verificacion de Neon (fase 10a), Dinero en centimos enteros, solo soles, Drizzle ORM con controlador pg (+5 more)

### Community 19 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, isolatedModules, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 20 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, @nestjs/cli@^12.0.12, @nestjs/schematics@^12.0.0, oxlint@^1.58.0, prettier@^3.4.2, source-map-support@^0.5.21, @types/pg@^8.15.0, vite@^8.0.0 (+9 more)

### Community 21 - "Fase 8: eventos entre modulos y correlativos (outbox)"
Cohesion: 0.17
Nodes (13): Diseno Pliego, Modulo Registro (deudas, abonos, movimientos), capaz_sistema (tareas entre empresas, sin acceso a datos de negocio), Correlativos por empresa en core.contadores, core.eventos_salida y relevo con skip locked, Fase 6: carcasa de pantalla, usuarios y accesos, Fase 7: corte de referencia Clientes, Fase 8: eventos entre modulos y correlativos (outbox) (+5 more)

### Community 22 - "db"
Cohesion: 0.17
Nodes (11): environment, image, ports, volumes, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, services (+3 more)

### Community 23 - "ADR-011: Cuatro roles de base, esquema auth y sin security definer sobre RLS"
Cohesion: 0.17
Nodes (12): Roles de base capaz_owner, capaz_app, capaz_ro, ADR-010: Sin paquetes 0.x de NestJS en los cimientos, Paquetes @nestjs 0.x descartados (drizzle, idempotency, outbox, authentication, authorization), Salida de eventos e idempotencia propias sobre PostgreSQL, ADR-011: Cuatro roles de base, esquema auth y sin security definer sobre RLS, capaz_app (negocio, sin acceso a auth), capaz_auth (solo esquema auth), capaz_owner (migraciones, sin superusuario ni BYPASSRLS) (+4 more)

### Community 24 - "catalogo.spec.ts"
Cohesion: 0.10
Nodes (4): manifiestoCrm, manifiestoOrdenes, manifiestoRegistro, manifiestoWebhooks

### Community 25 - "Monolito modular (una app, una base)"
Cohesion: 0.25
Nodes (8): ADR-001: Monolito modular, no microservicios, empresa_modulos (que modulo usa cada empresa), Manifiesto de modulo con dependencias, core.modulo_activo(tenant, modulo), Permisos en tres niveles: identidad, rol y modulo, Patrones tomados de Odoo: manifiesto, anatomia de modulo, permisos declarados, paquete regional, Fase 4: modulos, contratacion y permisos, res_users (usuarios y permisos de Odoo)

### Community 26 - "ADR-007: Pruebas sin e2e"
Cohesion: 0.22
Nodes (9): Prueba de arquitectura de fronteras entre modulos, Borradores del Registro por voz persistidos con estado pendiente, ADR-007: Pruebas sin e2e, Pruebas de arquitectura (fronteras y RLS en catalogo), Pruebas de equivalencia contra funciones SQL de Tairos.RC, ADR-008: Logica del Registro en TypeScript y voz primero, Reescribir la logica de dinero en TypeScript, Tairos.RC (Registro actual, 23 funciones SQL, Supabase) (+1 more)

### Community 27 - "Odoo 20.0 Community (referencia de solo lectura)"
Cohesion: 0.22
Nodes (7): Pruebas de contrato con esquemas compartidos, Revision visual manual a 390 y 1280 px, claro y oscuro, 17 reglas no negociables del constructor, Referencias: Odoo 20.0 (solo para estudio), Cotizin (copia de referencia de solo lectura), Odoo 20.0 Community (referencia de solo lectura), sale_order (ventas de Odoo)

### Community 28 - "api/.oxlintrc.json"
Cohesion: 0.29
Nodes (6): env, node, rules, typescript/no-explicit-any, typescript/no-floating-promises, $schema

### Community 29 - "tsconfig.build.json"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 30 - "nest-cli.json"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 31 - "web/.oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 32 - "pnpm-workspace.yaml"
Cohesion: 0.50
Nodes (3): overrides, typescript, packages

### Community 36 - "herramientas-de-intercambio.ts"
Cohesion: 0.08
Nodes (8): crear(), crearHerramientasDeIntercambio(), HERRAMIENTA_DE_ALTA, nombreDeEntidad(), PERMISO_DE_EDITAR, PERMISO_DE_VER, resumenDe(), Invocador

### Community 37 - "Fichas congeladas de la ola 2 · Clásicos I (Finanzas ligeras, CRM, Pedidos)"
Cohesion: 0.06
Nodes (36): lectura(), recortar(), 0. Cómo leerlo, 3.1 Tanda DB2a, 3.2 Tanda DB2b, 3. Datos de la ola 2 (DB2a y DB2b), 4.1 Manifiesto (lo edita M-registro-s1), 4.2 Reglas de dinero (dominio; cada una con su prueba unitaria) (+28 more)

### Community 39 - "config.js"
Cohesion: 0.26
Nodes (11): cargarEnv(), conBase(), credencialDe(), credencialesDeRoles(), ROLES, urlDeAdmin(), urlDelDueno(), variable() (+3 more)

### Community 40 - "logger.ts"
Cohesion: 0.27
Nodes (4): CAMPOS_OCULTOS, crearLogger(), LOGGER, LoggerModule

### Community 41 - "pantalla-inicio.tsx"
Cohesion: 0.12
Nodes (4): solicitarModulo(), COLOR_ACENTO, PantallaInicio(), Tarjeta()

### Community 42 - "ejecutor.ts"
Cohesion: 0.08
Nodes (3): Fallo, OpcionesDeEjecucion, Previo

### Community 46 - "EjecutorDeHerramientas"
Cohesion: 0.25
Nodes (6): EjecutorDeHerramientas, filtrarPorPermisos(), rechazar(), Revertir, segundos(), S1 · Herramientas

### Community 47 - "motor.ts"
Cohesion: 0.10
Nodes (6): AccionRechazada, AccionResuelta, Entrada, Opciones, Resultado, Salida

### Community 48 - "5. Carriles"
Cohesion: 0.08
Nodes (25): 5. Carriles, C0 · Andamiaje y contratos, C1 · Paso previo de servidor, Carriles de la ola 2 (módulos clásicos I), Carriles de la ola 3 (módulos clásicos II), DB1 · Datos de la ola 1, DB2 · Datos de la ola 2, K1 · Kit y base web de la ola 2, en dos partes (+17 more)

### Community 50 - "con-empresa.int.spec.ts"
Cohesion: 0.29
Nodes (4): proponer(), CambioDeEmpresa, crearConEmpresa(), conEmpresaDePruebas()

### Community 52 - ".ejecutarDentro"
Cohesion: 0.29
Nodes (5): comoObjeto(), falloDe(), conPuntoDeGuardado(), 1. Reglas comunes de todo módulo clásico, 3. Contratos congelados

### Community 53 - "drizzle-orm"
Cohesion: 0.29
Nodes (5): drizzle-orm@^0.45.4, core, empresaConfig, ADR-0012, drizzle-orm

### Community 54 - "Fichas de la ola 3 · Clásicos II (Inventario, Compras, Personal, Reportes)"
Cohesion: 0.15
Nodes (12): 0. Lo que ya está decidido (no se reabre en la puerta), 1.1 `insumos`, 1.2 `compras`, 1.3 `personal`, 1. Datos (DB3a y DB3b), 2. Fase 17 · `insumos` (Inventario), 3. Fase 18 · `compras`, 4. Fase 19 · `personal` (+4 more)

### Community 55 - "proponerBorrador"
Cohesion: 0.20
Nodes (8): HerramientaConSecretos, HerramientaDeBorradorDesconocida, proponerBorrador(), ADR-016: Reglas de datos y de conducta de los módulos clásicos, Alternativas descartadas, Consecuencias, Contexto, Decisión propuesta

### Community 57 - "2. Reglas anti-conflicto"
Cohesion: 0.22
Nodes (9): 2.1 Propiedad exclusiva, 2.2 Archivos compartidos: dueño único, 2.3 Migraciones: un solo escritor, numeración en serie, 2.4 Dependencias, 2.5 Dónde trabaja cada carril, 2.6 Base de pruebas por carril, 2.7 Orden de integración y suite completa, 2.8 Ante un conflicto (+1 more)

### Community 58 - "filtro-de-errores.ts"
Cohesion: 0.16
Nodes (10): ErrorDeNegocio, MENSAJES, FiltroDeErrores, ejecutar(), Traduccion, crearPipeDeValidacion(), mensajeDeValidacion(), Problema (+2 more)

### Community 59 - "Plan de trabajo en paralelo de Capaz ERP"
Cohesion: 0.29
Nodes (6): 0. Cómo leer este documento (y gastar pocos tokens), 1. Papeles, 7. Plantilla de brief, 8. Reglas para ahorrar tokens (agente de carril), 9. Decisiones abiertas y qué carriles esperan, Plan de trabajo en paralelo de Capaz ERP

### Community 60 - "llamar"
Cohesion: 0.33
Nodes (6): llamar(), 4.1 Ola 2 · grafo y rondas, 4. Grafo de dependencias y qué arranca ya, M-registro-w · M-crm-w · M-ordenes-w · Pantallas de los módulos, W5 · Herramientas en pantalla, W6 a W10 · Pantallas de la ola 1

### Community 62 - "10. Lecciones de la ola 1"
Cohesion: 0.50
Nodes (4): 10.1 Qué salió bien (se mantiene), 10.2 Qué se corrige en el método, 10.3 Lo que no cambia aunque tiente, 10. Lecciones de la ola 1

### Community 63 - "6. El integrador"
Cohesion: 0.50
Nodes (4): 6.1 Lanzar un carril, 6.2 Lista de verificación de integración, 6.3 Puerta entre olas, 6. El integrador

### Community 64 - "carcasa.tsx"
Cohesion: 0.13
Nodes (3): BarraSuperior(), Carcasa(), salir()

### Community 65 - "main.ts"
Cohesion: 0.24
Nodes (10): almacen, CanalDeLlamada, conContexto(), contextoActual(), ContextoDePeticion, crearContexto(), idDePeticion(), middlewareDeContexto() (+2 more)

### Community 66 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @capaz/shared@workspace:*, @nestjs/common@^12.4.2, @nestjs/platform-express@^12.4.2, pino@^10.4.0, pino-http@^11.0.0, reflect-metadata@^0.2.2, rxjs@^7.8.1 (+7 more)

### Community 68 - "guarda.ts"
Cohesion: 0.21
Nodes (10): destinoSegunSesion(), esRuta(), normalizar(), RUTA_INICIAR_SESION, RUTA_INICIO, RUTA_NUEVA_EMPRESA, RUTAS_PUBLICAS, base (+2 more)

### Community 69 - "api/package.json"
Cohesion: 0.17
Nodes (11): @nestjs/testing@^12.4.2, oxlint-tsgolint@^7.0.2001, vitest@^4.1.2, vitest, license, name, private, type (+3 more)

### Community 70 - "con-empresa.ts"
Cohesion: 0.33
Nodes (4): Activa, ContextoDeEmpresa, transaccionActual, transaccionEnCurso()

### Community 71 - "rutaSiguiente"
Cohesion: 0.60
Nodes (5): PantallaIniciarSesion(), enviar(), PantallaRegistro(), enviar(), rutaSiguiente()

### Community 72 - "react-router"
Cohesion: 0.40
Nodes (3): react, react-dom, react-router

## Knowledge Gaps
- **346 isolated node(s):** `COLOR_ACENTO`, `CanalDeLlamada`, `ContextoDePeticion`, `Traduccion`, `Problema` (+341 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 534 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `filtro-de-errores.ts` to `database.service.ts`, `main.ts`, `web/package.json`, `guarda.ts`, `base-de-pruebas.ts`, `borradores.int.spec.ts`, `src/index.ts`, `logger.ts`, `reglas.ts`, `config/config.ts`, `con-empresa.int.spec.ts`, `catalogo.spec.ts`?**
  _High betweenness centrality (0.155) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `EjecutorDeHerramientas` (e.g. with `1. Reglas comunes de todo módulo clásico` and `S1 · Herramientas`) actually correct?**
  _`EjecutorDeHerramientas` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `COLOR_ACENTO`, `CanalDeLlamada`, `ContextoDePeticion` to the rest of the system?**
  _346 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AGENTS.md (reglas del constructor)` be split into smaller, more focused modules?**
  _Cohesion score 0.0573025856044724 - nodes in this community are weakly interconnected._
- **Why does `@nestjs/common` connect `database.service.ts` to `dependencies`, `herramientas-de-intercambio.ts`, `api/package.json`, `logger.ts`, `ejecutor.ts`, `config/config.ts`, `motor.ts`, `app.module.ts`, `filtro-de-errores.ts`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **Should `src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1106612685560054 - nodes in this community are weakly interconnected._
- **Why does `pg` connect `base-de-pruebas.ts` to `database.service.ts`, `api/package.json`, `borradores.int.spec.ts`, `preparar-base.ts`, `config.js`, `con-empresa.int.spec.ts`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._