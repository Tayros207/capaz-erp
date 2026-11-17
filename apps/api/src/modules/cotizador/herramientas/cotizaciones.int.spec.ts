import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, darDeBajaModulo, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, crearCliente, datosDe, eventosDe, LINEA_346_38, LISTA_C7, manual } from './pruebas-de-cotizador.js';

// Cotizaciones (s2) por HTTP real, parte 1: borradores (crear, editar, ver, listar, duplicar), costo y margen, y el camino
// «módulo no núcleo» (R17): dos empresas, lectura, sin módulo, alcance «propios», baja con disparador, idempotencia, paginación.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion; // owner de A (todos los permisos)
let lector: Sesion; // member de A: cotizador en lectura
let sinModulo: Sesion; // member de A sin el módulo cotizador
let propio: Sesion; // member de A: cotizador completo, alcance propios
let ajeno: Sesion; // owner de B
let tercero: Sesion; // owner de C (se le da de baja el módulo)
let A: string;
let B: string;
let C: string;
let cliente: string;
let lista: any;

const crear = (s: Sesion, extra: Record<string, unknown> = {}, clave?: string) =>
  s.herramienta('cotizacion_crear', { titulo: 'Volantes de marzo', clienteId: cliente, lineas: [manual('Diseño', 100)], ...extra }, { clave });
