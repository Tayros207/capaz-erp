import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { diaMas } from '../../../pruebas/fechas.js';
import { confirmarCritica, crearCliente, datos, linea } from './pruebas-de-pedidos.js';

// Aviso de recompra por HTTP real: aparece en `ordenes_pendientes` y en `mi_dia_ver` (grupo «por_llamar») solo para quien
// tiene alcance «todos». Todos los nombres son inventados.

let app: AppDePruebas;
let dueno: Sesion;
let propio: Sesion;
let todos: Sesion; // alcance «todos» pero sin ser dueño ni administrador
let duenoC: Sesion;
let ajeno: Sesion;
let A: string;
let clientes: Record<'a' | 'b' | 'c' | 'd', string>;
let clienteAjeno: string;
let eco: string;

/** `n` pedidos confirmados, uno cada 7 días; el último hace `hace` días. Devuelve los ids. */
async function comprar(s: Sesion, clienteId: string, n: number, hace: number): Promise<string[]> {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = datos(await s.herramienta('pedido_crear', { clienteId, fecha: diaMas(-hace - 7 * (n - 1 - i)), lineas: [linea('Trabajo de prueba', 118)] }));
    datos(await s.herramienta('pedido_confirmar', { id: p.id }));
    ids.push(p.id);
  }
  return ids;
}

const todas = async (s: Sesion): Promise<any[]> => datos(await s.herramienta('ordenes_pendientes', {})).tarjetas.filter((t: any) => t.grupo === 'recompra');
const datosEco = async () => datos(await dueno.herramienta('clientes_buscar', { texto: 'Cliente Eco de Prueba' })).items[0];
/** Las tarjetas de recompra sin las del historial importado (que se prueban aparte). */
const pendientes = async (s: Sesion): Promise<any[]> => (await todas(s)).filter((t) => t.clave !== `recompra:${eco}` && !t.titulo.includes('Clientes varios'));

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, propio, ajeno, todos, duenoC] = await Promise.all(['Dueña', 'Propia', 'Ajena', 'Todos', 'Dueña C'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Empresa A de recompra');
  const B = await crearEmpresa(ajeno, 'Empresa B de recompra');
  await Promise.all([activarModulo(A, 'ordenes'), activarModulo(B, 'ordenes')]);
  await agregarMiembro(app, A, propio, { modulo: 'ordenes', nivel: 'completo', alcance: 'propios' });
  await agregarMiembro(app, A, todos, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  clientes = { a: await crearCliente(dueno, 'Cliente Alfa de Prueba'), b: await crearCliente(dueno, 'Cliente Beta de Prueba'), c: await crearCliente(dueno, 'Cliente Gama de Prueba'), d: await crearCliente(dueno, 'Cliente Delta de Prueba') };
  clienteAjeno = await crearCliente(ajeno, 'Cliente Épsilon de Prueba');
  await comprar(dueno, clientes.a, 6, 45);
  await comprar(dueno, clientes.b, 6, 5);
  const c = await comprar(dueno, clientes.c, 6, 45);
  for (const id of c.slice(0, 2)) datos(await confirmarCritica(dueno, 'pedido_cancelar', { id, motivo: 'desiste' }));
  await comprar(dueno, clientes.d, 6, 45);
  datos(await dueno.herramienta('pedido_crear', { clienteId: clientes.d, lineas: [linea('Borrador reciente', 50)] }));
  await comprar(ajeno, clienteAjeno, 6, 45);
  // Historial importado: seis días del comodín «(sin nombre)» y seis de un cliente real, ambos sin comprar hace tiempo.
  const fila = (cliente: string, i: number) => `${diaMas(-60 - 7 * i)},${cliente},Trabajo importado ${i},50`;
  const seis = (cliente: string) => Array.from({ length: 6 }, (_, i) => fila(cliente, i));
  const contenido = ['fecha,cliente,descripcion,total', ...seis('(sin nombre)'), ...seis('Cliente Eco de Prueba')].join('\n');
  datos(await confirmarCritica(dueno, 'pedidos_importar_historial', { contenido, crearClientesFaltantes: true }));
  eco = (await datosEco()).id;
});
afterAll(async () => {
  await app.cerrar();
});

describe('aviso de recompra', () => {
  it('sale el cliente que compraba cada 7 días y no compra hace 45; no salen los que compraron hace poco, tienen cancelados o un borrador reciente', async () => {
    const t = await pendientes(dueno);
    expect(t.map((x) => x.clave)).toEqual([`recompra:${clientes.a}`]);
    expect(t[0]).toMatchObject({ titulo: 'Llamar a Cliente Alfa de Prueba', urgencia: 'info', montoCentimos: null, entidad: { tipo: 'cliente', id: clientes.a } });
    expect(t[0].detalle).toContain('Compra cada ~7 días y no compra hace 45 días · Se está enfriando');
    expect(t[0].mensaje.texto).toContain('Hola Cliente Alfa de Prueba');
  });

  it('el historial importado: un cliente real sale; el comodín «Clientes varios (historial)» no', async () => {
    const t = await todas(dueno);
    expect(t.map((x) => x.clave)).toContain(`recompra:${eco}`);
    expect(t.some((x) => x.titulo.includes('Clientes varios'))).toBe(false);
  });

  it('también sale en mi_dia_ver dentro del grupo «por_llamar»', async () => {
    const d = datos(await dueno.herramienta('mi_dia_ver', {}));
    const g = d.grupos.find((x: any) => x.clave === 'por_llamar');
    expect(g?.tarjetas.map((x: any) => x.clave).filter((c: string) => c !== `recompra:${eco}`)).toEqual([`recompra:${clientes.a}`]);
  });

  it('quien tiene alcance «propios» no recibe los avisos', async () => {
    expect(await pendientes(propio)).toEqual([]);
  });

  it('quien tiene alcance «todos» pero no es dueño ni administrador no recibe los avisos', async () => {
    expect(await todas(todos)).toEqual([]);
  });

  it('con más de 15 candidatos salen 15 tarjetas y el total cuenta los de antes del tope', async () => {
    const C = await crearEmpresa(duenoC, 'Empresa C de recompra');
    await activarModulo(C, 'ordenes');
    const filas = Array.from({ length: 17 }, (_, k) => Array.from({ length: 6 }, (_, i) => `${diaMas(-60 - 7 * i)},Cliente Tope ${k} de Prueba,Trabajo ${k}-${i},${10 + k}`)).flat();
    datos(await confirmarCritica(duenoC, 'pedidos_importar_historial', { contenido: ['fecha,cliente,descripcion,total', ...filas].join('\n'), crearClientesFaltantes: true }));
    const r = datos(await duenoC.herramienta('ordenes_pendientes', {}));
    expect(r.tarjetas.filter((t: any) => t.grupo === 'recompra')).toHaveLength(15);
    expect(r.total).toBe(17);
    expect(r.tarjetas.filter((t: any) => t.grupo === 'recompra')[0].titulo).toBe('Llamar a Cliente Tope 16 de Prueba'); // la de mayor venta primero, sin reordenar por fecha
  });

  it('nada cruza entre empresas', async () => {
    const t = await pendientes(ajeno);
    expect(t.map((x) => x.clave)).toEqual([`recompra:${clienteAjeno}`]);
  });
});
