import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool } from '../../../pruebas/base-de-pruebas.js';
import { activarCompras, codigo, confirmarCritica, contadorDe, crearBorrador, crearEnviada, crearProveedor, datos, eventosDe, mensaje, recibir } from './pruebas-de-compras.js';

// Compras por HTTP real, parte 2: enviar (número correlativo y evento) y cancelar (crítica).

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: compras en lectura
let empresaA: string;
let proveedor: string;
let principal: string; // código de la sucursal principal de A

const enviar = async (id: string) => datos(await dueno.herramienta('compra_enviar', { id }));
const contador = (serie: string) => contadorDe(appPool, empresaA, serie);
const eventosDeLaOrden = async (tipo: string, ordenId: string) => (await eventosDe(appPool, empresaA, tipo)).filter((e) => e.carga.ordenId === ordenId);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector] = await Promise.all(['Dueña', 'Lectora'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa de envíos de compras');
  await activarCompras(empresaA);
  await agregarMiembro(app, empresaA, lector, { modulo: 'compras', nivel: 'lectura', alcance: 'todos' });
  proveedor = await crearProveedor(dueno, 'Papelera Andina');
  principal = datos(await dueno.herramienta('sucursales_listar', {})).items.find((s: any) => s.esPrincipal).codigo;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('compra_enviar', () => {
  it('asigna número, serie y año con el código OC-…, y emite compra.enviada una sola vez', async () => {
    const c = await crearBorrador(dueno, proveedor, { entregaEl: '2099-02-01' });
    const antes = await contador(principal);
    const e = await enviar(c.id);
    expect(e).toMatchObject({ estado: 'enviada', serie: principal, numero: antes + 1, totalCentimos: 11_800, lineasPorRecibir: 1 });
    expect(e.codigo).toBe(`OC-${principal}-${e.anio}-${String(antes + 1).padStart(4, '0')}`);
    expect((await eventosDeLaOrden('compra.enviada', c.id)).map((x) => x.carga)).toEqual([{ ordenId: c.id, numero: e.codigo, proveedorId: proveedor, totalCentimos: 11_800 }]);

    const otra = await dueno.herramienta('compra_enviar', { id: c.id });
    expect(otra.estado).toBe(409);
    expect(mensaje(otra)).toBe('Una orden «enviada» no puede pasar a «enviada».');
    expect(await eventosDeLaOrden('compra.enviada', c.id)).toHaveLength(1);
    expect(await contador(principal)).toBe(antes + 1);
  });

  it('sin líneas es conflicto, no gasta número ni emite', async () => {
    const vacia = datos(await dueno.herramienta('compra_crear', { proveedorId: proveedor }));
    const [antes, eventosAntes] = [await contador(principal), (await eventosDe(appPool, empresaA)).length];
    const r = await dueno.herramienta('compra_enviar', { id: vacia.id });
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toMatch(/al menos una línea/);
    expect(await contador(principal)).toBe(antes);
    expect((await eventosDe(appPool, empresaA)).length).toBe(eventosAntes);
    expect(datos(await dueno.herramienta('compra_ver', { id: vacia.id }))).toMatchObject({ estado: 'borrador', numero: null });
  });

  it('la serie sale de la sucursal de la orden y cada serie lleva su propia cuenta (también aparte de Pedidos)', async () => {
    const sur = datos(await dueno.herramienta('sucursal_crear', { codigo: 'SUR', nombre: 'Tienda Sur' }));
    const a = await enviar((await crearBorrador(dueno, proveedor, { sucursalId: sur.id })).id);
    const b = await enviar((await crearBorrador(dueno, proveedor, { sucursalId: sur.id })).id);
    expect([a.serie, a.numero, b.numero, a.sucursalId]).toEqual(['SUR', 1, 2, sur.id]);
    expect(a.codigo).toBe(`OC-SUR-${a.anio}-0001`);
  });

  it('envíos simultáneos de órdenes distintas: números consecutivos, sin repetir ni saltar aunque uno falle', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) ids.push((await crearBorrador(dueno, proveedor)).id);
    const vacia = datos(await dueno.herramienta('compra_crear', { proveedorId: proveedor })).id;
    const antes = await contador(principal);
    const respuestas = await Promise.all([...ids.slice(0, 4), vacia, ...ids.slice(4)].map((id) => dueno.herramienta('compra_enviar', { id })));
    const numeros = respuestas.filter((r) => r.cuerpo.ok).map((r) => r.cuerpo.datos.numero as number).sort((x, y) => x - y);
    expect(numeros).toEqual(Array.from({ length: 8 }, (_, i) => antes + 1 + i));
    expect(respuestas.filter((r) => !r.cuerpo.ok).map(codigo)).toEqual(['conflicto']);
    expect(await contador(principal)).toBe(antes + 8);
  });

  it('la misma orden enviada tres veces a la vez: una gana, un solo número y un solo evento', async () => {
    const c = await crearBorrador(dueno, proveedor);
    const antes = await contador(principal);
    const r = await Promise.all([1, 2, 3].map(() => dueno.herramienta('compra_enviar', { id: c.id })));
    expect(r.filter((x) => x.cuerpo.ok)).toHaveLength(1);
    expect(r.filter((x) => !x.cuerpo.ok).map(codigo)).toEqual(['conflicto', 'conflicto']);
    expect(await contador(principal)).toBe(antes + 1);
    expect(await eventosDeLaOrden('compra.enviada', c.id)).toHaveLength(1);
  });
});

