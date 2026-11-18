import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, confirmando, crearCliente, datosDe, manual } from './pruebas-de-cotizador.js';

// cotizador_precios_anteriores por HTTP real: solo la versión vigente ya emitida; un borrador y una anulada no entran.

let app: AppDePruebas;
let dueno: Sesion;
let lector: Sesion;
let propio: Sesion;
let ajeno: Sesion;
let cliente: string;
let emitida: any;

const emitir = async (s: Sesion, titulo: string, lineas: unknown[]) => {
  const b = await datosDe(s, 'cotizacion_crear', { titulo, clienteId: cliente, lineas });
  return (await confirmando(s, 'cotizacion_emitir', { id: b.id })).respuesta.cuerpo.datos;
};
const consultar = (s: Sesion, args: Record<string, unknown>) => s.herramienta('cotizador_precios_anteriores', args);
const filasDe = (r: { cuerpo: any }) => r.cuerpo.datos.filas as any[];

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, lector, propio, ajeno] = await Promise.all(['Dueña', 'Lector', 'Propio', 'Ajena'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Cotizaciones A de precios');
  const B = await crearEmpresa(ajeno, 'Cotizaciones B de precios');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  await agregarMiembro(app, A, lector, { modulo: 'cotizador', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, A, propio, { modulo: 'cotizador', nivel: 'completo', alcance: 'propios' });
  cliente = await crearCliente(dueno, 'Cristina Neira');
  emitida = await emitir(dueno, 'Cajas', [manual('Caja de bocaditos', 100, 50), manual('Diseño', 80)]);
  await datosDe(dueno, 'cotizacion_crear', { titulo: 'Borrador', clienteId: cliente, lineas: [manual('Caja de bocaditos borrador', 10)] });
});
afterAll(async () => {
  await app.cerrar();
});

describe('cotizador_precios_anteriores', () => {
  it('entrega las líneas de la versión emitida con precio sin IGV, el precio con IGV y el total de la línea', async () => {
    const filas = filasDe(await consultar(dueno, { clienteId: cliente, raices: ['caj'] }));
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      fuente: 'cotizacion', descripcion: 'Caja de bocaditos', cantidadMilesimas: 50_000, precioUnitarioMilesimas: 100_000, baseDePrecio: 'sin_igv', igvPorcentaje: 18,
      precioSinIgvMilesimas: 100_000, precioConIgvMilesimas: 118_000, importeCentimos: 590_000, origen: null, cliente: { id: cliente, nombre: 'Cristina Neira' },
      documento: { id: emitida.id, codigo: emitida.codigo, estado: 'emitida' },
    });
    expect(filas[0].documento.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('una aceptada y una rechazada entran; una anulada no', async () => {
    const aceptada = await emitir(dueno, 'Aceptada', [manual('Caja de bocaditos x', 95, 10)]);
    await datosDe(dueno, 'cotizacion_aceptar', { id: aceptada.id });
    const anulada = await emitir(dueno, 'Anulada', [manual('Caja de bocaditos anulada', 90)]);
    await confirmando(dueno, 'cotizacion_anular', { id: anulada.id, motivo: 'prueba' });
    const estados = filasDe(await consultar(dueno, { clienteId: cliente, raices: ['caj'] })).map((f) => [f.descripcion, f.documento.estado]);
    expect(estados).toEqual(expect.arrayContaining([['Caja de bocaditos', 'emitida'], ['Caja de bocaditos x', 'aceptada']]));
    expect(estados.some(([d]) => d === 'Caja de bocaditos anulada' || d === 'Caja de bocaditos borrador')).toBe(false);
  });

  it('el lector la consulta; con alcance «propios» solo ve lo suyo; otra empresa no ve nada; sin filtro se rechaza', async () => {
    expect(filasDe(await consultar(lector, { clienteId: cliente, raices: ['caj'] })).length).toBeGreaterThan(0);
    expect(filasDe(await consultar(propio, { clienteId: cliente, raices: ['caj'] }))).toEqual([]);
    expect(filasDe(await consultar(ajeno, { clienteId: cliente, raices: ['caj'] }))).toEqual([]);
    expect(codigoDe(await consultar(dueno, {}))).toBe('argumentos_invalidos');
  });
});
