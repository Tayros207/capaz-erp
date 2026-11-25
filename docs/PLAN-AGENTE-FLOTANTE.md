# Plan: el agente flotante de Capaz (estilo daemon de Tairos)

**Fecha:** 2026-11-24 · **Para:** Moisés (decide) y Keny / sesiones de Claude (construyen) · **Estado:** investigación terminada y **verificada contra el código y fuentes oficiales el 2026-11-24**; nada construido.

**Qué cambió en la revisión del 2026-11-24.** Se comprobó cada punto que la versión anterior marcaba como «no comprobado». Cinco cosas del plan anterior eran incorrectas y están corregidas aquí:
1. No hay 338 herramientas: hay **303 de negocio** (117 de lectura, 154 normales, 32 críticas) y 18 de plataforma que el agente no toca.
2. El agente **no** recibe «pendiente de confirmación» en una herramienta crítica: el servidor le responde «solo desde la pantalla». La vía correcta es el **borrador**.
3. El catálogo no pesa ~90.000 tokens: medido, pesa **~61.500** (y ~41.500 limpiando el esquema).
4. Los modelos `deepseek-v4-pro` y `deepseek-v4-flash` existen, pero son versiones viejas de abril. Los vigentes son otros (§7B).
5. La marca «mueve dinero» no basta para decidir qué hace solo el agente: hay 33 herramientas que tocan dinero o precios sin llevarla (§6).

**Documentos hermanos (el detalle largo vive ahí):**
| Documento | Contiene |
|---|---|
| `docs/AGENTE-AUDITORIA-HERRAMIENTAS.md` | Las 186 herramientas de escritura, una por una, con su política |
| `docs/AGENTE-DISENO-TECNICO.md` | Tablas y SQL, contratos, eventos, bucle, seguridad, Vercel, panel |
| `docs/AGENTE-PROMPT-Y-EVALUACION.md` | El prompt completo y los 55 escenarios de evaluación |

**Marcas:** **verificado** = leído hoy en el código, en `node_modules` o en documentación oficial. **no verificado** = no se pudo comprobar; se dice por qué.

---

## 1. Resumen para Moisés

**Lo que pides:** un asistente con un icono flotante (como el de Tairos, un poco más grande) que pueda **ver** todo el software, **investigar**, **crear, editar, colocar y mover** cosas, e **identificar y analizar**, con **historial** de conversaciones y un **selector de modelo**. El modelo inicial es DeepSeek.

**Lo bueno:** Capaz ya tiene casi toda la base. Tiene **303 herramientas** registradas. Todas pasan por una sola puerta que ya sabe quién las llama (pantalla, agente o conexión externa), revisa permisos y deja auditoría. Eso es mejor que lo que tenía Tairos.

**Lo que falta:** cuatro piezas.
1. El **icono y el panel de conversación** en la web.
2. El **cerebro** (el programa que habla con el modelo de IA y usa las herramientas).
3. El **mapa del software**, para que el agente «vea» todo sin cargar las 303 herramientas en cada mensaje.
4. La **medición de uso y costo**, con tope.

**Qué se puede empezar hoy:** el icono y el panel (fase 1). No usa ningún modelo ni cuesta nada: desde el panel ya podrás dictar o escribir un movimiento y aprobarlo ahí mismo. El resto del cerebro también se puede construir y probar con un modelo «de mentira»; solo encenderlo con DeepSeek de verdad necesita tu llave y tus decisiones.

**Cuánto costaría (estimado, no medido):** con los precios de DeepSeek del 2026-11-24, un mensaje normal cuesta **menos de un centavo de dólar**. El modelo rápido sale unas diez veces más barato que el grande. El precio real depende de qué empresa atienda la consulta cuando se exige privacidad (§7B), por eso se medirá antes de darlo por bueno.

**Decisiones que son tuyas:**
| # | Decisión | Propuesta | Qué bloquea |
|---|---|---|---|
| D1 | ~~¿Autorizas un modelo de pago?~~ **Respondida: DeepSeek.** Falta elegir cuál de los dos y aceptar la condición de privacidad (§7B). | Empezar con el **rápido** (V4.1 Flash) y exigir «sin retención de datos». | Encender el cerebro (fase 2B) |
| D2 | ¿Qué hace el agente solo y qué pide aprobar? | La tabla de §6: 63 cosas las hace solo, 99 las deja para que apruebes, 24 no las toca. | Que el agente escriba (fase 3) |
| D3 | Tope mensual de gasto en IA por empresa. | US$ 5 al mes para empezar. | Encender el cerebro (fase 2B) |
| D4 | ¿Puede buscar en internet (precios de papel, proveedores)? | No por ahora. Cuesta US$ 0,007 por búsqueda. | Fase 6 |
| D5 | ¿Las conversaciones son **privadas de cada persona**? | Sí. Tú ves lo que el agente **hizo** (historial de la empresa), no lo que cada uno **preguntó**. | Nada: se construye así y se puede abrir después |
| D6 | ¿Cuánto tiempo se guardan las conversaciones? | 90 días, y cada persona puede borrar las suyas. | Nada: es un número que se cambia |
| D7 | ¿Un modelo **sin evaluar** corre solo en modo consulta? | Sí. Hasta pasar la prueba (§9) no puede crear ni mover nada. | Que el agente escriba (fase 3) |
| D8 (nueva) | ¿Se permite instalar un paquete de Vercel para que una respuesta termine de guardarse aunque cierres el celular? | No hace falta al principio: hay un plan sin él (§7). | Nada |

---

## 2. Qué es de verdad el «daemon» de Tairos

Un solo archivo de 3.564 líneas (`daemon/server.mjs`), sin dependencias (solo `node:http`). Hace esto en cada mensaje:

1. Recibe `{mensaje, organización, rol de quien habla}` y arma el **prompt del turno**: nombre de la empresa, zona horaria, moneda, identidad, decisiones vigentes, fecha y hora.
2. Llama a OpenRouter con la lista de herramientas, en **streaming**.
3. Si el modelo pide herramientas, las ejecuta (llamadas HTTP a la app), devuelve los resultados al modelo y repite, **máximo 6 rondas** (verificado: `MAX_TOOL_ROUNDS = 6`).
4. Responde por SSE: `text_delta`, `tool_start`, `tool_done`, `result`, `error`.
5. Guarda el hilo en la app (no en el daemon) y registra la conversación y el costo del turno.

**Lo que lo hace confiable** (esto es lo que vale la pena copiar):

| Mecanismo | Qué evita |
|---|---|
| Rol aplicado en 3 capas: catálogo, texto del prompt y ejecutor. Sin rol se asume el mínimo. | Que un colaborador obtenga saldos que no puede ver en pantalla. |
| El prompt **deriva** lo que «tiene conectado» de la configuración real, no de prosa escrita a mano. | Pasó de verdad: durante meses el agente afirmó escribir en Google Calendar y no podía. |
| Resultados recortados con marca `_recortado` y aviso. | Que el modelo diga «ese proyecto no existe» cuando la lista venía incompleta. |
| Instrucción «no calcules tú los números, el API ya los computa». | Cifras inventadas por el modelo. |
| Sección «CUANDO NO SEPAS»: distinguir lo leído, lo configurado y lo supuesto. | Diagnósticos inventados que suenan plausibles. |
| Dos temporizadores: espera de conexión (30 s) y silencio entre fragmentos (120 s). | Turnos colgados para siempre con el spinner girando. |
| Caché de prompt, costo y tokens por turno, tope de salida. | Factura invisible. |
| **Modo evaluación**: herramientas simuladas, 17 escenarios. | Elegir modelo «por lo que dice la prensa». Ojo: su propio documento admite que **nunca se corrió con modelos reales**. |
| Barrido de recordatorios cada 60 s. | Avisos que no suenan (por eso el daemon no puede apagarse). |

**Fly** (`daemon/fly.toml`): una máquina `shared-cpu-1x` de 512 MB, siempre encendida porque el SSE se corta si la máquina se suspende. Aprendieron dos cosas: cambiar `primary_region` **no** mueve la máquina ya creada, y Vercel no corría donde creían (lo midieron con `vercel inspect`).

### Cómo «ve todo el software» Tairos
- **Catálogo único** (79 capacidades): cada capacidad se declara una vez y de ahí salen lo que ofrece el agente, lo que ejecuta, el mapa del software y el servidor MCP.
- **Mapa** (`/api/agente/software`): rutas, permisos y capacidades. Se apoya en una prueba que **rompe la build** si alguien añade una ruta sin clasificarla.
- **Contexto de pantalla**: cada mensaje lleva una línea como «El usuario está en Finanzas, mirando la tarea MC-143». Es una **pista, nunca una autorización**, porque viene del navegador y se puede falsificar.

La regla de lo destructivo en Tairos: el agente puede hacer de todo, pero borrar o pisar sin vuelta atrás queda **propuesto** y lo firma un owner o admin.

### Cómo «coloca y mueve» Tairos
Algo lee una nota suelta, propone a dónde va (tarea, evento, proyecto…), la persona acepta con un clic y la nota queda enlazada a lo que creó. Solo se coloca sin preguntar si la confianza es ≥ 0,85 y el destino se deshace con un clic.

---

## 3. Qué tiene ya Capaz y qué falta

| Pieza | Estado en Capaz (verificado 2026-11-24) |
|---|---|
| Registro de herramientas con contrato, ayuda obligatoria, permisos, auditoría | **Hecho**: 303 de negocio + 18 de plataforma (`core/herramientas`) |
| Canal del que llama (`ui`, `agente`, `mcp`, `sistema`) | **Hecho** en el ejecutor. Solo existe la puerta de la pantalla (`POST /v1/herramientas/:nombre`). |
| Confirmación en dos pasos con token firmado (120 s) | **Hecho, solo para la pantalla.** Por el canal `agente`, una herramienta crítica responde `confirmacion_solo_ui` y **no** entrega ni resumen ni token (`ejecutor.ts:249`). El agente no puede aprobarse a sí mismo, pero tampoco puede «pedir» la confirmación: propone un borrador. |
| Borradores y bandeja (la «mesa de firma») | **Hecho** (`core/borradores`). Ya admite el origen `agente`. Aprobar un borrador de una herramienta crítica ya pide el segundo clic. |
| Los efectos en cadena pasan por la bandeja | **Hecho en el código**: confirmar un pedido o recibir una compra no mueve dinero; deja una propuesta (regla R5 de los consumidores). **Ojo:** esas propuestas las crea el «relevo» de eventos, y el relevo no arranca si `RELEVO_ACTIVO=false` (verificado en `relevo.ts`). La memoria del proyecto dice que en Vercel está en `false`: si es así, **en producción esas propuestas no aparecen hoy**. No es un problema del agente, pero lo hereda (ver §7 y §12). |
| Dictado que propone borradores | **Hecho** con reglas (`captura_proponer`), **solo para Finanzas** (`registro`). El modelo real no: hoy es `ModeloNulo`. |
| Contexto verificado por servidor (empresa, usuario, permisos, módulos) | **Hecho** |
| Pantallas con tableros y paleta Ctrl+K | **Hecho** |
| Bucle del agente, endpoint de streaming, cliente del modelo | **Falta** |
| Mapa del software para el agente | **Falta** |
| Icono flotante y panel | **Falta** |
| `core.uso` (uso y costo por empresa, con tope) | **Falta** (migración) |
| Historial de conversaciones por persona | **Falta** (dos tablas; §7A) |
| Selector de modelo por empresa | **Falta** (una tabla y dos herramientas; §7C) |
| Filtro «por canal» en el historial de la empresa | **Falta**: `auditoria_listar` no filtra por canal, así que hoy no se puede listar «lo que hizo el agente» |
| Banco de evaluación | **Falta** |

### El problema que Tairos no tenía: 303 herramientas
Medido el 2026-11-24 con un script sobre los contratos reales (estimación: caracteres ÷ 4):

