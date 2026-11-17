import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { MENSAJE_DE_MOTIVO_REQUERIDO } from '@capaz/shared';
import { cotizarDesdeLista } from '../domain/precios.js';
import { codigoDe, confirmando, crearCliente, datosDe, LISTA_C7 } from './pruebas-de-cotizador.js';

// Ajuste de precio por línea, tabla de precio_consultar y precios al día (duplicar, nueva versión, emitir). Dos empresas.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let ajeno: Sesion;
let A: string;
let cliente: string;
let lista: any;

const crearCon = (extra: Record<string, unknown>) => dueno.herramienta('cotizacion_crear', { titulo: 'Con ajuste', clienteId: cliente, lineas: [], ...extra });
const deLista = (ajuste?: unknown, cantidadMilesimas = 1_000_000) => ({ tipo: 'lista', listaId: lista.id, cantidadMilesimas, ...(ajuste ? { ajuste } : {}) });
const detalleDe = (id: string) =>
  comoEmpresa(appPool, A, async (c) => (await c.query(`select l.detalle from cotizador.version_lineas l join cotizador.versiones v on v.id = l.version_id where v.cotizacion_id = $1 order by v.version, l.posicion`, [id])).rows.map((r: any) => r.detalle));

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, ajeno] = await Promise.all([abrirSesion(app, 'Dueña precios'), abrirSesion(app, 'Ajena precios')]);
  A = await crearEmpresa(dueno, 'Precios A');
  const B = await crearEmpresa(ajeno, 'Precios B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  lista = await datosDe(dueno, 'lista_precio_crear', LISTA_C7);
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('ajuste de precio por línea', () => {
  it('precio, monto sumado y monto restado: el DTO devuelve ajuste y precio de lista; el IGV sale del importe ajustado', async () => {
    const c = await datosDe(dueno, 'cotizacion_crear', {
      titulo: 'Tres ajustes', clienteId: cliente,
      lineas: [deLista({ tipo: 'precio', importeCentimos: 50_000 }), deLista({ tipo: 'monto', importeCentimos: 1_000 }), deLista({ tipo: 'monto', importeCentimos: -3_000 }), deLista()],
    });
    expect(c.lineas.map((l: any) => [l.precioListaCentimos, l.importeCentimos, l.ajuste])).toEqual([
      [58_000, 50_000, { tipo: 'precio', importeCentimos: 50_000 }],
      [58_000, 59_000, { tipo: 'monto', importeCentimos: 1_000 }],
      [58_000, 55_000, { tipo: 'monto', importeCentimos: -3_000 }],
      [58_000, 58_000, null],
    ]);
    expect(c.lineas[0]).toMatchObject({ igvCentimos: 9_000, totalCentimos: 59_000 });
    expect(c.subtotalCentimos).toBe(50_000 + 59_000 + 55_000 + 58_000);
  });

  it('un final que no es mayor que cero se rechaza; ajuste inválido, también', async () => {
    expect(codigoDe(await crearCon({ lineas: [deLista({ tipo: 'monto', importeCentimos: -58_000 })] }))).toBe('argumentos_invalidos');
    expect(codigoDe(await crearCon({ lineas: [deLista({ tipo: 'precio', importeCentimos: 0 })] }))).toBe('argumentos_invalidos');
    expect(codigoDe(await crearCon({ lineas: [deLista({ tipo: 'otro' })] }))).toBe('argumentos_invalidos');
  });

  it('al cambiar el cliente (y su ajuste) el ajuste de la línea se conserva y se recalcula el resto; la edición con líneas reenviadas también', async () => {
    const otro = await crearCliente(dueno, 'Con descuento');
    await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: otro, porcentaje: '-10' });
    const c = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Recalcular', clienteId: cliente, lineas: [deLista({ tipo: 'monto', importeCentimos: -2_000 }), deLista()] });
    const e = await datosDe(dueno, 'cotizacion_editar', { id: c.id, clienteId: otro });
    expect(e.lineas.map((l: any) => [l.precioListaCentimos, l.importeCentimos, l.ajuste])).toEqual([
      [52_200, 50_200, { tipo: 'monto', importeCentimos: -2_000 }],
      [52_200, 52_200, null],
    ]);
    const quitado = await datosDe(dueno, 'cotizacion_editar', { id: c.id, lineas: [deLista(), deLista()] });
    expect(quitado.lineas.map((l: any) => l.ajuste)).toEqual([null, null]);
  });
});

