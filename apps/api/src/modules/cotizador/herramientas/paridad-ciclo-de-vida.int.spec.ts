import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { MENSAJE_DE_MOTIVO_REQUERIDO } from '@capaz/shared';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { sumarDias } from '../domain/cotizacion.js';
import { codigoDe, confirmando, crearCliente, datosDe, LINEA_346_38, LISTA_C7 } from './pruebas-de-cotizador.js';

// PARIDAD con Cotizín · ciclo de vida de la cotización por HTTP real: emitir (margen rojo pide motivo), versión emitida inmutable, nueva versión,
// duplicar, estado derivado (`entrega/services/estado-de-cotizacion.ts`), vencimiento por «válida hasta» y numeración sin saltos. Dos empresas.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let ajeno: Sesion;
let A: string;
let B: string;
let cliente: string;
let clienteB: string;

const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const filas = (empresa: string, sql: string, args: unknown[] = []) => comoEmpresa(appPool, empresa, async (c) => (await c.query(sql, args)).rows as any[], { confirmar: true });
const borrador = (s: Sesion = dueno, c: string = cliente, extra: Record<string, unknown> = {}) => datosDe(s, 'cotizacion_crear', { titulo: 'Volantes', clienteId: c, lineas: [LINEA_346_38], ...extra });
const emitir = async (s: Sesion = dueno, c: string = cliente, { motivo, ...extra }: Record<string, unknown> = {}) => {
  const b = await borrador(s, c, extra);
  return (await confirmando(s, 'cotizacion_emitir', { id: b.id, ...(motivo ? { motivoMargenBajo: motivo } : {}) })).respuesta.cuerpo.datos;
};
const ver = (id: string, extra: Record<string, unknown> = {}) => datosDe(dueno, 'cotizacion_ver', { id, ...extra });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, ajeno] = await Promise.all([abrirSesion(app, 'Dueña paridad ciclo'), abrirSesion(app, 'Ajena paridad ciclo')]);
  A = await crearEmpresa(dueno, 'Paridad ciclo A');
  B = await crearEmpresa(ajeno, 'Paridad ciclo B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  [cliente, clienteB] = await Promise.all([crearCliente(dueno, 'Imprenta Sol'), crearCliente(ajeno, 'Cliente de B')]);
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('emitir: margen y motivo (R5 de Cotizín: bajo el mínimo exige motivo)', () => {
  // Precio 346.38. Con costo 294.42 el margen es 15.00 % (ámbar, el borde del mínimo); con 300.00 es 13.39 % (rojo).
  it('margen en rojo: emitir sin motivo es conflicto con el mensaje fijo y no consume número; con motivo se emite y queda guardado', async () => {
    const b = await borrador(dueno, cliente, { costoCentimos: 30_000 });
    const sin = await dueno.herramienta('cotizacion_emitir', { id: b.id });
    expect(codigoDe(sin)).toBe('conflicto');
    expect(sin.cuerpo.error.mensaje).toBe(MENSAJE_DE_MOTIVO_REQUERIDO);
    expect((await ver(b.id))).toMatchObject({ estado: 'borrador', numero: null });
    const e = (await confirmando(dueno, 'cotizacion_emitir', { id: b.id, motivoMargenBajo: 'Cliente grande' })).respuesta.cuerpo.datos;
    expect(e).toMatchObject({ estado: 'emitida', margenPct: '13.390', motivoMargenBajo: 'Cliente grande' });
  });

  it('en el borde del mínimo (15 %, ámbar) y en verde no se pide motivo, y un motivo que llega sin hacer falta no se guarda', async () => {
    expect((await emitir(dueno, cliente, { costoCentimos: 29_442 })).motivoMargenBajo).toBeNull();
    const verde = await emitir(dueno, cliente, { costoCentimos: 22_515, motivo: 'no hacía falta' });
    expect(verde).toMatchObject({ margenPct: '35.000', motivoMargenBajo: null });
  });

  it('sin costo anotado no hay margen que juzgar: se emite directo', async () => {
    expect(await emitir()).toMatchObject({ estado: 'emitida', costoCentimos: null, margenPct: null });
  });

  it('el umbral es el de la empresa: con mínimo 10 % el margen de 13.39 % ya no pide motivo; el de 9 % sí', async () => {
    await datosDe(dueno, 'cotizador_configurar', { umbralMinimoPct: '10', umbralVerdePct: '20' });
    try {
      expect((await emitir(dueno, cliente, { costoCentimos: 30_000 })).estado).toBe('emitida');
      const b = await borrador(dueno, cliente, { costoCentimos: 31_600 });
      expect(codigoDe(await dueno.herramienta('cotizacion_emitir', { id: b.id }))).toBe('conflicto');
    } finally {
      await datosDe(dueno, 'cotizador_configurar', { umbralMinimoPct: '15', umbralVerdePct: '30' });
    }
  });
});

describe('versión emitida inmutable, nueva versión y duplicar', () => {
  it('editar una emitida es conflicto, y no cambia nada (ni el título ni las líneas ni el total)', async () => {
    const e = await emitir();
    for (const cambio of [{ titulo: 'Otro' }, { lineas: [LINEA_346_38, LINEA_346_38] }, { notas: 'x' }, { clienteId: null }]) {
      expect(codigoDe(await dueno.herramienta('cotizacion_editar', { id: e.id, ...cambio })), JSON.stringify(Object.keys(cambio))).toBe('conflicto');
    }
    expect(await ver(e.id)).toMatchObject({ titulo: 'Volantes', totalCentimos: 40_873, estado: 'emitida' });
  });

  it('la base también la protege: un update directo a la versión o a sus líneas se rechaza', async () => {
    const e = await emitir();
    await expect(filas(A, `update cotizador.versiones set subtotal_centimos = 1 where cotizacion_id = $1`, [e.id])).rejects.toThrow();
    await expect(filas(A, `update cotizador.version_lineas set importe_centimos = 1 where version_id in (select id from cotizador.versiones where cotizacion_id = $1)`, [e.id])).rejects.toThrow();
  });

  it('nueva versión: v2 en borrador con el mismo número y «COT-AAAA-NNNN v2»; v1 queda intacta y la v2 se edita y se emite', async () => {
    const e = await emitir();
    const v2 = await datosDe(dueno, 'cotizacion_nueva_version', { id: e.id });
    expect(v2).toMatchObject({ estado: 'borrador', versionActual: 2, numero: e.numero, codigo: `${e.codigo} v2` });
    await datosDe(dueno, 'cotizacion_editar', { id: e.id, lineas: [{ ...LINEA_346_38, precioUnitarioMilesimas: 400_000 }] });
    const v1 = await ver(e.id, { version: 1 });
    expect(v1).toMatchObject({ estado: 'borrador', subtotalCentimos: 34_638 }); // el estado es el de la cotización; las cifras, las de la v1
    const emitida2 = (await confirmando(dueno, 'cotizacion_emitir', { id: e.id })).respuesta.cuerpo.datos;
    expect(emitida2).toMatchObject({ estado: 'emitida', numero: e.numero, subtotalCentimos: 40_000, totalCentimos: 47_200 });
    expect((await ver(e.id, { version: 1 })).subtotalCentimos).toBe(34_638);
  });

  it('duplicar da otro borrador SIN número con las mismas líneas y cliente; no gasta correlativo', async () => {
    const e = await emitir();
    const antes = (await filas(A, `select max(numero) as n from cotizador.cotizaciones`))[0].n;
    const copia = await datosDe(dueno, 'cotizacion_duplicar', { id: e.id });
    expect(copia).toMatchObject({ estado: 'borrador', numero: null, clienteId: cliente, subtotalCentimos: 34_638, versionActual: 1 });
    expect(copia.id).not.toBe(e.id);
    expect((await filas(A, `select max(numero) as n from cotizador.cotizaciones`))[0].n).toBe(antes);
  });
});

describe('estado derivado de los eventos (estado-de-cotizacion.ts)', () => {
  it('emitida → enviada → aceptada, con el historial en orden inverso: aceptada, enviada, emitida, creada', async () => {
    const e = await emitir();
    expect((await datosDe(dueno, 'cotizacion_marcar_enviada', { id: e.id })).estado).toBe('enviada');
    const aceptada = await datosDe(dueno, 'cotizacion_aceptar', { id: e.id });
    expect(aceptada.estado).toBe('aceptada');
    expect(aceptada.historial.map((h: any) => h.tipo)).toEqual(['aceptada', 'enviada', 'emitida', 'creada']);
  });

  it('rechazada guarda el motivo y permite una nueva versión (borrador aunque haya eventos de la anterior); anulada conserva su número y no vuelve atrás', async () => {
    const e = await emitir();
    expect(await datosDe(dueno, 'cotizacion_rechazar', { id: e.id, motivo: 'Muy caro' })).toMatchObject({ estado: 'rechazada', motivoRechazo: 'Muy caro' });
    expect((await datosDe(dueno, 'cotizacion_nueva_version', { id: e.id })).estado).toBe('borrador');
    const emitida = await emitir();
    await confirmando(dueno, 'cotizacion_anular', { id: emitida.id, motivo: 'Error' });
    const anulada = await ver(emitida.id);
    expect(anulada).toMatchObject({ estado: 'anulada', numero: emitida.numero });
    expect(codigoDe(await dueno.herramienta('cotizacion_aceptar', { id: emitida.id }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('cotizacion_nueva_version', { id: emitida.id }))).toBe('conflicto');
  });

  it('un borrador no se acepta, no se envía ni se rechaza; se anula sin consumir número', async () => {
    const b = await borrador();
    for (const h of ['cotizacion_aceptar', 'cotizacion_marcar_enviada', 'cotizacion_rechazar']) expect(codigoDe(await dueno.herramienta(h, { id: b.id })), h).toBe('conflicto');
    await confirmando(dueno, 'cotizacion_anular', { id: b.id, motivo: 'No va' });
    expect(await ver(b.id)).toMatchObject({ estado: 'anulada', numero: null });
  });
});

describe('vencimiento por «válida hasta»', () => {
  it('validaHasta es la fecha de emisión (día de Lima) más los días de validez de la empresa, y queda en la foto', async () => {
    await datosDe(dueno, 'cotizador_configurar', { condiciones: { validezDias: 15, plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '' } });
    const e = await emitir();
    expect(e.validaHasta).toBe(sumarDias(hoyLima(), 15));
    await datosDe(dueno, 'cotizador_configurar', { condiciones: { validezDias: 30, plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '' } });
    expect((await emitir()).validaHasta).toBe(sumarDias(hoyLima(), 30));
    expect((await ver(e.id)).validaHasta).toBe(sumarDias(hoyLima(), 15));
  });

  it('pasada la fecha, la emitida y la enviada cuentan como vencidas en el resumen; la aceptada no; el estado de la cotización no cambia solo', async () => {
    const hoy = hoyLima();
    const resumen = async () => (await datosDe(dueno, 'cotizador_resumen', { desde: hoy, hasta: hoy })).vencidas as number;
    const antes = await resumen();
    const [emitida, enviada, aceptada] = [await emitir(), await emitir(), await emitir()];
    await datosDe(dueno, 'cotizacion_marcar_enviada', { id: enviada.id });
    await datosDe(dueno, 'cotizacion_aceptar', { id: aceptada.id });
    await filas(A, `update cotizador.cotizaciones set valida_hasta = date '2000-01-01' where id = any($1::uuid[])`, [[emitida.id, enviada.id, aceptada.id]]);
    expect(await resumen()).toBe(antes + 2);
    expect((await ver(emitida.id)).estado).toBe('emitida');
    expect((await ver(aceptada.id)).estado).toBe('aceptada');
  });
});

describe('numeración correlativa por empresa y año, sin saltos', () => {
  it('cada empresa cuenta aparte desde COT-AAAA-0001, los borradores y anulados sin emitir no consumen número', async () => {
    const [a, b] = [await emitir(dueno, cliente), await emitir(ajeno, clienteB)];
    expect(b.codigo).toMatch(/^COT-\d{4}-0001$/);
    expect(a.anio).toBe(b.anio);
    await borrador(dueno, cliente);
    const sig = await emitir(dueno, cliente);
    expect(sig.numero).toBe(a.numero + 1);
    expect((await emitir(ajeno, clienteB)).numero).toBe(2);
  });

  it('10 emisiones en paralelo dan números consecutivos sin huecos ni repetidos', async () => {
    const lote = await Promise.all(Array.from({ length: 10 }, () => borrador(ajeno, clienteB)));
    await Promise.all(lote.map((b) => confirmando(ajeno, 'cotizacion_emitir', { id: b.id })));
    const numeros = (await filas(B, `select numero from cotizador.cotizaciones where numero is not null order by numero`)).map((f) => Number(f.numero));
    expect(numeros).toEqual(Array.from({ length: numeros.length }, (_, i) => i + 1));
    expect(new Set(numeros).size).toBe(numeros.length);
  });

  it('el código lleva el año de la emisión y el número con cuatro cifras; una lista de precios no cambia el correlativo', async () => {
    const lista = await datosDe(dueno, 'lista_precio_crear', LISTA_C7);
    const c = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Con lista', clienteId: cliente, lineas: [{ tipo: 'lista', listaId: lista.id, cantidadMilesimas: 1_000_000 }] });
    const e = (await confirmando(dueno, 'cotizacion_emitir', { id: c.id })).respuesta.cuerpo.datos;
    expect(e.codigo).toBe(`COT-${hoyLima().slice(0, 4)}-${String(e.numero).padStart(4, '0')}`);
    expect(e).toMatchObject({ subtotalCentimos: 58_000, igvCentimos: 10_440, totalCentimos: 68_440 });
  });
});
