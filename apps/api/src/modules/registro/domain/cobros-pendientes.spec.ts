import { describe, expect, it } from 'vitest';
import { tramoDe } from './antiguedad.js';
import { agruparCobros, anotacionesDeDeudas, diasVencida, tocaCobrar, type DeudaPorCobrar } from './cobros-pendientes.js';

const HOY = '2026-11-18';
const deuda = (o: Partial<DeudaPorCobrar> & { dias: number }): DeudaPorCobrar => {
  const { dias, ...resto } = o;
  const venceEn = new Date(Date.parse(`${HOY}T00:00:00Z`) - dias * 86_400_000).toISOString().slice(0, 10);
  return { contactoId: 'c1', contactoNombre: 'Sol', contactoTelefono: '987654321', saldoCentimos: 10_000, fecha: '2026-01-01', venceEn, ...resto };
};

describe('agruparCobros', () => {
  it('agrupa por cliente, reparte en tramos 0-30 / 31-60 / 61+ y guarda el más antiguo', () => {
    const r = agruparCobros([deuda({ dias: 5, saldoCentimos: 1_000 }), deuda({ dias: 30, saldoCentimos: 2_000 }), deuda({ dias: 31, saldoCentimos: 4_000 }), deuda({ dias: 60, saldoCentimos: 8_000 }), deuda({ dias: 61, saldoCentimos: 16_000 })], HOY);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ tramo0a30Centimos: 3_000, tramo31a60Centimos: 12_000, tramo61masCentimos: 16_000, totalCentimos: 31_000, diasMasAntiguo: 61, deudas: 5 });
  });
  it('ignora lo vigente, lo que vence hoy y lo sin saldo', () => {
    expect(agruparCobros([deuda({ dias: 0 }), deuda({ dias: -3 }), deuda({ dias: 10, saldoCentimos: 0 })], HOY)).toEqual([]);
  });
  it('ordena al cliente con la deuda más vieja primero y, a igualdad, el de más monto', () => {
    const r = agruparCobros([
      deuda({ contactoId: 'a', contactoNombre: 'A', dias: 10, saldoCentimos: 100 }),
      deuda({ contactoId: 'b', contactoNombre: 'B', dias: 70, saldoCentimos: 50 }),
      deuda({ contactoId: 'c', contactoNombre: 'C', dias: 10, saldoCentimos: 900 }),
    ], HOY);
    expect(r.map((c) => c.contactoId)).toEqual(['b', 'c', 'a']);
  });
  it('sin vencimiento escrito: se recuerda pasados 30 días, pero sus días cuentan desde su fecha (como «Antigüedad de saldos»)', () => {
    expect(diasVencida({ fecha: '2026-10-01', venceEn: null }, HOY)).toBe(48);
    expect(tocaCobrar({ fecha: '2026-10-19', venceEn: null }, HOY)).toBe(false); // 30 días: todavía en plazo
    expect(tocaCobrar({ fecha: '2026-10-18', venceEn: null }, HOY)).toBe(true); // 31 días
    expect(agruparCobros([deuda({ dias: 0, venceEn: null, fecha: '2026-11-10' })], HOY)).toEqual([]);
    const [c] = agruparCobros([deuda({ dias: 0, venceEn: null, fecha: '2026-10-01' })], HOY);
    expect(c).toMatchObject({ diasMasAntiguo: 48, tramo31a60Centimos: 10_000 });
  });
  it('los días y el tramo coinciden con «Antigüedad de saldos» (tramoDe)', () => {
    const casos = [deuda({ dias: 1 }), deuda({ dias: 30 }), deuda({ dias: 31 }), deuda({ dias: 75 }), deuda({ dias: 0, venceEn: null, fecha: '2026-09-01' })];
    const esperado: Record<string, string> = { de_1_a_30: 'tramo0a30Centimos', de_31_a_60: 'tramo31a60Centimos', de_61_a_90: 'tramo61masCentimos', mas_de_90: 'tramo61masCentimos' };
    for (const d of casos) {
      const [c] = agruparCobros([d], HOY);
      expect(c![esperado[tramoDe(d, HOY)] as 'tramo0a30Centimos']).toBe(d.saldoCentimos);
    }
  });
});

describe('anotacionesDeDeudas', () => {
  const d = (o: Partial<Parameters<typeof anotacionesDeDeudas>[0][number]>) => ({ origenTipo: 'pedido', origenId: 'p1', estado: 'pendiente', totalCentimos: 10_000, abonadoCentimos: 0, ...o });
  it('pagada es «Pagado»; con saldo, «Debe S/ X»; el adelanto se marca', () => {
    const r = anotacionesDeDeudas([d({ estado: 'pagada', abonadoCentimos: 10_000 }), d({ origenId: 'p2', estado: 'parcial', abonadoCentimos: 4_000 }), d({ origenId: 'p3' })]);
    expect(r[0]).toMatchObject({ entidad: { tipo: 'pedido', id: 'p1' }, texto: 'Pagado', pagado: true, tono: 'exito' });
    expect(r[1]).toMatchObject({ texto: 'Debe S/ 60.00', pagado: false, conAdelanto: true });
    expect(r[2]).toMatchObject({ texto: 'Debe S/ 100.00', conAdelanto: false });
  });
  it('produccion apunta a la orden de trabajo; anuladas y orígenes ajenos no dicen nada', () => {
    const r = anotacionesDeDeudas([d({ origenTipo: 'produccion', origenId: 'o1' }), d({ estado: 'anulada' }), d({ origenTipo: 'compra' })]);
    expect(r).toHaveLength(1);
    expect(r[0]!.entidad).toEqual({ tipo: 'orden_trabajo', id: 'o1' });
  });
  it('dos deudas del mismo pedido se suman en una sola anotación (nunca «Pagado» y «Debe» a la vez)', () => {
    const r = anotacionesDeDeudas([d({ estado: 'pagada', abonadoCentimos: 10_000 }), d({ totalCentimos: 5_000 }), d({ estado: 'anulada', totalCentimos: 99_000 })]);
    expect(r).toEqual([{ entidad: { tipo: 'pedido', id: 'p1' }, texto: 'Debe S/ 50.00', tono: 'aviso', pagado: false, conAdelanto: true }]);
    // El mismo id en otro tipo de origen es otra entidad.
    expect(anotacionesDeDeudas([d({}), d({ origenTipo: 'produccion' })]).map((a) => a.entidad.tipo)).toEqual(['pedido', 'orden_trabajo']);
  });
});
