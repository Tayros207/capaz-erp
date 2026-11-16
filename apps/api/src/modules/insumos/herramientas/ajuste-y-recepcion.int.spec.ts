import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { RegistroDeConsumidores } from '../../../core/eventos/registro-de-consumidores.js';
import { Relevo } from '../../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigo, confirmarCritica, crearArticulo, crearProducto, datos, eventosDe, mensaje, mover } from './pruebas-de-insumos.js';

// Inventario por HTTP real, parte 2: el ajuste (crítica, en dos pasos), la entrada con origen (idempotente por
// origen), el consumidor de `compra.recibida` (solo propone: R5) y el resumen.

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let ajeno: Sesion;
let empresaA: string;
let empresaB: string;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, ajeno] = await Promise.all([abrirSesion(app, 'Dueña'), abrirSesion(app, 'Ajena')]);
  empresaA = await crearEmpresa(dueno, 'Empresa A de ajustes');
  empresaB = await crearEmpresa(ajeno, 'Empresa B de ajustes');
  await Promise.all([activarModulo(empresaA, 'insumos'), activarModulo(empresaB, 'insumos')]);
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

const verArticulo = async (s: Sesion, id: string) => datos(await s.herramienta('articulo_ver', { id }));

describe('existencia_ajustar (crítica)', () => {
  it('pide confirmación con el resumen y no cambia nada hasta confirmar; confirmada, deja el ajuste con su signo', async () => {
    const a = await crearArticulo(dueno, 'Papel bond A3', { minimoMilesimas: 10_000 });
    datos(await mover(dueno, a.id, 'entrada', 12_000));
    const args = { articuloId: a.id, existenciaNuevaMilesimas: 7_500, motivo: 'Conteo de fin de mes' };
    const pide = await dueno.herramienta('existencia_ajustar', args);
    expect(pide.cuerpo.requiereConfirmacion.resumen).toBe('La existencia de «Papel bond A3» en Principal pasará de 12 paquete a 7.5 paquete (-4.5 paquete). El ajuste queda en el historial y no se borra.');
    expect((await verArticulo(dueno, a.id)).existenciaTotalMilesimas).toBe(12_000);
    const r = datos(await dueno.herramienta('existencia_ajustar', args, { confirmacion: pide.cuerpo.requiereConfirmacion.token }));
    expect(r.movimiento).toMatchObject({ tipo: 'ajuste', cantidadMilesimas: -4_500, existenciaResultanteMilesimas: 7_500, motivo: 'Conteo de fin de mes' });
    expect(r.existencia).toMatchObject({ cantidadMilesimas: 7_500, bajoMinimo: true });
    // El ajuste a la baja también avisa al cruzar el mínimo.
    expect((await eventosDe(appPool, empresaA, 'existencia.bajo_minimo')).filter((c) => c.articuloId === a.id)).toEqual([
      { articuloId: a.id, sucursalId: r.movimiento.sucursalId, cantidadMilesimas: 7_500, minimoMilesimas: 10_000 },
    ]);
    // Repetir la misma confirmación no ajusta otra vez: ya no hay diferencia que ajustar.
    expect(mensaje(await dueno.herramienta('existencia_ajustar', args, { confirmacion: pide.cuerpo.requiereConfirmacion.token }))).toBe('La existencia ya es esa cantidad: no hay nada que ajustar.');
    expect(datos(await dueno.herramienta('existencias_movimientos_listar', { articuloId: a.id, tipo: 'ajuste' })).items).toHaveLength(1);
  });

  it('el mismo token no sirve dos veces', async () => {
    const a = await crearArticulo(dueno, 'Papel kraft');
    const args = { articuloId: a.id, existenciaNuevaMilesimas: 2_000, motivo: 'Conteo' };
    const pide = await dueno.herramienta('existencia_ajustar', args);
    datos(await dueno.herramienta('existencia_ajustar', args, { confirmacion: pide.cuerpo.requiereConfirmacion.token }));
    datos(await mover(dueno, a.id, 'salida', 1_000));
    expect(codigo(await dueno.herramienta('existencia_ajustar', args, { confirmacion: pide.cuerpo.requiereConfirmacion.token }))).toBe('confirmacion_ya_usada');
    expect((await verArticulo(dueno, a.id)).existenciaTotalMilesimas).toBe(1_000);
  });

  it('si la existencia cambió mientras se confirmaba, la confirmación queda desactualizada y nada cambia', async () => {
    const a = await crearArticulo(dueno, 'Cinta de embalaje');
    datos(await mover(dueno, a.id, 'entrada', 5_000));
    const args = { articuloId: a.id, existenciaNuevaMilesimas: 4_000, motivo: 'Conteo' };
    const pide = await dueno.herramienta('existencia_ajustar', args);
    datos(await mover(dueno, a.id, 'salida', 500));
    expect(codigo(await dueno.herramienta('existencia_ajustar', args, { confirmacion: pide.cuerpo.requiereConfirmacion.token }))).toBe('confirmacion_desactualizada');
    expect((await verArticulo(dueno, a.id)).existenciaTotalMilesimas).toBe(4_500);
    expect(datos(await confirmarCritica(dueno, 'existencia_ajustar', args)).existencia.cantidadMilesimas).toBe(4_000);
  });

  it('ajustar a lo mismo no pide confirmación ni guarda nada; ajustar hacia arriba suma; pide motivo', async () => {
    const a = await crearArticulo(dueno, 'Bolsas kraft');
    const igual = await dueno.herramienta('existencia_ajustar', { articuloId: a.id, existenciaNuevaMilesimas: 0, motivo: 'Conteo' });
    expect(codigo(igual)).toBe('conflicto');
    expect(mensaje(igual)).toBe('La existencia ya es esa cantidad: no hay nada que ajustar.');
    const r = datos(await confirmarCritica(dueno, 'existencia_ajustar', { articuloId: a.id, existenciaNuevaMilesimas: 3_000, motivo: 'Inventario inicial' }));
    expect(r.movimiento).toMatchObject({ tipo: 'ajuste', cantidadMilesimas: 3_000, existenciaResultanteMilesimas: 3_000 });
    expect(codigo(await dueno.herramienta('existencia_ajustar', { articuloId: a.id, existenciaNuevaMilesimas: 1 }))).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('existencia_ajustar', { articuloId: a.id, existenciaNuevaMilesimas: -1, motivo: 'x' }))).toBe('argumentos_invalidos');
    expect(codigo(await ajeno.herramienta('existencia_ajustar', { articuloId: a.id, existenciaNuevaMilesimas: 0, motivo: 'x' }))).toBe('no_encontrado');
  });
});

