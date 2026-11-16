# ADR-016: Reglas de datos y de conducta de los módulos clásicos

**Estado:** ACEPTADO (2026-11-15, por delegación del usuario; pendiente de revisión de Keny) (2026-11-15, redactado por el arquitecto de planes en la puerta entre olas) · **Decide:** Moisés, con revisión técnica de Keny · **Relacionado:** ADR-008, ADR-011, ADR-012, ADR-013, ADR-014, ADR-015

> No cambia ningún ADR aceptado salvo una frase de ADR-008 (punto 7). Recoge lo que se fijó al congelar las fichas de la ola 2 (`docs/FICHAS-OLA-2.md`) contra el código real de la ola 1. La ola 2 se construye con estas reglas; si alguna se rechaza, se corrige la ficha antes de lanzar el carril afectado.

## Contexto

La ola 1 dejó el núcleo completo, pero **ningún módulo contratable real** usa todavía el camino «módulo que no es `core`»: las herramientas de `webhooks` se declararon con `modulo: 'core'`. La ola 2 es la primera que ejerce `puedeEscribir`, los permisos de manifiesto de módulo, los esquemas por módulo (ADR-015) y los consumidores de eventos entre módulos. Leyendo el código aparecieron huecos que el plan no resolvía.

## Decisión propuesta

1. **Solo lectura también en la base, con un disparador genérico.** `core.exigir_modulo` es una función normal, no de disparador. Se agrega `core.exigir_modulo_en_escritura()` (función de disparador que recibe el código del módulo como argumento) y cada tabla de un módulo la lleva en `before insert or update or delete`. Sin `security definer`.
2. **Inmutabilidad del dinero por permisos de columna.** `registro.movimientos` (y `personal.adelantos`) se abren a `capaz_app` en modo `insercion` más `update` solo sobre las columnas de anulación. «Se anulan, no se editan ni se borran» (ADR-012) lo garantiza la base, no solo el código.
3. **Un consumidor de eventos de un módulo solo propone borradores.** El relevo entrega a los consumidores un contexto con permisos de administrador de la empresa; por eso un consumidor de módulo no ejecuta herramientas ni escribe en tablas: llama a `proponerBorrador` con el origen nuevo `modulo`. Una persona aprueba. (Excepciones futuras, por escrito y una a una.)
4. **Entre módulos, referencias blandas.** Un documento apunta a otro módulo con `origen_tipo` + `origen_id` (texto, sin llave foránea) y un índice único parcial que da la idempotencia del puente. Las llaves foráneas compuestas quedan para el propio módulo y para el núcleo; para eso `core.productos` y `core.sucursales` ganan `unique (tenant_id, id)`.
5. **Alcance «propios»** se aplica en las herramientas de documentos por `creado_por` o `responsable_id`; los resúmenes exigen alcance «todos».
6. **Catálogos por defecto** con una herramienta `<codigo>_iniciar` idempotente y la misma función llamada desde las escrituras; las lecturas nunca siembran.
7. **Equivalencia con Tairos.RC por casos de referencia.** La frase de ADR-008 «pruebas de equivalencia contra las funciones SQL originales usando los mismos casos» se cumple con una lista escrita de casos (abonos parciales, sobrepago, anulaciones, concurrencia, idempotencia, céntimos) y sus saldos esperados, no ejecutando el SQL antiguo: el modelo de Finanzas ligeras (movimientos + deudas) ya no es el de Tairos.RC (transacciones + abonos) y montar su base solo para comparar no compensa. Las dos desviaciones deliberadas ya documentadas en el porte de Cotizín (bloquear antes de leer el saldo; idempotencia antes de la regla de saldo) se conservan.
8. **Los precios de un pedido incluyen IGV** y el porcentaje se guarda en el documento (18 por defecto).
9. **Nombres de tablas en Drizzle con prefijo de módulo**, porque el índice del esquema reexporta todo junto.

## Alternativas descartadas

- **Consumidores que ejecutan herramientas con el contexto de sistema:** una regla de negocio de otro módulo movería dinero sin persona y con permisos de administrador.
- **Llaves foráneas entre esquemas de módulos:** impiden dar de baja o quitar un módulo y atan el orden de las migraciones.
- **Disparador de inmutabilidad en vez de permisos de columna:** más código que probar y un mensaje de error menos claro; los permisos ya los comprueba la prueba de aislamiento.
- **Ejecutar el SQL de Tairos.RC en las pruebas:** exige otra base con el esquema antiguo y compara modelos distintos.

## Consecuencias

- La prueba `aislamiento.int.spec.ts` debe activar los módulos de sus dos empresas antes de sembrar ejemplos.
- La bandeja recibe borradores de otros módulos: su vista genérica debe mostrar montos en soles (carril N1).
- El contrato de `proponerBorrador` gana un valor de `origen` (cambio compatible) y `core.borradores` un valor en su `CHECK`.
- Si se rechaza el punto 8, cambian `ordenes.pedidos`, la función de totales y la pantalla de líneas antes de lanzar M-ordenes-s1.