| Qué se le manda al modelo en cada ronda | Tokens (≈) |
|---|---|
| Las 303 herramientas, tal cual | **61.500** |
| Las 303, con el esquema limpio | 41.500 |
| Solo las 117 de lectura (limpias) | 12.500 |
| Un conjunto pequeño por pantalla + 3 meta-herramientas | **3.000 a 8.000** |

Mandar todo es posible pero mala idea: un modelo sin evaluar elige peor entre 300 opciones, y si cambias a un modelo más caro con el selector, cada mensaje costaría decenas de veces más. Solución:

1. **Conjunto caliente** (8 de siempre + las del módulo de la pantalla), filtrado por los permisos de la persona, con tope de 8.000 tokens.
2. **Tres meta-herramientas internas** siempre disponibles: `software_mapa` (áreas y herramientas), `herramienta_describir(nombre)` y `herramienta_llamar(nombre, args)`, que pasa por el mismo ejecutor y la misma política.
3. Los esquemas salen de los contratos con `z.toJSONSchema` (verificado: los 303 convierten sin fallos), limpiando un patrón largo que Zod añade a cada fecha e identificador.

Así el agente «ve» las 303 sin pagarlas cada vez, y una herramienta nueva aparece sola.

---

## 4. El icono flotante

**Lo que hace Tairos** (`AgentDockLauncher.tsx`, verificado): botón redondo de 44 px abajo a la derecha, atajo Ctrl/⌘+J, motor cargado solo al primer clic, y en móvil una hoja que sube desde abajo.

**Propuesta para Capaz («un poco más grande»), con medidas propias:**
| | Tairos | Capaz |
|---|---|---|
| Botón | 44 px | **56 px** |
| Icono | 19 px | **24 px** |
| Escritorio | pegado a la esquina | un poco separado de la esquina |
| Móvil | sobre el borde inferior | **encima de la barra inferior** (la barra mide 56 px) |

**Cómo se abre:**
- **En el celular:** una hoja que sube y ocupa casi toda la pantalla. Se usa la hoja que Capaz ya tiene. *Corrección:* esa hoja no tiene los tres estados (cerrada, asomada, completa) ni el arrastre de Tairos; no se van a construir en la primera versión.
- **En la computadora:** un panel a la derecha que **no tapa ni bloquea** la pantalla, para que puedas seguir viendo el pedido del que hablas.

**Dónde se monta:** en la carcasa de la app, junto a la paleta y la barra inferior, solo cuando hay sesión y empresa. No se imprime.

**Micrófono:** el mismo del dictado actual. Lo que dices aparece en la caja y lo puedes corregir; **nunca se envía solo**. El audio no se guarda ni sale del navegador. Sigue sin funcionar en Firefox (es una limitación de ese navegador): ahí se escribe.

**No verificado:** que Ctrl+J se pueda usar. En Chrome y Firefox esa combinación abre las descargas. Si estorba, se cambia.

**Revisión visual que hará una persona:** que el botón no tape la última fila ni los botones de las pantallas en el celular (390 px), en claro y en oscuro.

---

## 5. Qué sabrá hacer, y con qué herramienta de Capaz

| Lo que pides | Cómo se logra (nombres reales, verificados) |
|---|---|
| **Ver** el software | `software_mapa` + la pantalla en la que estás (solo como pista) + las herramientas de lectura. |
| **Investigar** | `mi_dia_ver`, `clientes_buscar`, `pedidos_listar`, `deudas_listar`, `movimientos_listar`, `cotizaciones_listar`, `produccion_ordenes_listar`, `reportes_panel`, los `*_resumen` y `*_pendientes`. Internet queda fuera por ahora (D4). |
| **Crear** | `clientes_crear`, `pedido_crear`, `cotizacion_crear`, `oportunidad_crear` (directo). Lo que lleva dinero o número (`produccion_orden_crear`, `deuda_crear`, `movimiento_registrar`) queda como borrador. |
| **Editar** | `clientes_editar`, `pedido_editar`, `cotizacion_editar`, las del cuadro de costos sobre un borrador. |
| **Mover** | `oportunidad_mover`, `oportunidad_ganar`, `pedido_cambiar_estado`, `produccion_orden_estado`, `cotizacion_aceptar`. Pasar a **entregado** queda como borrador, porque es final y dispara el cobro. |
| **Colocar** | Lo que dictas o escribes suelto → `captura_proponer` → borrador en su sitio. Hoy solo entiende movimientos, deudas y pedidos; con el modelo, el agente elegirá la herramienta del módulo correcto y la propondrá. |
| **Identificar y analizar** | Lectura + razonamiento. **Regla copiada de Tairos:** el modelo no calcula cifras; las toma del sistema. Debe decir «no lo sé» y qué revisaría, en vez de enumerar causas. |

La lista completa por verbo está en `AGENTE-AUDITORIA-HERRAMIENTAS.md` §6.

---

## 6. Política de qué hace solo (propuesta para D2)

Principio de `ARQUITECTURA-DE-IA.md`: *«el agente propone, la herramienta valida, el usuario aprueba»*.

Se auditaron las 186 herramientas que cambian algo. Resultado:

| Qué hace el agente | Cuántas | Ejemplos |
|---|---|---|
| **Consulta directo** | 106 de las 117 de lectura | pedidos, deudas, clientes, resúmenes |
| **Lo hace solo** (queda anotado «hecho por el agente») | 63 | crear un cliente, abrir un pedido o una cotización **en borrador**, mover una oportunidad, pasar un pedido a «listo» |
| **Lo deja como borrador y tú apruebas** | 76 | cobrar, pagar, registrar un ingreso, confirmar un pedido, mover existencias, cambiar precios o tarifas, todo lo de personal |
| **Borrador + segundo clic de confirmación** | 23 (todas las críticas no prohibidas) | anular un movimiento, cancelar un pedido, emitir una cotización, fusionar clientes |
| **Nunca** | 24 | usuarios, roles e invitaciones; llaves y conexiones; reglas automáticas; datos fiscales de la empresa; cargas masivas; cambiar su propio modelo o su tope |

**Reglas de seguridad de esta política:**
- **Una herramienta nueva cae en «borrador»**, nunca en «lo hace solo».
- «Lo hace solo» **arranca apagado**. Se enciende por empresa cuando lo apruebes (D2) y el modelo haya pasado la prueba (D7). Mientras tanto, todo lo que no sea consulta sale como borrador.
- La decide el **servidor**, no el modelo. Aunque un texto malicioso convenza al modelo, no puede saltársela.
- El texto que describe un borrador lo escribe el servidor, no el modelo.

**Dos hallazgos de la auditoría que conviene que conozcas:**
- La marca «mueve dinero» la llevan solo **10** herramientas. Hay **33** más que tocan dinero, precios, costos o sueldos sin llevarla (por ejemplo crear o anular una deuda, anular un movimiento, confirmar un pedido, la lista de precios).
- Hay herramientas de **acceso** marcadas como «normales» (dar a alguien acceso a un módulo, anular una invitación). Por el canal del agente el servidor las ejecutaría sin preguntar. Por eso están en la lista de «nunca».

---

## 7. Arquitectura recomendada

**El cerebro vive dentro de la API Nest** (módulo `core/agente`), no como proceso aparte. Tairos necesita un daemon separado y un token compartido porque su app no sabe quién pregunta. En Capaz el contexto (empresa, persona, permisos, módulos) lo pone el servidor y el ejecutor es una llamada de función.

```
Navegador (icono + panel)
   │  POST /api/v1/agente/turno  (SSE)        ← sesión de la persona
   ▼
core/agente:
   0. ¿encendido? ¿bajo el tope del mes? ¿bajo el límite de ritmo?
   1. guarda el mensaje de la persona y abre el del agente como «en curso»
   2. prompt (empresa, módulos activos, moneda, hora de Lima, pantalla)
      + conjunto caliente + meta-herramientas  →  OpenRouter (streaming)
   3. por cada herramienta pedida: política → ejecutor (canal 'agente') o borrador
        ├─ lectura / directa   → resultado recortado con aviso → vuelve al modelo
        ├─ borrador            → queda en la bandeja → tarjeta en el panel
        └─ prohibida           → error al modelo, nada se ejecuta
   4. guarda la respuesta, registra uso y costo (core.uso)
```

**Verificado en el código:**
- NestJS 12 admite streaming por POST: `@Sse('turno', { method: RequestMethod.POST })`.
- `ejecutar()` abre su propia transacción: el bucle **no** mantiene ninguna conexión a la base mientras espera al modelo.
- El ejecutor rechaza y audita `empresaId`, `usuarioId`, `permisos` y `canal` si el modelo intenta mandarlos.

**Streaming en Vercel (verificado en su documentación el 2026-11-24):**
- Una función dura **300 s por defecto** con Fluid Compute, en el plan gratuito y en el de pago. Un turno se limita a 120 s: cabe.
- El streaming con `@Sse()` de NestJS está documentado y activo por defecto.
- Si el cliente se desconecta, Vercel **no** cancela la función salvo que se pida. Pero **no está documentado** que siga corriendo hasta terminar.

**Qué pasa si el celular pasa a segundo plano a mitad de una respuesta:**
1. Tu mensaje ya está guardado (se guarda antes de llamar al modelo).
2. La respuesta del agente existe desde el principio como «en curso», y cada cosa que hace se anota al momento.
3. El turno sigue por su cuenta aunque nadie lo mire. Si termina, queda guardado.
4. Al volver, el panel pregunta al servidor. Si terminó, la muestra. Si no, dice «La respuesta se interrumpió» y ofrece **Reintentar**.
5. Reintentar nunca repite algo que ya se hizo: si el turno cortado ya había creado o propuesto algo, se muestra eso y no se vuelve a ejecutar.

**No verificado:** que este proyecto tenga Fluid Compute activo y en qué plan está (se mira en el panel de Vercel); y que la ruta `/api/*` no retenga el flujo. Lo segundo se comprueba al desplegar con una ruta de prueba sin modelo (`/agente/latido`).

**Fly ya no es necesario para la primera versión.** El plan anterior lo proponía para los turnos largos y los barridos. Los turnos caben en Vercel. Para trabajo programado, Vercel tiene tareas programadas: una vez al día en el plan gratuito, cada minuto en el de pago.

**Pendiente que conviene resolver antes de la fase 3 (no es del agente, pero lo afecta):** con el relevo apagado en producción, cuando el agente (o una persona) confirma un pedido, entrega una orden o acepta una cotización, **la propuesta de deuda, de cobro o de pedido no llega a la bandeja**. Hoy no existe ninguna ruta ni tarea que procese los eventos fuera del relevo. La salida es una tarea programada de Vercel que llame a una ruta protegida para procesar un lote; es trabajo del núcleo de eventos y debe decidirlo el integrador (fase 7, o antes si se quiere que «mover» tenga efecto completo).

---

## 7A. Historial de conversaciones

### Qué aprendió Tairos
- **Fallo de privacidad real:** las conversaciones estaban protegidas solo por organización. Cualquier miembro podía leer los hilos de sus compañeros, incluido el del dueño. Se corrigió después con una política por persona.
- **Fallo de datos real:** un fallo de lectura se trataba como «conversación vacía» y el siguiente guardado **sobrescribía el hilo real**.
- **Idempotencia:** índice único por turno y rol para que reintentar no duplique.

### Cómo queda en Capaz
Detalle (Drizzle, SQL y pruebas) en `AGENTE-DISENO-TECNICO.md` §2.

| Tabla | Para qué |
|---|---|
| `core.agente_conversaciones` | La lista de cada persona: título, favorita, fechas |
| `core.agente_mensajes` | Cada mensaje, con su estado (`completo`, `en_curso`, `interrumpido`, `error`) y sus metadatos |
| `core.uso` | Tokens y costo de cada turno, para el tope y la insignia de uso |
| `core.agente_configuracion` | Modelo elegido, tope e interruptores de la empresa |

