import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, crearCliente, datosDe, eventosDe, LINEA_346_38, manual } from './pruebas-de-cotizador.js';
import { sumarDias } from '../domain/cotizacion.js';

// Cotizaciones (s2) por HTTP real, parte 2: estados, numeración, versiones, eventos de negocio e inmutabilidad en la base.
// Una sola empresa de pruebas por bloque; los eventos se leen de `core.eventos_salida`.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let A: string;
let cliente: string;

const hoyLima = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
const delCotizador = async (tipo?: string) => (await eventosDe(appPool, A)).filter((e) => (tipo ? e.tipo === tipo : e.tipo.startsWith('cotizacion.')));
const filas = (sql: string, args: unknown[] = []) => comoEmpresa(appPool, A, async (c) => (await c.query(sql, args)).rows as any[]);
const borrador = (extra: Record<string, unknown> = {}) => datosDe(dueno, 'cotizacion_crear', { titulo: 'Volantes', clienteId: cliente, lineas: [LINEA_346_38], ...extra });
const emitida = async (extra: Record<string, unknown> = {}) => {
  const b = await borrador(extra);
  return (await confirmando(dueno, 'cotizacion_emitir', { id: b.id })).respuesta.cuerpo.datos;
};

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  dueno = await abrirSesion(app, 'Dueña');
  A = await crearEmpresa(dueno, 'Cotizaciones de estados');
  await activarModulo(A, 'cotizador');
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  await datosDe(dueno, 'cotizador_configurar', { condiciones: { validezDias: 15, plazoEntrega: '5 días hábiles', formaPago: '50 % de adelanto', tolerancia: '', noIncluye: '' } });
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

