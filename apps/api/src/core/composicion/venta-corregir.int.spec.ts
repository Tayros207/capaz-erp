import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type RespuestaHttp, type Sesion } from '../herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { Relevo } from '../eventos/relevo.js';
import { confirmando, eventosDe } from '../../modules/registro/herramientas/pruebas-de-registro.js';

// `venta_corregir` por HTTP real: una sola confirmación y una sola transacción (pedido → deuda), excedente a favor, rollback,
// usuario sin Registro (borrador por el consumidor de respaldo, R5), borrador pendiente, umbral, y la huella `correcciones_listar`.

let app: AppDePruebas;
let appPool: pg.Pool;
let relevo: Relevo;
let dueno: Sesion;
let trabajador: Sesion; // ordenes + registro completo, rol member
let sinRegistro: Sesion; // ordenes completo, rol member
let ajeno: Sesion;
let A: string;
let cliente: string;
let futuro = Date.now() + 3_600_000;

const datos = (r: RespuestaHttp): any => {
  if (!r.cuerpo?.ok) throw new Error(`Respuesta ${r.estado}: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
};
const codigo = (r: RespuestaHttp) => r.cuerpo?.error?.codigo as string | undefined;
const llamar = async (s: Sesion, nombre: string, args: unknown) => datos(await s.herramienta(nombre, args));
const linea = (descripcion: string, soles: number, cantidad = 1) => ({ descripcion, cantidadMilesimas: cantidad * 1000, precioUnitarioMilesimas: soles * 1000 });

async function drenar() {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const borradoresDe = async (herramienta: string, origenRef: string) =>
  ((await llamar(dueno, 'borradores_listar', { modulo: 'registro', limite: 100 })).items as any[]).filter((b) => b.herramienta === herramienta && b.origenRef === origenRef);

/** Un pedido confirmado y, si se pide, su deuda por cobrar con abono. La deuda se crea a mano para no depender del relevo. */
async function venta(opciones: { soles?: number; abonoCentimos?: number; deuda?: boolean; extra?: Record<string, unknown> } = {}) {
  const p = await llamar(dueno, 'pedido_crear', { clienteId: cliente, lineas: [linea('Volantes', opciones.soles ?? 118)], ...opciones.extra });
  await llamar(dueno, 'pedido_confirmar', { id: p.id });
  let d: any = null;
  if (opciones.deuda !== false) {
    d = await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: cliente, concepto: `Pedido ${p.id}`, totalCentimos: (opciones.soles ?? 118) * 100, origenTipo: 'pedido', origenId: p.id });
    if (opciones.abonoCentimos) await llamar(dueno, 'deuda_abonar', { id: d.id, montoCentimos: opciones.abonoCentimos });
  }
  return { p: await llamar(dueno, 'pedido_ver', { id: p.id }), d };
}
const corregir = (s: Sesion, args: Record<string, unknown>) => confirmando(s, 'venta_corregir', { motivoCodigo: 'precio_acordado', ...args });
const versionDe = async (id: string) => (await llamar(dueno, 'pedido_ver', { id })).version as number;
const contarVersiones = (id: string) => comoEmpresa(appPool, A, async (c) => Number((await c.query(`select count(*)::int as n from ordenes.pedido_versiones where pedido_id = $1`, [id])).rows[0].n));

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  relevo = app.obtener(Relevo);
  [dueno, trabajador, sinRegistro, ajeno] = await Promise.all(['Dueña', 'Trabajador', 'Sin registro', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Empresa de ventas corregidas');
  const B = await crearEmpresa(ajeno, 'Otra empresa de ventas');
  await Promise.all(['ordenes', 'registro'].flatMap((m) => [activarModulo(A, m), activarModulo(B, m)]));
  await agregarMiembro(app, A, trabajador, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  await comoEmpresa(appPool, A, (c) => c.query(`insert into core.usuario_modulos (tenant_id, usuario_id, modulo, nivel, alcance) values ($1, $2, 'registro', 'completo', 'todos')`, [A, trabajador.usuarioId]), { confirmar: true });
  await agregarMiembro(app, A, sinRegistro, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  cliente = (await llamar(dueno, 'clientes_crear', { nombre: 'Botica Central' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('venta_corregir: una confirmación, una transacción', () => {
  it('muestra el resumen sin cambiar nada y, al confirmar, corrige el pedido y ajusta la deuda; lo pagado no se toca', async () => {
    const { p, d } = await venta({ abonoCentimos: 5_000 });
    const pide = await dueno.herramienta('venta_corregir', { id: p.id, motivoCodigo: 'precio_acordado', fijarTotalCentimos: 10_000 });
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain(`pedido ${p.codigo} (versión 1 → 2)`);
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain('Total: S/ 118.00 → S/ 100.00 (−S/ 18.00)');
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain('Ya pagó S/ 50.00; falta S/ 50.00');
    // El resumen no escribió nada (la simulación se deshace).
    expect(await versionDe(p.id)).toBe(1);
    expect(await contarVersiones(p.id)).toBe(0);
    expect((await llamar(dueno, 'deuda_ver', { id: d.id })).totalCentimos).toBe(11_800);
    expect((await eventosDe(appPool, A, 'pedido.corregido')).filter((e) => e.carga.id === p.id)).toEqual([]);
    // Una sola confirmación: el token del resumen basta para todo.
    const fin = await dueno.herramienta('venta_corregir', { id: p.id, motivoCodigo: 'precio_acordado', fijarTotalCentimos: 10_000 }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    const r = datos(fin);
    expect(r.pedido).toMatchObject({ version: 2, totalCentimos: 10_000 });
    expect(r.deuda).toMatchObject({ id: d.id, totalCentimos: 10_000, abonadoCentimos: 5_000, saldoCentimos: 5_000, estado: 'parcial' });
    expect(r.ajuste).toMatchObject({ montoCentimos: -1_800, origenRef: `pedido:${p.id}:v2`, motivoCodigo: 'precio_acordado', aFavorCentimos: 0 });
    expect(r).toMatchObject({ aFavorCentimos: 0, ajustePendiente: false, borradorActualizadoId: null });
    const v = await llamar(dueno, 'deuda_ver', { id: d.id });
    expect(v).toMatchObject({ totalCentimos: 10_000, abonadoCentimos: 5_000, totalOriginalCentimos: 11_800 });
    expect(v.abonos).toHaveLength(1);
    // Reusar el mismo token no repite nada.
    const otra = await dueno.herramienta('venta_corregir', { id: p.id, motivoCodigo: 'precio_acordado', fijarTotalCentimos: 10_000 }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(otra.cuerpo.ok).not.toBe(true);
    expect(await versionDe(p.id)).toBe(2);
    // El respaldo no propone nada: la deuda ya cuadra y el ajuste ya existe.
    await drenar();
    expect(await borradoresDe('deuda_ajustar', `pedido:${p.id}:v2`)).toEqual([]);
  });

  it('si el cliente pagó de más: queda a favor, la deuda queda en lo abonado y no hay devolución ni deuda por pagar', async () => {
    const { p, d } = await venta({ abonoCentimos: 11_800 });
    const { respuesta, resumen } = await corregir(dueno, { id: p.id, fijarTotalCentimos: 7_000 });
    expect(resumen).toContain('Ya pagó S/ 118.00; falta S/ 0.00; a favor del cliente S/ 48.00 (no se devuelve)');
    const r = datos(respuesta);
    expect(r).toMatchObject({ aFavorCentimos: 4_800, deuda: { totalCentimos: 11_800, abonadoCentimos: 11_800, estado: 'pagada' } });
    expect(r.ajuste).toMatchObject({ montoCentimos: 0, aFavorCentimos: 4_800 });
    expect(r.pedido.historial[0].detalle.correccion).toMatchObject({ abonadoCentimos: 11_800, aFavorCentimos: 4_800 });
    const v = await llamar(dueno, 'deuda_ver', { id: d.id });
    expect(v.totalCentimos - v.aFavorCentimos).toBe(r.pedido.totalCentimos);
    expect((await llamar(dueno, 'deudas_listar', { tipo: 'por_pagar', estado: 'todas' })).items).toEqual([]);
  });

  it('un rechazo en cualquier punto no deja nada a medias (guías, estado, nada que cambiar)', async () => {
    // El ajuste de la deuda falla (el vencimiento nuevo queda antes de la fecha de la deuda): TODO se deshace, también el pedido.
    const p0 = await llamar(dueno, 'pedido_crear', { clienteId: cliente, entregaEl: '2099-03-10', lineas: [linea('Volantes', 118)] });
    await llamar(dueno, 'pedido_confirmar', { id: p0.id });
    const d = await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: cliente, concepto: 'x', totalCentimos: 11_800, fecha: '2099-03-01', venceEn: '2099-03-10', origenTipo: 'pedido', origenId: p0.id });
    const r = await corregir(dueno, { id: p0.id, fijarTotalCentimos: 10_000, entregaEl: '2099-02-01' });
    expect(codigo(r.respuesta)).toBe('argumentos_invalidos');
    expect(await versionDe(p0.id)).toBe(1);
    expect(await contarVersiones(p0.id)).toBe(0);
    expect((await llamar(dueno, 'pedido_ver', { id: p0.id })).entregaEl).toBe('2099-03-10');
    expect((await llamar(dueno, 'deuda_ver', { id: d.id })).ajustes).toEqual([]);
    expect((await eventosDe(appPool, A, 'pedido.corregido')).filter((e) => e.carga.id === p0.id)).toEqual([]);
    // Un pedido sin cambios reales se rechaza igual en el resumen.
    const { p } = await venta({ deuda: false });
    expect(codigo((await corregir(dueno, { id: p.id, notas: null })).respuesta)).toBe('argumentos_invalidos');
  });

  it('mueve el vencimiento de la deuda con la entrega, cuando coincidían', async () => {
    const p0 = await llamar(dueno, 'pedido_crear', { clienteId: cliente, entregaEl: '2099-03-10', lineas: [linea('Volantes', 118)] });
    await llamar(dueno, 'pedido_confirmar', { id: p0.id });
    const d = await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: cliente, concepto: 'x', totalCentimos: 11_800, venceEn: '2099-03-10', origenTipo: 'pedido', origenId: p0.id });
    datos((await corregir(dueno, { id: p0.id, fijarTotalCentimos: 10_000, entregaEl: '2099-03-20' })).respuesta);
    expect(await llamar(dueno, 'deuda_ver', { id: d.id })).toMatchObject({ venceEn: '2099-03-20', totalCentimos: 10_000 });
  });

  it('cambiar el cliente: se rechaza con abonos; sin abonos mueve también el cliente de la deuda', async () => {
    const otro = (await llamar(dueno, 'clientes_crear', { nombre: 'Otro Cliente' })).id;
    const conAbono = await venta({ abonoCentimos: 1_000 });
    const rechazo = await corregir(dueno, { id: conAbono.p.id, clienteId: otro });
    expect(codigo(rechazo.respuesta)).toBe('conflicto');
    expect(rechazo.respuesta.cuerpo.error.mensaje).toMatch(/ya tiene abonos/);
    expect(await versionDe(conAbono.p.id)).toBe(1);
    const sin = await venta();
    const r = datos((await corregir(dueno, { id: sin.p.id, clienteId: otro, notas: 'Cambio de cliente' })).respuesta);
    expect(r.pedido.clienteId).toBe(otro);
    expect((await llamar(dueno, 'deuda_ver', { id: sin.d.id })).contactoId).toBe(otro);
  });

  it('actualiza el borrador deuda_crear que seguía pendiente (la deuda aún no existe)', async () => {
    const { p } = await venta({ deuda: false });
    await drenar(); // pedido.confirmado → borrador deuda_crear por S/ 118
    const [antes] = await borradoresDe('deuda_crear', `pedido:${p.id}`);
    expect(antes.args.totalCentimos).toBe(11_800);
    const r = datos((await corregir(dueno, { id: p.id, fijarTotalCentimos: 9_000 })).respuesta);
    expect(r).toMatchObject({ deuda: null, borradorActualizadoId: antes.id, ajustePendiente: false });
    const [despues] = await borradoresDe('deuda_crear', `pedido:${p.id}`);
    expect(despues).toMatchObject({ id: antes.id, corregido: true, args: { totalCentimos: 9_000 } });
    // Al aprobarlo, la deuda nace con el total corregido.
    const aprobado = datos(await dueno.herramienta('borrador_aprobar', { id: antes.id }));
    expect(aprobado.resultado.totalCentimos).toBe(9_000);
  });
});

describe('venta_corregir: permisos y umbral', () => {
  it('el trabajador corrige dentro del umbral y se le rechaza con requiere_aprobacion más allá, sin dejar nada', async () => {
    const { p, d } = await venta({ soles: 500 });
    const ok = datos((await corregir(trabajador, { id: p.id, fijarTotalCentimos: 46_000 })).respuesta);
    expect(ok.deuda.totalCentimos).toBe(46_000);
    const r = await corregir(trabajador, { id: p.id, fijarTotalCentimos: 20_000 });
    expect(codigo(r.respuesta)).toBe('requiere_aprobacion');
    expect(r.respuesta.cuerpo.error.mensaje).toContain('S/ 460.00 a S/ 200.00');
    expect(await versionDe(p.id)).toBe(2);
    expect((await llamar(dueno, 'deuda_ver', { id: d.id })).totalCentimos).toBe(46_000);
    // El dueño sí puede.
    expect(datos((await corregir(dueno, { id: p.id, fijarTotalCentimos: 20_000 })).respuesta).deuda.totalCentimos).toBe(20_000);
  });

  it('el trabajador no puede dejar excedente a favor aunque la diferencia sea chica', async () => {
    const { p } = await venta({ soles: 100, abonoCentimos: 10_000 });
    expect(codigo((await corregir(trabajador, { id: p.id, fijarTotalCentimos: 9_900 })).respuesta)).toBe('requiere_aprobacion');
    expect(await versionDe(p.id)).toBe(1);
  });

  it('sin acceso a Registro corrige el pedido y el ajuste queda como borrador (R5); el relevo no lo duplica y al aprobarlo la deuda cuadra', async () => {
    const { p, d } = await venta({ soles: 118 });
    const r = datos((await corregir(sinRegistro, { id: p.id, fijarTotalCentimos: 11_000 })).respuesta);
    expect(r).toMatchObject({ deuda: null, ajuste: null, ajustePendiente: true });
    expect(r.avisos.join(' ')).toContain('borrador');
    expect((await llamar(dueno, 'deuda_ver', { id: d.id })).totalCentimos).toBe(11_800);
    await drenar();
    await drenar();
    const propuestos = await borradoresDe('deuda_ajustar', `pedido:${p.id}:v2`);
    expect(propuestos).toHaveLength(1);
    expect(propuestos[0]).toMatchObject({ estado: 'pendiente', prioridad: 'alta', args: { id: d.id, nuevoTotalCentimos: 11_000, origenRef: `pedido:${p.id}:v2` } });
    datos(await dueno.herramienta('borrador_aprobar', { id: propuestos[0].id }));
    const v = await llamar(dueno, 'deuda_ver', { id: d.id });
    expect(v).toMatchObject({ totalCentimos: 11_000 });
    expect(v.ajustes[0].origenRef).toBe(`pedido:${p.id}:v2`);
  });

  it('el consumidor de respaldo también cubre pedido_corregir llamado a secas, solo una vez, y no propone si la deuda ya cuadra', async () => {
    const { p, d } = await venta({ soles: 118 });
    datos(await dueno.herramienta('pedido_corregir', { id: p.id, motivoCodigo: 'otro', motivoTexto: 'Directo', fijarTotalCentimos: 11_000 }));
    await drenar();
    expect(await borradoresDe('deuda_ajustar', `pedido:${p.id}:v2`)).toHaveLength(1);
    // Corrección que deja el mismo total que ya tiene la deuda: no hay nada que proponer.
    const { p: q } = await venta({ soles: 118 });
    datos(await dueno.herramienta('pedido_corregir', { id: q.id, motivoCodigo: 'igv', lineas: [{ id: q.detalle[0].id, descripcion: 'Volantes', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 118_000, afectoIgv: false }] }));
    await drenar();
    expect(await borradoresDe('deuda_ajustar', `pedido:${q.id}:v2`)).toEqual([]);
    expect(d.id).toBeTruthy();
  });

  it('otra empresa no puede corregir la venta', async () => {
    const { p } = await venta();
    expect(codigo((await corregir(ajeno, { id: p.id, fijarTotalCentimos: 11_000 })).respuesta)).toBe('no_encontrado');
  });

  it('es crítica: solo desde la pantalla, y pide confirmación', async () => {
    const { p } = await venta({ deuda: false });
    const pide = await dueno.herramienta('venta_corregir', { id: p.id, motivoCodigo: 'igv', fijarTotalCentimos: 11_000 });
    expect(pide.cuerpo.requiereConfirmacion?.token).toBeTruthy();
    expect(await versionDe(p.id)).toBe(1);
  });
});

describe('correcciones_listar: la huella visible', () => {
  it('lista quién, cuándo, motivo, antes→después, delta y el ajuste de deuda; dueño ve todas y el trabajador solo las suyas', async () => {
    const { p, d } = await venta({ soles: 200 });
    datos((await corregir(dueno, { id: p.id, fijarTotalCentimos: 18_000, motivoTexto: 'Descuento' })).respuesta);
    datos((await corregir(trabajador, { id: p.id, motivoCodigo: 'cantidad', fijarTotalCentimos: 17_000 })).respuesta);
    const todas = (await llamar(dueno, 'correcciones_listar', { pedidoId: p.id })).items;
    expect(todas.map((c: any) => [c.version, c.usuarioNombre, c.deltaCentimos, c.ajuste?.montoCentimos])).toEqual([[3, 'Trabajador', -1_000, -1_000], [2, 'Dueña', -2_000, -2_000]]);
    expect(todas[1]).toMatchObject({
      pedido: { id: p.id, codigo: p.codigo },
      motivoCodigo: 'precio_acordado',
      motivoTexto: 'Descuento',
      totalAnteriorCentimos: 20_000,
      totalNuevoCentimos: 18_000,
      resumen: expect.stringContaining('total S/ 200.00 → S/ 180.00'),
      ajuste: { deudaId: d.id, origenRef: `pedido:${p.id}:v2` },
    });
    expect(Date.parse(todas[1].creadoEn)).toBeGreaterThan(Date.now() - 120_000);
    const suyas = (await llamar(trabajador, 'correcciones_listar', { pedidoId: p.id, autorId: dueno.usuarioId })).items;
    expect(suyas.map((c: any) => c.usuarioNombre)).toEqual(['Trabajador']);
    // Sin Registro: ve la corrección propia, pero no el ajuste de la deuda.
    datos((await corregir(sinRegistro, { id: p.id, fijarTotalCentimos: 16_800 })).respuesta);
    const mias = (await llamar(sinRegistro, 'correcciones_listar', { pedidoId: p.id })).items;
    expect(mias).toHaveLength(1);
    expect(mias[0].ajuste).toBeNull();
    expect((await llamar(ajeno, 'correcciones_listar', { pedidoId: p.id })).items).toEqual([]);
  });
});