**Decisiones de diseño:**
1. **Privadas por persona, en la base y no solo en el código.** **Verificado:** `conEmpresa` fija `app.user_id` en cada transacción y `core.aplicar_aislamiento` solo crea la política por empresa. Se añade una segunda política **restrictiva** (`usuario_id = app.user_id`), que no es una función y por tanto no viola la regla 18. Es la **primera política por persona del repositorio**: lleva su propia prueba contra PostgreSQL real. No verificado: nadie la ha ejecutado todavía.
2. **Nadie puede colgar un mensaje en la conversación de otro:** la llave foránea incluye a la persona.
3. **Solo se agregan filas; el hilo completo nunca se reescribe.** Lo único que cambia es el estado y los metadatos del mensaje «en curso» del propio turno.
4. **Orden de guardado** (corrige al plan anterior): el mensaje de la persona **y** el del agente (como «en curso») se guardan al empezar. Así un turno cortado deja rastro de lo que alcanzó a hacer.
5. **No se guardan los resultados de las herramientas**, solo el nombre, si salió bien y los identificadores de lo creado o propuesto. Al reanudar, el modelo recibe los últimos 30 mensajes de texto y **vuelve a consultar**.
6. **El dueño ve lo que el agente hizo, no lo que cada persona preguntó** (D5). La auditoría ya guarda el canal. **Corrección:** hoy no se puede filtrar por canal en pantalla; falta añadir ese filtro a `auditoria_listar`.
7. **Las tarjetas viejas siguen sirviendo** (corrige al plan anterior). Un borrador vive en la bandeja hasta que se resuelve. Lo que vence a los 120 s es el token del segundo clic, y se pide de nuevo al pulsar. En el historial, cada tarjeta muestra su estado actual: pendiente, aprobada o descartada.
8. **Retención** (D6): cada persona borra las suyas; además, al abrir la lista se eliminan las propias de más de 90 días. No hace falta un proceso aparte.

**Lista de conversaciones:** agrupadas por Hoy, Ayer, Esta semana y Anteriores; favoritas arriba; renombrar, borrar, «Nueva conversación». Título: los primeros 55 caracteres del primer mensaje. En el celular es otra vista dentro de la misma hoja, con flecha para volver.

**Rutas** (verificado contra la regla 3): administrar las conversaciones propias no es una operación de negocio y va por rutas propias del módulo. **Cambiar el modelo o el tope sí lo es** y va como herramienta registrada, con permiso y auditoría (§7C).

---

## 7B. DeepSeek como modelo inicial

Datos consultados el 2026-11-24 en la lista pública de OpenRouter y en la documentación de OpenRouter y de DeepSeek.

| Modelo (id exacto) | Precio de lista, entrada / salida por millón | Contexto | Nota |
|---|---|---|---|
| `deepseek/deepseek-v4.1-flash-1017` | US$ 0,03 / 0,20 | 1.048.576 | El rápido vigente (octubre 2026). **Propuesto por defecto.** |
| `deepseek/deepseek-v4-pro-0813` | US$ 0,11 / 4,44 | 1.048.576 | El grande vigente (agosto 2026). |
| `deepseek/deepseek-v4-pro` | US$ 1,28 / 2,56 | 1.048.576 | **Es la versión de abril.** Diez veces más caro de entrada. No usar. |
| `deepseek/deepseek-v4-flash` | US$ 0,09 / 0,18 | 1.048.576 | **Es la versión de abril.** DeepSeek ya lo retiró de su API. No usar. |

**Verificado:**
- Todos admiten herramientas. `tool_choice: "required"` no lo admiten todos los proveedores: se usa solo `"auto"`.
- El precio de la lista es el de **un** proveedor, no un precio fijo. OpenRouter devuelve el costo real de cada respuesta (`usage.cost`), y eso es lo que se guarda.
- DeepSeek **cachea el prefijo solo**, sin marcas especiales. Las marcas `cache_control` del daemon de Tairos son de Anthropic y no se copian.
- **Privacidad:** la API propia de DeepSeek guarda los datos en China y los usa para entrenar (política del 2026-02-10). OpenRouter publica la lista de proveedores **sin retención**; DeepSeek directo, Baidu, Alibaba, StreamLake, SiliconFlow y Novita **no** están en ella. Con `provider: { zdr: true, data_collection: "deny" }` la consulta solo va a proveedores sin retención: quedan 44 de 53 para el modelo rápido y 15 de 22 para el grande.
- **Razonamiento:** DeepSeek exige que se le devuelva su razonamiento de **todos** los turnos anteriores cuando hay herramientas; si falta, responde con error. Por eso el agente arranca con el razonamiento **apagado** (`reasoning: { effort: "none" }`), que además es más barato y más rápido.

**No verificado:**
- Qué proveedor atenderá de verdad con «sin retención» y a qué precio. Se anota en la primera corrida real.
- Que los proveedores intermedios se comporten igual que DeepSeek con el razonamiento. Es un escenario de la evaluación.
- La calidad de DeepSeek con herramientas y con el español del taller. Nadie la ha medido: ni Tairos.

**Cambios respecto del daemon de Tairos:**
1. **Argumentos mal formados.** El daemon ejecuta la herramienta con argumentos vacíos (verificado, línea 3237). En Capaz **no se ejecuta nada** y el modelo recibe un error para reintentar.
2. **El uso llega siempre.** Los campos `usage: {include: true}` que manda el daemon están deprecados y no hacen falta.
3. **Modelo configurable** con lista permitida.
4. **Sin cabeceras con el nombre del producto.** No hacen falta.

**Sobre la privacidad (para Moisés):** exigir «sin retención» evita que los datos vayan a DeepSeek en China, pero siguen saliendo del Perú hacia el proveedor que atienda. Los nombres de clientes y los montos son datos personales y comerciales (Ley 29733). Conviene que quien lleve lo legal revise la transferencia al exterior antes de usar datos reales. No es una conclusión legal de este documento.

---

## 7C. Selector de modelo (copiado de Tairos)

Lo que hace Tairos (verificado en `modelos-agente.ts`, 264 líneas): un **catálogo curado** con nivel, descripción, bandera de privacidad y «evaluado sí/no»; precios consultados en vivo; la elección se guarda por organización y **no se cachea** (el siguiente mensaje ya usa el nuevo); solo propietario o administrador la cambia.

### Cómo queda en Capaz
- **Guardado:** `core.agente_configuracion`, una fila por empresa. No se toca la tabla de empresas.
- **Quién cambia:** quien tenga el permiso `empresa:configurar`, que **ya existe** en el núcleo (propietario y administrador). No hace falta un permiso nuevo. Los demás ven el selector con el aviso «Solo un propietario o administrador puede cambiarlo».
- **Cómo:** dos herramientas registradas, `agente_configuracion_ver` y `agente_configurar` (crítica: pide confirmación y queda auditada). El agente tiene **prohibido** llamar a la segunda.
- **Catálogo inicial** (ids verificados el 2026-11-24):

| Id | Nivel | Estado |
|---|---|---|
| `deepseek/deepseek-v4.1-flash-1017` | Económico (por defecto) | sin evaluar → solo consulta |
| `deepseek/deepseek-v4-pro-0813` | Equilibrado | sin evaluar → solo consulta |
| `anthropic/claude-haiku-5.5` (US$ 0,10 / 0,50) | Económico | sin evaluar |
| `anthropic/claude-sonnet-5.5` (US$ 2 / 10) | Recomendado en Tairos | sin evaluar aquí |
| `anthropic/claude-opus-5.5` (US$ 4 / 20) | Premium | sin evaluar |

- **«Sin evaluar» significa solo consulta** (D7). En Tairos es una etiqueta; aquí es una regla del servidor.
- **El costo por turno** no se copia de Tairos (su perfil sale de su prompt). Hasta medir uno propio, el selector muestra el precio por millón de tokens.
- **Qué no copiar:** el selector de esfuerzo y la ruta que le pregunta el modelo al daemon.
- **Insignia de uso** bajo cada respuesta: modelo, tokens, duración y costo.

---

## 8. Fases

| Fase | Qué | Migración | Archivos compartidos | Bloqueada por | ¿Se puede construir ya? |
|---|---|---|---|---|---|
| **1** | Icono, panel, atajo, pantalla como pista, micrófono y dictado con reglas. Historial vacío. | No | `carcasa.tsx`, `iconos.tsx` | Nada | **Sí, ahora** |
| **2A** | Cerebro de consulta con **modelo simulado**: tablas, catálogo, prompt, bucle, streaming, historial, selector | Sí (una; reclamar número) | `app.module.ts`, índices de esquema y de contratos, `config.ts`, `aislamiento-ejemplos.ts` | Visto bueno del integrador para la migración | **Sí**, sin llave y sin gasto |
| **2B** | Encender DeepSeek de verdad | No | Variables en Vercel | **D1 (cuál), D3, llave, revisión de privacidad** | No |
| **5** | Banco de evaluación con modelos reales | No | Ninguno | 2B y **orden de Moisés** (cuesta) | No |
| **3** | Escritura: borradores y tarjetas en el panel; «lo hace solo» apagado | No | `ejecutor.ts` (un método) | **D2, D7** y el modelo aprobado en la fase 5 | No |
| **4** | Encender «lo hace solo» por empresa y afinar el conjunto por pantalla | No | Ninguno | Fase 3 y uso real | No |
| **6** | Internet | No | Ninguno | **D4** | No |
| **7** | Tareas programadas (limpieza, relevo) y servidor MCP | No | `vercel.json` | Fases 2 y 3 | No |

La fase 5 va **antes** que la 3: sin evaluación no se abre la escritura.

**Reglas de coordinación entre sesiones** (de la memoria del proyecto): módulo autocontenido; reclamar el número de migración antes de `db:generar`; nunca registrar un contrato sin sus herramientas en el mismo paso; archivos compartidos solo con Edit puntual; nada se aplica a Neon sin orden.

---

## 9. Banco de evaluación

Detalle completo, con los 55 escenarios, en `AGENTE-PROMPT-Y-EVALUACION.md` §2.

- **Molde:** el de Tairos (herramientas simuladas, resultados guardados por fecha), pero usando el bucle, el prompt y el catálogo reales de Capaz.
- **Grupos:** Inyección (7), Permisos (5), Dinero (7), Argumentos (4), Herramientas (9), Honestidad (5), Voz (9), Conversación (4), Protocolo del modelo (5).
- **Para aprobar:** 100 % en Inyección, Permisos, Dinero y Argumentos; 85 % en el resto. Cada escenario se corre 3 veces.
- **Voz:** usa las frases que ya prueban las reglas del dictado («me pagó la señora Rosa 80 soles», «le compré a Comercial Pacheco unas cartulinas…»).
- **Datos:** solo nombres inventados que ya están en las pruebas del repositorio. Nunca datos reales.
- **Costo estimado (no medido):** céntimos de dólar con el modelo rápido; de uno a tres dólares con el grande.
- Mientras un modelo no pase, queda en **solo consulta**.

Además hay diez pruebas que **no** necesitan modelo y entran en `pnpm check` (privacidad del historial, reintentos, argumentos rotos, herramientas prohibidas, tope, ritmo).

---

## 10. Riesgos y lo que no se debe copiar

**No copiar de Tairos:** el daemon como proceso aparte con token compartido; la estructura de núcleos del SOO; el modelo fijo en el código; las herramientas escritas a mano; ejecutar con argumentos vacíos; las marcas de caché de Anthropic.

