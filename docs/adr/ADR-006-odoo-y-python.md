# ADR-006: Odoo como referencia de diseño; Python fuera del núcleo

**Estado:** aceptado · **Fecha:** 2026-11-11 · **Decide:** Moisés

## Contexto
Odoo es un ERP maduro escrito en Python (núcleo y módulos), con pantallas en XML y cliente en JavaScript. Su edición Community es LGPLv3. Su arquitectura (monolito modular con manifiestos, accesos por grupo, extensión por herencia) sirve de referencia. Su stack no coincide con el de Capaz.

## Decisión
1. **Se estudia Odoo; no se copia ni se traduce su código.** Una traducción sería una obra derivada con obligaciones de licencia (consultar a un abogado si algún día se quisiera). Las referencias están en `/home/datayros/Documentos/work/referencias/odoo-20.0`, fuera del repositorio, y se leen sin ejecutarlas.
2. **Capaz no se construye sobre Odoo** (stack, costos, voz y agentes no encajan).
3. **Python no está en el núcleo.** El servidor es TypeScript.
4. **La puerta a Python queda abierta** para análisis de datos, predicción o procesamiento de audio: un servicio aparte que usa la misma base y **nunca entra como propietario**. Dos caminos seguros: pedir las operaciones a la API (pasan por el registro de herramientas) o leer con un rol propio sujeto a RLS.
5. **Odoo como sistema aparte** solo si un cliente pide inventario, planilla o contabilidad completa: se conecta por API como módulo conector.

## Consecuencias
- Se toma de Odoo el manifiesto con dependencias, la anatomía fija de módulo, los permisos declarados, los dos puntos de entrada (API y trabajador) y el paquete regional.
- No se toma la herencia de modelos entre módulos ni los archivos gigantes.
