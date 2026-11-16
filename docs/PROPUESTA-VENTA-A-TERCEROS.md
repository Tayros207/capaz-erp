# Propuesta · Vender Capaz a otras empresas (SUNAT, exportación contable y ajuste de olas)

**Fecha:** 2026-11-16 · **Estado: PROPUESTA PENDIENTE DE APROBACIÓN del usuario. No cambia ninguna decisión vigente.**
**Contexto:** el usuario confirmó (2026-11-16) que Capaz se comercializará a otras empresas, no solo a Atlantisgraf. Esta propuesta nace de contrastar el catálogo de módulos con lo que ofrecen SAP, Oracle y Dynamics, y se coordinó con la otra sesión (modules-5a), que escribió `PROPUESTA-DE-MEJORAS.md`. Léase junto con él: no repite sus rondas.

## 1. Lo que sigue vigente

- **Facturación electrónica SUNAT = etapa final** (decisión escrita del usuario, 2026-11-14). Nada de aquí la adelanta. Se propone abajo **qué preparar sin adelantarla** y **cuándo conviene revisar la decisión**.
- Sin contabilidad formal propia: se exporta o se conecta.
- El núcleo es reutilizable y solo se reemplaza la familia de verticales (ADR-013).

## 2. Qué cambia al vender a terceros

| # | Hallazgo | Por qué importa con un cliente que no eres tú | Propuesta |
|---|---|---|---|
| V1 | SUNAT como cierre | Casi toda empresa peruana que compre un ERP necesita emitir comprobantes | **Decisión a revisar por el usuario** antes del 2.º cliente de pago (ver §3). Mientras tanto, preparar los datos |
| V2 | Contabilidad | Trabajan con contador externo: lo que piden es **entregarle los datos** | Ficha de exportación contable (§4) |
| V3 | Producción | Solo importa si el sector es manufactura | Tratarla como **vertical**, no como parte del núcleo (ya es la ronda 4 de `PROPUESTA-DE-MEJORAS.md`) |
| V4 | Inventario | Excluye varios almacenes, lotes y transferencias (C-I6, C-I7 de la propuesta de mejoras) | Se reevalúa cuando se conozca el sector del cliente 2 |
| V5 | Posventa (garantías, reclamos) | Clientes con varias sedes y servicio posterior | Cabe en CRM como actividades sobre el cliente (C-C1) más un tipo «reclamo» |
| V6 | Presupuesto contra ejecución, control por unidad de negocio | Lo piden empresas con más de una sede | Reportes + `sucursal_id` (ya existe); ficha futura |

**Pregunta abierta, solo del usuario: ¿cuál es el sector del cliente 2?** Define V3 y V4.

| Si el cliente 2 es… | Primero |
|---|---|
| Otra gráfica | Ronda 4 (producción, unidades) |
| Comercio o distribución | V4 (varios almacenes, lotes) y SUNAT |
| Servicios | SUNAT, proyectos y horas |
| Manufactura general | Producción básica y calidad |

## 3. SUNAT: preparar sin adelantar

Lo que no choca con la decisión del 14-nov y evita rehacer después:

1. **Datos fiscales de la empresa** (razón social, RUC, dirección fiscal, régimen): ya es **B2, ronda 1** de `PROPUESTA-DE-MEJORAS.md`. Esta ficha depende de él y no lo duplica.
2. **Datos mínimos por documento** (ya previstos en ADR-013): documento del cliente, IGV desglosado por línea, correlativos con serie.
3. **Elegir proveedor OSE/PSE** (precio, API, soporte, certificado) y confirmar con SUNAT quién está obligado. Es investigación, no construcción.
4. **Diseño del conector** como los demás (ADR-014): borrador del comprobante en la bandeja, la persona aprueba, el conector envía. Sin XML UBL propio.

**Criterio sugerido para revisar la decisión:** cuando exista un cliente de pago que emita comprobantes. Hasta entonces, nada se construye; la decisión de adelantar o no es del usuario.

## 4. Ficha · Exportación al contador (propuesta, sin construir)

- **Objetivo:** que el contador externo reciba los datos sin volver a teclearlos.
- **Qué entrega:** ventas, compras, cobros y pagos de un período, con documento del cliente o proveedor, IGV desglosado y moneda, en CSV/Excel. Después, formatos de libros electrónicos (PLE) y conexión a software contable.
- **Cómo:** conector de exportación sobre las herramientas de lectura de `registro`, `ordenes` y `compras` (por herramienta, con permisos y auditoría, sin leer tablas de otros módulos).
- **Pasos:** (1) CSV por período con las columnas que pide el contador; (2) mapeo configurable de plan de cuentas por empresa; (3) PLE solo junto con SUNAT.
- **Depende de:** B2 y de las convenciones fiscales de §3.2. **Esfuerzo:** S para el paso 1, M para el 2, L para el 3.
- **No incluye:** libro mayor, asientos, doble partida.

## 5. Dónde encaja en las olas

Ajuste propuesto (no aplicado a `MODULOS-Y-MERCADO.md` §4 como decisión; ver la nota allí):

- **Ronda 1 de mejoras** (ya propuesta): incluye B2, base de los datos fiscales.
- **Antes del 2.º cliente de pago:** ronda 3 de mejoras (consola) + paso 1 de §4 + elección de proveedor OSE/PSE (§3.3).
- **Ola 5:** pasos 2 y 3 de §4, según el sector.
- **Final:** conector SUNAT, salvo que el usuario decida revisarlo.

## 6. Decisiones que necesita el usuario

1. ¿Cuál es el sector del cliente 2?
2. ¿Se mantiene SUNAT como etapa final, o se revisa antes del 2.º cliente de pago? (Recomendación: hacer ya la investigación de proveedor, que no construye nada.)
3. ¿Se aprueba la ficha de exportación al contador (§4)?