describe('existencias_recibir (idempotente por origen)', () => {
  it('entra todo junto, agrupa el mismo artículo, guarda el último costo y no suma dos veces el mismo origen', async () => {
    const a = await crearArticulo(dueno, 'Tinta magenta');
    const b = await crearArticulo(dueno, 'Tinta amarilla');
    const args = {
      origenTipo: 'guia',
      origenId: `G-${randomUUID().slice(0, 8)}`,
      motivo: 'Guía del proveedor',
      lineas: [
        { articuloId: a.id, cantidadMilesimas: 2_000, costoUnitarioMilesimas: 45_000 },
        { articuloId: b.id, cantidadMilesimas: 1_000 },
        { articuloId: a.id, cantidadMilesimas: 1_000, costoUnitarioMilesimas: 46_000 },
      ],
    };
    const r = datos(await dueno.herramienta('existencias_recibir', args));
    expect(r).toMatchObject({ origenTipo: 'guia', origenId: args.origenId, repetida: false });
    expect(r.movimientos.map((m: any) => [m.articuloId, m.tipo, m.cantidadMilesimas, m.costoUnitarioMilesimas, m.origenTipo, m.origenId])).toEqual([
      [a.id, 'entrada', 3_000, 46_000, 'guia', args.origenId],
      [b.id, 'entrada', 1_000, null, 'guia', args.origenId],
    ]);
    expect(await verArticulo(dueno, a.id)).toMatchObject({ existenciaTotalMilesimas: 3_000, ultimoCostoMilesimas: 46_000 });
    const otra = datos(await dueno.herramienta('existencias_recibir', { ...args, lineas: [{ articuloId: a.id, cantidadMilesimas: 9_000 }] }));
    expect(otra.repetida).toBe(true);
    expect(otra.movimientos.map((m: any) => m.id)).toEqual(r.movimientos.map((m: any) => m.id));
    expect((await verArticulo(dueno, a.id)).existenciaTotalMilesimas).toBe(3_000);
  });

  it('dos recepciones del mismo origen a la vez suman una sola vez', async () => {
    const a = await crearArticulo(dueno, 'Papel periódico');
    const args = { origenTipo: 'guia', origenId: `G-${randomUUID().slice(0, 8)}`, lineas: [{ articuloId: a.id, cantidadMilesimas: 1_000 }] };
    const [x, y] = await Promise.all([dueno.herramienta('existencias_recibir', args), dueno.herramienta('existencias_recibir', args)]);
    expect([datos(x).repetida, datos(y).repetida].map(String).sort((p, q) => p.localeCompare(q))).toEqual(['false', 'true']);
    expect((await verArticulo(dueno, a.id)).existenciaTotalMilesimas).toBe(1_000);
  });

  it('un artículo inexistente o archivado rechaza toda la entrada; la misma clave de idempotencia devuelve lo mismo', async () => {
    const a = await crearArticulo(dueno, 'Etiquetas adhesivas');
    const archivado = await crearArticulo(dueno, 'Artículo archivado');
    datos(await dueno.herramienta('articulo_archivar', { id: archivado.id }));
    const base = { origenTipo: 'guia', origenId: `G-${randomUUID().slice(0, 8)}` };
    expect(codigo(await dueno.herramienta('existencias_recibir', { ...base, lineas: [{ articuloId: a.id, cantidadMilesimas: 1 }, { articuloId: randomUUID(), cantidadMilesimas: 1 }] }))).toBe('argumentos_invalidos');
    expect(mensaje(await dueno.herramienta('existencias_recibir', { ...base, lineas: [{ articuloId: a.id, cantidadMilesimas: 1 }, { articuloId: archivado.id, cantidadMilesimas: 1 }] }))).toMatch(/archivado/);
    expect((await verArticulo(dueno, a.id)).existenciaTotalMilesimas).toBe(0);
    expect(codigo(await dueno.herramienta('existencias_recibir', { ...base, lineas: [] }))).toBe('argumentos_invalidos');
    const clave = `rec-${randomUUID()}`;
    const args = { ...base, lineas: [{ articuloId: a.id, cantidadMilesimas: 2_000 }] };
    const x = datos(await dueno.herramienta('existencias_recibir', args, { clave }));
    const y = datos(await dueno.herramienta('existencias_recibir', args, { clave }));
    expect(y).toEqual(x);
    expect(x.repetida).toBe(false);
  });
});

