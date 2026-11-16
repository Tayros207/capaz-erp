import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { AVANCES_DE_PEDIDO, ESTADOS_DE_PEDIDO, type EstadoDePedido } from '@capaz/shared';
import { RegistroDeFuentesDeTiempo } from '../../../core/automatizaciones/tipos.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa, conEmpresaDePruebas } from '../../../pruebas/base-de-pruebas.js';
import { codigo, confirmarCritica, crearBorrador, crearCliente, datos, eventosDe, mensaje } from './pruebas-de-pedidos.js';

// Pedidos por HTTP real, parte 2: confirmar (número correlativo y evento), estados, cancelar (crítica),
// resumen y fuente de tiempo.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A
let lector: Sesion; // member de A: ordenes en lectura
let propio: Sesion; // member de A: ordenes completo, alcance propios
let ajeno: Sesion; // owner de B
let empresaA: string;
let empresaB: string;
let cliente: string;
let principal: string; // código de la sucursal principal de A

const confirmar = async (s: Sesion, id: string) => datos(await s.herramienta('pedido_confirmar', { id }));
const pasar = (s: Sesion, id: string, estado: string) => s.herramienta('pedido_cambiar_estado', { id, estado });
const contador = (empresaId: string, serie: string) =>
  comoEmpresa(appPool, empresaId, async (c) => {
    const r = await c.query(`select ultimo from core.contadores where clave = 'ordenes.pedido' and serie = $1`, [serie]);
    return r.rows[0] ? Number(r.rows[0].ultimo) : 0;
  });

