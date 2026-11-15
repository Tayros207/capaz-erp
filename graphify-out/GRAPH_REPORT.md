# Graph Report - capaz-erp  (2026-11-14)

## Corpus Check
- Corpus is ~42,641 words - fits in a single context window. You may not need a graph.

## Summary
- 694 nodes · 1057 edges · 45 communities (33 shown, 12 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Plan y reglas del constructor
- Configuración de la API
- Errores de negocio
- Dependencias web
- Contexto HTTP y módulo raíz
- Esquema core y aislamiento
- Roles y credenciales de base
- Config TypeScript API
- Raíz del monorepo
- Pruebas de arquitectura
- Paquete shared
- Config TypeScript web
- Dependencias API
- Multiempresa y RLS
- Contratos y herramientas
- Scripts de base
- Config TypeScript node
- Scripts de base (JS)
- Hosting y despliegue
- Config shared
- Dev dependencies API
- Fases y eventos
- Docker Postgres
- Roles y paquetes Nest
- Paquetes de prueba
- Monolito modular
- Pruebas y voz
- Reglas no negociables
- Lint API
- Build TypeScript
- Nest CLI
- Lint web
- pnpm workspace
- Drizzle config
- Tipos de config
- tsconfig web
- Schematics
- oxlint
- oxlint tsgolint
- Prettier
- Tipos express
- Tipos pg
- Cobertura Vitest
- Favicon

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 22 edges
2. `compilerOptions` - 18 edges
3. `AGENTS.md (reglas del constructor)` - 18 edges
4. `scripts` - 17 edges
5. `compilerOptions` - 15 edges
6. `@nestjs/common` - 14 edges
7. `scripts` - 14 edges
8. `analizar()` - 11 edges
9. `DatabaseService` - 11 edges
10. `compilerOptions` - 11 edges

## Surprising Connections (you probably didn't know these)
- `AGENTS.md (reglas del constructor)` --references--> `ADR 001 a 012`  [EXTRACTED]
  AGENTS.md → docs/PLAN-CIMIENTOS.md
- `apps/api AGENTS.md (ESM, Vitest)` --references--> `AGENTS.md (reglas del constructor)`  [EXTRACTED]
  apps/api/AGENTS.md → AGENTS.md
- `apps/api README (plantilla NestJS)` --conceptually_related_to--> `Pila: React+Vite, NestJS 12, PostgreSQL+Drizzle, Better Auth, Zod`  [INFERRED]
  apps/api/README.md → README.md
- `apps/web README (plantilla React Vite)` --conceptually_related_to--> `Pila: React+Vite, NestJS 12, PostgreSQL+Drizzle, Better Auth, Zod`  [INFERRED]
  apps/web/README.md → README.md
- `Capaz ERP` --references--> `Modulo Cotizador`  [EXTRACTED]
  README.md → docs/FINALIDAD-Y-OBJETIVOS-ERP.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Puertas unicas: base, operaciones y sesion** — conempresa, ejecutar_herramientas, rls_aislamiento_tenant, roles_de_base_capaz [INFERRED 0.85]
- **Flujo voz a borrador a aprobacion** — registro_por_voz, agente_propone_usuario_aprueba, ejecutar_herramientas, modulo_registro [INFERRED 0.85]
- **Contratacion y control de acceso por modulo** — consola_de_plataforma, planes_y_precios, empresa_modulos_contratacion, tres_niveles_de_control [INFERRED 0.85]
- **Defensa en capas del aislamiento multiempresa** — docs_adr_adr_004_multiempresa_y_rls_force_rls, docs_adr_adr_004_multiempresa_y_rls_con_empresa, docs_adr_adr_011_cuatro_roles_de_base_capaz_app, docs_adr_adr_012_convenciones_de_datos_fk_compuestas [INFERRED 0.85]
- **Estrategia de pruebas sin e2e** — docs_adr_adr_007_pruebas_sin_e2e_integracion_postgres, docs_adr_adr_007_pruebas_sin_e2e_pruebas_contrato, docs_adr_adr_007_pruebas_sin_e2e_pruebas_arquitectura, docs_adr_adr_007_pruebas_sin_e2e_revision_visual_manual, docs_adr_adr_007_pruebas_sin_e2e_pruebas_equivalencia [EXTRACTED 1.00]
- **Puerta unica de operaciones por herramientas** — docs_adr_adr_005_registro_de_herramientas_registro_herramientas, docs_adr_adr_009_la_puerta_http_son_las_herramientas_endpoint_herramientas, docs_adr_adr_009_la_puerta_http_son_las_herramientas_mapa_de_contratos, docs_adr_adr_005_registro_de_herramientas_auditoria [INFERRED 0.85]

## Communities (45 total, 12 thin omitted)

### Community 0 - "Plan y reglas del constructor"
Cohesion: 0.06
Nodes (48): ADR 001 a 012, Agente: instrucciones, conocimiento, herramientas, disparadores, AGENTS.md (reglas del constructor), apps/api AGENTS.md (ESM, Vitest), apps/api README (plantilla NestJS), apps/web index.html (entrada de la SPA), apps/web README (plantilla React Vite), Atlantisgraf (cliente piloto) (+40 more)

### Community 1 - "Configuración de la API"
Cohesion: 0.07
Nodes (21): Config, CONFIG, ConfigInvalida, esquemaDeConfig, leerConfig(), ConfigModule, secreto, base (+13 more)

### Community 2 - "Errores de negocio"
Cohesion: 0.09
Nodes (32): MENSAJES, FiltroDeErrores, ejecutar(), Traduccion, traducir(), Codigo, codigoDeEstado(), CODIGOS (+24 more)

### Community 3 - "Dependencias web"
Cohesion: 0.06
Nodes (44): dependencies, @capaz/shared@workspace:*, react@^19.3.1, react-dom@^19.3.1, react-router@^8.5.1, devDependencies, oxlint@^1.90.0, tailwindcss@^4.3.5 (+36 more)

### Community 4 - "Contexto HTTP y módulo raíz"
Cohesion: 0.08
Nodes (20): AppModule, leerConfigDelEntorno(), almacen, CanalDeLlamada, conContexto(), contextoActual(), ContextoDePeticion, crearContexto() (+12 more)

### Community 5 - "Esquema core y aislamiento"
Cohesion: 0.09
Nodes (22): core, empresaConfig, ADR-0012, A, B, EJEMPLOS, ESQUEMAS, ADR-0011 (+14 more)

### Community 6 - "Roles y credenciales de base"
Cohesion: 0.15
Nodes (24): Credencial, Rol, baseDe(), cargarEnv(), conBase(), credencialDe(), credencialesDeRoles(), ROLES (+16 more)

### Community 7 - "Config TypeScript API"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, allowSyntheticDefaultImports, declaration, emitDecoratorMetadata, esModuleInterop, experimentalDecorators, incremental (+14 more)

### Community 8 - "Raíz del monorepo"
Cohesion: 0.09
Nodes (22): description, engines, node, name, packageManager, private, scripts, build (+14 more)

### Community 9 - "Pruebas de arquitectura"
Cohesion: 0.16
Nodes (16): ./e.js, analizar(), analizarServidor(), analizarWeb(), Archivo, capaDe(), Config, esCodigo() (+8 more)

### Community 10 - "Paquete shared"
Cohesion: 0.11
Nodes (20): dependencies, zod@^4.6.7, devDependencies, @types/node@^24.0.0, typescript@^6.0.3, vitest@^4.1.2, exports, files (+12 more)

### Community 11 - "Config TypeScript web"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 12 - "Dependencias API"
Cohesion: 0.11
Nodes (19): dependencies, @capaz/shared@workspace:*, drizzle-orm@^0.45.4, @nestjs/common@^12.4.2, @nestjs/core@^12.4.2, @nestjs/platform-express@^12.4.2, pg@^8.23.1, pino@^10.4.0 (+11 more)

### Community 13 - "Multiempresa y RLS"
Cohesion: 0.14
Nodes (16): Migraciones drizzle-kit generate mas SQL propio, ADR-004: Multiempresa con tenant_id y RLS forzada, Better Auth (id de organizacion = tenant_id), conEmpresa(ctx, fn) unica puerta a la base, tenant_id en toda tabla de negocio, Integracion contra PostgreSQL real con rol capaz_app, ADR-012: Convenciones de datos, Migracion entre empresas: quitar FORCE y reaplicar aplicar_aislamiento (+8 more)

### Community 14 - "Contratos y herramientas"
Cohesion: 0.13
Nodes (18): ADR-002: Web y API separadas (React+Vite y NestJS), sin Next.js, Contratos Zod en packages/shared (fuente unica de verdad), Interfaz React 19 + Vite + Tailwind 4 + React Router, ADR-005: Registro unico de herramientas; el agente sin permisos especiales, Rechazo de argumentos reservados (empresaId, usuarioId, permisos, canal), core.auditoria (solo insercion), Canales ui, agente, mcp, sistema, Confirmacion con token firmado de un solo uso, solo desde la pantalla (+10 more)

### Community 15 - "Scripts de base"
Cohesion: 0.12
Nodes (17): scripts, build, db:generar, db:migrar, db:migrar:test, db:preparar, format, lint (+9 more)

### Community 16 - "Config TypeScript node"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "Scripts de base (JS)"
Cohesion: 0.24
Nodes (11): cargarEnv(), conBase(), credencialDe(), credencialesDeRoles(), ROLES, urlDeAdmin(), urlDelDueno(), variable() (+3 more)

### Community 18 - "Hosting y despliegue"
Cohesion: 0.14
Nodes (13): Mismo origen en produccion: la API sirve la web compilada, Servidor NestJS 12 (ESM), API REST /api/v1, Pagina publica de cotizaciones en HTML simple por WhatsApp, ADR-003: PostgreSQL y Drizzle; alojamiento en Neon, Cloudflare R2 (archivos), Condiciones de verificacion de Neon (fase 10a), Dinero en centimos enteros, solo soles, Drizzle ORM con controlador pg (+5 more)

### Community 19 - "Config shared"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, isolatedModules, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 20 - "Dev dependencies API"
Cohesion: 0.15
Nodes (13): devDependencies, @nestjs/cli@^12.0.12, @nestjs/mau@^0.2.6, source-map-support@^0.5.21, @types/node@^24.0.0, typescript@^6.0.3, vitest@^4.1.2, @types/node (+5 more)

### Community 21 - "Fases y eventos"
Cohesion: 0.17
Nodes (13): Diseno Pliego, Modulo Registro (deudas, abonos, movimientos), capaz_sistema (tareas entre empresas, sin acceso a datos de negocio), Correlativos por empresa en core.contadores, core.eventos_salida y relevo con skip locked, Fase 6: carcasa de pantalla, usuarios y accesos, Fase 7: corte de referencia Clientes, Fase 8: eventos entre modulos y correlativos (outbox) (+5 more)

### Community 22 - "Docker Postgres"
Cohesion: 0.17
Nodes (11): environment, image, ports, volumes, POSTGRES_DB, POSTGRES_PASSWORD, POSTGRES_USER, services (+3 more)

### Community 23 - "Roles y paquetes Nest"
Cohesion: 0.17
Nodes (12): Roles de base capaz_owner, capaz_app, capaz_ro, ADR-010: Sin paquetes 0.x de NestJS en los cimientos, Paquetes @nestjs 0.x descartados (drizzle, idempotency, outbox, authentication, authorization), Salida de eventos e idempotencia propias sobre PostgreSQL, ADR-011: Cuatro roles de base, esquema auth y sin security definer sobre RLS, capaz_app (negocio, sin acceso a auth), capaz_auth (solo esquema auth), capaz_owner (migraciones, sin superusuario ni BYPASSRLS) (+4 more)

### Community 24 - "Paquetes de prueba"
Cohesion: 0.20
Nodes (9): @nestjs/testing@^12.4.2, vite@^8.0.0, vite, license, name, private, type, version (+1 more)

### Community 25 - "Monolito modular"
Cohesion: 0.25
Nodes (8): ADR-001: Monolito modular, no microservicios, empresa_modulos (que modulo usa cada empresa), Manifiesto de modulo con dependencias, core.modulo_activo(tenant, modulo), Permisos en tres niveles: identidad, rol y modulo, Patrones tomados de Odoo: manifiesto, anatomia de modulo, permisos declarados, paquete regional, Fase 4: modulos, contratacion y permisos, res_users (usuarios y permisos de Odoo)

### Community 26 - "Pruebas y voz"
Cohesion: 0.22
Nodes (9): Prueba de arquitectura de fronteras entre modulos, Borradores del Registro por voz persistidos con estado pendiente, ADR-007: Pruebas sin e2e, Pruebas de arquitectura (fronteras y RLS en catalogo), Pruebas de equivalencia contra funciones SQL de Tairos.RC, ADR-008: Logica del Registro en TypeScript y voz primero, Reescribir la logica de dinero en TypeScript, Tairos.RC (Registro actual, 23 funciones SQL, Supabase) (+1 more)

### Community 27 - "Reglas no negociables"
Cohesion: 0.22
Nodes (7): Pruebas de contrato con esquemas compartidos, Revision visual manual a 390 y 1280 px, claro y oscuro, 17 reglas no negociables del constructor, Referencias: Odoo 20.0 (solo para estudio), Cotizin (copia de referencia de solo lectura), Odoo 20.0 Community (referencia de solo lectura), sale_order (ventas de Odoo)

### Community 28 - "Lint API"
Cohesion: 0.29
Nodes (6): env, node, rules, typescript/no-explicit-any, typescript/no-floating-promises, $schema

### Community 29 - "Build TypeScript"
Cohesion: 0.29
Nodes (6): compilerOptions, rootDir, exclude, extends, include, ./tsconfig.json

### Community 30 - "Nest CLI"
Cohesion: 0.33
Nodes (5): collection, compilerOptions, deleteOutDir, $schema, sourceRoot

### Community 31 - "Lint web"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 32 - "pnpm workspace"
Cohesion: 0.50
Nodes (3): overrides, typescript, packages

## Knowledge Gaps
- **43 isolated node(s):** `ADR-0011`, `ADR-0011`, `./e.js`, `ADR-0012`, `ADR-0011` (+38 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 273 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pg` connect `Esquema core y aislamiento` to `Configuración de la API`, `Roles y credenciales de base`, `Dependencias API`, `Scripts de base (JS)`, `Paquetes de prueba`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **What connects `ADR-0011`, `ADR-0011`, `./e.js` to the rest of the system?**
  _43 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Plan y reglas del constructor` be split into smaller, more focused modules?**
  _Cohesion score 0.0573025856044724 - nodes in this community are weakly interconnected._
- **Why does `@nestjs/common` connect `Configuración de la API` to `Paquetes de prueba`, `Errores de negocio`, `Dependencias API`, `Contexto HTTP y módulo raíz`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Should `Configuración de la API` be split into smaller, more focused modules?**
  _Cohesion score 0.06636500754147813 - nodes in this community are weakly interconnected._
- **Should `Errores de negocio` be split into smaller, more focused modules?**
  _Cohesion score 0.08862745098039215 - nodes in this community are weakly interconnected._
- **Should `Dependencias web` be split into smaller, more focused modules?**
  _Cohesion score 0.05551020408163265 - nodes in this community are weakly interconnected._