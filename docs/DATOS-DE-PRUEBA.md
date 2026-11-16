# Datos de prueba (demostración multiempresa)

Un sembrador crea **cinco empresas ficticias de sectores distintos** en la base **local**, con usuarios, productos, clientes y movimientos de varios meses. Sirve para ver el ERP lleno (revisión visual, pruebas manuales, demostraciones) sin teclear nada.

- Script: `apps/api/scripts/sembrar-demo.ts` (+ ayudas en `apps/api/scripts/demo/`).
- **Solo base local.** Se niega a correr si `DATABASE_URL_APP`, `_AUTH`, `_SISTEMA`, `_ADMIN` o la URL de la API no son `localhost`/`127.0.0.1`. No lee ninguna variable `NEON_*`.
- Todo dato ficticio: RUC con dígito verificador válido pero inventado, teléfonos 9xx, nombres peruanos sin relación con personas reales.

## Cómo correrlo

```bash
pnpm db:up && pnpm db:preparar && pnpm db:migrar     # base local al día
pnpm --filter api build && pnpm --filter api start   # la API local, puerto 3001 (necesaria)
pnpm --filter api db:sembrar-demo                    # siembra (≈ 1 min la primera vez, ≈ 15 s las siguientes)
pnpm --filter api db:sembrar-demo -- --resumen       # solo muestra conteos y comprueba el aislamiento
pnpm --filter api db:sembrar-demo -- --limpiar       # borra lo sembrado (y solo eso)
```

Requisitos: `ALTA_DE_EMPRESAS=abierta` en `.env` (como viene por defecto en local) y la API apuntando a la misma base `capaz` que `DATABASE_URL_APP`. Para otra dirección de la API: `DEMO_API=http://localhost:3002`.

**Es idempotente:** una segunda corrida no duplica nada (cada sección se salta si ya hay datos; productos y clientes entran por el importador CSV, que omite repetidos). Los datos son repetibles: el azar usa una semilla fija, aunque las fechas se calculan respecto del día en que se corre.

## Qué crea

Cinco empresas, cada una con su dueño y 2–3 usuarios más. Todas las cuentas usan la misma contraseña de demostración (la cuenta es global, regla 19).

| Empresa (sector) | Usuarios (correo) | Módulos y estado | Productos | Contactos |
|---|---|---|---|---|
| **Gráfica Andina S.A.C.** (taller gráfico) | `admin.grafica` (dueña), `ventas.grafica` (CRM y Pedidos), `caja.grafica` (Finanzas; Reportes solo lectura), `taller.grafica` (Pedidos e Insumos) | **Todos activos** (7) · 2 sucursales | 130 | 81 |
| **Distribuidora Los Nogales E.I.R.L.** (abarrotes) | `admin.abarrotes`, `ventas.abarrotes`, `almacen.abarrotes` | Compras **en prueba** (15 días); sin Personal · 4 sucursales | 150 | 91 |
| **Consultora Horizonte S.A.C.** (servicios) | `admin.consultora`, `comercial.consultora` (administrador) | **Pocos módulos** (Finanzas, CRM, Reportes); **CRM suspendido** (se ve pero no se escribe) | 55 | 42 |
| **Café Qori S.R.L.** (cafetería) | `admin.cafeteria`, `cocina.cafeteria` (Insumos; Compras solo lectura), `caja.cafeteria` | Finanzas, Insumos, Compras, Personal; **Personal de baja** (solo lectura) · 3 sucursales | 90 | 43 |
| **Ferretería Constructora Pacífico S.A.C.** (construcción) | `admin.ferreteria`, `ventas.ferreteria`, `almacen.ferreteria` | Pedidos **en prueba** (10 días); sin Personal · 3 sucursales | 150 | 73 |

Correo completo: `<usuario>@demo.capaz.test`. **Contraseña de todas: `DemoCapaz2026!`** (solo local; no es un secreto de producción).

Además, el **operador de plataforma** de prueba: `operador@demo.capaz.test` (no tiene empresa; entra a la consola `/plataforma`).

Por empresa, según los módulos que tenga:

