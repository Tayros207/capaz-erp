# Graph Report - capaz-erp  (2026-11-16)

## Corpus Check
- 984 files · ~641,790 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 9 file(s) not represented in the graph (top: (none) 5, .map 2, .example 1)

## Summary
- 1552 nodes · 2711 edges · 94 communities (86 shown, 8 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 112 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2c98ae67`
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
- logica.ts
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
- lista-de-menu.tsx
- ejecutor.ts
- favicon.svg (purple lightning-bolt logo, 48x46 favicon)
- EjecutorDeHerramientas
- motor.ts
- 5. Carriles
- Transaccion
- main.ts
- vitest
- Propuesta de mejoras · Auditoría de brechas de Capaz ERP
- api/package.json
- Fichas de la ola 3 · Clásicos II (Inventario, Compras, Personal, Reportes)
- proponer.ts
- csv.ts
- 2. Reglas anti-conflicto
- logger.ts
- Plan de trabajo en paralelo de Capaz ERP
- llamar
- boton.tsx
- 10. Lecciones de la ola 1
- 6. El integrador
- config/config.ts
- filtro-de-errores.ts
- con-empresa.ts
- entidades.tsx
- react
- Procedimiento: llevar las migraciones de Capaz a Neon
- carcasa.tsx
- 4. Frente C · Módulo por módulo y piezas transversales
- paleta-de-comandos.tsx
- Ficha · Estado de cuenta de la empresa (pausar, dar de baja, quitar módulo)
- Flujo entre módulos · que el trabajo sea fluido, rápido y sin volver a teclear
- pendientes.tsx
- config.js
- core.ts
- Brechas frente a lo que piden las empresas en Perú (insumo del usuario, 2026-11-16)
- Datos de prueba (demostración multiempresa)
- Relevo: dónde quedó Capaz ERP y cómo seguir
- dependencies
- devDependencies
- 4. Módulo `registro` · Finanzas ligeras (fase 14)
- 2. Frente A · Administración de las otras empresas (Datayros gestiona a sus clientes)
- scripts
- lectura
- pagina-kit.tsx
- 5. Módulo `crm` (fase 15)
- 6. Módulo `ordenes` · Pedidos (fase 16)
- KitOla2
- tablero.tsx
- campo-comun.ts
- cifra.tsx

## God Nodes (most connected - your core abstractions)
1. `5. Carriles` - 30 edges
2. `vitest` - 27 edges
3. `EjecutorDeHerramientas` - 26 edges
4. `sembrarEmpresa()` - 25 edges
5. `compilerOptions` - 22 edges
6. `scripts` - 19 edges
7. `react` - 19 edges
8. `compilerOptions` - 18 edges
9. `AGENTS.md (reglas del constructor)` - 18 edges
10. `Sesion` - 17 edges

## Surprising Connections (you probably didn't know these)
- `6. Qué hacer ahora, en orden` --references--> `main()`  [INFERRED]
  docs/RELEVO.md → apps/api/scripts/sembrar-demo.ts
- `2. C1 · Paso previo de servidor` --references--> `comoEmpresa()`  [INFERRED]
  docs/FICHAS-OLA-2.md → apps/api/src/pruebas/base-de-pruebas.ts
- `3. Qué falta, por valor para el trabajo diario` --references--> `ChipDeCliente()`  [INFERRED]
  docs/FLUJO-ENTRE-MODULOS.md → apps/web/src/shared/ui/entidades.tsx
- `5.1 Manifiesto (M-crm-s1)` --references--> `lectura()`  [INFERRED]
  docs/FICHAS-OLA-2.md → apps/api/src/core/intercambio/herramientas-de-intercambio.ts
- `6.1 Manifiesto (M-ordenes-s1)` --references--> `lectura()`  [INFERRED]
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

## Communities (94 total, 8 thin omitted)

### Community 0 - "AGENTS.md (reglas del constructor)"
Cohesion: 0.06
Nodes (48): ADR 001 a 012, Agente: instrucciones, conocimiento, herramientas, disparadores, AGENTS.md (reglas del constructor), apps/api AGENTS.md (ESM, Vitest), apps/api README (plantilla NestJS), apps/web index.html (entrada de la SPA), apps/web README (plantilla React Vite), Atlantisgraf (cliente piloto) (+40 more)

### Community 1 - "sembrar-demo.ts"
Cohesion: 0.05
Nodes (77): APELLIDOS, Azar, crearAzar(), diasAtras(), digitoRuc(), digitos(), dniFicticio(), nombreDePersona() (+69 more)

### Community 2 - "src/index.ts"
Cohesion: 0.13
Nodes (26): 8. N1 · Inicio y bandeja con pendientes, CODIGOS, esCodigo(), estadoHttp(), aCentimos(), Centimos, centimosSchema, formatearSoles() (+18 more)

### Community 3 - "web/package.json"
Cohesion: 0.10
Nodes (20): name, private, type, version, @capaz/shared, cmdk, @fontsource-variable/inter, @fontsource-variable/jetbrains-mono (+12 more)

### Community 4 - "kit-ola-2.tsx"
Cohesion: 0.10
Nodes (3): COLUMNAS, PERSONAS, Tarea

### Community 5 - "automatizaciones.int.spec.ts"
Cohesion: 0.07
Nodes (15): AHORA, borradores(), candidatos, datos(), def(), DIA_DE_LIMA, disparar(), ejecuciones() (+7 more)

### Community 6 - "preparar-base.ts"
Cohesion: 0.16
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

### Community 12 - "database.service.ts"
Cohesion: 0.10
Nodes (13): Config, BaseDeDatos, ConEmpresa, DatabaseModule, DatabaseService, DatabaseStatus, HealthController, HealthModule (+5 more)

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

### Community 17 - "logica.ts"
Cohesion: 0.06
Nodes (37): AccionDeModulo, argumentosDeContrato, busquedaDesdeFiltro(), ClaveDeOrden, diaAIso(), diasHasta(), EmpresaResumen, Estado (+29 more)

### Community 18 - "ADR-003: PostgreSQL y Drizzle; alojamiento en Neon"
Cohesion: 0.14
Nodes (13): Mismo origen en produccion: la API sirve la web compilada, Servidor NestJS 12 (ESM), API REST /api/v1, Pagina publica de cotizaciones en HTML simple por WhatsApp, ADR-003: PostgreSQL y Drizzle; alojamiento en Neon, Cloudflare R2 (archivos), Condiciones de verificacion de Neon (fase 10a), Dinero en centimos enteros, solo soles, Drizzle ORM con controlador pg (+5 more)

### Community 19 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, declaration, isolatedModules, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 20 - "devDependencies"
Cohesion: 0.12
Nodes (16): devDependencies, drizzle-kit, @nestjs/cli, @nestjs/schematics, @nestjs/testing, oxlint, oxlint-tsgolint, prettier (+8 more)

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
Cohesion: 0.22
Nodes (7): 0. Cómo leerlo, 2. C1 · Paso previo de servidor, 3.1 Tanda DB2a, 3.2 Tanda DB2b, 3. Datos de la ola 2 (DB2a y DB2b), 7. K1 · Kit y base web de la ola, Fichas congeladas de la ola 2 · Clásicos I (Finanzas ligeras, CRM, Pedidos)

### Community 38 - "borradores.int.spec.ts"
Cohesion: 0.11
Nodes (4): CATALOGO, estadoDe(), PERMISOS, comoEmpresa()

### Community 39 - "Propuesta · Vender Capaz a otras empresas (SUNAT, exportación contable y ajuste de olas)"
Cohesion: 0.25
Nodes (7): 1. Lo que sigue vigente, 2. Qué cambia al vender a terceros, 3. SUNAT: preparar sin adelantar, 4. Ficha · Exportación al contador (propuesta, sin construir), 5. Dónde encaja en las olas, 6. Decisiones que necesita el usuario, Propuesta · Vender Capaz a otras empresas (SUNAT, exportación contable y ajuste de olas)

### Community 40 - "dependencies"
Cohesion: 0.15
Nodes (13): dependencies, better-auth, @capaz/shared, drizzle-orm, @nestjs/common, @nestjs/core, @nestjs/platform-express, pg (+5 more)

### Community 41 - "lista-de-menu.tsx"
Cohesion: 0.12
Nodes (18): BarraInferior(), IconoMenu(), Fila(), Grupo(), ListaDeMenu(), ModoDeMenu, OCULTO, Props (+10 more)

### Community 42 - "ejecutor.ts"
Cohesion: 0.08
Nodes (3): Fallo, OpcionesDeEjecucion, Previo

### Community 46 - "EjecutorDeHerramientas"
Cohesion: 0.15
Nodes (12): comoObjeto(), EjecutorDeHerramientas, falloDe(), filtrarPorPermisos(), rechazar(), Revertir, segundos(), conPuntoDeGuardado() (+4 more)

### Community 47 - "motor.ts"
Cohesion: 0.10
Nodes (6): AccionRechazada, AccionResuelta, Entrada, Opciones, Resultado, Salida

### Community 48 - "5. Carriles"
Cohesion: 0.08
Nodes (24): 5. Carriles, C0 · Andamiaje y contratos, C1 · Paso previo de servidor, Carriles de la ola 2 (módulos clásicos I), Carriles de la ola 3 (módulos clásicos II), DB1 · Datos de la ola 1, DB2 · Datos de la ola 2, K1 · Kit y base web de la ola 2, en dos partes (+16 more)

### Community 50 - "main.ts"
Cohesion: 0.13
Nodes (9): AppModule, ErrorDeNegocio, crearPipeDeValidacion(), mensajeDeValidacion(), Problema, crearRegistroHttp(), LoggerDeNest, bootstrap() (+1 more)

### Community 51 - "vitest"
Cohesion: 0.15
Nodes (14): A, B, EJEMPLOS, ESQUEMAS, ADR-0011, ADR-0012, abrirPool(), empresaDePrueba() (+6 more)

### Community 52 - "Propuesta de mejoras · Auditoría de brechas de Capaz ERP"
Cohesion: 0.20
Nodes (9): 1. Resumen para el dueño, 3.1 Qué hay hoy (verificado), 3.2 Hallazgos del frente B, 3. Frente B · Ficha de cliente y datos maestros, 5. Hoja de ruta sugerida (cuatro rondas), 6. Decisiones que necesito del dueño, 7. Riesgos, Propuesta de mejoras · Auditoría de brechas de Capaz ERP (+1 more)

### Community 53 - "api/package.json"
Cohesion: 0.10
Nodes (19): license, name, private, type, version, better-auth, drizzle-kit, @nestjs/cli (+11 more)

### Community 54 - "Fichas de la ola 3 · Clásicos II (Inventario, Compras, Personal, Reportes)"
Cohesion: 0.14
Nodes (13): 0. Lo que ya está decidido (no se reabre en la puerta), 1.1 `insumos`, 1.2 `compras`, 1.3 `personal`, 1. Datos (DB3a y DB3b), 2. Fase 17 · `insumos` (Inventario), 3. Fase 18 · `compras`, 4. Fase 19 · `personal` (+5 more)

### Community 55 - "proponer.ts"
Cohesion: 0.10
Nodes (11): HerramientaConSecretos, HerramientaDeBorradorDesconocida, HERRAMIENTAS_CON_SECRETOS, proponerBorrador(), PropuestaDeBorrador, ADR-016: Reglas de datos y de conducta de los módulos clásicos, Alternativas descartadas, Consecuencias (+3 more)

### Community 56 - "csv.ts"
Cohesion: 0.26
Nodes (11): detectarSeparador(), escribirCelda(), escribirCsv(), FilaCsv, LecturaCsv, leerCsv(), OpcionesDeLectura, protegerCelda() (+3 more)

### Community 57 - "2. Reglas anti-conflicto"
Cohesion: 0.22
Nodes (9): 2.1 Propiedad exclusiva, 2.2 Archivos compartidos: dueño único, 2.3 Migraciones: un solo escritor, numeración en serie, 2.4 Dependencias, 2.5 Dónde trabaja cada carril, 2.6 Base de pruebas por carril, 2.7 Orden de integración y suite completa, 2.8 Ante un conflicto (+1 more)

### Community 58 - "logger.ts"
Cohesion: 0.27
Nodes (4): CAMPOS_OCULTOS, crearLogger(), LOGGER, LoggerModule

### Community 59 - "Plan de trabajo en paralelo de Capaz ERP"
Cohesion: 0.29
Nodes (6): 0. Cómo leer este documento (y gastar pocos tokens), 1. Papeles, 7. Plantilla de brief, 8. Reglas para ahorrar tokens (agente de carril), 9. Decisiones abiertas y qué carriles esperan, Plan de trabajo en paralelo de Capaz ERP

### Community 60 - "llamar"
Cohesion: 0.33
Nodes (6): llamar(), 4.1 Ola 2 · grafo y rondas, 4. Grafo de dependencias y qué arranca ya, M-registro-w · M-crm-w · M-ordenes-w · Pantallas de los módulos, W5 · Herramientas en pantalla, W6 a W10 · Pantallas de la ola 1

### Community 61 - "boton.tsx"
Cohesion: 0.17
Nodes (13): GLIFOS, Comun, Props, TAMANOS, VarianteDeBoton, VARIANTES, EstadoVacio(), Props (+5 more)

### Community 62 - "10. Lecciones de la ola 1"
Cohesion: 0.50
Nodes (4): 10.1 Qué salió bien (se mantiene), 10.2 Qué se corrige en el método, 10.3 Lo que no cambia aunque tiente, 10. Lecciones de la ola 1

### Community 63 - "6. El integrador"
Cohesion: 0.50
Nodes (4): 6.1 Lanzar un carril, 6.2 Lista de verificación de integración, 6.3 Puerta entre olas, 6. El integrador

### Community 64 - "config/config.ts"
Cohesion: 0.19
Nodes (9): CONFIG, ConfigInvalida, esquemaDeConfig, leerConfig(), leerConfigDelEntorno(), ConfigModule, secreto, base (+1 more)

### Community 65 - "filtro-de-errores.ts"
Cohesion: 0.12
Nodes (16): almacen, CanalDeLlamada, conContexto(), contextoActual(), ContextoDePeticion, crearContexto(), idDePeticion(), middlewareDeContexto() (+8 more)

### Community 66 - "con-empresa.ts"
Cohesion: 0.25
Nodes (7): proponer(), Activa, CambioDeEmpresa, ContextoDeEmpresa, crearConEmpresa(), transaccionActual, conEmpresaDePruebas()

### Community 67 - "entidades.tsx"
Cohesion: 0.23
Nodes (14): KitDiseno(), ChipDeCliente(), EnlaceDeEntidad(), InsigniaDeEstado(), inicialesDe(), rutaDeEntidad(), RUTAS, TipoDeEntidad (+6 more)

### Community 68 - "react"
Cohesion: 0.29
Nodes (6): Boton(), Rueda(), Dialogo(), Props, Props, react

### Community 69 - "Procedimiento: llevar las migraciones de Capaz a Neon"
Cohesion: 0.18
Nodes (10): 0. Reparto de trabajo (para no pisarse), 1. Reglas que no se rompen, 2. Preparación, 3. Ensayo en una rama, 4. Roles y base, 5. Migrar, 7. Lo que NO debes hacer al terminar, 8. Registro de ejecución (lo llena el agente de Neon) (+2 more)

### Community 70 - "carcasa.tsx"
Cohesion: 0.08
Nodes (16): BarraSuperior(), iniciales(), Props, Carcasa(), salir(), MenuLateral(), fijarEmpresaActiva(), Props (+8 more)

### Community 71 - "4. Frente C · Módulo por módulo y piezas transversales"
Cohesion: 0.20
Nodes (10): 4.1 Finanzas ligeras (`registro`), 4.2 CRM, 4.3 Pedidos (`ordenes`), 4.4 Inventario (`insumos`), 4.5 Compras, 4.6 Personal, 4.7 Reportes, 4.8 Piezas transversales (+2 more)

### Community 72 - "paleta-de-comandos.tsx"
Cohesion: 0.15
Nodes (7): buscarClientes(), Cliente, PaletaDeComandos(), accionesRapidas(), AccionRapida, normalizar(), POR_MODULO

### Community 73 - "Ficha · Estado de cuenta de la empresa (pausar, dar de baja, quitar módulo)"
Cohesion: 0.22
Nodes (8): 1. Problema, 2. Reglas de producto, 4. Herramientas (plataforma, `definirHerramientaDePlataforma`), 5. Pantalla (consola, solo operadores), 6. Pruebas de referencia (integración, sin e2e), 7. Fuera de alcance, 8. Esfuerzo y riesgo, Ficha · Estado de cuenta de la empresa (pausar, dar de baja, quitar módulo)

### Community 74 - "Flujo entre módulos · que el trabajo sea fluido, rápido y sin volver a teclear"
Cohesion: 0.12
Nodes (13): 1. Principio, 2. Qué ya se comunica (verificado en el código), 3. Qué falta, por valor para el trabajo diario, 5. Orden recomendado, 6. Reglas para construirlo, Flujo entre módulos · que el trabajo sea fluido, rápido y sin volver a teclear, 1. Qué se ve hoy (capturas del kit y del acceso, 1280 px, claro), 2. Dirección propuesta (+5 more)

### Community 75 - "pendientes.tsx"
Cohesion: 0.10
Nodes (10): PantallaInicio(), Dato, DESTINOS, Estado, ICONO_DE, Pendientes(), TITULOS, useActividades() (+2 more)

### Community 76 - "config.js"
Cohesion: 0.24
Nodes (11): cargarEnv(), conBase(), credencialDe(), credencialesDeRoles(), ROLES, urlDeAdmin(), urlDelDueno(), variable() (+3 more)

### Community 77 - "core.ts"
Cohesion: 0.40
Nodes (3): core, empresaConfig, ADR-0012

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
Cohesion: 0.14
Nodes (14): dependencies, @capaz/shared, cmdk, @fontsource-variable/inter, @fontsource-variable/jetbrains-mono, lucide-react, motion, @radix-ui/react-dropdown-menu (+6 more)

### Community 82 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, oxlint, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript (+3 more)

### Community 83 - "4. Módulo `registro` · Finanzas ligeras (fase 14)"
Cohesion: 0.29
Nodes (7): 4.2 Reglas de dinero (dominio; cada una con su prueba unitaria), 4.3 Contratos (`packages/shared/src/contratos/registro.ts`), 4.4 Herramientas: permiso, criticidad y marcas, 4.5 Consumidores y fuente de tiempo (s3), 4.6 Carriles de servidor, 4.7 Pantallas (`apps/web/src/modules/registro/`), 4. Módulo `registro` · Finanzas ligeras (fase 14)

### Community 84 - "2. Frente A · Administración de las otras empresas (Datayros gestiona a sus clientes)"
Cohesion: 0.29
Nodes (7): 2.1 Qué hay hoy (verificado), 2.2 Tres diseños posibles, 2.3 Modelo de datos mínimo (diseño 3), 2.4 Permisos de los operadores, 2.5 Soporte: entrar a la empresa del cliente, 2.6 Hallazgos del frente A, 2. Frente A · Administración de las otras empresas (Datayros gestiona a sus clientes)

### Community 85 - "scripts"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, preview, test, typecheck

### Community 86 - "lectura"
Cohesion: 0.40
Nodes (5): lectura(), recortar(), 4.1 Manifiesto (lo edita M-registro-s1), 9. X2 · Cierre de la ola 2 (integrador), 5. Cosas que no son obvias (trampas ya pisadas)

### Community 88 - "5. Módulo `crm` (fase 15)"
Cohesion: 0.40
Nodes (5): 5.1 Manifiesto (M-crm-s1), 5.2 Reglas (dominio), 5.3 Contratos (`contratos/crm.ts`), 5.4 Carriles, 5. Módulo `crm` (fase 15)

### Community 89 - "6. Módulo `ordenes` · Pedidos (fase 16)"
Cohesion: 0.40
Nodes (5): 6.1 Manifiesto (M-ordenes-s1), 6.2 Reglas (dominio), 6.3 Contratos (`contratos/ordenes.ts`), 6.4 Carriles, 6. Módulo `ordenes` · Pedidos (fase 16)

### Community 90 - "KitOla2"
Cohesion: 0.20
Nodes (10): buscarEn(), Cantidades(), Cifras(), KitOla2(), Navegacion(), Retardo(), Seccion(), Selectores() (+2 more)

### Community 91 - "tablero.tsx"
Cohesion: 0.25
Nodes (3): ColumnaDeTablero, Props, Tablero()

### Community 95 - "cifra.tsx"
Cohesion: 0.40
Nodes (4): Cifra(), GrupoDeCifras(), TonoDeCifra, TONOS

## Knowledge Gaps
- **529 isolated node(s):** `Estado`, `ESTADOS`, `AccionDeModulo`, `ETIQUETA_DE_ACCION`, `FormularioDePlan` (+524 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 761 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `pg` connect `vitest` to `sembrar-demo.ts`, `automatizaciones.int.spec.ts`, `preparar-base.ts`, `borradores.int.spec.ts`, `config.js`, `database.service.ts`, `api/package.json`?**
  _High betweenness centrality (0.152) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `EjecutorDeHerramientas` (e.g. with `1. Reglas comunes de todo módulo clásico` and `S1 · Herramientas`) actually correct?**
  _`EjecutorDeHerramientas` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Estado`, `ESTADOS`, `AccionDeModulo` to the rest of the system?**
  _529 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AGENTS.md (reglas del constructor)` be split into smaller, more focused modules?**
  _Cohesion score 0.0573025856044724 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `vitest` to `config/config.ts`, `filtro-de-errores.ts`, `pantalla-registro.tsx`, `web/package.json`, `entidades.tsx`, `automatizaciones.int.spec.ts`, `borradores.int.spec.ts`, `src/index.ts`, `paleta-de-comandos.tsx`, `reglas.ts`, `database.service.ts`, `logica.ts`, `main.ts`, `api/package.json`, `csv.ts`, `catalogo.spec.ts`, `logger.ts`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Are the 11 inferred relationships involving `sembrarEmpresa()` (e.g. with `sembrarCrm()` and `sembrarFinanzas()`) actually correct?**
  _`sembrarEmpresa()` has 11 INFERRED edges - model-reasoned connections that need verification._
- **Should `sembrar-demo.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05309734513274336 - nodes in this community are weakly interconnected._