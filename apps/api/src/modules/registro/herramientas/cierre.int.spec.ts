import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { semanaDe, sumarDias } from '@capaz/shared';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { diaMas, hoyDePrueba } from '../../../pruebas/fechas.js';
import { codigoDe, confirmando, datosDe } from './pruebas-de-registro.js';

// Cierre semanal por HTTP real: revisar, cerrar con y sin diferencias, rechazos, huella y aislamiento. Nombres inventados.

let app: AppDePruebas;
let dueno: Sesion;
let propio: Sesion;
let ajeno: Sesion;
let caja: string;
let banco: string;

/** Lunes de una semana ya terminada, `n` semanas atrás (cada prueba usa la suya: un cierre no se repite). */
const lunes = (n: number) => semanaDe(diaMas(-7 * n)).desde;
const sabado = (desde: string) => sumarDias(desde, 5);
const movimiento = (tipo: 'ingreso' | 'egreso', montoCentimos: number, fecha: string, extra: Record<string, unknown> = {}) =>
  datosDe(dueno, 'movimiento_registrar', { tipo, montoCentimos, fecha, cuentaId: caja, ...extra });
const conteos = (c: number, b: number, explicacion?: string) => [
  { cuentaId: caja, contadoCentimos: c, ...(explicacion && { explicacion }) },
  { cuentaId: banco, contadoCentimos: b },
];
const revisar = (desde: string, sesion = dueno) => datosDe(sesion, 'semana_revisar', { fecha: desde });
const cuentaDe = (r: any, id: string) => r.cuentas.find((c: any) => c.cuentaId === id);
async function cerrar(desde: string, cs: unknown[], notas?: string) {
  const r = await confirmando(dueno, 'semana_cerrar', { desde, conteos: cs, ...(notas && { notas }) });
  return { ...r, datos: r.respuesta.cuerpo?.datos };
}
const mensaje = async (desde: string, cs: unknown[]) => {
  const r = await dueno.herramienta('semana_cerrar', { desde, conteos: cs });
  return { codigo: codigoDe(r), mensaje: r.cuerpo?.error?.mensaje as string | undefined };
};

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, propio, ajeno] = await Promise.all(['Dueña', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Empresa de cierres');
  const B = await crearEmpresa(ajeno, 'Otra empresa de cierres');
  await Promise.all([activarModulo(A, 'registro'), activarModulo(B, 'registro')]);
  await agregarMiembro(app, A, propio, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  await datosDe(dueno, 'registro_iniciar');
  caja = (await datosDe(dueno, 'cuentas_listar', {})).items[0].id;
  banco = (await datosDe(dueno, 'cuenta_crear', { nombre: 'Banco de Prueba', tipo: 'banco' })).id;
});
afterAll(async () => {
  await app.cerrar();
});

describe('semana_revisar', () => {
  it('revisa la semana con su saldo al sábado y el domingo anterior', async () => {
    const d = lunes(3);
    await movimiento('ingreso', 10_000, sumarDias(d, -1)); // domingo anterior: cuenta en esta semana
    await movimiento('ingreso', 5_000, sumarDias(d, 1));
    await movimiento('egreso', 2_000, sabado(d));
    await movimiento('ingreso', 700, sumarDias(d, 6)); // domingo siguiente: es de la otra semana
    const r = await revisar(d);
    expect(r).toMatchObject({ desde: d, hasta: sabado(d), movimientosDesde: sumarDias(d, -1), estado: 'por_cerrar', cierre: null, movimientosTotal: 3 });
    expect(cuentaDe(r, caja)).toMatchObject({ saldoInicialCentimos: 0, ingresosCentimos: 15_000, egresosCentimos: 2_000, transferenciasNetasCentimos: 0, sistemaCentimos: 13_000, movimientos: 3 });
    expect(cuentaDe(r, banco)).toMatchObject({ sistemaCentimos: 0, movimientos: 0 });
    expect(r.movimientos).toHaveLength(3);
  });
  it('un domingo y un sábado dan la misma semana; sin fecha usa hoy', async () => {
    const d = lunes(3);
    expect((await revisar(sumarDias(d, 6))).desde).toBe(d);
    expect((await revisar(sabado(d))).desde).toBe(d);
    expect((await datosDe(dueno, 'semana_revisar', {})).desde).toBe(semanaDe(hoyDePrueba()).desde);
  });
  it('señala ingresos sin cliente y cobros en cuenta dudosa, sin contar transferencias', async () => {
    const d = lunes(4);
    const cliente = (await datosDe(dueno, 'clientes_crear', { nombre: 'Librería de Prueba' })).id;
    await movimiento('ingreso', 1_100, sumarDias(d, 1), { medioDePago: 'yape' }); // sin cliente y dudoso
    await movimiento('ingreso', 1_200, sumarDias(d, 1), { medioDePago: 'efectivo', contactoId: cliente }); // limpio
    await movimiento('ingreso', 1_300, sumarDias(d, 2), { medioDePago: 'efectivo', cuentaId: banco }); // sin cliente y dudoso
    await datosDe(dueno, 'cuentas_transferir', { origenId: caja, destinoId: banco, montoCentimos: 500, fecha: sumarDias(d, 3) });
    const r = await revisar(d);
    expect(r.ingresosSinClienteTotal).toBe(2);
    expect(r.cobrosEnCuentaDudosaTotal).toBe(2);
    expect(cuentaDe(r, banco).transferenciasNetasCentimos).toBe(500);
    expect(cuentaDe(r, caja).transferenciasNetasCentimos).toBe(-500);
  });
});

describe('semana_cerrar', () => {
  it('cierra sin diferencias y la semana pasa a cerrada', async () => {
    const d = lunes(5);
    await movimiento('ingreso', 3_000, sumarDias(d, 1));
    const { datos, resumen } = await cerrar(d, conteos(3_000, 0), 'Todo en orden');
    expect(resumen).toContain('Todo cuadra.');
    expect(datos.movimientosCreados).toEqual([]);
    expect(datos.cierre).toMatchObject({ desde: d, hasta: sabado(d), diferenciaTotalCentimos: 0, notas: 'Todo en orden' });
    const r = await revisar(d);
    expect(r.estado).toBe('cerrada');
    expect(r.cierre.saldos).toHaveLength(2);
    expect(r.cambiosDesdeElCierre).toEqual([]);
  });
  it('el faltante crea el egreso y el saldo queda igual a lo contado', async () => {
    const d = lunes(6);
    await movimiento('ingreso', 10_000, sumarDias(d, 1));
    const { datos } = await cerrar(d, conteos(9_000, 0, 'Se pagó un flete sin anotar'));
    expect(datos.movimientosCreados).toHaveLength(1);
    expect(datos.movimientosCreados[0]).toMatchObject({ tipo: 'egreso', montoCentimos: 1_000, fecha: sabado(d), cuentaNombre: 'Caja', medioDePago: 'efectivo' });
    expect(datos.movimientosCreados[0].descripcion).toContain('Se pagó un flete sin anotar');
    expect(datos.cierre.diferenciaTotalCentimos).toBe(-1_000);
    const m = await datosDe(dueno, 'movimiento_ver', { id: datos.movimientosCreados[0].id });
    expect(m).toMatchObject({ categoriaNombre: 'Diferencia de caja', origen: 'modulo', corregible: false });
    const r = await revisar(d);
    expect(cuentaDe(r, caja).sistemaCentimos).toBe(9_000);
    expect(r.cambiosDesdeElCierre).toEqual([]);
  });
  it('el sobrante crea un ingreso (en el banco, con medio «otro»)', async () => {
    const d = lunes(7);
    const { datos } = await cerrar(d, [
      { cuentaId: caja, contadoCentimos: 0 },
      { cuentaId: banco, contadoCentimos: 2_500, explicacion: '   Depósito de un cliente sin avisar   ' },
    ]);
    expect(datos.movimientosCreados[0]).toMatchObject({ tipo: 'ingreso', montoCentimos: 2_500, cuentaNombre: 'Banco de Prueba', medioDePago: 'otro' });
    expect(datos.movimientosCreados[0].descripcion).toBe(`Diferencia de caja · semana ${d.slice(8)}/${d.slice(5, 7)} al ${sabado(d).slice(8)}/${sabado(d).slice(5, 7)}: Depósito de un cliente sin avisar`);
  });
  it('sin explicación (14 caracteres) no escribe nada', async () => {
    const d = lunes(8);
    await movimiento('ingreso', 4_000, sumarDias(d, 1));
    const antes = (await revisar(d)).movimientosTotal;
    const r = await mensaje(d, conteos(3_000, 0, 'abcdefghijklmn'));
    expect(r.codigo).toBe('argumentos_invalidos');
    expect(r.mensaje).toBe('Explica por qué «Caja» no cuadra (Faltan S/ 10.00): al menos 15 caracteres.');
    const despues = await revisar(d);
    expect(despues).toMatchObject({ movimientosTotal: antes, estado: 'por_cerrar', cierre: null });
  });
  it('ya cerrada, futura y en curso son conflicto', async () => {
    expect(await mensaje(lunes(5), conteos(3_000, 0))).toMatchObject({ codigo: 'conflicto' });
    expect((await mensaje(lunes(5), conteos(3_000, 0))).mensaje).toMatch(/ya está cerrada\.$/);
    const futura = await mensaje(semanaDe(diaMas(7)).desde, conteos(0, 0));
    expect(futura).toEqual({ codigo: 'conflicto', mensaje: 'Esa semana todavía no empieza: no se puede cerrar.' });
  });
  // «En curso» solo existe de lunes a viernes (el sábado la semana ya terminó): fuera de esos días se omite de forma explícita.
  const diaDeSemana = new Date(`${hoyDePrueba()}T00:00:00Z`).getUTCDay();
  it.skipIf(diaDeSemana < 1 || diaDeSemana > 5)('una semana en curso es conflicto', async () => {
    const r = await mensaje(semanaDe(hoyDePrueba()).desde, conteos(0, 0));
    expect(r.codigo).toBe('conflicto');
    expect(r.mensaje).toMatch(/^Esta semana termina el sábado \d\d\/\d\d\/\d{4}: ciérrala ese día o después\.$/);
    expect((await revisar(hoyDePrueba())).cuentas.every((c: any) => c.movimientosPosterioresCentimos === 0)).toBe(true);
  });
  it('lo contado: una caja negativa, un monto enorme y un año absurdo se rechazan', async () => {
    expect(await mensaje(lunes(9), conteos(-1, 0))).toEqual({ codigo: 'argumentos_invalidos', mensaje: 'Lo contado en la caja «Caja» no puede ser negativo.' });
    expect((await mensaje(lunes(9), conteos(2_000_000_000_000, 0))).codigo).toBe('argumentos_invalidos');
    expect((await mensaje('1800-01-05', conteos(0, 0))).codigo).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('semana_revisar', { fecha: '1800-01-05' }))).toBe('argumentos_invalidos');
  });
  it('el origen «cierre:» no se puede escribir a mano', async () => {
    const r = await dueno.herramienta('movimiento_registrar', { tipo: 'ingreso', montoCentimos: 100, cuentaId: caja, origenRef: 'cierre:2026-01-05:falsa' });
    expect(codigoDe(r)).toBe('argumentos_invalidos');
  });
  it('rechaza un día que no es lunes', async () => {
    const r = await dueno.herramienta('semana_cerrar', { desde: sumarDias(lunes(9), 1), conteos: conteos(0, 0) });
    expect(codigoDe(r)).toBe('argumentos_invalidos');
    expect(JSON.stringify(r.cuerpo)).toContain('La semana se indica con su lunes (AAAA-MM-DD).');
  });
  it('falta una cuenta, una cuenta ajena y una repetida', async () => {
    const d = lunes(9);
    expect(await mensaje(d, [{ cuentaId: caja, contadoCentimos: 0 }])).toEqual({ codigo: 'argumentos_invalidos', mensaje: 'Falta lo contado en «Banco de Prueba».' });
    expect((await mensaje(d, [...conteos(0, 0), { cuentaId: randomUUID(), contadoCentimos: 0 }])).codigo).toBe('no_encontrado');
    expect(await mensaje(d, [...conteos(0, 0), { cuentaId: caja, contadoCentimos: 0 }])).toEqual({ codigo: 'argumentos_invalidos', mensaje: 'La cuenta «Caja» aparece dos veces.' });
    expect((await revisar(d)).estado).toBe('por_cerrar');
  });
  it('con alcance «propios» no revisa ni cierra', async () => {
    expect(codigoDe(await propio.herramienta('semana_revisar', {}))).toBe('sin_permiso');
    expect(codigoDe(await propio.herramienta('semana_cerrar', { desde: lunes(9), conteos: conteos(0, 0) }))).toBe('sin_permiso');
  });
  it('la huella caduca si entra un movimiento entre pedir y confirmar', async () => {
    const d = lunes(10);
    await movimiento('ingreso', 1_000, sumarDias(d, 1));
    const args = { desde: d, conteos: conteos(1_000, 0, 'Explicación con más de quince caracteres') };
    const token = (await dueno.herramienta('semana_cerrar', args)).cuerpo?.requiereConfirmacion?.token as string;
    expect(token).toBeTruthy();
    await movimiento('ingreso', 500, sumarDias(d, 2));
    const r = await dueno.herramienta('semana_cerrar', args, { confirmacion: token });
    expect(codigoDe(r)).toBe('confirmacion_desactualizada');
    expect((await revisar(d)).estado).toBe('por_cerrar');
  });
  it('aislamiento: otra empresa no ve cuentas ni cierres de esta', async () => {
    const r = await revisar(lunes(5), ajeno);
    expect(r.estado).toBe('por_cerrar');
    expect(r.cierre).toBeNull();
    expect(r.cuentas.map((c: any) => c.cuentaId)).not.toContain(caja);
    expect(r.movimientosTotal).toBe(0);
  });
});