/** Lleva un pedido nuevo hasta `estado` por el camino más corto. */
async function pedidoEn(estado: EstadoDePedido): Promise<any> {
  const p = await crearBorrador(dueno, cliente);
  if (estado === 'borrador') return p;
  if (estado === 'cancelado') return datos(await confirmarCritica(dueno, 'pedido_cancelar', { id: p.id, motivo: 'prueba' }));
  const confirmado = await confirmar(dueno, p.id);
  return estado === 'confirmado' ? confirmado : datos(await pasar(dueno, p.id, estado));
}

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, propio, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  empresaA = await crearEmpresa(dueno, 'Empresa A de estados');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de estados');
  await Promise.all([activarModulo(empresaA, 'ordenes'), activarModulo(empresaB, 'ordenes')]);
  await agregarMiembro(app, empresaA, lector, { modulo: 'ordenes', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, empresaA, propio, { modulo: 'ordenes', nivel: 'completo', alcance: 'propios' });
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  principal = datos(await dueno.herramienta('sucursales_listar', {})).items.find((s: any) => s.esPrincipal).codigo;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('pedido_confirmar', () => {
  it('asigna número, serie y año, y emite pedido.confirmado una sola vez en la misma transacción', async () => {
    const p = await crearBorrador(dueno, cliente, { entregaEl: '2099-02-01' });
    const antes = await contador(empresaA, principal);
    const c = await confirmar(dueno, p.id);
    expect(c).toMatchObject({ estado: 'confirmado', serie: principal, numero: antes + 1, totalCentimos: 11_800 });
    expect(c.codigo).toBe(`PED-${principal}-${c.anio}-${String(antes + 1).padStart(4, '0')}`);
    expect(c.confirmadoEn).not.toBeNull();
    expect(c.historial.slice(0, 1)).toMatchObject([{ tipo: 'confirmado', estadoAnterior: 'borrador', estadoNuevo: 'confirmado' }]);
    const emitidos = (await eventosDe(appPool, empresaA, 'pedido.confirmado')).filter((e) => e.carga.id === p.id);
    expect(emitidos.map((e) => e.carga)).toEqual([{ id: p.id, codigo: c.codigo, clienteId: cliente, totalCentimos: 11_800, entregaEl: '2099-02-01', sucursalId: null }]);

    const otra = await dueno.herramienta('pedido_confirmar', { id: p.id });
    expect(otra.estado).toBe(409);
    expect(mensaje(otra)).toBe('Un pedido «confirmado» no puede pasar a «confirmado».');
    expect((await eventosDe(appPool, empresaA, 'pedido.confirmado')).filter((e) => e.carga.id === p.id)).toHaveLength(1);
    expect(await contador(empresaA, principal)).toBe(antes + 1);
  });

  it('sin líneas es conflicto, no gasta número ni emite; un confirmado ya no se edita', async () => {
    const vacio = datos(await dueno.herramienta('pedido_crear', { clienteId: cliente }));
    const [antes, eventosAntes] = [await contador(empresaA, principal), (await eventosDe(appPool, empresaA)).length];
    const r = await dueno.herramienta('pedido_confirmar', { id: vacio.id });
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toMatch(/al menos una línea/);
    expect(await contador(empresaA, principal)).toBe(antes);
    expect((await eventosDe(appPool, empresaA)).length).toBe(eventosAntes);
    expect(datos(await dueno.herramienta('pedido_ver', { id: vacio.id }))).toMatchObject({ estado: 'borrador', numero: null });

    const c = await pedidoEn('confirmado');
    const editar = await dueno.herramienta('pedido_editar', { id: c.id, notas: 'tarde' });
    expect(codigo(editar)).toBe('conflicto');
    expect(mensaje(editar)).toBe('Solo se edita un pedido en borrador.');
    expect(codigo(await dueno.herramienta('pedido_editar', { id: c.id, lineas: [] }))).toBe('conflicto');
    expect(datos(await dueno.herramienta('pedido_ver', { id: c.id }))).toMatchObject({ notas: null, lineas: 1, totalCentimos: 11_800 });
  });

  it('la serie sale de la sucursal del pedido y cada serie lleva su propia cuenta', async () => {
    const sur = datos(await dueno.herramienta('sucursal_crear', { codigo: 'SUR', nombre: 'Tienda Sur' }));
    const a = await confirmar(dueno, (await crearBorrador(dueno, cliente, { sucursalId: sur.id })).id);
    const b = await confirmar(dueno, (await crearBorrador(dueno, cliente, { sucursalId: sur.id })).id);
    expect([a.serie, a.numero, b.numero]).toEqual(['SUR', 1, 2]);
    expect(a.codigo).toBe(`PED-SUR-${a.anio}-0001`);
    expect((await eventosDe(appPool, empresaA, 'pedido.confirmado')).find((e) => e.carga.id === a.id)!.carga.sucursalId).toBe(sur.id);
  });

  it('confirmaciones simultáneas de pedidos distintos: números consecutivos, sin repetir ni saltar', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 8; i++) ids.push((await crearBorrador(dueno, cliente)).id);
    const vacio = datos(await dueno.herramienta('pedido_crear', { clienteId: cliente })).id;
    const antes = await contador(empresaA, principal);
    // Entre las ocho va una que falla (sin líneas): no debe dejar hueco.
    const respuestas = await Promise.all([...ids.slice(0, 4), vacio, ...ids.slice(4)].map((id) => dueno.herramienta('pedido_confirmar', { id })));
    const numeros = respuestas.filter((r) => r.cuerpo.ok).map((r) => r.cuerpo.datos.numero as number).sort((x, y) => x - y);
    expect(numeros).toEqual(Array.from({ length: 8 }, (_, i) => antes + 1 + i));
    expect(respuestas.filter((r) => !r.cuerpo.ok).map(codigo)).toEqual(['conflicto']);
    expect(await contador(empresaA, principal)).toBe(antes + 8);
  });

  it('el mismo pedido confirmado dos veces a la vez: una gana, la otra es conflicto, un solo número y un solo evento', async () => {
    const p = await crearBorrador(dueno, cliente);
    const antes = await contador(empresaA, principal);
    const r = await Promise.all([1, 2, 3].map(() => dueno.herramienta('pedido_confirmar', { id: p.id })));
    expect(r.filter((x) => x.cuerpo.ok)).toHaveLength(1);
    expect(r.filter((x) => !x.cuerpo.ok).map(codigo)).toEqual(['conflicto', 'conflicto']);
    expect(await contador(empresaA, principal)).toBe(antes + 1);
    expect((await eventosDe(appPool, empresaA, 'pedido.confirmado')).filter((e) => e.carga.id === p.id)).toHaveLength(1);
  });
});

