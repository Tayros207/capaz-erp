import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { emitirGuia, deLaGuia, libre, pedidoListo } from './pruebas-de-guias.js';
import { codigo, crearBorrador, crearCliente, datos, eventosDe, mensaje } from './pruebas-de-pedidos.js';

// Guías de remisión por HTTP real: preparar, emitir, tope de lo enviado, concurrencia, permisos y reimpresión idéntica.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion;
let propio: Sesion;
let ajeno: Sesion;
let empresaA: string;
let empresaB: string;
let cliente: string;
let otroCliente: string;

const preparar = (args: Record<string, unknown>, s: Sesion = dueno) => s.herramienta('guia_preparar', args);
const contador = (empresaId: string) =>
  comoEmpresa(appPool, empresaId, async (c) => {
    const r = await c.query(`select ultimo from core.contadores where clave = 'ordenes.guia' and serie = 'G001'`);
    return r.rows[0] ? Number(r.rows[0].ultimo) : 0;
  });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de guías');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de guías');
  await Promise.all([activarModulo(empresaA, 'ordenes'), activarModulo(empresaB, 'ordenes')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'ordenes', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'ordenes', nivel: 'completo', alcance: 'propios' });
  cliente = datos(await dueno.herramienta('clientes_crear', { nombre: 'Imprenta Sol', documentoTipo: 'dni', documentoNumero: '12345678', direccion: 'Av. Sol 123' })).id;
  otroCliente = await crearCliente(dueno, 'Otra Imprenta');
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('guia_preparar', () => {
  it('muestra lo pedido, lo enviado y lo pendiente, con los datos del cliente', async () => {
    const p = await pedidoListo(dueno, cliente);
    const r = datos(await preparar({ pedidoIds: [p.id] }));
    expect(r.cliente).toEqual({ id: cliente, nombre: 'Imprenta Sol', documento: 'DNI 12345678', direccion: 'Av. Sol 123' });
    expect(r.pedidos).toHaveLength(1);
    expect(r.pedidos[0]).toMatchObject({ id: p.id, codigo: p.codigo, estado: 'listo' });
    expect(r.pedidos[0].lineas).toEqual([
      { pedidoLineaId: p.detalle[0].id, posicion: 0, productoId: null, descripcion: 'Tarjetas', unidad: 'unidad', pedidaMilesimas: 5000, enviadaMilesimas: 0, pendienteMilesimas: 5000 },
    ]);
  });

  it('los candidatos son los listos o entregados del mismo cliente con algo pendiente', async () => {
    const c = datos(await dueno.herramienta('clientes_crear', { nombre: 'Cliente de candidatos' })).id;
    const listo = await pedidoListo(dueno, c);
    const incluido = await pedidoListo(dueno, c);
    const completo = await pedidoListo(dueno, c);
    datos(await emitirGuia(dueno, c, [deLaGuia(completo, 5000)]));
    const enProceso = await crearBorrador(dueno, c);
    datos(await dueno.herramienta('pedido_confirmar', { id: enProceso.id }));
    datos(await dueno.herramienta('pedido_cambiar_estado', { id: enProceso.id, estado: 'en_proceso' }));
    await pedidoListo(dueno, otroCliente);
    const entregado = await pedidoListo(dueno, c);
    datos(await dueno.herramienta('pedido_cambiar_estado', { id: entregado.id, estado: 'entregado' }));

    const r = datos(await preparar({ clienteId: c, pedidoIds: [incluido.id] }));
    const ids = r.candidatos.map((x: any) => x.id).sort();
    expect(ids).toEqual([listo.id, entregado.id].sort());
    expect(r.candidatos.find((x: any) => x.id === listo.id)).toMatchObject({ estado: 'listo', lineasPendientes: 1 });
  });

  it('rechaza mezcla de clientes, estados, pedidos ajenos y la falta de datos', async () => {
    const a = await pedidoListo(dueno, cliente);
    const b = await pedidoListo(dueno, otroCliente);
    expect(codigo(await preparar({ pedidoIds: [a.id, b.id] }))).toBe('conflicto');
    const enProceso = await crearBorrador(dueno, cliente);
    datos(await dueno.herramienta('pedido_confirmar', { id: enProceso.id }));
    datos(await dueno.herramienta('pedido_cambiar_estado', { id: enProceso.id, estado: 'en_proceso' }));
    expect(codigo(await preparar({ pedidoIds: [enProceso.id] }))).toBe('conflicto');
    expect(codigo(await preparar({ pedidoIds: [a.id] }, ajeno))).toBe('no_encontrado');
    expect(codigo(await preparar({ pedidoIds: ['0192f0c4-7b1e-7000-8000-0000000000ff'] }))).toBe('no_encontrado');
    expect(codigo(await preparar({}))).toBe('argumentos_invalidos');
  });

  it('solo con el cliente: sin pedidos y con candidatos', async () => {
    await pedidoListo(dueno, cliente);
    const r = datos(await preparar({ clienteId: cliente }));
    expect(r.pedidos).toEqual([]);
    expect(r.candidatos.length).toBeGreaterThan(0);
  });
});

