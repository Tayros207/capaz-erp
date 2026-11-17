import { describe, expect, it } from 'vitest';
import { ajusteDeDetalle, armarLineas, avisosDeCambioDePrecio, conFotoDeLista, detalleDeAjuste, entradaDeLineaGuardada, totalesDe, type ContextoDeLineas, type ListaDeLinea } from './lineas.js';

const C7: ListaDeLinea = { id: 'l1', nombre: 'Volantes A5 4/4 couché 150 g', unidad: 'unidad', productoId: null, archivada: false, p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000, modoIntermedio: 'curva', precioMinimoCentimos: null };
const contexto = (extra: Partial<ContextoDeLineas> = {}): ContextoDeLineas => ({ listas: new Map([['l1', C7], ['l2', { ...C7, id: 'l2', archivada: true }]]), ajusteClientePct: null, redondeo: 'ninguno', igvPorcentaje: 18, ...extra });

describe('armarLineas', () => {
  it('una línea de lista de 2.500 unidades: 87739 + 15793 de IGV = 103532', () => {
    const r = armarLineas([{ tipo: 'lista', listaId: 'l1', cantidadMilesimas: 2_500_000 }], contexto());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.lineas[0]).toMatchObject({ tipo: 'lista', listaId: 'l1', descripcion: C7.nombre, unidad: 'unidad', importeCentimos: 87_739, igvCentimos: 15_793, totalCentimos: 103_532, precioUnitarioMilesimas: 351 });
  });

  it('el ajuste del cliente y el redondeo comercial entran en el precio', () => {
    const r = armarLineas([{ tipo: 'lista', listaId: 'l1', cantidadMilesimas: 2_000_000 }], contexto({ redondeo: '1' }));
    expect(r.ok && r.lineas[0]?.importeCentimos).toBe(79_400);
    const con = armarLineas([{ tipo: 'lista', listaId: 'l1', cantidadMilesimas: 1_000_000 }], contexto({ ajusteClientePct: '-5.000' }));
    expect(con.ok && con.lineas[0]).toMatchObject({ importeCentimos: 55_100, detalle: { precioListaCentimos: 55_100 } });
  });

  it('una línea manual: importe = cantidad × precio, IGV por línea; con IGV 0 no hay IGV', () => {
    const e = [{ tipo: 'manual', descripcion: 'Diseño', unidad: 'hora', cantidadMilesimas: 2_500, precioUnitarioMilesimas: 40_000 }] as const;
    const r = armarLineas(e, contexto());
    expect(r.ok && r.lineas[0]).toMatchObject({ listaId: null, importeCentimos: 10_000, igvCentimos: 1_800, totalCentimos: 11_800, detalle: {} });
    expect(armarLineas(e, contexto({ igvPorcentaje: 0 }))).toMatchObject({ ok: true, lineas: [{ igvCentimos: 0, totalCentimos: 10_000 }] });
  });

  it('rechaza con el número de línea: lista inexistente, archivada y fuera de rango', () => {
    const manual = { tipo: 'manual', descripcion: 'x', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1000 } as const;
    expect(armarLineas([manual, { tipo: 'lista', listaId: 'otra', cantidadMilesimas: 100_000 }], contexto())).toEqual({ ok: false, codigo: 'no_encontrado', mensaje: 'Línea 2: no existe esa lista de precios.' });
    expect(armarLineas([{ tipo: 'lista', listaId: 'l2', cantidadMilesimas: 100_000 }], contexto())).toMatchObject({ ok: false, codigo: 'conflicto' });
    const fuera = armarLineas([{ tipo: 'lista', listaId: 'l1', cantidadMilesimas: 99_000 }], contexto());
    expect(fuera).toMatchObject({ ok: false, codigo: 'conflicto' });
    if (!fuera.ok) expect(fuera.mensaje).toMatch(/^Línea 1: 99 unidades está fuera de 100 a 5\.000/);
  });
});

