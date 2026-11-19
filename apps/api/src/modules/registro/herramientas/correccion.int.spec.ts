import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, confirmando, datosDe, diaMas, eventosDe, HOY } from './pruebas-de-registro.js';

// Corregir y restaurar movimientos por HTTP real (ADR-012: el original se anula y se registra uno nuevo; restaurar reactiva).

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let lector: Sesion;
let vendedor: Sesion; // registro completo con alcance «propios»
let ajeno: Sesion;
let A: string;
let contacto: string;

const registrar = (s: Sesion, args: Record<string, unknown> = {}) => datosDe(s, 'movimiento_registrar', { tipo: 'egreso', montoCentimos: 35_000, descripcion: 'Tinta', ...args });
const corregir = (s: Sesion, id: string, cambios: Record<string, unknown>) => confirmando(s, 'movimiento_corregir', { id, ...cambios });
const restaurar = (s: Sesion, id: string) => confirmando(s, 'movimiento_restaurar', { id });
const ver = (s: Sesion, id: string) => datosDe(s, 'movimiento_ver', { id });
const saldoCaja = async () => (await datosDe(dueno, 'cuentas_listar')).items.find((c: any) => c.esPrincipal).saldoCentimos as number;
const activos = (s: Sesion = dueno) => datosDe(s, 'movimientos_listar', { estado: 'activos' }).then((r) => r.items as any[]);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, lector, vendedor, ajeno] = await Promise.all(['Dueña', 'Lector', 'Vendedora', 'Ajena'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Corrección A');
  await crearEmpresa(ajeno, 'Corrección B');
  await agregarMiembro(app, A, lector, { modulo: 'registro', nivel: 'lectura', alcance: 'todos' });
  await agregarMiembro(app, A, vendedor, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  contacto = (await datosDe(dueno, 'clientes_crear', { nombre: 'Imprenta Sur' })).id;
});
afterAll(async () => {
  await app.cerrar();
  await appPool.end();
});

describe('movimiento_corregir', () => {
  it('pide confirmación con el detalle y no cambia nada hasta confirmar', async () => {
    const m = await registrar(dueno);
    const pide = await dueno.herramienta('movimiento_corregir', { id: m.id, montoCentimos: 38_000 });
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain('S/ 350.00 → S/ 380.00');
    expect((await ver(dueno, m.id)).estado).toBe('activo');
    expect((await ver(dueno, m.id)).corregible).toBe(true);
  });

  it('anula el original, registra uno nuevo con la raíz enlazada y deja el saldo y los eventos coherentes', async () => {
    const antes = await saldoCaja();
    const m = await registrar(dueno, { descripcion: 'Papel couché' });
    expect(await saldoCaja()).toBe(antes - 35_000);
    const { respuesta } = await corregir(dueno, m.id, { montoCentimos: 38_000, contactoId: contacto, fecha: diaMas(-1) });
    expect(respuesta.estado).toBe(200);
    const { anulado, nuevo } = respuesta.cuerpo.datos;
    expect(anulado).toMatchObject({ id: m.id, estado: 'anulado', reemplazadoPor: { id: nuevo.id, codigo: nuevo.codigo } });
    expect(anulado.motivoAnulacion).toContain('Corregido: monto S/ 350.00 → S/ 380.00');
    expect(nuevo).toMatchObject({ tipo: 'egreso', montoCentimos: 38_000, contactoId: contacto, fecha: diaMas(-1), descripcion: 'Papel couché', estado: 'activo', correccionDe: m.id, creadoPor: m.creadoPor });
    expect(nuevo.numero).toBe(m.numero + 1);
    // Solo cuenta el nuevo: ni doble conteo ni hueco en el saldo.
    expect(await saldoCaja()).toBe(antes - 38_000);
    expect((await activos()).filter((x) => x.id === m.id)).toEqual([]);
    const tipos = (await eventosDe(appPool, A)).map((e) => e.tipo);
    expect(tipos.slice(-2)).toEqual(['movimiento.anulado', 'movimiento.registrado']);
  });

  it('quitar el contacto y la descripción con null; una corrección se puede corregir otra vez y comparte la raíz', async () => {
    const m = await registrar(dueno, { contactoId: contacto });
    const primera = (await corregir(dueno, m.id, { contactoId: null, descripcion: null })).respuesta.cuerpo.datos.nuevo;
    expect(primera).toMatchObject({ contactoId: null, descripcion: null, correccionDe: m.id });
    const segunda = (await corregir(dueno, primera.id, { montoCentimos: 1_000 })).respuesta.cuerpo.datos.nuevo;
    expect(segunda.correccionDe).toBe(m.id);
    expect(await ver(dueno, m.id)).toMatchObject({ estado: 'anulado', reemplazadoPor: { id: segunda.id } });
    expect(await ver(dueno, primera.id)).toMatchObject({ estado: 'anulado', reemplazadoPor: { id: segunda.id } });
  });

  it('rechaza lo que no se corrige: sin cambios, categoría del otro tipo, fecha futura y el origen reservado', async () => {
    const m = await registrar(dueno);
    const categorias = (await datosDe(dueno, 'categorias_listar', {})).items;
    const deIngreso = categorias.find((c: any) => c.tipo === 'ingreso');
    const rSin = await corregir(dueno, m.id, { montoCentimos: 35_000 });
    expect(codigoDe(rSin.respuesta)).toBe('argumentos_invalidos');
    expect(codigoDe((await corregir(dueno, m.id, { categoriaId: deIngreso.id })).respuesta)).toBe('argumentos_invalidos');
    expect(codigoDe((await corregir(dueno, m.id, { fecha: diaMas(3) })).respuesta)).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('movimiento_registrar', { tipo: 'egreso', montoCentimos: 100, origenRef: `correccion:${m.id}` }))).toBe('argumentos_invalidos');
    expect((await ver(dueno, m.id)).estado).toBe('activo');
  });

  it('no corrige transferencias ni abonos de deuda', async () => {
    const otra = await datosDe(dueno, 'cuenta_crear', { nombre: 'Banco', tipo: 'banco' });
    const caja = (await datosDe(dueno, 'cuentas_listar')).items.find((c: any) => c.esPrincipal);
    const t = await datosDe(dueno, 'cuentas_transferir', { origenId: caja.id, destinoId: otra.id, montoCentimos: 500 });
    expect((await ver(dueno, t.egreso.id)).corregible).toBe(false);
    expect(codigoDe((await corregir(dueno, t.egreso.id, { montoCentimos: 900 })).respuesta)).toBe('conflicto');
    const deuda = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Letrero', totalCentimos: 10_000 });
    const abono = (await datosDe(dueno, 'deuda_abonar', { id: deuda.id, montoCentimos: 4_000 })).movimiento;
    expect((await ver(dueno, abono.id)).corregible).toBe(false);
    expect(codigoDe((await corregir(dueno, abono.id, { montoCentimos: 5_000 })).respuesta)).toBe('conflicto');
  });

  it('con alcance «propios»: corrige lo suyo, no ve lo ajeno, y el dueño al corregir no se lo quita', async () => {
    const suyo = await registrar(vendedor, { descripcion: 'De la vendedora' });
    const delDueno = await registrar(dueno);
    expect(codigoDe((await corregir(vendedor, delDueno.id, { montoCentimos: 1 })).respuesta)).toBe('no_encontrado');
    const nuevo = (await corregir(dueno, suyo.id, { montoCentimos: 2_000 })).respuesta.cuerpo.datos.nuevo;
    expect(nuevo.creadoPor).toBe(vendedor.usuarioId);
    expect((await activos(vendedor)).map((x) => x.id)).toContain(nuevo.id);
  });

  it('un lector recibe solo lectura y otra empresa no ve el movimiento', async () => {
    const m = await registrar(dueno);
    expect(codigoDe(await lector.herramienta('movimiento_corregir', { id: m.id, montoCentimos: 1 }))).toBe('modulo_solo_lectura');
    expect(codigoDe(await ajeno.herramienta('movimiento_corregir', { id: m.id, montoCentimos: 1 }))).toBe('no_encontrado');
  });
});

