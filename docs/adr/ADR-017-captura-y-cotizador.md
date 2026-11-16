# ADR-017: Captura como capa del núcleo y Cotizador por cortes

**Estado:** ACEPTADO (2026-11-16, decisiones del dueño sobre `docs/PLAN-INTEGRACION-COTIZIN-Y-SF.md` §7: D-I1, D-I2, D-I4, D-I5, D-I7 y D-I8; redactado por el arquitecto de planes; pendiente de revisión técnica de Keny) · **Decide:** Moisés · **Relacionado:** ADR-005, ADR-008, ADR-009, ADR-012, ADR-015, ADR-016

> No cambia ningún ADR aceptado. **Precisa** dos frases: de ADR-008, «voz primero» se cumple como una capa de captura sobre Finanzas ya construida, no como un módulo aparte; de ADR-012 (y de la regla 9 de `AGENTS.md`), «dinero en céntimos enteros» gana una excepción acotada y escrita (punto 3). El detalle para construir está en `docs/FICHAS-OLA-4.md`.

## Contexto

Capaz tiene completos el núcleo y los siete módulos clásicos. Quedaban por entrar los dos productos previos del dueño:

- **Tairos.RC** registra dinero dictando. Su parte de dinero ya la hace mejor Finanzas (`registro`): cuentas, deudas aparte, abonos con bloqueo e idempotencia. Lo que Capaz no tiene es la **captura**: voz, texto libre y las reglas que sacan de una frase el monto, el tipo, el contacto y la categoría (unas 180 pruebas, lógica pura).
- **Cotizín** calcula precios de imprenta con un motor puro y probado (unas 280 pruebas en su cierre de archivos), pero hoy cubre cerca del 9 % de lo que vende Atlantisgraf, y su piloto nunca se ejecutó.

Capaz ya tenía lo que la captura necesita: la bandeja de borradores guarda `args` y `argsOriginales`, la marca `corregido`, `capturaIniciadaEn` y los orígenes `voz` y `texto`. Y `big.js@7.0.1` quedó instalado en `apps/api` (versión exacta) al aprobarse D-I7.

## Decisión

### 1. La captura es una capa del núcleo, no un módulo de dinero

- Vive en `core/captura` (servidor) y `core/captura` (web). No se contrata, no tiene tablas ni mueve dinero.
- Una sola herramienta, `captura_proponer`: recibe un texto (dictado o escrito), elige el **intérprete** del módulo destino y guarda lo que este propone como **borradores** de herramientas que ya existen, con origen `voz` o `texto`.
- Cada módulo registra su intérprete (`InterpreteDeCaptura`) en `RegistroDeInterpretes`, igual que registra consumidores de eventos. El primero es el de Finanzas (`modules/registro/dictado`). El mismo contrato servirá para dictar pedidos o cotizaciones, y para otro medio de entrada (WhatsApp), sin tocar el núcleo.
- **La captura solo propone.** Ni `core/captura` ni un intérprete ejecutan herramientas ni escriben en tablas de negocio: leen y proponen. El dinero lo mueve la herramienta de siempre cuando una persona aprueba el borrador desde la pantalla. Es la regla R5 de los consumidores de eventos (ADR-016, punto 3) extendida a la captura; una prueba la vigila.
- Como las herramientas del núcleo están eximidas de la comprobación de escritura del ejecutor, `captura_proponer` comprueba **dentro** que la persona puede escribir en el módulo destino y que tiene el permiso de cada herramienta que se propone. Nadie propone lo que no podría aprobar.
- **La medición sale de `core.borradores`**, sin tabla nueva: `borradores_metricas` entrega el porcentaje aprobado sin corregir, la mediana de segundos desde el inicio de la captura y qué campos se corrigen más. Son las metas del piloto (70 % y 30 s).
- El medio de la captura se llama `origen`, no `canal`: `canal` es un nombre reservado del ejecutor. El cliente envía la **duración** de la captura, no una hora, para no depender del reloj del aparato.