describe('precio_consultar: tabla, estimación y escalón', () => {
  const consultar = (args: Record<string, unknown>) => datosDe(dueno, 'precio_consultar', { listaId: lista.id, ...args });

  it('la tabla trae las 8 cantidades con los mismos valores que el motor de la cotización rápida', async () => {
    const r = await consultar({ cantidadMilesimas: 2_500_000 });
    expect(r.tabla.map((f: any) => f.cantidadMilesimas / 1000)).toEqual([100, 200, 300, 500, 1000, 2000, 3000, 5000]);
    const l = { p100Centimos: 19_000, p1000Centimos: 58_000, p5000Centimos: 120_000, modoIntermedio: 'curva' as const, precioMinimoCentimos: null };
    for (const f of r.tabla) {
      const esperado = cotizarDesdeLista(l, { cantidadMilesimas: f.cantidadMilesimas, ajusteClientePct: null, redondeo: 'ninguno', ajuste: { tipo: 'ninguno' }, igvPorcentaje: 18 });
      if (!esperado.ok) throw new Error('el motor rechazó una cantidad de la tabla');
      expect(f.importeCentimos).toBe(esperado.valor.importeCentimos);
      expect(f.totalCentimos).toBe(f.importeCentimos + f.igvCentimos);
    }
    expect(r.tabla[0]).toMatchObject({ importeCentimos: 19_000, igvCentimos: 3_420, totalCentimos: 22_420 });
  });

  it('la tabla lleva el ajuste del cliente y no el de la consulta; estimación solo fuera de las tres referencias; escalón solo en ese modo', async () => {
    const otro = await crearCliente(dueno, 'Cliente tabla');
    await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: otro, porcentaje: '10' });
    const r = await consultar({ cantidadMilesimas: 1_000_000, clienteId: otro, ajuste: { tipo: 'precio', importeCentimos: 1_000 } });
    expect(r).toMatchObject({ estimacion: false, escalon: null, importeCentimos: 1_000 });
    expect(r.tabla.find((f: any) => f.cantidadMilesimas === 1_000_000)).toMatchObject({ importeCentimos: 63_800 });
    expect(r.tabla.find((f: any) => f.cantidadMilesimas === 100_000)).toMatchObject({ importeCentimos: 20_900 });
    expect((await consultar({ cantidadMilesimas: 2_500_000 })).estimacion).toBe(true);
    const esc = await datosDe(dueno, 'lista_precio_crear', { ...LISTA_C7, nombre: 'Tarjetas en escalón', modoIntermedio: 'escalon' });
    const re = await datosDe(dueno, 'precio_consultar', { listaId: esc.id, cantidadMilesimas: 2_500_000 });
    expect(re).toMatchObject({ estimacion: true, escalon: 1_000_000 });
    expect((await datosDe(dueno, 'precio_consultar', { listaId: esc.id, cantidadMilesimas: 400_000 })).escalon).toBe(100_000);
  });
});

