import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, confirmando, datosDe } from './pruebas-de-cotizador.js';

// «Cambiar en bloque» y restaurar listas (cot-p3) por HTTP real, con dos empresas.

let app: AppDePruebas;
let dueno: Sesion;
let lector: Sesion;
let ajeno: Sesion;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lector', 'Ajena'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Bloque A');
  const B = await crearEmpresa(ajeno, 'Bloque B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  await agregarMiembro(app, A, lector, { modulo: 'cotizador', nivel: 'lectura', alcance: 'todos' });
});
afterAll(async () => {
  await app.cerrar();
});

const lista = (s: Sesion, nombre: string, p100: number, p1000: number, p5000: number, extra: Record<string, unknown> = {}) =>
  datosDe(s, 'lista_precio_crear', { nombre, p100Centimos: p100, p1000Centimos: p1000, p5000Centimos: p5000, ...extra });
const ver = (s: Sesion, id: string) => datosDe(s, 'lista_precio_ver', { id });
const bloque = (s: Sesion, args: Record<string, unknown>) => confirmando(s, 'listas_precio_ajustar_en_bloque', args);

describe('cambiar en bloque', () => {
  let a: any, c: any, otraEmpresa: any;
  beforeAll(async () => {
    a = await lista(dueno, 'Volantes A5 couché', 19_000, 58_000, 120_000, { precioMinimoCentimos: 10_000 });
    await lista(dueno, 'Volantes A4 couché', 30_000, 90_000, 200_000);
    c = await lista(dueno, 'Tarjetas bond', 5_000, 12_000, 30_000);
    otraEmpresa = await lista(ajeno, 'Volantes ajenos couche', 19_000, 58_000, 120_000);
  });

  it('el resumen cuenta las listas y trae ejemplos; con búsqueda sin tildes solo cambia las que coinciden', async () => {
    const { respuesta, resumen } = await bloque(dueno, { busqueda: 'COUCHÉ volantes', porcentaje: '5' });
    expect(respuesta.cuerpo.ok).toBe(true);
    expect(respuesta.cuerpo.datos).toEqual({ cambiadas: 2, porcentaje: '5' });
    expect(resumen).toContain('+5 %');
    expect(resumen).toContain('(2)');
    expect(resumen).toContain('«Volantes A4 couché»: 1.000 → S/ 900.00 pasa a S/ 945.00');
    const a2 = await ver(dueno, a.id);
    expect(a2).toMatchObject({ p100Centimos: 19_950, p1000Centimos: 60_900, p5000Centimos: 126_000, precioMinimoCentimos: 10_500 });
    expect(Date.parse(a2.preciosFijadosEn)).toBeGreaterThanOrEqual(Date.parse(a.preciosFijadosEn));
    expect(await ver(dueno, c.id)).toMatchObject({ p1000Centimos: 12_000 });
    expect(await ver(ajeno, otraEmpresa.id)).toMatchObject({ p1000Centimos: 58_000 });
  });

  it('sin búsqueda cambia todas las activas (con tres ejemplos como máximo) y baja con signo negativo', async () => {
    const { respuesta, resumen } = await bloque(dueno, { porcentaje: '-10' });
    expect(respuesta.cuerpo.datos).toEqual({ cambiadas: 3, porcentaje: '-10' });
    expect(resumen).toContain('todas las listas activas (3)');
    expect(resumen).not.toContain(' más.');
    expect(resumen.match(/pasa a/g)).toHaveLength(3);
    expect(await ver(dueno, c.id)).toMatchObject({ p100Centimos: 4_500, p1000Centimos: 10_800, p5000Centimos: 27_000 });
    expect(await ver(ajeno, otraEmpresa.id)).toMatchObject({ p100Centimos: 19_000 });
  });

  it('con más de tres listas el resumen dice «y N más»', async () => {
    await lista(dueno, 'Extra uno', 1_000, 3_000, 6_000);
    const pide = await dueno.herramienta('listas_precio_ajustar_en_bloque', { porcentaje: '1' });
    expect(pide.cuerpo.requiereConfirmacion.resumen).toContain('y 1 más');
    expect(pide.cuerpo.requiereConfirmacion.resumen.match(/pasa a/g)).toHaveLength(3);
  });

  it('ninguna coincide: conflicto; porcentajes fuera de rango, cero o con tres decimales: argumentos_invalidos', async () => {
    expect(codigoDe(await dueno.herramienta('listas_precio_ajustar_en_bloque', { busqueda: 'nada que ver', porcentaje: '5' }))).toBe('conflicto');
    for (const p of ['0', '-91', '301', '5.123', 'abc', '']) {
      expect(codigoDe(await dueno.herramienta('listas_precio_ajustar_en_bloque', { porcentaje: p })), p).toBe('argumentos_invalidos');
    }
  });

  it('todo o nada: si una lista rompe la invariante B no cambia ninguna y el rechazo nombra la lista', async () => {
    const fragil = await lista(dueno, 'Frágil casi igual', 1_000, 1_001, 1_002);
    const antes = await ver(dueno, c.id);
    const r = await dueno.herramienta('listas_precio_ajustar_en_bloque', { busqueda: '', porcentaje: '-50' });
    expect(codigoDe(r)).toBe('conflicto');
    expect(r.cuerpo.error.mensaje).toContain('Frágil casi igual');
    expect(await ver(dueno, c.id)).toMatchObject({ p100Centimos: antes.p100Centimos, p1000Centimos: antes.p1000Centimos });
    expect(await ver(dueno, fragil.id)).toMatchObject({ p100Centimos: 1_000 });
  });

  it('el permiso de solo lectura no basta', async () => {
    expect(codigoDe(await lector.herramienta('listas_precio_ajustar_en_bloque', { porcentaje: '5' }))).toBe('modulo_solo_lectura');
  });
});

