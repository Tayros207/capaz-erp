import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, crearCliente, datosDe } from './pruebas-de-cotizador.js';
import { sembrarTaller, type Taller } from './pruebas-de-cuadro.js';

// PARIDAD con Cotizín · imposición y mermas armadas con `cuadro_fijar_trabajo` y `cuadro_fijar_imposicion`.
// Vectores de `cotizacion/services/imposicion.test.ts` y `mermas.test.ts` de la copia de Cotizín (el motor ya los corre como unitarias).

let app: AppDePruebas;
let dueno: Sesion;
let ajeno: Sesion;
let cliente: string;
let taller: Taller;

const A5 = { anchoCm: '14.8', altoCm: '21' };
const A4 = { anchoCm: '21', altoCm: '29.7' };
const MADRE = { anchoCm: '70', altoCm: '100' };
const MAQUINA = { anchoCm: '35', altoCm: '50' };
const TIRAJE = [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }];
const MARGENES = { sangradoCm: '0.3', calleCm: '0.3', pinzaCm: '2' };

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, ajeno] = await Promise.all([abrirSesion(app, 'Dueña paridad imposición'), abrirSesion(app, 'Ajena paridad imposición')]);
  const A = await crearEmpresa(dueno, 'Paridad imposición A');
  const B = await crearEmpresa(ajeno, 'Paridad imposición B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  cliente = await crearCliente(dueno, 'Imprenta Sol');
  taller = await sembrarTaller(dueno);
});
afterAll(async () => {
  await app.cerrar();
});

/** Un cuadro en blanco con el trabajo; devuelve el id. */
async function trabajo(cantidad: string, pieza: { anchoCm: string; altoCm: string }): Promise<string> {
  const { cuadro } = await datosDe(dueno, 'cuadro_iniciar', { plantilla: 'en_blanco', titulo: 'Paridad', clienteId: cliente });
  await datosDe(dueno, 'cuadro_fijar_trabajo', { id: cuadro.cotizacionId, producto: 'Impreso', cantidad, pieza, tintas: 4, caras: 2 });
  return cuadro.cotizacionId;
}
/** Impone y devuelve la parte de imposición de la vista. */
async function imponer(id: string, extra: Record<string, unknown>): Promise<any> {
  const r = await datosDe(dueno, 'cuadro_fijar_imposicion', { id, pliegoMadre: MADRE, pliegoMaquina: MAQUINA, ...MARGENES, formatoMaximo: null, etapas: TIRAJE, ...extra });
  return r.cuadro.imposicion;
}
const pliegosDe = (imp: any) => imp.calculada && { poses: imp.calculada.poses, columnas: imp.calculada.columnas, filas: imp.calculada.filas, girada: imp.calculada.girada, netos: imp.calculada.pliegosNetos, deMaquina: imp.calculada.pliegosDeMaquina, porMadre: imp.calculada.pliegosPorMadre, madre: imp.calculada.pliegosMadre };

describe('caso de referencia: 2.500 volantes A5', () => {
  it('4 poses (2 × 2), 625 netos, 645 tras el porcentaje, 685 de máquina, 4 pliegos de máquina por madre y 172 madres', async () => {
    const imp = await imponer(await trabajo('2500', A5), {});
    expect(imp).toMatchObject({ faltantes: [], problema: null });
    expect(pliegosDe(imp)).toEqual({ poses: '4', columnas: '2', filas: '2', girada: false, netos: '625', deMaquina: '685', porMadre: '4', madre: '172' });
    expect(imp.calculada.etapas).toEqual([{ nombre: 'Tiraje', mermaPct: '3', arranque: '40', salida: '625', trasPorcentaje: '645', entrada: '685' }]);
  });

  it('con la máquina y los pliegos del taller sembrado sale lo mismo (la máquina copia pinza, sangrado, calle y la merma de tiraje)', async () => {
    const id = await trabajo('2500', A5);
    const r = await datosDe(dueno, 'cuadro_fijar_imposicion', { id, maquinaId: taller.maquina, pliegoMadreId: taller.madre, pliegoMaquinaId: taller.deMaquina });
    expect(pliegosDe(r.cuadro.imposicion)).toEqual({ poses: '4', columnas: '2', filas: '2', girada: false, netos: '625', deMaquina: '685', porMadre: '4', madre: '172' });
  });

  it('sin etapas de merma los pliegos brutos son los netos: 625 / 625 / 157 madres', async () => {
    const imp = await imponer(await trabajo('2500', A5), { etapas: [] });
    expect(pliegosDe(imp)).toMatchObject({ netos: '625', deMaquina: '625', madre: '157' });
    expect(imp.calculada.etapas).toEqual([]);
  });

  it('el cuadro_calcular de un cuadro con imposición completa trae el mismo desglose en «pliegos»', async () => {
    const id = await trabajo('2500', A5);
    await imponer(id, {});
    expect((await datosDe(dueno, 'cuadro_calcular', { id })).pliegos).toMatchObject({ poses: '4', pliegosMadre: '172', pliegosPorMadre: '4' });
  });
});