| Riesgo | Mitigación |
|---|---|
| Costo | Tope mensual por empresa, comprobado **antes** de cada turno; 6 rondas; 2.000 tokens de salida por ronda; 120 s por turno; 6 turnos por minuto por persona. Interruptor general. |
| DeepSeek falla con herramientas | Empieza en solo consulta; escritura solo tras la evaluación; argumentos rotos no se ejecutan. |
| Una persona lee las conversaciones de otra | Política por persona en la base + prueba de integración. |
| El agente hace algo con dinero por error | Política del servidor: dinero siempre a borrador. El resumen del borrador lo escribe el servidor. |
| Texto malicioso en un nombre, una nota o el motivo que escribe un cliente en el enlace público | La política es código, no prompt. El panel no pinta imágenes ni enlaces externos, así que no hay por dónde sacar datos. |
| El agente se da más poder | Usuarios, roles, llaves, reglas automáticas y su propia configuración están prohibidos. |
| El historial acumula datos personales | Sin resultados de herramientas; borrado por la persona; retención (D6). |
| Datos de clientes salen a un tercero (Ley 29733) | Solo proveedores sin retención; sin audio; sin exportaciones en bloque. Revisión legal pendiente. |
| El modelo inventa cifras o dice «hecho» sin estarlo | Regla de no calcular; `_recortado`; la insignia «hecho» la pone el servidor, no el texto del modelo. |
| La respuesta se corta en el celular | Diseño de §7: guardado al empezar, estado «en curso», reintento sin repetir. |
| Varias sesiones tocando el mismo árbol | Reglas de coordinación de §8 y §13. |

---

## 11. Reglas de `AGENTS.md` que condicionan este plan

| Regla | Efecto en el plan |
|---|---|
| **1**: versiones más nuevas que la memoria | **Hecho:** se leyó en `node_modules` la API de NestJS 12.4.2 (SSE), Zod 4.6.7 (`toJSONSchema`), React Router 8.5.1, Vitest 4.1.12 y Lucide 1.73. Los nombres exactos están en `AGENTE-DISENO-TECNICO.md` §1. |
| **2** y **16**: solo `infra/config` lee el entorno; secretos en `.env` | Siete variables nuevas, todas con valor por defecto, en `infra/config/config.ts`. |
| **3**: toda operación de negocio es una herramienta | **Corrección:** cambiar el modelo y el tope son herramientas (`agente_configurar`). El turno y las conversaciones propias no son operaciones de negocio y van por rutas del módulo. Proponer un borrador desde el agente usa `proponerBorrador`, igual que las reglas automáticas. |
| **4**: empresa y permisos solo de la sesión | La web manda la pantalla como pista (ruta, módulo, id); el servidor no confía en ella para autorizar nada. |
| **5**: aislamiento, llaves compuestas, índices por `tenant_id` | Las cuatro tablas lo cumplen. La política por persona se **suma** a `aplicar_aislamiento`, no la reemplaza. |
| **6**: nunca `drizzle-kit push` | `pnpm db:generar` + SQL de seguridad a mano. |
| **7**: `core` no importa de `modules` | `core/agente` solo conoce el registro y el ejecutor. Las listas de política son nombres en texto, como `HERRAMIENTAS_CON_SECRETOS`. |
| **8**: sin e2e | Todo con Vitest. La web se prueba sin DOM (lógica pura y HTML estático). |
| **9**: dinero en enteros | El costo se guarda en millonésimas de dólar (`bigint`). |
| **11**: 500 líneas por archivo, 50 por función | El módulo se divide en once archivos (§13). |
| **12**: no copiar cifras de diseño | Medidas propias. |
| **14**: sin modelos de pago sin orden | El proveedor nace `apagado`. Todas las pruebas usan el modelo simulado. Encender y evaluar exigen orden. |
| **15**: sin dependencias nuevas | Cero. OpenRouter por `fetch`. `@vercel/functions` queda como decisión D8. |
| **17**: móvil primero | Lista de revisión a 390 y 1280 px, claro y oscuro, en el cierre de cada fase web. |
| **18**: sin `security definer` | La política por persona es una política, no una función. |
| **20**: un solo catálogo de errores | No se añaden códigos: los motivos del turno viajan en el evento `error`. |

**Pendiente de coordinación:** este plan no está en la tabla de `AGENTS.md`, en `docs/RELEVO.md` ni en `docs/PLAN-PARALELO.md`. Son archivos compartidos y no se tocaron. El integrador debe darle un carril antes de lanzar la fase 2A.

---

## 12. Estado de verificación al 2026-11-24

**Verificado**
| Qué | Cómo |
|---|---|
| Conteo y metadatos de las 321 herramientas | Script de solo lectura con el analizador de TypeScript |
| Comportamiento del ejecutor con el canal `agente` | Lectura de `ejecutor.ts` y de sus pruebas |
| Receta de aislamiento y `app.user_id` | Lectura de `0000_cimientos.sql`, `con-empresa.ts`, las pruebas de catálogo y de aislamiento |
| Los efectos en cadena solo proponen borradores | Lectura de los tres archivos de consumidores |
| Peso del catálogo | Script de medición sobre los contratos compilados (caracteres ÷ 4) |
| Conversión de los 303 contratos a JSON Schema | El mismo script: 0 fallos |
| API de NestJS, Zod, React Router, Vitest, Lucide | Lectura de `node_modules` |
| Piezas web reutilizables | Lectura de `hoja-inferior.tsx`, `iconos.tsx`, la carcasa y `core/captura` |
| Límites y streaming de Vercel | Documentación oficial, consultada por un subagente el 2026-11-24 |
| Modelos, precios y reglas de OpenRouter y DeepSeek | Lista pública y documentación oficial, consultadas por un subagente el 2026-11-24 |
| Afirmaciones sobre Tairos (botón de 44 px, 6 rondas, argumentos vacíos, ids del catálogo) | Lectura de sus archivos |

**No verificado, y por qué**
| Qué | Motivo |
|---|---|
| **Nada se ejecutó**: ni el servidor, ni una migración, ni un modelo | Límite del encargo (solo lectura y medición) |
| La política por persona funcionando | No se aplicó ninguna migración; la demuestra su prueba de integración |
| La implementación de cada herramienta de escritura | Se leyó el nombre y la ayuda de las 186, y el código solo de las señaladas |
| Que ninguna herramienta de lectura escriba | El ejecutor no lo impide y no se leyó una por una |
| Plan de Vercel y Fluid Compute en este proyecto | Requiere entrar al panel de Vercel |
| Que la función siga viva tras desconectarse el cliente | La documentación no lo afirma |
| Que `/api/*` no retenga el flujo | Solo se ve desplegado |
| Proveedor y precio reales con «sin retención» | Requiere una llamada real |
| Razonamiento entre rondas con proveedores intermedios | Requiere una llamada real |
| Calidad de cualquier modelo con los casos del taller | Requiere la evaluación |
| Costo por turno | Requiere medir uso real |
| Ctrl+J | Requiere probar en el navegador |
| Cuánto tarda y cuánta memoria usa `pnpm check` en esta máquina | No se corrió (es pesado) |
| El nombre exacto del error de OpenRouter cuando ningún proveedor cumple | La documentación lista un 503; el texto 404 no aparece |
| Que en producción `RELEVO_ACTIVO` esté en `false` | Lo dice la memoria del proyecto; no se pueden leer las variables de Vercel desde aquí. En el código sí se verificó que con `false` el relevo no arranca y que no hay otra vía que procese eventos |

---

## 13. PLAN DE CONSTRUCCIÓN PARA SONNET

Para un agente que construye de punta a punta **sin decidir nada importante**. Si un paso no se puede cumplir como está escrito, **para y pregunta** (regla 5 de «Cómo trabajar»). Antes de empezar una fase lee: `AGENTS.md`, este documento y `AGENTE-DISENO-TECNICO.md`. Nada más.

### Estado de construcción (actualizado el 2026-11-24)

| Fase | Estado | Verificación |
|---|---|---|
| **1** · Icono y panel sin modelo | **Construida** | `VITEST_MAX_WORKERS=2 pnpm check` en verde (8 min) |
| **2A** · Cerebro de consulta con modelo simulado, historial y selector de modelo | **Construida** | `pnpm check` en verde (8 min 26 s; 1835 pruebas de integración). Tras una revisión adversarial de un modelo más potente se corrigieron 9 hallazgos |
| 2B · Encender DeepSeek | Bloqueada | Falta la llave, el tope (D3), la revisión de privacidad y medir el streaming en Vercel |
| 5 · Evaluación | Bloqueada | Cuesta dinero: orden expresa de Moisés |
| 3 · Escritura con borradores | Bloqueada | D2, D7 y un modelo aprobado en la fase 5. El método público `validar` del ejecutor (F3-T1) sigue sin hacerse |

**Pendiente de la revisión de la 2A** (anotado, no urgente con el asistente en solo consulta): purgar las conversaciones de quien deja la empresa (necesita una política explícita para el rol de sistema); un índice parcial por `(tenant_id, usuario_id) where estado = 'en_curso'` (va en una migración nueva, no se toca la 0039 ya probada); y estimar el costo cuando el proveedor no lo informa (hoy se guarda 0 y el tope no saltaría).

**No comprobado todavía:** la revisión visual (390 y 1280 px, claro y oscuro), Ctrl+J en Chrome y Firefox, que el streaming llegue entero a través de Vercel (`GET /api/v1/agente/latido` desplegado: los tres eventos deben llegar separados por un segundo), y el comportamiento con un modelo real. La migración 0039 **no está aplicada en Neon**.

### 13.1 Reglas de esta máquina (obligatorias)

La PC tiene 14 GB de RAM (unos 9,5 libres), 4 núcleos, y ya corren Firefox, VS Code, 2 o 3 sesiones de Claude y unos 6 contenedores.

1. **Un solo proceso pesado a la vez.** Nunca dos comandos de `pnpm` en paralelo.
2. **No levantes servidores** (`pnpm dev:api`, `pnpm dev:web`, `nest start`). La revisión visual la hace una persona.
3. **Sin worktrees, sin ramas, sin agentes en paralelo, sin `vercel build` local, sin Playwright ni pruebas de navegador.**
4. **No instales nada** (`pnpm add`, `pnpm install`).
5. **`pnpm check` solo al cerrar una fase.** Antes, avisa a las otras sesiones con SendMessage («voy a correr pnpm check, unos minutos») y comprueba que la base local está arriba: `docker ps` debe listar `capaz-erp-db-1`. Córrelo así, para no ocupar los 4 núcleos:
   ```bash
   VITEST_MAX_WORKERS=2 pnpm check
   ```
   (`VITEST_MAX_WORKERS` lo lee Vitest 4.1.12 y limita las pruebas UNITARIAS. **Ya no rige en las de integración** (2026-11-25): Vitest la aplicaba DESPUÉS de `fileParallelism: false` y la pisaba, así que `VITEST_MAX_WORKERS=2 pnpm check` corría dos archivos de integración a la vez sobre la misma base y el relevo de eventos —que es global— de uno se llevaba los eventos del otro: fallos al azar. `vitest.int.config.ts` la borra y `global-setup.ts` falla si Vitest resuelve más de un trabajador.)
6. **Verificación escalonada en cada tarea** (de lo más barato a lo más caro; para en cuanto algo falle):

   | Paso | Web | API | Shared |
   |---|---|---|---|
   | a. Pruebas del archivo | `pnpm --filter web exec vitest run <ruta> --maxWorkers=2` | `pnpm --filter api exec vitest run <ruta> --maxWorkers=2` | `pnpm --filter @capaz/shared exec vitest run <ruta>` |
   | b. Integración (un archivo) | — | `pnpm --filter api exec vitest run -c vitest.int.config.ts <ruta>` | — |
   | c. Lint de lo tocado | `pnpm --filter web exec oxlint <rutas>` | `pnpm --filter api exec oxlint --type-aware <rutas>` | — |
   | d. Tipos del paquete | `pnpm --filter web typecheck` | `pnpm --filter api typecheck` | `pnpm --filter @capaz/shared build` |

   Las rutas son relativas al paquete (por ejemplo `src/core/agente/logica-pantalla.spec.ts`). El paso **d** una vez por tarea, no por archivo. En la web usa `pnpm --filter web typecheck` (`tsc -b`), nunca `tsc --noEmit` (esconde errores).
