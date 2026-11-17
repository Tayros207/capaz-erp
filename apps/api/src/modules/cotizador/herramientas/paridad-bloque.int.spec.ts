import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, confirmando, crearCliente, datosDe } from './pruebas-de-cotizador.js';

// PARIDAD con Cotizín · «cambiar en bloque» (`ajuste-en-bloque.test.ts`, 20 líneas) por `listas_precio_ajustar_en_bloque`:
// base 190.00 / 580.00 / 1200.00 → +8 % da 205.20 / 626.40 / 1296.00; 99.99 +3.5 % → 103.49; −10 % con mínimo 250.00 → 171.00 / 522.00 / 1080.00 / 225.00;
// el medio centavo sube (10.05 +5 % → 10.55; 0.10 +5 % → 0.11). Dos empresas.

let app: AppDePruebas;
let dueno: Sesion;
let ajeno: Sesion;

const lista = (s: Sesion, nombre: string, p100: number, p1000: number, p5000: number, extra: Record<string, unknown> = {}) =>
  datosDe(s, 'lista_precio_crear', { nombre, p100Centimos: p100, p1000Centimos: p1000, p5000Centimos: p5000, ...extra });
const ver = (s: Sesion, id: string) => datosDe(s, 'lista_precio_ver', { id });
const bloque = (busqueda: string, porcentaje: string, extra: Record<string, unknown> = {}) => confirmando(dueno, 'listas_precio_ajustar_en_bloque', { busqueda, porcentaje, ...extra });
const precios = (l: any) => [l.p100Centimos, l.p1000Centimos, l.p5000Centimos, l.precioMinimoCentimos];

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, ajeno] = await Promise.all([abrirSesion(app, 'Dueña paridad bloque'), abrirSesion(app, 'Ajena paridad bloque')]);
  const A = await crearEmpresa(dueno, 'Paridad bloque A');
  const B = await crearEmpresa(ajeno, 'Paridad bloque B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
});
afterAll(async () => {
  await app.cerrar();
});

describe('los vectores de ajuste-en-bloque.test.ts', () => {
  it('+8 % sube cada referencia al centavo: 190.00 / 580.00 / 1,200.00 → 205.20 / 626.40 / 1,296.00 (mínimo null sigue null)', async () => {
    const l = await lista(dueno, 'Base ocho', 19_000, 58_000, 120_000);
    const { respuesta, resumen } = await bloque('base ocho', '8');
    expect(respuesta.cuerpo.datos).toEqual({ cambiadas: 1, porcentaje: '8' });
    expect(resumen).toContain('«Base ocho»: 1.000 → S/ 580.00 pasa a S/ 626.40');
    expect(precios(await ver(dueno, l.id))).toEqual([20_520, 62_640, 129_600, null]);
  });

  it('99.99 +3.5 % → 103.49 (103.4897 al centavo)', async () => {
    const l = await lista(dueno, 'Base tres y medio', 9_999, 58_000, 120_000);
    await bloque('base tres y medio', '3.5');
    expect((await ver(dueno, l.id)).p100Centimos).toBe(10_349);
  });

  it('−10 % baja y el mínimo se ajusta igual: 171.00 / 522.00 / 1,080.00 y mínimo 225.00', async () => {
    const l = await lista(dueno, 'Base menos diez', 19_000, 58_000, 120_000, { precioMinimoCentimos: 25_000 });
    await bloque('base menos diez', '-10');
    expect(precios(await ver(dueno, l.id))).toEqual([17_100, 52_200, 108_000, 22_500]);
  });

  it('el medio centavo sube (half-up): 10.05 × 1.05 = 10.5525 → 10.55; 0.10 × 1.05 = 0.105 → 0.11', async () => {
    const a = await lista(dueno, 'Medio centavo A', 1_005, 5_000, 20_000, { confirmarUnitarioNoBaja: true });
    await bloque('medio centavo a', '5', { confirmarUnitarioNoBaja: true });
    expect((await ver(dueno, a.id)).p100Centimos).toBe(1_055);
    const b = await lista(dueno, 'Medio centavo B', 10, 23, 114);
    await bloque('medio centavo b', '5', { confirmarUnitarioNoBaja: true });
    expect((await ver(dueno, b.id)).p100Centimos).toBe(11);
  });
});

