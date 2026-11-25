import { describe, expect, it } from 'vitest';
import { ACCIONES_RAPIDAS, estadoVivo, respuestasRapidas, rutaDeLoHecho, saludoPorHora } from './logica-acciones.ts';
import type { ElementoDeHilo } from './logica-hilo.ts';

const ID = '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f';
const agente = (texto: string, estado: 'escribiendo' | 'completo' = 'completo'): ElementoDeHilo => ({ id: 'a', tipo: 'agente', texto, estado });
const paso = (estado: 'en_curso' | 'listo'): ElementoDeHilo => ({ id: 'h', tipo: 'herramienta', titulo: 'Listar pedidos', estado });

describe('rutaDeLoHecho', () => {
  it('lleva a la pantalla de lo que el asistente creó, según la herramienta', () => {
    expect(rutaDeLoHecho('pedido_crear', ID)).toBe(`/m/ordenes/${ID}`);
    expect(rutaDeLoHecho('clientes_crear', ID)).toBe(`/clientes/${ID}`);
    expect(rutaDeLoHecho('cotizacion_crear', ID)).toBe(`/m/cotizador/cotizaciones/${ID}`);
    expect(rutaDeLoHecho('movimiento_registrar', ID)).toBe(`/m/registro/movimientos/${ID}`);
    expect(rutaDeLoHecho('produccion_orden_crear', ID)).toBe(`/m/produccion/${ID}`);
  });
  it('sin un id de verdad (o con una herramienta que no se conoce) no hay enlace: nunca se arma una ruta con texto del modelo', () => {
    expect(rutaDeLoHecho('pedido_crear', null)).toBeNull();
    expect(rutaDeLoHecho('pedido_crear', '../../admin')).toBeNull();
    expect(rutaDeLoHecho('herramienta_rara', ID)).toBeNull();
  });
});

describe('estadoVivo', () => {
  it('sin respuesta en curso no hay estado', () => {
    expect(estadoVivo([paso('en_curso')], false)).toBeNull();
  });
  it('dice qué hace ahora: pensando, consultando o escribiendo', () => {
    expect(estadoVivo([], true)).toEqual({ texto: 'Pensando…', nivel: 'pensando' });
    expect(estadoVivo([paso('en_curso')], true)).toEqual({ texto: 'Listar pedidos…', nivel: 'trabajando' });
    expect(estadoVivo([paso('listo'), agente('Tienes', 'escribiendo')], true)).toEqual({ texto: 'Escribiendo…', nivel: 'escribiendo' });
  });
});

describe('respuestasRapidas', () => {
  it('una pregunta de sí o no ofrece Sí y No', () => {
    expect(respuestasRapidas([agente('Creé el pedido. ¿Quieres que lo confirme ahora?')], false)).toEqual(['Sí', 'No']);
  });
  it('una pregunta abierta, una respuesta que no pregunta o un turno en curso no ofrecen nada', () => {
    expect(respuestasRapidas([agente('¿Cuál es el teléfono del cliente?')], false)).toEqual([]);
    expect(respuestasRapidas([agente('Listo, ya quedó.')], false)).toEqual([]);
    expect(respuestasRapidas([agente('¿Lo confirmo?')], true)).toEqual([]);
    expect(respuestasRapidas([agente('¿Lo confirmo?', 'escribiendo')], false)).toEqual([]);
    expect(respuestasRapidas([], false)).toEqual([]);
  });
});

describe('pantalla vacía', () => {
  it('el saludo cambia con la hora', () => {
    expect([saludoPorHora(8), saludoPorHora(15), saludoPorHora(21)]).toEqual(['Buenos días', 'Buenas tardes', 'Buenas noches']);
  });
  it('los atajos son cuatro y tienen frase', () => {
    expect(ACCIONES_RAPIDAS).toHaveLength(4);
    for (const a of ACCIONES_RAPIDAS) expect(a.frase.length).toBeGreaterThan(3);
  });
});