7. **Orden que evita recompilar:** todo lo de `packages/shared` va **junto y primero** en su fase, se compila **una vez**, y después no se vuelve a tocar hasta la tarea que lo indique.
8. **Archivos compartidos:** solo con Edit puntual (nunca reescribir el archivo), y avisando antes por SendMessage: `packages/shared/src/index.ts`, `packages/shared/src/contratos/index.ts`, `apps/api/src/db/esquema/index.ts`, `apps/api/src/app.module.ts`, `apps/api/src/infra/config/config.ts`, `apps/api/src/infra/database/aislamiento-ejemplos.ts`, `apps/api/src/core/herramientas/ejecutor.ts`, `apps/web/src/app/carcasa/carcasa.tsx`, `apps/web/src/shared/ui/iconos.tsx`, `.env.example`.
9. **Nunca:** commits, `git` de escritura, tocar `.env`, aplicar algo a Neon, `drizzle-kit push`, editar una migración ya creada por otra sesión, editar `drizzle/meta/_journal.json` a mano, modificar `AGENTS.md`, `docs/RELEVO.md` o `docs/adr/*`.
10. **Nunca llames a un modelo real ni a OpenRouter.** Todas las pruebas usan `ModeloSimulado` y un `fetch` falso inyectado.
11. Archivos de menos de 500 líneas y funciones de menos de 50. Identificadores en español sin tildes; archivos en `kebab-case`; textos de pantalla en español.

### 13.2 FASE 1 · Icono y panel sin modelo — **LISTA PARA CONSTRUIR AHORA**

No toca `apps/api` ni `packages/shared`. Sin migración, sin llave, sin decisiones pendientes. Todo en `apps/web/src/core/agente/` salvo donde se indica. **No tocar:** `core/captura/*`, `core/bandeja/*`, `shared/ui/hoja-inferior.tsx`, `app/rutas.tsx`.

| # | Tarea | Bloquea |
|---|---|---|
| F1-T1 | Lógica de pantalla | — |
| F1-T2 | Iconos | — |
| F1-T3 | Lógica del hilo | — |
| F1-T4 | Lanzador | F1-T2 |
| F1-T5 | Caja de mensaje | F1-T2 |
| F1-T6 | Hilo, historial vacío y panel | T3, T4, T5 |
| F1-T7 | Montaje en la carcasa | T6 |
| F1-T8 | Cierre de fase | T7 |

**F1-T1 · Lógica de pantalla**
- Crear `logica-pantalla.ts` y `logica-pantalla.spec.ts`.
- Firmas:
  ```ts
  export const ENTIDADES_DE_PANTALLA = ['cliente','producto','pedido','orden_de_produccion','cotizacion','oportunidad','movimiento','deuda','borrador','guia'] as const;
  export type PantallaDelAgente = { ruta: string; modulo: string | null; entidad: { tipo: (typeof ENTIDADES_DE_PANTALLA)[number]; id: string } | null };
  export function pantallaDesdeRuta(pathname: string): PantallaDelAgente;
  ```
- Reglas: la tabla de `AGENTE-DISENO-TECNICO.md` §3. Un segmento solo cuenta como id si tiene forma de UUID. `ruta` se recorta a 200 caracteres y, si no cumple `^/[A-Za-z0-9/_.-]*$`, se devuelve `'/'`.
- Pruebas: una por fila de esa tabla; `/m/ordenes/tablero` → sin entidad; `/m/ordenes/<uuid>/proforma` → pedido; `/inicio` → módulo nulo; una ruta con `?` o espacios → `'/'`.
- Hecho cuando: `pnpm --filter web exec vitest run src/core/agente/logica-pantalla.spec.ts` pasa.

**F1-T2 · Iconos** (archivo compartido: avisa antes)
- Editar `apps/web/src/shared/ui/iconos.tsx`: añadir al `import` de `lucide-react` y al objeto `ICONOS` estas entradas, sin tocar las existentes: `asistente: Sparkles`, `microfono: Mic`, `enviar: ArrowUp`, `detener: Square`, `historial: History`, `nueva: SquarePen`, `atras: ArrowLeft`, `favorita: Star`, `borrar: Trash2`, `editar: Pencil`.
- Antes de editar, comprueba que ninguna de esas claves existe ya en el archivo.
- Hecho cuando: `pnpm --filter web typecheck` pasa.

**F1-T3 · Lógica del hilo**
- Crear `logica-hilo.ts` y `logica-hilo.spec.ts`. Lógica pura, sin React.
- Firmas:
  ```ts
  import type { CapturaPropuesta } from '@capaz/shared';
  export type Resolucion = 'aprobado' | 'descartado' | 'despues';
  export type ElementoDeHilo =
    | { id: string; tipo: 'persona'; texto: string }
    | { id: string; tipo: 'agente'; texto: string; estado: 'escribiendo' | 'completo' | 'error' | 'interrumpido' }
    | { id: string; tipo: 'borrador'; propuesta: CapturaPropuesta['borradores'][number]; resuelto: Resolucion | null }
    | { id: string; tipo: 'aviso'; tono: 'info' | 'aviso' | 'error'; texto: string; enlace?: { texto: string; ruta: string } };
  export type AccionDeHilo =
    | { tipo: 'persona_envia'; id: string; texto: string }
    | { tipo: 'captura_respondio'; id: string; propuesta: CapturaPropuesta }
    | { tipo: 'aviso'; id: string; tono: 'info' | 'aviso' | 'error'; texto: string; enlace?: { texto: string; ruta: string } }
    | { tipo: 'borrador_resuelto'; borradorId: string; resolucion: Resolucion }
    | { tipo: 'limpiar' };
  export function reducirHilo(hilo: readonly ElementoDeHilo[], a: AccionDeHilo): ElementoDeHilo[];
  export const SUGERENCIAS_INICIALES: readonly string[];   // «Ingreso 500 soles, cliente Juan Pérez, flyers» y dos más de dictado
  ```
- `captura_respondio`: un elemento `borrador` por cada propuesta; si no hay ninguna, un `aviso` con «No pude armar un registro con eso.», lo que falta (`faltan`) y la `pista`. Si hay propuestas **y** `faltan`, además un `aviso` «Revisa: …».
- Pruebas: cada acción; propuesta vacía; dos borradores; resolver uno no toca el otro; `limpiar` vacía.

**F1-T4 · Lanzador**
- Crear `lanzador-del-agente.tsx`, `logica-lanzador.ts`, `lanzador-del-agente.spec.tsx`.
- ```ts
  export function esAtajoDelAgente(e: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean }): boolean; // Ctrl o Cmd + J, sin Alt
  export function LanzadorDelAgente(p: { abierto: boolean; alAbrir: () => void }): ReactNode;   // `ReactNode` de 'react'; React 19 ya no trae el `JSX` global
  ```
- Medidas y clases: `AGENTE-DISENO-TECNICO.md` §9.2. Devuelve `null` si `abierto`. `aria-label="Abrir el asistente"`, `aria-haspopup="dialog"`, `aria-expanded={abierto}`, `title="Asistente (Ctrl+J)"`. Usa `Icono nombre="asistente"` con `className="size-6"`.
- Pruebas (`renderToStaticMarkup`): contiene el `aria-label`, `size-14` y `print:hidden`; con `abierto` no pinta nada; `esAtajoDelAgente` acepta Ctrl+J y Cmd+J, rechaza J sola y Ctrl+Alt+J.

**F1-T5 · Caja de mensaje**
- Crear `caja-de-mensaje.tsx`, `logica-caja.ts`, `caja-de-mensaje.spec.tsx`.
- El reconocedor entra **por props** (así se puede probar sin navegador):
  ```ts
  import type { ReconocedorDeVoz } from '../captura/reconocedor.ts';
  export function CajaDeMensaje(p: { valor: string; alCambiar: (v: string) => void; alEnviar: () => void; alAlternarVoz: () => void;
    voz: ReconocedorDeVoz; ocupado: boolean; maximo: number; marcador: string }): ReactNode;
  export function teclaDeEnvio(e: { key: string; shiftKey: boolean; isComposing?: boolean }): 'enviar' | 'salto' | null;
  ```
- Enter envía; Mayús+Enter salta de línea; durante composición de texto (`isComposing`) no envía. El micrófono no se pinta si `voz.estado` es `no_disponible` o `sin_contexto_seguro`; muestra `voz.aviso` con `role="status"`. Mientras escucha, el botón lleva `aria-pressed="true"` y la variante `peligro`. Botón enviar deshabilitado con texto vacío o `ocupado`. Contador «N de `maximo`».
- En la fase 1 `maximo` es `MAXIMO_DE_TEXTO_DE_CAPTURA` (500), exportado por `@capaz/shared`.
- Pruebas: `teclaDeEnvio`; sin voz no hay botón de micrófono; con `ocupado` el botón de enviar sale `disabled`.

**F1-T6 · Hilo, historial vacío y panel**
- Crear `hilo.tsx`, `vista-de-historial.tsx`, `panel-del-agente.tsx`, sus `.spec.tsx`, y `apps/web/src/shared/ui/use-ancho.ts` (hook `useEsAncho(): boolean` con `matchMedia('(min-width: 48rem)')`; devuelve `false` si no hay `window`).
- `Hilo`: `role="log"`, `aria-live="polite"`. Pinta cada `ElementoDeHilo`; los `borrador` sin resolver con `TarjetaDeBorrador` (importada de `../captura/tarjeta-de-borrador.tsx`), los resueltos como una línea («Aprobado», «Descartado», «Queda en la bandeja»). El texto se pinta **como texto**, nunca con `dangerouslySetInnerHTML`.
- `VistaDeHistorial`: en la fase 1 solo el estado vacío («Aquí aparecerán tus conversaciones cuando el asistente esté activo.») con `EstadoVacio` de `shared/ui/estado-vacio.tsx`, y un botón para volver.
- Crear también `logica-panel.ts` con `export function puedeDictar(yo: Yo): boolean` (verdadero si `yo.permisos` incluye `borradores:ver` **y** el módulo `registro` tiene `acceso.puedeEntrar` y `acceso.puedeEscribir`; la forma está en `packages/shared/src/yo.ts` y `modulos.ts`) y su prueba.
- `PanelDelAgente(p: { abierto: boolean; alCerrar: () => void; migas: string[]; puedeDictar: boolean })`. **No uses `useYo()` dentro del panel:** depende del enrutador y no se puede pintar en una prueba estática; el dato entra por props desde la carcasa.
  - Cabecera: «Asistente», la pista de pantalla (`migas.join(' › ')`, si hay), botones «Nueva conversación» (`limpiar`), «Historial» y «Cerrar».
  - Con `useEsAncho()` verdadero, el panel no modal de §9.2; si no, `HojaInferior` con `alta` y `titulo="Asistente"`.
  - Aviso fijo de la fase 1 (§9.3, estado «Sin IA»).
  - Si `puedeDictar` es falso, en lugar de la caja muestra: «Tu usuario no puede registrar por dictado. Pide acceso a Finanzas a tu administrador.»
  - Al enviar: (1) si `destinoSiEsPreguntaDePrecio(texto)` devuelve una ruta, añade un `aviso` con el enlace «Ver precio anterior» y **no** llama al servidor; (2) si no, `proponerCaptura({ texto, origen, transcurridoMs, modulo: 'registro' })` y despacha `captura_respondio` o un `aviso` de error con `mensajeDeErrorDeCaptura`. Copia de `core/captura/pantalla-dictado.tsx` la forma de medir `transcurridoMs` y de decidir `origen`; no modifiques ese archivo.
  - Tras proponer y tras resolver una tarjeta: `useQueryClient().invalidateQueries({ queryKey: CLAVE_BANDEJA })` (de `core/bandeja/claves.ts`).
  - Escape: si la voz está escuchando, la detiene; si no, cierra.
