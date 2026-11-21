import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, confirmando, datosDe } from './pruebas-de-registro.js';

// Pagos fijos: marcar una deuda como «fijo» y copiarlos al mes siguiente, por HTTP real. Nombres inventados.

let app: AppDePruebas;
let dueno: Sesion;
let propio: Sesion;
let ajeno: Sesion;
let alquiler: string;
let luz: string;
let cliente: string;

const crear = (args: Record<string, unknown>) => datosDe(dueno, 'deuda_crear', { tipo: 'por_pagar', totalCentimos: 100_000, ...args });
const copiar = (mes: string, sesion = dueno) => confirmando(sesion, 'deudas_copiar_fijos', { mes });
const delMes = async (sesion: Sesion, mes: string) =>
  ((await datosDe(sesion, 'deudas_listar', { tipo: 'por_pagar', estado: 'todas', limite: 100 })).items as any[]).filter((d) => d.venceEn?.startsWith(mes));

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, propio, ajeno] = await Promise.all(['Dueña', 'Propia', 'Ajena'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Empresa de pagos fijos');
  const B = await crearEmpresa(ajeno, 'Otra empresa de pagos fijos');
  await Promise.all([activarModulo(A, 'registro'), activarModulo(B, 'registro')]);
  await agregarMiembro(app, A, propio, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  await datosDe(dueno, 'registro_iniciar');
  [alquiler, luz, cliente] = await Promise.all(['Inmobiliaria de Prueba', 'Eléctrica de Prueba', 'Cliente de Prueba'].map(async (nombre) => (await datosDe(dueno, 'clientes_crear', { nombre })).id));
});
afterAll(async () => {
  await app.cerrar();
});

describe('fijo en deuda_crear y deuda_editar', () => {
  it('se guarda, se ve en la salida y se puede quitar', async () => {
    const d = await crear({ contactoId: alquiler, concepto: 'Alquiler marcado', fecha: '2026-01-01', venceEn: '2026-01-05', fijo: true });
    expect(d.fijo).toBe(true);
    expect((await crear({ contactoId: alquiler, concepto: 'Sin marca', fecha: '2026-01-01', venceEn: '2026-01-05' })).fijo).toBe(false);
    expect((await datosDe(dueno, 'deuda_editar', { id: d.id, fijo: false })).fijo).toBe(false);
    const otra = await datosDe(dueno, 'deuda_editar', { id: d.id, fijo: true, notas: 'ok' });
    expect(otra).toMatchObject({ fijo: true, notas: 'ok', concepto: 'Alquiler marcado' });
    expect((await datosDe(dueno, 'deuda_ver', { id: d.id })).fijo).toBe(true);
  });
  it('una deuda por cobrar fija se rechaza al crear y al editar', async () => {
    const r = await dueno.herramienta('deuda_crear', { tipo: 'por_cobrar', contactoId: cliente, concepto: 'Venta', totalCentimos: 5_000, venceEn: '2027-01-20', fijo: true });
    expect(codigoDe(r)).toBe('argumentos_invalidos');
    expect(r.cuerpo.error.mensaje).toBe('Solo una deuda por pagar puede ser un pago fijo.');
    const cobrar = await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: cliente, concepto: 'Venta 2', totalCentimos: 5_000 });
    expect(codigoDe(await dueno.herramienta('deuda_editar', { id: cobrar.id, fijo: true, venceEn: '2027-01-20' }))).toBe('argumentos_invalidos');
    expect((await datosDe(dueno, 'deuda_editar', { id: cobrar.id, fijo: false })).fijo).toBe(false);
  });
});

describe('reglas de un pago fijo', () => {
  it('sin fecha de vencimiento se rechaza al crear y al editar', async () => {
    const r = await dueno.herramienta('deuda_crear', { tipo: 'por_pagar', contactoId: alquiler, concepto: 'Sin vencimiento', totalCentimos: 5_000, fijo: true });
    expect(codigoDe(r)).toBe('argumentos_invalidos');
    expect(JSON.stringify(r.cuerpo)).toContain('Un pago fijo necesita fecha de vencimiento.');
    const suelta = await crear({ contactoId: alquiler, concepto: 'Sin vencimiento 2' });
    const e = await dueno.herramienta('deuda_editar', { id: suelta.id, fijo: true });
    expect(codigoDe(e)).toBe('argumentos_invalidos');
    expect(e.cuerpo.error.mensaje).toBe('Un pago fijo necesita fecha de vencimiento.');
    const fija = await crear({ contactoId: alquiler, concepto: 'Con vencimiento', venceEn: '2026-12-20', fijo: true });
    expect(codigoDe(await dueno.herramienta('deuda_editar', { id: fija.id, venceEn: null }))).toBe('argumentos_invalidos');
  });
  it('solo quien tiene alcance «todos» marca un pago fijo', async () => {
    const r = await propio.herramienta('deuda_crear', { tipo: 'por_pagar', contactoId: alquiler, concepto: 'Fijo de otro', totalCentimos: 5_000, venceEn: '2026-12-20', fijo: true });
    expect(codigoDe(r)).toBe('sin_permiso');
    const suya = await datosDe(propio, 'deuda_crear', { tipo: 'por_pagar', contactoId: alquiler, concepto: 'Suya', totalCentimos: 5_000, venceEn: '2026-12-20' });
    expect(codigoDe(await propio.herramienta('deuda_editar', { id: suya.id, fijo: true }))).toBe('sin_permiso');
  });
  it('el origen «pago_fijo» solo lo pone la copia automática', async () => {
    const r = await dueno.herramienta('deuda_crear', { tipo: 'por_pagar', contactoId: alquiler, concepto: 'Falsa copia', totalCentimos: 5_000, origenTipo: 'pago_fijo', origenId: 'x:2027-02' });
    expect(codigoDe(r)).toBe('argumentos_invalidos');
  });
});