describe('poses por pliego (PRO-01) y corte del madre', () => {
  it('A5: 18 en el pliego madre 70 × 100 y 4 en el de máquina 35 × 50', async () => {
    const enMadre = await imponer(await trabajo('2500', A5), { pliegoMaquina: MADRE, etapas: [] });
    expect(pliegosDe(enMadre)).toMatchObject({ poses: '18', porMadre: '1' });
    expect(pliegosDe(await imponer(await trabajo('2500', A5), { etapas: [] }))).toMatchObject({ poses: '4', porMadre: '4' });
  });

  it('A4: 9 en el pliego madre y 2 en el de máquina, este último solo girado (1 columna × 2 filas)', async () => {
    expect(pliegosDe(await imponer(await trabajo('2500', A4), { pliegoMaquina: MADRE, etapas: [] }))).toMatchObject({ poses: '9' });
    const enMaquina = pliegosDe(await imponer(await trabajo('2500', A4), {}));
    expect(enMaquina).toMatchObject({ poses: '2', columnas: '1', filas: '2', girada: true });
    // 2.500 / 2 = 1.250 netos; con 3 % + 40 hojas: ⌈1.250 / 0.97⌉ + 40 = 1.329 de máquina y ⌈1.329 / 4⌉ = 333 madres.
    expect(enMaquina).toMatchObject({ netos: '1250', deMaquina: '1329', madre: '333' });
  });

  it('el sangrado se cuenta por los dos lados y la calle solo entre piezas: 10 × 10 en 21.2 × 10.6 caben 2, en 21.1 solo 1', async () => {
    const sinPinza = { sangradoCm: '0.3', calleCm: '0', pinzaCm: '0' };
    const pieza = { anchoCm: '10', altoCm: '10' };
    const dos = await imponer(await trabajo('100', pieza), { pliegoMaquina: { anchoCm: '21.2', altoCm: '10.6' }, pliegoMadre: { anchoCm: '21.2', altoCm: '10.6' }, ...sinPinza, etapas: [] });
    const una = await imponer(await trabajo('100', pieza), { pliegoMaquina: { anchoCm: '21.1', altoCm: '10.6' }, pliegoMadre: { anchoCm: '21.1', altoCm: '10.6' }, ...sinPinza, etapas: [] });
    expect([pliegosDe(dos).poses, pliegosDe(una).poses]).toEqual(['2', '1']);
    const calle = { pliegoMaquina: { anchoCm: '21.4', altoCm: '10.6' }, pliegoMadre: { anchoCm: '21.4', altoCm: '10.6' }, sangradoCm: '0.3', calleCm: '0.3', pinzaCm: '0', etapas: [] };
    expect(pliegosDe(await imponer(await trabajo('100', pieza), calle)).poses).toBe('1');
    const justo = { ...calle, pliegoMaquina: { anchoCm: '21.5', altoCm: '10.6' }, pliegoMadre: { anchoCm: '21.5', altoCm: '10.6' } };
    expect(pliegosDe(await imponer(await trabajo('100', pieza), justo)).poses).toBe('2');
  });

  it('la pinza se prueba en cada borde: 16.8 × 24 en 35 × 50 con pinza 2 cabe 2 × 2; el pliego escrito al revés (50 × 35) da lo mismo', async () => {
    const pieza = { anchoCm: '16.8', altoCm: '24' };
    const a = await imponer(await trabajo('1000', pieza), { sangradoCm: '0', calleCm: '0', pinzaCm: '2', etapas: [] });
    const b = await imponer(await trabajo('1000', pieza), { sangradoCm: '0', calleCm: '0', pinzaCm: '2', pliegoMaquina: { anchoCm: '50', altoCm: '35' }, etapas: [] });
    expect(pliegosDe(a)).toMatchObject({ poses: '4', columnas: '2', filas: '2' });
    expect(pliegosDe(b).poses).toBe('4');
  });

  it('corte del madre: escribir el pliego de máquina al revés (50 × 35) da 4; 33 × 51 en 70 × 100 da 3 (girado); el mismo pliego da 1', async () => {
    const porMadre = async (maquina: { anchoCm: string; altoCm: string }, madre = MADRE) => pliegosDe(await imponer(await trabajo('1000', { anchoCm: '10', altoCm: '10' }), { pliegoMaquina: maquina, pliegoMadre: madre, etapas: [] })).porMadre;
    expect(await porMadre({ anchoCm: '50', altoCm: '35' })).toBe('4');
    expect(await porMadre({ anchoCm: '33', altoCm: '51' })).toBe('3');
    expect(await porMadre(MADRE)).toBe('1');
  });
});