- Pruebas (HTML estático de `Hilo` y `VistaDeHistorial`; el panel entero no se pinta en pruebas porque usa consultas): hilo vacío muestra las sugerencias; un `aviso` de error lleva `role="alert"`; un texto con `<img src=x>` sale escapado; la vista de historial muestra su estado vacío; `puedeDictar` con y sin permiso, y con `registro` en solo lectura.
- Hecho cuando: las pruebas de la carpeta pasan y `pnpm --filter web typecheck` pasa.

**F1-T7 · Montaje en la carcasa** (archivo compartido: avisa antes)
- Editar `apps/web/src/app/carcasa/carcasa.tsx` con Edit puntual:
  - `const [agente, setAgente] = useState(false); const [agenteCargado, setAgenteCargado] = useState(false);`
  - En el `alTeclear` que ya existe, una rama más: `if (esAtajoDelAgente(e)) { e.preventDefault(); setAgente((a) => !a); setAgenteCargado(true); }`.
  - Después de `<BarraInferior … />`: el lanzador y, solo si `agenteCargado`, el panel cargado con `lazy(() => import('../../core/agente/panel-del-agente.tsx').then((m) => ({ default: m.PanelDelAgente })))` dentro de `<Suspense fallback={null}>`.
  - `migas` = el mismo `migasDeRuta(menu, pathname)` que ya recibe `BarraSuperior`. `puedeDictar` = `puedeDictar(yo)` (la carcasa ya tiene `yo`).
- No cambies nada más del archivo. Debe seguir bajo 500 líneas (hoy tiene 89).
- Hecho cuando: `pnpm --filter web typecheck` y `pnpm --filter web exec oxlint src/app/carcasa src/core/agente` pasan.

**F1-T8 · Cierre de la fase 1**
1. `pnpm --filter web exec vitest run src/core/agente --maxWorkers=2`
2. `pnpm --filter web typecheck`
3. `VITEST_MAX_WORKERS=2 pnpm check` (avisando antes)
4. `pnpm check:carga` **solo si el integrador lo pide** (construye la web entera; mide el presupuesto de carga).
5. `graphify update .` (lo pide `CLAUDE.md`; solo analiza el código, sin costo).
6. Informe con el formato de §13.7.

Revisión visual pendiente para una persona (no la marques como hecha): botón y panel a **390 y 1280 px, en claro y en oscuro**; que el botón no tape acciones al final de Pedidos, Bandeja y Finanzas en el celular; que Ctrl+J abra el panel en Chrome y en Firefox; dictar «Ingreso 500 soles, cliente Juan Pérez, flyers» y aprobar la tarjeta; imprimir una proforma y comprobar que el botón no sale.

### 13.3 FASE 2A · Cerebro de consulta con modelo simulado — **se puede construir ya**

No necesita llave ni decisiones de Moisés: usa las propuestas de D5 (privadas) y D6 (90 días) y deja el proveedor `apagado`. **Necesita** que el integrador le asigne carril y que nadie más esté generando una migración. Todo el servidor en `apps/api/src/core/agente/`. **No tocar:** `core/herramientas/*` (en esta fase), `core/captura/*`, `core/borradores/*`, ningún `modules/*`.

Orden fijo (primero todo lo compartido, una sola compilación de `shared`):

| # | Tarea | Archivos (crear, salvo «editar») | Firmas y reglas | Pruebas y comando |
|---|---|---|---|---|
| F2-T1 | Contrato web↔API y contrato de las dos herramientas de configuración | `packages/shared/src/agente.ts`, `agente.spec.ts`; `packages/shared/src/contratos/agente.ts`; **editar** `packages/shared/src/index.ts` (una línea `export * from './agente.js'`). **No registres todavía** `contratosDeAgente` en `contratos/index.ts`: eso va en F2-T12. | Esquemas de `AGENTE-DISENO-TECNICO.md` §3 y §3.1 (`pantallaDelAgenteSchema`, `turnoDelAgenteSchema`, `eventoDelAgenteSchema`, `conversacionDelAgenteSchema`, `mensajeDelAgenteSchema`, `estadoDelAgenteSchema`). Define aquí `ENTIDADES_DE_PANTALLA` y `MODOS_DE_ESCRITURA = ['ninguna','borradores','directa']` con su tipo `ModoDeEscritura` (lo usan F2-T4 y F2-T5). | Esquemas aceptan y rechazan lo esperado (ruta con `?`, id que no es UUID, mensaje de 4.001 caracteres). `pnpm --filter @capaz/shared exec vitest run src/agente.spec.ts` y luego `pnpm --filter @capaz/shared build` |
| F2-T2 | Configuración | **editar** `apps/api/src/infra/config/config.ts`, `config.spec.ts`, `.env.example` | Las 7 variables de §10 del diseño, todas con valor por defecto. Validación cruzada sobre el objeto (lee antes en `node_modules/zod` cómo se declara en Zod 4.6 y comprueba que `Config` y `leerConfig` siguen compilando): `simulado` inválido si `NODE_ENV = production`; `openrouter` exige `OPENROUTER_API_KEY`. | `pnpm --filter api exec vitest run src/infra/config/config.spec.ts` |
| F2-T3 | Datos | `apps/api/src/db/esquema/core-agente.ts`; **editar** `db/esquema/index.ts` (una línea) y `infra/database/aislamiento-ejemplos.ts` (cuatro entradas); migración generada; `core/agente/privacidad.int.spec.ts` | Pasos exactos abajo. | `pnpm --filter api exec vitest run -c vitest.int.config.ts src/core/agente/privacidad.int.spec.ts`, luego lo mismo con `src/infra/database/aislamiento.int.spec.ts` y `src/infra/database/catalogo.int.spec.ts` |
| F2-T4 | Esquema limpio y catálogo del turno | `esquema-limpio.ts`, `catalogo-del-turno.ts`, sus `.spec.ts` | `esquemaLimpio(entrada: z.ZodType): object` (§1.2); `catalogoDelTurno(p: { herramientas: readonly HerramientaRegistrada[]; ctx: ContextoDeHerramienta; pantalla: PantallaDelAgente \| null; modo: ModoDeEscritura }): { tools: unknown[]; nombres: string[] }` (§4.1). `tokensEstimados(x) = Math.ceil(JSON.stringify(x).length / 4)`. | Sin `pattern` cuando hay `format`; `origen` oculto en las tres herramientas; una herramienta sin permiso no aparece; el resultado pesa menos de 8.000; el orden es estable entre dos llamadas |
| F2-T5 | Política | `politica.ts`, `politica.spec.ts` | `politicaDe(h, args, modo)` y las listas `PROHIBIDAS`, `DIRECTAS`, `LECTURAS_EXCLUIDAS` copiadas de `AGENTE-AUDITORIA-HERRAMIENTAS.md` (§7 del diseño). En esta fase `modo` siempre es `ninguna`. | Una prueba por regla; una herramienta desconocida de escritura → `borrador`; con `ninguna` solo pasan lecturas y `captura_proponer` |
| F2-T6 | Recorte | `recorte.ts`, `recorte.spec.ts` | `recortar(respuesta: Respuesta<unknown>, maximo = 6000): string` (§6.1) | Lista larga → `_recortado` con `mostrados` y `total`; rechazo → `{ok:false,error}`; nunca pasa del máximo |
| F2-T7 | Cliente del modelo | `modelo-de-chat.ts` (tipos y símbolo `MODELO_DE_CHAT`), `leer-sse.ts`, `modelo-simulado.ts`, `modelo-de-openrouter.ts`, sus `.spec.ts` | Interfaz de §5. `ModeloSimulado.programar(rondas: TrozoDeModelo[][])`. `ModeloDeOpenRouter` recibe `fetch` por constructor. `leerSse(cuerpo: ReadableStream<Uint8Array>): AsyncIterable<string>` salta las líneas que empiezan por `:`. | Con un `fetch` falso: fragmentos de `tool_calls` unidos por `index`; error a mitad de flujo con HTTP 200; uso leído del último trozo; `costoMicrousd` entero; aborta a los 30 s sin conexión (relojes falsos de Vitest). **Ninguna prueba sale a la red.** |
| F2-T8 | Prompt | `prompt.ts`, `prompt.spec.ts` | `armarPrompt(d): { fijo: string; variable: string }`. Texto exacto en `AGENTE-PROMPT-Y-EVALUACION.md` §1. | Las 8 pruebas de su §1.5 |
| F2-T9 | Repositorio | `repositorio.ts`, `repositorio.int.spec.ts` | Funciones que reciben `tx: Transaccion`: `abrirTurno`, `anotarEnMetadatos`, `cerrarTurno`, `historialParaElModelo`, `listarConversaciones`, `verConversacion`, `renombrar`, `marcarFavorita`, `borrarConversacion`, `gastoDelMes`, `turnosRecientes`, `registrarUso`, `leerConfiguracion`. `tenant_id` y `usuario_id` salen de `current_setting(...)`, como en `core/borradores/proponer.ts`. | Reintento con el mismo `turnoId` no duplica; borrar elimina mensajes y conversación; la lista borra las de más de N días; `gastoDelMes` suma solo el mes en curso en la zona de la empresa |
| F2-T10 | Bucle y meta-herramientas | `meta-herramientas.ts`, `bucle.ts`, sus `.spec.ts` | `correrTurno(dep, entrada): Promise<ResultadoDeTurno>`, con todo inyectado (`modelo`, `ejecutar`, `registro`, `emitir`, `reloj`). Pasos 3a–3d de §6 del diseño. | Con `ModeloSimulado` y un ejecutor falso: saludo sin herramientas; una lectura; argumentos rotos no ejecutan nada; herramienta prohibida no llega al ejecutor ni por `herramienta_llamar`; corte en la ronda 6; `software_mapa` solo lista lo accesible |
| F2-T11 | Servicio, controlador y módulo | `servicio-de-turnos.ts`, `agente.controller.ts`, `agente.module.ts`, `agente.int.spec.ts`; **editar** `apps/api/src/app.module.ts` (un import y una línea en `imports`, después de `CapturaModule`) | Rutas de §3.2 (menos las de configuración). `@Sse('turno', { method: RequestMethod.POST })` devuelve el `Observable` de un `Subject`; `correr()` **no** se espera. Latido cada 15 s. Comprobación de `Origin`. El proveedor `MODELO_DE_CHAT` se elige por `config.AGENTE_PROVEEDOR`. | Con `AGENTE_PROVEEDOR=simulado` puesto **antes** de `levantarApp()`: un turno completo deja dos mensajes y una fila en `core.uso`; con el tope en 0 el modelo no se llama; el séptimo turno del minuto se rechaza; otra persona no puede leer la conversación por HTTP. Si el cliente de pruebas no entrega el cuerpo en crudo, prueba el servicio con `app.obtener(ServicioDeTurnos)` y **no modifiques** `pruebas/app-de-pruebas.ts` |
| F2-T12 | Selector de modelo | `modelos.ts`, `modelos.spec.ts`, `herramientas-de-agente.ts`, `ayudas.ts`, `configuracion.int.spec.ts`; **editar** `packages/shared/src/contratos/index.ts` | **En un solo paso, avisando antes:** registra `contratosDeAgente` en `contratos/index.ts`, compila `shared` y deja registradas `agente_configuracion_ver` y `agente_configurar` en `AgenteModule`. Catálogo de §7C. Precios en vivo con caché de 1 hora, **solo aciertos**, con `fetch` inyectado. `agente_configurar` es `critica` y define `resumir`. Añade `agente_configurar` a `PROHIBIDAS`. | Un modelo fuera del catálogo se rechaza; un miembro sin `empresa:configurar` recibe `sin_permiso`; por el canal `agente` responde `confirmacion_solo_ui`. La propia `configuracion.int.spec.ts` levanta la app: si el contrato y sus herramientas no cuadran, el registro no arranca y la prueba falla (esa es la comprobación) |
| F2-T13 | Web: transporte | `apps/web/src/core/agente/transporte-sse.ts`, `logica-turno.ts`, sus `.spec.ts` | `enviarTurno(cuerpo, alEvento, senal): Promise<'fin' \| 'error' \| 'cortado'>` con `fetch` y lector del cuerpo. Reductor que convierte eventos en `ElementoDeHilo`. Recuperación de §6.2, puntos 4 y 5. De paso, `logica-pantalla.ts` deja de declarar `ENTIDADES_DE_PANTALLA` y la importa de `@capaz/shared`. | Analizador de SSE con trozos partidos a mitad de línea; flujo que se corta sin `fin` → `'cortado'`; reintento con el mismo `turnoId` |
| F2-T14 | Web: panel conectado | **editar** `panel-del-agente.tsx`, `hilo.tsx`, `vista-de-historial.tsx`; crear `insignia-de-uso.tsx`, `selector-de-modelo.tsx`, `api.ts`, `logica-historial.ts` | `GET /agente/estado` decide el modo: `activo = false` → comportamiento de la fase 1 intacto. Grupos Hoy / Ayer / Esta semana / Anteriores (función pura con la fecha inyectada). | Agrupación por fechas; estados de §9.3; el selector deshabilitado sin permiso |
| F2-T15 | Cierre | — | — | `VITEST_MAX_WORKERS=2 pnpm check`, `graphify update .`, informe |

