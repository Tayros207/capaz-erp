import { describe, expect, it } from 'vitest';
import { calcularTotalesDePedido } from '@capaz/shared';
import {
  aFavorDelCliente,
  avisosDeCorreccion,
  comprobarGuias,
  comprobarSoloPrecioEIgv,
  comprobarUmbralDeTrabajador,
  diferenciasDeLineas,
  fijarTotal,
  modoDeCorreccion,
  resolverLineas,
  resumenDeCorreccion,
  type LineaActual,
} from './correccion.js';

const actual = (id: string, extra: Partial<LineaActual> = {}): LineaActual => ({ id, posicion: 0, productoId: null, descripcion: 'Volantes', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 59_000, afectoIgv: true, importeCentimos: 11_800, ...extra });
const nueva = (id: string | undefined, extra: Record<string, unknown> = {}) => ({ id, descripcion: 'Volantes', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 59_000, afectoIgv: true, ...extra });

describe('modoDeCorreccion: estados y quién', () => {
  it('confirmado, en proceso y listo admiten montos y líneas a cualquiera con permiso', () => {
    for (const e of ['confirmado', 'en_proceso', 'listo'] as const) expect(modoDeCorreccion(e, 'member')).toEqual({ ok: true, modo: 'completa' });
  });
  it('entregado: solo precio e IGV y solo dueño o administrador', () => {
    expect(modoDeCorreccion('entregado', 'owner')).toEqual({ ok: true, modo: 'solo_precio' });
    expect(modoDeCorreccion('entregado', 'admin')).toEqual({ ok: true, modo: 'solo_precio' });
    expect(modoDeCorreccion('entregado', 'member')).toMatchObject({ ok: false, codigo: 'sin_permiso' });
    expect(modoDeCorreccion('entregado', null)).toMatchObject({ ok: false });
  });
  it('borrador remite a «Editar pedido» y cancelado no se corrige', () => {
    expect(modoDeCorreccion('borrador', 'owner')).toMatchObject({ ok: false, codigo: 'conflicto', motivo: expect.stringContaining('Editar pedido') });
    expect(modoDeCorreccion('cancelado', 'owner')).toMatchObject({ ok: false, codigo: 'conflicto', motivo: expect.stringContaining('cancelado') });
  });
});

