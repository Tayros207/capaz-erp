import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, datosDe, diaMas } from '../herramientas/pruebas-de-registro.js';
import { fechaCorta } from './propuesta-de-pedido.js';

// «Frase → borrador pedido_crear» por HTTP real con captura_proponer. Proponer no escribe; aprobar crea el pedido en borrador.

type Propuesta = { id: string; herramienta: string; resumen: string; args: any; sugerencias: any[] };
type Respuesta = { borradores: Propuesta[]; faltan: string[]; pista: string | null };

let app: AppDePruebas;
let dueno: Sesion;
let sinPedidos: Sesion;
const cli: Record<string, string> = {};

const dictar = async (s: Sesion, texto: string): Promise<Respuesta> => datosDe(s, 'captura_proponer', { texto, origen: 'voz', transcurridoMs: 3000, modulo: 'registro' });
const contarPedidos = async (): Promise<number> => (await datosDe(dueno, 'pedidos_listar', { limite: 100 })).items.length;
const contarClientes = async (): Promise<number> => (await datosDe(dueno, 'clientes_listar', { limite: 100 })).items.length;
const LINEAS_PD1 = [
  { descripcion: 'tarjetas', unidad: 'unidad', cantidadMilesimas: 500000, precioUnitarioMilesimas: 365 },
  { descripcion: 'volantes', unidad: 'millar', cantidadMilesimas: 1000, precioUnitarioMilesimas: 240000 },
];

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, sinPedidos] = await Promise.all(['Dueña', 'Sin pedidos'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Dictado de pedidos');
  await activarModulo(A, 'ordenes');
  await agregarMiembro(app, A, sinPedidos, { modulo: 'registro', nivel: 'completo', alcance: 'todos' });
  await datosDe(dueno, 'registro_iniciar', {});
  for (const n of ['Juan Pérez', 'Rosa Díaz', 'Rosa Diez', 'Imprenta Mateo']) cli[n] = (await datosDe(dueno, 'clientes_crear', { nombre: n })).id;
});
afterAll(async () => {
  await app.cerrar();
});

describe('dictar un pedido', () => {
  it('1 · caso completo: un borrador pedido_crear con args, resumen y origen voz; al aprobar nace el pedido en borrador', async () => {
    const antes = await contarPedidos();
    const r = await dictar(dueno, 'Pedido para Juan Pérez, 500 tarjetas a 0.365 y un millar de volantes a 240, a cuenta 100, para mañana');
    expect(r.borradores).toHaveLength(1);
    const b = r.borradores[0]!;
    expect(b.herramienta).toBe('pedido_crear');
    expect(b.args).toEqual({
      clienteId: cli['Juan Pérez'], entregaEl: diaMas(1), notas: 'Adelanto dictado: S/ 100.00. Cóbralo al confirmar el pedido.', lineas: LINEAS_PD1,
    });
    expect(b.resumen).toBe(`Pedido para Juan Pérez · 2 líneas · S/ 422.50 · adelanto S/ 100.00 · entrega ${fechaCorta(diaMas(1))}`);
    expect(await datosDe(dueno, 'borrador_ver', { id: b.id })).toMatchObject({ modulo: 'ordenes', origen: 'voz' });
    expect(await contarPedidos()).toBe(antes);

    const ap = await dueno.herramienta('borrador_aprobar', { id: b.id });
    expect(ap.estado).toBe(200);
    const resultado = ap.cuerpo.datos.resultado.datos ?? ap.cuerpo.datos.resultado;
    expect(resultado.estado).toBe('borrador');
    expect(resultado.totalCentimos).toBe(42250);
    expect(resultado.detalle.map((l: any) => l.importeCentimos)).toEqual([18250, 24000]);
    expect(resultado.detalle.map((l: any) => l.unidad)).toEqual(['unidad', 'millar']);
    expect(resultado.detalle.map((l: any) => [l.material, l.medida, l.colores, l.acabado])).toEqual([[null, null, null, null], [null, null, null, null]]);
    expect((await datosDe(dueno, 'borrador_ver', { id: b.id })).corregido).toBe(false);
  });

  it('2 · cliente ambiguo: clienteId null y sugerencia con las dos Rosas', async () => {
    const r = await dictar(dueno, 'pedido para Rosa 2 docenas de stickers a 0.5 cada una');
    const b = r.borradores[0]!;
    expect(b.args.clienteId).toBeNull();
    expect(b.sugerencias[0].campo).toBe('clienteId');
    const nombres = b.sugerencias[0].opciones.map((o: any) => o.nombre);
    expect(nombres).toHaveLength(2);
    expect(nombres).toEqual(expect.arrayContaining(['Rosa Díaz', 'Rosa Diez']));
  });

  it('3 · cliente nuevo: sin sugerencias, se avisa y no se crea ningún cliente', async () => {
    const antes = await contarClientes();
    const r = await dictar(dueno, 'pedido para Wilfredo 100 volantes a 0.3');
    expect(r.borradores[0]!.sugerencias).toEqual([]);
    expect(r.faltan[0]).toBe('cliente nuevo: «Wilfredo» (créalo desde la tarjeta)');
    expect(await contarClientes()).toBe(antes);
  });

  it('4 · falta precio: no se aprueba hasta corregir; entonces queda corregido', async () => {
    const b = (await dictar(dueno, 'pedido para Juan Pérez 500 volantes')).borradores[0]!;
    expect(codigoDe(await dueno.herramienta('borrador_aprobar', { id: b.id }))).toBe('argumentos_invalidos');
    const args = { ...b.args, lineas: b.args.lineas.map((l: any) => ({ ...l, precioUnitarioMilesimas: 200 })) };
    expect((await dueno.herramienta('borrador_corregir', { id: b.id, args })).estado).toBe(200);
    const ap = await dueno.herramienta('borrador_aprobar', { id: b.id });
    expect(ap.estado).toBe(200);
    expect((await datosDe(dueno, 'borrador_ver', { id: b.id })).corregido).toBe(true);
    const resultado = ap.cuerpo.datos.resultado.datos ?? ap.cuerpo.datos.resultado;
    expect(resultado.totalCentimos).toBe(10000);
  });

  it('5 · sin acceso a Pedidos: modulo_no_disponible y ningún borrador nuevo', async () => {
    const antes = (await datosDe(sinPedidos, 'borradores_listar', {})).items?.length ?? 0;
    const r = await sinPedidos.herramienta('captura_proponer', { texto: 'Pedido para Juan Pérez, 500 tarjetas a 0.365', origen: 'voz', transcurridoMs: 3000, modulo: 'registro' });
    expect(codigoDe(r)).toBe('modulo_no_disponible');
    expect((await datosDe(sinPedidos, 'borradores_listar', {})).items?.length ?? 0).toBe(antes);
  });

  it('6 · sin líneas: ningún borrador, qué falta y la pista exacta', async () => {
    const r = await dictar(dueno, 'anota un pedido de tarjetas');
    expect(r.borradores).toEqual([]);
    expect(r.faltan).toEqual(['qué se pidió y su precio']);
    expect(r.pista).toBe('Dicta cada trabajo con su precio, por ejemplo: «Pedido para Rosa, 500 tarjetas a 0.365 y un millar de volantes a 240, adelanto 100, para el viernes».');
  });
});
