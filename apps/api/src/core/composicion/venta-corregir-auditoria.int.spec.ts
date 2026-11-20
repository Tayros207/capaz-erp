import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { rechazo } from '@capaz/shared';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type RespuestaHttp, type Sesion } from '../herramientas/http-de-pruebas.js';
import { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { Relevo } from '../eventos/relevo.js';
import { eventosDe } from '../../modules/registro/herramientas/pruebas-de-registro.js';
import { deLaGuia, emitirGuia, pedidoListo } from '../../modules/ordenes/herramientas/pruebas-de-guias.js';

// Auditoría de «Corregir venta» (dinero): fallo en la ejecución REAL (no en el resumen) con rollback total y reintento con el
// mismo token; dos personas a la vez; reintento tras corte de red (misma clave); correcciones seguidas v2→v3→v4; deuda pagada que
// se reabre; entregado con dueño; guías; cliente con borrador pendiente; alcance «propios»; borrador viejo; autor; Mi día y precio anterior.

let app: AppDePruebas;
let appPool: pg.Pool;
let relevo: Relevo;
let ejecutor: EjecutorDeHerramientas;
let dueno: Sesion;
let trabajador: Sesion; // ordenes + registro completos, rol member
let sinRegistro: Sesion; // solo ordenes
let propio: Sesion; // ordenes completo; registro completo con alcance «propios»
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
const ver = (id: string) => llamar(dueno, 'pedido_ver', { id });
const deuda = (id: string) => llamar(dueno, 'deuda_ver', { id });

async function drenar() {
  futuro += 600_000;
  for (let i = 0; i < 400; i++) if ((await relevo.procesarLote(new Date(futuro))).reservados === 0) return;
  throw new Error('El relevo no terminó de drenar.');
}
const borradoresDe = async (herramienta: string, origenRef: string) =>
  ((await llamar(dueno, 'borradores_listar', { modulo: 'registro', limite: 100 })).items as any[]).filter((b) => b.herramienta === herramienta && b.origenRef === origenRef);

async function venta(o: { soles?: number; abono?: number; deuda?: boolean; entregaEl?: string; lineas?: unknown[] } = {}) {
  const soles = o.soles ?? 118;
  const p = await llamar(dueno, 'pedido_crear', { clienteId: cliente, lineas: o.lineas ?? [linea('Volantes', soles)], ...(o.entregaEl && { entregaEl: o.entregaEl }) });
  await llamar(dueno, 'pedido_confirmar', { id: p.id });
  const pedido = await ver(p.id);
  let d: any = null;
  if (o.deuda !== false) {
    d = await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: cliente, concepto: `Pedido ${p.codigo}`, totalCentimos: pedido.totalCentimos, origenTipo: 'pedido', origenId: p.id });
    if (o.abono) await llamar(dueno, 'deuda_abonar', { id: d.id, montoCentimos: o.abono });
  }
  return { p: pedido, d };
}
/** Pide el resumen sobre la versión vigente; devuelve los argumentos completos, el token (si lo dio) y la respuesta. */
async function pedir(s: Sesion, args: Record<string, unknown>) {
  const completos = { motivoCodigo: 'precio_acordado', versionEsperada: (await ver(args.id as string)).version, ...args };
  const r = await s.herramienta('venta_corregir', completos);
  return { completos, r, token: r.cuerpo?.requiereConfirmacion?.token as string | undefined };
}
async function pedirToken(s: Sesion, args: Record<string, unknown>) {
  const { completos, r, token } = await pedir(s, args);
  if (!token) throw new Error(`Sin token: ${JSON.stringify(r.cuerpo)}`);
  return { completos, token };
}
/** Pide y confirma; si el resumen ya se rechaza, devuelve ese rechazo. */
const corregir = async (s: Sesion, args: Record<string, unknown>) => {
  const { completos, r, token } = await pedir(s, args);
  return token ? s.herramienta('venta_corregir', completos, { confirmacion: token }) : r;
};
const cuadra = async (pedidoId: string, deudaId: string) => {
  const [p, d] = [await ver(pedidoId), await deuda(deudaId)];
  expect(d.totalCentimos - d.aFavorCentimos).toBe(p.totalCentimos);
  expect(d.abonadoCentimos).toBeLessThanOrEqual(d.totalCentimos);
  return { p, d };
};
const filasDe = (sqlTexto: string, params: unknown[]) => comoEmpresa(appPool, A, async (c) => (await c.query(sqlTexto, params)).rows);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  relevo = app.obtener(Relevo);
  ejecutor = app.obtener(EjecutorDeHerramientas);
  [dueno, trabajador, sinRegistro, propio] = await Promise.all(['Dueña', 'Trabajador', 'Sin registro', 'Propio'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Empresa de auditoría de correcciones');
  await Promise.all(['ordenes', 'registro'].map((m) => activarModulo(A, m)));
  await agregarMiembro(app, A, trabajador, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, A, sinRegistro, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  await agregarMiembro(app, A, propio, { modulo: 'ordenes', nivel: 'completo', alcance: 'todos' });
  const dar = (s: Sesion, alcance: string) => comoEmpresa(appPool, A, (c) => c.query(`insert into core.usuario_modulos (tenant_id, usuario_id, modulo, nivel, alcance) values ($1, $2, 'registro', 'completo', $3)`, [A, s.usuarioId, alcance]), { confirmar: true });
  await dar(trabajador, 'todos');
  await dar(propio, 'propios');
  cliente = (await llamar(dueno, 'clientes_crear', { nombre: 'Botica Auditada' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('atomicidad: el fallo en la ejecución real lo deshace todo', () => {
  /** Devuelve cómo respondió cada `deuda_ajustar` que sí corrió (las simuladas del resumen) antes de la que se hizo fallar. */
  async function conFalloEnElAjusteReal(falla: () => never | Promise<unknown>, fn: () => Promise<void>): Promise<boolean[]> {
    const original = ejecutor.ejecutarDentro.bind(ejecutor);
    const previas: boolean[] = [];
    let ajustes = 0;
    // Con el token ya pedido, la confirmación llama dos veces a `deuda_ajustar`: 1.ª en el resumen que se repite (simulado,
    // se deshace), 2.ª en la ejecución real. Falla solo la real: el resumen simulado pasó y la huella coincide.
    ejecutor.ejecutarDentro = (async (tx, nombre, args, op) => {
      if (nombre !== 'deuda_ajustar') return original(tx, nombre, args, op);
      if (++ajustes === 2) return falla();
      const r = await original(tx, nombre, args, op);
      previas.push(r.ok);
      return r;
    }) as typeof ejecutor.ejecutarDentro;
    try {
      await fn();
    } finally {
      ejecutor.ejecutarDentro = original;
    }
    return previas;
  }

  for (const [caso, falla] of [
    ['una excepción (la base se cae)', () => { throw new Error('caída forzada'); }],
    ['un rechazo del ajuste', async () => rechazo('conflicto', 'rechazo forzado')],
  ] as const) {
    it(`${caso}: pedido, versión, deuda, ajuste, evento y token quedan como estaban; el mismo token vale después`, async () => {
      const { p, d } = await venta({ abono: 5_000 });
      const { completos, token } = await pedirToken(dueno, { id: p.id, fijarTotalCentimos: 10_000 });
      const simuladas = await conFalloEnElAjusteReal(falla as () => never, async () => {
        const r = await dueno.herramienta('venta_corregir', completos, { confirmacion: token });
        expect(r.cuerpo.ok).toBe(false);
        expect(['error_interno', 'conflicto']).toContain(codigo(r));
      });
      // El resumen (simulado) del mismo paso salió bien: lo que falló fue la ejecución real, después de gastar el token.
      expect(simuladas).toEqual([true]);
      expect(await ver(p.id)).toMatchObject({ version: 1, totalCentimos: 11_800 });
      expect(await filasDe('select 1 from ordenes.pedido_versiones where pedido_id = $1', [p.id])).toEqual([]);
      expect(await deuda(d.id)).toMatchObject({ totalCentimos: 11_800, abonadoCentimos: 5_000, ajustes: [] });
      expect((await eventosDe(appPool, A, 'pedido.corregido')).filter((e) => e.carga.id === p.id)).toEqual([]);
      // El token no se gastó: la misma confirmación sirve una vez, ya sin la falla.
      const ok = datos(await dueno.herramienta('venta_corregir', completos, { confirmacion: token }));
      expect(ok.pedido).toMatchObject({ version: 2, totalCentimos: 10_000 });
      await cuadra(p.id, d.id);
    });
  }

  it('reintento tras corte de red (misma clave): devuelve lo ya guardado, sin una versión 3 ni un segundo ajuste', async () => {
    const { p, d } = await venta({ abono: 2_000 });
    const { completos, token } = await pedirToken(dueno, { id: p.id, fijarTotalCentimos: 10_500 });
    const primera = datos(await dueno.herramienta('venta_corregir', completos, { confirmacion: token, clave: `corte-${p.id}` }));
    const repetida = datos(await dueno.herramienta('venta_corregir', completos, { confirmacion: token, clave: `corte-${p.id}` }));
    expect(repetida.pedido.version).toBe(2);
    expect(repetida.ajuste.id).toBe(primera.ajuste.id);
    expect((await deuda(d.id)).ajustes).toHaveLength(1);
    // Sin la clave, el mismo token ya no vale (un solo uso) y nada cambia.
    expect((await dueno.herramienta('venta_corregir', completos, { confirmacion: token })).cuerpo.ok).toBe(false);
    expect((await ver(p.id)).version).toBe(2);
  });
});

describe('dos personas a la vez', () => {
  it('ambas confirman sobre la v1 al mismo tiempo: una gana, la otra se rechaza; la deuda queda con UN ajuste y cuadra', async () => {
    for (let vuelta = 0; vuelta < 3; vuelta++) {
      const { p, d } = await venta({ soles: 500 });
      const a = await pedirToken(dueno, { id: p.id, fijarTotalCentimos: 47_000 });
      const b = await pedirToken(trabajador, { id: p.id, fijarTotalCentimos: 46_000 });
      const [ra, rb] = await Promise.all([
        dueno.herramienta('venta_corregir', a.completos, { confirmacion: a.token }),
        trabajador.herramienta('venta_corregir', b.completos, { confirmacion: b.token }),
      ]);
      expect([ra.cuerpo.ok, rb.cuerpo.ok].filter(Boolean)).toHaveLength(1);
      const perdedora = ra.cuerpo.ok ? rb : ra;
      expect(['conflicto', 'confirmacion_desactualizada']).toContain(codigo(perdedora));
      const { p: fin, d: dv } = await cuadra(p.id, d.id);
      expect(fin.version).toBe(2);
      expect(dv.ajustes).toHaveLength(1);
    }
  });
});

describe('dinero: correcciones seguidas, saldo a favor y deuda pagada', () => {
  it('v2→v3→v4: el excedente a favor sube y baja, la suma de ajustes cuadra con el total original y lo abonado no se toca', async () => {
    const { p, d } = await venta({ abono: 10_000 });
    const pasos: Array<[number, number, number, number]> = [
      // [total del pedido, total de la deuda, a favor, monto del ajuste]
      [8_000, 10_000, 2_000, -1_800],
      [9_000, 10_000, 1_000, 0],
      [15_000, 15_000, 0, 5_000],
    ];
    for (const [total, totalDeuda, aFavor, monto] of pasos) {
      const r = datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: total }));
      expect(r).toMatchObject({ aFavorCentimos: aFavor, ajuste: { montoCentimos: monto, aFavorCentimos: aFavor }, deuda: { totalCentimos: totalDeuda, abonadoCentimos: 10_000 } });
      await cuadra(p.id, d.id);
    }
    const v = await deuda(d.id);
    expect(v).toMatchObject({ totalOriginalCentimos: 11_800, totalCentimos: 15_000, saldoCentimos: 5_000, estado: 'parcial', aFavorCentimos: 0 });
    expect(v.ajustes.map((x: any) => x.origenRef)).toEqual([4, 3, 2].map((n) => `pedido:${p.id}:v${n}`));
    expect(v.ajustes.reduce((s: number, x: any) => s + x.montoCentimos, 0)).toBe(15_000 - 11_800);
    expect(v.abonos).toHaveLength(1);
    expect((await llamar(dueno, 'deudas_listar', { tipo: 'por_pagar', estado: 'todas' })).items).toEqual([]);
  });

  it('una deuda ya pagada del todo: subir el precio la reabre con el saldo exacto', async () => {
    const { p, d } = await venta({ abono: 11_800 });
    expect((await deuda(d.id)).estado).toBe('pagada');
    const r = datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 12_390 }));
    expect(r.deuda).toMatchObject({ totalCentimos: 12_390, abonadoCentimos: 11_800, saldoCentimos: 590, estado: 'parcial' });
    await cuadra(p.id, d.id);
  });

  it('el trabajador corrige con éxito dentro del límite; un pedido que ya tenía saldo a favor admite subirlo o cambiar la entrega', async () => {
    const { p, d } = await venta({ soles: 500, abono: 50_000 });
    datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 45_000 })); // el dueño deja S/ 50 a favor
    const r = datos(await corregir(trabajador, { id: p.id, fijarTotalCentimos: 47_000, motivoCodigo: 'cantidad' }));
    expect(r).toMatchObject({ aFavorCentimos: 3_000, pedido: { version: 3 } });
    expect(datos(await corregir(trabajador, { id: p.id, entregaEl: '2099-01-15', motivoCodigo: 'otro', motivoTexto: 'Otra fecha' })).pedido.version).toBe(4);
    expect(codigo(await corregir(trabajador, { id: p.id, fijarTotalCentimos: 46_900 }))).toBe('requiere_aprobacion');
    await cuadra(p.id, d.id);
  });

  it('sin deuda (nunca se creó) o con la deuda anulada: corrige el pedido y no toca Finanzas', async () => {
    const sin = await venta({ deuda: false });
    expect(datos(await corregir(dueno, { id: sin.p.id, fijarTotalCentimos: 9_000 }))).toMatchObject({ deuda: null, ajuste: null, aFavorCentimos: 0 });
    const conAnulada = await venta();
    datos(await (async () => {
      const pide = await dueno.herramienta('deuda_anular', { id: conAnulada.d.id, motivo: 'Prueba' });
      return dueno.herramienta('deuda_anular', { id: conAnulada.d.id, motivo: 'Prueba' }, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    })());
    expect(datos(await corregir(dueno, { id: conAnulada.p.id, fijarTotalCentimos: 9_000 }))).toMatchObject({ deuda: null, ajuste: null });
    expect(await deuda(conAnulada.d.id)).toMatchObject({ estado: 'anulada', totalCentimos: 11_800, ajustes: [] });
  });
});