describe('pedido_cambiar_estado', () => {
  it('toda la tabla de transiciones por HTTP: lo permitido pasa y lo demás es conflicto sin cambiar nada', async () => {
    const destinos = ['confirmado', 'en_proceso', 'listo', 'entregado'] as const;
    for (const de of ESTADOS_DE_PEDIDO) {
      for (const a of destinos) {
        const p = await pedidoEn(de);
        const r = await pasar(dueno, p.id, a);
        const permitido = AVANCES_DE_PEDIDO[de].includes(a);
        expect(r.cuerpo.ok, `${de} → ${a}`).toBe(permitido);
        if (permitido) expect(r.cuerpo.datos.estado).toBe(a);
        else {
          expect(codigo(r), `${de} → ${a}`).toBe('conflicto');
          expect(mensaje(r)).toMatch(/^Un pedido «.+» no puede pasar a «.+»\.$/);
          expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).estado).toBe(de);
        }
      }
    }
    expect(codigo(await pasar(dueno, (await pedidoEn('confirmado')).id, 'cancelado'))).toBe('argumentos_invalidos');
  }, 120_000);

  it('entregar fija la fecha de entrega real, emite pedido.entregado y deja el paso en el historial', async () => {
    const p = await pedidoEn('listo');
    const r = datos(await pasar(dueno, p.id, 'entregado'));
    expect(r.entregadoEn).not.toBeNull();
    expect(r.historial[0]).toMatchObject({ tipo: 'estado', estadoAnterior: 'listo', estadoNuevo: 'entregado', usuarioId: dueno.usuarioId });
    const ev = (await eventosDe(appPool, empresaA, 'pedido.entregado')).filter((e) => e.carga.id === p.id);
    expect(ev.map((e) => e.carga)).toEqual([{ id: p.id, codigo: r.codigo, clienteId: cliente }]);
    expect(codigo(await dueno.herramienta('pedido_anotar', { id: p.id, nota: 'Conforme' }))).toBeUndefined();
  });

  it('lectura no cambia estados; «propios» no toca lo ajeno; otra empresa no lo encuentra', async () => {
    const p = await pedidoEn('confirmado');
    expect(codigo(await pasar(lector, p.id, 'listo'))).toBe('modulo_solo_lectura');
    expect(codigo(await lector.herramienta('pedido_confirmar', { id: p.id }))).toBe('modulo_solo_lectura');
    expect(codigo(await lector.herramienta('pedido_cancelar', { id: p.id, motivo: 'x' }))).toBe('modulo_solo_lectura');
    expect(codigo(await pasar(propio, p.id, 'listo'))).toBe('no_encontrado');
    expect(codigo(await propio.herramienta('pedido_cancelar', { id: p.id, motivo: 'x' }))).toBe('no_encontrado');
    expect(codigo(await pasar(ajeno, p.id, 'listo'))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('pedido_confirmar', { id: p.id }))).toBe('no_encontrado');
    expect(codigo(await ajeno.herramienta('pedido_cancelar', { id: p.id, motivo: 'x' }))).toBe('no_encontrado');
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).estado).toBe('confirmado');
  });
});