describe('rechazos del motor: la imposición no se calcula y el cuadro dice por qué', () => {
  it('una pieza mayor que el pliego (60 × 90 en 35 × 50) no cabe; la pinza mayor que el pliego (60) tampoco deja área útil', async () => {
    const grande = await imponer(await trabajo('2500', { anchoCm: '60', altoCm: '90' }), {});
    expect(grande.calculada).toBeNull();
    expect(grande.problema).toMatch(/pieza/i);
    const pinza = await imponer(await trabajo('2500', A5), { pinzaCm: '60' });
    expect(pinza.calculada).toBeNull();
    expect(pinza.problema).toMatch(/pieza/i);
  });

  it('un pliego de máquina que no cabe en el madre se rechaza (maquina_no_cabe_en_madre)', async () => {
    const imp = await imponer(await trabajo('2500', A5), { pliegoMadre: MAQUINA, pliegoMaquina: MADRE });
    expect(imp.calculada).toBeNull();
    expect(imp.problema).toMatch(/madre/i);
  });

  it('formato máximo de la máquina (PRO-06): imprimir en 70 × 100 con una máquina de 36 × 52 se rechaza y dice las medidas; 35 × 50 sí cabe y da 172 madres', async () => {
    const GTO = { anchoCm: '36', altoCm: '52' };
    const mal = await imponer(await trabajo('2500', A5), { pliegoMaquina: MADRE, formatoMaximo: GTO });
    expect(mal.calculada).toBeNull();
    expect(mal.problema).toContain('70 × 100');
    expect(pliegosDe(await imponer(await trabajo('2500', A5), { formatoMaximo: GTO }))).toMatchObject({ madre: '172' });
    // Cabe justo y cabe girado.
    expect((await imponer(await trabajo('2500', A5), { pliegoMaquina: { anchoCm: '36', altoCm: '52' }, formatoMaximo: GTO })).problema).toBeNull();
    expect((await imponer(await trabajo('2500', A5), { pliegoMaquina: { anchoCm: '52', altoCm: '36' }, formatoMaximo: GTO })).problema).toBeNull();
    expect((await imponer(await trabajo('2500', A5), { pliegoMaquina: { anchoCm: '36.1', altoCm: '52' }, formatoMaximo: GTO })).problema).toMatch(/36\.1|formato/i);
    expect((await imponer(await trabajo('2500', A5), { pliegoMaquina: { anchoCm: '52.1', altoCm: '36' }, formatoMaximo: GTO })).problema).not.toBeNull();
  });

  it('cantidad cero deja la imposición sin calcular (falta la cantidad); una medida en cero se rechaza antes de llegar al motor', async () => {
    const id = await trabajo('2500', A5);
    await imponer(id, {});
    const cero = await datosDe(dueno, 'cuadro_fijar_trabajo', { id, cantidad: '0' });
    expect(cero.cuadro.imposicion.calculada).toBeNull();
    expect(cero.cuadro.imposicion.faltantes).toContain('cantidad del trabajo');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_trabajo', { id, pieza: { anchoCm: '0', altoCm: '21' } }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_imposicion', { id, pliegoMaquina: { anchoCm: '0', altoCm: '50' } }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('cuadro_fijar_imposicion', { id, formatoMaximo: { anchoCm: '0', altoCm: '52' } }))).toBe('argumentos_invalidos');
  });

  it('otra empresa no toca la imposición de este cuadro', async () => {
    const id = await trabajo('2500', A5);
    expect(codigoDe(await ajeno.herramienta('cuadro_fijar_imposicion', { id, pliegoMadre: MADRE }))).toBe('no_encontrado');
  });
});

describe('otra empresa, mismo código, otra configuración (DoD §6.4 de Cotizín)', () => {
  it('3.000 A5 en pliego de máquina 50 × 70 con pinza 1, sangrado y calle 0.5, madre 100 × 70, impresión 2 % + 30 y acabado 4 % + 20: 9 poses, 334 netos, 406 de máquina, 203 madres', async () => {
    const imp = await imponer(await trabajo('3000', A5), {
      pliegoMadre: { anchoCm: '100', altoCm: '70' }, pliegoMaquina: { anchoCm: '50', altoCm: '70' },
      sangradoCm: '0.5', calleCm: '0.5', pinzaCm: '1',
      etapas: [{ nombre: 'Impresión', mermaPct: '2', arranque: '30' }, { nombre: 'Acabado', mermaPct: '4', arranque: '20' }],
    });
    expect(pliegosDe(imp)).toEqual({ poses: '9', columnas: '3', filas: '3', girada: false, netos: '334', deMaquina: '406', porMadre: '2', madre: '203' });
    expect(imp.calculada.etapas.map((e: any) => [e.nombre, e.salida, e.trasPorcentaje, e.entrada])).toEqual([['Impresión', '368', '376', '406'], ['Acabado', '334', '348', '368']]);
  });
});