const delCotizador = async (empresaId: string) => (await eventosDe(appPool, empresaId)).filter((e) => e.tipo.startsWith('cotizacion.'));
const filas = (empresaId: string, sql: string) => comoEmpresa(appPool, empresaId, async (c) => (await c.query(sql)).rows as any[]);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, sinModulo, propio, ajeno, tercero] = await Promise.all(['Dueña', 'Lector', 'Sin módulo', 'Propio', 'Ajena', 'Tercera'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Cotizaciones A');
  B = await crearEmpresa(ajeno, 'Cotizaciones B');
  C = await crearEmpresa(tercero, 'Cotizaciones C');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador'), activarModulo(C, 'cotizador'), activarModulo(A, 'registro')]);
  await agregarMiembro(app, A, lector, { modulo: 'cotizador', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, A, sinModulo, { modulo: 'registro', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, A, propio, { modulo: 'cotizador', nivel: 'completo', alcance: 'propios' });
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  lista = await datosDe(dueno, 'lista_precio_crear', LISTA_C7);
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('cotizacion_crear', () => {
  it('un borrador con una línea de lista: precio recalculado por el servidor, IGV por línea, sin número y sin eventos', async () => {
    const r = await crear(dueno, { lineas: [{ tipo: 'lista', listaId: lista.id, cantidadMilesimas: 2_500_000 }] });
    expect(r.estado).toBe(200);
    expect(r.cuerpo.datos).toMatchObject({
      codigo: 'Borrador', numero: null, anio: null, titulo: 'Volantes de marzo', estado: 'borrador', clienteId: cliente, clienteNombre: 'Imprenta Sol',
      versionActual: 1, version: 1, conOpciones: false, igvPorcentaje: 18, subtotalCentimos: 87_739, igvCentimos: 15_793, totalCentimos: 103_532,
      validaHasta: null, cantidadDeLineas: 1, creadoPor: dueno.usuarioId, costoCentimos: null, margenPct: null, emitidaEn: null, lineasAceptadas: null,
    });
    expect(r.cuerpo.datos.lineas).toEqual([
      { posicion: 0, tipo: 'lista', productoId: null, listaId: lista.id, descripcion: LISTA_C7.nombre, unidad: 'unidad', cantidadMilesimas: 2_500_000, precioUnitarioMilesimas: 351, importeCentimos: 87_739, igvCentimos: 15_793, totalCentimos: 103_532 },
    ]);
    expect(r.cuerpo.datos.historial.map((h: any) => h.tipo)).toEqual(['creada']);
    expect(await delCotizador(A)).toEqual([]);
  });

  it('líneas manuales y de lista juntas: los totales son sumas; el ajuste del cliente entra en el precio de lista', async () => {
    await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: cliente, porcentaje: '-5' });
    const d = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Mixta', clienteId: cliente, lineas: [{ tipo: 'lista', listaId: lista.id, cantidadMilesimas: 1_000_000 }, manual('Diseño', 100, 2)] });
    expect(d.lineas.map((l: any) => [l.importeCentimos, l.igvCentimos, l.totalCentimos])).toEqual([[55_100, 9_918, 65_018], [20_000, 3_600, 23_600]]);
    expect(d).toMatchObject({ subtotalCentimos: 75_100, igvCentimos: 13_518, totalCentimos: 88_618 });
    await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: cliente, porcentaje: null });
  });

  it('valida: campos que sobran o faltan, línea sin lista, cantidad cero, cliente o lista inexistentes, fuera de rango', async () => {
    for (const mal of [{ extra: 1 }, { titulo: '  ' }, { lineas: [] }, { lineas: [{ tipo: 'manual', descripcion: 'x', cantidadMilesimas: 0, precioUnitarioMilesimas: 1000 }] }, { lineas: [{ tipo: 'lista', cantidadMilesimas: 1000 }] }, { costoCentimos: -1 }]) {
      expect(codigoDe(await crear(dueno, mal)), JSON.stringify(mal)).toBe('argumentos_invalidos');
    }
    expect(codigoDe(await crear(dueno, { clienteId: randomUUID() }))).toBe('argumentos_invalidos');
    expect(codigoDe(await crear(dueno, { lineas: [{ tipo: 'lista', listaId: randomUUID(), cantidadMilesimas: 100_000 }] }))).toBe('no_encontrado');
    const fuera = await crear(dueno, { lineas: [manual('ok', 1), { tipo: 'lista', listaId: lista.id, cantidadMilesimas: 99_000 }] });
    expect(codigoDe(fuera)).toBe('conflicto');
    expect(fuera.cuerpo.error.mensaje).toMatch(/^Línea 2: 99 unidades está fuera de 100 a 5\.000/);
  });

  it('la misma clave de idempotencia no crea dos cotizaciones; con otros datos es conflicto', async () => {
    const clave = `cot-${randomUUID()}`;
    const x = await crear(dueno, { titulo: 'Idempotente' }, clave);
    const y = await crear(dueno, { titulo: 'Idempotente' }, clave);
    expect(x.cuerpo.ok).toBe(true);
    expect(y.cuerpo).toEqual(x.cuerpo);
    expect(await filas(A, `select 1 from cotizador.cotizaciones where titulo = 'Idempotente'`)).toHaveLength(1);
    expect(codigoDe(await crear(dueno, { titulo: 'Idempotente', lineas: [manual('otra', 5)] }, clave))).toBe('conflicto');
  });
});

