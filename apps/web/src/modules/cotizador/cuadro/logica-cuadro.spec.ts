import { describe, expect, it } from 'vitest';
import { agruparPorFactor, avisosDeImposicion, columnasQueSeEnvian, filaDePapel, pideMotivoAntesDeEmitir, sePuedeEmitir, textoDeImporte, textoDePorcentaje, textoDeUnitario, type Vista } from './logica-cuadro.ts';

const columna = (c: '100' | '1000' | '5000', seEnvia: boolean) => ({ cantidad: c, esBase: false, seEnvia, completa: false, motivo: null, comercial: null });
const base = {
  cotizacionId: 'c1', version: 1, estado: 'borrador',
  trabajo: { producto: 'Volantes', cantidad: '2500', pieza: null, tintas: 4, caras: 2, cliente: '' },
  imposicion: { parametros: { pliegoMadre: null, pliegoMaquina: null, sangradoCm: null, calleCm: null, pinzaCm: null, formatoMaximo: null, etapas: [] }, calculada: null, faltantes: [], problema: null },
  lineas: [
    { id: 'a', numero: 1, factor: 'material', descripcion: 'Papel', cantidad: '172', unidad: 'pliego', escala: 'por_pliego', automatica: 'papel' },
    { id: 'b', numero: 2, factor: 'acabado', descripcion: 'Corte', cantidad: '1', unidad: 'lote', escala: 'fija', automatica: null },
  ],
  precioFinalCentimos: null, moneda: 'PEN', comercial: null,
  directo: { base: null, columnas: { '100': columna('100', true), '1000': columna('1000', false), '5000': columna('5000', true) }, coherencia: null },
} as unknown as Vista;
const conCostos = (semaforo: 'verde' | 'rojo'): Vista => ({
  ...base, interno: { utilidad: { pct: '35', base: 'venta' }, costos: { costoCentimos: 100, utilidadCentimos: 50, precioSugeridoCentimos: 150, margenPct: '33.33', semaforo, porFactorCentimos: { material: 70, planchas: 0, impresion: 0, diseno: 0, acabado: 30, indirectos: 0 } } },
});

describe('formato para mostrar', () => {
  it('importes en soles y porcentajes sin ceros de relleno', () => {
    expect(textoDeImporte(34_638)).toBe('S/ 346.38');
    expect(textoDeImporte(null)).toBe('—');
    expect(textoDePorcentaje('35.000')).toBe('35 %');
    expect(textoDePorcentaje(null)).toBe('—');
    expect(textoDeUnitario(139)).toBe('S/ 0.139');
  });
});

describe('agrupar por factor', () => {
  it('muestra los seis factores en orden y el subtotal solo si el servidor lo mandó', () => {
    const sin = agruparPorFactor(base);
    expect(sin.map((g) => g.factor)).toEqual(['material', 'planchas', 'impresion', 'diseno', 'acabado', 'indirectos']);
    expect(sin[0]?.filas).toHaveLength(1);
    expect(sin.every((g) => g.subtotalCentimos === null)).toBe(true);
    const con = agruparPorFactor(conCostos('verde'));
    expect(con.find((g) => g.factor === 'acabado')?.subtotalCentimos).toBe(30);
  });
});

describe('estado del cuadro', () => {
  it('junta lo que falta y el problema de la imposición', () => {
    expect(avisosDeImposicion(base)).toEqual([]);
    const v = { ...base, imposicion: { ...base.imposicion, faltantes: ['pliego madre', 'pieza'], problema: 'La pieza no cabe.' } } as Vista;
    expect(avisosDeImposicion(v)).toEqual(['Falta: pliego madre, pieza.', 'La pieza no cabe.']);
  });
  it('solo se emite un borrador con precio', () => {
    expect(sePuedeEmitir(base)).toBe(false);
    const con = { ...base, comercial: { precioCentimos: 1, unitarioMilesimas: null, impuesto: null, totalConImpuestoCentimos: 1 } } as Vista;
    expect(sePuedeEmitir(con)).toBe(true);
    expect(sePuedeEmitir({ ...con, estado: 'emitida' })).toBe(false);
  });
  it('pide motivo con el semáforo en rojo, y no lo sabe sin costos', () => {
    expect(pideMotivoAntesDeEmitir(conCostos('rojo'))).toBe(true);
    expect(pideMotivoAntesDeEmitir(conCostos('verde'))).toBe(false);
    expect(pideMotivoAntesDeEmitir(base)).toBe(false);
  });
  it('encuentra el papel y las cantidades que se envían', () => {
    expect(filaDePapel(base)?.id).toBe('a');
    expect(columnasQueSeEnvian(base)).toEqual(['100', '5000']);
  });
});