const PASOS: Record<string, { herramienta: string; args: (id: string) => Record<string, unknown>; desde: string[] }> = {
  emitir: { herramienta: 'cotizacion_emitir', args: (id) => ({ id }), desde: ['borrador'] },
  enviar: { herramienta: 'cotizacion_marcar_enviada', args: (id) => ({ id }), desde: ['emitida'] },
  aceptar: { herramienta: 'cotizacion_aceptar', args: (id) => ({ id }), desde: ['emitida', 'enviada'] },
  rechazar: { herramienta: 'cotizacion_rechazar', args: (id) => ({ id }), desde: ['emitida', 'enviada'] },
  nueva_version: { herramienta: 'cotizacion_nueva_version', args: (id) => ({ id }), desde: ['emitida', 'enviada', 'rechazada'] },
  anular: { herramienta: 'cotizacion_anular', args: (id) => ({ id, motivo: 'prueba' }), desde: ['borrador', 'emitida', 'enviada', 'aceptada', 'rechazada'] },
};
const ESTADOS = ['borrador', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada'];

/** Una cotización nueva llevada a ese estado por las herramientas. */
async function enEstado(estado: string): Promise<string> {
  const c = estado === 'borrador' ? await borrador() : await emitida();
  const id = c.id as string;
  const paso = async (n: string, a: Record<string, unknown> = {}) => {
    const r = n === 'cotizacion_anular' ? await confirmando(dueno, n, { id, motivo: 'x' }) : { respuesta: await dueno.herramienta(n, { id, ...a }) };
    expect(r.respuesta.cuerpo.ok, `${n} → ${JSON.stringify(r.respuesta.cuerpo)}`).toBe(true);
  };
  if (estado === 'enviada') await paso('cotizacion_marcar_enviada');
  if (estado === 'aceptada') await paso('cotizacion_aceptar');
  if (estado === 'rechazada') await paso('cotizacion_rechazar');
  if (estado === 'anulada') await paso('cotizacion_anular');
  return id;
}

describe('tabla de estados por HTTP', () => {
  it.each(Object.keys(PASOS))('«%s» solo vale desde los estados de la ficha; desde otro, conflicto', async (paso) => {
    const { herramienta, args, desde } = PASOS[paso]!;
    for (const estado of ESTADOS) {
      const id = await enEstado(estado);
      const r = herramienta.endsWith('emitir') || herramienta.endsWith('anular') ? (await confirmando(dueno, herramienta, args(id))).respuesta : await dueno.herramienta(herramienta, args(id));
      if (desde.includes(estado)) expect(r.cuerpo.ok, `${paso} desde ${estado}: ${JSON.stringify(r.cuerpo)}`).toBe(true);
      else expect(codigoDe(r), `${paso} desde ${estado}`).toBe('conflicto');
    }
  });

  it('el estado resultante de cada paso es el de la ficha', async () => {
    expect((await datosDe(dueno, 'cotizacion_ver', { id: await enEstado('aceptada') })).estado).toBe('aceptada');
    const e = await emitida();
    expect((await datosDe(dueno, 'cotizacion_nueva_version', { id: e.id }))).toMatchObject({ estado: 'borrador', versionActual: 2, codigo: `${e.codigo} v2` });
  });
});

describe('emitir', () => {
  it('exige cliente: sin él, conflicto y sin pedir confirmación; con cliente y una línea, emite', async () => {
    const sin = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Sin cliente', lineas: [LINEA_346_38] });
    const r = await dueno.herramienta('cotizacion_emitir', { id: sin.id });
    expect(codigoDe(r)).toBe('conflicto');
    expect(r.cuerpo.requiereConfirmacion).toBeUndefined();
    expect(r.cuerpo.error.mensaje).toMatch(/cliente/);
  });

  it('da el número, guarda la foto (cliente, condiciones, IGV) y la validez, y emite cotizacion.emitida una vez', async () => {
    const antes = (await delCotizador('cotizacion.emitida')).length;
    const e = await emitida();
    expect(e).toMatchObject({ estado: 'emitida', numero: expect.any(Number), anio: Number(hoyLima().slice(0, 4)), version: 1, emitidaEn: expect.any(String), validaHasta: sumarDias(hoyLima(), 15) });
    expect(e.codigo).toBe(`COT-${e.anio}-${String(e.numero).padStart(4, '0')}`);
    expect(e.condiciones).toEqual({ validezDias: 15, plazoEntrega: '5 días hábiles', formaPago: '50 % de adelanto', tolerancia: '', noIncluye: '' });
    expect(e.historial.map((h: any) => h.tipo)).toEqual(['emitida', 'creada']);
    expect(await filas(`select cliente_nombre from cotizador.cotizaciones where id = $1`, [e.id])).toEqual([{ cliente_nombre: 'Imprenta Sol' }]);
    const eventos = (await delCotizador('cotizacion.emitida')).slice(antes);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.carga).toEqual({ id: e.id, codigo: e.codigo, version: 1, clienteId: cliente, totalCentimos: 40_873 });
  });

  it('la foto de la versión no cambia aunque cambie la configuración', async () => {
    const e = await emitida();
    await datosDe(dueno, 'cotizador_configurar', { condiciones: { validezDias: 30, plazoEntrega: 'Otro', formaPago: '', tolerancia: '', noIncluye: '' } });
    expect((await datosDe(dueno, 'cotizacion_ver', { id: e.id })).condiciones).toMatchObject({ validezDias: 15, plazoEntrega: '5 días hábiles' });
    await datosDe(dueno, 'cotizador_configurar', { condiciones: { validezDias: 15, plazoEntrega: '5 días hábiles', formaPago: '50 % de adelanto', tolerancia: '', noIncluye: '' } });
  });

  it('con margen bajo el mínimo hace falta el motivo; con él se emite y queda guardado para quien ve costos', async () => {
    const b = await borrador({ costoCentimos: 30_000 }); // margen 13.39 % < 15 %
    const sin = await dueno.herramienta('cotizacion_emitir', { id: b.id });
    expect(codigoDe(sin)).toBe('argumentos_invalidos');
    const r = await confirmando(dueno, 'cotizacion_emitir', { id: b.id, motivoMargenBajo: 'Cliente grande, pedido recurrente' });
    expect(r.respuesta.cuerpo.datos).toMatchObject({ estado: 'emitida', costoCentimos: 30_000, margenPct: '13.390', motivoMargenBajo: 'Cliente grande, pedido recurrente' });
    const sano = await borrador({ costoCentimos: 22_515 }); // 35 %: el motivo no se guarda aunque llegue
    const ok = await confirmando(dueno, 'cotizacion_emitir', { id: sano.id, motivoMargenBajo: 'no hacía falta' });
    expect(ok.respuesta.cuerpo.datos.motivoMargenBajo).toBeNull();
  });

  it('dos emisiones simultáneas dan números consecutivos y distintos', async () => {
    const [x, y] = await Promise.all([borrador(), borrador()]);
    const [rx, ry] = await Promise.all([confirmando(dueno, 'cotizacion_emitir', { id: x.id }), confirmando(dueno, 'cotizacion_emitir', { id: y.id })]);
    const numeros = [rx, ry].map((r) => r.respuesta.cuerpo.datos.numero as number).sort((a, b) => a - b);
    expect(numeros[1]).toBe(numeros[0]! + 1);
    const todos = (await filas(`select numero from cotizador.cotizaciones where numero is not null order by numero`)).map((f) => f.numero);
    expect(todos).toEqual(Array.from({ length: todos.length }, (_, i) => i + 1));
  });
});