describe('semana_revisar: lo posterior al sábado y los ajustes tras un cierre', () => {
  it('movimientosPosterioresCentimos suma el neto de lo fechado después del sábado y hasta hoy', async () => {
    const d = lunes(1);
    await movimiento('ingreso', 400, sumarDias(d, 1));
    const antes = cuentaDe(await revisar(d), caja);
    await movimiento('ingreso', 700, diaMas(0));
    await movimiento('egreso', 200, diaMas(0));
    const despues = cuentaDe(await revisar(d), caja);
    expect(despues.movimientosPosterioresCentimos - antes.movimientosPosterioresCentimos).toBe(500);
    expect(despues.sistemaCentimos).toBe(antes.sistemaCentimos); // el sábado no cambia
    expect(cuentaDe(await revisar(d), banco).movimientosPosterioresCentimos).toBe(0);
  });
  it('un movimiento con fecha atrasada cargado después del cierre aparece al revisar la semana siguiente', async () => {
    const d = lunes(2);
    await movimiento('ingreso', 5_000, sumarDias(d, 1));
    const previa = await revisar(d);
    const contada = cuentaDe(previa, caja).sistemaCentimos;
    const cierre = await cerrar(d, conteos(contada, cuentaDe(previa, banco).sistemaCentimos));
    expect(cierre.datos.cierre.diferenciaTotalCentimos).toBe(0);
    expect((await revisar(sumarDias(d, 7))).ajustesPosterioresACierre).toEqual([]);
    await movimiento('egreso', 800, sumarDias(d, 2)); // dentro de la semana ya cerrada
    const r = await revisar(sumarDias(d, 7));
    expect(r.ajustesPosterioresACierre).toEqual([{ cuentaId: caja, nombre: 'Caja', contadoDelCierreCentimos: contada, saldoInicialCentimos: contada - 800, diferenciaCentimos: -800 }]);
    expect((await revisar(d)).cambiosDesdeElCierre).toHaveLength(1);
  });
});