describe('cotizacion_editar, ver y duplicar', () => {
  let c: any;
  it('edita título, notas, condiciones y cliente; reemplaza líneas y recalcula; sin datos es argumentos_invalidos', async () => {
    c = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Para editar', lineas: [manual('Una', 10)] });
    expect(c.clienteId).toBeNull();
    const e = await datosDe(dueno, 'cotizacion_editar', {
      id: c.id, titulo: 'Editada', clienteId: cliente, notas: '  interna ', conOpciones: true, observaciones: 'Para el cliente',
      condiciones: { plazoEntrega: '5 días', validezDias: 7 }, lineas: [manual('Dos', 20, 3), { tipo: 'lista', listaId: lista.id, cantidadMilesimas: 1_000_000 }],
    });
    expect(e).toMatchObject({ titulo: 'Editada', clienteId: cliente, clienteNombre: 'Imprenta Sol', notas: 'interna', conOpciones: true, observaciones: 'Para el cliente', cantidadDeLineas: 2, subtotalCentimos: 64_000 });
    expect(e.condiciones).toEqual({ validezDias: 7, plazoEntrega: '5 días', formaPago: '', tolerancia: '', noIncluye: '' });
    expect(e.historial.map((h: any) => h.tipo)).toEqual(['editada', 'creada']);
    expect(codigoDe(await dueno.herramienta('cotizacion_editar', { id: c.id }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cotizacion_editar', { id: c.id, titulo: 'x', extra: 1 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cotizacion_editar', { id: randomUUID(), titulo: 'x' }))).toBe('no_encontrado');
  });

  it('cambiar el cliente recalcula las líneas de lista con su ajuste; quitar el cliente deja el borrador sin él', async () => {
    const otro = await crearCliente(dueno, 'Cliente con ajuste');
    await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: otro, porcentaje: '10' });
    const e = await datosDe(dueno, 'cotizacion_editar', { id: c.id, clienteId: otro });
    expect(e.lineas.find((l: any) => l.tipo === 'lista')).toMatchObject({ importeCentimos: 63_800 });
    expect((await datosDe(dueno, 'cotizacion_editar', { id: c.id, clienteId: null })).clienteId).toBeNull();
  });

  it('cotizacion_ver muestra una versión concreta; una que no existe es no_encontrado', async () => {
    expect((await datosDe(dueno, 'cotizacion_ver', { id: c.id, version: 1 })).version).toBe(1);
    expect(codigoDe(await dueno.herramienta('cotizacion_ver', { id: c.id, version: 7 }))).toBe('no_encontrado');
  });

  it('duplicar crea otro borrador sin número con las mismas líneas y cliente', async () => {
    const d = await datosDe(dueno, 'cotizacion_duplicar', { id: c.id });
    expect(d.id).not.toBe(c.id);
    expect(d).toMatchObject({ codigo: 'Borrador', estado: 'borrador', versionActual: 1, titulo: 'Editada', conOpciones: true, cantidadDeLineas: 2 });
    expect(d.lineas.map((l: any) => l.importeCentimos)).toEqual((await datosDe(dueno, 'cotizacion_ver', { id: c.id })).lineas.map((l: any) => l.importeCentimos));
    expect(d.historial.map((h: any) => h.tipo)).toEqual(['creada']);
  });
});

describe('costo y margen', () => {
  it('con costo, el margen se calcula con el motor; quien no tiene cotizador:costos no ve costo, margen ni motivo', async () => {
    const d = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Con costo', clienteId: cliente, lineas: [LINEA_346_38], costoCentimos: 22_515 });
    expect(d).toMatchObject({ costoCentimos: 22_515, margenPct: '35.000', subtotalCentimos: 34_638 });
    const vista = await datosDe(lector, 'cotizacion_ver', { id: d.id });
    expect(vista).toMatchObject({ subtotalCentimos: 34_638, costoCentimos: null, margenPct: null, motivoMargenBajo: null });
    const editada = await datosDe(dueno, 'cotizacion_editar', { id: d.id, lineas: [manual('Doble', 692.76)] });
    expect(editada).toMatchObject({ costoCentimos: 22_515, margenPct: '67.500' });
    expect(await datosDe(dueno, 'cotizacion_editar', { id: d.id, costoCentimos: null })).toMatchObject({ costoCentimos: null, margenPct: null });
  });
});

