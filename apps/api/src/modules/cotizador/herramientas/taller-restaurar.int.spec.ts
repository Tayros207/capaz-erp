import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { abrirSesion, activarModulo, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, datosDe } from './pruebas-de-cotizador.js';

// Restaurar archivados del taller (cot-p3) por HTTP real, con dos empresas.

let app: AppDePruebas;
let dueno: Sesion;
let lector: Sesion;
let ajeno: Sesion;

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, lector, ajeno] = await Promise.all(['Dueña', 'Lector', 'Ajena'].map((n) => abrirSesion(app, n)));
  const A = await crearEmpresa(dueno, 'Restaurar A');
  const B = await crearEmpresa(ajeno, 'Restaurar B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  await agregarMiembro(app, A, lector, { modulo: 'cotizador', nivel: 'lectura', alcance: 'todos' });
});
afterAll(async () => {
  await app.cerrar();
});

const FORMATO = { nombre: '70 × 100 cm', anchoCm: '70', altoCm: '100', tipo: 'madre' };
const MAQUINA = { nombre: 'Offset 36 × 52', formatoMaxAnchoCm: '36', formatoMaxAltoCm: '52', pinzaCm: '2', sangradoCm: '0.3', calleCm: '0.3', etapas: [] };
const TARIFA = { factor: 'material', nombre: 'Papel couché 150 g', unidad: 'pliego', costoUnitario: '0.45', escalaPorDefecto: 'por_pliego' };
const ITEM = { nombre: 'Plastificado', factor: 'acabado' };

const CASOS = [
  { que: 'formato', crear: 'formato_pliego_crear', archivar: 'formato_pliego_archivar', restaurar: 'formato_pliego_restaurar', listar: 'formatos_pliego_listar', datos: FORMATO },
  { que: 'máquina', crear: 'maquina_crear', archivar: 'maquina_archivar', restaurar: 'maquina_restaurar', listar: 'maquinas_listar', datos: MAQUINA },
  { que: 'tarifa', crear: 'tarifa_crear', archivar: 'tarifa_archivar', restaurar: 'tarifa_restaurar', listar: 'tarifas_listar', datos: TARIFA },
  { que: 'ítem', crear: 'item_cuadro_crear', archivar: 'item_cuadro_archivar', restaurar: 'item_cuadro_restaurar', listar: 'items_cuadro_listar', datos: ITEM },
] as const;

describe.each(CASOS)('restaurar $que', (c) => {
  it('restaura lo archivado, es idempotente y deja de salir en «archivadas»', async () => {
    const x = await datosDe(dueno, c.crear, c.datos);
    await datosDe(dueno, c.archivar, { id: x.id });
    expect((await datosDe(dueno, c.listar, { estado: 'archivadas' })).items.map((i: any) => i.id)).toContain(x.id);
    expect((await datosDe(dueno, c.restaurar, { id: x.id })).archivadoEn).toBeNull();
    expect((await datosDe(dueno, c.restaurar, { id: x.id })).archivadoEn).toBeNull();
    expect((await datosDe(dueno, c.listar, { estado: 'archivadas' })).items.map((i: any) => i.id)).not.toContain(x.id);
    expect((await datosDe(dueno, c.listar, { estado: 'activas' })).items.map((i: any) => i.id)).toContain(x.id);
  });

  it('con el nombre ya usado por otro activo: conflicto con la candidata; otra empresa y lector no pueden', async () => {
    const datos = { ...c.datos, nombre: `${c.datos.nombre} bis` };
    const vieja = await datosDe(dueno, c.crear, datos);
    await datosDe(dueno, c.archivar, { id: vieja.id });
    const nueva = await datosDe(dueno, c.crear, datos);
    const r = await dueno.herramienta(c.restaurar, { id: vieja.id });
    expect(codigoDe(r)).toBe('conflicto');
    expect(JSON.stringify(r.cuerpo.error)).toContain(nueva.id);
    expect((await datosDe(dueno, c.listar, { estado: 'archivadas' })).items.map((i: any) => i.id)).toContain(vieja.id);
    expect(codigoDe(await ajeno.herramienta(c.restaurar, { id: vieja.id }))).toBe('no_encontrado');
    expect(codigoDe(await lector.herramienta(c.restaurar, { id: vieja.id }))).toBe('modulo_solo_lectura');
    expect(codigoDe(await dueno.herramienta(c.restaurar, { id: randomUUID() }))).toBe('no_encontrado');
  });
});

describe('restaurar con reglas propias', () => {
  it('un ítem no se restaura si ya hay 20 activos', async () => {
    const guardado = await datosDe(ajeno, 'item_cuadro_crear', { nombre: 'Guardado', factor: 'acabado' });
    await datosDe(ajeno, 'item_cuadro_archivar', { id: guardado.id });
    for (let n = 0; n < 20; n++) await datosDe(ajeno, 'item_cuadro_crear', { nombre: `Ítem ${n}`, factor: 'acabado' });
    const r = await ajeno.herramienta('item_cuadro_restaurar', { id: guardado.id });
    expect(codigoDe(r)).toBe('conflicto');
    expect(r.cuerpo.error.mensaje).toContain('20');
    const [uno] = (await datosDe(ajeno, 'items_cuadro_listar', {})).items;
    await datosDe(ajeno, 'item_cuadro_archivar', { id: uno.id });
    expect((await datosDe(ajeno, 'item_cuadro_restaurar', { id: guardado.id })).archivadoEn).toBeNull();
  });

  it('una tarifa de un formato archivado no se restaura hasta restaurar el formato', async () => {
    const formato = await datosDe(dueno, 'formato_pliego_crear', { ...FORMATO, nombre: 'Formato de tarifa' });
    const tarifa = await datosDe(dueno, 'tarifa_crear', { ...TARIFA, nombre: 'Tarifa con formato', formatoId: formato.id });
    await datosDe(dueno, 'tarifa_archivar', { id: tarifa.id });
    await datosDe(dueno, 'formato_pliego_archivar', { id: formato.id });
    expect(codigoDe(await dueno.herramienta('tarifa_restaurar', { id: tarifa.id }))).toBe('conflicto');
    await datosDe(dueno, 'formato_pliego_restaurar', { id: formato.id });
    expect((await datosDe(dueno, 'tarifa_restaurar', { id: tarifa.id })).archivadoEn).toBeNull();
  });
});
