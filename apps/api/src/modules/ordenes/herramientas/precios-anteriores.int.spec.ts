import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigo, crearCliente, datos, linea } from './pruebas-de-pedidos.js';

// ordenes_precios_anteriores por HTTP real: solo pedidos de «confirmado» en adelante, por cliente, producto o raíz de la
// descripción, con alcance «propios» y aislamiento entre empresas.

let app: AppDePruebas;
let dueno: Sesion;
let lector: Sesion;
let propio: Sesion;
let ajeno: Sesion;
let A: string;
let cliente: string;
let otroCliente: string;
let confirmado: any;

const crear = (s: Sesion, clienteId: string, lineas: unknown[], extra: Record<string, unknown> = {}) => s.herramienta('pedido_crear', { clienteId, lineas, ...extra }).then(datos);
const confirmar = (s: Sesion, id: string) => s.herramienta('pedido_confirmar', { id }).then(datos);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, lector, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Empresa A de precios');
  const B = await crearEmpresa(ajeno, 'Empresa B de precios');
  await Promise.all([activarModulo(A, 'ordenes'), activarModulo(B, 'ordenes')]);
  await agregarMiembro(app, A, lector, { modulo: 'ordenes', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, A, propio, { modulo: 'ordenes', nivel: 'completo', alcance: 'propios' });
  cliente = await crearCliente(dueno, 'Cristina Neira');
  otroCliente = await crearCliente(dueno, 'Imprenta Sur');
  const caja = { ...linea('Caja de bocaditos surtidos', 118, 50), unidad: 'caja' };
  const exenta = { ...linea('Caja de bocaditos sin IGV', 100, 10), afectoIgv: false };
  confirmado = await confirmar(dueno, (await crear(dueno, cliente, [caja, exenta], { fecha: '2026-05-10' })).id);
  await crear(dueno, cliente, [linea('Caja de bocaditos borrador', 90)], { fecha: '2026-06-01' }); // borrador: no entra
  await confirmar(dueno, (await crear(dueno, otroCliente, [linea('Volantes A5', 30)])).id);
  await confirmar(propio, (await crear(propio, cliente, [linea('Caja de bocaditos de la propia', 120)], { fecha: '2026-04-01' })).id);
});
afterAll(async () => {
  await app.cerrar();
});

const consultar = (s: Sesion, args: Record<string, unknown>) => s.herramienta('ordenes_precios_anteriores', args);

describe('ordenes_precios_anteriores', () => {
  it('devuelve solo líneas de pedidos confirmados, con la base de precio y el IGV del pedido', async () => {
    const r = datos(await consultar(dueno, { clienteId: cliente, raices: ['caj'] }));
    expect(r.filas.map((f: any) => f.descripcion)).toEqual(['Caja de bocaditos surtidos', 'Caja de bocaditos sin IGV', 'Caja de bocaditos de la propia']);
    expect(r.filas[0]).toMatchObject({
      fuente: 'pedido', unidad: 'caja', cantidadMilesimas: 50_000, precioUnitarioMilesimas: 118_000, baseDePrecio: 'con_igv', igvPorcentaje: 18,
      precioConIgvMilesimas: 118_000, precioSinIgvMilesimas: 100_000, cliente: { id: cliente, nombre: 'Cristina Neira' }, origen: null,
      documento: { id: confirmado.id, codigo: confirmado.codigo, estado: 'confirmado', fecha: '2026-05-10' },
    });
    expect(r.filas[1]).toMatchObject({ baseDePrecio: 'sin_igv', igvPorcentaje: 0, precioConIgvMilesimas: 100_000, precioSinIgvMilesimas: 100_000 });
  });

  it('filtra por cliente, por raíz (sin tildes ni b/v) y por fecha', async () => {
    expect(datos(await consultar(dueno, { clienteId: otroCliente, raices: ['caj'] })).filas).toEqual([]);
    expect(datos(await consultar(dueno, { clienteId: otroCliente })).filas.map((f: any) => f.descripcion)).toEqual(['Volantes A5']);
    expect(datos(await consultar(dueno, { raices: ['bolan'] })).filas).toHaveLength(1);
    expect(datos(await consultar(dueno, { clienteId: cliente, raices: ['caj'], desde: '2026-05-01' })).filas).toHaveLength(2);
    expect(datos(await consultar(dueno, { clienteId: cliente, raices: ['caj'], limiteDocumentos: 1 })).filas).toHaveLength(2);
  });

  it('con alcance «propios» solo salen los pedidos de la persona; el lector ve todos', async () => {
    expect(datos(await consultar(propio, { clienteId: cliente, raices: ['caj'] })).filas.map((f: any) => f.descripcion)).toEqual(['Caja de bocaditos de la propia']);
    expect(datos(await consultar(lector, { clienteId: cliente, raices: ['caj'] })).filas).toHaveLength(3);
  });

  it('exige cliente, producto o raíz; rechaza argumentos de contexto; otra empresa no ve nada', async () => {
    expect(codigo(await consultar(dueno, {}))).toBe('argumentos_invalidos');
    expect(codigo(await consultar(dueno, { clienteId: cliente, empresaId: A }))).toBe('argumento_prohibido');
    expect(datos(await consultar(ajeno, { clienteId: cliente, raices: ['caj'] })).filas).toEqual([]);
  });
});