describe('estados, guías y cliente', () => {
  it('entregado: el dueño corrige el precio y la deuda lo sigue; el trabajador no', async () => {
    const { p, d } = await venta({ abono: 5_000 });
    await llamar(dueno, 'pedido_cambiar_estado', { id: p.id, estado: 'entregado' });
    expect(codigo(await corregir(trabajador, { id: p.id, fijarTotalCentimos: 11_700 }))).toBe('sin_permiso');
    expect(codigo(await corregir(dueno, { id: p.id, fijarTotalCentimos: 11_000, entregaEl: '2099-01-01' }))).toBe('conflicto');
    const r = datos(await corregir(dueno, { id: p.id, motivoCodigo: 'igv', fijarTotalCentimos: 10_000 }));
    expect(r.pedido).toMatchObject({ estado: 'entregado', version: 2, totalCentimos: 10_000 });
    await cuadra(p.id, d.id);
  });

  it('guías emitidas: quitar la línea o bajar de lo enviado se rechaza sin dejar nada; el precio sí cambia y la deuda lo sigue', async () => {
    const p = await pedidoListo(dueno, cliente, [['Tarjetas', 10, 5], ['Sobres', 2, 10]]);
    const d = await llamar(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: cliente, concepto: 'x', totalCentimos: p.totalCentimos, origenTipo: 'pedido', origenId: p.id });
    datos(await emitirGuia(dueno, cliente, [deLaGuia(p, 3_000, 0), deLaGuia(p, 1_000, 1)]));
    const l = (i: number, extra: Record<string, unknown> = {}) => ({ id: p.detalle[i].id, descripcion: p.detalle[i].descripcion, unidad: p.detalle[i].unidad, cantidadMilesimas: p.detalle[i].cantidadMilesimas, precioUnitarioMilesimas: p.detalle[i].precioUnitarioMilesimas, afectoIgv: p.detalle[i].afectoIgv, ...extra });
    expect(codigo(await dueno.herramienta('venta_corregir', { id: p.id, versionEsperada: 1, motivoCodigo: 'lineas', lineas: [l(0)] }))).toBe('conflicto');
    expect(codigo(await dueno.herramienta('venta_corregir', { id: p.id, versionEsperada: 1, motivoCodigo: 'cantidad', lineas: [l(0, { cantidadMilesimas: 2_000 }), l(1)] }))).toBe('conflicto');
    expect((await ver(p.id)).version).toBe(1);
    expect((await deuda(d.id)).ajustes).toEqual([]);
    const r = datos(await corregir(dueno, { id: p.id, lineas: [l(0, { precioUnitarioMilesimas: 12_000 }), l(1)] }));
    expect(r.pedido.totalCentimos).toBe(5 * 1_200 + 10 * 200);
    expect(r.avisos.join(' ')).toContain('guías de remisión');
    await cuadra(p.id, d.id);
  });

  it('cambio de cliente con la deuda aún en la bandeja: la propuesta de cobro pasa al cliente nuevo y al total nuevo', async () => {
    const otro = (await llamar(dueno, 'clientes_crear', { nombre: 'Cliente Nuevo SAC' })).id;
    const { p } = await venta({ deuda: false });
    await drenar(); // pedido.confirmado → borrador deuda_crear
    datos(await corregir(dueno, { id: p.id, clienteId: otro, fijarTotalCentimos: 10_000 }));
    const [b] = await borradoresDe('deuda_crear', `pedido:${p.id}`);
    expect(b.args).toMatchObject({ contactoId: otro, totalCentimos: 10_000 });
    expect((await ver(p.id)).versiones[0].foto.clienteNombre).toBe('Botica Auditada');
  });

  it('quien no ve Finanzas corrige antes de que exista la deuda: el respaldo pone al día la propuesta de cobro (no nace con el total viejo)', async () => {
    const { p } = await venta({ deuda: false });
    await drenar();
    datos(await corregir(sinRegistro, { id: p.id, fijarTotalCentimos: 11_000 }));
    await drenar();
    const [b] = await borradoresDe('deuda_crear', `pedido:${p.id}`);
    expect(b).toMatchObject({ estado: 'pendiente', args: { totalCentimos: 11_000, contactoId: cliente } });
    expect(b.resumen).toContain('S/ 110.00');
    expect(datos(await dueno.herramienta('borrador_aprobar', { id: b.id })).resultado.totalCentimos).toBe(11_000);
  });

  it('alcance «propios» en Finanzas: no ver la deuda no es «no tiene abonos» (no cambia el cliente de un pedido ya pagado)', async () => {
    const otro = (await llamar(dueno, 'clientes_crear', { nombre: 'Cliente Ajeno' })).id;
    const { p, d } = await venta({ abono: 11_800 });
    const r = await corregir(propio, { id: p.id, clienteId: otro });
    expect(codigo(r)).toBe('conflicto');
    expect((await ver(p.id))).toMatchObject({ version: 1, clienteId: cliente });
    expect((await deuda(d.id)).contactoId).toBe(cliente);
  });
});