- **Núcleo:** 2–4 sucursales, 55–150 productos y servicios (códigos por rubro, unidades, precios con IGV; milésimas de sol), 34–80 clientes y 9–20 proveedores con documento (RUC o DNI).
- **Finanzas (`registro`):** 3 cuentas (caja, banco, Yape), unos 100 movimientos de los últimos 5 meses con categorías y medios de pago, 4 transferencias caja → banco, 18 deudas por cobrar y 7 por pagar con abonos parciales o totales y varias **vencidas**.
- **CRM:** 22 oportunidades repartidas por etapas, algunas ganadas y perdidas (con motivo), con actividades (algunas vencidas y otras hechas).
- **Pedidos:** 26 pedidos con 1–4 líneas, en todos los estados (borrador, confirmado, en proceso, listo, entregado, cancelado) y varios **atrasados**.
- **Insumos:** 32 artículos con mínimos, entradas, salidas, ajustes de conteo (varios **bajo el mínimo**) y stock en la segunda sucursal.
- **Compras:** 14 órdenes en todos los estados (borrador, enviada, recibida parcial, recibida, cancelada).
- **Personal:** 6–8 colaboradores, asistencia de hoy y adelantos.
- **Bandeja:** unos borradores propuestos por reglas manuales (más los que proponen las automatizaciones del propio sistema, por ejemplo las deudas vencidas).

## Cómo se crea (por las vías reales)

Nada se inserta en las tablas de negocio con SQL. El sembrador inicia sesión con Better Auth y llama a `POST /api/v1/herramientas/:nombre` como lo haría la pantalla, de modo que se aplican permisos, módulos contratados, auditoría, correlativos, eventos y la RLS:

1. Cuentas: registro e inicio de sesión (`/api/auth/sign-up/email`, `/sign-in/email`); empresa: `POST /api/v1/empresas`.
2. Usuarios adicionales: `invitacion_crear` → la persona acepta (`/api/auth/organization/accept-invitation`) → `miembro_asignar_modulo`.
3. Módulos: la vía oficial de plataforma (`core.activar_modulo`, `suspender`, `baja`, igual que `pnpm plataforma`) y `plataforma admin` para el operador.
4. Productos y contactos: `importar_csv_aplicar` (el importador oficial). El resto: las herramientas de cada módulo (`movimiento_registrar`, `deuda_abonar`, `pedido_confirmar`, `compra_recibir`…). Los borradores nacen de reglas manuales (`regla_guardar` → `regla_activar` → `regla_ejecutar`).

**Excepciones con acceso directo a la base local (solo lectura de conteos y limpieza):**

- Conteos para saltar lo ya sembrado y el resumen final: superusuario local (`DATABASE_URL_ADMIN`), que ignora la RLS.
- Antes de cada inicio de sesión se vacía `auth.rate_limit`: Better Auth limita los intentos de acceso por minuto (`INTENTOS_DE_ACCESO`) y sembrar crea muchas cuentas seguidas. Es solo un contador de ritmo.
- `--limpiar`: con el superusuario y `session_replication_role = replica` (sin comprobar llaves ni disparadores de solo inserción) borra las filas con `tenant_id` de las empresas **cuyos miembros son cuentas `@demo.capaz.test`**, y esas cuentas. No toca ninguna otra empresa ni usuario.

## Verificación que hace el propio script

Al final imprime, por empresa, los conteos y los módulos con su estado, y comprueba el **aislamiento con el rol real de la aplicación** (`capaz_app`, con RLS forzada): fijando el `tenant_id` de cada empresa, solo ve sus propios productos y ninguno ajeno (`Aislamiento: 5/5`).

Comprobado además por HTTP con sesión de cada usuario: `yo` devuelve su empresa y sus módulos; `productos_listar` y las listas de otros módulos responden con datos; una persona **sin** el módulo recibe `modulo_no_disponible` (por ejemplo, `ventas.grafica` no ve movimientos y `caja.grafica` no ve pedidos).

## Lo que no se siembra, y por qué

- **Cotizador, voz y conectores:** el módulo Cotizador y la captura por voz no están construidos (o no se usan en la demostración).
- **Asistencia de días pasados:** `asistencia_marcar` solo marca el día de hoy; no hay herramienta para fechas pasadas.
- **Fechas futuras:** todo lo sembrado es pasado (movimientos, deudas, pedidos); solo las fechas de entrega o de seguimiento pueden caer hacia adelante.
- **Facturación SUNAT:** fuera de alcance del producto por ahora.

## Cosas a tener en cuenta

- Las pruebas de integración (`pnpm check`) usan bases `capaz_test_*` y **no se ven afectadas**; esto escribe en la base de desarrollo `capaz`. Si una prueba manual deja datos propios en esas empresas, `--limpiar` también los borra.
- Las pruebas de la bandeja y de las automatizaciones que cuentan filas globales no deben correrse contra `capaz`; no es el caso de la suite.
- Vencimientos de prueba: Compras (Distribuidora) y Pedidos (Ferretería) están «en prueba» por 15 y 10 días desde que se siembra; si venció, vuelve a correr el sembrador (`activar` renueva el plazo solo si el módulo no existe) o actívalo desde la consola `/plataforma`.
- Si cambian las herramientas (nombres o argumentos), el sembrador fallará en esa sección y la dejará anotada con `⚠` sin detener las demás.