describe('una versión emitida no se edita: ni por la herramienta ni en la base', () => {
  it('editar una emitida es conflicto; los cambios directos a la versión y a sus líneas los rechaza la base', async () => {
    const e = await emitida();
    expect(codigoDe(await dueno.herramienta('cotizacion_editar', { id: e.id, titulo: 'x' }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('cotizacion_editar', { id: e.id, lineas: [manual('x', 1)] }))).toBe('conflicto');
    const ver = (await filas(`select id from cotizador.versiones where cotizacion_id = $1`, [e.id]))[0]!.id;
    const intento = (sql: string, args: unknown[]) => comoEmpresa(appPool, A, (c) => c.query(sql, args));
    await expect(intento(`update cotizador.versiones set observaciones = 'x' where id = $1`, [ver])).rejects.toThrow(/emitida/);
    await expect(intento(`delete from cotizador.versiones where id = $1`, [ver])).rejects.toThrow(/emitida/);
    await expect(intento(`update cotizador.version_lineas set descripcion = 'x' where version_id = $1`, [ver])).rejects.toThrow(/emitida/);
    await expect(intento(`delete from cotizador.version_lineas where version_id = $1`, [ver])).rejects.toThrow(/emitida/);
    await expect(
      intento(`insert into cotizador.version_lineas (tenant_id, version_id, posicion, descripcion, cantidad_milesimas, precio_unitario_milesimas, importe_centimos, igv_centimos, total_centimos) values ($1, $2, 9, 'x', 1, 1, 1, 0, 1)`, [A, ver]),
    ).rejects.toThrow(/emitida/);
  });

  it('nueva versión: v2 en borrador copia la actual, se edita, conserva el número, y la v1 queda intacta', async () => {
    const e = await emitida();
    const v2 = await datosDe(dueno, 'cotizacion_nueva_version', { id: e.id });
    expect(v2).toMatchObject({ estado: 'borrador', numero: e.numero, versionActual: 2, version: 2, codigo: `${e.codigo} v2`, validaHasta: null, emitidaEn: null, subtotalCentimos: 34_638 });
    expect(v2.versiones.map((v: any) => [v.version, v.emitidaEn === null])).toEqual([[2, true], [1, false]]);
    expect(v2.historial.map((h: any) => h.tipo)).toEqual(['nueva_version', 'emitida', 'creada']);
    const editada = await datosDe(dueno, 'cotizacion_editar', { id: e.id, lineas: [manual('Cambiada', 500)] });
    expect(editada.subtotalCentimos).toBe(50_000);
    const v1 = await datosDe(dueno, 'cotizacion_ver', { id: e.id, version: 1 });
    expect(v1).toMatchObject({ version: 1, subtotalCentimos: 34_638, codigo: e.codigo });
    expect(v1.lineas).toHaveLength(1);
    expect(v1.lineas[0].descripcion).toBe(LINEA_346_38.descripcion);
    const otraVez = await confirmando(dueno, 'cotizacion_emitir', { id: e.id });
    expect(otraVez.respuesta.cuerpo.datos).toMatchObject({ estado: 'emitida', numero: e.numero, codigo: `${e.codigo} v2`, totalCentimos: 59_000 });
    const emitidas = (await delCotizador('cotizacion.emitida')).filter((x: any) => x.carga.id === e.id);
    expect(emitidas.map((x: any) => [x.carga.version, x.carga.codigo])).toEqual([[1, e.codigo], [2, `${e.codigo} v2`]]);
  });
});

describe('aceptar', () => {
  it('aceptar dos veces: conflicto y un solo evento; el de 346.38 lleva una línea de 408730 milésimas con IGV', async () => {
    const e = await emitida();
    const ok = await datosDe(dueno, 'cotizacion_aceptar', { id: e.id });
    expect(ok).toMatchObject({ estado: 'aceptada', lineasAceptadas: [0], totalAceptadoCentimos: 40_873, aceptadaEn: expect.any(String) });
    expect(codigoDe(await dueno.herramienta('cotizacion_aceptar', { id: e.id }))).toBe('conflicto');
    const eventos = (await delCotizador('cotizacion.aceptada')).filter((x: any) => x.carga.id === e.id);
    expect(eventos).toHaveLength(1);
    expect(eventos[0]!.carga).toEqual({
      id: e.id, codigo: e.codigo, version: 1, clienteId: cliente, igvPorcentaje: 18, subtotalCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873,
      lineas: [{ productoId: null, descripcion: '1 unidad · Volantes A5 4/4 couché 150 g', unidad: 'lote', cantidadMilesimas: 1000, precioUnitarioMilesimas: 408_730, afectoIgv: true }],
    });
  });

  it('dos aceptaciones a la vez: una gana, la otra es conflicto, y hay un solo evento', async () => {
    const e = await emitida();
    const [x, y] = await Promise.all([dueno.herramienta('cotizacion_aceptar', { id: e.id }), dueno.herramienta('cotizacion_aceptar', { id: e.id })]);
    expect([x, y].filter((r) => r.cuerpo.ok)).toHaveLength(1);
    expect([x, y].map(codigoDe).filter(Boolean)).toEqual(['conflicto']);
    expect((await delCotizador('cotizacion.aceptada')).filter((z: any) => z.carga.id === e.id)).toHaveLength(1);
  });

  it('por opciones: hay que indicar cuáles; el evento lleva solo las aceptadas, ya con IGV, y la suma es la de ellas', async () => {
    const e = await emitida({ conOpciones: true, lineas: [manual('Opción 100', 100, 1), manual('Opción 1000', 346.38), manual('Opción 5000', 800)] });
    expect(e).toMatchObject({ conOpciones: true, subtotalCentimos: 124_638 });
    expect(codigoDe(await dueno.herramienta('cotizacion_aceptar', { id: e.id }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cotizacion_aceptar', { id: e.id, posiciones: [7] }))).toBe('conflicto');
    expect(codigoDe(await dueno.herramienta('cotizacion_aceptar', { id: e.id, posiciones: [] }))).toBe('argumentos_invalidos');
    const ok = await datosDe(dueno, 'cotizacion_aceptar', { id: e.id, posiciones: [1, 1] });
    expect(ok).toMatchObject({ estado: 'aceptada', lineasAceptadas: [1], totalAceptadoCentimos: 40_873 });
    const ev = (await delCotizador('cotizacion.aceptada')).find((z: any) => z.carga.id === e.id)!.carga as any;
    expect(ev).toMatchObject({ subtotalCentimos: 34_638, igvCentimos: 6_235, totalCentimos: 40_873 });
    expect(ev.lineas).toHaveLength(1);
    expect(ev.lineas[0].precioUnitarioMilesimas).toBe(408_730);
  });

  it('sin opciones se pueden aceptar solo algunas líneas', async () => {
    const e = await emitida({ lineas: [manual('Uno', 100), manual('Dos', 200), manual('Tres', 300)] });
    const ok = await datosDe(dueno, 'cotizacion_aceptar', { id: e.id, posiciones: [0, 2] });
    expect(ok).toMatchObject({ lineasAceptadas: [0, 2], totalAceptadoCentimos: 47_200 });
  });
});

describe('rechazar, enviar y anular', () => {
  it('marcar enviada deja su fila en el historial y no emite evento de negocio', async () => {
    const e = await emitida();
    const antes = (await delCotizador()).length;
    expect((await datosDe(dueno, 'cotizacion_marcar_enviada', { id: e.id })).historial.map((h: any) => h.tipo)).toEqual(['enviada', 'emitida', 'creada']);
    expect(await delCotizador()).toHaveLength(antes);
  });

  it('rechazar guarda el motivo en la cotización, y el evento va sin él (R13); luego se puede hacer una nueva versión', async () => {
    const e = await emitida();
    const r = await datosDe(dueno, 'cotizacion_rechazar', { id: e.id, motivo: 'Encontró un precio menor' });
    expect(r).toMatchObject({ estado: 'rechazada', motivoRechazo: 'Encontró un precio menor' });
    const ev = (await delCotizador('cotizacion.rechazada')).filter((z: any) => z.carga.id === e.id);
    expect(ev.map((z) => z.carga)).toEqual([{ id: e.id, codigo: e.codigo, version: 1, clienteId: cliente }]);
    expect((await datosDe(dueno, 'cotizacion_nueva_version', { id: e.id })).motivoRechazo).toBeNull();
  });

  it('anular una aceptada emite cotizacion.anulada con el estado anterior; anular un borrador sin número no emite', async () => {
    const e = await enEstado('aceptada');
    const r = await confirmando(dueno, 'cotizacion_anular', { id: e, motivo: 'Se emitió con el cliente equivocado' });
    expect(r.resumen).toMatch(/^Se anulará la cotización COT-\d{4}-\d{4} \(aceptada\) por S\/ 408\.73\. No se puede deshacer\.$/);
    expect(r.respuesta.cuerpo.datos).toMatchObject({ estado: 'anulada', motivoAnulacion: 'Se emitió con el cliente equivocado', anuladoEn: expect.any(String) });
    const ev = (await delCotizador('cotizacion.anulada')).filter((z: any) => z.carga.id === e);
    expect(ev.map((z) => (z.carga as any).estadoAnterior)).toEqual(['aceptada']);
    const b = await borrador();
    const sin = await confirmando(dueno, 'cotizacion_anular', { id: b.id, motivo: 'error' });
    expect(sin.respuesta.cuerpo.datos.estado).toBe('anulada');
    expect((await delCotizador('cotizacion.anulada')).filter((z: any) => z.carga.id === b.id)).toEqual([]);
    expect(codigoDe(await dueno.herramienta('cotizacion_anular', { id: b.id, motivo: '' }))).toBe('argumentos_invalidos');
  });

  it('una anulada no se edita ni cambia de estado; conserva su número', async () => {
    const e = await emitida();
    await confirmando(dueno, 'cotizacion_anular', { id: e.id, motivo: 'x' });
    expect(codigoDe(await dueno.herramienta('cotizacion_editar', { id: e.id, titulo: 'y' }))).toBe('conflicto');
    expect((await datosDe(dueno, 'cotizacion_ver', { id: e.id })).numero).toBe(e.numero);
  });
});

describe('cotizador_resumen', () => {
  it('cuenta por estado lo creado en el período, lo aceptado y lo vencido', async () => {
    const hoy = hoyLima();
    const r = await datosDe(dueno, 'cotizador_resumen', { desde: hoy, hasta: hoy });
    const cantidad = (estado: string) => r.porEstado.find((x: any) => x.estado === estado)?.cantidad ?? 0;
    expect(cantidad('borrador')).toBeGreaterThan(0);
    expect(cantidad('aceptada')).toBeGreaterThan(0);
    expect(r.aceptadas.cantidad).toBe(cantidad('aceptada'));
    expect(r.aceptadas.totalCentimos).toBeGreaterThan(0);
    expect(r.vencidas).toBe(0);
    await comoEmpresa(appPool, A, (c) => c.query(`update cotizador.cotizaciones set valida_hasta = date '2000-01-01' where estado = 'emitida' and id = (select id from cotizador.cotizaciones where estado = 'emitida' limit 1)`), { confirmar: true });
    expect((await datosDe(dueno, 'cotizador_resumen', { desde: hoy, hasta: hoy })).vencidas).toBe(1);
    expect((await datosDe(dueno, 'cotizador_resumen', { desde: '2000-01-01', hasta: '2000-01-02' })).porEstado).toEqual([]);
    expect(codigoDe(await dueno.herramienta('cotizador_resumen', { desde: '2026-02-01', hasta: '2026-01-01' }))).toBe('argumentos_invalidos');
  });
});