describe('pedido_cancelar (crítica)', () => {
  it('pide confirmación y no cambia nada hasta confirmar; conserva el número y emite pedido.cancelado', async () => {
    const p = await pedidoEn('en_proceso');
    const pide = await dueno.herramienta('pedido_cancelar', { id: p.id, motivo: 'El cliente desistió' });
    expect(pide.cuerpo.ok).toBe(false);
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain(p.codigo);
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain('S/ 118.00');
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).estado).toBe('en_proceso');
    expect((await eventosDe(appPool, empresaA, 'pedido.cancelado')).filter((e) => e.carga.id === p.id)).toEqual([]);

    const r = datos(await dueno.herramienta('pedido_cancelar', { id: p.id, motivo: 'El cliente desistió' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token }));
    expect(r).toMatchObject({ estado: 'cancelado', numero: p.numero, codigo: p.codigo, motivoCancelacion: 'El cliente desistió', atrasado: false });
    expect(r.canceladoEn).not.toBeNull();
    expect(r.historial[0]).toMatchObject({ tipo: 'cancelado', estadoAnterior: 'en_proceso', estadoNuevo: 'cancelado' });
    const ev = (await eventosDe(appPool, empresaA, 'pedido.cancelado')).filter((e) => e.carga.id === p.id);
    expect(ev.map((e) => e.carga)).toEqual([{ id: p.id, codigo: p.codigo, clienteId: cliente, teniaNumero: true }]);
    expect(codigo(await dueno.herramienta('pedido_cancelar', { id: p.id, motivo: 'otra vez' }))).toBe('conflicto');
  });

  it('cancelar un borrador no emite; un entregado no se cancela', async () => {
    const b = await pedidoEn('borrador');
    const antes = (await eventosDe(appPool, empresaA)).length;
    expect(datos(await confirmarCritica(dueno, 'pedido_cancelar', { id: b.id, motivo: 'Se anotó por error' }))).toMatchObject({ estado: 'cancelado', numero: null, codigo: 'Borrador' });
    expect((await eventosDe(appPool, empresaA)).length).toBe(antes);
    const e = await pedidoEn('entregado');
    const r = await dueno.herramienta('pedido_cancelar', { id: e.id, motivo: 'tarde' });
    expect(codigo(r)).toBe('conflicto');
    expect(mensaje(r)).toBe('Un pedido «entregado» no puede pasar a «cancelado».');
  });

  it('si el pedido cambia entre el resumen y la confirmación, el token ya no vale', async () => {
    const p = await pedidoEn('confirmado');
    const pide = await dueno.herramienta('pedido_cancelar', { id: p.id, motivo: 'duda' });
    datos(await pasar(dueno, p.id, 'listo'));
    const r = await dueno.herramienta('pedido_cancelar', { id: p.id, motivo: 'duda' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(r.cuerpo.ok).toBe(false);
    expect(datos(await dueno.herramienta('pedido_ver', { id: p.id })).estado).toBe('listo');
  });

  it('un origen cancelado queda libre para otro pedido', async () => {
    const origen = { origenTipo: 'cotizacion', origenId: `cot-${randomUUID()}` };
    const a = await crearBorrador(dueno, cliente, origen);
    datos(await confirmarCritica(dueno, 'pedido_cancelar', { id: a.id, motivo: 'rehacer' }));
    expect((await crearBorrador(dueno, cliente, origen)).id).not.toBe(a.id);
  });
});