describe('guia_emitir', () => {
  it('dos pedidos del mismo cliente y una línea libre: código, orden, copia del destinatario, historial y evento', async () => {
    const a = await pedidoListo(dueno, cliente, [['Tarjetas', 10, 5], ['Volantes', 5, 3]]);
    const b = await pedidoListo(dueno, cliente);
    const antes = await contador(empresaA);
    const g = datos(await emitirGuia(dueno, cliente, [deLaGuia(b, 2000), libre('Caja de embalaje', 1000, 'caja'), deLaGuia(a, 3000, 1)], { observaciones: ' Frágil ' }));
    expect(g.codigo).toBe(`G001-${String(antes + 1).padStart(6, '0')}`);
    expect(g.codigo).toMatch(/^G001-\d{6}$/);
    expect(g).toMatchObject({ estado: 'emitida', destinatarioNombre: 'Imprenta Sol', destinatarioDocumento: null, observaciones: 'Frágil', lineas: 3, creadoPorNombre: 'Dueña' });
    expect(g.fechaEmision).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g.detalle.map((l: any) => [l.posicion, l.descripcion, l.unidad, l.cantidadMilesimas, l.pedidoCodigo])).toEqual([
      [0, 'Tarjetas', 'unidad', 2000, b.codigo],
      [1, 'Caja de embalaje', 'caja', 1000, null],
      [2, 'Volantes', 'unidad', 3000, a.codigo],
    ]);
    expect(g.pedidos.map((p: any) => p.codigo)).toEqual([a.codigo, b.codigo].sort());
    for (const p of [a, b]) {
      const h = datos(await dueno.herramienta('pedido_ver', { id: p.id })).historial[0];
      expect(h).toMatchObject({ tipo: 'guia_emitida', guia: { id: g.id, codigo: g.codigo } });
    }
    const ev = (await eventosDe(appPool, empresaA, 'guia.emitida')).filter((e) => e.carga.id === g.id);
    expect(ev.map((e) => e.carga)).toEqual([{ id: g.id, codigo: g.codigo, clienteId: cliente, pedidoIds: [a.id, b.id].sort(), lineas: 3 }]);
  });

  it('entregas parciales: 3 de 5, luego 2, luego 1 es conflicto; preparar muestra enviada 5', async () => {
    const p = await pedidoListo(dueno, cliente);
    datos(await emitirGuia(dueno, cliente, [deLaGuia(p, 3000)]));
    datos(await emitirGuia(dueno, cliente, [deLaGuia(p, 2000)]));
    const r = await emitirGuia(dueno, cliente, [deLaGuia(p, 1000)]);
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toMatch(/ya se envió completa/);
    const linea = datos(await preparar({ pedidoIds: [p.id] })).pedidos[0].lineas[0];
    expect([linea.enviadaMilesimas, linea.pendienteMilesimas]).toEqual([5000, 0]);
    const demas = await pedidoListo(dueno, cliente);
    expect(mensaje(await emitirGuia(dueno, cliente, [deLaGuia(demas, 6000)]))).toMatch(/quedan 5 unidad por enviar y pides 6/);
  });

  it('una guía es de un solo cliente y el pedido debe estar listo o entregado', async () => {
    const ajenoDeCliente = await pedidoListo(dueno, otroCliente);
    expect(codigo(await emitirGuia(dueno, cliente, [deLaGuia(ajenoDeCliente, 1000)]))).toBe('conflicto');
    for (const estado of ['borrador', 'confirmado', 'en_proceso', 'cancelado']) {
      const p = await crearBorrador(dueno, cliente);
      if (estado !== 'borrador') datos(await dueno.herramienta('pedido_confirmar', { id: p.id }));
      if (estado === 'en_proceso') datos(await dueno.herramienta('pedido_cambiar_estado', { id: p.id, estado }));
      if (estado === 'cancelado') datos(await dueno.herramienta('pedido_cancelar', { id: p.id, motivo: 'x' }).then(async (r) => (r.cuerpo.requiereConfirmacion ? dueno.herramienta('pedido_cancelar', { id: p.id, motivo: 'x' }, { confirmacion: r.cuerpo.requiereConfirmacion.token }) : r)));
      const detalle = datos(await dueno.herramienta('pedido_ver', { id: p.id })).detalle;
      const r = await emitirGuia(dueno, cliente, [{ tipo: 'pedido', pedidoLineaId: detalle[0].id, cantidadMilesimas: 1000 }]);
      expect(codigo(r), estado).toBe('conflicto');
    }
  });

  it('valida los argumentos; la empresa no se acepta como argumento', async () => {
    expect(codigo(await emitirGuia(dueno, cliente, []))).toBe('argumentos_invalidos');
    expect(codigo(await emitirGuia(dueno, cliente, [libre('x')], { motivo: 'otro' }))).toBe('argumentos_invalidos');
    expect(codigo(await emitirGuia(dueno, cliente, [libre('x')], { modalidad: 'publico' }))).toBe('argumentos_invalidos');
    expect(codigo(await emitirGuia(dueno, cliente, [libre('x', 0)]))).toBe('argumentos_invalidos');
    expect(codigo(await emitirGuia(dueno, '0192f0c4-7b1e-7000-8000-0000000000fe', [libre('x')]))).toBe('argumentos_invalidos');
    expect(codigo(await emitirGuia(dueno, cliente, [libre('x')], { empresaId: empresaB }))).toBe('argumento_prohibido');
  });

  it('una línea de pedido de otra empresa no existe', async () => {
    const deB = await crearCliente(ajeno, 'Cliente de B');
    const pB = await pedidoListo(ajeno, deB);
    const r = await emitirGuia(dueno, cliente, [deLaGuia(pB, 1000)]);
    expect(codigo(r)).toBe('argumentos_invalidos');
    expect(mensaje(r)).toBe('Línea 1: esa línea de pedido no existe.');
  });

  it('con transporte privado se descarta el transportista; el detalle se descarta si el motivo no es «otro»', async () => {
    const g = datos(await emitirGuia(dueno, cliente, [libre('x')], { transportista: 'Cruz', motivoDetalle: 'algo' }));
    expect(g).toMatchObject({ transportista: null, motivoDetalle: null });
    const h = datos(await emitirGuia(dueno, cliente, [libre('x')], { modalidad: 'publico', transportista: 'Cruz del Sur', motivo: 'otro', motivoDetalle: 'Muestra' }));
    expect(h).toMatchObject({ transportista: 'Cruz del Sur', motivoDetalle: 'Muestra' });
  });

  it('un rechazo no consume número; la misma clave de idempotencia no emite dos guías', async () => {
    const antes = await contador(empresaA);
    expect(codigo(await emitirGuia(dueno, cliente, [{ tipo: 'pedido', pedidoLineaId: '0192f0c4-7b1e-7000-8000-0000000000fd', cantidadMilesimas: 1000 }]))).toBe('argumentos_invalidos');
    expect(await contador(empresaA)).toBe(antes);
    const clave = `clave-${Date.now()}-guia-unica`;
    const [x, y] = [await emitirGuia(dueno, cliente, [libre('uno')], {}, { clave }), await emitirGuia(dueno, cliente, [libre('uno')], {}, { clave })];
    expect(datos(x).id).toBe(datos(y).id);
    expect(await contador(empresaA)).toBe(antes + 1);
  });
});