describe('compra_cancelar (crítica)', () => {
  it('pide confirmación y no cambia nada hasta confirmar; conserva el número y emite compra.cancelada', async () => {
    const c = await crearEnviada(dueno, proveedor);
    const pide = await dueno.herramienta('compra_cancelar', { id: c.id, motivo: 'El proveedor no tiene stock' });
    expect(pide.cuerpo.ok).toBe(false);
    expect(pide.cuerpo.requiereConfirmacion.resumen).toBe(`Se cancelará la orden ${c.codigo} (enviada) por S/ 118.00. No se puede deshacer.`);
    expect(datos(await dueno.herramienta('compra_ver', { id: c.id })).estado).toBe('enviada');
    expect(await eventosDeLaOrden('compra.cancelada', c.id)).toEqual([]);

    const r = datos(await dueno.herramienta('compra_cancelar', { id: c.id, motivo: 'El proveedor no tiene stock' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token }));
    expect(r).toMatchObject({ estado: 'cancelada', numero: c.numero, codigo: c.codigo, motivoCancelacion: 'El proveedor no tiene stock', atrasada: false });
    expect(r.canceladoEn).not.toBeNull();
    expect((await eventosDeLaOrden('compra.cancelada', c.id)).map((e) => e.carga)).toEqual([{ ordenId: c.id, numero: c.codigo }]);
    expect(codigo(await dueno.herramienta('compra_cancelar', { id: c.id, motivo: 'otra vez' }))).toBe('conflicto');
    expect(codigo(await recibir(dueno, c, [1_000]))).toBe('conflicto');
  });

  it('cancelar un borrador no emite; con recepciones no se cancela', async () => {
    const b = await crearBorrador(dueno, proveedor);
    const antes = (await eventosDe(appPool, empresaA)).length;
    expect(datos(await confirmarCritica(dueno, 'compra_cancelar', { id: b.id, motivo: 'Se anotó por error' }))).toMatchObject({ estado: 'cancelada', numero: null, codigo: 'Borrador' });
    expect((await eventosDe(appPool, empresaA)).length).toBe(antes);

    const conRecepcion = await crearEnviada(dueno, proveedor);
    datos(await recibir(dueno, conRecepcion, [1_000]));
    const r = await dueno.herramienta('compra_cancelar', { id: conRecepcion.id, motivo: 'tarde' });
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toBe('La orden ya tiene recepciones: no se puede cancelar.');
    const recibida = await crearEnviada(dueno, proveedor);
    datos(await recibir(dueno, recibida, [10_000]));
    expect(mensaje(await dueno.herramienta('compra_cancelar', { id: recibida.id, motivo: 'tarde' }))).toBe('La orden ya tiene recepciones: no se puede cancelar.');
  });

  it('si llega una recepción entre el resumen y la confirmación, el token ya no vale y nada cambia', async () => {
    const c = await crearEnviada(dueno, proveedor);
    const pide = await dueno.herramienta('compra_cancelar', { id: c.id, motivo: 'duda' });
    datos(await recibir(dueno, c, [1_000]));
    const r = await dueno.herramienta('compra_cancelar', { id: c.id, motivo: 'duda' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(r.cuerpo.ok).toBe(false);
    expect(datos(await dueno.herramienta('compra_ver', { id: c.id })).estado).toBe('recibida_parcial');
  });

  it('lectura no envía ni cancela', async () => {
    const c = await crearBorrador(dueno, proveedor);
    expect(codigo(await lector.herramienta('compra_enviar', { id: c.id }))).toBe('modulo_solo_lectura');
    expect(codigo(await lector.herramienta('compra_cancelar', { id: c.id, motivo: 'x' }))).toBe('modulo_solo_lectura');
    expect(datos(await dueno.herramienta('compra_ver', { id: c.id })).estado).toBe('borrador');
  });
});