describe('listar y paginar', () => {
  it('pagina por fecha de creación con cursor, filtra por estado, cliente y texto, y rechaza un cursor inválido', async () => {
    const todas = (await datosDe(dueno, 'cotizaciones_listar', { limite: 100 })).items;
    expect(todas.length).toBeGreaterThan(5);
    const vistos: string[] = [];
    let cursor: string | undefined;
    do {
      const p = await datosDe(dueno, 'cotizaciones_listar', { limite: 3, cursor });
      expect(p.items.length).toBeLessThanOrEqual(3);
      vistos.push(...p.items.map((x: any) => x.id));
      cursor = p.siguiente ?? undefined;
    } while (cursor);
    expect(vistos).toEqual(todas.map((x: any) => x.id));
    expect((await datosDe(dueno, 'cotizaciones_listar', { buscar: 'CON COSTO' })).items.map((x: any) => x.titulo)).toEqual(['Con costo']);
    expect((await datosDe(dueno, 'cotizaciones_listar', { buscar: '%' })).items).toEqual([]);
    expect((await datosDe(dueno, 'cotizaciones_listar', { estado: 'emitida' })).items).toEqual([]);
    expect((await datosDe(dueno, 'cotizaciones_listar', { estado: 'abiertas', clienteId: cliente, limite: 100 })).items.every((x: any) => x.clienteId === cliente)).toBe(true);
    expect(codigoDe(await dueno.herramienta('cotizaciones_listar', { cursor: 'no-es-un-cursor' }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cotizaciones_listar', { limite: 0 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cotizaciones_listar', { estado: 'otro' }))).toBe('argumentos_invalidos');
  });
});

describe('aislamiento, permisos y alcance', () => {
  it('otra empresa no ve nada, ni por id ni en listados, ni puede usar su cliente o su lista', async () => {
    const mia = (await datosDe(dueno, 'cotizaciones_listar')).items[0];
    expect((await datosDe(ajeno, 'cotizaciones_listar')).items).toEqual([]);
    for (const [n, a] of [['cotizacion_ver', { id: mia.id }], ['cotizacion_editar', { id: mia.id, titulo: 'x' }], ['cotizacion_duplicar', { id: mia.id }], ['cotizacion_marcar_enviada', { id: mia.id }]] as const) {
      expect(codigoDe(await ajeno.herramienta(n, a)), n).toBe('no_encontrado');
    }
    expect(codigoDe(await ajeno.herramienta('cotizacion_crear', { titulo: 'x', clienteId: cliente, lineas: [manual('x', 1)] }))).toBe('argumentos_invalidos');
    expect(codigoDe(await ajeno.herramienta('cotizacion_crear', { titulo: 'x', lineas: [{ tipo: 'lista', listaId: lista.id, cantidadMilesimas: 100_000 }] }))).toBe('no_encontrado');
    expect(await filas(B, 'select 1 from cotizador.cotizaciones')).toHaveLength(0);
  });

  it('un member de lectura ve pero no escribe; sin el módulo asignado no entra', async () => {
    const mia = (await datosDe(dueno, 'cotizaciones_listar')).items[0];
    expect((await datosDe(lector, 'cotizaciones_listar')).items.length).toBeGreaterThan(0);
    expect((await datosDe(lector, 'cotizador_resumen', { desde: '2020-01-01', hasta: '2099-12-31' })).porEstado.length).toBeGreaterThan(0);
    for (const [n, a] of [
      ['cotizacion_crear', { titulo: 'x', lineas: [manual('x', 1)] }], ['cotizacion_editar', { id: mia.id, titulo: 'x' }], ['cotizacion_duplicar', { id: mia.id }],
      ['cotizacion_emitir', { id: mia.id }], ['cotizacion_nueva_version', { id: mia.id }], ['cotizacion_marcar_enviada', { id: mia.id }],
      ['cotizacion_aceptar', { id: mia.id }], ['cotizacion_rechazar', { id: mia.id }], ['cotizacion_anular', { id: mia.id, motivo: 'x' }],
    ] as const) {
      expect(codigoDe(await lector.herramienta(n, a)), n).toBe('modulo_solo_lectura');
    }
    for (const [n, a] of [['cotizaciones_listar', {}], ['cotizacion_ver', { id: mia.id }], ['cotizacion_crear', { titulo: 'x', lineas: [manual('x', 1)] }]] as const) {
      const r = await sinModulo.herramienta(n, a);
      expect(r.estado, n).toBe(403);
      expect(codigoDe(r), n).toBe('modulo_no_disponible');
    }
  });

  it('con alcance «propios» solo ve y cambia lo que creó; el resumen no es suyo', async () => {
    const ajena = (await datosDe(dueno, 'cotizaciones_listar')).items[0];
    expect(codigoDe(await propio.herramienta('cotizacion_ver', { id: ajena.id }))).toBe('no_encontrado');
    expect(codigoDe(await propio.herramienta('cotizacion_editar', { id: ajena.id, titulo: 'x' }))).toBe('no_encontrado');
    expect(codigoDe(await propio.herramienta('cotizacion_duplicar', { id: ajena.id }))).toBe('no_encontrado');
    const suya = await datosDe(propio, 'cotizacion_crear', { titulo: 'De la propia', lineas: [manual('x', 1)] });
    expect((await datosDe(propio, 'cotizaciones_listar', { limite: 100 })).items.map((x: any) => x.id)).toEqual([suya.id]);
    expect((await datosDe(propio, 'cotizacion_editar', { id: suya.id, titulo: 'Sigue siendo suya' })).titulo).toBe('Sigue siendo suya');
    const r = await propio.herramienta('cotizador_resumen', { desde: '2020-01-01', hasta: '2099-12-31' });
    expect(codigoDe(r)).toBe('sin_permiso');
    expect(r.cuerpo.error.mensaje).toBe('Tu acceso es solo a tus propios registros.');
  });

  it('módulo en baja: se lee, no se escribe por herramienta ni con un insert directo (R3)', async () => {
    const cli = await crearCliente(tercero, 'Cliente de C');
    const c = await datosDe(tercero, 'cotizacion_crear', { titulo: 'En C', clienteId: cli, lineas: [manual('x', 1)] });
    await darDeBajaModulo(C, 'cotizador');
    expect((await datosDe(tercero, 'cotizaciones_listar')).items.map((x: any) => x.id)).toEqual([c.id]);
    expect((await datosDe(tercero, 'cotizacion_ver', { id: c.id })).titulo).toBe('En C');
    for (const [n, a] of [['cotizacion_crear', { titulo: 'x', lineas: [manual('x', 1)] }], ['cotizacion_editar', { id: c.id, titulo: 'x' }], ['cotizacion_emitir', { id: c.id }], ['cotizacion_anular', { id: c.id, motivo: 'x' }]] as const) {
      expect(codigoDe(await tercero.herramienta(n, a)), n).toBe('modulo_solo_lectura');
    }
    const directo = comoEmpresa(appPool, C, (q) => q.query(`insert into cotizador.cotizaciones (tenant_id, titulo, creado_por) values ($1, 'Directa', 'u1')`, [C]));
    await expect(directo).rejects.toThrow(/no está activo/);
    expect(await filas(C, 'select 1 from cotizador.cotizaciones')).toHaveLength(1);
  });
});

