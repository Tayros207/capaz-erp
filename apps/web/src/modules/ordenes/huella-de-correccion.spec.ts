import { describe, expect, it } from 'vitest';
import type { CorreccionDePedidoDto } from '@capaz/shared';
import { lineasDeHuella } from './datos-de-pedido.ts';
import { lineasDeCambio, lineasDeHuellaDeCorreccion, textoDeDelta, textoDeValoresDeLinea, tonoDeDelta } from './huella-de-correccion.ts';
import { textoDeEvento } from './logica.ts';

const v = (precio: number, importe: number) => ({ descripcion: 'Polo', unidad: 'unidad', cantidadMilesimas: 50_000, precioUnitarioMilesimas: precio, afectoIgv: true, importeCentimos: importe });
const c: CorreccionDePedidoDto = {
  versionAnterior: 1, versionNueva: 2, motivoCodigo: 'igv', motivoTexto: 'Se cobró de más', estadoAlCorregir: 'confirmado',
  totalAnteriorCentimos: 11_800, totalNuevoCentimos: 10_000, deltaCentimos: -1_800, subtotalAnteriorCentimos: 10_000, subtotalNuevoCentimos: 8_475, igvAnteriorCentimos: 1_800, igvNuevoCentimos: 1_525,
  lineas: [{ cambio: 'cambiada', lineaId: 'a', descripcion: 'Polo', antes: v(236, 11_800), despues: v(200, 10_000) }], datos: [{ campo: 'entregaEl', antes: '2026-11-10', despues: '2026-11-12' }], abonadoCentimos: 11_800, aFavorCentimos: 1_800,
};

describe('huella de una corrección', () => {
  it('cuenta versión, motivo, líneas, total y lo que queda a favor', () => {
    const t = lineasDeHuellaDeCorreccion(c);
    expect(t[0]).toBe('Versión 1 → 2');
    expect(t[1]).toBe('Motivo: IGV · Se cobró de más');
    expect(t.some((l) => l.includes('«Polo»') && l.includes('→'))).toBe(true);
    expect(t).toContain('Entrega: 10/11/2026 → 12/11/2026');
    expect(t).toContain('Total: S/ 118.00 → S/ 100.00 (−S/ 18.00)');
    expect(t.at(-1)).toBe('A favor del cliente: S/ 18.00 (no se devuelve)');
  });
  it('el historial la usa y el evento se titula con la versión nueva', () => {
    expect(lineasDeHuella({ cambios: [], motivo: 'x', correccion: c })[0]).toBe('Versión 1 → 2');
    expect(textoDeEvento({ tipo: 'corregido', estadoAnterior: null, estadoNuevo: null, nota: null, detalle: { cambios: [], correccion: c } })).toBe('Se corrigió el pedido: ahora es la versión 2');
    expect(textoDeEvento({ tipo: 'corregido', estadoAnterior: null, estadoNuevo: null, nota: null })).toBe('Se corrigió el pedido');
  });
  it('el recuadro del documento no repite el motivo ni lo pagado', () => {
    expect(lineasDeCambio(c).join('\n')).not.toMatch(/Motivo|A favor/);
  });
  it('el unitario conserva sus milésimas', () => {
    expect(textoDeValoresDeLinea(v(85, 4)).includes('S/ 0.085')).toBe(true);
  });
});

describe('diferencia', () => {
  it('texto y tono con signo escrito', () => {
    expect(textoDeDelta(2_000)).toBe('+S/ 20.00');
    expect(textoDeDelta(-2_000)).toBe('−S/ 20.00');
    expect(textoDeDelta(0)).toBe('Sin cambio');
    expect([tonoDeDelta(1), tonoDeDelta(-1), tonoDeDelta(0)]).toEqual(['exito', 'peligro', 'neutro']);
  });
});
