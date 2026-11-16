# Graph Report - capaz-erp  (2026-11-15)

## Corpus Check
- 547 files · ~270,185 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 5, .map 2, .example 1)

## Summary
- 944 nodes · 1480 edges · 57 communities (47 shown, 10 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1e3e0043`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AGENTS.md (reglas del constructor)
- database.service.ts
- src/index.ts
- web/package.json
- main.ts
- base-de-pruebas.ts
- preparar-base.ts
- compilerOptions
- scripts
- reglas.ts
- shared/package.json
- compilerOptions
- @nestjs/common
- FORCE ROW LEVEL SECURITY con politica unica
- Registro de herramientas con ejecutar() unico
- scripts
- compilerOptions
- config.js
- ADR-003: PostgreSQL y Drizzle; alojamiento en Neon
- compilerOptions
- api/package.json
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
- pantalla-registro.tsx
- config.d.ts
- web/tsconfig.json
- herramientas-de-intercambio.ts
- Relevo: dónde quedó Capaz ERP y cómo seguir
- borradores.int.spec.ts
- proponer.ts
- contexto.ts
- ejecutor.ts
- favicon.svg (purple lightning-bolt logo, 48x46 favicon)
- EjecutorDeHerramientas
- motor.ts
- barra-superior.tsx
- Transaccion
- con-empresa.ts
- config/config.ts
- guarda.ts
- core.ts
- rutaSiguiente
- ConfigModule
- LoggerModule

## God Nodes (most connected - your core abstractions)
1. `EjecutorDeHerramientas` - 23 edges
2. `compilerOptions` - 22 edges
3. `vitest` - 20 edges
4. `compilerOptions` - 18 edges
5. `AGENTS.md (reglas del constructor)` - 18 edges
6. `@nestjs/common` - 17 edges
7. `scripts` - 17 edges
8. `Transaccion` - 16 edges
9. `compilerOptions` - 15 edges
10. `scripts` - 14 edges

## Surprising Connections (you probably didn't know these)
- `5. Cosas que no son obvias (trampas ya pisadas)` --references--> `lectura()`  [INFERRED]
  docs/RELEVO.md → apps/api/src/core/intercambio/herramientas-de-intercambio.ts
- `Auditoria inmutable, idempotencia y outbox de eventos` --shares_data_with--> `ejecutar() y registro de herramientas`  [INFERRED]
  docs/PLAN-DE-CONSTRUCCION.md → AGENTS.md
- `Capaz ERP` --references--> `Modulo Cotizador`  [EXTRACTED]
  README.md → docs/FINALIDAD-Y-OBJETIVOS-ERP.md
- `Capaz ERP` --implements--> `Monolito modular`  [EXTRACTED]
  README.md → docs/ARQUITECTURA-DE-MODULOS.md
- `La plataforma ve contratos, no datos del negocio` --conceptually_related_to--> `Aislamiento por empresa con RLS (tenant_id)`  [INFERRED]
  docs/PLATAFORMA-Y-PLANES.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Estrategia de pruebas sin e2e** — docs_adr_adr_007_pruebas_sin_e2e_integracion_postgres, docs_adr_adr_007_pruebas_sin_e2e_pruebas_contrato, docs_adr_adr_007_pruebas_sin_e2e_pruebas_arquitectura, docs_adr_adr_007_pruebas_sin_e2e_revision_visual_manual, docs_adr_adr_007_pruebas_sin_e2e_pruebas_equivalencia [EXTRACTED 1.00]
- **Defensa en capas del aislamiento multiempresa** — docs_adr_adr_004_multiempresa_y_rls_force_rls, docs_adr_adr_004_multiempresa_y_rls_con_empresa, docs_adr_adr_011_cuatro_roles_de_base_capaz_app, docs_adr_adr_012_convenciones_de_datos_fk_compuestas [INFERRED 0.85]
- **Puerta unica de operaciones por herramientas** — docs_adr_adr_005_registro_de_herramientas_registro_herramientas, docs_adr_adr_009_la_puerta_http_son_las_herramientas_endpoint_herramientas, docs_adr_adr_009_la_puerta_http_son_las_herramientas_mapa_de_contratos, docs_adr_adr_005_registro_de_herramientas_auditoria [INFERRED 0.85]
- **Puertas unicas: base, operaciones y sesion** — conempresa, ejecutar_herramientas, rls_aislamiento_tenant, roles_de_base_capaz [INFERRED 0.85]
- **Contratacion y control de acceso por modulo** — consola_de_plataforma, planes_y_precios, empresa_modulos_contratacion, tres_niveles_de_control [INFERRED 0.85]
- **Flujo voz a borrador a aprobacion** — registro_por_voz, agente_propone_usuario_aprueba, ejecutar_herramientas, modulo_registro [INFERRED 0.85]

## Communities (57 total, 10 thin omitted)

### Community 0 - "AGENTS.md (reglas del constructor)"
Cohesion: 0.06
Nodes (48): ADR 001 a 012, Agente: instrucciones, conocimiento, herramientas, disparadores, AGENTS.md (reglas del constructor), apps/api AGENTS.md (ESM, Vitest), apps/api README (plantilla NestJS), apps/web index.html (entrada de la SPA), apps/web README (plantilla React Vite), Atlantisgraf (cliente piloto) (+40 more)

### Community 1 - "database.service.ts"
Cohesion: 0.13
Nodes (7): BaseDeDatos, ConEmpresa, DatabaseService, DatabaseStatus, HealthController, ADR-0011, HealthResponse

### Community 2 - "src/index.ts"
Cohesion: 0.08
Nodes (37): ErrorDeNegocio, MENSAJES, FiltroDeErrores, ejecutar(), Traduccion, traducir(), crearPipeDeValidacion(), mensajeDeValidacion() (+29 more)

### Community 3 - "web/package.json"
Cohesion: 0.05
Nodes (39): dependencies, @capaz/shared, react, react-dom, react-router, @tanstack/react-query, devDependencies, oxlint (+31 more)

### Community 4 - "main.ts"
Cohesion: 0.15
Nodes (6): leerConfigDelEntorno(), CAMPOS_OCULTOS, crearLogger(), LOGGER, LoggerDeNest, bootstrap()

### Community 5 - "base-de-pruebas.ts"
Cohesion: 0.18
Nodes (14): estadoDe(), A, B, EJEMPLOS, ESQUEMAS, ADR-0011, ADR-0012, abrirPool() (+6 more)

### Community 6 - "preparar-base.ts"
Cohesion: 0.17
Nodes (22): Credencial, Rol, baseDe(), cargarEnv(), conBase(), credencialDe(), credencialesDeRoles(), ROLES (+14 more)

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

### Community 12 - "@nestjs/common"
Cohesion: 0.17
Nodes (7): @nestjs/core@^12.4.2, AppModule, DatabaseModule, HealthModule, HttpModule, @nestjs/common, @nestjs/core

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

### Community 17 - "config.js"
Cohesion: 0.24
Nodes (11): cargarEnv(), conBase(), credencialDe(), credencialesDeRoles(), ROLES, urlDeAdmin(), urlDelDueno(), variable() (+3 more)

### Community 18 - "ADR-003: PostgreSQL y Drizzle; alojamiento en Neon"
Cohesion: 0.14
Nodes (13): Mismo origen en produccion: la API sirve la web compilada, Servidor NestJS 12 (ESM), API REST /api/v1, Pagina publica de cotizaciones en HTML simple por WhatsApp, ADR-003: PostgreSQL y Drizzle; alojamiento en Neon, Cloudflare R2 (archivos), Condiciones de verificacion de Neon (fase 10a), Dinero en centimos enteros, solo soles, Drizzle ORM con controlador pg (+5 more)

### Community 19 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, isolatedModules, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 20 - "api/package.json"
Cohesion: 0.05
Nodes (54): dependencies, @capaz/shared@workspace:*, @nestjs/common@^12.4.2, @nestjs/platform-express@^12.4.2, pg@^8.23.1, pino@^10.4.0, pino-http@^11.0.0, reflect-metadata@^0.2.2 (+46 more)

### Community 21 - "Fase 8: eventos entre modulos y correlativos (outbox)"
Cohesion: 0.17
Nodes (13): Diseno Pliego, Modulo Registro (deudas, abonos, movimientos), capaz_sistema (tareas entre empresas, sin acceso a datos de negocio), Correlativos por empresa en core.contadores, core.eventos_salida y relevo con skip locked, Fase 6: carcasa de pantalla, usuarios y accesos, Fase 7: corte de referencia Clientes, Fase 8: eventos entre modulos y correlativos (outbox) (+5 more)

### Community 22 - "db"
Cohesion: 0.17
Nodes (11): environment, image, ports, volumes, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, services (+3 more)

### Community 23 - "ADR-011: Cuatro roles de base, esquema auth y sin security definer sobre RLS"
Cohesion: 0.17
Nodes (12): Roles de base capaz_owner, capaz_app, capaz_ro, ADR-010: Sin paquetes 0.x de NestJS en los cimientos, Paquetes @nestjs 0.x descartados (drizzle, idempotency, outbox, authentication, authorization), Salida de eventos e idempotencia propias sobre PostgreSQL, ADR-011: Cuatro roles de base, esquema auth y sin security definer sobre RLS, capaz_app (negocio, sin acceso a auth), capaz_auth (solo esquema auth), capaz_owner (migraciones, sin superusuario ni BYPASSRLS) (+4 more)

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

### Community 33 - "pantalla-registro.tsx"
Cohesion: 0.13
Nodes (3): react, react-dom, react-router

### Community 36 - "herramientas-de-intercambio.ts"
Cohesion: 0.07
Nodes (11): crearHerramientasDeIntercambio(), HERRAMIENTA_DE_ALTA, HerramientasDeIntercambio, lectura(), nombreDeEntidad(), PERMISO_DE_EDITAR, PERMISO_DE_VER, recortar() (+3 more)

### Community 37 - "Relevo: dónde quedó Capaz ERP y cómo seguir"
Cohesion: 0.25
Nodes (8): 1. En una frase, 2. Estado exacto, 3. Cómo arrancar el entorno, 4. Mapa del código, 6. Qué hacer ahora, en orden, 7. Documentación, 8. Decisiones del usuario que siguen abiertas, Relevo: dónde quedó Capaz ERP y cómo seguir

### Community 38 - "borradores.int.spec.ts"
Cohesion: 0.11
Nodes (3): CATALOGO, llamar(), PERMISOS

### Community 39 - "proponer.ts"
Cohesion: 0.15
Nodes (5): HerramientaConSecretos, HerramientaDeBorradorDesconocida, HERRAMIENTAS_CON_SECRETOS, proponerBorrador(), PropuestaDeBorrador

### Community 40 - "contexto.ts"
Cohesion: 0.23
Nodes (9): almacen, CanalDeLlamada, conContexto(), contextoActual(), ContextoDePeticion, crearContexto(), idDePeticion(), middlewareDeContexto() (+1 more)

### Community 42 - "ejecutor.ts"
Cohesion: 0.08
Nodes (3): Fallo, OpcionesDeEjecucion, Previo

### Community 46 - "EjecutorDeHerramientas"
Cohesion: 0.18
Nodes (8): comoObjeto(), EjecutorDeHerramientas, falloDe(), filtrarPorPermisos(), rechazar(), Revertir, segundos(), transaccionEnCurso()

### Community 47 - "motor.ts"
Cohesion: 0.10
Nodes (6): AccionRechazada, AccionResuelta, Entrada, Opciones, Resultado, Salida

### Community 49 - "Transaccion"
Cohesion: 0.23
Nodes (4): MotorDeReglas, crear(), conPuntoDeGuardado(), Transaccion

### Community 50 - "con-empresa.ts"
Cohesion: 0.19
Nodes (9): drizzle-orm@^0.45.4, proponer(), Activa, CambioDeEmpresa, ContextoDeEmpresa, crearConEmpresa(), transaccionActual, conEmpresaDePruebas() (+1 more)

### Community 51 - "config/config.ts"
Cohesion: 0.24
Nodes (8): Config, CONFIG, ConfigInvalida, esquemaDeConfig, leerConfig(), secreto, base, url

### Community 52 - "guarda.ts"
Cohesion: 0.23
Nodes (9): destinoSegunSesion(), esRuta(), normalizar(), RUTA_INICIAR_SESION, RUTA_INICIO, RUTA_NUEVA_EMPRESA, RUTAS_PUBLICAS, base (+1 more)

### Community 53 - "core.ts"
Cohesion: 0.40
Nodes (3): core, empresaConfig, ADR-0012

### Community 54 - "rutaSiguiente"
Cohesion: 0.60
Nodes (5): PantallaIniciarSesion(), enviar(), PantallaRegistro(), enviar(), rutaSiguiente()

## Knowledge Gaps
- **275 isolated node(s):** `CATALOGO`, `PERMISOS`, `HERRAMIENTAS_CON_SECRETOS`, `Traduccion`, `Props` (+270 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 434 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `src/index.ts` to `database.service.ts`, `web/package.json`, `main.ts`, `base-de-pruebas.ts`, `borradores.int.spec.ts`, `contexto.ts`, `reglas.ts`, `con-empresa.ts`, `config/config.ts`, `guarda.ts`, `catalogo.spec.ts`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **What connects `CATALOGO`, `PERMISOS`, `HERRAMIENTAS_CON_SECRETOS` to the rest of the system?**
  _275 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AGENTS.md (reglas del constructor)` be split into smaller, more focused modules?**
  _Cohesion score 0.0573025856044724 - nodes in this community are weakly interconnected._
- **Why does `@nestjs/common` connect `@nestjs/common` to `database.service.ts`, `src/index.ts`, `herramientas-de-intercambio.ts`, `main.ts`, `ejecutor.ts`, `motor.ts`, `config/config.ts`, `api/package.json`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Should `database.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12648221343873517 - nodes in this community are weakly interconnected._
- **Why does `pg` connect `base-de-pruebas.ts` to `database.service.ts`, `borradores.int.spec.ts`, `preparar-base.ts`, `config.js`, `con-empresa.ts`, `api/package.json`?**
  _High betweenness centrality (0.058) - this node is a cross-community bridge._
- **Should `src/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07743496672716274 - nodes in this community are weakly interconnected._