describe('consumidor de compra.recibida: solo propone un borrador (R5)', () => {
  let relevo: Relevo;
  let futuro = Date.now() + 3_600_000;
  const emitir = (empresaId: string, carga: Record<string, unknown>) =>
    comoEmpresa(appPool, empresaId, async (c) => (await c.query(`insert into core.eventos_salida (tenant_id, tipo, carga) values ($1, 'compra.recibida', $2::jsonb) returning id`, [empresaId, JSON.stringify(carga)])).rows[0].id as string, { confirmar: true });
  async function drenar() {
    futuro += 600_000;
    for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
    throw new Error('El relevo no terminó de drenar.');
  }
  const borradores = async (s: Sesion) => datos(await s.herramienta('borradores_listar', { modulo: 'insumos', limite: 100 })).items;
  const compra = (lineas: unknown[], extra: Record<string, unknown> = {}) => ({
    ordenId: randomUUID(), recepcionId: randomUUID(), numero: 'OC-PRI-2026-0007', proveedorId: randomUUID(), totalRecibidoCentimos: 10_000, lineas, ...extra,
  });

  beforeAll(() => {
    relevo = app.obtener(Relevo);
  });

  it('queda registrado al arrancar el módulo', () => {
    const propios = app.obtener(RegistroDeConsumidores).todos().filter((c) => c.modulo === 'insumos');
    expect(propios.map((c) => `${c.nombre}:${c.evento}`)).toEqual(['insumos_compra_recibida:compra.recibida']);
  });

  it('propone UN borrador con las líneas de artículos activos; no mueve nada; aprobarlo hace la entrada', { timeout: 120_000 }, async () => {
    const a = await crearArticulo(dueno, 'Vinil adhesivo');
    const sinArticulo = await crearProducto(dueno, 'Producto sin inventario');
    const carga = compra([
      { productoId: a.productoId, cantidadMilesimas: 2_000, costoUnitarioMilesimas: 15_000 },
      { productoId: null, cantidadMilesimas: 1_000, costoUnitarioMilesimas: 5_000 },
      { productoId: sinArticulo, cantidadMilesimas: 1_000, costoUnitarioMilesimas: 1_000 },
      { productoId: a.productoId, cantidadMilesimas: 500, costoUnitarioMilesimas: 16_000 },
    ]);
    await emitir(empresaA, carga);
    await drenar();
    const lista = await borradores(dueno);
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({
      herramienta: 'existencias_recibir', modulo: 'insumos', estado: 'pendiente', origen: 'modulo', propuestoPor: 'sistema',
      origenRef: `recepcion:${carga.recepcionId}`, resumen: 'Entrada al inventario de 1 artículo por la compra OC-PRI-2026-0007',
      args: { origenTipo: 'recepcion', origenId: carga.recepcionId, motivo: 'Compra OC-PRI-2026-0007', lineas: [{ articuloId: a.id, cantidadMilesimas: 2_500, costoUnitarioMilesimas: 16_000 }] },
    });
    expect((await verArticulo(dueno, a.id)).existenciaTotalMilesimas).toBe(0);
    expect(await borradores(ajeno)).toEqual([]);
    const aprobado = datos(await dueno.herramienta('borrador_aprobar', { id: lista[0].id }));
    expect(aprobado.borrador.estado).toBe('aprobado');
    expect(await verArticulo(dueno, a.id)).toMatchObject({ existenciaTotalMilesimas: 2_500, ultimoCostoMilesimas: 16_000 });
    // La misma recepción anunciada otra vez ya no propone: ya entró al inventario.
    await emitir(empresaA, { ...carga, ordenId: randomUUID() });
    await drenar();
    expect((await borradores(dueno)).filter((b: any) => b.estado === 'pendiente')).toEqual([]);
  });

  it('una compra sin líneas con artículo activo no propone nada', { timeout: 120_000 }, async () => {
    const antes = (await borradores(dueno)).length;
    await emitir(empresaA, compra([{ productoId: null, cantidadMilesimas: 1_000, costoUnitarioMilesimas: 1 }]));
    await drenar();
    expect(await borradores(dueno)).toHaveLength(antes);
  });
});

describe('insumos_resumen', () => {
  it('cuenta artículos, bajo mínimo y movimientos del período; otra empresa ve los suyos', async () => {
    const r = datos(await dueno.herramienta('insumos_resumen', { desde: '2000-01-01', hasta: '2999-12-31' }));
    expect(r).toMatchObject({ desde: '2000-01-01', hasta: '2999-12-31' });
    expect(r.articulos).toBeGreaterThanOrEqual(8);
    expect(r.articulosBajoMinimo).toBeGreaterThanOrEqual(1);
    expect(r.entradas).toBeGreaterThan(0);
    expect(r.salidas).toBeGreaterThan(0);
    expect(r.ajustes).toBe(4);
    expect(datos(await dueno.herramienta('insumos_resumen', { desde: '1999-01-01', hasta: '1999-12-31' }))).toMatchObject({ entradas: 0, salidas: 0, ajustes: 0 });
    expect(datos(await ajeno.herramienta('insumos_resumen', { desde: '2000-01-01', hasta: '2999-12-31' }))).toMatchObject({ articulos: 0, entradas: 0 });
    expect(codigo(await dueno.herramienta('insumos_resumen', { desde: '2026-02-01', hasta: '2026-01-01' }))).toBe('argumentos_invalidos');
  });
});
