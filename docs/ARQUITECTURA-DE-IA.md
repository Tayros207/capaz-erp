# Arquitectura de IA y agentes de Capaz ERP

**Fecha:** 2026-11-11 · **Estado:** principios de diseño. No se construye en los cimientos; se activa con el corte de voz del Registro. Los cimientos (fases 4, 5 y 8 de `PLAN-DE-CONSTRUCCION.md`) ya dejan lo que esta arquitectura necesita.

## 1. Principio central

**El agente interpreta y propone; la herramienta valida y ejecuta; el usuario aprueba.** La IA puede equivocarse, así que la corrección nunca depende de ella: depende de las reglas de la herramienta y de la base.

```
Usuario (voz o texto)
      ↓
Agente: interpreta y elige una herramienta
      ↓
ejecutar(): argumentos reservados → módulo → permiso → esquema → reglas de negocio
      ↓
¿Crea o cambia dinero? → queda como BORRADOR o pide confirmación desde la pantalla
      ↓
Usuario autenticado aprueba → transacción → auditoría
```

Reglas que se derivan:
1. **El agente no tiene permisos propios.** Actúa con los del usuario al que representa, dentro de su empresa y de sus módulos.
2. **La aprobación la da una persona desde la pantalla.** Una confirmación que llega por el canal `agente` o `mcp` se rechaza (ya lo hace `ejecutar()`).
3. **Marcar una herramienta como «solo lectura» es una pista para el cliente, no una protección.** La protección está en el servidor: permisos, RLS y confirmación.
4. **El contexto no viaja en los argumentos.** Empresa, usuario y permisos los pone el servidor; si el modelo intenta colarlos, se rechaza y se audita.
5. **Lo que dicta el usuario y lo que viene de datos externos es contenido, no instrucciones.** Nunca cambia qué herramientas puede usar el agente.

## 2. Las cuatro piezas de un agente

Tomadas del modelo que describe Odoo para sus agentes (instrucciones, conocimiento, herramientas y disparadores), adaptadas a lo que ya existe en Capaz:

| Pieza | En Capaz | Dónde vive |
|---|---|---|
| **Instrucciones** | Qué hace el agente y qué no, en español, versionado en el repositorio | Manifiesto del agente, junto al módulo |
| **Conocimiento** | La ayuda obligatoria de cada herramienta, el glosario de la industria gráfica y los datos de la empresa leídos por herramientas de consulta | Registro de herramientas y `shared/semantica/` (después) |
| **Herramientas** | Las mismas herramientas registradas que usa la pantalla, filtradas por módulos activos y permisos del usuario | `core/herramientas` |
| **Disparadores** | Una petición del usuario, un evento de la tabla de salida o una hora programada | `core/eventos` |

Un agente es, entonces, **un dato declarado** (instrucciones, lista de herramientas permitidas y disparadores), no un programa aparte por módulo.

## 3. Orden de construcción

| Paso | Qué | Cuándo |
|---|---|---|
| 1 | Agente del Registro: convierte un dictado en un **borrador** de movimiento. Un solo proveedor de modelo | Corte de voz del Registro |
| 2 | Medición con audios reales: aciertos en monto, tipo, contacto y categoría, no solo en el texto transcrito | Antes de seguir |
| 3 | Registro de uso y costo por empresa (`core.uso`) con tope | Junto con el paso 1 |
| 4 | Agente que responde consultas («¿quién me debe?») solo con herramientas de lectura | Después del piloto |
| 5 | Servidor MCP para clientes externos: primero solo lectura, con autorización por usuario y revocable | Cuando un cliente lo pida |
| 6 | Agentes activados por eventos (por ejemplo, recordar una deuda vencida) | Cuando haya un caso concreto |
| 7 | Varios proveedores de modelo y selector | Cuando el costo o la calidad lo justifiquen |

## 4. Lo que no se hace

- Varios agentes coordinándose entre sí antes de que uno solo resuelva bien un proceso real.
- Agentes que escriben dinero sin borrador ni aprobación.
- Enviar a servicios de observación nombres, audios, montos o documentos sin ocultarlos.
- Guardar el audio por defecto (Ley 29733): se procesa y se descarta, salvo que la empresa lo active.

## 5. Nota sobre la fuente

El código de Odoo que tenemos descargado es la edición Community. Ahí **no** encontré las acciones de servidor con IA ni el servidor MCP que describe su documentación; sí encontré que cada modelo puede declarar una explicación en lenguaje natural (`_explanation`), la misma idea que nuestra ayuda obligatoria por herramienta. Lo demás de esta arquitectura se toma de su documentación como concepto, sin código de por medio.