**F2-T3 paso a paso (migración; léelo entero antes de empezar):**
1. Mira el último número: `ls apps/api/drizzle/*.sql | tail -1` (hoy `0038`).
2. SendMessage a las demás sesiones: «reclamo 0039 para core.agente (4 tablas en core, sin tocar otras)». Espera un minuto. Si alguien responde que la tiene, toma la siguiente y repite.
3. Crea `core-agente.ts` con el Drizzle de §2.1 y añade su línea en `db/esquema/index.ts`.
4. `pnpm db:generar --name=agente`. **Revisa** el SQL generado: solo debe crear las cuatro tablas. Si incluye cambios de otras tablas, **para y pregunta** (otra sesión tiene esquema sin migrar).
5. Pega al final del archivo generado el SQL de seguridad de §2.2, con sus `--> statement-breakpoint`.
6. Añade las cuatro entradas de §2.3 a `aislamiento-ejemplos.ts`, en ese orden.
7. Escribe `privacidad.int.spec.ts` (§2.4).
8. Corre las tres pruebas de integración de la tabla. Migran solas la base local de pruebas.
9. SendMessage: «0039 lista».
10. **No** corras `pnpm db:migrar` contra otra base ni nada contra Neon.

### 13.4 FASE 2B · Encender DeepSeek — **bloqueada**: D1 (cuál), D3, llave y revisión de privacidad

La hace una persona con el constructor al lado. No hay código nuevo.
1. Keny carga en Vercel `AGENTE_PROVEEDOR=openrouter`, `OPENROUTER_API_KEY`, `AGENTE_MODELO` y `AGENTE_TOPE_MENSUAL_USD`. El constructor **no** ve ni escribe la llave.
2. Con el código de la fase 2A ya desplegado y el proveedor aún `apagado`: abrir `/api/v1/agente/latido` con sesión iniciada y comprobar que los tres eventos llegan **separados por un segundo**. Si llegan juntos, hay retención del flujo: parar y avisar.
3. Mirar en el panel de Vercel el plan y que Fluid Compute está activo. Anotarlo en §12.
4. Encender. Primera conversación con datos de práctica. Anotar proveedor, tokens, caché y costo reales en §12.

### 13.5 FASE 5 · Evaluación — **bloqueada**: fase 2B y orden expresa de Moisés (cuesta dinero)

| # | Tarea | Archivos | Hecho cuando |
|---|---|---|---|
| F5-T1 | Corredor y escenarios | `apps/api/vitest.eval.config.ts`, `core/agente/evaluacion/escenarios.ts`, `ejecutor-de-ejemplo.ts`, `evaluacion.eval.ts` | Con el proveedor `simulado`, los escenarios A1–A4 pasan: `pnpm --filter api exec vitest run -c vitest.eval.config.ts --maxWorkers=1` |
| F5-T2 | Corrida real | Resultado en `docs/evaluaciones/AAAA-MM-DD-<modelo>.md` | Solo con orden. El orden es el de `AGENTE-PROMPT-Y-EVALUACION.md` §2.4 |
| F5-T3 | Anotar | `core/agente/modelos.ts`: `evaluado: true` con la fecha, solo si pasó | — |

Los escenarios están escritos uno por uno en `AGENTE-PROMPT-Y-EVALUACION.md` §2.3. `*.eval.ts` no entra en `pnpm check`.

### 13.6 FASE 3 · Escritura con borradores — **bloqueada**: D2, D7 y un modelo aprobado en la fase 5

| # | Tarea | Archivos | Reglas | Pruebas |
|---|---|---|---|---|
| F3-T1 | `validar` en el ejecutor (archivo compartido: avisa antes) | **editar** `core/herramientas/ejecutor.ts` | Añade solo un método público que envuelve al privado `comprobar`, sin cambiar nada más: `validar(nombre: string, args: unknown, ctx: ContextoDeHerramienta): { ok: true; herramienta: HerramientaRegistrada; datos: unknown } \| { ok: false; respuesta: Respuesta<unknown> }`. No audita ni toca la base. | En `ejecutor.int.spec.ts`: acepta argumentos válidos; rechaza argumento reservado, módulo sin acceso, permiso faltante y esquema inválido con el mismo código que `ejecutar()` |
| F3-T2 | Política completa | **editar** `politica.ts`; crear `politica.int.spec.ts` | Activa los modos `borradores` y `directa`. | La prueba de integración levanta la app, lee `RegistroDeHerramientas.todas()` y falla si `PROHIBIDAS` o `DIRECTAS` nombran algo que no existe, o si alguna `critica` o con `mueveDinero` resulta `directo` |
| F3-T3 | Proponer y ejecutar en el bucle | **editar** `bucle.ts`; crear `proponer-desde-agente.ts` | §7.1 del diseño. Clave de idempotencia `${turnoId}:${ronda}:${indice}`. `anotarEnMetadatos` **inmediato** tras cada escritura o propuesta. Eventos `accion` y `borrador`. | Una herramienta de dinero deja un borrador con `origen = 'agente'` y **no** un movimiento; una crítica deja borrador; argumentos inválidos no proponen nada; un turno cortado con acciones no se repite al reintentar |
| F3-T4 | Tarjetas en el panel y en el historial | **editar** `logica-turno.ts`, `hilo.tsx` | El evento `borrador` se pinta con `TarjetaDeBorrador`. Al abrir una conversación vieja, el estado de cada borrador se lee con `borrador_ver`. | Reductor con `accion` y `borrador`; estados pendiente, aprobado y descartado |
| F3-T5 | Filtro por canal en el historial de la empresa (opcional; contrato compartido) | `packages/shared/src/contratos/auditoria.ts` y su herramienta | Argumento opcional `canal`. Coordinar con quien lleve el área de auditoría. | — |
| F3-T6 | Cierre | — | — | `VITEST_MAX_WORKERS=2 pnpm check`, `graphify update .`, informe |

La fase 4 (encender «lo hace solo») no es código: es poner `escritura_directa = true` en una empresa con `agente_configurar`, después de dos semanas de uso con borradores y con el visto bueno de Moisés.

### 13.7 Informe de cierre (una vez por fase; formato de `AGENTS.md`)

Copia esta plantilla y complétala. No marques como hecho lo que no comprobaste.

```markdown
## Cierre de la fase <N> del agente flotante · <fecha>

**Qué se hizo**
- <archivo creado o editado> — <una línea>

**Qué se verificó (comando y resultado)**
- `VITEST_MAX_WORKERS=2 pnpm check` → <pegar las últimas líneas: archivos y pruebas pasadas>
- <cada comando escalonado que corriste y su resultado>

**Qué no se hizo y por qué**
- <tarea> — <motivo>

**Desviaciones respecto del plan**
- <qué cambió y por qué; «ninguna» si no hubo>

**Revisión visual pendiente (la hace una persona)**
- [ ] 390 px, tema claro
- [ ] 390 px, tema oscuro
- [ ] 1280 px, tema claro
- [ ] 1280 px, tema oscuro
- [ ] <lo específico de la fase>

**Qué necesita el usuario**
- <decisiones D1–D8 que siguen abiertas y qué bloquean>
- Commit: no se hizo; espera tu orden.
- Neon: no se aplicó nada. <Si la fase trae migración: «falta aplicar 00NN; procedimiento en docs/NEON-MIGRACION.md».>
```

Lista de comprobación por fase, además de la plantilla:

| | Fase 1 | Fase 2A | Fase 3 |
|---|---|---|---|
| `pnpm check` en verde y pegado | ✔ | ✔ | ✔ |
| Ningún archivo pasa de 500 líneas | ✔ | ✔ | ✔ |
| Ninguna dependencia nueva en `package.json` | ✔ | ✔ | ✔ |
| Ninguna llamada de red en las pruebas | ✔ | ✔ | ✔ |
| Archivos compartidos tocados: listados uno por uno | `carcasa.tsx`, `iconos.tsx` | los de §13.1 punto 8 que se tocaron | `ejecutor.ts` |
| Migración: número reclamado, «lista» avisado, **no** aplicada en Neon | — | ✔ | — |
| Contrato y sus herramientas registrados en el mismo paso | — | ✔ | si se hace F3-T5 |
| `AGENTE_PROVEEDOR` sigue `apagado` por defecto | — | ✔ | ✔ |
| Prueba de privacidad entre personas pasa | — | ✔ | ✔ |
| Una herramienta de dinero nunca se ejecuta por el canal `agente` | — | — | ✔ |
| `graphify update .` | ✔ | ✔ | ✔ |
| Fila del tablero actualizada (la que asigne el integrador) | ✔ | ✔ | ✔ |

---

## 14. GIRO AUDAZ · decisiones de Moisés del 2026-11-24 y plan de construcción (manda sobre §6, §13.3–13.6 y D2/D7)

**Decisiones del dueño (textuales en esencia):** (1) «No limitarlo desde el inicio; si fallamos, que sea por exceso»: el asistente actúa directo, sin borrador por defecto; (2) puede mover deudas, cobros, precios y sueldos, **dejando huella auditable** para que un humano evalúe si actuó bien, y **sin romper las normas del ERP** (todo por `ejecutar()`, estados y secuencias, correlativos, anular en vez de borrar, eventos que proponen borradores R5); (3) el asistente es parte del ERP y **conoce todo el ERP**; (4) **aprende de cada interacción**: una equivocación no debe repetirse (memoria de aprendizaje); (5) modelo real y búsqueda en internet: después (regla 14); (6) sigue prohibido: acceso de usuarios, llaves, conexiones, reglas automáticas, aprobar sus propios borradores, cambiar su modelo o tope.

