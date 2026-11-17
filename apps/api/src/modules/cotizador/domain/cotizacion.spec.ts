import { describe, expect, it } from 'vitest';
import { CLAVE_DE_CORRELATIVO, codigoDeCotizacion, descripcionDeLineaAceptada, elegirPosiciones, fusionarCondiciones, lineaParaEvento, sumarDias } from './cotizacion.js';

describe('código', () => {
  it('Borrador sin número; COT-2026-0001; v2 desde la segunda versión', () => {
    expect(codigoDeCotizacion(null, null)).toBe('Borrador');
    expect(codigoDeCotizacion(1, 2026)).toBe('COT-2026-0001');
    expect(codigoDeCotizacion(1, 2026, 1)).toBe('COT-2026-0001');
    expect(codigoDeCotizacion(1, 2026, 2)).toBe('COT-2026-0001 v2');
    expect(codigoDeCotizacion(12345, 2026)).toBe('COT-2026-12345');
    expect(CLAVE_DE_CORRELATIVO).toBe('cotizador.cotizacion');
  });
});

describe('sumarDias', () => {
  it('cruza mes, año y bisiestos', () => {
    expect(sumarDias('2026-11-16', 15)).toBe('2026-12-01');
    expect(sumarDias('2026-12-20', 15)).toBe('2027-01-04');
    expect(sumarDias('2028-02-20', 10)).toBe('2028-03-01');
  });
});

describe('fusionarCondiciones', () => {
  const config = { validezDias: 15, plazoEntrega: '5 días', formaPago: '50 % adelanto', tolerancia: '', noIncluye: 'Diseño' };
  it('lo propio manda; lo vacío o nulo toma el valor de la configuración', () => {
    expect(fusionarCondiciones(config, {})).toEqual(config);
    expect(fusionarCondiciones(config, { validezDias: 7, plazoEntrega: '', formaPago: 'Contado' })).toEqual({ ...config, validezDias: 7, formaPago: 'Contado' });
    expect(fusionarCondiciones({ ...config, validezDias: null }, { validezDias: null }).validezDias).toBeNull();
  });
});

describe('línea del evento (§10.1)', () => {
  it('2.500 unidades de volantes a 408730 milésimas con IGV', () => {
    const l = { productoId: 'p1', cantidadMilesimas: 2_500_000, unidad: 'unidad', descripcion: 'Volantes A5 4/4 couché 150 g', totalCentimos: 40_873 };
    expect(descripcionDeLineaAceptada(l)).toBe('2.500 unidades · Volantes A5 4/4 couché 150 g');
    expect(lineaParaEvento(l, 18)).toEqual({ productoId: 'p1', descripcion: '2.500 unidades · Volantes A5 4/4 couché 150 g', unidad: 'lote', cantidadMilesimas: 1000, precioUnitarioMilesimas: 408_730, afectoIgv: true });
    expect(lineaParaEvento(l, 0).afectoIgv).toBe(false);
  });

  it('cantidades con decimales, otra unidad y tope de 300 caracteres', () => {
    expect(descripcionDeLineaAceptada({ cantidadMilesimas: 1500, unidad: 'hora', descripcion: 'Diseño' })).toBe('1,5 hora · Diseño');
    expect(descripcionDeLineaAceptada({ cantidadMilesimas: 1000, unidad: 'unidad', descripcion: 'x' })).toBe('1 unidad · x');
    expect(descripcionDeLineaAceptada({ cantidadMilesimas: 1000, unidad: 'unidad', descripcion: 'a'.repeat(400) })).toHaveLength(300);
  });
});

describe('elegirPosiciones', () => {
  const existentes = [0, 1, 2];
  it('por defecto todas; con opciones hay que indicar cuáles', () => {
    expect(elegirPosiciones({ conOpciones: false, existentes })).toEqual({ ok: true, posiciones: [0, 1, 2] });
    expect(elegirPosiciones({ conOpciones: true, existentes })).toMatchObject({ ok: false });
  });
  it('ordena, quita repetidas y rechaza una posición que no existe', () => {
    expect(elegirPosiciones({ conOpciones: true, existentes, posiciones: [2, 0, 2] })).toEqual({ ok: true, posiciones: [0, 2] });
    expect(elegirPosiciones({ conOpciones: false, existentes, posiciones: [3] })).toEqual({ ok: false, motivo: 'La línea 4 no existe en esta cotización.' });
  });
});