describe('umbral del trabajador (10 % y S/ 100, sin excedente a favor)', () => {
  const u = (anterior: number, nuevo: number, abonado: number | null = null) => comprobarUmbralDeTrabajador({ totalAnteriorCentimos: anterior, totalNuevoCentimos: nuevo, abonadoCentimos: abonado });
  it('pasa justo en el límite y falla un céntimo después', () => {
    expect(u(50_000, 45_000).ok).toBe(true); // -10 %, -S/ 50
    expect(u(50_000, 44_999).ok).toBe(false);
    expect(u(50_000, 55_000).ok).toBe(true);
    expect(u(50_000, 55_001).ok).toBe(false);
  });
  it('en totales grandes manda el tope de S/ 100', () => {
    expect(u(1_000_000, 990_000).ok).toBe(true);
    expect(u(1_000_000, 989_999).ok).toBe(false);
  });
  it('sin diferencia siempre pasa (solo descripción o desglose)', () => {
    expect(u(11_800, 11_800).ok).toBe(true);
  });
  it('el excedente a favor del cliente exige aprobación aunque la diferencia sea chica', () => {
    const r = u(10_000, 9_900, 10_000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toContain('a su favor');
    expect(u(10_000, 9_900, 9_900).ok).toBe(true);
  });
  it('si el total no baja, un saldo a favor que ya existía no bloquea (corregir la entrega, subir el precio)', () => {
    expect(u(7_000, 7_000, 11_800).ok).toBe(true);
    expect(u(7_000, 7_500, 11_800).ok).toBe(true);
    expect(u(7_000, 6_900, 11_800).ok).toBe(false);
  });
  it('el mensaje dice cuánto cambia', () => {
    const r = u(10_000, 20_000);
    expect(r).toMatchObject({ ok: false, motivo: expect.stringContaining('S/ 100.00 a S/ 200.00') });
  });
});

describe('aFavorDelCliente', () => {
  it('es lo abonado que pasa del total nuevo', () => {
    expect(aFavorDelCliente(10_000, 7_000)).toBe(3_000);
    expect(aFavorDelCliente(5_000, 7_000)).toBe(0);
  });
});

describe('líneas: emparejar, diferencias y solo precio', () => {
  const antes = [actual('a'), actual('b', { descripcion: 'Tarjetas', posicion: 1 })];
  it('empareja por id y detecta agregadas y quitadas', () => {
    const r = resolverLineas(antes, [nueva('a'), nueva(undefined, { descripcion: 'Banner' })]);
    expect(r.ok && r.lineas).toMatchObject({ conservadas: [{ actual: { id: 'a' } }], agregadas: [{ descripcion: 'Banner' }], quitadas: [{ id: 'b' }] });
  });
  it('rechaza un id ajeno o repetido', () => {
    expect(resolverLineas(antes, [nueva('x')])).toMatchObject({ ok: false });
    expect(resolverLineas(antes, [nueva('a'), nueva('a')])).toMatchObject({ ok: false });
  });
  it('diferenciasDeLineas solo trae lo que cambió', () => {
    const despues = [
      { ...actual('a'), id: 'a', precioUnitarioMilesimas: 50_000, importeCentimos: 10_000 },
      { ...actual('c'), id: 'c', descripcion: 'Banner' },
    ];
    const d = diferenciasDeLineas(antes, despues);
    expect(d.map((x) => [x.cambio, x.descripcion])).toEqual([['cambiada', 'Volantes'], ['agregada', 'Banner'], ['quitada', 'Tarjetas']]);
    expect(d[0]).toMatchObject({ antes: { precioUnitarioMilesimas: 59_000 }, despues: { precioUnitarioMilesimas: 50_000 } });
  });
  it('un cambio solo de IGV (mismo total) también es diferencia', () => {
    const d = diferenciasDeLineas([actual('a')], [{ ...actual('a'), afectoIgv: false }]);
    expect(d).toHaveLength(1);
  });
  it('entregado: solo precio e IGV', () => {
    const ok = resolverLineas(antes, [nueva('a', { precioUnitarioMilesimas: 1 }), nueva('b', { descripcion: 'Tarjetas', afectoIgv: false })]);
    expect(ok.ok && comprobarSoloPrecioEIgv(ok.lineas)).toEqual({ ok: true });
    const cant = resolverLineas(antes, [nueva('a', { cantidadMilesimas: 1 }), nueva('b', { descripcion: 'Tarjetas' })]);
    expect(cant.ok && comprobarSoloPrecioEIgv(cant.lineas)).toMatchObject({ ok: false });
    const quita = resolverLineas(antes, [nueva('a')]);
    expect(quita.ok && comprobarSoloPrecioEIgv(quita.lineas)).toMatchObject({ ok: false });
  });
});

describe('guías de remisión', () => {
  const r = resolverLineas([actual('a'), actual('b')], [nueva('a', { cantidadMilesimas: 1500 })]);
  if (!r.ok) throw new Error('no resolvió');
  it('no se quita una línea que figura en una guía (aunque esté anulada)', () => {
    const c = comprobarGuias(r.lineas, { codigosPorLinea: new Map([['b', ['G001-0001']]]), enviadas: new Map() });
    expect(c).toMatchObject({ ok: false, motivo: expect.stringContaining('G001-0001') });
    expect(comprobarGuias(r.lineas, { codigosPorLinea: new Map(), enviadas: new Map() })).toEqual({ ok: true });
  });
  it('no se baja la cantidad por debajo de lo enviado en guías emitidas', () => {
    const c = comprobarGuias(r.lineas, { codigosPorLinea: new Map(), enviadas: new Map([['a', 1800]]) });
    expect(c).toMatchObject({ ok: false, motivo: expect.stringContaining('ya se enviaron 1.8') });
    expect(comprobarGuias(r.lineas, { codigosPorLinea: new Map(), enviadas: new Map([['a', 1500]]) }).ok).toBe(true);
  });
});

describe('fijarTotal', () => {
  const lineas = [
    { cantidadMilesimas: 2000, precioUnitarioMilesimas: 59_000, afectoIgv: true },
    { cantidadMilesimas: 3000, precioUnitarioMilesimas: 10_000, afectoIgv: true },
  ];
  it('llega al céntimo exacto', () => {
    for (const total of [14_800, 10_000, 9_999, 33_333, 1]) {
      const r = fijarTotal(lineas, total, 18);
      expect(r).not.toBeNull();
      expect(calcularTotalesDePedido(r!, 18).totalCentimos).toBe(total);
    }
  });
  it('si todas valen cero no hay cómo repartir', () => {
    expect(fijarTotal([{ cantidadMilesimas: 1000, precioUnitarioMilesimas: 0, afectoIgv: true }], 100, 18)).toBeNull();
  });
  it('barrido: con una línea chica siempre llega al céntimo; mezcla afectas y no afectas y no deja precios negativos', () => {
    const mezcla = [
      { cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 85, afectoIgv: true }, // 1000 × S/ 0.085
      { cantidadMilesimas: 1_500, precioUnitarioMilesimas: 33_333, afectoIgv: false },
      { cantidadMilesimas: 1_000, precioUnitarioMilesimas: 0, afectoIgv: true },
    ];
    for (let total = 1; total <= 50_000; total += 997) {
      const r = fijarTotal(mezcla, total, 18);
      expect(r).not.toBeNull();
      expect(calcularTotalesDePedido(r!, 18).totalCentimos).toBe(total);
      expect(r!.every((l) => l.precioUnitarioMilesimas >= 0)).toBe(true);
      expect(r![2]!.precioUnitarioMilesimas).toBe(0); // la línea en cero no recibe nada
    }
  });
  it('una sola línea de cantidad grande no siempre puede dar el céntimo exacto: devuelve null (el servidor lo rechaza, no inventa)', () => {
    // 1000 × S/ 0.085 = S/ 85.00; con precios de 3 decimales esa línea solo da múltiplos de S/ 1.00.
    expect(fijarTotal([{ cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 85, afectoIgv: true }], 10_030, 18)).toBeNull();
    expect(calcularTotalesDePedido(fijarTotal([{ cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 85, afectoIgv: true }], 10_000, 18)!, 18).totalCentimos).toBe(10_000);
  });
  it('un total desmedido no rompe los enteros: lanza (la herramienta responde «demasiado grande»)', () => {
    expect(() => fijarTotal([{ cantidadMilesimas: 1000, precioUnitarioMilesimas: 1000, afectoIgv: true }], Number.MAX_SAFE_INTEGER, 18)).toThrow();
  });
});

describe('avisos y resumen', () => {
  it('avisa al taller solo si ya trabaja', () => {
    expect(avisosDeCorreccion('confirmado', 2, false)).toEqual([]);
    expect(avisosDeCorreccion('en_proceso', 2, false)[0]).toContain('reimprime la orden de trabajo versión 2');
    expect(avisosDeCorreccion('listo', 3, true)).toHaveLength(2);
  });
  it('resume el antes y el después', () => {
    const t = resumenDeCorreccion({ lineas: [{ cambio: 'cambiada', lineaId: 'a', descripcion: 'x', antes: null, despues: null }], datos: [], totalAnteriorCentimos: 11_800, totalNuevoCentimos: 10_000, versionAnterior: 1, versionNueva: 2 });
    expect(t).toBe('v1 → v2: 1 línea cambiada · total S/ 118.00 → S/ 100.00');
  });
});