describe('concurrencia', () => {
  it('cinco guías libres a la vez: números consecutivos, sin repetir ni saltar', async () => {
    const antes = await contador(empresaA);
    const r = await Promise.all([1, 2, 3, 4, 5].map((i) => emitirGuia(dueno, cliente, [libre(`Caja ${i}`)])));
    const numeros = r.map((x) => datos(x).numero as number).sort((a, b) => a - b);
    expect(numeros).toEqual([1, 2, 3, 4, 5].map((i) => antes + i));
  });

  it('dos guías con todo el pendiente de la misma línea: una gana y la otra es conflicto', async () => {
    const p = await pedidoListo(dueno, cliente);
    const r = await Promise.all([1, 2].map(() => emitirGuia(dueno, cliente, [deLaGuia(p, 5000)])));
    expect(r.filter((x) => x.cuerpo.ok)).toHaveLength(1);
    expect(r.filter((x) => !x.cuerpo.ok).map(codigo)).toEqual(['conflicto']);
    const l = datos(await preparar({ pedidoIds: [p.id] })).pedidos[0].lineas[0];
    expect(l.enviadaMilesimas).toBeLessThanOrEqual(l.pedidaMilesimas);
  });
});

describe('permisos y reimpresión', () => {
  it('el lector no emite pero ve y lista; otra empresa no encuentra la guía', async () => {
    const g = datos(await emitirGuia(dueno, cliente, [libre('x')]));
    const r = await emitirGuia(lector, cliente, [libre('x')]);
    expect([r.estado, codigo(r)]).toEqual([403, 'modulo_solo_lectura']);
    expect(datos(await lector.herramienta('guia_ver', { id: g.id })).id).toBe(g.id);
    expect(datos(await lector.herramienta('guias_listar', {})).items.some((x: any) => x.id === g.id)).toBe(true);
    expect(codigo(await ajeno.herramienta('guia_ver', { id: g.id }))).toBe('no_encontrado');
  });

  it('con alcance «propios»: un pedido ajeno no se encuentra, con los suyos emite y solo ve sus guías', async () => {
    const delDueno = await pedidoListo(dueno, cliente);
    expect(codigo(await emitirGuia(propio, cliente, [deLaGuia(delDueno, 1000)]))).toBe('no_encontrado');
    const suyo = await pedidoListo(propio, cliente);
    const g = datos(await emitirGuia(propio, cliente, [deLaGuia(suyo, 1000)]));
    const delOtro = datos(await emitirGuia(dueno, cliente, [libre('del dueño')]));
    const visibles = datos(await propio.herramienta('guias_listar', {})).items.map((x: any) => x.id);
    expect(visibles).toContain(g.id);
    expect(visibles).not.toContain(delOtro.id);
    expect(codigo(await propio.herramienta('guia_ver', { id: delOtro.id }))).toBe('no_encontrado');
  });

  it('reimpresión idéntica: editar el cliente no cambia lo emitido', async () => {
    const g = datos(await emitirGuia(dueno, cliente, [libre('x')], { destinatarioDocumento: 'DNI 12345678' }));
    datos(await dueno.herramienta('clientes_editar', { id: cliente, nombre: 'Imprenta Sol Renovada', direccion: 'Av. Nueva 999' }));
    const despues = datos(await dueno.herramienta('guia_ver', { id: g.id }));
    expect(despues).toEqual(g);
    expect(despues.destinatarioNombre).toBe('Imprenta Sol');
  });
});
