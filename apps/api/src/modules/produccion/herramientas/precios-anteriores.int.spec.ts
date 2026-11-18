import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { datosDe } from '../../registro/herramientas/pruebas-de-registro.js';

// produccion_precios_anteriores por HTTP real: líneas de órdenes no anuladas, buscadas por la descripción (no tienen producto).

let app: AppDePruebas;
let dueno: Sesion;
let lector: Sesion;
let ajeno: Sesion;
let cliente: string;
let orden: any;

const item = (descripcion: string, cantidad: number, valor: number) => ({ descripcion, cantidadMilesimas: cantidad * 1000, precioUnitarioMilesimas: valor * 1000 });
const consultar = (s: Sesion, args: Record<string, unknown>) => s.herramienta('produccion_precios_anteriores', args);
const filasDe = (r: { cuerpo: any }) => r.cuerpo.datos.filas as any[];

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Ajena'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Taller A de precios');
  const B = await crearEmpresa(ajeno, 'Taller B de precios');
  await Promise.all([activarModulo(A, 'produccion'), activarModulo(B, 'produccion')]);
  await agregarMiembro(app, A, lector, { modulo: 'produccion', nivel: 'lectura', alcance: 'todos' });
  cliente = (await datosDe(dueno, 'clientes_crear', { nombre: 'Cristina Neira' })).id;
  orden = await datosDe(dueno, 'produccion_orden_crear', { clienteId: cliente, lineas: [item('Cajas de bocaditos', 50, 12)] });
  const anulada = await datosDe(dueno, 'produccion_orden_crear', { clienteId: cliente, lineas: [item('Cajas de bocaditos anuladas', 5, 9)] });
  await dueno.herramienta('produccion_orden_anular', { id: anulada.id, motivo: 'prueba' }).then(async (r) => {
    const token = r.cuerpo?.requiereConfirmacion?.token;
    if (token) await dueno.herramienta('produccion_orden_anular', { id: anulada.id, motivo: 'prueba' }, { confirmacion: token });
  });
});
afterAll(async () => {
  await app.cerrar();
});

describe('produccion_precios_anteriores', () => {
  it('entrega el valor acordado sin desglose de IGV y deja fuera las anuladas', async () => {
    const filas = filasDe(await consultar(dueno, { clienteId: cliente, raices: ['caj'] }));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      fuente: 'orden_trabajo', productoId: null, descripcion: 'Cajas de bocaditos', cantidadMilesimas: 50_000, precioUnitarioMilesimas: 12_000,
      baseDePrecio: 'sin_desglose', igvPorcentaje: null, precioConIgvMilesimas: null, precioSinIgvMilesimas: null, importeCentimos: 60_000,
      documento: { id: orden.id, codigo: orden.codigo, estado: 'pendiente' }, cliente: { id: cliente, nombre: 'Cristina Neira' },
    });
  });

  it('sin cliente ni raíz no devuelve nada; el lector la consulta; otra empresa no ve nada', async () => {
    expect(filasDe(await consultar(dueno, { productoId: '0192f0c4-7b1e-7000-8000-000000000020' }))).toEqual([]);
    expect(filasDe(await consultar(lector, { clienteId: cliente }))).toHaveLength(1);
    expect(filasDe(await consultar(ajeno, { clienteId: cliente, raices: ['caj'] }))).toEqual([]);
  });
});