describe('ordenes_resumen y fuente de tiempo (empresa B, limpia)', () => {
  let clienteB: string;
  let atrasado: any;
  beforeAll(async () => {
    clienteB = await crearCliente(ajeno, 'Cliente de B');
    const hoy: string = datos(await ajeno.herramienta('pedido_crear', { clienteId: clienteB })).fecha; // borrador vacío de hoy
    const nuevo = (extra: Record<string, unknown>) => crearBorrador(ajeno, clienteB, { fecha: '2020-01-01', ...extra });
    atrasado = await confirmar(ajeno, (await nuevo({ entregaEl: '2020-01-05' })).id);
    await confirmar(ajeno, (await nuevo({ entregaEl: hoy })).id);
    const entregado = await confirmar(ajeno, (await nuevo({ entregaEl: '2020-01-02' })).id);
    datos(await pasar(ajeno, entregado.id, 'entregado'));
    const cancelado = await confirmar(ajeno, (await nuevo({})).id);
    datos(await confirmarCritica(ajeno, 'pedido_cancelar', { id: cancelado.id, motivo: 'prueba' }));
  });

  it('cuenta por estado los pedidos del período y, aparte, lo confirmado, entregado, atrasado y de hoy', async () => {
    const hoy: string = datos(await ajeno.herramienta('pedidos_listar', { estado: 'borrador' })).items[0].fecha;
    const r = datos(await ajeno.herramienta('ordenes_resumen', { desde: '2020-01-01', hasta: hoy }));
    const de = (estado: string) => r.porEstado.find((e: any) => e.estado === estado);
    expect(r.porEstado.map((e: any) => e.estado)).toEqual([...ESTADOS_DE_PEDIDO]);
    expect(de('borrador')).toEqual({ estado: 'borrador', cantidad: 1, totalCentimos: 0 });
    expect(de('confirmado')).toEqual({ estado: 'confirmado', cantidad: 2, totalCentimos: 23_600 });
    expect(de('entregado')).toMatchObject({ cantidad: 1, totalCentimos: 11_800 });
    expect(de('cancelado')).toMatchObject({ cantidad: 1 });
    // Confirmados hoy: tres vivos (el cancelado no cuenta).
    expect(r).toMatchObject({ confirmados: 3, totalConfirmadoCentimos: 35_400, entregados: 1, atrasados: 1, entregasDeHoy: 1 });
    // Un período sin nada: ceros, pero lo atrasado y lo de hoy no dependen del período.
    const viejo = datos(await ajeno.herramienta('ordenes_resumen', { desde: '2019-01-01', hasta: '2019-12-31' }));
    expect(viejo).toMatchObject({ confirmados: 0, totalConfirmadoCentimos: 0, entregados: 0, atrasados: 1, entregasDeHoy: 1 });
    expect(viejo.porEstado.every((e: any) => e.cantidad === 0 && e.totalCentimos === 0)).toBe(true);
    expect(codigo(await ajeno.herramienta('ordenes_resumen', { desde: '2020-02-01', hasta: '2020-01-01' }))).toBe('argumentos_invalidos');
  });

  it('el resumen es de toda la empresa: con alcance «propios» responde sin_permiso; lectura sí lo ve', async () => {
    const r = await propio.herramienta('ordenes_resumen', { desde: '2020-01-01', hasta: '2020-12-31' });
    expect(codigo(r)).toBe('sin_permiso');
    expect(mensaje(r)).toBe('Tu acceso es solo a tus propios registros.');
    expect(datos(await lector.herramienta('ordenes_resumen', { desde: '2020-01-01', hasta: '2020-12-31' })).porEstado).toHaveLength(6);
  });

  it('`atrasado` sale en la ficha y en el listado', async () => {
    expect(datos(await ajeno.herramienta('pedido_ver', { id: atrasado.id })).atrasado).toBe(true);
    const lista = datos(await ajeno.herramienta('pedidos_listar', { entregaHasta: '2020-01-31' })).items;
    expect(lista.map((p: any) => [p.id, p.atrasado])).toEqual([[atrasado.id, true]]);
  });

  it('la fuente ordenes.entrega_vence da los pedidos en curso con entrega, solo de su empresa', async () => {
    const fuente = app.obtener(RegistroDeFuentesDeTiempo).obtener('ordenes.entrega_vence')!;
    expect(fuente.modulo).toBe('ordenes');
    const conEmpresa = conEmpresaDePruebas(appPool);
    const deB = await conEmpresa({ empresaId: empresaB, usuarioId: 'sistema' }, (tx) => fuente.candidatos(tx, new Date()));
    expect(deB).toHaveLength(2); // el atrasado y el de hoy; ni el entregado ni el cancelado ni el borrador
    const c = deB.find((x) => x.entidadId === atrasado.id)!;
    expect(c).toEqual({
      entidadTipo: 'pedido',
      entidadId: atrasado.id,
      fecha: new Date('2020-01-05T12:00:00Z'),
      datos: { id: atrasado.id, codigo: atrasado.codigo, clienteId: clienteB, estado: 'confirmado', totalCentimos: 11_800 },
    });
    const deA = await conEmpresa({ empresaId: empresaA, usuarioId: 'sistema' }, (tx) => fuente.candidatos(tx, new Date()));
    expect(deA.map((x) => x.entidadId)).not.toContain(atrasado.id);
  });
});
