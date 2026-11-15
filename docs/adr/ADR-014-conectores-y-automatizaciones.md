# ADR-014: Conectores y automatizaciones («conecta tu empresa»)

**Estado:** aceptado por Moisés el 2026-11-15 · **Fecha:** 2026-11-14 · **Decide:** Moisés · **Relacionado:** ADR-005, ADR-009, ADR-013

## Contexto
El usuario quiere que Capaz sea un ERP con los módulos clásicos y los más pedidos, que se puedan agregar más módulos a futuro, y que **se conecte con la empresa del cliente y automatice** (facturación electrónica, mensajería, bancos, contabilidad externa, hojas de cálculo, otras herramientas). Un ERP de pyme no vive aislado: lo que más frena su adopción es no poder traer ni sacar datos y no hablar con lo que el cliente ya usa.

Referencias: patrón «hub y radios» (un modelo canónico en el centro y un conector por sistema externo) y webhooks para lo urgente más REST para cargas masivas ([GreenSharp](https://greensharp.com/en/integrazione-marketplace-con-erp/), [ERP-Experte](https://www.erp-experte.at/en/blog/erp-interfaces-api-edi)); las reglas «cuando pasa X, haz Y» de Odoo (`base_automation`, 18 disparadores); en Perú la facturación electrónica se hace casi siempre conectando el sistema por API a un proveedor OSE/PSE (Nubefact, Bizlinks, EFACT, TCI, Gosocket) ([Conit](https://conit.pe/blog/facturacion-electronica-sunat-desde-tu-sistema), [Alanube](https://blog.alanube.co/peru/facturacion-electronica-sunat-para-empresas/)).

## Decisión

### 1. Un conector es un módulo especial con manifiesto
Declara: código, versión, **capacidades** (`emitir_comprobante`, `enviar_mensaje`, `importar_clientes`, …), esquema Zod de su configuración, tipo de autenticación (`clave_api`, `oauth2`, `ninguna`), las **herramientas** que expone y los **eventos** que escucha o emite. Se activa por empresa como cualquier módulo (`empresa_modulos`) y se configura en «Conecta tu empresa».

### 2. Modelo de datos (esquema `core`, todas con `tenant_id` y RLS)
- `core.conectores`: catálogo (sin `tenant_id`), sincronizado desde los manifiestos.
- `core.conexiones`: una por empresa y conector; estado (`pendiente`, `activa`, `con_error`, `desactivada`), configuración **no secreta** (jsonb validado) y `credenciales` cifradas.
- `core.referencias_externas`: (`tenant_id`, `conector`, `entidad`, `id_interno`, `id_externo`), única por (`tenant_id`, `conector`, `entidad`, `id_externo`). Es el mapa entre nuestros ids y los del otro sistema.
- `core.sincronizaciones`: ejecuciones con cursor, resultado y errores.
- `core.webhooks_entrantes` (recibidos, con firma verificada y clave de idempotencia por evento) y `core.webhooks_salientes` (suscripciones de la empresa a nuestros eventos).

### 3. Secretos
- Cifrado en la base con AES-256-GCM; la clave maestra vive en el entorno del servidor (`CONEXIONES_CLAVE`), nunca en la base ni en el repositorio, con identificador de versión para rotarla.
- Las credenciales **nunca** salen por la API ni por los registros; la pantalla solo muestra «configurada». Tampoco las ve `capaz_sistema` (la plataforma ve estado de la conexión, no la credencial).
- Toda conexión, cambio y uso queda en la auditoría.

### 4. Ejecución
- Los conectores corren en el **trabajador** (mismo código, ADR-013), alimentados por la tabla de eventos de salida (fase 8). Nunca dentro de la petición del usuario.
- Reintentos con espera creciente, límite de velocidad por conexión, cola de fallidos visible para la empresa y botón «reintentar».
- Los webhooks entrantes se verifican (HMAC o firma del proveedor), se registran y se procesan una sola vez.
- **Toda acción de un conector sobre Capaz pasa por `ejecutar()`** con `canal: 'sistema'` y el permiso del módulo, como cualquier otra operación. Un conector no escribe en las tablas directamente.

### 5. Automatizaciones: reglas como datos
`core.reglas_automaticas`: **disparador** (evento, tiempo, webhook o manual) + **condiciones** (expresiones declarativas validadas, sin código arbitrario) + **acciones** (herramientas registradas con argumentos) + **modo** (`borrador`, `pide_aprobacion`, `automatico`) + límites.
- Disparadores de tiempo («N días después de una fecha»: deuda vencida, prueba por vencer, cotización sin respuesta) son los que más pide el negocio y los que faltaban en el plan.
- Reglas que mueven dinero o escriben datos fiscales **nunca** van en `automatico`: quedan en borrador o piden aprobación (ARQUITECTURA-DE-IA).
- Límite de ejecuciones por empresa y por día, modo de prueba («qué haría») e historial por ejecución.

### 6. Primeros conectores (orden propuesto)
1. **Importar y exportar** (Excel/CSV) de clientes, productos y movimientos.
2. **Webhooks genéricos y claves de API por empresa** (para Zapier, Make, n8n o sistemas propios).
3. **WhatsApp Business** (plantillas, enlace de cotización, avisos de deuda).
4. **Contabilidad externa:** exportación en el formato que pida el contador (por ejemplo libros electrónicos) y, si lo piden, Alegra o Bsale.
5. **Servidor MCP** de solo lectura para asistentes externos (ARQUITECTURA-DE-IA).
6. **Etapa final · Facturación electrónica** vía un proveedor OSE/PSE. Decisión del usuario (2026-11-14): se conecta **al final**, cuando el software esté completo y estable. El marco de conectores la recibirá sin cambios; el proveedor se elige entonces (los precios publicados van de unos S/30 a S/300 al mes según volumen, de fuentes de proveedores).

### 7. Lo que no se hace
Crear nuestra propia plataforma de integración tipo iPaaS, un mercado público de conectores de terceros, ni conectores a sistemas que ningún cliente haya pedido. Se evalúa un iPaaS externo solo si los conectores a medida se vuelven inmanejables.

## Consecuencias
- Se agrega la **fase 11** al plan (después de la fase 8) y las reglas por tiempo a la fase 8.
- El resto de módulos no necesita saber de conectores: les basta con emitir eventos y exponer herramientas (ADR-005, ADR-013).
- Hay que decidir con el usuario el proveedor de mensajería (primer conector). El proveedor de facturación se elige en la etapa final, y antes se confirma con SUNAT qué clientes están obligados (las fuentes consultadas no coinciden en fechas y alcance).