describe('totalesDe y entradaDeLineaGuardada', () => {
  it('los totales son sumas de las líneas', () => {
    expect(totalesDe([{ importeCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873 }, { importeCentimos: 100, igvCentimos: 18, totalCentimos: 118 }])).toEqual({ subtotalCentimos: 34_738, igvCentimos: 6_253, totalCentimos: 40_991 });
  });

  it('una línea guardada vuelve a su forma de entrada', () => {
    const base = { productoId: null, descripcion: 'D', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 5 };
    expect(entradaDeLineaGuardada({ ...base, tipo: 'lista', listaId: 'l1' })).toEqual({ tipo: 'lista', listaId: 'l1', cantidadMilesimas: 1000, descripcion: 'D' });
    expect(entradaDeLineaGuardada({ ...base, tipo: 'manual', listaId: null })).toMatchObject({ tipo: 'manual', precioUnitarioMilesimas: 5 });
  });
});

describe('ajuste por línea', () => {
  const unaDeLista = (ajuste?: object) => armarLineas([{ tipo: 'lista', listaId: 'l1', cantidadMilesimas: 1_000_000, ...(ajuste && { ajuste }) } as never], contexto());

  it('precio fija el importe, monto suma o resta; la lista y el ajuste quedan en el rastro', () => {
    const fijo = unaDeLista({ tipo: 'precio', importeCentimos: 50_000 });
    expect(fijo.ok && fijo.lineas[0]).toMatchObject({ importeCentimos: 50_000, igvCentimos: 9_000, detalle: { precioListaCentimos: 58_000, ajusteTipo: 'precio', ajusteCentimos: 50_000 } });
    const resta = unaDeLista({ tipo: 'monto', importeCentimos: -8_000 });
    expect(resta.ok && resta.lineas[0]).toMatchObject({ importeCentimos: 50_000, detalle: { ajusteTipo: 'monto', ajusteCentimos: -8_000 } });
    const sin = unaDeLista();
    expect(sin.ok && sin.lineas[0]?.detalle).toMatchObject({ ajusteTipo: 'ninguno' });
  });

  it('un final que no es mayor que cero se rechaza', () => {
    expect(unaDeLista({ tipo: 'monto', importeCentimos: -58_000 })).toMatchObject({ ok: false, codigo: 'argumentos_invalidos' });
  });

  it('el ajuste se guarda y se restituye; sin ajuste o con rastro viejo, ninguno', () => {
    expect(ajusteDeDetalle(detalleDeAjuste({ tipo: 'monto', importeCentimos: -300 }))).toEqual({ tipo: 'monto', importeCentimos: -300 });
    expect(ajusteDeDetalle({})).toEqual({ tipo: 'ninguno' });
    expect(ajusteDeDetalle({ ajusteTipo: 'precio' })).toEqual({ tipo: 'ninguno' });
    const base = { productoId: null, descripcion: 'D', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 5, tipo: 'lista' as const, listaId: 'l1' };
    expect(entradaDeLineaGuardada({ ...base, detalle: detalleDeAjuste({ tipo: 'precio', importeCentimos: 700 }) })).toMatchObject({ ajuste: { tipo: 'precio', importeCentimos: 700 } });
  });
});

describe('precios al día', () => {
  const nueva = (importe: number, lista: number) => ({ tipo: 'lista', descripcion: 'D', importeCentimos: importe, detalle: { precioListaCentimos: lista } }) as never;
  it('avisa solo de las líneas de lista cuyo precio cambió', () => {
    const guardadas = [{ tipo: 'lista', descripcion: 'Volantes', importeCentimos: 58_000, detalle: { precioListaCentimos: 58_000 } }, { tipo: 'manual', descripcion: 'Diseño', importeCentimos: 100 }, { tipo: 'lista', descripcion: 'Tarjetas', importeCentimos: 1_000, detalle: { precioListaCentimos: 1_000 } }];
    const avisos = avisosDeCambioDePrecio(guardadas, [nueva(60_000, 60_000), { tipo: 'manual', detalle: {} } as never, nueva(1_000, 1_000)]);
    expect(avisos).toEqual(['El precio de lista de «Volantes» cambió: antes S/ 580.00, ahora S/ 600.00']);
  });

  it('la foto de la lista guarda referencias, modo y mínimo en las líneas de lista', () => {
    const r = armarLineas([{ tipo: 'lista', listaId: 'l1', cantidadMilesimas: 1_000_000 }], contexto());
    if (!r.ok) throw new Error('no armó');
    expect(conFotoDeLista(r.lineas, contexto().listas)[0]?.detalle).toMatchObject({ p100: 19_000, p1000: 58_000, p5000: 120_000, modoIntermedio: 'curva', precioMinimo: null });
  });
});