### 2. La voz arranca sin modelo de pago (fase A1)

- El reconocimiento de voz es el del navegador (Web Speech), detrás de la interfaz `ReconocedorDeVoz`. El servidor nunca recibe audio.
- La interpretación la hacen las **reglas locales** de Tairos.RC, portadas con sus pruebas, más tres reglas nuevas y pequeñas (categoría de Capaz, «ayer» y «anteayer», deuda nueva).
- El puerto `ModeloDeLenguaje` existe con una sola implementación, `ModeloNulo`. No se instala ningún SDK, no se agrega ninguna variable de entorno ni ninguna clave, y no sale ningún dato hacia un proveedor (regla 14).
- El micrófono del celular exige HTTPS: el piloto de voz depende del despliegue (X1). La construcción, no.

### 3. Excepción a la regla 9: el interior del motor del Cotizador

La regla 9 («dinero en céntimos enteros; nunca decimales en `number`») se mantiene en todo Capaz, con esta excepción acotada:

- **Dentro de `apps/api/src/modules/cotizador/domain/motor/`**, el dinero es **texto decimal** calculado con `big.js` (redondeo de la mitad hacia arriba; importes con 2 decimales, unitarios con 4, cantidades con 3; el constructor propio rechaza `number`). Es el motor de Cotizín copiado sin cambios, con sus pruebas como equivalencia.
- **Un solo punto de coma flotante:** la curva de precios entre referencias usa `Math.log` y `Math.exp` (`big.js` no tiene logaritmos). El resultado se redondea una vez a céntimos y pasa exactamente por las tres referencias. Queda confinado a `motor/escala/precio-por-escala.ts` y lo vigilan sesenta vectores calculados con un oráculo independiente.
- **Un único adaptador**, `domain/adaptador-de-dinero.ts`, convierte entre ese texto y los enteros de Capaz, y **no redondea en silencio**: si recibe más decimales de los previstos, falla.
- **Fuera de `motor/` todo es entero:** tablas (`bigint` en céntimos y milésimas), contratos, eventos y pantallas. Los porcentajes de configuración se guardan como `numeric` y viajan como texto. Solo `motor/base/dinero.ts` importa `big.js`; herramientas y repositorios llegan al motor por fachadas de `domain/`. Una prueba hace cumplir las tres cosas.
- **Del mismo orden, en el porte de Tairos.RC:** las reglas de dictado leen el monto de la frase con `parseFloat × 100` y redondeo. Es lectura de un texto de hasta dos decimales, no aritmética de dinero; se conserva tal cual dentro de `modules/registro/dictado/reglas/` y entrega siempre céntimos enteros.

Motivo: reescribir el motor con enteros cuesta más y arriesga los números que el dueño ya validó; copiarlo con sus pruebas es más barato y más seguro.

### 4. El Cotizador es un módulo de Capaz y se construye por cortes

- **Dentro de Capaz** (módulo `cotizador`, familia Ventas), sobre `core.clientes` y `core.productos`; no como un producto aparte conectado por API. Cotizín sigue intacto hasta su apagado.
- **B1, ahora:** lista de precios a 100, 1.000 y 5.000, cotización rápida, imprimir, WhatsApp y «aceptada → pedido». Una migración (`0024_cotizador`, después de la `0023` de la ronda de cuentas) con solo las tablas de B1.
- **B2, condicionado:** el cuadro de costos por partes se construye **solo si** un piloto de tres trabajos reales en Cotizín, tal como está, muestra que se usa. Tendrá su propia migración.
- **B3, después:** el enlace público con aprobar o rechazar; con política explícita para `capaz_sistema` y revisión de seguridad (regla 18: sin `security definer`).
- **Precios sin IGV en el Cotizador**, con el IGV calculado por línea al céntimo; el pedido sigue con IGV incluido (ADR-016, punto 8). El puente convierte cada línea aceptada en una línea de pedido de cantidad 1 con el total con IGV, de modo que base, IGV y total coinciden al céntimo.
- **El puente es por eventos y por la bandeja:** `cotizacion.aceptada` → un consumidor de `ordenes` propone el borrador de `pedido_crear` con `origenTipo: 'cotizacion'`; el índice único de origen de Pedidos lo hace idempotente. Ningún módulo importa a otro.
- Las versiones emitidas son inmutables en la base (disparador), no solo en el código.

