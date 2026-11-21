import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, datosDe } from './pruebas-de-registro.js';

// Productos con cantidad y precio en un movimiento (0038), por HTTP real: registrar, ver, corregir y aislamiento.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let ajeno: Sesion;
let A: string;
let B: string;
let productoA: string;
let productoB: string;

const etiquetas = { descripcion: 'Etiquetas adhesivas', unidad: 'millar', cantidadMilesimas: 2000, precioUnitarioMilesimas: 65_000 }; // S/ 130.00
const bolsas = { descripcion: 'Bolsas publicitarias', unidad: 'unidad', cantidadMilesimas: 100_000, precioUnitarioMilesimas: 1_900 }; // S/ 190.00
const ingreso = (s: Sesion, args: Record<string, unknown> = {}) => s.herramienta('movimiento_registrar', { tipo: 'ingreso', montoCentimos: 32_000, lineas: [etiquetas, bolsas], ...args });
const ver = (s: Sesion, id: string) => datosDe(s, 'movimiento_ver', { id });
const corregir = (s: Sesion, id: string, cambios: Record<string, unknown>) => confirmando(s, 'movimiento_corregir', { id, ...cambios });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, ajeno] = await Promise.all(['Dueña', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Líneas A');
  B = await crearEmpresa(ajeno, 'Líneas B');
  productoA = (await datosDe(dueno, 'productos_crear', { nombre: 'Troquelado', tipo: 'servicio', unidad: 'millar', precioUnitarioMilesimas: 50_000 })).id;
  productoB = (await datosDe(ajeno, 'productos_crear', { nombre: 'Producto de B', tipo: 'producto', unidad: 'unidad', precioUnitarioMilesimas: 1_000 })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('movimiento_registrar con productos', () => {
  it('guarda las líneas con su subtotal y el monto es la suma; movimiento_ver y movimientos_listar las devuelven', async () => {
    const r = await ingreso(dueno);
    expect(r.estado).toBe(200);
    const m = r.cuerpo.datos;
    expect(m.montoCentimos).toBe(32_000);
    expect(m.lineas.map((l: any) => [l.orden, l.descripcion, l.unidad, l.subtotalCentimos])).toEqual([
      [0, 'Etiquetas adhesivas', 'millar', 13_000],
      [1, 'Bolsas publicitarias', 'unidad', 19_000],
    ]);
    expect((await ver(dueno, m.id)).lineas).toHaveLength(2);
    const listado = (await datosDe(dueno, 'movimientos_listar', { estado: 'activos' })).items.find((x: any) => x.id === m.id);
    expect(listado.lineas).toHaveLength(2);
  });

  it('acepta un producto del catálogo y texto libre en la misma lista', async () => {
    const r = await ingreso(dueno, { montoCentimos: 18_000, lineas: [{ productoId: productoA, descripcion: 'Troquelado', unidad: 'millar', cantidadMilesimas: 1000, precioUnitarioMilesimas: 50_000 }, { descripcion: 'Diseño', cantidadMilesimas: 1000, precioUnitarioMilesimas: 130_000 }] });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.datos.lineas.map((l: any) => [l.productoId, l.unidad])).toEqual([[productoA, 'millar'], [null, 'unidad']]);
  });

  it('rechaza un monto que no cuadra con la suma, deja todo igual y no gasta número', async () => {
    const antes = (await datosDe(dueno, 'movimientos_listar', { estado: 'todos' })).items.length;
    const r = await ingreso(dueno, { montoCentimos: 31_999 });
    expect(r.estado).toBe(400);
    expect(codigoDe(r)).toBe('argumentos_invalidos');
    expect(r.cuerpo.error.mensaje).toContain('no coincide con la suma de los productos');
    expect((await datosDe(dueno, 'movimientos_listar', { estado: 'todos' })).items.length).toBe(antes);
  });

  it('rechaza el producto de otra empresa y las líneas inválidas', async () => {
    expect(codigoDe(await ingreso(dueno, { lineas: [{ productoId: productoB, descripcion: 'x', cantidadMilesimas: 1000, precioUnitarioMilesimas: 1 }], montoCentimos: 1 }))).toBe('no_encontrado');
    expect((await ingreso(dueno, { lineas: [{ descripcion: 'x', cantidadMilesimas: 0, precioUnitarioMilesimas: 1 }], montoCentimos: 1 })).estado).toBe(400);
    expect((await ingreso(dueno, { lineas: Array.from({ length: 51 }, () => etiquetas), montoCentimos: 1 })).estado).toBe(400);
    // Líneas de precio cero: la suma no es mayor que cero.
    expect(codigoDe(await ingreso(dueno, { lineas: [{ descripcion: 'Regalo', cantidadMilesimas: 1000, precioUnitarioMilesimas: 0 }], montoCentimos: 100 }))).toBe('argumentos_invalidos');
  });

  it('sin líneas funciona igual que siempre y lineas queda vacío', async () => {
    const r = await dueno.herramienta('movimiento_registrar', { tipo: 'egreso', montoCentimos: 4_550, descripcion: 'Tinta' });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.datos.lineas).toEqual([]);
  });
});

describe('movimiento_corregir con productos', () => {
  it('cambiar una cantidad recalcula el monto, copia las líneas al reemplazo y deja el rastro', async () => {
    const m = (await ingreso(dueno)).cuerpo.datos;
    const { respuesta, resumen } = await corregir(dueno, m.id, { lineas: [{ ...etiquetas, cantidadMilesimas: 3000 }, bolsas] });
    expect(resumen).toContain('productos:');
    expect(resumen).toContain('S/ 320.00 → S/ 385.00');
    expect(respuesta.estado).toBe(200);
    const { anulado, nuevo } = respuesta.cuerpo.datos;
    expect(nuevo.montoCentimos).toBe(38_500);
    expect(nuevo.lineas.map((l: any) => l.subtotalCentimos)).toEqual([19_500, 19_000]);
    expect(anulado.lineas).toHaveLength(2);
    expect(anulado.lineas[0].cantidadMilesimas).toBe(2000); // el original conserva lo que decía
    expect(anulado.motivoAnulacion).toContain('productos:');
    expect(anulado).toMatchObject({ estado: 'anulado', reemplazadoPor: { id: nuevo.id } });
    expect(nuevo.correccionDe).toBe(m.id);
  });

  it('corregir otro dato conserva los productos; el monto suelto no puede contradecirlos', async () => {
    const m = (await ingreso(dueno)).cuerpo.datos;
    const sinMonto = await corregir(dueno, m.id, { descripcion: 'Pedido de noviembre' });
    expect(sinMonto.respuesta.cuerpo.datos.nuevo.lineas).toHaveLength(2);
    expect(sinMonto.respuesta.cuerpo.datos.nuevo.descripcion).toBe('Pedido de noviembre');
    const vigente = sinMonto.respuesta.cuerpo.datos.nuevo;
    const contradice = await dueno.herramienta('movimiento_corregir', { id: vigente.id, montoCentimos: 1_000 });
    expect(codigoDe(contradice)).toBe('argumentos_invalidos');
    expect(contradice.cuerpo.error.mensaje).toContain('tiene productos');
    // Monto y líneas juntos pero distintos: rechazo.
    expect(codigoDe(await dueno.herramienta('movimiento_corregir', { id: vigente.id, montoCentimos: 1, lineas: [etiquetas] }))).toBe('argumentos_invalidos');
  });

  it('agregar productos a un movimiento que no tenía y quitarlos después (el monto se conserva)', async () => {
    const m = (await dueno.herramienta('movimiento_registrar', { tipo: 'ingreso', montoCentimos: 13_000 })).cuerpo.datos;
    const conLineas = (await corregir(dueno, m.id, { lineas: [etiquetas] })).respuesta.cuerpo.datos.nuevo;
    expect(conLineas.lineas).toHaveLength(1);
    expect(conLineas.montoCentimos).toBe(13_000);
    const sin = (await corregir(dueno, conLineas.id, { lineas: [] })).respuesta.cuerpo.datos.nuevo;
    expect(sin.lineas).toEqual([]);
    expect(sin.montoCentimos).toBe(13_000);
  });

  it('repetir las mismas líneas no es un cambio', async () => {
    const m = (await ingreso(dueno)).cuerpo.datos;
    const r = await dueno.herramienta('movimiento_corregir', { id: m.id, lineas: [etiquetas, bolsas] });
    expect(codigoDe(r)).toBe('argumentos_invalidos');
  });

  it('restaurar el original anulado devuelve sus productos', async () => {
    const m = (await ingreso(dueno)).cuerpo.datos;
    const nuevo = (await corregir(dueno, m.id, { lineas: [etiquetas] })).respuesta.cuerpo.datos.nuevo;
    await confirmando(dueno, 'movimiento_anular', { id: nuevo.id, motivo: 'prueba' });
    const restaurado = (await confirmando(dueno, 'movimiento_restaurar', { id: m.id })).respuesta.cuerpo.datos;
    expect(restaurado.lineas).toHaveLength(2);
  });
});

describe('aislamiento de las líneas', () => {
  it('otra empresa no ve ni cuenta las líneas', async () => {
    const m = (await ingreso(dueno)).cuerpo.datos;
    expect(codigoDe(await ajeno.herramienta('movimiento_ver', { id: m.id }))).toBe('no_encontrado');
    const deB = await comoEmpresa(appPool, B, async (c) => (await c.query('select count(*)::int as n from registro.movimiento_lineas')).rows[0].n);
    expect(deB).toBe(0);
    const deA = await comoEmpresa(appPool, A, async (c) => (await c.query('select count(*)::int as n from registro.movimiento_lineas')).rows[0].n);
    expect(deA).toBeGreaterThan(0);
  });

  it('la base rechaza cambiar o borrar una línea guardada', async () => {
    await expect(comoEmpresa(appPool, A, (c) => c.query('update registro.movimiento_lineas set cantidad_milesimas = 1'))).rejects.toThrow();
    await expect(comoEmpresa(appPool, A, (c) => c.query('delete from registro.movimiento_lineas'))).rejects.toThrow();
  });
});
