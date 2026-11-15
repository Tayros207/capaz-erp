# Módulos, mercado y hoja de ruta de Capaz ERP

**Versión 2 · 2026-11-14 · olas y orden actualizados el 2026-11-15 · Para: Moisés (decide) y los agentes constructores.**
Dice **qué** se construye y **en qué orden**, con el mercado y las referencias como respaldo. El **cómo** de cada fase sigue en `PLAN-DE-CONSTRUCCION.md`, que manda donde choquen. El orden y el alcance vigentes son los de `PLAN-DE-CONSTRUCCION.md` versión 3 (decisión del usuario del 2026-11-15: primero la estructura completa del ERP; Registro por voz y Cotizador después).

Las cifras de mercado vienen en su mayoría de blogs de proveedores y de directorios; son **orientativas** y se citan con su fuente. Lo verificado en código o en documentación oficial se marca como tal.

---

## 1. Qué es Capaz

Un **ERP** vertical para talleres gráficos y publicitarios de Perú: modular, multiempresa, con una sola base de datos, que crece por módulos y se conecta con lo que cada empresa ya usa. Su principio rector es el **trabajador digital**: el sistema hace el trabajo (voz, WhatsApp, documentos, sugerencias, alertas) y la persona supervisa y aprueba. Las referencias clásicas (Odoo, Dolibarr, ERPNext) dan estructura; la experiencia se diseña desde el agente.

Al diseñar cualquier módulo, en este orden:
1. Qué puede hacer un agente solo (capturar, proponer, avisar, dejar borradores).
2. Qué aprueba la persona (bandeja de revisión con un clic; confirmación para lo crítico).
3. Toda acción es una herramienta tipada y auditable, la misma para pantalla, voz, agente y MCP (ADR-005, ADR-009).
4. Las pantallas clásicas son el respaldo, no el camino principal.

## 2. Mercado y referencias

### 2.1 Tendencias 2026