### 5. Reglas del porte

Lo que se trae de Cotizín y de Tairos.RC (ambos del dueño; regla 13) se **copia** y se edita lo mínimo: rutas de importación, nombre del archivo de prueba y renombres mecánicos de identificadores. No se cambia ningún valor esperado, no se salta ninguna prueba y no se reformatea. Un comparador automático lo comprueba en el carril y otra vez al integrar. Nada se toma de Odoo ni de otro ERP (regla 12).

## Decisiones que siguen abiertas

| Decisión | De quién | Cuándo se toma |
|---|---|---|
| **A2 · modelo de lenguaje de pago** para interpretar (proveedor, tope de gasto mensual, dependencias, tabla `core.uso` con su migración, y aceptar que el texto dictado sale hacia ese proveedor) | Dueño, con Keny | Solo si la pista V muestra que las reglas no llegan al 70 % |
| **Proveedor de voz** (grabar y subir a un servicio, en lugar del reconocimiento del navegador) | Dueño, con Keny | Solo si la pista V o el piloto muestran que el navegador falla (iPhone, ruido) |
| **Pista V:** 30 a 50 dictados reales con su resultado correcto y 10 registros cronometrados | Dueño | Ya; no necesita código y decide las dos anteriores |
| **Piloto de tres trabajos en Cotizín** | Dueño | Ya; decide B2 |
| Dónde se llama al modelo en A2: no puede ser dentro de la transacción de la herramienta | Keny | Al abrir A2 |
| Enlace público (B3), catálogos de Cotizín que se importan, reglas de convivencia y apagado | Dueño | Después de B1 |
| Aviso de privacidad por el audio que procesa el navegador (Ley 29733) | Keny | Antes del piloto de voz |

## Alternativas descartadas

- **La voz como módulo propio con su dinero** (un «Registro por voz» junto a Finanzas): dos modelos para el mismo dinero, que es lo más caro de corregir.
- **Modelo de pago desde el primer día:** costo por uso y dependencia de un proveedor antes de saber si hace falta; las reglas ya existen y están probadas.
- **Cotizín aparte, conectado por API o webhook:** obliga a modificar Cotizín, duplica clientes, productos, base y despliegue, y cada llamada tarda segundos.
- **Reescribir el motor con enteros:** más caro y con riesgo de cambiar precios.
- **Intérpretes que ejecutan herramientas directamente:** un dictado mal entendido movería dinero sin que nadie lo viera.
- **Una tabla propia de métricas de voz:** la bandeja ya guarda todo lo necesario.

## Consecuencias

- Aparece un área nueva en los contratos (`captura.ts`) y un registro global más (`RegistroDeInterpretes`). `registro` gana una herramienta aditiva, `deuda_crear_con_adelanto`, para que «contrato con adelanto» sea un solo borrador, y `deuda_abonar` un campo opcional `origen`.
- Los intentos de dictado que no producen borrador no entran en la medición; quedan en la auditoría de `captura_proponer` (sin el texto).
- El texto dictado es dato personal: vive en el borrador y no va a registros, auditoría ni eventos.
- En B1 el Cotizador solo admite IGV de 18 % o 0 %, porque Pedidos calcula con 18.
- Dentro de `dictado/reglas/` las claves de la extracción siguen en `snake_case` (formato del porte): excepción acotada a la regla 10.
- Si la pista V obliga a abrir A2, el cambio es un adaptador de `ModeloDeLenguaje`, el esquema que declare el intérprete y la tabla de uso; la pantalla y las herramientas no cambian.
- Si el piloto de Cotizín no justifica B2, el motor de costeo queda copiado y probado, sin herramientas ni pantallas: no estorba y no se mantiene aparte.