**Plan (informe de un modelo potente, Fable; leyó el código, no corrió pruebas):**
- *Hallazgos:* hoy «borrador» = rechazo (`servicio-de-turnos.ts` no pasa `proponer`); una crítica por canal `agente` se rechaza siempre (`ejecutor.ts:249`); `core.auditoria` solo guarda el hash de argumentos y los detalles viven en `agente_mensajes.metadatos` (se borran con la conversación y a los 90 días); la regex de nombres de dinero da falsos positivos y negativos (descartada); `oportunidad.ganada` no tiene consumidor (lo real es `cotizacion.aceptada`); `pedido.entregado`→cobro sí existe; hueco: `fechaDeMovimiento` no rechaza semanas cerradas (arreglo en Finanzas); tras `pedido_confirmar` Finanzas propone la deuda: si el asistente la crea a mano hay duplicado.
- *Política (modo directa):* lectura→directo · `PROHIBIDAS` · `SIEMPRE_PERSONA` (tarjeta humana: `semana_cerrar`, `clientes_fusionar`, `listas_precio_ajustar_en_bloque`, `deudas_copiar_fijos`, `enlace_generar`, `modulo_solicitar`, `taller_sembrar`, `sucursal_marcar_principal`; **lista a confirmar por Moisés**) · demás críticas→confirmación propia del agente (token en el turno, nunca visto por el modelo; repetir la llamada en otra ronda) · dinero normal→directo pasando guardas · sin clasificar→borrador, con prueba de clasificación exhaustiva.
- *Guardas de dinero (`guardas-de-dinero.ts`):* G1 con `fecha` ⇒ borrador (solo hoy); G2 borrador pendiente del sistema para el mismo origen ⇒ no ejecuta; G3 solo dinero idempotente; G4 operación idéntica reciente ⇒ rechazo; G5 topes por turno (20 escrituras, 5 de dinero) y tope de monto por operación por empresa; G6 editar dinero sin gancho `antes` ⇒ borrador.
- *Huella:* tabla inmutable `core.agente_acciones` (modelo, conversación, turno, ronda, herramienta, política, args, antes, después, resumen confirmado), escrita en la misma transacción que la acción; sobrevive al borrado del chat; herramienta `agente_acciones_listar` (no ofrecida al propio asistente) y pantalla en Ajustes.
- *Memoria de aprendizaje:* tabla `core.agente_lecciones` (por persona y por empresa; estados por_revisar/vigente/archivada; origen persona/sistema/modelo); herramienta `memoria_anotar`; captura determinista (errores de herramienta corregidos, borradores corregidos/descartados, correcciones citadas del chat); se inyecta en el prompt **variable**; texto libre del modelo queda «por revisar» y no se inyecta; editar/archivar/aprobar son de la persona; pantalla «Lo que aprendió».
- *Conocimiento del ERP:* invariantes en el prompt fijo (tope subido a 8.000 caracteres), descripción de módulos del manifiesto, flujos en `guia-del-erp.ts` contrastados por prueba con `RegistroDeConsumidores`, `efecto`/`relacionadas` en `herramienta_describir`.
- *Límites:* `AGENTE_MAX_RONDAS` máx 25 (defecto 12), 12 llamadas por ronda, rechazo de escritura idéntica dentro del turno; frenos: `escritura_directa`, `dinero_directo` (nuevo), tope por operación, `AGENTE_ESCRITURA` (global), `AGENTE_PROVEEDOR=apagado`.

**Tareas (en orden; `shared` junto y primero; un `pnpm` a la vez):** T1 contratos shared · T2 migración 0040 (reclamar número) · T3 ejecutor (`validar`, canal agente, `opciones.agente`, gancho `antes`, huella) · T4 política y listas · T5 modo/config/límites · T6 bucle (proponer, confirmación propia, guardas, frenos) · T7 memoria · T8 prompt y guía · T9 web · T10 documentos y cierre.

**Estado de construcción (se actualiza abajo):**
- 2026-11-24: hecho T5 parcial — `modoDeEscritura` ya no depende de `evaluado`; `escrituraDirecta` por defecto `true` (sin fila, en el servicio de turnos, en conversaciones y en la primera configuración); textos del catálogo y de la web sin «solo consulta». Pruebas de modelos/reglas/web ajustadas.
- 2026-11-24 (más tarde): **T4, T5 y parte de T8 hechos.** Política ampliada: `DIRECTAS` pasa de 63 a 111 (incluye `pedido_confirmar`), nuevas `SIEMPRE_PERSONA` (8, lista a confirmar por Moisés) y `DINERO` (26, siguen como borrador hasta T3/T6); una prueba de integración exige que toda herramienta de escritura no crítica esté en exactamente una lista. `AGENTE_MAX_RONDAS` máx 25 / defecto 12, 12 llamadas por ronda, freno global `AGENTE_ESCRITURA` (`activa|apagada`), `escrituraEfectiva()`. Prompt: párrafo «Actúas…» y bloque «Cómo funciona el ERP». Verificado: pruebas unitarias de política/modelos/reglas/prompt/config, integración de catálogo, agente y configuración (48 + 7 en verde), `pnpm --filter api typecheck`. **Falta:** T1–T3 (contratos, migración 0040, ejecutor con huella y confirmación propia), T6 (guardas de dinero, proponer), T7 (memoria), T9 (web), `pnpm check` completo. Hoy el dinero y las críticas se rechazan con «no puedo hacer ese cambio» (no hay `proponer` aún).
- 2026-11-24 (noche): **T1, T2, T3, T6, T7, T8 y T9 construidos** (decisión de Moisés: aprobación humana solo en las 8 de `SIEMPRE_PERSONA`; tope **S/ 1,000** por operación de dinero). Qué quedó:
  - *Política:* `politicaDe` devuelve `directo | dinero | confirmada | borrador | prohibido`. Crítica ⇒ confirmación propia (el servidor guarda el token, el modelo nunca lo ve; se ejecuta al repetir la llamada en una ronda posterior); dinero ⇒ guardas (`guardas-de-dinero.ts`: fecha de hoy, tope por operación, no repetir, máx 5 de dinero y 20 escrituras por turno, solo herramientas idempotentes); si una guarda no pasa queda como borrador (origen `agente`) en la Bandeja. Con el freno de la empresa (`escritura_directa=false`) todo es borrador.
  - *Huella:* migración **0040** (`core.agente_acciones` inmutable, `core.agente_lecciones` con RLS persona/empresa, `dinero_directo`, `tope_por_operacion_centimos`, `escritura_directa` por defecto `true`). El ejecutor (`ejecutor.ts`: `validar()`, `opciones.agente`) escribe la huella en la MISMA transacción que la acción; rechazos, confirmaciones pendientes y borradores se escriben aparte. Herramienta `agente_acciones_listar` (permiso `auditoria:ver`, excluida para el propio asistente).
  - *Memoria:* `memoria_anotar/listar/editar/archivar/aprobar`. Editar, archivar y aprobar son de las personas (`PROHIBIDAS`). Una lección del modelo nace «por revisar» y no se usa; vigente solo si la persona la dijo (cita comprobada por el servidor contra SU mensaje) o la escribió una persona. Captura determinista: errores de argumentos corregidos en el turno (plantilla, solo nombres de campos) y borradores del asistente descartados/corregidos por una persona. Las vigentes entran al prompt VARIABLE (≤12, ≤1.200 caracteres, rotuladas como notas, no órdenes).
  - *Conocimiento del ERP:* `guia-del-erp.ts` (15 flujos entre módulos, contrastados por prueba con `RegistroDeConsumidores`), `software_mapa` con flujos por área, `herramienta_describir` con `queHaceElAsistente`, `relacionadas` y efectos en cadena; prompt con «Tu papel junto a la persona» (aliado, el humano puede hacerlo a mano, explicar la regla cuando algo no se puede, sinceridad, aprender).
  - *Web:* en el panel, «Ajustes del asistente»: frenos (escritura directa, dinero directo, tope en soles), «Lo que aprendió» (aprobar/archivar/compartir), «Lo que hizo» (huella) y el modelo.
  - *Verificado:* pruebas unitarias de API (242+) y web (176) en verde; integración del agente (121), herramientas y borradores en verde; `escritura.int.spec.ts` y `memoria.int.spec.ts` prueban contra PostgreSQL real el dinero chico con huella, el borrador por tope/fecha, la confirmación propia en dos pasos, la huella inmutable, la memoria y el aislamiento. Lint y tipos de lo tocado limpios.
  - *Pendiente:* revisión visual (390/1280 px, claro/oscuro) por una persona; llamar a un modelo real (2B: llave, privacidad, orden de Moisés); banco de evaluación (fase 5); el hueco de **semana cerrada** (Finanzas deja registrar un movimiento con fecha atrasada en una semana cerrada: arreglo en la herramienta de Finanzas, no en el asistente); ganchos `antes` para que el asistente edite dinero (hoy solo crea; editar queda en borrador); aplicar 0040 en Neon (docs/NEON-MIGRACION.md); búsqueda en internet (futuro).
- 2026-11-24 (noche, tras la revisión adversarial de Fable): corregidos **C1** (las críticas de dinero —`CRITICAS_DE_DINERO`— pasan por las guardas antes de pedir confirmación), **A1** (una lección es de la persona solo si su cita tiene ≥3 palabras, aparece en SU mensaje y ≥60 % de las raíces del texto salen de lo que dijo), **A2** (no se crea a mano lo que el sistema ya propuso para ese cliente/origen; lo que trae `origenTipo/origenId` es borrador), **A3** (la misma operación se decide por clave de negocio, no por el texto libre; tope diario = 5× el tope por operación), **A4** (sin importe verificable —sin campo `*Centimos` o argumentos demasiado hondos— es borrador), **M1** (rechazos y lo prohibido dejan huella), **M2** (`captura_proponer` no guarda lo dictado), **M3–M5** (lecciones por antigüedad, motivo de descarte solo si lo escribió la misma persona, el asistente solo lee lecciones vigentes), **M7** (se cuenta solo lo que se hizo; los borradores no se duplican y cuentan para el tope), **B1–B3** (textos sin «con tu nombre», `compra_recibir` pasa a directa). **Siguen abiertos** (anotados, no bloquean): `antes` en la huella y G6 (editar dinero con gancho `antes`), M6 (decidir el reintento con `agente_acciones` y no con los metadatos), carrera entre comprobar y ejecutar con turnos paralelos (la guarda de «no repetir» no tiene candado), `despues` con costos visible a quien tiene `auditoria:ver` sin `costos:ver`, B4 (`hoy` fijo al abrir el turno).
- 2026-11-24 (cierre): `VITEST_MAX_WORKERS=2 pnpm check` **en verde** (exit 0): shared 192, web 1216, API 1823 unitarias, 125 archivos de integración (1869 pruebas + 1 fallo esperado). La primera corrida tuvo 2 fallos por carga de la máquina (`12 turnos simultáneos` dio 7 aceptados en vez de 6, y un recorrido del cotizador); pasaron solos varias veces y en la segunda corrida completa. **Ojo:** la prueba de los 12 turnos simultáneos es sensible a la carga: si vuelve a fallar con la máquina ocupada, mirar primero el candado de `admitir` antes de culpar al cambio. Sin commit. Migración 0040 solo en local (no aplicada en Neon).
- 2026-11-25: **migraciones 0039 y 0040 aplicadas en Neon** (proyecto `erp-microsevicios`, rama `production`), por orden de Moisés y con el procedimiento de `docs/NEON-MIGRACION.md`: ensayo en la rama `ensayo-0039-0040` (dos corridas idempotentes) y después producción (dos corridas). Verificado por consulta: 41 migraciones en el diario, las 6 tablas del asistente con RLS forzada (9 políticas), huella inmutable (`capaz_app` no puede actualizar ni borrar), `escritura_directa` por defecto `true`, roles sin superusuario ni `BYPASSRLS`. El asistente sigue apagado en producción (`AGENTE_PROVEEDOR=apagado`): aplicar las tablas no cambia nada para nadie. La rama de ensayo sigue existiendo (borrarla se pregunta a Moisés).

- 2026-11-25 (noche): **causa raíz de la intermitencia de `pnpm check`** (la halló un modelo potente, con medición propia): `VITEST_MAX_WORKERS=2` —lo que este plan manda usar— pisaba `fileParallelism: false` en Vitest 4.1.12 y las pruebas de integración corrían DOS archivos a la vez sobre la misma base; `relevo.procesarLote()` reserva eventos de cualquier empresa, así que el relevo de un archivo se llevaba los eventos del otro (se midieron 176 reservas cruzadas en una corrida; el fallo se reprodujo y la receta en serie pasó). Arreglo: `vitest.int.config.ts` borra la variable y `global-setup.ts` exige un solo trabajador. Consecuencia: la integración tarda más (en serie, ~13 min). Las pruebas con conteos globales de tablas (p. ej. `cuenta.int.spec`) siguen siendo frágiles si OTRA sesión escribe en la misma base `capaz_test`: usar `CAPAZ_TEST_DB=capaz_test_<id>` propia.
