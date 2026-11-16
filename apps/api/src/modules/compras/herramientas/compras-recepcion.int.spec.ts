import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { ESTADOS_DE_COMPRA } from '@capaz/shared';
import { RegistroDeFuentesDeTiempo } from '../../../core/automatizaciones/tipos.js';
import { abrirSesion, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, conEmpresaDePruebas } from '../../../pruebas/base-de-pruebas.js';
import { activarCompras, codigo, confirmarCritica, crearBorrador, crearEnviada, crearProducto, crearProveedor, datos, eventosDe, linea, mensaje, recibir } from './pruebas-de-compras.js';

// Compras por HTTP real, parte 3: recepción total o parcial (evento por recepción, idempotencia,
// concurrencia), resumen y fuente de tiempo.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let ajeno: Sesion; // owner de B (resumen y fuente, empresa limpia)
let empresaA: string;
let empresaB: string;
let proveedor: string;
let papel: string;

const recibidas = async (ordenId: string) => (await eventosDe(appPool, empresaA, 'compra.recibida')).filter((e) => e.carga.ordenId === ordenId).map((e) => e.carga);
/** Una orden enviada con papel (producto, 10 millares a S/ 23.60) y flete (gasto, 1 a S/ 59.00). */
const ordenConDosLineas = () =>
  crearEnviada(dueno, proveedor, { lineas: [{ productoId: papel, cantidadMilesimas: 10_000, costoUnitarioMilesimas: 23_600 }, linea('Flete', 59)] });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, ajeno] = await Promise.all(['Dueña', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de recepciones');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de recepciones');
  await Promise.all([activarCompras(empresaA), activarCompras(empresaB)]);
  proveedor = await crearProveedor(dueno, 'Papelera Andina');
  papel = await crearProducto(dueno, 'Papel bond A4', { unidad: 'millar' });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('compra_recibir', () => {
  it('parcial y luego total: estados, pendientes, recepciones numeradas y un compra.recibida por lo recibido en cada una', async () => {
    const c = await ordenConDosLineas();
    expect(c).toMatchObject({ totalCentimos: 23_600 + 5_900, lineasPorRecibir: 2 });
    const r1 = datos(await recibir(dueno, c, [4_000, null], { nota: ' Dos cajas abiertas ' }));
    expect(r1).toMatchObject({ estado: 'recibida_parcial', lineasPorRecibir: 2 });
    expect(r1.detalle.map((l: any) => [l.recibidoMilesimas, l.pendienteMilesimas])).toEqual([[4_000, 6_000], [0, 1_000]]);
    expect(r1.recepciones).toMatchObject([{ numero: 1, nota: 'Dos cajas abiertas', importeCentimos: 9_440, lineas: [{ ordenLineaId: c.detalle[0].id, cantidadMilesimas: 4_000 }], creadoPor: dueno.usuarioId }]);
    expect(r1.recepciones[0].fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const r2 = datos(await recibir(dueno, c, [6_000, 1_000]));
    expect(r2).toMatchObject({ estado: 'recibida', lineasPorRecibir: 0, atrasada: false });
    expect(r2.detalle.map((l: any) => l.pendienteMilesimas)).toEqual([0, 0]);
    expect(r2.recepciones.map((r: any) => [r.numero, r.importeCentimos])).toEqual([[1, 9_440], [2, 14_160 + 5_900]]);

    expect(await recibidas(c.id)).toEqual([
      { ordenId: c.id, recepcionId: r1.recepciones[0].id, numero: c.codigo, proveedorId: proveedor, totalRecibidoCentimos: 9_440, lineas: [{ productoId: papel, cantidadMilesimas: 4_000, costoUnitarioMilesimas: 23_600 }] },
      {
        ordenId: c.id, recepcionId: r2.recepciones[1].id, numero: c.codigo, proveedorId: proveedor, totalRecibidoCentimos: 20_060,
        lineas: [{ productoId: papel, cantidadMilesimas: 6_000, costoUnitarioMilesimas: 23_600 }, { productoId: null, cantidadMilesimas: 1_000, costoUnitarioMilesimas: 59_000 }],
      },
    ]);
    // Una orden recibida ya no recibe más.
    const otra = await recibir(dueno, c, [1, null]);
    expect(codigo(otra)).toBe('conflicto');
    expect(mensaje(otra)).toBe('Una orden «recibida» ya no recibe mercadería.');
  });

  it('no recibe más de lo pedido: conflicto con lo que falta, sin cambios ni evento', async () => {
    const c = await ordenConDosLineas();
    datos(await recibir(dueno, c, [8_500, null]));
    const eventosAntes = (await eventosDe(appPool, empresaA)).length;
    const r = await recibir(dueno, c, [2_000, 1_000]);
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toBe('«Papel bond A4»: llegan 2 millar y solo falta recibir 1.5 millar.');
    const v = datos(await dueno.herramienta('compra_ver', { id: c.id }));
    expect(v.detalle.map((l: any) => l.recibidoMilesimas)).toEqual([8_500, 0]);
    expect(v.recepciones).toHaveLength(1);
    expect((await eventosDe(appPool, empresaA)).length).toBe(eventosAntes);
  });

  it('rechaza un borrador, líneas de otra orden, líneas repetidas, cantidades no enteras y fechas fuera de rango', async () => {
    const borrador = await crearBorrador(dueno, proveedor);
    expect(mensaje(await recibir(dueno, borrador, [1_000]))).toMatch(/Primero envía la orden/);
    const c = await ordenConDosLineas();
    const otra = await crearEnviada(dueno, proveedor);
    const ajena = await dueno.herramienta('compra_recibir', { id: c.id, lineas: [{ ordenLineaId: otra.detalle[0].id, cantidadMilesimas: 1 }] });
    expect(codigo(ajena)).toBe('argumentos_invalidos');
    expect(mensaje(ajena)).toBe('Línea 1: no es una línea de esta orden.');
    const l = c.detalle[0].id;
    for (const args of [
      { id: c.id, lineas: [] },
      { id: c.id, lineas: [{ ordenLineaId: l, cantidadMilesimas: 1 }, { ordenLineaId: l, cantidadMilesimas: 1 }] },
      { id: c.id, lineas: [{ ordenLineaId: l, cantidadMilesimas: 1.5 }] },
      { id: c.id, lineas: [{ ordenLineaId: l, cantidadMilesimas: 0 }] },
      { id: c.id, lineas: [{ ordenLineaId: l, cantidadMilesimas: 1, costoUnitarioMilesimas: 1 }] },
      { id: c.id, fecha: '2099-01-01', lineas: [{ ordenLineaId: l, cantidadMilesimas: 1 }] },
      { id: c.id, fecha: '2000-01-01', lineas: [{ ordenLineaId: l, cantidadMilesimas: 1 }] },
    ]) {
      expect(codigo(await dueno.herramienta('compra_recibir', args)), JSON.stringify(args)).toBe('argumentos_invalidos');
    }
    expect(datos(await dueno.herramienta('compra_ver', { id: c.id })).recepciones).toEqual([]);
  });

  it('una fecha pasada (no anterior a la orden) se respeta', async () => {
    const c = await crearEnviada(dueno, proveedor, { fecha: '2026-01-05' });
    const r = datos(await recibir(dueno, c, [1_000], { fecha: '2026-01-06' }));
    expect(r.recepciones[0].fecha).toBe('2026-01-06');
  });

  it('la misma clave de idempotencia no registra dos recepciones ni dos eventos', async () => {
    const c = await ordenConDosLineas();
    const clave = `rec-${randomUUID()}`;
    const a = datos(await recibir(dueno, c, [1_000, null], {}, { clave }));
    const b = datos(await recibir(dueno, c, [1_000, null], {}, { clave }));
    expect(b.recepciones.map((r: any) => r.id)).toEqual(a.recepciones.map((r: any) => r.id));
    expect(datos(await dueno.herramienta('compra_ver', { id: c.id })).detalle[0].recibidoMilesimas).toBe(1_000);
    expect(await recibidas(c.id)).toHaveLength(1);
    expect(codigo(await recibir(dueno, c, [2_000, null], {}, { clave }))).toBe('conflicto');
  });

  it('dos recepciones simultáneas sobre la misma línea no superan lo pedido: una gana, la otra es conflicto', async () => {
    const c = await ordenConDosLineas();
    const r = await Promise.all([recibir(dueno, c, [6_000, null]), recibir(dueno, c, [6_000, null]), recibir(dueno, c, [6_000, null])]);
    expect(r.filter((x) => x.cuerpo.ok)).toHaveLength(1);
    expect(r.filter((x) => !x.cuerpo.ok).map(codigo)).toEqual(['conflicto', 'conflicto']);
    const v = datos(await dueno.herramienta('compra_ver', { id: c.id }));
    expect(v.detalle[0]).toMatchObject({ recibidoMilesimas: 6_000, pendienteMilesimas: 4_000 });
    expect(v.recepciones).toHaveLength(1);
    expect(await recibidas(c.id)).toHaveLength(1);
  });

  it('recepciones simultáneas que sí caben se turnan y numeran sin repetir', async () => {
    const c = await ordenConDosLineas();
    const r = await Promise.all([1, 2, 3, 4].map(() => recibir(dueno, c, [2_500, null])));
    expect(r.every((x) => x.cuerpo.ok)).toBe(true);
    const v = datos(await dueno.herramienta('compra_ver', { id: c.id }));
    expect(v.recepciones.map((x: any) => x.numero)).toEqual([1, 2, 3, 4]);
    expect(v).toMatchObject({ estado: 'recibida_parcial', lineasPorRecibir: 1 });
    expect(v.detalle[0].recibidoMilesimas).toBe(10_000);
  });
});

describe('compras_resumen y fuente de tiempo (empresa B, limpia)', () => {
  let proveedorB: string;
  let atrasada: any;
  let hoy: string;
  beforeAll(async () => {
    proveedorB = await crearProveedor(ajeno, 'Proveedor de B');
    hoy = datos(await ajeno.herramienta('compra_crear', { proveedorId: proveedorB })).fecha; // borrador vacío de hoy
    const nueva = (extra: Record<string, unknown>) => crearEnviada(ajeno, proveedorB, { fecha: '2020-01-01', ...extra });
    atrasada = await nueva({ entregaEl: '2020-01-05' });
    const parcial = await nueva({ entregaEl: hoy });
    datos(await recibir(ajeno, parcial, [5_000], { fecha: '2020-01-03' })); // 5 × 11.80 = 59.00
    const completa = await nueva({});
    datos(await recibir(ajeno, completa, [10_000], { fecha: '2020-01-04' })); // 118.00
    const cancelada = await nueva({});
    datos(await confirmarCritica(ajeno, 'compra_cancelar', { id: cancelada.id, motivo: 'prueba' }));
  });

  it('cuenta por estado las órdenes del período, lo comprado y lo recibido, y aparte lo que falta hoy', async () => {
    const r = datos(await ajeno.herramienta('compras_resumen', { desde: '2020-01-01', hasta: hoy }));
    const de = (estado: string) => r.porEstado.find((e: any) => e.estado === estado);
    expect(r.porEstado.map((e: any) => e.estado)).toEqual([...ESTADOS_DE_COMPRA]);
    expect(de('borrador')).toEqual({ estado: 'borrador', cantidad: 1, totalCentimos: 0 });
    expect(de('enviada')).toEqual({ estado: 'enviada', cantidad: 1, totalCentimos: 11_800 });
    expect(de('recibida_parcial')).toEqual({ estado: 'recibida_parcial', cantidad: 1, totalCentimos: 11_800 });
    expect(de('recibida')).toEqual({ estado: 'recibida', cantidad: 1, totalCentimos: 11_800 });
    expect(de('cancelada')).toMatchObject({ cantidad: 1 });
    expect(r).toMatchObject({ compradas: 3, totalCompradoCentimos: 35_400, recepciones: 2, recibidoCentimos: 5_900 + 11_800, porRecibir: 2, atrasadas: 1 });
    // Un período sin nada: ceros, pero lo que falta recibir no depende del período.
    const viejo = datos(await ajeno.herramienta('compras_resumen', { desde: '2019-01-01', hasta: '2019-12-31' }));
    expect(viejo).toMatchObject({ compradas: 0, totalCompradoCentimos: 0, recepciones: 0, recibidoCentimos: 0, porRecibir: 2, atrasadas: 1 });
    expect(viejo.porEstado.every((e: any) => e.cantidad === 0 && e.totalCentimos === 0)).toBe(true);
    expect(datos(await ajeno.herramienta('compras_resumen', { desde: '2020-01-04', hasta: '2020-01-04' }))).toMatchObject({ recepciones: 1, recibidoCentimos: 11_800 });
    expect(codigo(await ajeno.herramienta('compras_resumen', { desde: '2020-02-01', hasta: '2020-01-01' }))).toBe('argumentos_invalidos');
  });

  it('`atrasada` sale en la ficha y en el listado', async () => {
    expect(datos(await ajeno.herramienta('compra_ver', { id: atrasada.id })).atrasada).toBe(true);
    const lista = datos(await ajeno.herramienta('compras_listar', { entregaHasta: '2020-01-31' })).items;
    expect(lista.map((c: any) => [c.id, c.atrasada])).toEqual([[atrasada.id, true]]);
  });

  it('la fuente compras.entrega_vence da las órdenes por recibir con entrega, solo de su empresa', async () => {
    const fuente = app.obtener(RegistroDeFuentesDeTiempo).obtener('compras.entrega_vence')!;
    expect(fuente.modulo).toBe('compras');
    const conEmpresa = conEmpresaDePruebas(appPool);
    const deB = await conEmpresa({ empresaId: empresaB, usuarioId: 'sistema' }, (tx) => fuente.candidatos(tx, new Date()));
    expect(deB).toHaveLength(2); // la atrasada y la recibida en parte que vence hoy; ni la recibida ni la cancelada ni el borrador
    expect(deB.find((x) => x.entidadId === atrasada.id)).toEqual({
      entidadTipo: 'compra',
      entidadId: atrasada.id,
      fecha: new Date('2020-01-05T12:00:00Z'),
      datos: { id: atrasada.id, codigo: atrasada.codigo, proveedorId: proveedorB, estado: 'enviada', totalCentimos: 11_800 },
    });
    const deA = await conEmpresa({ empresaId: empresaA, usuarioId: 'sistema' }, (tx) => fuente.candidatos(tx, new Date()));
    expect(deA.map((x) => x.entidadId)).not.toContain(atrasada.id);
  });
});
