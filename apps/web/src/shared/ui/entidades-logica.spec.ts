import { describe, expect, it } from 'vitest';
import { inicialesDe, rutaDeEntidad, tonoDeEstado } from './entidades-logica.ts';

describe('entidades compartidas', () => {
  it('lleva cada entidad a su ficha', () => {
    expect(rutaDeEntidad('cliente', 'a1')).toBe('/clientes/a1');
    expect(rutaDeEntidad('pedido', 'p1')).toBe('/m/ordenes/p1');
    expect(rutaDeEntidad('deuda', 'd1')).toBe('/m/registro/deudas/d1');
    expect(rutaDeEntidad('movimiento', 'm1')).toBe('/m/registro/movimientos/m1');
    expect(rutaDeEntidad('producto', 'r1')).toBe('/productos/r1');
    expect(rutaDeEntidad('cotizacion', 'c1')).toBe('/m/cotizador/cotizaciones/c1');
  });
  it('saca iniciales', () => {
    expect(inicialesDe('Ana María Pérez')).toBe('AM');
    expect(inicialesDe('  ')).toBe('?');
  });
  it('da el mismo tono a un mismo estado', () => {
    expect(tonoDeEstado('Pagada')).toBe('exito');
    expect(tonoDeEstado('Vencida')).toBe('peligro');
    expect(tonoDeEstado('Pendiente')).toBe('aviso');
    expect(tonoDeEstado('En producción')).toBe('info');
    expect(tonoDeEstado('Aceptada')).toBe('exito');
    expect(tonoDeEstado('Emitida')).toBe('info');
    expect(tonoDeEstado('Otro')).toBe('neutro');
  });
});
