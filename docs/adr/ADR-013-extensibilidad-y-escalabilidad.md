# ADR-013: Extensibilidad y escalabilidad como requisito de diseño

**Estado:** aceptado (instrucción del usuario, 2026-11-14: «a futuro se desea extender más y que sea escalable») · **Decide:** Moisés

## Contexto
Capaz es un ERP que debe crecer: más módulos, más empresas y, a futuro, más extensión (otros sectores y, posiblemente, terceros). Cambiar el modelo de datos con clientes en producción es lo más caro; por eso se decide ahora qué se deja preparado, sin construir de más.

## Decisión

### Extensibilidad: puntos de extensión que ya existen y se mantienen estables
1. **Módulos por manifiesto** (`dependeDe`, permisos, herramientas, eventos): agregar un módulo es agregar una carpeta y su manifiesto, sin tocar el núcleo (ADR-001).
2. **Herramientas tipadas** (ADR-005, ADR-009): la única forma de operar el sistema. Un módulo nuevo, un agente o un tercero extienden el sistema registrando herramientas, no modificando las de otros.
3. **Eventos entre módulos** (fase 8): un módulo reacciona a otro sin conocerlo.
4. **Sin herencia entre módulos**: se extiende con tablas propias que apuntan por llave compuesta al núcleo (ADR-012).
5. **Contratos versionados en `@capaz/shared`**: cualquier extensión externa se apoya en ellos.

### Preparado desde ya, barato y caro de cambiar después
- **Campos personalizados por empresa:** las entidades del núcleo (clientes, productos) llevan una columna `datos_extra jsonb not null default '{}'` y, más adelante, una tabla de definiciones por empresa. Sin definiciones no se muestra nada; no se construye el editor todavía.
- **Catálogo de productos y servicios en el núcleo** (`core.productos`, `core.listas_de_precios`), compartido por Cotizador, Registro, Insumos y Compras. Entra antes de la ola 2.
- **Sucursales:** las tablas de documentos (cotizaciones, órdenes, movimientos) llevan `sucursal_id` opcional hacia `core.sucursales` (una por defecto por empresa). Una empresa con un solo local no ve la complejidad.
- **Usuarios en varias empresas con rol de solo lectura** (el contador externo): ya lo permite el modelo de cuentas globales; se agrega el rol `lectura` a nivel de empresa.
- **Importar y exportar** (Excel/CSV) como herramientas del núcleo, también para clientes nuevos.
- **Datos fiscales mínimos desde ya, sin emitir nada:** documento de identidad del cliente (`documento_tipo`, `documento_numero`, ya en `core.clientes`), IGV desglosado en cotizaciones y órdenes, y correlativos con serie. Así la facturación electrónica de la etapa final se conecta sin rehacer tablas.
- **API para terceros:** no se construye ahora. Cuando se pida, será un envoltorio REST/MCP de las mismas herramientas, con autorización por clave y por empresa.

### Escalabilidad: reglas que se cumplen desde la primera migración
1. **Todo índice de una tabla con `tenant_id` empieza por `tenant_id`** (salvo la clave primaria por `id`, destino de las llaves foráneas). Es lo que hace que una consulta por empresa siga rápida con millones de filas.
2. **Tablas de solo inserción grandes** (`auditoria`, `eventos_salida`, `empresa_modulos_eventos`) se diseñan para poder particionarse por fecha después (clave de tiempo en el índice, sin llaves foráneas que lo impidan). No se particionan hasta que haga falta.
3. **Servidor sin estado:** nada de sesión ni caché en memoria que dependa de una sola instancia; Better Auth guarda sesión en la base. Así se puede correr más de una instancia detrás de un balanceador.
4. **API y trabajador separables** (ARQUITECTURA-DE-MODULOS, dos puntos de entrada): el relevo de eventos puede moverse a otro proceso sin cambiar código de negocio.
5. **Conexiones:** un solo grupo por rol; en producción se usa el pooler de Neon con transacciones cortas (`conEmpresa` fija las variables con `set_config(..., true)`, local a la transacción). Se prueba con el pooler en la fase 10a.
6. **Consultas del negocio siempre acotadas por empresa** (la RLS lo garantiza); nada de consultas entre empresas fuera de `capaz_sistema`.
7. **Operaciones idempotentes y asíncronas** para lo pesado (reportes, importaciones, envíos): se encolan en la tabla de eventos, no se ejecutan en la petición.
8. **Medición antes de optimizar:** `requestId`, duración por petición y consultas lentas (Neon las expone) se revisan en el piloto; no se agregan réplicas ni caché sin un número que lo justifique.

### Lo que NO se hace ahora
Microservicios, tienda de módulos de terceros, editor visual de campos y flujos, particionado, réplicas de lectura. Se reevalúan con datos reales (ver el plan de olas en `MODULOS-Y-MERCADO.md`).

## Consecuencias
- Las migraciones de las fases 5a, 7, 8 y la nueva del catálogo siguen estas reglas; una prueba de catálogo vigilará que todo índice con `tenant_id` lo tenga como primera columna.
- Se agregan al plan: `core.productos` y `core.sucursales` (antes de la ola 2) y las herramientas de importar y exportar.
- Preguntas abiertas para el usuario: si «extender» incluye a terceros que construyan módulos, y si el siguiente sector después de gráfica y publicidad ya está pensado (afecta qué es «núcleo» y qué es «vertical»).
