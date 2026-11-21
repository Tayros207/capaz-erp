import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { diaMas } from '../../../pruebas/fechas.js';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { activarCompras, codigo, confirmarCritica, crearBorrador, crearEnviada, crearProducto, crearProveedor, datos, linea, mensaje } from './pruebas-de-compras.js';

// Comparador de costos por artículo (F2-5) por HTTP real: solo cuentan órdenes enviadas o recibidas.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion;
let propio: Sesion; // compras completo, alcance «propios»
let ajeno: Sesion;
let andina: string;
let sol: string;
let tinta: string;

const haceDias = (n: number): string => diaMas(-n);
const costos = async (s: Sesion, args: Record<string, unknown> = {}) => datos(await s.herramienta('compras_costos_por_articulo', args));
const papel = (r: any) => r.articulos.find((a: any) => a.descripcion.toLowerCase().replace(/\s+/g, ' ') === 'papel bond a4');

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  const empresaA = await crearEmpresa(dueno, 'Empresa A de costos');
  const empresaB = await crearEmpresa(ajeno, 'Empresa B de costos');
  await Promise.all([activarCompras(empresaA), activarCompras(empresaB)]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'compras', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'compras', nivel: 'completo', alcance: 'propios' });
  andina = await crearProveedor(dueno, 'Papelera Andina');
  sol = await crearProveedor(dueno, 'Distribuidora Sol');
  tinta = await crearProducto(dueno, 'Tinta negra');
  await crearEnviada(dueno, andina, { fecha: haceDias(60), lineas: [linea('Papel bond A4', 10)] });
  await crearEnviada(dueno, andina, { fecha: haceDias(30), lineas: [linea('papel  BOND a4', 12), linea('Cartulina dúplex', 3)] });
  await crearEnviada(dueno, sol, { fecha: haceDias(10), lineas: [linea('Papel bond A4', 9), { productoId: tinta, cantidadMilesimas: 1_000, costoUnitarioMilesimas: 20_000 }] });
  // No cuentan: un borrador y una orden cancelada.
  await crearBorrador(dueno, andina, { lineas: [linea('Papel bond A4', 99)] });
  const cancelada = await crearBorrador(dueno, sol, { lineas: [linea('Papel bond A4', 1)] });
  datos(await confirmarCritica(dueno, 'compra_cancelar', { id: cancelada.id, motivo: 'Ya no se necesita' }));
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('compras_costos_por_articulo', () => {
  it('último, mediana, mínimo, máximo y variación; el borrador y la cancelada no cuentan', async () => {
    const r = await costos(dueno);
    expect(r).toMatchObject({ truncado: false });
    expect(r.articulos.map((a: any) => a.descripcion)).toHaveLength(3);
    expect(papel(r)).toMatchObject({
      productoId: null, unidad: 'unidad', compras: 3, ultimoCostoMilesimas: 9_000, ultimoProveedorId: sol, ultimoProveedorNombre: 'Distribuidora Sol',
      medianaMilesimas: 10_000, minimoMilesimas: 9_000, maximoMilesimas: 12_000, variacionPorcentaje: -10,
    });
    expect(papel(r).ultimaFecha).toBe(haceDias(10));
  });

  it('compara proveedores: mediana y último por proveedor y el más barato', async () => {
    const a = papel(await costos(dueno));
    expect(a.masBaratoProveedorId).toBe(sol);
    expect(a.porProveedor).toMatchObject([
      { proveedorId: sol, proveedorNombre: 'Distribuidora Sol', compras: 1, ultimoCostoMilesimas: 9_000, medianaMilesimas: 9_000, minimoMilesimas: 9_000 },
      { proveedorId: andina, compras: 2, ultimoCostoMilesimas: 12_000, medianaMilesimas: 11_000, minimoMilesimas: 10_000 },
    ]);
    const cartulina = (await costos(dueno)).articulos.find((x: any) => x.descripcion === 'Cartulina dúplex');
    expect(cartulina).toMatchObject({ compras: 1, masBaratoProveedorId: null, variacionPorcentaje: 0 });
  });

  it('filtra por producto, proveedor, texto y período', async () => {
    expect((await costos(dueno, { productoId: tinta })).articulos).toMatchObject([{ productoId: tinta, ultimoCostoMilesimas: 20_000 }]);
    const deAndina = await costos(dueno, { proveedorId: andina });
    expect(papel(deAndina)).toMatchObject({ compras: 2, ultimoCostoMilesimas: 12_000, masBaratoProveedorId: null });
    expect((await costos(dueno, { buscar: 'CARTUL' })).articulos).toHaveLength(1);
    expect((await costos(dueno, { buscar: '100%' })).articulos).toEqual([]);
    expect(papel(await costos(dueno, { desde: haceDias(35), hasta: haceDias(5) }))).toMatchObject({ compras: 2, minimoMilesimas: 9_000 });
  });

  it('rechaza el período al revés y el de más de 2 años', async () => {
    const alReves = await dueno.herramienta('compras_costos_por_articulo', { desde: '2026-02-01', hasta: '2026-01-01' });
    expect(codigo(alReves)).toBe('argumentos_invalidos');
    expect(mensaje(alReves)).toBe('El período empieza antes de terminar.');
    const largo = await dueno.herramienta('compras_costos_por_articulo', { desde: '2023-01-01', hasta: '2026-01-01' });
    expect(codigo(largo)).toBe('argumentos_invalidos');
    expect(mensaje(largo)).toBe('El período abarca como máximo 2 años.');
  });

  it('un miembro de solo lectura lo ve; con alcance «propios» solo ve lo que creó', async () => {
    expect(papel(await costos(lector))).toMatchObject({ compras: 3 });
    expect((await costos(propio)).articulos).toEqual([]);
    await crearEnviada(propio, andina, { fecha: haceDias(2), lineas: [linea('Papel bond A4', 15)] });
    expect(papel(await costos(propio))).toMatchObject({ compras: 1, ultimoCostoMilesimas: 15_000 });
    expect(papel(await costos(dueno))).toMatchObject({ compras: 4, ultimoCostoMilesimas: 15_000 });
  });

  it('aislamiento: otra empresa no ve nada ni por un producto ajeno', async () => {
    expect((await costos(ajeno)).articulos).toEqual([]);
    expect((await costos(ajeno, { productoId: tinta })).articulos).toEqual([]);
    expect((await costos(ajeno, { proveedorId: randomUUID() })).articulos).toEqual([]);
  });
});
