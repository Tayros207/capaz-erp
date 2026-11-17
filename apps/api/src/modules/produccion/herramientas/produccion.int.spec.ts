import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import type pg from 'pg';
import { Relevo } from '../../../core/eventos/relevo.js';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { datosDe } from '../../registro/herramientas/pruebas-de-registro.js';

// Producción (órdenes de trabajo del taller, modelo de SF) por HTTP real: cantidad, adelanto y lo que falta cancelar;
// estados; cobro y anulación con adelanto; y la propuesta de Finanzas en la bandeja (R5: nunca mueve dinero sola).

let app: AppDePruebas;
let appPool: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let lector: Sesion; // member de A: producción en lectura
let ajeno: Sesion; // owner de B
let A: string;
let cristina: string;
let futuro = Date.now() + 3_600_000;

const codigo = (r: { cuerpo: any }) => r.cuerpo?.error?.codigo;
const mensaje = (r: { cuerpo: any }) => r.cuerpo?.error?.mensaje as string | undefined;
async function drenar() {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const auditoriaDe = (empresaId: string) => comoEmpresa(appPool, empresaId, async (c) => (await c.query("select herramienta, coalesce(resumen::text, '') as resumen from core.auditoria order by creado_en, id")).rows.map((r) => ({ herramienta: String(r.herramienta), resumen: String(r.resumen) })));
const propuestas = async (s: Sesion = dueno) => (await datosDe(s, 'borradores_listar', { modulo: 'registro', limite: 100 })).items as any[];
const eventosDe = (tipo: string) => comoEmpresa(appPool, A, async (c) => (await c.query('select carga from core.eventos_salida where tipo = $1 order by creado_en, id', [tipo])).rows.map((r) => r.carga as any));

/** Un millar de volantes: 1000 unidades a S/ 0.24 → S/ 240.00. */
const volantes = (extra: Record<string, unknown> = {}) => ({ descripcion: 'Millar de volantes', cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 240, material: ' couché 150g ', medida: 'A5', colores: 'full color', acabado: 'plastificado', ...extra });
const orden = (extra: Record<string, unknown> = {}) => dueno.herramienta('produccion_orden_crear', { clienteId: cristina, lineas: [volantes()], adelantoCentimos: 10_000, entregaEl: '2099-03-20', ...extra });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  relevo = app.obtener(Relevo);
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lectora', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Taller A de producción');
  const B = await crearEmpresa(ajeno, 'Taller B de producción');
  await Promise.all([activarModulo(A, 'produccion'), activarModulo(B, 'produccion')]);
  await agregarMiembro(app, A, lector, { modulo: 'produccion', nivel: 'lectura', alcance: 'todos' });
  cristina = (await datosDe(dueno, 'clientes_crear', { nombre: 'Cristina Neira' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('produccion_orden_crear', () => {
  let ordenId: string;

  it('calcula el total, el adelanto y lo que falta cancelar, con número OT y las líneas con su ficha de máquina', async () => {
    const r = await orden({ notas: ' Recoge el sábado ' });
    expect(r.cuerpo.ok, JSON.stringify(r.cuerpo)).toBe(true);
    const o = r.cuerpo.datos;
    ordenId = o.id;
    expect(o).toMatchObject({
      codigo: expect.stringMatching(/^OT-\d{4}-0001$/), estado: 'pendiente', clienteNombre: 'Cristina Neira', totalCentimos: 24_000, adelantoCentimos: 10_000, saldoCentimos: 14_000,
      estadoDePago: 'con_adelanto', resumen: 'Millar de volantes', totalLineas: 1, notas: 'Recoge el sábado', atrasada: false, destinoAdelanto: null,
    });
    expect(o.lineas).toEqual([
      { posicion: 0, descripcion: 'Millar de volantes', unidad: 'unidad', cantidadMilesimas: 1_000_000, precioUnitarioMilesimas: 240, subtotalCentimos: 24_000, material: 'couché 150g', medida: 'A5', colores: 'full color', acabado: 'plastificado' },
    ]);
    expect(o.historial.map((h: any) => h.tipo)).toEqual(['creada']);
    expect((await eventosDe('produccion.orden_creada')).at(-1)).toMatchObject({ id: ordenId, clienteId: cristina, totalCentimos: 24_000, adelantoCentimos: 10_000 });
  });

  it('con varias líneas el total es la suma de subtotales redondeados y el resumen cuenta las demás', async () => {
    const r = await orden({ adelantoCentimos: 0, lineas: [volantes(), { descripcion: 'Tarjetas', cantidadMilesimas: 333_000, precioUnitarioMilesimas: 1_005 }, { descripcion: 'Sellos', cantidadMilesimas: 2_000, precioUnitarioMilesimas: 3_500 }] });
    const o = datosDe_(r);
    expect(o.lineas.map((l: any) => l.subtotalCentimos)).toEqual([24_000, 33_467, 700]);
    expect(o).toMatchObject({ totalCentimos: 58_167, estadoDePago: 'sin_adelanto', resumen: 'Millar de volantes (+2 más)', totalLineas: 3, saldoCentimos: 58_167 });
  });

  it('el adelanto puede igualar al total (queda pagado) pero no superarlo', async () => {
    expect(datosDe_(await orden({ adelantoCentimos: 24_000 }))).toMatchObject({ estadoDePago: 'pagado', saldoCentimos: 0 });
    const r = await orden({ adelantoCentimos: 24_001 });
    expect(codigo(r)).toBe('argumentos_invalidos');
    expect(mensaje(r)).toMatch(/adelanto no puede ser mayor/);
  });

  it('rechaza sin líneas, líneas inválidas, cliente inexistente y entrega anterior', async () => {
    expect(codigo(await orden({ lineas: [] }))).toBe('argumentos_invalidos');
    expect(codigo(await orden({ lineas: [volantes({ cantidadMilesimas: 0 })] }))).toBe('argumentos_invalidos');
    expect(codigo(await orden({ lineas: [volantes({ precioUnitarioMilesimas: 0 })] }))).toBe('argumentos_invalidos');
    expect(codigo(await orden({ lineas: [volantes({ descripcion: '  ' })] }))).toBe('argumentos_invalidos');
    expect(codigo(await orden({ clienteId: randomUUID() }))).toBe('argumentos_invalidos');
    expect(codigo(await orden({ clienteId: undefined }))).toBe('argumentos_invalidos');
    expect(codigo(await orden({ fecha: '2026-03-10', entregaEl: '2026-03-01' }))).toBe('argumentos_invalidos');
  });

  it('el lector no crea y la otra empresa no ve la orden', async () => {
    expect((await lector.herramienta('produccion_orden_crear', { clienteId: cristina, lineas: [volantes()] })).estado).toBe(403);
    expect(codigo(await ajeno.herramienta('produccion_orden_ver', { id: ordenId }))).toBe('no_encontrado');
    expect((await lector.herramienta('produccion_orden_ver', { id: ordenId })).cuerpo.ok).toBe(true);
  });

  it('la auditoría guarda códigos y cifras, nunca el nombre del cliente ni la nota', async () => {
    const filas = await auditoriaDe(A);
    const texto = filas.filter((f) => f.herramienta.startsWith('produccion')).map((f) => f.resumen).join(' ');
    expect(texto).toMatch(/OT-/);
    expect(texto).not.toMatch(/Cristina|Recoge el sábado/);
  });
});

function datosDe_(r: { cuerpo: any }) {
  if (!r.cuerpo?.ok) throw new Error(`Se esperaba éxito: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
}

describe('estados, edición y listado', () => {
  let id: string;
  beforeAll(async () => {
    id = datosDe_(await orden({ adelantoCentimos: 5_000, entregaEl: '2020-01-01', fecha: '2019-12-01' })).id;
  });

  it('se mueve libremente adelante y atrás; el mismo estado es idempotente; queda en el historial', async () => {
    expect(datosDe_(await dueno.herramienta('produccion_orden_estado', { id, estado: 'listo', nota: 'Salto directo' })).estado).toBe('listo');
    expect(datosDe_(await dueno.herramienta('produccion_orden_estado', { id, estado: 'en_maquina' })).estado).toBe('en_maquina');
    const igual = datosDe_(await dueno.herramienta('produccion_orden_estado', { id, estado: 'en_maquina' }));
    expect(igual.historial.filter((h: any) => h.tipo === 'estado')).toHaveLength(2);
    expect(igual.atrasada).toBe(true);
  });

  it('se edita: reemplaza las líneas, recalcula el total y no deja bajarlo del adelanto', async () => {
    const e = datosDe_(await dueno.herramienta('produccion_orden_editar', { id, lineas: [volantes({ cantidadMilesimas: 2_000_000 })], entregaEl: null }));
    expect(e).toMatchObject({ totalCentimos: 48_000, saldoCentimos: 43_000, entregaEl: null, atrasada: false });
    expect(e.lineas).toHaveLength(1);
    const barato = await dueno.herramienta('produccion_orden_editar', { id, lineas: [{ descripcion: 'Poco', cantidadMilesimas: 1_000, precioUnitarioMilesimas: 1_000 }] });
    expect(codigo(barato)).toBe('argumentos_invalidos');
    expect(codigo(await dueno.herramienta('produccion_orden_editar', { id }))).toBe('argumentos_invalidos');
  });

  it('lista por estado, con búsqueda sin tildes por cliente, código y lo escrito en las líneas', async () => {
    const cola = (await datosDe(dueno, 'produccion_ordenes_listar', {})).items;
    expect(cola.length).toBeGreaterThanOrEqual(4);
    expect(cola.every((o: any) => ['pendiente', 'en_maquina', 'listo'].includes(o.estado))).toBe(true);
    expect((await datosDe(dueno, 'produccion_ordenes_listar', { buscar: 'CRISTINA neira' })).items.length).toBe(cola.length);
    expect((await datosDe(dueno, 'produccion_ordenes_listar', { buscar: 'COUCHE' })).items.length).toBeGreaterThan(0);
    expect((await datosDe(dueno, 'produccion_ordenes_listar', { buscar: 'plastificado' })).items.length).toBeGreaterThan(0);
    expect((await datosDe(dueno, 'produccion_ordenes_listar', { buscar: 'no existe' })).items).toEqual([]);
    expect((await datosDe(dueno, 'produccion_ordenes_listar', { buscar: 'OT-' })).items.length).toBeGreaterThan(0);
    expect((await datosDe(dueno, 'produccion_ordenes_listar', { estado: 'entregado' })).items).toEqual([]);
    expect((await datosDe(ajeno, 'produccion_ordenes_listar', { estado: 'todas' })).items).toEqual([]);
    expect((await datosDe(dueno, 'produccion_ordenes_listar', { estado: 'todas', clienteId: cristina })).items.length).toBeGreaterThan(0);
  });
});

describe('finanzas: la orden propone, la persona confirma', () => {
  let id: string;
  let codigoOrden: string;

  it('al crear con adelanto propone UNA deuda con su adelanto, con el origen de la orden', async () => {
    const o = datosDe_(await orden({ adelantoCentimos: 10_000 }));
    id = o.id;
    codigoOrden = o.codigo;
    await drenar();
    const mias = (await propuestas()).filter((b) => b.origenRef === `produccion:${id}`);
    expect(mias).toHaveLength(1);
    expect(mias[0]).toMatchObject({ herramienta: 'deuda_crear_con_adelanto', estado: 'pendiente' });
    expect(mias[0].args).toMatchObject({ tipo: 'por_cobrar', contactoId: cristina, totalCentimos: 24_000, adelantoCentimos: 10_000, origenTipo: 'produccion', origenId: id });
    expect(mias[0].resumen).toMatch(/adelanto de S\/ 100\.00 \(falta S\/ 140\.00\)/);
  });

  it('aprobar la propuesta crea la deuda parcial con su adelanto y deja el origen para encontrarla', async () => {
    const b = (await propuestas()).find((x) => x.origenRef === `produccion:${id}`)!;
    const r = await dueno.herramienta('borrador_aprobar', { id: b.id });
    expect(r.cuerpo.ok, JSON.stringify(r.cuerpo)).toBe(true);
    const deudas = (await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas' })).items;
    const d = deudas.find((x: any) => x.origenId === id);
    expect(d).toMatchObject({ origenTipo: 'produccion', estado: 'parcial', totalCentimos: 24_000, abonadoCentimos: 10_000 });
  });

  it('«ya me pagó» propone cobrar solo el saldo, sin duplicar, y entregar propone lo mismo una sola vez', async () => {
    await dueno.herramienta('produccion_orden_cobrar', { id });
    await dueno.herramienta('produccion_orden_cobrar', { id });
    await drenar();
    const cobros = (await propuestas()).filter((x) => x.origenRef === `produccion:${id}` && x.herramienta === 'deuda_abonar' && x.estado === 'pendiente');
    expect(cobros).toHaveLength(1);
    expect(cobros[0].args.montoCentimos).toBe(14_000);
    expect(cobros[0].resumen).toMatch(new RegExp(codigoOrden));
    datosDe_(await dueno.herramienta('produccion_orden_estado', { id, estado: 'entregado' }));
    await drenar();
    expect((await propuestas()).filter((x) => x.origenRef === `produccion:${id}` && x.herramienta === 'deuda_abonar' && x.estado === 'pendiente')).toHaveLength(1);
    expect((await eventosDe('produccion.orden_entregada')).at(-1)).toMatchObject({ id, saldoCentimos: 14_000 });
  });

  it('una orden entregada ya no cambia de estado ni se edita ni se anula', async () => {
    expect(mensaje(await dueno.herramienta('produccion_orden_estado', { id, estado: 'pendiente' }))).toMatch(/ya se entregó/);
    expect(mensaje(await dueno.herramienta('produccion_orden_editar', { id, notas: 'x' }))).toMatch(/ya se entregó/);
    expect(codigo(await dueno.herramienta('produccion_orden_anular', { id, motivo: 'x', destinoAdelanto: 'devuelto' }))).toBe('conflicto');
  });

  it('una orden pagada del todo no se vuelve a cobrar', async () => {
    const pagada = datosDe_(await orden({ adelantoCentimos: 24_000 }));
    expect(mensaje(await dueno.herramienta('produccion_orden_cobrar', { id: pagada.id }))).toMatch(/ya está pagado del todo/);
    await drenar();
    const mias = (await propuestas()).filter((x) => x.origenRef === `produccion:${pagada.id}`);
    expect(mias).toHaveLength(1);
    expect(mias[0]).toMatchObject({ herramienta: 'movimiento_registrar' });
    expect(mias[0].args).toMatchObject({ tipo: 'ingreso', montoCentimos: 24_000, contactoId: cristina });
  });
});

describe('produccion_orden_anular', () => {
  it('con adelanto exige decir si se devolvió o se retuvo; devuelto deja el total y propone anular la deuda', async () => {
    const o = datosDe_(await orden({ adelantoCentimos: 8_000 }));
    expect(mensaje(await dueno.herramienta('produccion_orden_anular', { id: o.id, motivo: 'Canceló' }))).toMatch(/adelanto: hay que decir/);
    const a = datosDe_(await dueno.herramienta('produccion_orden_anular', { id: o.id, motivo: 'Canceló', destinoAdelanto: 'devuelto' }));
    expect(a).toMatchObject({ estado: 'anulada', destinoAdelanto: 'devuelto', totalCentimos: 24_000, motivoAnulacion: 'Canceló' });
    expect((await eventosDe('produccion.orden_anulada')).at(-1)).toEqual({ id: o.id, codigo: o.codigo, adelantoCentimos: 8_000, destinoAdelanto: 'devuelto' });
  });

  it('retenido deja la orden por lo ya cobrado (saldo cero); sin adelanto no pide destino', async () => {
    const o = datosDe_(await orden({ adelantoCentimos: 8_000 }));
    expect(datosDe_(await dueno.herramienta('produccion_orden_anular', { id: o.id, motivo: 'Canceló', destinoAdelanto: 'retenido' }))).toMatchObject({ estado: 'anulada', totalCentimos: 8_000, adelantoCentimos: 8_000, saldoCentimos: 0, destinoAdelanto: 'retenido' });
    const sin = datosDe_(await orden({ adelantoCentimos: 0 }));
    expect(datosDe_(await dueno.herramienta('produccion_orden_anular', { id: sin.id, motivo: 'Error' })).destinoAdelanto).toBeNull();
  });

  it('una anulada solo vuelve a pendiente, no se cobra ni se edita; retomarla limpia la anulación', async () => {
    const o = datosDe_(await orden({ adelantoCentimos: 0 }));
    datosDe_(await dueno.herramienta('produccion_orden_anular', { id: o.id, motivo: 'Error' }));
    expect(mensaje(await dueno.herramienta('produccion_orden_estado', { id: o.id, estado: 'listo' }))).toMatch(/solo puede volver a pendiente/);
    expect(codigo(await dueno.herramienta('produccion_orden_cobrar', { id: o.id }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('produccion_orden_editar', { id: o.id, notas: 'x' }))).toBe('conflicto');
    const r = datosDe_(await dueno.herramienta('produccion_orden_estado', { id: o.id, estado: 'pendiente' }));
    expect(r).toMatchObject({ estado: 'pendiente', anuladoEn: null, motivoAnulacion: null, destinoAdelanto: null });
  });

  it('el lector no anula ni cambia estados', async () => {
    const o = datosDe_(await orden({ adelantoCentimos: 0 }));
    expect((await lector.herramienta('produccion_orden_anular', { id: o.id, motivo: 'x' })).estado).toBe(403);
    expect((await lector.herramienta('produccion_orden_estado', { id: o.id, estado: 'listo' })).estado).toBe(403);
    expect(codigo(await ajeno.herramienta('produccion_orden_anular', { id: o.id, motivo: 'x' }))).toBe('no_encontrado');
  });
});