describe('precios al día', () => {
  const subirLista = async (p1000: number) => {
    const r = await confirmando(dueno, 'lista_precio_editar', { id: lista.id, p1000Centimos: p1000, confirmarUnitarioNoBaja: true });
    expect(r.respuesta.cuerpo.ok).toBe(true);
  };

  it('duplicar y nueva versión recalculan con los precios de hoy y avisan; emitir con precio cambiado rechaza hasta aceptar', async () => {
    const c = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Al día', clienteId: cliente, lineas: [deLista({ tipo: 'monto', importeCentimos: 500 })] });
    await subirLista(60_000);
    const copia = await datosDe(dueno, 'cotizacion_duplicar', { id: c.id });
    expect(copia.avisos).toEqual([`El precio de lista de «${LISTA_C7.nombre}» cambió: antes S/ 580.00, ahora S/ 600.00`]);
    expect(copia.lineas[0]).toMatchObject({ precioListaCentimos: 60_000, importeCentimos: 60_500, ajuste: { tipo: 'monto', importeCentimos: 500 } });
    expect(copia.subtotalCentimos).toBe(60_500);

    const pide = await dueno.herramienta('cotizacion_emitir', { id: c.id });
    expect(codigoDe(pide)).toBe('conflicto');
    expect(pide.cuerpo.error.mensaje).toMatch(/cambió: antes S\/ 580\.00, ahora S\/ 600\.00/);
    const emitida = await confirmando(dueno, 'cotizacion_emitir', { id: c.id, aceptarPreciosDeHoy: true });
    expect(emitida.respuesta.cuerpo.ok).toBe(true);
    expect(emitida.resumen).toMatch(/los precios se actualizaron/i);
    const e = emitida.respuesta.cuerpo.datos;
    expect(e).toMatchObject({ estado: 'emitida', subtotalCentimos: 60_500, avisos: [] });
    expect((await detalleDe(c.id))[0]).toMatchObject({ precioListaCentimos: 60_000, p100: 19_000, p1000: 60_000, p5000: 120_000, modoIntermedio: 'curva', precioMinimo: null });

    await subirLista(61_000);
    const nueva = await datosDe(dueno, 'cotizacion_nueva_version', { id: c.id });
    expect(nueva.avisos).toHaveLength(1);
    expect(nueva.avisos[0]).toMatch(/antes S\/ 600\.00, ahora S\/ 610\.00/);
    expect(nueva).toMatchObject({ versionActual: 2, subtotalCentimos: 61_500 });
  });

  it('sin cambios de precio no hay avisos y emitir sigue siendo directo; la foto de la lista queda guardada', async () => {
    const c = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Sin cambios', clienteId: cliente, lineas: [deLista()] });
    expect((await datosDe(dueno, 'cotizacion_duplicar', { id: c.id })).avisos).toEqual([]);
    const emitida = await confirmando(dueno, 'cotizacion_emitir', { id: c.id });
    expect(emitida.respuesta.cuerpo.ok).toBe(true);
    expect(emitida.resumen).not.toMatch(/actualizaron/);
    expect((await detalleDe(c.id))[0]).toMatchObject({ p1000: 61_000, modoIntermedio: 'curva', precioMinimo: null });
  });

  it('el margen bajo pide el motivo con el mensaje fijo (conflicto) y el historial lleva canal y detalle', async () => {
    const c = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Margen bajo', clienteId: cliente, lineas: [deLista()], costoCentimos: 61_000 });
    const r = await dueno.herramienta('cotizacion_emitir', { id: c.id });
    expect(codigoDe(r)).toBe('conflicto');
    expect(r.cuerpo.error.mensaje).toBe(MENSAJE_DE_MOTIVO_REQUERIDO);
    expect((await confirmando(dueno, 'cotizacion_emitir', { id: c.id, motivoMargenBajo: 'Cliente grande' })).respuesta.cuerpo.ok).toBe(true);
    const aceptada = await datosDe(dueno, 'cotizacion_aceptar', { id: c.id });
    expect(aceptada.historial[0]).toMatchObject({ tipo: 'aceptada', canal: 'ui', detalle: 'Eligió la línea 1' });
    const opciones = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Opciones', clienteId: cliente, conOpciones: true, lineas: [deLista(), deLista(undefined, 100_000)] });
    await confirmando(dueno, 'cotizacion_emitir', { id: opciones.id });
    const elegida = await datosDe(dueno, 'cotizacion_aceptar', { id: opciones.id, posiciones: [1] });
    expect(elegida.historial[0]).toMatchObject({ tipo: 'aceptada', detalle: 'Eligió la línea 2' });
  });
});
