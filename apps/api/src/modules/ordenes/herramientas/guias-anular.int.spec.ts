import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { deLaGuia, emitirGuia, libre, pedidoListo } from './pruebas-de-guias.js';
import { codigo, confirmarCritica, crearCliente, datos, eventosDe, mensaje } from './pruebas-de-pedidos.js';

// Anular guías (crítica, dos pasos), listado y la relación con cancelar un pedido.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion;
let propio: Sesion;
let ajeno: Sesion;
let empresaA: string;
let cliente: string;
let otroCliente: string;

const anular = (s: Sesion, id: string, motivo = 'Se emitió por error') => confirmarCritica(s, 'guia_anular', { id, motivo });
const pendiente = async (pedidoId: string) => datos(await dueno.herramienta('guia_preparar', { pedidoIds: [pedidoId] })).pedidos[0].lineas[0].pendienteMilesimas as number;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de anulaciones');
  const empresaB = await crearEmpresa(ajeno, 'Empresa B de anulaciones');
  await Promise.all([activarModulo(empresaA, 'ordenes'), activarModulo(empresaB, 'ordenes')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'ordenes', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'ordenes', nivel: 'completo', alcance: 'propios' });
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  otroCliente = await crearCliente(dueno, 'Otra Imprenta');
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('guia_anular', () => {
  it('el resumen nombra el código y advierte; al confirmar queda anulada con su motivo y quién la anuló', async () => {
    const p = await pedidoListo(dueno, cliente);
    const g = datos(await emitirGuia(dueno, cliente, [deLaGuia(p, 3000)]));
    const pide = await dueno.herramienta('guia_anular', { id: g.id, motivo: 'Cantidad equivocada' });
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain(g.codigo);
    expect(pide.cuerpo.requiereConfirmacion.resumen).toMatch(/número no se vuelve a usar/);
    expect(datos(await dueno.herramienta('guia_ver', { id: g.id })).estado).toBe('emitida');
    const r = datos(await dueno.herramienta('guia_anular', { id: g.id, motivo: 'Cantidad equivocada' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token }));
    expect(r).toMatchObject({ estado: 'anulada', motivoAnulacion: 'Cantidad equivocada', anuladoPorNombre: 'Dueña', anuladoPor: dueno.usuarioId, detalle: g.detalle });
    expect(r.anuladoEn).not.toBeNull();
  });

  it('lo enviado vuelve a quedar pendiente y la guía siguiente toma el número siguiente', async () => {
    const p = await pedidoListo(dueno, cliente);
    const g = datos(await emitirGuia(dueno, cliente, [deLaGuia(p, 5000)]));
    expect(await pendiente(p.id)).toBe(0);
    datos(await anular(dueno, g.id));
    expect(await pendiente(p.id)).toBe(5000);
    const otra = datos(await emitirGuia(dueno, cliente, [deLaGuia(p, 5000)]));
    expect(otra.numero).toBe(g.numero + 1);
  });

  it('cada pedido registra guia_anulada con la nota y se emite guia.anulada', async () => {
    const a = await pedidoListo(dueno, cliente);
    const b = await pedidoListo(dueno, cliente);
    const g = datos(await emitirGuia(dueno, cliente, [deLaGuia(a, 1000), deLaGuia(b, 1000)]));
    datos(await anular(dueno, g.id, 'No salió'));
    for (const p of [a, b]) {
      expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).historial[0]).toMatchObject({ tipo: 'guia_anulada', nota: 'No salió', guia: { id: g.id, codigo: g.codigo } });
    }
    const ev = (await eventosDe(appPool, empresaA, 'guia.anulada')).filter((e) => e.carga.id === g.id);
    expect(ev.map((e) => e.carga)).toEqual([{ id: g.id, codigo: g.codigo, clienteId: cliente, pedidoIds: [a.id, b.id].sort() }]);
  });

  it('anular dos veces es conflicto', async () => {
    const g = datos(await emitirGuia(dueno, cliente, [libre('x')]));
    datos(await anular(dueno, g.id));
    const r = await dueno.herramienta('guia_anular', { id: g.id, motivo: 'otra vez' });
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toBe('La guía ya estaba anulada.');
  });

  it('permisos: el lector no anula; «propios» no toca guías ajenas; otra empresa no la encuentra', async () => {
    const g = datos(await emitirGuia(dueno, cliente, [libre('x')]));
    expect(codigo(await lector.herramienta('guia_anular', { id: g.id, motivo: 'x' }))).toBe('modulo_solo_lectura');
    expect(codigo(await propio.herramienta('guia_anular', { id: g.id, motivo: 'x' }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('guia_anular', { id: g.id, motivo: 'x' }))).toBe('no_encontrado');
    expect(datos(await dueno.herramienta('guia_ver', { id: g.id })).estado).toBe('emitida');
  });

  it('si la guía cambia entre el resumen y la confirmación, el token ya no vale', async () => {
    const g = datos(await emitirGuia(dueno, cliente, [libre('x')]));
    const pide = await dueno.herramienta('guia_anular', { id: g.id, motivo: 'x' });
    datos(await anular(dueno, g.id, 'Otra sesión la anuló'));
    const r = await dueno.herramienta('guia_anular', { id: g.id, motivo: 'x' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(r.cuerpo.ok).toBe(false);
    expect(r.cuerpo.datos).toBeUndefined();
  });
});

describe('pedido_cancelar con guías', () => {
  it('se niega con una guía emitida; tras anularla, cancela', async () => {
    const p = await pedidoListo(dueno, cliente);
    const g = datos(await emitirGuia(dueno, cliente, [deLaGuia(p, 1000)]));
    const r = await dueno.herramienta('pedido_cancelar', { id: p.id, motivo: 'desiste' });
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toBe(`El pedido tiene la guía ${g.codigo} emitida: anúlala antes de cancelar el pedido.`);
    datos(await anular(dueno, g.id));
    expect(datos(await confirmarCritica(dueno, 'pedido_cancelar', { id: p.id, motivo: 'desiste' })).estado).toBe('cancelado');
  });
});

describe('guias_listar', () => {
  it('filtra por estado, cliente y pedido; pagina con cursor; un cursor inválido es argumentos_invalidos', async () => {
    const c = await crearCliente(dueno, 'Cliente del listado');
    const p = await pedidoListo(dueno, c);
    const a = datos(await emitirGuia(dueno, c, [deLaGuia(p, 1000)]));
    const b = datos(await emitirGuia(dueno, c, [deLaGuia(p, 1000)]));
    const libreDeOtro = datos(await emitirGuia(dueno, otroCliente, [libre('x')]));
    datos(await anular(dueno, b.id));
    const ids = async (f: Record<string, unknown>) => datos(await dueno.herramienta('guias_listar', f)).items.map((x: any) => x.id) as string[];
    expect(await ids({ clienteId: c })).toEqual([b.id, a.id]);
    expect(await ids({ clienteId: c, estado: 'emitida' })).toEqual([a.id]);
    expect(await ids({ clienteId: c, estado: 'anulada' })).toEqual([b.id]);
    expect(await ids({ pedidoId: p.id })).toEqual([b.id, a.id]);
    expect(await ids({ clienteId: otroCliente, pedidoId: p.id })).toEqual([]);
    expect(await ids({ clienteId: otroCliente })).toContain(libreDeOtro.id);
    const uno = datos(await dueno.herramienta('guias_listar', { clienteId: c, limite: 1 }));
    expect(uno.items.map((x: any) => x.id)).toEqual([b.id]);
    const dos = datos(await dueno.herramienta('guias_listar', { clienteId: c, limite: 1, cursor: uno.siguiente }));
    expect(dos.items.map((x: any) => x.id)).toEqual([a.id]);
    expect(dos.items[0].pedidos).toEqual([{ id: p.id, codigo: p.codigo }]);
    expect(codigo(await dueno.herramienta('guias_listar', { cursor: 'basura' }))).toBe('argumentos_invalidos');
  });
});