describe('aviso A en bloque', () => {
  it('sin confirmar rechaza con «confirma para guardarlo igual» y no cambia nada; confirmando aplica y marca a_confirmado; después ya no lo pide', async () => {
    // 10 / 23 / 114 céntimos con +5 %: 11 / 24 / 120, y 120 ya no es menor que 5 × 24.
    const l = await lista(dueno, 'Zeta unitario justo', 10, 23, 114);
    expect(l.aConfirmado).toBe(false);
    const args = { busqueda: 'zeta unitario', porcentaje: '5' };
    const sin = await dueno.herramienta('listas_precio_ajustar_en_bloque', args);
    expect(codigoDe(sin)).toBe('conflicto');
    expect(sin.cuerpo.error.mensaje).toMatch(/Zeta unitario justo.*Confirma para guardarlo igual/s);
    expect(await ver(dueno, l.id)).toMatchObject({ p100Centimos: 10, aConfirmado: false });

    const con = await confirmando(dueno, 'listas_precio_ajustar_en_bloque', { ...args, confirmarUnitarioNoBaja: true });
    expect(con.respuesta.cuerpo.datos).toEqual({ cambiadas: 1, porcentaje: '5' });
    expect(await ver(dueno, l.id)).toMatchObject({ p100Centimos: 11, p1000Centimos: 24, p5000Centimos: 120, aConfirmado: true });

    // Ya la aceptó antes: un cambio que no la empeora no vuelve a pedir confirmación.
    const otra = await confirmando(dueno, 'listas_precio_ajustar_en_bloque', { busqueda: 'zeta unitario', porcentaje: '100' });
    expect(otra.respuesta.cuerpo.ok).toBe(true);
  });

  it('la confirmación pedida con otros precios deja de valer si una lista cambia entre el resumen y el «sí»', async () => {
    const l = await lista(dueno, 'Yota cambiante', 2_000, 8_000, 30_000);
    const args = { busqueda: 'yota cambiante', porcentaje: '10' };
    const pide = await dueno.herramienta('listas_precio_ajustar_en_bloque', args);
    await confirmando(dueno, 'lista_precio_editar', { id: l.id, p100Centimos: 2_100 });
    const viejo = await dueno.herramienta('listas_precio_ajustar_en_bloque', args, { confirmacion: pide.cuerpo.requiereConfirmacion.token });
    expect(['confirmacion_desactualizada', 'confirmacion_no_coincide']).toContain(codigoDe(viejo));
  });
});

describe('restaurar listas archivadas', () => {
  it('restaura, es idempotente y devuelve la lista; otra empresa no la ve', async () => {
    const l = await lista(dueno, 'Para restaurar', 2_000, 8_000, 30_000);
    await datosDe(dueno, 'lista_precio_archivar', { id: l.id });
    expect((await datosDe(dueno, 'listas_precio_listar', { estado: 'archivadas' })).items.map((x: any) => x.id)).toContain(l.id);
    expect(codigoDe(await ajeno.herramienta('lista_precio_restaurar', { id: l.id }))).toBe('no_encontrado');
    expect((await datosDe(dueno, 'lista_precio_restaurar', { id: l.id })).archivadoEn).toBeNull();
    expect((await datosDe(dueno, 'lista_precio_restaurar', { id: l.id })).archivadoEn).toBeNull();
    expect(codigoDe(await lector.herramienta('lista_precio_restaurar', { id: l.id }))).toBe('modulo_solo_lectura');
    expect(codigoDe(await dueno.herramienta('lista_precio_restaurar', { id: randomUUID() }))).toBe('no_encontrado');
  });

  it('si otra lista activa ya usa el nombre, conflicto con la candidata y sigue archivada', async () => {
    const vieja = await lista(dueno, 'Nombre repetido', 2_000, 8_000, 30_000);
    await datosDe(dueno, 'lista_precio_archivar', { id: vieja.id });
    const nueva = await lista(dueno, 'Nombre repetido', 3_000, 9_000, 31_000);
    const r = await dueno.herramienta('lista_precio_restaurar', { id: vieja.id });
    expect(codigoDe(r)).toBe('conflicto');
    expect(JSON.stringify(r.cuerpo.error)).toContain(nueva.id);
    expect((await ver(dueno, vieja.id)).archivadoEn).not.toBeNull();
  });
});
