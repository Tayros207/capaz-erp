import { describe, expect, it } from 'vitest';
import type { CotizacionCompletaDto } from '@capaz/shared';
import { condicionesParaDocumento, enlaceDeWhatsApp, filasDelDocumento, mensajeDeWhatsApp, precioQueCuadra, telefonoParaWhatsApp, totalesDelDocumento } from './documento-cotizacion.ts';

const linea = (posicion: number, extra = {}) => ({
  posicion, tipo: 'manual', productoId: null, listaId: null, descripcion: `L${posicion}`, unidad: 'millar', cantidadMilesimas: 2500, precioUnitarioMilesimas: 138_552, importeCentimos: 34_638, igvCentimos: 6235, totalCentimos: 40_873, ...extra,
}) as CotizacionCompletaDto['lineas'][number];

describe('documento Cotización', () => {
  it('las filas salen por posición con precio, importe y total del servidor', () => {
    const filas = filasDelDocumento([linea(1), linea(0)]);
    expect(filas.map((f) => f.descripcion)).toEqual(['L0', 'L1']);
    expect(filas[0]).toEqual({ n: 1, descripcion: 'L0', cantidad: '2.5 millar', precio: 'S/ 138.552', importe: 'S/ 346.38', total: 'S/ 408.73' });
  });
  it('las filas no llevan costo ni margen', () => {
    const f = filasDelDocumento([linea(0, { costoCentimos: 5, margenPct: '10' })])[0] as Record<string, unknown>;
    expect(Object.keys(f).join()).not.toMatch(/costo|margen/i);
  });
  it('totales: subtotal, IGV y total; sin totales con opciones', () => {
    const t = totalesDelDocumento({ conOpciones: false, subtotalCentimos: 34_638, igvCentimos: 6235, totalCentimos: 40_873, igvPorcentaje: 18 });
    expect(t?.map((x) => [x.etiqueta, x.valor])).toEqual([['Subtotal', 'S/ 346.38'], ['IGV (18%)', 'S/ 62.35'], ['Total', 'S/ 408.73']]);
    expect(totalesDelDocumento({ conOpciones: true, subtotalCentimos: 1, igvCentimos: 1, totalCentimos: 2, igvPorcentaje: 18 })).toBeUndefined();
  });
  it('condiciones: solo las que tienen texto', () => {
    const c = condicionesParaDocumento({ validaHasta: '2026-12-01', condiciones: { validezDias: 15, plazoEntrega: '5 días', formaPago: '', tolerancia: '  ', noIncluye: 'Flete' } });
    expect(c).toEqual([{ etiqueta: 'Válida hasta', valor: '01/12/2026' }, { etiqueta: 'Plazo de entrega', valor: '5 días' }, { etiqueta: 'No incluye', valor: 'Flete' }]);
  });
});

describe('WhatsApp', () => {
  const base = { codigo: 'COT-2026-0001', clienteNombre: 'Ana', totalCentimos: 40_873, conOpciones: false };
  it('usa el mensaje de la configuración si existe', () => {
    expect(mensajeDeWhatsApp(base, ' Hola, aquí va la cotización ')).toBe('Hola, aquí va la cotización');
  });
  it('mensaje por defecto con total', () => {
    expect(mensajeDeWhatsApp(base, null)).toBe('Hola Ana, te enviamos la cotización COT-2026-0001 por un total de S/ 408.73. Te adjuntamos la cotización en PDF.');
    expect(mensajeDeWhatsApp(base, '  ')).toContain('S/ 408.73');
  });
  it('con opciones no anuncia total', () => {
    expect(mensajeDeWhatsApp({ ...base, conOpciones: true }, null)).toContain('con sus opciones');
    expect(mensajeDeWhatsApp({ ...base, conOpciones: true }, null)).not.toContain('S/');
  });
  it('teléfono y enlace', () => {
    expect(telefonoParaWhatsApp('987 654 321')).toBe('51987654321');
    expect(telefonoParaWhatsApp('123')).toBeNull();
    expect(enlaceDeWhatsApp('987654321', 'Hola Ana')).toBe('https://wa.me/51987654321?text=Hola%20Ana');
    expect(enlaceDeWhatsApp(null, 'x')).toBeNull();
  });
});

describe('precio unitario que cuadra con el importe', () => {
  it('conserva el guardado cuando multiplicado da el importe', () => {
    expect(precioQueCuadra({ cantidadMilesimas: 2500, precioUnitarioMilesimas: 138_552, importeCentimos: 34_638 })).toBe('S/ 138.552');
  });
  it('un cuadro por partes (S/ 5,386.50 por 1,000 unidades) muestra 5.3865 y no 5.387', () => {
    expect(precioQueCuadra({ cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 5_387, importeCentimos: 538_650 })).toBe('S/ 5.3865');
  });
  it('no pierde los miles ni deja ceros de más', () => {
    expect(precioQueCuadra({ cantidadMilesimas: 3_000, precioUnitarioMilesimas: 1_234_567, importeCentimos: 370_370 })).toBe('S/ 1,234.567');
    expect(precioQueCuadra({ cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 5_400, importeCentimos: 540_030 })).toBe('S/ 5.4003');
  });
});