| Tendencia | Qué dicen las fuentes | En Capaz |
|---|---|---|
| IA con agentes que actúan, no solo chat | Microsoft, NetSuite, Sage y Epicor lanzaron agentes a inicios de 2026 ([NetSuite](https://www.netsuite.com/portal/resource/articles/erp/erp-trends.shtml), [TechnologyAdvice](https://technologyadvice.com/blog/accounting/erp-industry-trends/)) | Es el centro del producto |
| La persona sigue aprobando | Agentes dentro de permisos, flujos de aprobación y auditoría ([Crestwood](https://www.crestwood.com/blog/erp-trends-2026-autonomous-erp-dynamics-365-business-central/), [Volt](https://volt-technologies.com/post/erp-2026-trends-ai-automation/)) | Borradores, bandeja, confirmación solo desde la pantalla, auditoría de solo inserción |
| Nube por defecto en pymes | ([Flectic](https://flectic.com/blog/top-erp-trends-2026)) | Neon + servidor en São Paulo |
| ERP vertical por industria | Procesos y KPI preconfigurados por sector ([ERP Absolute](https://www.erpabsolute.com/blog/vertical-erp-software/)) | Cotización por pliego, órdenes de taller, categorías del rubro |
| Datos limpios antes que IA | ([Everware](https://www.everwareconsulting.com/post/gamechanger-erp-2026-technologies-transforming-enterprises)) | Clientes únicos, correlativos, categorías consistentes |

### 2.2 Qué módulos pide una empresa

| Módulo clásico | Adopción (orientativa) | En Capaz |
|---|---|---|
| Finanzas y contabilidad | 95 % ([Parsli](https://parsli.co/blog/erp-statistics)); en pymes, cuentas por pagar 77 % y por cobrar 73 % ([ERP Research](https://www.erpresearch.com/erp-for-size/small-business)) | **Registro** = caja + cuentas por cobrar y por pagar. La contabilidad formal **no se construye**: se exporta o se conecta |
| Inventario | 69 % | **Insumos** |
| Ventas y CRM | 65 % | **Cotizador** y **CRM** |
| Compras | 61 % | **Compras** (va con Insumos) |
| RRHH y planilla | 58 % | **Personal** ligero; la planilla formal se conecta |
| Reportes | en todo ERP | **Reportes** |

### 2.3 Competencia directa (software para imprentas)

| Producto | Qué es | Qué aprendemos |
|---|---|---|
| [Twist Print](https://www.twistsoftware.com/es/software-para-imprentas-en-peru) (Perú) | MIS en la nube con facturación SUNAT unida a cotización y orden | El competidor local. Confirma el flujo cotización → orden → factura y que la facturación será pregunta temprana (decisión: etapa final, sección 4) |
| [Logic Print](https://www.logic-print.com/amer.html) (España) | ERP de artes gráficas con asistente de IA y panel de producción; licencias por actualización (999 €) | «Asistente de IA» ya es argumento de venta; nuestra suscripción por módulo es más simple |
| PrintVis (sobre Business Central) | MIS vertical sobre ERP generalista | Caro para un taller pequeño |
| DocketManager, Avanti, ePRO, PressWise, ePS Pace ([Capterra](https://www.capterra.com/print-management-software/), [Slashdot](https://slashdot.org/software/print-management/in-south-america/)) | MIS norteamericanos con web-to-print | El portal del cliente es la norma allá (ola 3) |

### 2.4 Precios de referencia en Perú (páginas oficiales, consultadas el 2026-11-14)

| Producto | Planes | Nota |
|---|---|---|
| [Alegra Contabilidad](https://alegra.com/peru/contabilidad/precios/) | S/ 105 (Emprendedor), 152 (Pyme), 223 (Pro), 353 (Plus) al mes con IGV; [solo facturación](https://www.alegra.com/peru/factura-electronica/precios/) desde S/ 49 | Limita comprobantes y usuarios por plan |
| [Bsale](https://www.bsale.com.pe/sheet/precios) | S/ 189 (Básico), 233 (Estándar), 363 (Full) al mes con IGV; sucursal adicional S/ 141 | Usuarios ilimitados; el Básico no trae inventario ni POS |

Lectura para Capaz: una pyme peruana ya paga entre S/ 100 y S/ 360 al mes por gestión básica. Un precio por módulo en ese rango total es creíble; la voz y los agentes son el argumento para no competir solo por precio. Pedir demos de Twist Print y Logic Print antes de fijar la lista.

### 2.5 Referencias de diseño y sus licencias

- **Odoo Community = LGPL-3** (verificado en el clon local). Se estudia, no se copia: código, CSS, íconos ni textos (ADR-006). En Community no están `l10n_pe_edi`, Studio, Documents, Sign, Helpdesk ni contabilidad completa. La marca «Odoo» no se usa.
- **Dolibarr (GPL-3):** activación simple de módulos. **ERPNext/Frappe (GPL-3):** permisos, roles y flujos. **Printavo:** flujo de taller gráfico. **Alegra y Bsale:** mínimos de una pyme peruana. Para todas: solo ideas y estructura. Las licencias de estas cuatro son de memoria: confirmar antes de citarlas en público.
- La maqueta «Capaz ERP» (artefacto) está escrita desde cero; se inspira en patrones genéricos de gestión (encabezado de página, barra de estados, paleta de comandos), con nombres, colores y medidas propios.

## 3. Catálogo de módulos

### 3.1 Familias

| Familia | Qué es | Ejemplos | Se contrata |
|---|---|---|---|
| **Núcleo** | Lo que todos comparten | Empresa, usuarios y permisos, clientes, productos, sucursales, auditoría, eventos, importar/exportar | No: siempre activo |
| **Clásicos** | Lo que pide casi cualquier empresa | Registro (finanzas ligeras), CRM, Compras, Insumos, Reportes, Personal | Por módulo |
| **Verticales de gráfica** | Lo que solo tiene un taller gráfico | Cotizador por pliego, Órdenes de trabajo, Producción, Portal web-to-print | Por módulo |
| **Conectores** | Puentes con otros sistemas | Importar/exportar, webhooks y API, WhatsApp, pagos, contabilidad externa, MCP, facturación electrónica (al final) | Por empresa |
| **Automatizaciones** | Reglas sobre todo lo anterior | Aviso de deuda vencida, recordatorio de cotización, borrador desde un documento | Incluido, con límites por plan |

Para otro sector a futuro se reemplaza la familia de verticales; el resto se reutiliza (ADR-013).

### 3.2 Catálogo de Odoo 20 → Capaz

Leído de los manifiestos del clon (`addons/*/__manifest__.py`). Un módulo depende solo de `core` y, como mucho, de uno más. **La columna «Ola» sigue las olas nuevas de la sección 4 (2026-11-15).** Esta tabla es referencia de ideas; la especificación de cada módulo está en `PLAN-DE-CONSTRUCCION.md` (fases 14 a 20), con nombres y diseño propios.

| Odoo | Módulo de Capaz | Ola | Depende de | Qué tomamos | Qué no |
|---|---|---|---|---|---|
| Contacts | **Clientes** (núcleo) | 1 | — | Persona y empresa en una entidad; documento opcional; fusión de duplicados | Jerarquías, direcciones múltiples |
| Product | **Productos** (núcleo) | 1 | — | Catálogo de productos y servicios con listas de precios, compartido por todos los módulos | Variantes complejas, UoM múltiples al inicio |
| res.company (sucursales) | **Sucursales** (núcleo) | 1 | — | Una por defecto; `sucursal_id` opcional en documentos | Multiempresa consolidada |
| Invoicing + account_payment | **Registro** (familia Finanzas) | 2 (base clásica) · 4 (voz) | — | Pagos entrantes y salientes; se anulan, no se borran; plazos en cuotas después | Doble partida, asientos |
| Sales | **Cotizador** (existe en Cotizín) | 4 | Clientes, Productos | Estados `borrador → enviada → pedido / cancelada`, `locked` aparte; plantillas. Flujo Printavo: cotización → orden → producción → cobro | Listas de precios complejas |
| CRM | **CRM** | 2 | Clientes | Etapas con `is_won`, motivo de pérdida, fecha esperada, actividades, «días sin actualizar» | Probabilidad automática, UTM |
| Project + órdenes de Tairos | **Pedidos** (órdenes de trabajo; código `ordenes`) | 2 | — (propone el cobro al Registro por evento) | Tablero por etapa, fecha de entrega, responsable, agenda | Hojas de tiempo |
| Discuss / sms / WhatsApp (Enterprise) | **Mensajería** (conector WhatsApp) | 5 | Clientes | Plantillas, seguimiento de envíos | Chat interno |
| Dashboards | **Reportes** | 3 | — (compone los resúmenes de cada módulo) | KPI por período, exportación | Hoja de cálculo propia |
| base_automation | **Automatizaciones** (núcleo) | 1 | — | Disparadores por evento, **por tiempo** y por webhook | Código en reglas |
| Inventory | **Insumos** | 3 | Productos | Existencias, mínimos y alertas | Varios almacenes, lotes |
| Purchase | **Compras** | 3 | Insumos | Orden de compra → recepción → egreso | Licitaciones |
| Manufacturing | **Producción** | 5 | Órdenes | Operaciones, máquinas, costo real vs. fijo | BOM multinivel |
| Website / Portal | **Portal del cliente** (web-to-print) | 5 | Cotizador | Aprobar y pagar en línea, estado del pedido | Constructor de sitios |
| Documents / Sign (Enterprise) | **Archivos** (R2) | 5 | — | Adjuntos a cotización y orden | Firma electrónica |
| Point of Sale | **Mostrador** | 5 | Registro | Venta rápida, boleta simple | Hardware de caja |
| Maintenance | **Máquinas** | 5 | Producción | Preventivo por equipo | — |
| HR | **Personal** | 3 | — | Asistencia y adelantos | Planilla formal (se conecta) |
| l10n_pe (sin `l10n_pe_edi` en Community) | **Facturación SUNAT** (conector OSE/PSE) | **Final** | Registro | 60 tipos de documento, distritos (datos públicos) | Plan contable; XML UBL propio |
| HR avanzado, Timesheets, Fleet, Events, eLearning, Surveys, Quality, Helpdesk | fuera | — | — | — | Se reevalúan con clientes |

Patrones de Odoo transversales ya en el plan: manifiesto con dependencias, permisos grupo × operación × filtro (con alcance «propios / todos»), activación por dato, paquete regional, automatizaciones, kit de interfaz (panel de control, barra de estados, tablero, hoja inferior, paleta de comandos).

## 4. Olas de construcción

> **Decisión del usuario (2026-11-15): primero se construye el ERP completo y luego se adaptan dentro de él el Registro por voz y el Cotizador.** Capaz es un ERP de vanguardia con base de ERP comercial: estructura básica completa (núcleo, permisos, módulos clásicos, conectores, automatizaciones), **apariencia tradicional y familiar** y, por detrás, comportamiento de trabajador digital. El detalle de fases está en `PLAN-DE-CONSTRUCCION.md` versión 3; cómo se reparte entre agentes, en `PLAN-PARALELO.md`.

Cada ola termina con uso real, aunque sea interno.

| Ola | Entrega | Lista cuando |
|---|---|---|
| **1 · Estructura del ERP** | Herramientas, auditoría e idempotencia; eventos y correlativos; **carcasa tradicional con menú por familias** (Ventas, Compras, Inventario, Finanzas, Personal) y módulos no contratados bloqueados; usuarios y accesos; Clientes, Productos y Sucursales; **bandeja de borradores**; consola de plataforma; marco de conectores y automatizaciones con importar y exportar (CSV), webhooks y claves de API, y reglas por tiempo | Una empresa entra, ve el menú por familias, gestiona usuarios y datos maestros, importa sus clientes, una regla deja un borrador en la bandeja y el operador le activa un módulo desde la consola. Atlantisgraf la usa con sus clientes y productos |
| **2 · Clásicos I** | **Finanzas ligeras** (módulo `registro`, base clásica: movimientos, cuentas por cobrar y por pagar, abonos, caja del día), **CRM** y **Pedidos** | Atlantisgraf lleva caja y cuentas por cobrar a mano en Capaz, junto a Tairos.RC; las deudas vencidas avisan solas |
| **3 · Clásicos II** | **Inventario** (Insumos), **Compras** (depende de Insumos), **Personal** ligero y **Reportes** | Un cliente lleva insumos y compras; los indicadores salen de datos reales |
| **4 · Adaptación** | Despliegue con HTTPS, **Registro por voz** sobre Finanzas y la bandeja, **Cotizador** portado de Cotizín y **puente** cotización → pedido → cobro | Piloto de 30 días en Atlantisgraf: 70 % de registros por voz sin corregir, 30 s por registro |
| **5 · Crecer** | Endurecer, WhatsApp, pagos (pasarela con Yape/Plin), contabilidad externa, Producción, Portal del cliente, Archivos, Mostrador, Máquinas, agente de consultas, MCP de solo lectura, cobro automático de suscripciones | Más de diez empresas de pago |
| **Final · Cierre** | **Facturación electrónica SUNAT** como conector de un proveedor OSE/PSE. La contabilidad formal no se construye: se exporta o se conecta | El cliente emite comprobantes sin salir del flujo pedido → cobro |

Las olas 2 y 3 necesitan aprobar `docs/adr/ADR-015-estructura-primero-y-modulos-clasicos.md` (propuesto): un esquema de base por módulo, Finanzas ligeras = `registro` en dos pasos (clásico y voz) y Ventas = CRM + Pedidos.

Mientras Compras no exista (ola 3), una compra se anota como egreso en Finanzas. Mientras la voz no exista (ola 4), todo se registra con pantallas tradicionales y por la bandeja.

**Preparado desde la ola 1 para no rehacer después** (ADR-013): `datos_extra jsonb` en entidades del núcleo, `unique (tenant_id, id)` en lo referenciable, documento del cliente, IGV por línea y correlativos con serie, índices que empiezan por `tenant_id`.

## 5. Conectores y automatizaciones: «conecta tu empresa»

Decisión completa en `docs/adr/ADR-014-conectores-y-automatizaciones.md` (**aceptada el 2026-11-15**). El marco entra en la ola 1 (fases 11a a 11c del plan). Resumen:

- **Conector** = módulo especial con manifiesto (capacidades, configuración, autenticación, herramientas, eventos), activado por empresa, con credenciales cifradas que nunca salen por la API ni los registros. Corre en el trabajador, nunca en la petición; toda acción sobre Capaz pasa por `ejecutar()` con `canal: 'sistema'`.
- **Automatización** = regla guardada como datos: disparador (evento, tiempo, webhook, manual) + condiciones declarativas + acciones (herramientas) + modo `borrador | pide_aprobacion | automatico`. Lo que mueve dinero nunca es automático. Límites por empresa y día, modo «qué haría», historial.
- **Pantallas:** «Conecta tu empresa» (estado, configurar, cola de errores con reintento) y «Automatizaciones».

### 5.1 Conectores en orden, con lo investigado

| # | Conector | Ola | Lo investigado (2026-11-14) | Decisión |
|---|---|---|---|---|
| 1 | Importar y exportar (CSV; Excel pide una dependencia) | 1 | — | Primero: es lo que permite que un cliente nuevo entre con sus datos |
| 2 | Webhooks y claves de API por empresa | 1 | Patrón estándar: webhooks para lo urgente, REST para cargas ([ERP-Experte](https://www.erp-experte.at/en/blog/erp-interfaces-api-edi)); hub con modelo canónico ([GreenSharp](https://greensharp.com/en/integrazione-marketplace-con-erp/)) | Permite Zapier, Make, n8n o sistemas propios sin construir cada integración |
| 3 | WhatsApp Business | 5 | Meta cobra por mensaje según el país del destinatario; para Perú las fuentes dan utilidad/autenticación entre US$ 0.02 y 0.039 y marketing entre 0.07 y 0.097 por mensaje ([Infobip](https://www.infobip.com/whatsapp-business/pricing), [Volga](https://www.volga-ai.com/en/guides/whatsapp-business-api-pricing-2026)); las respuestas dentro de la ventana de 24 h son de pago desde octubre de 2026 con 1 000 gratis al mes ([SleekFlow](https://sleekflow.io/en-us/blog/whatsapp-business-price)). Un proveedor (BSP) suma su margen. **Verificar en la tarifa oficial de Meta** | Primer conector con costo variable: `core.uso` registra cada mensaje y su costo; tope por empresa. Elegir BSP con el usuario |
| 4 | Contabilidad externa | 5 | Exportación en el formato del contador (libros electrónicos) | Conector de exportación; Alegra/Bsale si lo piden |
| 5 | **Pagos** (pasarela) | 5 | Yape y Plin no tienen API pública; se llega por pasarela (Niubiz, Izipay, Culqi) con webhooks de confirmación y conciliación, o por convenio directo con el banco (4 a 8 semanas) ([Lain-DS](https://www.lainds.com/perspectivas/como-cobrar-con-yape-y-plin-desde-tu-sistema), [BCP Consulting](https://bcpconsulting.pe/blog/integracion-yape-plin-apps-moviles-empresas-peru/), [Adra](https://adratechsystems.com/recursos/guia-completa-pasarelas-pago-peru-2026)). Interoperabilidad total de billeteras anunciada para 2026, sin confirmación oficial en las fuentes | Mientras no haya pasarela: en el Registro, el **abono por Yape/Plin se registra por voz** («me yapearon 150 de Rosa»), que es el flujo real del taller. La conciliación automática llega con la pasarela |
| 6 | Servidor MCP de solo lectura | 5 | ARQUITECTURA-DE-IA | Para asistentes externos, con autorización por usuario y revocable |
| 7 | Facturación electrónica (OSE/PSE) | **Final** | Nubefact, Bizlinks, EFACT, TCI, Gosocket; planes publicados de S/ 30 a 300 al mes según volumen ([Conit](https://conit.pe/blog/facturacion-electronica-sunat-desde-tu-sistema)); las fuentes no coinciden en qué contribuyentes están obligados ni desde cuándo ([Salaris](https://salaris.pe/factura-electronica/), [Alanube](https://blog.alanube.co/peru/facturacion-electronica-sunat-para-empresas/)) | Al final, con todo estable. Antes: confirmar con SUNAT la obligación de cada cliente y elegir proveedor |

## 6. La voz: el mayor riesgo, con plan de prueba

La meta del piloto (70 % de dictados aprobados sin corregir) depende del reconocimiento con ruido de taller, y **no hay un benchmark independiente de español con ruido**. Las fuentes son de proveedores: Gladia Solaria-3 afirma liderar en español ([Gladia](https://www.gladia.io/blog/best-speech-to-text-apis)); Deepgram Nova-3 y ElevenLabs Scribe se presentan como fuertes en ruido; Whisper es la referencia abierta más robusta al ruido; AssemblyAI tiene streaming multilingüe con español ([AssemblyAI](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription), [Northflank](https://northflank.com/blog/best-open-source-speech-to-text-stt-model-in-2026-benchmarks)).

Decisión: **no se elige proveedor de memoria.** El plan de voz empieza con una prueba comparativa:
1. **Pista V (usuario, ya):** 30 a 50 dictados reales del taller con su transcripción correcta y los datos esperados (monto, tipo, contacto, categoría), guardados fuera del repositorio.
2. **Prueba comparativa (constructor, con orden del usuario por el costo):** los mismos audios contra 3 o 4 servicios (al menos uno abierto como Whisper y dos comerciales). Se mide tasa de error de palabras **y** acierto en monto, contacto y categoría tras la interpretación, que es lo que importa.
3. **Criterio:** el servicio con mejor acierto de datos, costo por minuto aceptable y región cercana. Se diseña para **cambiar de proveedor sin tocar el Registro** (el reconocimiento es un conector más, detrás de una interfaz).
4. **Respaldo:** si nada llega al 70 %, el Registro sigue siendo útil con texto (teclado o dictado del celular) y el piloto mide el tiempo igual.

## 7. Pila de interfaz (fase 6a)

> La investigación detallada (comparativas, patrones de Odoo, dependencias con versión, plan de prueba de 1 día) está en `docs/FRONTEND-INVESTIGACION.md`. **Punto abierto:** el CSS provisional de `apps/web` usa «Pliego» (papel cálido) y esta sección describe «azul noche + esmeralda» (maqueta v2): el usuario debe elegir una identidad visual (decisión D5 del plan). **Desde la versión 3 del plan la carcasa se construye con tokens semánticos y valores provisionales, así que esa elección no detiene a nadie**; lo de abajo describe la propuesta «azul noche + esmeralda», que es la recomendada. La lista vigente de piezas del kit está en `PLAN-DE-CONSTRUCCION.md` §6.3.

Fijado: React 19, Vite 8, React Router 8, Tailwind 4 (tokens en `@theme`), TanStack Query, Zustand solo para estado de pantalla, Zod 4 compartido. Lenguaje visual según la maqueta «Capaz ERP» v2: menú lateral azul noche, área clara, acento esmeralda, Manrope e Inter, 14.5 px en escritorio y 16 px en táctil, claro y oscuro.

Kit (piezas propias en React, nombres y valores propios): `AppShell`, `EncabezadoDePagina`, plantillas `Lista`, `Ficha`, `Tablero`, `Grafico`, `BarraDeEstado`, campos por tipo (`Monto`, `ClienteSelect`, `EstadoPill`, `Telefono`, `FechaRelativa`, `Progreso`), `HojaInferior`, deslizar para actuar, `PaletaDeComandos`, `notificar()`, `confirmar()`, estado vacío con ayuda y ejemplo marcado.

**Dependencias por aprobar antes de la fase 6a (regla 15):** `lucide-react` (o SVG propios), `@fontsource/manrope` y `@fontsource/inter`, y para diálogo, menú y selector probar primero `<dialog>` y `popover` nativos antes de sumar `@base-ui/react` o `radix-ui`. Gráficos en SVG propio hasta que Reportes exija más.

## 8. Convención de migraciones (aplicada desde la fase 2)

> Desde la versión 3 del plan, **solo el carril de datos** escribe migraciones, esquema de Drizzle y las listas de las pruebas de catálogo (`PLAN-PARALELO.md` §2.3). Los demás carriles piden cambios de esquema; no los hacen.

```
apps/api/drizzle/
  0000_cimientos.sql               a mano: esquemas, extensiones, funciones de seguridad, permisos
  0001_empresa_config.sql          generada + seguridad al final
  0002_modulos_y_contratacion.sql  generada + seguridad al final
  0003_modulos_funciones.sql       a mano: funciones de contratación y sus grants
  0004_indices_por_empresa.sql     generada (corrige un índice para cumplir ADR-013)
  0005_auth_better_auth.sql        generada + permisos de capaz_auth y la vista core.v_miembros
  meta/_journal.json
```

Receta por tabla nueva:
1. Declararla en `src/db/esquema/<esquema>.ts` con `tenant_id text not null`; `unique (tenant_id, id)` si otra la referenciará; `datos_extra jsonb not null default '{}'` si es entidad del núcleo; **todo índice empieza por `tenant_id`** (salvo la clave primaria).
2. `pnpm db:generar --name=<nombre>` → `NNNN_<nombre>.sql`.
3. Al final del archivo, a mano: `select core.aplicar_aislamiento('esquema.tabla'[, 'lectura' | 'insercion']);`, disparadores (`core.tocar_actualizado_en`, `core.rechazar_cambio`), y si la plataforma debe verla `select core.abrir_a_plataforma('esquema.tabla', 'update', 'col1, col2');`.
4. Llaves foráneas hacia tablas con `tenant_id`: siempre compuestas `(tenant_id, x_id)`.
5. Funciones con permisos de quien llama, `set search_path = <esquema>, pg_temp` y `grant execute` explícito (nacen sin permiso para `PUBLIC`).
6. `pnpm db:migrar` dos veces (idempotente). Agregar el insert de ejemplo a `EJEMPLOS` en `aislamiento.int.spec.ts` y, si se abrió algo a la plataforma, a `PERMITIDO` en `contratacion.int.spec.ts`. Las pruebas de catálogo (RLS, llaves, funciones, roles, índices) fallan solas si falta algo.
7. Nunca `drizzle-kit push`; nunca editar una migración ya aplicada en otra base: se escribe otra (la 0004 es el ejemplo).

## 9. Instrucciones para el constructor

1. Empieza por `AGENTS.md` y `docs/RELEVO.md`.
2. Se construye por **carriles en paralelo**: tu trabajo es la ficha de tu carril en `docs/PLAN-PARALELO.md` §5 y la fase que cita de `docs/PLAN-DE-CONSTRUCCION.md`. No leas más de lo que diga tu brief.
3. Los módulos de las olas 2 y 3 tienen ficha en el plan (fases 14 a 20); el arquitecto las revisa y congela en la puerta entre olas antes de lanzar sus carriles.
4. Este documento es contexto de producto y de mercado: no es especificación. Ninguna tabla de aquí autoriza a copiar nombres, pantallas ni diseño de otro ERP (regla 12).

## 10. Decisiones del usuario que siguen abiertas

La lista vigente, con recomendación y lo que bloquea cada una, está en `PLAN-DE-CONSTRUCCION.md` §9. Propias de este documento:

1. Pedir demos de Twist Print y Logic Print antes de fijar precios.
2. Elegir el proveedor de WhatsApp (BSP) y la pasarela de pagos al llegar a la ola 5.
3. Autorizar la prueba comparativa de voz (tiene costo por minuto) cuando existan los audios de la pista V.