describe('formas de la confirmación de las críticas', () => {
  it('emitir y anular piden confirmación y no cambian nada hasta confirmar', async () => {
    const d = await datosDe(dueno, 'cotizacion_crear', { titulo: 'Crítica', clienteId: cliente, lineas: [LINEA_346_38] });
    for (const [n, a] of [['cotizacion_emitir', { id: d.id }], ['cotizacion_anular', { id: d.id, motivo: 'prueba' }]] as const) {
      const pide = await dueno.herramienta(n, a);
      expect(pide.cuerpo).toMatchObject({ ok: false, requiereConfirmacion: { token: expect.any(String), resumen: expect.stringContaining('S/ 408.73') } });
      expect((await datosDe(dueno, 'cotizacion_ver', { id: d.id })).estado, n).toBe('borrador');
    }
    expect(await delCotizador(A)).toEqual([]);
    const emitida = await confirmando(dueno, 'cotizacion_emitir', { id: d.id });
    expect(emitida.resumen).toBe('Se emitirá el borrador «Crítica» por S/ 408.73 (con IGV). Una vez emitida no se edita: para cambiarla harás una nueva versión.');
    expect(emitida.respuesta.cuerpo.datos).toMatchObject({ estado: 'emitida', codigo: expect.stringMatching(/^COT-\d{4}-\d{4}$/) });
  });
});
