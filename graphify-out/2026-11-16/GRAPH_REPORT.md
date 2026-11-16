# Graph Report - capaz-erp  (2026-11-16)

## Corpus Check
- 1007 files · ~698,198 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .map 2, .example 1)

## Summary
- 1796 nodes · 3423 edges · 106 communities (96 shown, 10 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 148 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `033ba759`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AGENTS.md (reglas del constructor)
- sembrar-demo.ts
- src/index.ts
- web/package.json
- kit-ola-2.tsx
- automatizaciones.int.spec.ts
- preparar-base.ts
- compilerOptions
- scripts
- reglas.ts
- shared/package.json
- compilerOptions
- database.service.ts
- FORCE ROW LEVEL SECURITY con politica unica
- Registro de herramientas con ejecutar() unico
- scripts
- compilerOptions
- pantalla-empresa.tsx
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
- pantalla-registro.tsx
- config.d.ts
- web/tsconfig.json
- herramientas-de-intercambio.ts
- Fichas congeladas de la ola 2 · Clásicos I (Finanzas ligeras, CRM, Pedidos)
- borradores.int.spec.ts
- Propuesta · Vender Capaz a otras empresas (SUNAT, exportación contable y ajuste de olas)
- dependencies
- ejecutor.ts
- favicon.svg (purple lightning-bolt logo, 48x46 favicon)
- EjecutorDeHerramientas
- motor.ts
- 5. Carriles
- filtro-de-errores.ts
- vitest
- 4. Frente C · Módulo por módulo y piezas transversales
- api/package.json
- Fichas de la ola 3 · Clásicos II (Inventario, Compras, Personal, Reportes)
- proponer.ts
- csv.ts
- 2. Reglas anti-conflicto
- ConfigModule
- Plan de trabajo en paralelo de Capaz ERP
- llamar
- apps_web_src_shared_ui_unir
- 10. Lecciones de la ola 1
- 6. El integrador
- Plan de integración de Cotizín y Tairos.RC («SF») dentro de Capaz ERP
- main.ts
- core.ts
- entidades.tsx
- react
- Procedimiento: llevar las migraciones de Capaz a Neon
- barra-superior.tsx
- carcasa.tsx
- paleta-de-comandos.tsx
- Ficha · Estado de cuenta de la empresa (pausar, dar de baja, quitar módulo)
- logica.ts
- pendientes.tsx
- Transaccion
- http/contexto.ts
- Brechas frente a lo que piden las empresas en Perú (insumo del usuario, 2026-11-16)
- Datos de prueba (demostración multiempresa)
- Relevo: dónde quedó Capaz ERP y cómo seguir
- dependencies
- devDependencies
- 4. Módulo `registro` · Finanzas ligeras (fase 14)
- scripts
- lectura
- pantalla-inicio.tsx
- 5. Módulo `crm` (fase 15)
- 5. M-cotizador-s0 · Motor
- Fichas congeladas de la ola 4 · Captura por voz y texto, y Cotizador (corte B1)
- pantalla-empresas.tsx
- Ficha · Crear empresa con módulos, editarla y ajustar su cantidad de usuarios (consola del operador)
- campo-comun.ts
- lista-de-menu.tsx
- ADR-017: Captura como capa del núcleo y Cotizador por cortes
- main.tsx
- lista-de-empresas.tsx
- KitOla2
- notificar
- borradores
- pagina-kit.tsx
- pantalla-solicitudes.tsx
- 4. M-registro-s5a · Reglas de dictado
- tablero.tsx
- avisos.tsx
- 6. DB5 · Datos del Cotizador (`0024_cotizador`)
- 10. Tanda 3 (esquema; arquitectura fijada)
- cifra.tsx

## God Nodes (most connected - your core abstractions)
1. `react` - 34 edges
2. `Boton()` - 30 edges
3. `5. Carriles` - 30 edges
4. `EjecutorDeHerramientas` - 28 edges
5. `vitest` - 28 edges
6. `sembrarEmpresa()` - 25 edges
7. `Insignia()` - 23 edges
8. `PantallaEmpresa()` - 22 edges
9. `compilerOptions` - 22 edges
10. `nombreDeModulo()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `9.3 Reglas (dominio; cada una con prueba unitaria)` --references--> `resumir()`  [INFERRED]
  docs/FICHAS-OLA-4.md → apps/api/scripts/demo/resumen.ts
- `0.1 Mapa de carriles y qué arranca primero` --references--> `main()`  [INFERRED]
  docs/FICHAS-OLA-4.md → apps/api/scripts/sembrar-demo.ts
- `2. C4 · Paso previo (integrador)` --references--> `main()`  [INFERRED]
  docs/FICHAS-OLA-4.md → apps/api/scripts/sembrar-demo.ts
- `4.4 Carriles, tandas y costos` --references--> `main()`  [INFERRED]
  docs/PLAN-INTEGRACION-COTIZIN-Y-SF.md → apps/api/scripts/sembrar-demo.ts
- `6.4 «Hecho cuando», medible` --references--> `main()`  [INFERRED]
  docs/PLAN-INTEGRACION-COTIZIN-Y-SF.md → apps/api/scripts/sembrar-demo.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Estrategia de pruebas sin e2e** — docs_adr_adr_007_pruebas_sin_e2e_integracion_postgres, docs_adr_adr_007_pruebas_sin_e2e_pruebas_contrato, docs_adr_adr_007_pruebas_sin_e2e_pruebas_arquitectura, docs_adr_adr_007_pruebas_sin_e2e_revision_visual_manual, docs_adr_adr_007_pruebas_sin_e2e_pruebas_equivalencia [EXTRACTED 1.00]
- **Defensa en capas del aislamiento multiempresa** — docs_adr_adr_004_multiempresa_y_rls_force_rls, docs_adr_adr_004_multiempresa_y_rls_con_empresa, docs_adr_adr_011_cuatro_roles_de_base_capaz_app, docs_adr_adr_012_convenciones_de_datos_fk_compuestas [INFERRED 0.85]
- **Puerta unica de operaciones por herramientas** — docs_adr_adr_005_registro_de_herramientas_registro_herramientas, docs_adr_adr_009_la_puerta_http_son_las_herramientas_endpoint_herramientas, docs_adr_adr_009_la_puerta_http_son_las_herramientas_mapa_de_contratos, docs_adr_adr_005_registro_de_herramientas_auditoria [INFERRED 0.85]
- **Puertas unicas: base, operaciones y sesion** — conempresa, ejecutar_herramientas, rls_aislamiento_tenant, roles_de_base_capaz [INFERRED 0.85]
- **Contratacion y control de acceso por modulo** — consola_de_plataforma, planes_y_precios, empresa_modulos_contratacion, tres_niveles_de_control [INFERRED 0.85]
- **Flujo voz a borrador a aprobacion** — registro_por_voz, agente_propone_usuario_aprueba, ejecutar_herramientas, modulo_registro [INFERRED 0.85]

## Communities (106 total, 10 thin omitted)

### Community 0 - "AGENTS.md (reglas del constructor)"
Cohesion: 0.06
Nodes (48): ADR 001 a 012, Agente: instrucciones, conocimiento, herramientas, disparadores, AGENTS.md (reglas del constructor), apps/api AGENTS.md (ESM, Vitest), apps/api README (plantilla NestJS), apps/web index.html (entrada de la SPA), apps/web README (plantilla React Vite), Atlantisgraf (cliente piloto) (+40 more)

### Community 1 - "sembrar-demo.ts"
Cohesion: 0.05
Nodes (79): APELLIDOS, Azar, crearAzar(), diasAtras(), digitoRuc(), digitos(), dniFicticio(), nombreDePersona() (+71 more)

### Community 2 - "src/index.ts"
Cohesion: 0.13
Nodes (26): 8. N1 · Inicio y bandeja con pendientes, codigoDeEstado(), CODIGOS, esCodigo(), estadoHttp(), aCentimos(), Centimos, centimosSchema (+18 more)

### Community 3 - "web/package.json"
Cohesion: 0.10
Nodes (19): name, private, type, version, @capaz/shared, @fontsource-variable/inter, @fontsource-variable/jetbrains-mono, motion (+11 more)

### Community 4 - "kit-ola-2.tsx"
Cohesion: 0.10
Nodes (3): COLUMNAS, PERSONAS, Tarea

### Community 5 - "automatizaciones.int.spec.ts"
Cohesion: 0.07
Nodes (13): AHORA, candidatos, datos(), def(), DIA_DE_LIMA, disparar(), ejecuciones(), evento() (+5 more)

### Community 6 - "preparar-base.ts"
Cohesion: 0.09
Nodes (35): Credencial, cargarEnv(), conBase(), credencialDe(), credencialesDeRoles(), ROLES, urlDeAdmin(), urlDelDueno() (+27 more)

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

### Community 12 - "database.service.ts"
Cohesion: 0.09
Nodes (14): AppModule, BaseDeDatos, ConEmpresa, DatabaseModule, DatabaseService, DatabaseStatus, HealthController, HealthModule (+6 more)

### Community 13 - "FORCE ROW LEVEL SECURITY con politica unica"
Cohesion: 0.14
Nodes (16): Migraciones drizzle-kit generate mas SQL propio, ADR-004: Multiempresa con tenant_id y RLS forzada, Better Auth (id de organizacion = tenant_id), conEmpresa(ctx, fn) unica puerta a la base, tenant_id en toda tabla de negocio, Integracion contra PostgreSQL real con rol capaz_app, ADR-012: Convenciones de datos, Migracion entre empresas: quitar FORCE y reaplicar aplicar_aislamiento (+8 more)

### Community 14 - "Registro de herramientas con ejecutar() unico"
Cohesion: 0.13
Nodes (18): ADR-002: Web y API separadas (React+Vite y NestJS), sin Next.js, Contratos Zod en packages/shared (fuente unica de verdad), Interfaz React 19 + Vite + Tailwind 4 + React Router, ADR-005: Registro unico de herramientas; el agente sin permisos especiales, Rechazo de argumentos reservados (empresaId, usuarioId, permisos, canal), core.auditoria (solo insercion), Canales ui, agente, mcp, sistema, Confirmacion con token firmado de un solo uso, solo desde la pantalla (+10 more)

### Community 15 - "scripts"
Cohesion: 0.11
Nodes (19): scripts, build, db:generar, db:migrar, db:migrar:test, db:preparar, db:sembrar-demo, format (+11 more)

### Community 16 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 17 - "pantalla-empresa.tsx"
Cohesion: 0.10
Nodes (33): ChipDeModulo(), CodigoDeModulo(), copiar(), Estado, PUNTO, TEXTO_DE_ESTADO, HojaActivar(), iconoDeModulo() (+25 more)

### Community 18 - "ADR-003: PostgreSQL y Drizzle; alojamiento en Neon"
Cohesion: 0.14
Nodes (13): Mismo origen en produccion: la API sirve la web compilada, Servidor NestJS 12 (ESM), API REST /api/v1, Pagina publica de cotizaciones en HTML simple por WhatsApp, ADR-003: PostgreSQL y Drizzle; alojamiento en Neon, Cloudflare R2 (archivos), Condiciones de verificacion de Neon (fase 10a), Dinero en centimos enteros, solo soles, Drizzle ORM con controlador pg (+5 more)

### Community 19 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, isolatedModules, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 20 - "devDependencies"
Cohesion: 0.12
Nodes (17): devDependencies, drizzle-kit, @nestjs/cli, @nestjs/schematics, @nestjs/testing, oxlint, oxlint-tsgolint, prettier (+9 more)

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
Nodes (9): manifiestoCompras, manifiestoCrm, manifiestoInsumos, manifiestoOrdenes, manifiestoPersonal, manifiestoRegistro, manifiestoReportes, manifiestoWebhooks (+1 more)

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
Cohesion: 0.09
Nodes (20): AlertaDeError(), ENLACE, ENLACE_EN_MENU, MarcoAcceso(), PantallaIniciarSesion(), enviar(), PantallaRegistro(), enviar() (+12 more)

### Community 36 - "herramientas-de-intercambio.ts"
Cohesion: 0.07
Nodes (9): crear(), crearHerramientasDeIntercambio(), HERRAMIENTA_DE_ALTA, HerramientasDeIntercambio, nombreDeEntidad(), PERMISO_DE_EDITAR, PERMISO_DE_VER, resumenDe() (+1 more)

### Community 37 - "Fichas congeladas de la ola 2 · Clásicos I (Finanzas ligeras, CRM, Pedidos)"
Cohesion: 0.14
Nodes (12): 0. Cómo leerlo, 3.1 Tanda DB2a, 3.2 Tanda DB2b, 3. Datos de la ola 2 (DB2a y DB2b), 6.1 Manifiesto (M-ordenes-s1), 6.2 Reglas (dominio), 6.3 Contratos (`contratos/ordenes.ts`), 6.4 Carriles (+4 more)

### Community 38 - "borradores.int.spec.ts"
Cohesion: 0.10
Nodes (5): CATALOGO, estadoDe(), PERMISOS, comoEmpresa(), 2. C1 · Paso previo de servidor

### Community 39 - "Propuesta · Vender Capaz a otras empresas (SUNAT, exportación contable y ajuste de olas)"
Cohesion: 0.25
Nodes (7): 1. Lo que sigue vigente, 2. Qué cambia al vender a terceros, 3. SUNAT: preparar sin adelantar, 4. Ficha · Exportación al contador (propuesta, sin construir), 5. Dónde encaja en las olas, 6. Decisiones que necesita el usuario, Propuesta · Vender Capaz a otras empresas (SUNAT, exportación contable y ajuste de olas)

### Community 40 - "dependencies"
Cohesion: 0.14
Nodes (14): dependencies, better-auth, big.js, @capaz/shared, drizzle-orm, @nestjs/common, @nestjs/core, @nestjs/platform-express (+6 more)

### Community 42 - "ejecutor.ts"
Cohesion: 0.07
Nodes (5): comoObjeto(), Fallo, OpcionesDeEjecucion, Previo, transaccionEnCurso()

### Community 46 - "EjecutorDeHerramientas"
Cohesion: 0.16
Nodes (12): EjecutorDeHerramientas, falloDe(), filtrarPorPermisos(), rechazar(), Revertir, segundos(), ctx(), 1. Reglas comunes de todo módulo clásico (+4 more)

### Community 47 - "motor.ts"
Cohesion: 0.10
Nodes (6): AccionRechazada, AccionResuelta, Entrada, Opciones, Resultado, Salida

### Community 48 - "5. Carriles"
Cohesion: 0.08
Nodes (25): 5. Carriles, C0 · Andamiaje y contratos, C1 · Paso previo de servidor, Carriles de la ola 2 (módulos clásicos I), Carriles de la ola 3 (módulos clásicos II), DB1 · Datos de la ola 1, DB2 · Datos de la ola 2, K1 · Kit y base web de la ola 2, en dos partes (+17 more)

### Community 50 - "filtro-de-errores.ts"
Cohesion: 0.16
Nodes (12): contextoActual(), ErrorDeNegocio, MENSAJES, FiltroDeErrores, ejecutar(), Traduccion, traducir(), crearPipeDeValidacion() (+4 more)

### Community 51 - "vitest"
Cohesion: 0.13
Nodes (18): A, B, EJEMPLOS, ESQUEMAS, ADR-0011, ADR-0012, Activa, CambioDeEmpresa (+10 more)

### Community 52 - "4. Frente C · Módulo por módulo y piezas transversales"
Cohesion: 0.07
Nodes (26): 1. Resumen para el dueño, 2.1 Qué hay hoy (verificado), 2.2 Tres diseños posibles, 2.3 Modelo de datos mínimo (diseño 3), 2.4 Permisos de los operadores, 2.5 Soporte: entrar a la empresa del cliente, 2.6 Hallazgos del frente A, 2. Frente A · Administración de las otras empresas (Datayros gestiona a sus clientes) (+18 more)

### Community 53 - "api/package.json"
Cohesion: 0.09
Nodes (21): license, name, private, type, version, better-auth, big.js, drizzle-kit (+13 more)

### Community 54 - "Fichas de la ola 3 · Clásicos II (Inventario, Compras, Personal, Reportes)"
Cohesion: 0.14
Nodes (13): 0. Lo que ya está decidido (no se reabre en la puerta), 1.1 `insumos`, 1.2 `compras`, 1.3 `personal`, 1. Datos (DB3a y DB3b), 2. Fase 17 · `insumos` (Inventario), 3. Fase 18 · `compras`, 4. Fase 19 · `personal` (+5 more)

### Community 55 - "proponer.ts"
Cohesion: 0.10
Nodes (11): proponer(), HerramientaConSecretos, HerramientaDeBorradorDesconocida, HERRAMIENTAS_CON_SECRETOS, proponerBorrador(), PropuestaDeBorrador, ADR-016: Reglas de datos y de conducta de los módulos clásicos, Alternativas descartadas (+3 more)

### Community 56 - "csv.ts"
Cohesion: 0.26
Nodes (11): detectarSeparador(), escribirCelda(), escribirCsv(), FilaCsv, LecturaCsv, leerCsv(), OpcionesDeLectura, protegerCelda() (+3 more)

### Community 57 - "2. Reglas anti-conflicto"
Cohesion: 0.22
Nodes (9): 2.1 Propiedad exclusiva, 2.2 Archivos compartidos: dueño único, 2.3 Migraciones: un solo escritor, numeración en serie, 2.4 Dependencias, 2.5 Dónde trabaja cada carril, 2.6 Base de pruebas por carril, 2.7 Orden de integración y suite completa, 2.8 Ante un conflicto (+1 more)

### Community 59 - "Plan de trabajo en paralelo de Capaz ERP"
Cohesion: 0.29
Nodes (6): 0. Cómo leer este documento (y gastar pocos tokens), 1. Papeles, 7. Plantilla de brief, 8. Reglas para ahorrar tokens (agente de carril), 9. Decisiones abiertas y qué carriles esperan, Plan de trabajo en paralelo de Capaz ERP

### Community 60 - "llamar"
Cohesion: 0.29
Nodes (7): llamar(), 8. W11 · Pantalla de dictado, 4.1 Ola 2 · grafo y rondas, 4. Grafo de dependencias y qué arranca ya, M-registro-w · M-crm-w · M-ordenes-w · Pantallas de los módulos, W5 · Herramientas en pantalla, W6 a W10 · Pantallas de la ola 1

### Community 61 - "apps_web_src_shared_ui_unir"
Cohesion: 0.12
Nodes (18): BarraDeDistribucion(), CabeceraDeConsola(), Indicadores(), SECCIONES, Tarjeta, TarjetaDeKpi(), tarjetasDe(), CifraAnimada() (+10 more)

### Community 62 - "10. Lecciones de la ola 1"
Cohesion: 0.50
Nodes (4): 10.1 Qué salió bien (se mantiene), 10.2 Qué se corrige en el método, 10.3 Lo que no cambia aunque tiente, 10. Lecciones de la ola 1

### Community 63 - "6. El integrador"
Cohesion: 0.50
Nodes (4): 6.1 Lanzar un carril, 6.2 Lista de verificación de integración, 6.3 Puerta entre olas, 6. El integrador

### Community 64 - "Plan de integración de Cotizín y Tairos.RC («SF») dentro de Capaz ERP"
Cohesion: 0.08
Nodes (25): 1. Resumen para el dueño, 2.1 Capaz: lo que ya existe y sirve a esta integración, 2.2 Tairos.RC («SF»), 2.3 Cotizín, 2. Qué hay hoy en cada producto (con evidencia), 3.1 Tairos.RC frente a Capaz, 3.2 Cotizín frente a Capaz, 3. Mapa de encaje (+17 more)

### Community 65 - "main.ts"
Cohesion: 0.10
Nodes (15): Config, CONFIG, ConfigInvalida, esquemaDeConfig, leerConfig(), leerConfigDelEntorno(), secreto, base (+7 more)

### Community 66 - "core.ts"
Cohesion: 0.40
Nodes (3): core, empresaConfig, ADR-0012

### Community 67 - "entidades.tsx"
Cohesion: 0.10
Nodes (27): KitDiseno(), ChipDeCliente(), EnlaceDeEntidad(), InsigniaDeEstado(), inicialesDe(), rutaDeEntidad(), RUTAS, TipoDeEntidad (+19 more)

### Community 68 - "react"
Cohesion: 0.12
Nodes (18): Props, PRUEBAS, Boton(), Comun, Props, Rueda(), TAMANOS, VarianteDeBoton (+10 more)

### Community 69 - "Procedimiento: llevar las migraciones de Capaz a Neon"
Cohesion: 0.17
Nodes (11): 0. Reparto de trabajo (para no pisarse), 1. Reglas que no se rompen, 2. Preparación, 3. Ensayo en una rama, 4. Roles y base, 5. Migrar, 6. Verificación (solo lectura, como `capaz_owner` salvo donde se indica), 7. Lo que NO debes hacer al terminar (+3 more)

### Community 70 - "barra-superior.tsx"
Cohesion: 0.18
Nodes (13): BarraInferior(), BarraSuperior(), iniciales(), Props, GLIFOS, IconoMenu(), fijarEmpresaActiva(), Props (+5 more)

### Community 71 - "carcasa.tsx"
Cohesion: 0.18
Nodes (3): Carcasa(), salir(), MenuLateral()

### Community 72 - "paleta-de-comandos.tsx"
Cohesion: 0.15
Nodes (8): buscarClientes(), Cliente, PaletaDeComandos(), accionesRapidas(), AccionRapida, normalizar(), POR_MODULO, cmdk

### Community 73 - "Ficha · Estado de cuenta de la empresa (pausar, dar de baja, quitar módulo)"
Cohesion: 0.22
Nodes (8): 1. Problema, 2. Reglas de producto, 4. Herramientas (plataforma, `definirHerramientaDePlataforma`), 5. Pantalla (consola, solo operadores), 6. Pruebas de referencia (integración, sin e2e), 7. Fuera de alcance, 8. Esfuerzo y riesgo, Ficha · Estado de cuenta de la empresa (pausar, dar de baja, quitar módulo)

### Community 74 - "logica.ts"
Cohesion: 0.11
Nodes (24): EventoDeContrato, PUNTO, TITULO, accionesPosibles(), argumentosDeContrato, diaAIso(), Estado, ESTADOS (+16 more)

### Community 75 - "pendientes.tsx"
Cohesion: 0.11
Nodes (10): Dato, DESTINOS, Estado, ICONO_DE, Pendientes(), Tarjeta(), TITULOS, useActividades() (+2 more)

### Community 76 - "Transaccion"
Cohesion: 0.29
Nodes (3): MotorDeReglas, conPuntoDeGuardado(), Transaccion

### Community 77 - "http/contexto.ts"
Cohesion: 0.20
Nodes (9): almacen, CanalDeLlamada, conContexto(), ContextoDePeticion, crearContexto(), idDePeticion(), middlewareDeContexto(), pino (+1 more)

### Community 78 - "Brechas frente a lo que piden las empresas en Perú (insumo del usuario, 2026-11-16)"
Cohesion: 0.40
Nodes (4): Brechas frente a lo que piden las empresas en Perú (insumo del usuario, 2026-11-16), Comparación con lo construido (verificado contra el código de `main`), Lectura para la estrategia (propuesta, no decisión), Siguiente paso sugerido

### Community 79 - "Datos de prueba (demostración multiempresa)"
Cohesion: 0.25
Nodes (7): Cosas a tener en cuenta, Cómo correrlo, Cómo se crea (por las vías reales), Datos de prueba (demostración multiempresa), Lo que no se siembra, y por qué, Qué crea, Verificación que hace el propio script

### Community 80 - "Relevo: dónde quedó Capaz ERP y cómo seguir"
Cohesion: 0.25
Nodes (8): 1. En una frase, 2. Estado exacto, 3. Cómo arrancar el entorno, 4. Mapa del código, 6. Qué hacer ahora, en orden, 7. Documentación, 8. Decisiones del usuario que siguen abiertas, Relevo: dónde quedó Capaz ERP y cómo seguir

### Community 81 - "dependencies"
Cohesion: 0.13
Nodes (15): dependencies, @capaz/shared, cmdk, @fontsource-variable/inter, @fontsource-variable/jetbrains-mono, lucide-react, motion, @radix-ui/react-dropdown-menu (+7 more)

### Community 82 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript (+3 more)

### Community 83 - "4. Módulo `registro` · Finanzas ligeras (fase 14)"
Cohesion: 0.29
Nodes (7): 4.2 Reglas de dinero (dominio; cada una con su prueba unitaria), 4.3 Contratos (`packages/shared/src/contratos/registro.ts`), 4.4 Herramientas: permiso, criticidad y marcas, 4.5 Consumidores y fuente de tiempo (s3), 4.6 Carriles de servidor, 4.7 Pantallas (`apps/web/src/modules/registro/`), 4. Módulo `registro` · Finanzas ligeras (fase 14)

### Community 85 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test, typecheck

### Community 86 - "lectura"
Cohesion: 0.25
Nodes (9): lectura(), recortar(), 4.1 Manifiesto (lo edita M-registro-s1), 9.1 Manifiesto (`cotizador.manifest.ts`), 9.2 Contratos (`contratos/cotizador.ts`), 9.3 Reglas (dominio; cada una con prueba unitaria), 9.4 Pruebas exigidas, 9. M-cotizador-s1 · Precios y configuración (+1 more)

### Community 87 - "pantalla-inicio.tsx"
Cohesion: 0.25
Nodes (4): TONO_DE_ESTADO, COLOR_ACENTO, PantallaInicio(), Tarjeta()

### Community 88 - "5. Módulo `crm` (fase 15)"
Cohesion: 0.40
Nodes (5): 5.1 Manifiesto (M-crm-s1), 5.2 Reglas (dominio), 5.3 Contratos (`contratos/crm.ts`), 5.4 Carriles, 5. Módulo `crm` (fase 15)

### Community 89 - "5. M-cotizador-s0 · Motor"
Cohesion: 0.33
Nodes (6): 5.1 Qué se copia (archivos enteros, sin recortar), 5.2 Casos de referencia (ya están en las pruebas copiadas; valores exactos de Cotizín), 5.3 Adaptador único · `domain/adaptador-de-dinero.ts` (nuevo), 5.4 `domain/frontera-del-motor.spec.ts` (nueva; vigila R22 para siempre), 5.5 Pasos, 5. M-cotizador-s0 · Motor

### Community 90 - "Fichas congeladas de la ola 4 · Captura por voz y texto, y Cotizador (corte B1)"
Cohesion: 0.15
Nodes (12): 0.1 Mapa de carriles y qué arranca primero, 0. Cómo leerlo, 12. Decisiones abiertas del dueño y de Keny, 13. Riesgos, 14. Lo no verificado, 2. C4 · Paso previo (integrador), 7.1 Contrato (agregar a `contratos/registro.ts`), 7.2 Herramienta `deuda_crear_con_adelanto` (`herramientas/deudas-con-adelanto.ts`) (+4 more)

### Community 91 - "pantalla-empresas.tsx"
Cohesion: 0.10
Nodes (18): EmpresaDeLista, DensidadDeLista, leer(), useDensidad(), FiltrosDeEmpresas(), ORDEN_DE_ESTADOS, busquedaDesdeFiltro(), EmpresaResumen (+10 more)

### Community 92 - "Ficha · Crear empresa con módulos, editarla y ajustar su cantidad de usuarios (consola del operador)"
Cohesion: 0.25
Nodes (7): 1. Qué hay hoy (verificado), 2. Decisiones de producto propuestas, 3. Servidor (modules-5a), 4. Pantallas (modules-ed, tras integrar el servidor), 5. Fuera de alcance, 6. Decisiones que necesita el usuario, Ficha · Crear empresa con módulos, editarla y ajustar su cantidad de usuarios (consola del operador)

### Community 95 - "lista-de-menu.tsx"
Cohesion: 0.18
Nodes (9): Fila(), Grupo(), ListaDeMenu(), ModoDeMenu, OCULTO, Props, SOBRE_ICONO, SOLO_LECTORES (+1 more)

### Community 96 - "ADR-017: Captura como capa del núcleo y Cotizador por cortes"
Cohesion: 0.18
Nodes (10): 2. La voz arranca sin modelo de pago (fase A1), 3. Excepción a la regla 9: el interior del motor del Cotizador, 4. El Cotizador es un módulo de Capaz y se construye por cortes, 5. Reglas del porte, ADR-017: Captura como capa del núcleo y Cotizador por cortes, Alternativas descartadas, Consecuencias, Contexto (+2 more)

### Community 98 - "lista-de-empresas.tsx"
Cohesion: 0.13
Nodes (19): useAtajosDeLista(), AvatarDeEmpresa(), colorDe(), COLORES, ICONOS, BotonDeOrden(), Cabecera, CABECERAS (+11 more)

### Community 99 - "KitOla2"
Cohesion: 0.20
Nodes (10): buscarEn(), Cantidades(), Cifras(), KitOla2(), Navegacion(), Retardo(), Seccion(), Selectores() (+2 more)

### Community 100 - "notificar"
Cohesion: 0.31
Nodes (9): Contenido(), enviar(), mensajeDeRechazo(), parsearDiasDePrueba(), accionar(), PantallaSolicitudes(), resolver(), notificar() (+1 more)

### Community 101 - "borradores"
Cohesion: 0.25
Nodes (8): borradores(), 1. La captura es una capa del núcleo, no un módulo de dinero, 11. Contradicciones halladas y cómo se resolvieron, 3.1 Contrato `captura.ts` (copiar tal cual), 3.2 Agregar a `contratos/borradores.ts`, 3.3 Tipos del servidor (`core/captura/tipos.ts`), 3.5 Pruebas exigidas, 3. C3 · Captura (núcleo)

### Community 104 - "pantalla-solicitudes.tsx"
Cohesion: 0.10
Nodes (13): cliente, Contenido(), ErrorDeConsulta(), Marco(), PaletaDeOperador(), PantallaPlanes(), Filtro, FILTROS (+5 more)

### Community 105 - "4. M-registro-s5a · Reglas de dictado"
Cohesion: 0.33
Nodes (6): R, 4.1 Qué se copia y con qué nombre, 4.2 Casos de referencia (ya están en las pruebas copiadas; **no cambian**), 4.3 Reglas nuevas (no existen en Tairos.RC; archivos nuevos en `dictado/`, con su prueba), 4.4 Pasos, 4. M-registro-s5a · Reglas de dictado

### Community 106 - "tablero.tsx"
Cohesion: 0.25
Nodes (3): ColumnaDeTablero, Props, Tablero()

### Community 108 - "6. DB5 · Datos del Cotizador (`0024_cotizador`)"
Cohesion: 0.50
Nodes (4): 6.1 Tablas, 6.2 Bloque a mano (al final del SQL generado, en este orden), 6.3 Pasos, 6. DB5 · Datos del Cotizador (`0024_cotizador`)

### Community 109 - "10. Tanda 3 (esquema; arquitectura fijada)"
Cohesion: 0.40
Nodes (5): 10.1 Eventos del Cotizador (congelados ya; los copia s1 al contrato), 10.3 M-ordenes-s3 · Puente cotización → pedido, 10.4 M-cotizador-w1 · Pantallas del corte B1 (dos sesiones), 10.5 X4 · Cierre de la ola (integrador), 10. Tanda 3 (esquema; arquitectura fijada)

### Community 110 - "cifra.tsx"
Cohesion: 0.40
Nodes (4): Cifra(), GrupoDeCifras(), TonoDeCifra, TONOS

## Knowledge Gaps
- **609 isolated node(s):** `1. Qué se ve hoy (capturas del kit y del acceso, 1280 px, claro)`, `2. Dirección propuesta`, `3. Cómo se hace (orden, de más barato a más caro)`, `4. Decisiones que necesita el usuario`, `5. Riesgos` (+604 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 854 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `vitest` connect `vitest` to `main.ts`, `pantalla-registro.tsx`, `web/package.json`, `entidades.tsx`, `automatizaciones.int.spec.ts`, `borradores.int.spec.ts`, `src/index.ts`, `paleta-de-comandos.tsx`, `reglas.ts`, `logica.ts`, `database.service.ts`, `http/contexto.ts`, `filtro-de-errores.ts`, `api/package.json`, `csv.ts`, `catalogo.spec.ts`, `pantalla-empresas.tsx`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `EjecutorDeHerramientas` (e.g. with `1. Reglas comunes de todo módulo clásico` and `1. Reglas comunes de la ola 4`) actually correct?**
  _`EjecutorDeHerramientas` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `1. Qué se ve hoy (capturas del kit y del acceso, 1280 px, claro)`, `2. Dirección propuesta`, `3. Cómo se hace (orden, de más barato a más caro)` to the rest of the system?**
  _609 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AGENTS.md (reglas del constructor)` be split into smaller, more focused modules?**
  _Cohesion score 0.0573025856044724 - nodes in this community are weakly interconnected._
- **Why does `pg` connect `vitest` to `sembrar-demo.ts`, `automatizaciones.int.spec.ts`, `borradores.int.spec.ts`, `preparar-base.ts`, `database.service.ts`, `api/package.json`?**
  _High betweenness centrality (0.099) - this node is a cross-community bridge._
- **Should `sembrar-demo.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05217391304347826 - nodes in this community are weakly interconnected._
- **Why does `main()` connect `sembrar-demo.ts` to `Plan de integración de Cotizín y Tairos.RC («SF») dentro de Capaz ERP`, `entidades.tsx`, `6. DB5 · Datos del Cotizador (`0024_cotizador`)`, `Relevo: dónde quedó Capaz ERP y cómo seguir`, `Fichas congeladas de la ola 4 · Captura por voz y texto, y Cotizador (corte B1)`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._