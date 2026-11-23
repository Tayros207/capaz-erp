import { describe, expect, it } from 'vitest';
import type { DetallePublico } from '../domain/enlaces.js';
import { paginaDeCotizacion } from './plantilla-publica.js';

const detalle = (extra: Partial<DetallePublico> = {}): DetallePublico => ({
  empresa: { razonSocial: 'Imprenta Sol', ruc: null, direccion: null, telefono: null, correo: null, pie: null, logo: null },
  codigo: 'COT-2026-0001', version: 1, estado: 'emitida', titulo: 'Volantes', cliente: 'Ana', validaHasta: null, conOpciones: false, igvPorcentaje: 18,
  lineas: [{ posicion: 0, descripcion: 'Volantes', cantidad: '1 unidad', totalCentimos: 11_800, aceptada: false }],
  subtotalCentimos: 10_000, igvCentimos: 1_800, totalCentimos: 11_800, condiciones: [], puedeDecidir: false, ...extra,
});
const ruta = { ruta: '/api/v1/c/x' };

describe('página pública de la cotización y el IGV', () => {
  it('con IGV desglosa subtotal, IGV y total con IGV', () => {
    const h = paginaDeCotizacion(detalle(), ruta);
    expect(h).toContain('Subtotal');
    expect(h).toContain('IGV (18 %)');
    expect(h).toContain('Total con IGV');
  });
  it('sin IGV (no se factura) solo muestra el total, sin ninguna mención al IGV en los totales', () => {
    const h = paginaDeCotizacion(detalle({ igvPorcentaje: 0, igvCentimos: 0, subtotalCentimos: 11_800 }), ruta);
    expect(h).not.toContain('Subtotal');
    expect(h).not.toContain('IGV');
    expect(h).toContain('Total');
  });
  it('sin IGV y con opciones, ni la columna ni la nota hablan del IGV', () => {
    const h = paginaDeCotizacion(detalle({ igvPorcentaje: 0, igvCentimos: 0, conOpciones: true }), ruta);
    expect(h).not.toContain('IGV');
    expect(paginaDeCotizacion(detalle({ conOpciones: true }), ruta)).toContain('Importe con IGV');
  });
});