describe('resumen, todo o nada y aviso A', () => {
  it('el resumen declara el porcentaje con signo y cuántas listas; otra empresa no cambia', async () => {
    await lista(dueno, 'Resumen uno', 19_000, 58_000, 120_000);
    await lista(dueno, 'Resumen dos', 8_000, 38_000, 110_000);
    const ajena = await lista(ajeno, 'Resumen ajeno', 19_000, 58_000, 120_000);
    const { respuesta, resumen } = await bloque('resumen', '8');
    expect(respuesta.cuerpo.datos).toEqual({ cambiadas: 2, porcentaje: '8' });
    expect(resumen).toContain('+8 %');
    expect(resumen).toContain('(2)');
    expect(precios(await ver(ajeno, ajena.id))).toEqual([19_000, 58_000, 120_000, null]);
  });

  it('todo o nada (invariante B): una lista que no resiste el cambio impide que cambie ninguna; el rechazo la nombra', async () => {
    const buena = await lista(dueno, 'Lote bueno', 19_000, 58_000, 120_000);
    await lista(dueno, 'Lote justo', 1_000, 1_001, 1_002);
    const r = await dueno.herramienta('listas_precio_ajustar_en_bloque', { busqueda: 'lote', porcentaje: '-50' });
    expect(codigoDe(r)).toBe('conflicto');
    expect(r.cuerpo.error.mensaje).toContain('Lote justo');
    expect(precios(await ver(dueno, buena.id))).toEqual([19_000, 58_000, 120_000, null]);
  });

  it('aviso A en bloque: rechaza sin confirmar, aplica confirmando y marca a_confirmado', async () => {
    const l = await lista(dueno, 'Aviso unitario', 10, 24, 119);
    const args = { busqueda: 'aviso unitario', porcentaje: '5' };
    // 10 / 24 / 119 → 11 / 25 / 125: 125 ≥ 5 × 25, el unitario ya no baja de 1.000 a 5.000.
    const sin = await dueno.herramienta('listas_precio_ajustar_en_bloque', args);
    expect(codigoDe(sin)).toBe('conflicto');
    expect(sin.cuerpo.error.mensaje).toMatch(/Aviso unitario.*Confirma para guardarlo igual/s);
    expect((await ver(dueno, l.id)).p100Centimos).toBe(10);
    await confirmando(dueno, 'listas_precio_ajustar_en_bloque', { ...args, confirmarUnitarioNoBaja: true });
    expect(await ver(dueno, l.id)).toMatchObject({ p100Centimos: 11, p1000Centimos: 25, p5000Centimos: 125, aConfirmado: true });
  });

  it('las cotizaciones emitidas conservan su precio; la nueva usa el de hoy', async () => {
    const cliente = await crearCliente(dueno, 'Cliente bloque');
    const l = await lista(dueno, 'Con cotización', 19_000, 58_000, 120_000);
    const crear = () => datosDe(dueno, 'cotizacion_crear', { titulo: 'Bloque', clienteId: cliente, lineas: [{ tipo: 'lista', listaId: l.id, cantidadMilesimas: 1_000_000 }] });
    const vieja = await crear();
    const emitida = (await confirmando(dueno, 'cotizacion_emitir', { id: vieja.id })).respuesta.cuerpo.datos;
    await bloque('con cotizacion', '8');
    expect((await datosDe(dueno, 'cotizacion_ver', { id: vieja.id })).subtotalCentimos).toBe(emitida.subtotalCentimos);
    expect((await crear()).subtotalCentimos).toBe(62_640);
  });
});