describe('movimiento_restaurar', () => {
  it('saca de la papelera un movimiento suelto: vuelve a activo, cuenta en el saldo y emite su evento', async () => {
    const m = await registrar(dueno);
    const antes = await saldoCaja();
    await confirmando(dueno, 'movimiento_anular', { id: m.id, motivo: 'Por error' });
    expect(await saldoCaja()).toBe(antes + 35_000);
    const { respuesta } = await restaurar(dueno, m.id);
    expect(respuesta.estado).toBe(200);
    expect(respuesta.cuerpo.datos).toMatchObject({ id: m.id, estado: 'activo', anuladoEn: null, motivoAnulacion: null });
    expect(await saldoCaja()).toBe(antes);
    const evento = (await eventosDe(appPool, A, 'movimiento.restaurado')).at(-1);
    expect(evento?.carga).toMatchObject({ id: m.id, tipo: 'egreso', montoCentimos: 35_000, deudaId: null });
    expect(codigoDe((await restaurar(dueno, m.id)).respuesta)).toBe('conflicto');
  });

  it('no restaura si ya hay una versión vigente de su cadena, aunque se haya corregido dos veces', async () => {
    const m1 = await registrar(dueno);
    const m2 = (await corregir(dueno, m1.id, { montoCentimos: 1_000 })).respuesta.cuerpo.datos.nuevo;
    const m3 = (await corregir(dueno, m2.id, { montoCentimos: 2_000 })).respuesta.cuerpo.datos.nuevo;
    for (const id of [m1.id, m2.id]) {
      const r = await restaurar(dueno, id);
      expect(codigoDe(r.respuesta), id).toBe('conflicto');
      expect(r.respuesta.cuerpo.error.mensaje).toContain(m3.codigo);
    }
    // Al anular la vigente, queda libre restaurar una de las anteriores, y entonces ya no las demás.
    await confirmando(dueno, 'movimiento_anular', { id: m3.id, motivo: 'No va' });
    expect((await restaurar(dueno, m1.id)).respuesta.estado).toBe(200);
    expect(codigoDe((await restaurar(dueno, m2.id)).respuesta)).toBe('conflicto');
    expect(codigoDe((await corregir(dueno, m2.id, { montoCentimos: 5 })).respuesta)).toBe('conflicto');
  });

  it('un abono vuelve a descontarse del saldo de su deuda; si ya no cabe, no se restaura', async () => {
    const deuda = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Roll up', totalCentimos: 10_000 });
    const abono = (await datosDe(dueno, 'deuda_abonar', { id: deuda.id, montoCentimos: 6_000 })).movimiento;
    await confirmando(dueno, 'movimiento_anular', { id: abono.id, motivo: 'Se anotó mal' });
    expect((await datosDe(dueno, 'deuda_ver', { id: deuda.id })).saldoCentimos).toBe(10_000);
    // Otro abono ocupa el saldo: el anulado de 6.000 ya no cabe.
    await datosDe(dueno, 'deuda_abonar', { id: deuda.id, montoCentimos: 7_000 });
    const rechazo = await restaurar(dueno, abono.id);
    expect(codigoDe(rechazo.respuesta)).toBe('conflicto');
    expect((await ver(dueno, abono.id)).estado).toBe('anulado');
  });

  it('un abono que cabe justo salda la deuda y emite deuda.pagada', async () => {
    const deuda = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: contacto, concepto: 'Sellos', totalCentimos: 8_000 });
    const abono = (await datosDe(dueno, 'deuda_abonar', { id: deuda.id, montoCentimos: 8_000 })).movimiento;
    await confirmando(dueno, 'movimiento_anular', { id: abono.id, motivo: 'Duplicado' });
    expect((await restaurar(dueno, abono.id)).respuesta.estado).toBe(200);
    expect(await datosDe(dueno, 'deuda_ver', { id: deuda.id })).toMatchObject({ estado: 'pagada', saldoCentimos: 0 });
    const pagadas = (await eventosDe(appPool, A, 'deuda.pagada')).filter((e) => e.carga.id === deuda.id);
    expect(pagadas).toHaveLength(2);
  });

  it('no restaura transferencias; con alcance «propios» solo restaura quien anuló', async () => {
    const otra = (await datosDe(dueno, 'cuentas_listar')).items.find((c: any) => !c.esPrincipal);
    const caja = (await datosDe(dueno, 'cuentas_listar')).items.find((c: any) => c.esPrincipal);
    const t = await datosDe(dueno, 'cuentas_transferir', { origenId: caja.id, destinoId: otra.id, montoCentimos: 300 });
    await confirmando(dueno, 'movimiento_anular', { id: t.egreso.id, motivo: 'Mal destino' });
    expect(codigoDe((await restaurar(dueno, t.egreso.id)).respuesta)).toBe('conflicto');

    const suyo = await registrar(vendedor);
    await confirmando(dueno, 'movimiento_anular', { id: suyo.id, motivo: 'Lo anula la dueña' });
    expect(codigoDe((await restaurar(vendedor, suyo.id)).respuesta)).toBe('sin_permiso');
    expect((await restaurar(dueno, suyo.id)).respuesta.estado).toBe(200);
  });

  it('el movimiento de HOY queda en los reportes una sola vez tras corregir y restaurar', async () => {
    const antes = (await datosDe(dueno, 'registro_resumen', { desde: HOY.dia, hasta: HOY.dia })).egresosCentimos as number;
    const m = await registrar(dueno, { montoCentimos: 1_000 });
    const nuevo = (await corregir(dueno, m.id, { montoCentimos: 1_500 })).respuesta.cuerpo.datos.nuevo;
    expect((await datosDe(dueno, 'registro_resumen', { desde: HOY.dia, hasta: HOY.dia })).egresosCentimos).toBe(antes + 1_500);
    await confirmando(dueno, 'movimiento_anular', { id: nuevo.id, motivo: 'Fuera' });
    await restaurar(dueno, m.id);
    expect((await datosDe(dueno, 'registro_resumen', { desde: HOY.dia, hasta: HOY.dia })).egresosCentimos).toBe(antes + 1_000);
    const filas = await comoEmpresa(appPool, A, async (c) => Number((await c.query(`select count(*) from registro.movimientos where estado = 'activo' and (id = $1 or origen_ref = $2)`, [m.id, `correccion:${m.id}`])).rows[0].count));
    expect(filas).toBe(1);
  });
});