describe('deudas_copiar_fijos', () => {
  it('copia una vez y la segunda da 0 (sin duplicar)', async () => {
    await crear({ contactoId: alquiler, concepto: 'Alquiler del local', totalCentimos: 150_000, fecha: '2027-01-01', venceEn: '2027-01-31', fijo: true });
    await crear({ contactoId: luz, concepto: 'Luz', totalCentimos: 30_000, fecha: '2027-01-01', venceEn: '2027-01-10', fijo: true });
    const { respuesta, resumen } = await copiar('2027-02');
    expect(resumen).toBe('Anotarás 2 pago(s) fijo(s) por S/ 1,800.00 con vencimiento en 2027-02, copiados de 2027-01: Eléctrica de Prueba (Luz), Inmobiliaria de Prueba (Alquiler del local).');
    expect(respuesta.cuerpo.datos).toMatchObject({ mes: '2027-02', mesOrigen: '2027-01', creadas: 2, yaExistian: 0, totalCentimos: 180_000 });
    const copiados = respuesta.cuerpo.datos.deudas as any[];
    const a = copiados.find((d) => d.concepto === 'Alquiler del local');
    expect(a).toMatchObject({ tipo: 'por_pagar', contactoId: alquiler, totalCentimos: 150_000, fecha: '2027-02-01', venceEn: '2027-02-28', fijo: true, origenTipo: 'pago_fijo' });
    expect(a.origenId).toMatch(/:2027-02$/);
    const segunda = await copiar('2027-02');
    expect(codigoDe(segunda.respuesta)).toBe('conflicto');
    expect(segunda.respuesta.cuerpo.error.mensaje).toBe('Los pagos fijos de 2027-02 ya están anotados.');
    expect(await delMes(dueno, '2027-02')).toHaveLength(2);
  });
  it('encadena: la copia es fuente del mes siguiente y el 31 de enero vuelve al 31 en marzo', async () => {
    const { respuesta } = await copiar('2027-03');
    expect(respuesta.cuerpo.datos.creadas).toBe(2);
    expect((await delMes(dueno, '2027-03')).find((d) => d.concepto === 'Alquiler del local').venceEn).toBe('2027-03-31');
  });
  it('no copia anuladas ni no fijas', async () => {
    await crear({ contactoId: alquiler, concepto: 'Anulada fija', fecha: '2027-05-01', venceEn: '2027-05-10', fijo: true }).then((d) => confirmando(dueno, 'deuda_anular', { id: d.id, motivo: 'error de prueba' }));
    await crear({ contactoId: luz, concepto: 'Suelta', fecha: '2027-05-01', venceEn: '2027-05-10' });
    const { respuesta } = await copiar('2027-06');
    expect(codigoDe(respuesta)).toBe('no_encontrado');
    expect(respuesta.cuerpo.error.mensaje).toBe('No hay pagos fijos con vencimiento en 2027-05: márcalos como «pago fijo» al anotarlos.');
    expect(await delMes(dueno, '2027-06')).toHaveLength(0);
  });
  it('omite la manual parecida y copia las demás', async () => {
    await crear({ contactoId: alquiler, concepto: 'Alquiler', fecha: '2027-07-01', venceEn: '2027-07-31', fijo: true });
    await crear({ contactoId: luz, concepto: 'Internet', fecha: '2027-07-01', venceEn: '2027-07-12', fijo: true });
    await crear({ contactoId: alquiler, concepto: 'ALQUILER', fecha: '2027-08-01', venceEn: '2027-08-31' }); // anotada a mano, el mismo día
    const { respuesta } = await copiar('2027-08');
    expect(respuesta.cuerpo.datos).toMatchObject({ creadas: 1, yaExistian: 1, totalCentimos: 100_000 });
    expect(respuesta.cuerpo.datos.deudas.map((d: any) => d.concepto)).toEqual(['Internet']);
  });
  it('dos quincenas del mismo proveedor y concepto se copian las dos', async () => {
    await crear({ contactoId: luz, concepto: 'Sueldo de Ana', fecha: '2027-09-01', venceEn: '2027-09-15', fijo: true });
    await crear({ contactoId: luz, concepto: 'Sueldo de Ana', fecha: '2027-09-01', venceEn: '2027-09-30', fijo: true });
    const { respuesta } = await copiar('2027-10');
    expect(respuesta.cuerpo.datos.deudas.map((d: any) => d.venceEn)).toEqual(['2027-10-15', '2027-10-30']);
    expect(respuesta.cuerpo.datos.yaExistian).toBe(0);
    expect(codigoDe((await copiar('2027-10')).respuesta)).toBe('conflicto');
  });
  it('con alcance «propios» se rechaza', async () => {
    expect(codigoDe(await propio.herramienta('deudas_copiar_fijos', { mes: '2027-02' }))).toBe('sin_permiso');
  });
  it('aislamiento: otra empresa no tiene pagos fijos que copiar', async () => {
    const { respuesta } = await copiar('2027-02', ajeno);
    expect(codigoDe(respuesta)).toBe('no_encontrado');
  });
});