describe('borradores viejos y la huella', () => {
  it('el ajuste propuesto para la v2 no se aplica si la deuda ya se ajustó con la v3 (ni el respaldo lo propone tarde)', async () => {
    const { p, d } = await venta();
    datos(await corregir(sinRegistro, { id: p.id, fijarTotalCentimos: 11_000 })); // v2, sin Finanzas
    await drenar();
    const [viejo] = await borradoresDe('deuda_ajustar', `pedido:${p.id}:v2`);
    datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 10_000 })); // v3, ajusta la deuda
    const r = await dueno.herramienta('borrador_aprobar', { id: viejo.id });
    expect(codigo(r)).toBe('conflicto');
    expect(r.cuerpo.error.mensaje).toMatch(/versión 2 .* versión 3/);
    await cuadra(p.id, d.id);
    // Respaldo que llega tarde: v4 sin Finanzas y v5 del dueño antes de que corra el relevo.
    datos(await corregir(sinRegistro, { id: p.id, fijarTotalCentimos: 9_900 }));
    datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 9_500 }));
    await drenar();
    expect(await borradoresDe('deuda_ajustar', `pedido:${p.id}:v4`)).toEqual([]);
    expect((await deuda(d.id)).totalCentimos).toBe(9_500);
  });

  it('alguien baja el precio sin Finanzas, el dueño lo devuelve (la deuda ya cuadra): aprobar tarde la propuesta vieja no la hace retroceder', async () => {
    const { p, d } = await venta();
    datos(await corregir(sinRegistro, { id: p.id, fijarTotalCentimos: 11_000 })); // v2: propuesta de bajar a S/ 110
    await drenar();
    const [vieja] = await borradoresDe('deuda_ajustar', `pedido:${p.id}:v2`);
    expect(vieja.args.nuevoTotalCentimos).toBe(11_000);
    datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 11_800 })); // v3: vuelve a S/ 118; la deuda ya cuadra, no hay ajuste
    await drenar();
    const [puesta] = await borradoresDe('deuda_ajustar', `pedido:${p.id}:v2`);
    expect(puesta.args.nuevoTotalCentimos).toBe(11_800);
    expect(codigo(await dueno.herramienta('borrador_aprobar', { id: vieja.id }))).toBe('argumentos_invalidos'); // nada que ajustar
    expect(await deuda(d.id)).toMatchObject({ totalCentimos: 11_800, ajustes: [] });
    await cuadra(p.id, d.id);
  });

  it('correcciones_listar filtra por autor con el id que da la lista de miembros (personaId = usuarioId)', async () => {
    const { p } = await venta({ soles: 300 });
    datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 29_000 }));
    datos(await corregir(trabajador, { id: p.id, fijarTotalCentimos: 28_500 }));
    const miembros = (await llamar(dueno, 'miembros_listar', {})).miembros as any[];
    const delTrabajador = miembros.find((m) => m.nombre === 'Trabajador').personaId;
    expect(delTrabajador).toBe(trabajador.usuarioId);
    const suyas = (await llamar(dueno, 'correcciones_listar', { pedidoId: p.id, autorId: delTrabajador })).items;
    expect(suyas.map((c: any) => [c.usuarioNombre, c.version, c.ajuste?.montoCentimos])).toEqual([['Trabajador', 3, -500]]);
  });

  it('Mi día y el precio anterior ven lo vigente: «Debe» con el saldo ajustado y el precio corregido', async () => {
    const hoy = (await ver((await venta({ deuda: false })).p.id)).fecha;
    const { p, d } = await venta({ abono: 3_000, entregaEl: hoy, lineas: [linea('Folletos auditados', 118)] });
    datos(await corregir(dueno, { id: p.id, fijarTotalCentimos: 10_000 }));
    const mi = await llamar(dueno, 'mi_dia_ver', {});
    const tarjeta = (mi.grupos as any[]).flatMap((g) => g.tarjetas).find((t: any) => t.entidad.id === p.id);
    expect(tarjeta?.notas ?? []).toContainEqual(expect.objectContaining({ texto: 'Debe S/ 70.00' }));
    expect((await deuda(d.id)).saldoCentimos).toBe(7_000);
    const precio = await llamar(dueno, 'precio_anterior_consultar', { clienteId: cliente, texto: 'Folletos auditados' });
    expect(precio.ultimo).toMatchObject({ fuente: 'pedido', precioUnitarioMilesimas: 100_000 });
  });
});
