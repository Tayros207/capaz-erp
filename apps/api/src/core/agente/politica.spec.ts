import { describe, expect, it } from 'vitest';
import { DINERO, DIRECTAS, LECTURAS_EXCLUIDAS, PROHIBIDAS, SIEMPRE_PERSONA, politicaDe, type DatosDeHerramienta } from './politica.js';

const h = (nombre: string, criticidad: DatosDeHerramienta['criticidad'] = 'normal', mueveDinero = false): DatosDeHerramienta => ({ nombre, criticidad, mueveDinero });

describe('politicaDe', () => {
  it('1. una lectura se ejecuta, en cualquier modo', () => {
    for (const modo of ['ninguna', 'borradores', 'directa'] as const) expect(politicaDe(h('pedidos_listar', 'lectura'), {}, modo)).toBe('directo');
  });

  it('1. las lecturas excluidas quedan prohibidas', () => {
    for (const nombre of LECTURAS_EXCLUIDAS) expect(politicaDe(h(nombre, 'lectura'), {}, 'directa')).toBe('prohibido');
    expect(LECTURAS_EXCLUIDAS.size).toBe(12);
  });

  it('2. lo prohibido lo es en todos los modos, también si fuera crítica o directa', () => {
    for (const nombre of PROHIBIDAS) {
      for (const modo of ['ninguna', 'borradores', 'directa'] as const) expect(politicaDe(h(nombre), {}, modo), `${nombre}/${modo}`).toBe('prohibido');
    }
    expect(PROHIBIDAS.size).toBe(28);
  });

  it('2. el asistente no puede cambiar su propio modelo ni su tope', () => {
    expect(politicaDe(h('agente_configurar', 'critica'), { modelo: 'x/y' }, 'directa')).toBe('prohibido');
  });

  it('2. aprobar, corregir y descartar borradores es de la persona', () => {
    for (const n of ['borrador_aprobar', 'borrador_corregir', 'borrador_descartar']) expect(politicaDe(h(n), {}, 'directa')).toBe('prohibido');
  });

  it('3. sin permiso de escritura, todo lo que cambia algo queda prohibido', () => {
    expect(politicaDe(h('pedido_editar'), {}, 'ninguna')).toBe('prohibido');
    expect(politicaDe(h('movimiento_registrar', 'normal', true), {}, 'ninguna')).toBe('prohibido');
    expect(politicaDe(h('venta_corregir', 'critica', true), {}, 'ninguna')).toBe('prohibido');
  });

  it('3. captura_proponer sí pasa sin permiso de escritura: solo propone borradores', () => {
    expect(politicaDe(h('captura_proponer'), {}, 'ninguna')).toBe('directo');
    expect(politicaDe(h('captura_proponer'), {}, 'borradores')).toBe('directo');
  });

  it('4. lo crítico pide la confirmación propia del asistente y lo que mueve dinero pasa por las guardas, aunque esté en la lista de directas', () => {
    expect(politicaDe(h('compra_cancelar', 'critica'), {}, 'directa')).toBe('confirmada');
    expect(politicaDe(h('movimiento_registrar', 'normal', true), {}, 'directa')).toBe('dinero');
    expect(politicaDe(h('pedido_editar', 'critica'), {}, 'directa')).toBe('confirmada');
    expect(politicaDe(h('pedido_editar', 'normal', true), {}, 'directa')).toBe('dinero');
  });

  it('4. con el freno de la empresa (modo borradores) TODO lo que cambia algo es un borrador, también lo crítico y el dinero', () => {
    expect(politicaDe(h('compra_cancelar', 'critica'), {}, 'borradores')).toBe('borrador');
    expect(politicaDe(h('movimiento_registrar', 'normal', true), {}, 'borradores')).toBe('borrador');
    expect(politicaDe(h('deuda_crear'), {}, 'borradores')).toBe('borrador');
  });

  it('5. con escritura directa, lo de la lista de directas se ejecuta', () => {
    expect(DIRECTAS.has('pedido_editar')).toBe(true);
    expect(politicaDe(h('pedido_editar'), {}, 'directa')).toBe('directo');
  });

  it('5. con escritura por borradores, lo de la lista de directas también es un borrador', () => {
    expect(politicaDe(h('pedido_editar'), {}, 'borradores')).toBe('borrador');
  });

  it('5. entregar un pedido o una orden es un borrador aunque la herramienta sea directa', () => {
    expect(politicaDe(h('pedido_cambiar_estado'), { id: 'x', estado: 'en_proceso' }, 'directa')).toBe('directo');
    expect(politicaDe(h('pedido_cambiar_estado'), { id: 'x', estado: 'entregado' }, 'directa')).toBe('borrador');
    expect(politicaDe(h('produccion_orden_estado'), { id: 'x', estado: 'entregado' }, 'directa')).toBe('borrador');
  });

  it('5. cambiar el precio de un producto es un borrador; cambiar otra cosa, directo', () => {
    expect(politicaDe(h('productos_editar'), { id: 'x', nombre: 'Tarjeta' }, 'directa')).toBe('directo');
    expect(politicaDe(h('productos_editar'), { id: 'x', precioUnitarioMilesimas: 500 }, 'directa')).toBe('borrador');
  });

  it('6. una herramienta nueva que nadie clasificó cae en borrador, nunca en directo', () => {
    expect(politicaDe(h('herramienta_del_futuro'), {}, 'directa')).toBe('borrador');
    expect(politicaDe(h('herramienta_del_futuro'), {}, 'borradores')).toBe('borrador');
  });

  it('los argumentos raros no rompen la política', () => {
    expect(politicaDe(h('pedido_cambiar_estado'), null, 'directa')).toBe('directo');
    expect(politicaDe(h('pedido_cambiar_estado'), 'texto', 'directa')).toBe('directo');
    expect(politicaDe(h('pedido_cambiar_estado'), [1, 2], 'directa')).toBe('directo');
  });
});

describe('las listas', () => {
  it('ninguna herramienta es a la vez prohibida y directa', () => {
    for (const n of DIRECTAS) expect(PROHIBIDAS.has(n), n).toBe(false);
  });
  it('hay 113 directas: las 63 de la auditoría más la ampliación del 2026-11-24', () => {
    expect(DIRECTAS.size).toBe(113);
  });
  it('las listas de decisión no se pisan entre sí', () => {
    for (const n of SIEMPRE_PERSONA) expect(DIRECTAS.has(n) || DINERO.has(n) || PROHIBIDAS.has(n), n).toBe(false);
    for (const n of DINERO) expect(DIRECTAS.has(n) || PROHIBIDAS.has(n), n).toBe(false);
  });
  it('confirmar un pedido es directo; el dinero pasa por las guardas; lo que decide una persona siempre es borrador, aunque sea crítico', () => {
    expect(politicaDe(h('pedido_confirmar'), {}, 'directa')).toBe('directo');
    expect(politicaDe(h('deuda_crear'), {}, 'directa')).toBe('dinero');
    expect(politicaDe(h('semana_cerrar', 'critica'), {}, 'directa')).toBe('borrador');
    expect(politicaDe(h('clientes_fusionar', 'critica'), {}, 'directa')).toBe('borrador');
  });
});