describe('mermas (mermas.test.ts): una pieza de 30 × 45 en 35 × 50 da 1 pose, así que los netos son la cantidad', () => {
  const PIEZA = { anchoCm: '30', altoCm: '45' };
  const SIN = { sangradoCm: '0', calleCm: '0', pinzaCm: '0' };
  const mermas = async (cantidad: string, etapas: unknown[]) => (await imponer(await trabajo(cantidad, PIEZA), { ...SIN, etapas })).calculada;

  it('hacia atrás (INF-02): 100 netos con 20 % piden 125, no 120; 625 / 0.97 → 645; 0 % de merma entra lo mismo, más el arranque', async () => {
    expect((await mermas('100', [{ nombre: 'Tiraje', mermaPct: '20', arranque: '0' }])).pliegosDeMaquina).toBe('125');
    expect((await mermas('625', [{ nombre: 'Tiraje', mermaPct: '3', arranque: '0' }])).etapas[0].trasPorcentaje).toBe('645');
    expect((await mermas('100', [{ nombre: 'Corte', mermaPct: '0', arranque: '0' }])).pliegosDeMaquina).toBe('100');
    expect((await mermas('100', [{ nombre: 'Corte', mermaPct: '0', arranque: '7' }])).pliegosDeMaquina).toBe('107');
  });

  it('arranque fijo (INF-01): 100 netos con 3 % → 104; con 40 hojas de arranque → 144; el mismo arranque en 100 y en 10.000', async () => {
    expect((await mermas('100', [{ nombre: 'Tiraje', mermaPct: '3', arranque: '0' }])).pliegosDeMaquina).toBe('104');
    expect((await mermas('100', [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }])).pliegosDeMaquina).toBe('144');
    for (const cantidad of ['100', '10000']) {
      const e = (await mermas(cantidad, [{ nombre: 'Tiraje', mermaPct: '3', arranque: '40' }])).etapas[0];
      expect(Number(e.entrada) - Number(e.trasPorcentaje)).toBe(40);
    }
  });

  it('etapas encadenadas: 100 netos con impresión (3 % + 40) y acabado (5 % + 10) → 116 / 120 / 160 y 100 / 106 / 116; invertirlas cambia el bruto', async () => {
    const proceso = [{ nombre: 'Impresión', mermaPct: '3', arranque: '40' }, { nombre: 'Acabado', mermaPct: '5', arranque: '10' }];
    const m = await mermas('100', proceso);
    expect(m.etapas.map((e: any) => [e.nombre, e.salida, e.trasPorcentaje, e.entrada])).toEqual([['Impresión', '116', '120', '160'], ['Acabado', '100', '106', '116']]);
    expect(m.pliegosDeMaquina).toBe('160');
    expect((await mermas('100', [...proceso].reverse())).pliegosDeMaquina).not.toBe('160');
  });

  it('merma imposible: 100 % o 150 % en una etapa se rechaza; 99.999 % sigue calculándose (10 netos → 1.000.000)', async () => {
    const id = await trabajo('100', PIEZA);
    for (const mermaPct of ['100', '150']) {
      const r = await dueno.herramienta('cuadro_fijar_imposicion', { id, pliegoMadre: MADRE, pliegoMaquina: MAQUINA, ...SIN, etapas: [{ nombre: 'Tiraje', mermaPct: '3', arranque: '0' }, { nombre: 'Acabado', mermaPct, arranque: '0' }] });
      expect(codigoDe(r), mermaPct).toBe('argumentos_invalidos');
    }
    expect((await mermas('10', [{ nombre: 'Tiraje', mermaPct: '99.999', arranque: '0' }])).pliegosDeMaquina).toBe('1000000');
  });

  // DIVERGENCIA: mermas.test.ts:97 («100 % se rechaza con el nombre de la etapa») espera que el mensaje diga «Acabado»; Capaz rechaza en el
  // contrato con «La merma debe ser menor que 100 %.» sin nombrar la etapa.
  it.fails('merma imposible: el rechazo nombra la etapa (mermas.test.ts:97)', async () => {
    const id = await trabajo('100', PIEZA);
    const r = await dueno.herramienta('cuadro_fijar_imposicion', { id, pliegoMadre: MADRE, pliegoMaquina: MAQUINA, ...SIN, etapas: [{ nombre: 'Tiraje', mermaPct: '3', arranque: '0' }, { nombre: 'Acabado', mermaPct: '100', arranque: '0' }] });
    expect(JSON.stringify(r.cuerpo)).toContain('Acabado');
  });
});
