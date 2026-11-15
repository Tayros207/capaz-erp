# Arquitectura de módulos de Capaz ERP

**Fecha:** 2026-11-11 · **Estado:** borrador para aprobar · Basada en el estudio de Odoo 20.0 (solo lectura, no se copia código) y adaptada a nuestro stack.

## 1. Qué tipo de arquitectura es

**Monolito modular.** Una sola aplicación y una sola base de datos, dividida en módulos con fronteras claras. No son microservicios: un módulo es una carpeta dentro de la misma aplicación, no un servicio aparte.

Capas dentro de cada módulo (arquitectura por capas, con reglas de negocio separadas de la entrada y de la base):

```
Entrada (HTTP, herramientas del agente, MCP)
        ↓
Servicios (casos de uso)  ←→  Dominio (reglas puras)
        ↓
Repositorios (Drizzle, dentro de una transacción con la empresa fijada)
        ↓
PostgreSQL con RLS
```

## 2. Qué hace Odoo y qué tomamos

Lo verificado en el código de Odoo 20.0 descargado:

| Odoo | Hecho verificado | En Capaz |
|---|---|---|
| Módulos con manifiesto | `__manifest__.py` declara nombre, versión, `depends`, archivos de datos, y si es una «aplicación». CRM depende de 11 módulos | **Sí.** Manifiesto con `dependeDe` y validación al arrancar |
| Anatomía fija de módulo | Carpetas `models`, `views`, `security`, `data`, `controllers`, `wizard`, `report`, `i18n`, `tests` | **Sí**, con nuestras carpetas (sección 3) |
| Modelo = metadatos | Cada campo declara tipo, validación y cómo se muestra | **Parcial.** El esquema Zod es la única verdad; no generamos pantallas automáticamente |
| Herencia de modelos (`_inherit`) | 135 extensiones frente a 209 modelos nuevos en lo descargado; varios módulos extienden `res.partner` | **No.** Un módulo no modifica el modelo de otro |
| Vistas en XML | Pantallas declaradas como datos | **No.** Pantallas en React |
| Accesos por grupo y modelo | `ir.access.csv`: grupo × modelo × operación, con filtro (por ejemplo «solo mis oportunidades») | **Sí**, como permisos declarados por módulo, con RLS en la base |
| Reglas por empresa | Filtro `company_id` aplicado por la aplicación | **Sí, pero en la base** (RLS), que no se puede saltar desde el código |
| Una base de datos por cliente | Un registro de modelos por base y un filtro de bases por dirección | **No.** Una sola base compartida con aislamiento por empresa (meta de costos) |
| Tipos de servidor | Un hilo, `gevent` o varios procesos con trabajadores HTTP y trabajadores de tareas programadas | **Sí, la idea:** dos puntos de entrada del mismo código, API y trabajador |
| Tres tipos de ruta | `http`, `jsonrpc` y `json2` | **Equivalente:** REST, herramientas del agente y MCP, distinguidos por `canal` |
| Automatizaciones | Módulo `base_automation` («cuando pase X, haz Y») | **Después**, con eventos y tabla de salida |
| Localización | `l10n_pe` se instala sola junto con contabilidad | **Sí, después:** paquete regional `es-PE` (moneda, IGV, categorías) |
| Datos iniciales | Archivos XML (etapas, motivos de pérdida) | **Sí**, como semillas tipadas en TypeScript |

Lo que **no** copiamos y por qué:
- **Modelos gigantes.** `account_move.py` tiene 8.413 líneas y `account_tax.py` 5.268: cuando todo se extiende sobre un mismo modelo, crece sin control.
- **Parches sobre otros módulos.** Se actualiza con dolor, porque un cambio en un módulo rompe a quien lo extendía.
- **Cadenas largas de dependencias.** CRM arrastra calendario, correo, SMS y más. Aquí cada módulo depende solo de `core` y, como mucho, de uno más.

## 3. Anatomía de un módulo

Servidor, `apps/api/src/modules/<modulo>/`:

```
<modulo>.manifest.ts    id, nombre, versión, dependeDe, permisos, herramientas, esquema de base
<modulo>.module.ts      registro en NestJS
domain/                 reglas puras, sin base ni HTTP
services/               casos de uso (una operación = una función)
repositories/           consultas con Drizzle; reciben la transacción
herramientas/           operaciones registradas (UI, agente, MCP usan las mismas)
http/                   solo si un tercero necesita rutas REST (ADR-009); lo normal son herramientas
schemas/                contratos Zod
db/                     tablas del módulo y migraciones SQL propias
seeds/                  datos iniciales tipados
eventos/                eventos que emite y que consume
tests/
```

Web, `apps/web/src/modules/<modulo>/`:

```
manifest.ts             rutas, secciones, ícono, permisos que exige
pages/  components/  api/
```

## 4. Reglas

1. **Dependencias sin ciclos.** `dependeDe` se valida al arrancar y falla si hay un ciclo o un módulo faltante.
2. **Un módulo solo importa de `core` y de `shared`.** Nunca de otro módulo; lo prueba una prueba de arquitectura.
3. **Se extiende con tablas propias, no modificando las ajenas.** Si Registro necesita datos extra de un cliente, crea `registro.cliente_datos` con clave hacia `core.clientes`.
4. **Los módulos se hablan por eventos.** El emisor no sabe quién escucha; si el otro módulo no está contratado, el evento no hace nada.
5. **Activar un módulo es un dato, no una instalación.** El código de todos los módulos siempre está desplegado; `empresa_modulos` decide cuál usa cada empresa (diferencia con Odoo, que instala por base).
6. **Los permisos se declaran en el manifiesto** y una prueba comprueba que cada herramienta exija un permiso declarado.
7. **Una operación, un servicio.** Pantalla, voz, agente y MCP llaman al mismo servicio.
8. **Los archivos de más de 500 líneas se dividen**, para no repetir los modelos gigantes.
