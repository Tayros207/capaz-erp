# Plan para dejar funcionando el Cotizador (Cotizín) y la voz (SF / Tairos.RC) dentro de Capaz

**Fecha:** 2026-11-16 · **Para:** Moisés (dueño) y Keny (técnico) · **Estado:** vigente. Detalle técnico en `FICHAS-OLA-4.md` y `PLAN-INTEGRACION-COTIZIN-Y-SF.md`; decisiones en `adr/ADR-017-captura-y-cotizador.md`.

**Regla del dueño:** no perder funcionalidades de los dos productos. Por eso el motor de Cotizín y las reglas de Tairos.RC se **copian enteros con todas sus pruebas y sin cambiar ningún valor esperado**; lo único que cambia son rutas, nombres (inglés → español) y un adaptador que pasa los importes a céntimos. Si algo no encaja, se detiene el carril y se decide; no se quita nada en silencio.

## 1. Dónde estamos (en `main`, verificado con pruebas)

| Pieza | Estado |
|---|---|
| Motor de cálculo de Cotizín (57 archivos, 284 pruebas, casos reales: 2.500 volantes A5 → costo 225,15, precio 346,38, 172 pliegos madre) | **Hecho e integrado** (carril s0). Comparador archivo por archivo contra el original: iguales salvo 2 líneas de rutas |
| Reglas de dictado de Tairos.RC (183 pruebas, 12 frases de referencia) + 3 reglas nuevas mínimas («ayer», «anteayer», deuda por cobrar/pagar) | **Hecho e integrado** (carril s5a) |
| Cableado de captura y Cotizador en el servidor y la web | **Hecho** (C4) |
| Captura en el núcleo (`captura_proponer`, intérpretes, métricas) | **En construcción** (carril C3) |
| Migración `0024_cotizador` (tablas de precios, cotizaciones y versiones) | **En construcción** (carril DB5) |
| Ronda 3 de cuentas (migración 0023) | Integrada en `main`; falta aplicarla en Neon |

## 2. Lo que falta, en orden (cada paso lo integro y compruebo con `pnpm check` antes del siguiente)

**Tanda 1 (en curso):** C3 y DB5.
**Tanda 2:** 
- **s5b** · intérprete de Finanzas: conecta las reglas de dictado con las herramientas de `registro` y agrega `deuda_crear_con_adelanto`. Aditivo: no cambia ninguna herramienta actual.
- **W11** · pantalla de dictado (micrófono, texto, revisión en la bandeja ya existente, atajos). Móvil primero.
- **M-cotizador-s1** · lista de precios (100/1.000/5.000), configuración y herramientas del Cotizador (11).
**Tanda 3:** 
- **M-cotizador-s2** · cotizaciones (crear, versionar, aceptar, imprimir, WhatsApp).
- **M-ordenes-s3** · puente: cotización aceptada → **borrador** de pedido (y de ahí a deuda, como hoy). La proforma actual de Pedidos sigue funcionando.
- **M-cotizador-w1** · pantallas del Cotizador (dos sesiones).
- **X4** · recorrido de punta a punta por HTTP real y cierre.

Carriles de dos en dos por tu límite de uso de IA. Estimación: la voz usable en unas 4 sesiones de agente más; el Cotizador básico con su puente en unas 6.

## 3. Qué no depende de nosotros (y sin lo cual no «queda funcionando»)

| Pendiente | Quién | Por qué importa |
|---|---|---|
| Despliegue con **HTTPS** (X1) | Keny | Sin HTTPS el micrófono del celular no funciona: la voz solo se probaría en escritorio |
| **Aplicar `0023` y `0024` en Neon** (ensayo en rama + verificación, como se hizo con 0021/0022) | Integrador, con tu confirmación | Producción no tiene aún las tablas |
| **Pista V**: 30 a 50 dictados reales y 10 registros cronometrados | Tú | Decide si bastan las reglas locales o hace falta un modelo de pago (A2) y mide la meta: 70 % de registros sin corregir, 30 s por registro |
| **Piloto de tres trabajos** en Cotizín tal como está | Tú | Decide si se construye el cuadro de costos por partes (B2) |
| Confirmar: tabla que reduce las 16 categorías de Tairos.RC a las de Capaz; precios del Cotizador sin IGV frente a pedidos con IGV incluido | Tú | Evita reprocesos |
| Copia de seguridad de Tairos.RC (tiene 108 movimientos reales y contactos duplicados) y Excel antes de apagarlo | Tú / Keny | No se pierde historial |

## 4. Lo que NO se hace (para que nada quede a medias)
- No se toca Cotizín ni Tairos.RC: siguen intactos y en uso hasta que decidas apagarlos (coexistencia y vuelta atrás: plan §5.2).
- Sin modelo de pago al inicio (voz con reconocimiento del navegador + reglas locales). Si la pista V no llega al 70 %, se agrega el modelo con tabla de uso y tope de gasto.
- Fuera del Cotizador B1: troquelado por pieza (61 % de las ventas de Atlantisgraf) y gran formato por m²: Cotizín tampoco los cubre hoy; se evalúa después del piloto.

## 5. Documentación que deja cada paso (se actualiza al integrar)
1. `docs/RELEVO.md`: estado y qué sigue (lo actualizo en cada integración).
2. `docs/FICHAS-OLA-4.md`: correcciones (ya anotada la de `semillas.ts`).
3. **Manual breve del Cotizador** y **manual breve de la voz** (cómo se usa, atajos, qué hacer cuando no entiende): los redacta el carril W11 y el de pantallas del Cotizador en `docs/manuales/` en español claro, con capturas cuando haya despliegue.
4. `docs/NEON-MIGRACION.md` §8: registro de cada migración aplicada.
5. ADR-017: queda aceptado; Keny lo revisa.

## 6. Criterio de «funcionando»
- **Voz:** desde el celular (con HTTPS) se dicta «le cobré 250 a Gráfica Norte por unos volantes», aparece como borrador con el monto y el cliente, se aprueba con un clic y entra a Finanzas; se mide el porcentaje sin corregir y el tiempo por registro.
- **Cotizador:** cotizar 2.500 volantes A5 da los mismos 225,15 / 346,38 que Cotizín; se imprime, se envía por WhatsApp, se acepta y aparece un borrador de pedido que, al aprobarlo, genera el pedido y su deuda.
