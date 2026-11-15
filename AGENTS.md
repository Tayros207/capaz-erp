# AGENTS.md · Capaz ERP

Reglas para cualquier agente o persona que construya en este repositorio. El detalle de cada fase está en `docs/PLAN-DE-CONSTRUCCION.md` (manda sobre los demás documentos).

## Cómo trabajar

1. Trabajas **un carril** de `docs/PLAN-PARALELO.md` (o una fase de `docs/PLAN-DE-CONSTRUCCION.md`), solo en sus archivos y en el orden de las rondas. No empieces uno si sus dependencias no cumplen su «Hecho cuando». `PLAN-PARALELO.md` manda sobre cómo se reparte el trabajo.
2. Al abrir: lee este archivo, el plan completo y los archivos que la fase menciona. Nada más.
3. Al cerrar: `pnpm check` en verde y pegado en el informe, fila del tablero actualizada. Commit solo con permiso del usuario.
4. Informe de cierre: **qué se hizo · qué se verificó (comando y resultado) · qué no se hizo y por qué · desviaciones · revisión visual pendiente · qué necesita el usuario**.
5. Si un paso no se puede cumplir como está escrito, **para y pregunta**. No inventes un rodeo.
6. Lo que no puedas comprobar, no lo des por comprobado. La revisión visual la hace una persona.

## Reglas no negociables

1. **Las versiones instaladas son más nuevas que tu memoria** (NestJS 12, React 19.3, React Router 8, Tailwind 4, Zod 4, TypeScript 6.0.3, Vitest 4, Drizzle 0.45). Lee la API en `node_modules` o en la documentación oficial antes de usarla. NestJS: https://docs.nestjs.com/llms.txt
2. **Una sola puerta a la base:** el negocio solo toca la base dentro de `conEmpresa(ctx, fn)`. Solo `infra/database` abre conexiones. Solo `infra/config` (servidor) y `scripts/config.ts` (scripts) leen `process.env`.
3. **Una sola puerta a las operaciones:** toda operación de negocio es una herramienta registrada y pasa por `ejecutar()`.
4. **Empresa, usuario y permisos salen de la sesión del servidor**, nunca de argumentos, cabeceras propias ni del cuerpo. En TypeScript: `empresaId`, `usuarioId`. `tenant_id` es solo la columna y la variable de sesión de la base.
5. **Toda tabla con `tenant_id`** se protege con `select core.aplicar_aislamiento('esquema.tabla')`, **toda llave foránea entre tablas con `tenant_id` es compuesta** `(tenant_id, x_id)`, y **todo índice empieza por `tenant_id`** (salvo la clave primaria). Receta en `docs/MODULOS-Y-MERCADO.md`, sección 8.
6. **Nunca `drizzle-kit push`.** Solo `generate` y migraciones SQL a mano.
7. **Un módulo no importa a otro.** `core` no importa de `modules`. `infra` no importa de nadie.
8. **Sin e2e** (ni Playwright ni pruebas de navegador). Vitest unitarias y de integración contra PostgreSQL real.
9. **Dinero en céntimos enteros** (`bigint` en la base, tipo `Centimos` en TypeScript). Nunca decimales en `number`. Salida `S/ 1,234.50`.
10. **Nombres:** dominio y módulos en español sin tildes en identificadores (`conEmpresa`, `clientes`); `infra/` en inglés; archivos en `kebab-case`; textos de pantalla y errores en español.
11. **Archivos de más de 500 líneas se dividen. Funciones de más de 50, también.**
12. **No se copia ni se traduce código de Odoo.** Solo se lee (`/home/datayros/Documentos/work/modules/odoo`). **Tampoco se copian de Odoo ni de ningún otro ERP:** textos, iconos, CSS, nombres de pantallas o componentes, marca, colores distintivos, cifras de diseño (tamaños, radios, curvas) ni maquetas casi idénticas. Odoo es solo inspiración de ideas genéricas de uso; todo se nombra, dibuja y mide de forma propia (regla del usuario, 2026-11-15).
13. **Cotizín y Tairos.RC son de solo lectura.** Se porta desde la copia `/home/datayros/Documentos/work/referencias/cotizin-2026-11-14/` (ver su `LEEME-COPIA.txt`).
14. **Nada de servicios externos o de pago** (NestJS Observe, Sentry, Neon Auth, correo, modelos de IA) sin orden del usuario.
15. **No agregues dependencias** fuera de las que nombra el plan sin preguntar. No se adoptan paquetes 0.x de NestJS.
16. **Secretos solo en `.env`** (ignorado por git). `.env.example` lleva valores de desarrollo. El servidor en ejecución **no recibe** la credencial del dueño de la base.
17. **Pantallas móvil primero.** Cada pantalla se revisa a 390 y 1280 px, en claro y oscuro, y la lista va en el informe.
18. **Ninguna función `security definer` sobre tablas con RLS.** Lo que cruza empresas lo hace `capaz_sistema` con política explícita.
19. **Las cuentas son globales:** nadie de una empresa cambia el correo ni la contraseña de otra persona.
20. **Un solo catálogo de códigos de error** en `@capaz/shared` (`packages/shared/src/codigos.ts`).

## Comandos

```bash
pnpm install
pnpm db:up            # PostgreSQL 18 local (puerto 5450)
pnpm db:preparar      # roles capaz_* sin superusuario + bases capaz y capaz_test
pnpm db:migrar        # migraciones con capaz_owner (pnpm db:generar para una tabla nueva)
pnpm check            # build de shared + typecheck + lint + pruebas unitarias + de integración
pnpm dev:api          # http://localhost:3001/api/health
pnpm dev:web          # http://localhost:5173
```

## Documentos

| Documento | Para qué |
|---|---|
| `docs/RELEVO.md` | **Empieza aquí:** estado exacto, trampas conocidas y qué sigue |
| `docs/PLAN-DE-CONSTRUCCION.md` | Cómo construir, fase por fase (versión 3: estructura del ERP primero) |
| `docs/PLAN-PARALELO.md` | Carriles para varios agentes a la vez, reglas anti-conflicto y plantilla de brief |
| `docs/PLAN-CIMIENTOS.md` | Qué y por qué de los cimientos |
| `docs/MODULOS-Y-MERCADO.md` | Catálogo de módulos (Odoo como referencia), mercado, olas, pila de interfaz, receta de migraciones |
| `docs/ARQUITECTURA-DE-MODULOS.md` | Anatomía y reglas de los módulos |
| `docs/ARQUITECTURA-DE-IA.md` | Agentes, herramientas y aprobación |
| `docs/PLATAFORMA-Y-PLANES.md` | Consola de plataforma, planes y precios |
| `docs/INTEGRACION-DE-MODULOS.md` | Cómo entran Cotizín y Tairos.RC |
| `docs/FINALIDAD-Y-OBJETIVOS-ERP.md` | Finalidad, alcance, metas del piloto |
| `docs/adr/` | Decisiones de arquitectura (001 a 015; la 015 está propuesta) |
| `docs/REFERENCIAS.md` | Odoo y Cotizín como referencia |
| `docs/FRONTEND-INVESTIGACION.md` | Pila de interfaz propuesta (sin dependencias aprobadas) |
| `docs/NEON-MIGRACION.md` | Cómo se lleva la base a Neon y registro de lo hecho |
