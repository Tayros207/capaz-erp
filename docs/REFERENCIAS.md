# Referencias: Odoo 20.0 (solo para estudio)

**Dónde está:** `/home/datayros/Documentos/work/modules/odoo`, clon completo de la rama 20.0 de https://github.com/odoo/odoo (649 addons, ~18 GB), fuera de este repositorio. Existe además una descarga parcial anterior en `/home/datayros/Documentos/work/referencias/odoo-20.0`.

**Cotizín:** copia de referencia de solo lectura en `/home/datayros/Documentos/work/referencias/cotizin-2026-11-14/` (incluye los cambios sin confirmar; ver su `LEEME-COPIA.txt`). Se porta desde ahí.

**Licencia:** la edición Community de Odoo es LGPLv3. Aquí se usa como lectura para entender cómo modela un ERP. **No se copia código de Odoo a Capaz**: copiarlo traería obligaciones de la licencia. Se aprende el modelo y se escribe propio, en TypeScript.

**Seguridad:** son archivos descargados y no confiables. No se ejecutan ni se instalan.

## Qué mirar para cada módulo nuestro

| Para | Archivo en Odoo | Líneas | Qué aprender |
|---|---|---|---|
| CRM básico: clientes y contactos | `odoo/addons/base/models/res_partner.py` | 2463 | Cómo modela persona, empresa y contacto en una sola entidad |
| CRM: oportunidades y etapas | `addons/crm/models/crm_lead.py`, `crm_stage.py` | 2876 / 85 | Etapas, probabilidad y pérdida de un cliente potencial |
| Cotizador: cotización a pedido | `addons/sale/models/sale_order.py`, `sale_order_line.py` | 2930 / 2401 | Estados de la cotización y de sus líneas |
| Registro: deudas, pagos y abonos | `addons/account/models/account_payment.py`, `account_payment_term.py` | 1330 / 360 | Pagos parciales y conciliación con lo adeudado |
| Registro: asientos | `addons/account/models/account_move.py` | 8413 | Estructura de un asiento. Es contabilidad formal, queda fuera de la V1; solo como referencia |
| Multiempresa | `odoo/addons/base/models/res_company.py` | 589 | Cómo separa datos entre empresas |
| Usuarios y permisos | `odoo/addons/base/models/res_users.py` | 1963 | Grupos y derechos de acceso |
| Automatizaciones | `addons/base_automation/` | — | Reglas «cuando pase X, haz Y»: parecido a nuestros eventos entre módulos |
| Localización Perú | `addons/l10n_pe/` | — | Plan contable, tipos de documento y distritos del Perú |

## Orden de estudio, ligado al plan

Regla: cada patrón que se tome de Odoo debe responder a una necesidad concreta de Capaz. No se construye algo genérico solo porque Odoo lo tenga.

| Área de Odoo | Qué se diseña en Capaz | Cuándo (ver `PLAN-DE-CONSTRUCCION.md`) |
|---|---|---|
| Arquitectura de módulos y manifiestos | Manifiestos, dependencias, catálogo | Hecho: `ARQUITECTURA-DE-MODULOS.md`; se construye en la fase 4 |
| Seguridad: grupos, accesos y reglas por registro | Roles, permisos por módulo y RLS | Fases 2 y 4 |
| Contactos (`res_partner`) | `core.clientes` | Fase 7 |
| Acciones automatizadas (`base_automation`) | Eventos y consumidores | Fase 8 |
| Contabilidad: pagos y plazos | Movimientos, deudas y abonos | Plan del Registro |
| Ventas (`sale`) | Estados de cotización y sus líneas | Plan del Cotizador |
| CRM (`crm`) | Etapas y seguimiento | Plan del CRM |
| IA y agentes (documentación; no está en el código Community descargado) | `ARQUITECTURA-DE-IA.md` | Corte de voz del Registro |
| API externa y MCP | Herramientas expuestas a terceros | Cuando un cliente lo pida |
| Informes | Reportes del Registro | Después del piloto |

Antes de cada fase o plan de módulo, el constructor lee los archivos de la fila correspondiente y anota en el documento de diseño qué se toma y qué se descarta.

## Cómo usarlo
Leer el archivo, entender el modelo y los casos que cubre, y anotar la decisión propia en un documento de diseño. Nada de pegar código.
