import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { codigoDe, confirmando, crearCliente, datosDe } from './pruebas-de-cotizador.js';

// PARIDAD con Cotizín · precio por escala, por HTTP real (`precio_consultar`, `lista_precio_crear/editar`, `cotizador_configurar`,
// `ajuste_cliente_fijar`). Los números son los de `precio-por-escala/testing/vectores-de-curva.ts`, `precio-por-escala.test.ts`,
// `precio-rapido.test.ts` y `validar-referencias.test.ts` de la copia de Cotizín; el motor ya corre esos vectores como unitarias.

let app: AppDePruebas;
let dueno: Sesion;
let ajeno: Sesion;

const lista = (nombre: string, p100: number, p1000: number, p5000: number, extra: Record<string, unknown> = {}) =>
  datosDe(dueno, 'lista_precio_crear', { nombre, p100Centimos: p100, p1000Centimos: p1000, p5000Centimos: p5000, ...extra });
const consultar = (listaId: string, unidades: number, extra: Record<string, unknown> = {}) =>
  datosDe(dueno, 'precio_consultar', { listaId, cantidadMilesimas: Math.round(unidades * 1000), ...extra });
const configurar = (args: Record<string, unknown>) => datosDe(dueno, 'cotizador_configurar', args);

let l190: any; // 190 / 580 / 1.200 en curva
let l80: any; // 80 / 380 / 1.100
let l600: any; // 600 / 1.800 / 4.200

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  [dueno, ajeno] = await Promise.all([abrirSesion(app, 'Dueña paridad escala'), abrirSesion(app, 'Ajena paridad escala')]);
  const A = await crearEmpresa(dueno, 'Paridad escala A');
  const B = await crearEmpresa(ajeno, 'Paridad escala B');
  await Promise.all([activarModulo(A, 'cotizador'), activarModulo(B, 'cotizador')]);
  l190 = await lista('Juego 190', 19_000, 58_000, 120_000);
  l80 = await lista('Juego 80', 8_000, 38_000, 110_000);
  l600 = await lista('Juego 600', 60_000, 180_000, 420_000);
});
afterAll(async () => {
  await app.cerrar();
});

describe('curva: los vectores de Cotizín (oráculo Decimal de 60 dígitos) salen igual por precio_consultar', () => {
  // [cantidad, total del lote en céntimos] de `vectores-de-curva.ts`.
  const VECTORES: [string, () => any, [number, number][]][] = [
    ['190/580/1200', () => l190, [[100, 19_000], [250, 29_623], [1000, 58_000], [1234, 63_779], [2000, 79_326], [2500, 87_739], [3500, 102_142], [4999, 119_989], [5000, 120_000]]],
    ['80/380/1100', () => l80, [[100, 8_000], [250, 14_872], [499, 23_741], [1000, 38_000], [2000, 60_060], [5000, 110_000]]],
    ['600/1800/4200', () => l600, [[100, 60_000], [250, 92_900], [1000, 180_000], [2000, 259_270], [3500, 348_097], [5000, 420_000]]],
  ];
  for (const [nombre, deLista, puntos] of VECTORES) {
    it(`${nombre}: ${puntos.length} cantidades al céntimo`, async () => {
      for (const [q, total] of puntos) expect((await consultar(deLista().id, q)).importeCentimos, `${nombre} a ${q}`).toBe(total);
    });
  }

  it('100, 250, 1.000, 2.500 y 5.000 dan 190.00, 296.23, 580.00, 877.39 y 1,200.00, con IGV 18 % y total (el unitario de 2.500 es 0.3510)', async () => {
    const esperado = [[100, 19_000, 3_420], [250, 29_623, 5_332], [1000, 58_000, 10_440], [2500, 87_739, 15_793], [5000, 120_000, 21_600]];
    for (const [q, importe, igv] of esperado) {
      expect(await consultar(l190.id, q!), `a ${q}`).toMatchObject({ importeCentimos: importe, igvCentimos: igv, totalCentimos: importe! + igv!, precioListaCentimos: importe, minimoAplicado: false, estimacion: ![100, 1000, 5000].includes(q!) });
    }
    expect((await consultar(l190.id, 2500)).precioUnitarioMilesimas).toBe(351);
  });

  it('la tabla de 8 cantidades coincide con la tabla del documento de rescate (200 → 265.86, 500 → 414.50, 3.000 → 952.72)', async () => {
    const { tabla } = await consultar(l190.id, 1000);
    const por = (q: number) => tabla.find((f: any) => f.cantidadMilesimas === q * 1000).importeCentimos;
    expect([100, 200, 500, 1000, 3000, 5000].map(por)).toEqual([19_000, 26_586, 41_450, 58_000, 95_272, 120_000]);
  });

  it('con B el total nunca baja al pedir más (barrido de cada 50 unidades) y es continuo en 1.000', async () => {
    let anterior = 0;
    for (let q = 100; q <= 5000; q += 50) {
      const t = (await consultar(l190.id, q)).importeCentimos;
      expect(t, `a ${q}`).toBeGreaterThanOrEqual(anterior);
      anterior = t;
    }
    expect(Math.abs((await consultar(l190.id, 999)).importeCentimos - 58_000)).toBeLessThan(100);
    expect(Math.abs((await consultar(l190.id, 1001)).importeCentimos - 58_000)).toBeLessThan(100);
  });

  it('una cantidad con decimales dentro del rango (1000.5) se acepta; la unidad de lista no cambia el importe', async () => {
    expect((await consultar(l190.id, 1000.5)).importeCentimos).toBeGreaterThan(58_000);
  });
});

describe('modo escalón: cada tramo usa el unitario de su referencia inferior', () => {
  let esc: any;
  beforeAll(async () => {
    esc = await lista('Juego 190 escalón', 19_000, 58_000, 120_000, { modoIntermedio: 'escalon' });
  });

  it('2.500 → 1,450.00 (0.58 × 2.500), 999 → 1,898.10, 4.999 → 2,899.42; las tres referencias pasan exactas', async () => {
    expect((await consultar(esc.id, 2500))).toMatchObject({ importeCentimos: 145_000, escalon: 1_000_000, estimacion: true, precioUnitarioMilesimas: 580 });
    expect((await consultar(esc.id, 999)).importeCentimos).toBe(189_810);
    expect((await consultar(esc.id, 4999)).importeCentimos).toBe(289_942);
    expect((await consultar(esc.id, 250)).importeCentimos).toBe(47_500);
    for (const [q, t] of [[100, 19_000], [1000, 58_000], [5000, 120_000]] as const) expect((await consultar(esc.id, q)).importeCentimos).toBe(t);
  });

  it('en el salto el total baja: 999 cuestan más que 1.000 (corte de precio, no un error)', async () => {
    expect((await consultar(esc.id, 999)).importeCentimos).toBeGreaterThan((await consultar(esc.id, 1000)).importeCentimos);
  });

  it('el mismo juego en curva y en escalón coincide en 100, 1.000 y 5.000 (también 80 y 600)', async () => {
    for (const [base, p] of [[l80, [8_000, 38_000, 110_000]], [l600, [60_000, 180_000, 420_000]]] as const) {
      const e = await lista(`${base.nombre} escalón`, p[0], p[1], p[2], { modoIntermedio: 'escalon' });
      for (const [q, t] of [[100, p[0]], [1000, p[1]], [5000, p[2]]] as const) {
        expect((await consultar(e.id, q)).importeCentimos).toBe(t);
        expect((await consultar(base.id, q)).importeCentimos).toBe(t);
      }
    }
  });
});

describe('precio mínimo', () => {
  it('100 con mínimo 250 cuestan 250.00 (aplicado); 500 sigue en 414.50; mínimo igual al total no cuenta; en escalón 2.500 → 1,500.00', async () => {
    const m = await lista('Con mínimo 250', 19_000, 58_000, 120_000, { precioMinimoCentimos: 25_000 });
    expect(await consultar(m.id, 100)).toMatchObject({ importeCentimos: 25_000, minimoAplicado: true, precioUnitarioMilesimas: 2_500 });
    expect(await consultar(m.id, 500)).toMatchObject({ importeCentimos: 41_450, minimoAplicado: false });
    const igual = await lista('Con mínimo 190', 19_000, 58_000, 120_000, { precioMinimoCentimos: 19_000 });
    expect(await consultar(igual.id, 100)).toMatchObject({ importeCentimos: 19_000, minimoAplicado: false });
    const e = await lista('Escalón con mínimo 1500', 19_000, 58_000, 120_000, { modoIntermedio: 'escalon', precioMinimoCentimos: 150_000 });
    expect(await consultar(e.id, 2500)).toMatchObject({ importeCentimos: 150_000, minimoAplicado: true });
  });

  it('con un ajuste manual: el mínimo es parte de la lista y el ajuste va encima (250.00 + 10 = 260.00)', async () => {
    const m = await lista('Mínimo con ajuste', 19_000, 58_000, 120_000, { precioMinimoCentimos: 25_000 });
    expect(await consultar(m.id, 100, { ajuste: { tipo: 'monto', importeCentimos: 1_000 } })).toMatchObject({ precioListaCentimos: 25_000, importeCentimos: 26_000, minimoAplicado: true, precioUnitarioMilesimas: 2_600 });
  });
});

describe('fuera de rango y cantidades inválidas', () => {
  it('99, 99.999, 5.001 y 5.000.001 milésimas piden cotizar aparte; 100 y 5.000 entran', async () => {
    for (const milesimas of [99_000, 99_999, 5_001_000, 5_000_001]) {
      const r = await dueno.herramienta('precio_consultar', { listaId: l190.id, cantidadMilesimas: milesimas });
      expect(r.cuerpo.ok, String(milesimas)).toBe(false);
      expect(r.cuerpo.error.mensaje, String(milesimas)).toContain('cotizar aparte');
    }
    expect((await consultar(l190.id, 100)).importeCentimos).toBe(19_000);
    expect((await consultar(l190.id, 5000)).importeCentimos).toBe(120_000);
  });

  it('cantidad cero o negativa es argumento inválido, no un caso «aparte»', async () => {
    for (const cantidadMilesimas of [0, -1_000]) {
      expect(codigoDe(await dueno.herramienta('precio_consultar', { listaId: l190.id, cantidadMilesimas }))).toBe('argumentos_invalidos');
    }
  });
});

describe('ajuste del cliente (PRP-006), redondeo comercial (PRP-005) y ajuste manual sobre 2.000 → 793.26', () => {
  let cliente: string;
  const ajustarCliente = async (pct: string) => {
    cliente = await crearCliente(dueno, `Cliente ${pct} ${Math.random()}`);
    await datosDe(dueno, 'ajuste_cliente_fijar', { clienteId: cliente, porcentaje: pct });
    return cliente;
  };
  afterAll(async () => {
    await configurar({ redondeoComercial: 'ninguno' });
  });

  it('el redondeo lleva la lista hacia arriba: ninguno 793.26, 1 → 794.00, 5 → 795.00, 10 → 800.00', async () => {
    const vistos: Record<string, number> = {};
    for (const r of ['ninguno', '1', '5', '10']) {
      await configurar({ redondeoComercial: r });
      const p = await consultar(l190.id, 2000);
      vistos[r] = p.precioListaCentimos;
      expect(p.redondeoComercial).toBe(r);
    }
    expect(vistos).toEqual({ ninguno: 79_326, 1: 79_400, 5: 79_500, 10: 80_000 });
  });

  it('un total que ya es múltiplo no sube: 100 → 190.00 con redondeo 5 sigue en 190.00; 580 con 10 queda en 580.00', async () => {
    await configurar({ redondeoComercial: '5' });
    expect((await consultar(l190.id, 100)).importeCentimos).toBe(19_000);
    await configurar({ redondeoComercial: '10' });
    expect((await consultar(l190.id, 1000)).importeCentimos).toBe(58_000);
  });

  it('el ajuste manual se suma después del redondeo: redondeo 5 + monto 100 → 895.00 (unitario 0.4475); precio 750 reemplaza', async () => {
    await configurar({ redondeoComercial: '5' });
    expect(await consultar(l190.id, 2000, { ajuste: { tipo: 'monto', importeCentimos: 10_000 } })).toMatchObject({ precioListaCentimos: 79_500, importeCentimos: 89_500, precioUnitarioMilesimas: 448 });
    expect(await consultar(l190.id, 2000, { ajuste: { tipo: 'precio', importeCentimos: 75_000 } })).toMatchObject({ precioListaCentimos: 79_500, importeCentimos: 75_000 });
    await configurar({ redondeoComercial: 'ninguno' });
  });

  it('cliente −10 % → 713.93 y lo declara; +5.5 % → 836.89; sin ajuste no declara nada', async () => {
    const menos = await ajustarCliente('-10');
    expect(await consultar(l190.id, 2000, { clienteId: menos })).toMatchObject({ precioListaCentimos: 71_393, importeCentimos: 71_393, ajusteClientePct: '-10' });
    const mas = await ajustarCliente('5.5');
    expect((await consultar(l190.id, 2000, { clienteId: mas })).precioListaCentimos).toBe(83_689);
    expect((await consultar(l190.id, 2000)).ajusteClientePct).toBeNull();
  });

  it('el orden es lista → cliente → redondeo → ajuste manual: −10 % y redondeo 5 → 715.00; + monto 100 → 815.00; con precio 700 → lista 713.93 y final 700.00', async () => {
    const menos = await ajustarCliente('-10');
    await configurar({ redondeoComercial: '5' });
    expect((await consultar(l190.id, 2000, { clienteId: menos })).precioListaCentimos).toBe(71_500);
    expect(await consultar(l190.id, 2000, { clienteId: menos, ajuste: { tipo: 'monto', importeCentimos: 10_000 } })).toMatchObject({ precioListaCentimos: 71_500, importeCentimos: 81_500 });
    await configurar({ redondeoComercial: 'ninguno' });
    expect(await consultar(l190.id, 2000, { clienteId: menos, ajuste: { tipo: 'precio', importeCentimos: 70_000 } })).toMatchObject({ precioListaCentimos: 71_393, importeCentimos: 70_000 });
  });

  it('el mínimo se redondea también (251.30 con redondeo 5 → 255.00)', async () => {
    const m = await lista('Mínimo 251.30', 19_000, 58_000, 120_000, { precioMinimoCentimos: 25_130 });
    await configurar({ redondeoComercial: '5' });
    expect(await consultar(m.id, 100)).toMatchObject({ precioListaCentimos: 25_500, minimoAplicado: true });
    await configurar({ redondeoComercial: 'ninguno' });
  });

  it('el ajuste manual: monto +100 → 893.26 (unitario 0.4466), monto −93.26 → 700.00 (0.3500), precio 750 → 750.00 (0.3750); la lista no cambia', async () => {
    expect(await consultar(l190.id, 2000, { ajuste: { tipo: 'monto', importeCentimos: 10_000 } })).toMatchObject({ precioListaCentimos: 79_326, importeCentimos: 89_326, precioUnitarioMilesimas: 447 });
    expect(await consultar(l190.id, 2000, { ajuste: { tipo: 'monto', importeCentimos: -9_326 } })).toMatchObject({ precioListaCentimos: 79_326, importeCentimos: 70_000, precioUnitarioMilesimas: 350 });
    expect(await consultar(l190.id, 2000, { ajuste: { tipo: 'precio', importeCentimos: 75_000 } })).toMatchObject({ precioListaCentimos: 79_326, importeCentimos: 75_000, precioUnitarioMilesimas: 375 });
  });

  it('un final de cero o menos se rechaza (precio_no_positivo): monto −793.26, monto −900.00, precio 0', async () => {
    for (const ajuste of [{ tipo: 'monto', importeCentimos: -79_326 }, { tipo: 'monto', importeCentimos: -90_000 }, { tipo: 'precio', importeCentimos: 0 }]) {
      const r = await dueno.herramienta('precio_consultar', { listaId: l190.id, cantidadMilesimas: 2_000_000, ajuste });
      expect(r.cuerpo.ok, JSON.stringify(ajuste)).toBe(false);
    }
  });
});

describe('ajuste por cotización y su efecto en IGV y total (IGV 18 y 0)', () => {
  let cliente: string;
  beforeAll(async () => {
    cliente = await crearCliente(dueno, 'Cliente de la cotización');
  });
  const linea = (ajuste?: unknown) => ({ tipo: 'lista', listaId: l190.id, cantidadMilesimas: 2_000_000, ...(ajuste ? { ajuste } : {}) });
  const cotizar = (lineas: unknown[]) => datosDe(dueno, 'cotizacion_crear', { titulo: 'Paridad ajuste', clienteId: cliente, lineas });

  it('IGV 18: sin ajuste 793.26 + 142.79 = 936.05; monto +100 → 893.26 + 160.79 = 1,054.05; precio 750 → 750.00 + 135.00 = 885.00', async () => {
    const c = await cotizar([linea(), linea({ tipo: 'monto', importeCentimos: 10_000 }), linea({ tipo: 'precio', importeCentimos: 75_000 })]);
    expect(c.lineas.map((l: any) => [l.precioListaCentimos, l.importeCentimos, l.igvCentimos, l.totalCentimos])).toEqual([
      [79_326, 79_326, 14_279, 93_605],
      [79_326, 89_326, 16_079, 105_405],
      [79_326, 75_000, 13_500, 88_500],
    ]);
    expect(c.subtotalCentimos).toBe(79_326 + 89_326 + 75_000);
    expect(c.totalCentimos).toBe(c.subtotalCentimos + c.igvCentimos);
    expect(c.igvCentimos).toBe(14_279 + 16_079 + 13_500);
  });

  it('IGV 0: el total es el subtotal y las líneas no llevan IGV; al volver a 18 se recalcula', async () => {
    await configurar({ igvPorcentaje: 0 });
    const c = await cotizar([linea({ tipo: 'monto', importeCentimos: 10_000 })]);
    expect(c).toMatchObject({ igvPorcentaje: 0, igvCentimos: 0, subtotalCentimos: 89_326, totalCentimos: 89_326 });
    expect((await consultar(l190.id, 2000))).toMatchObject({ igvPorcentaje: 0, igvCentimos: 0, totalCentimos: 79_326 });
    await configurar({ igvPorcentaje: 18 });
    expect((await consultar(l190.id, 2000))).toMatchObject({ igvPorcentaje: 18, igvCentimos: 14_279, totalCentimos: 93_605 });
  });

  it('un ajuste que deja el final en cero o menos rechaza la cotización', async () => {
    const r = await dueno.herramienta('cotizacion_crear', { titulo: 'Final cero', clienteId: cliente, lineas: [linea({ tipo: 'monto', importeCentimos: -79_326 })] });
    expect(codigoDe(r)).toBe('argumentos_invalidos');
  });

  it('una línea fuera de 100 a 5.000 rechaza la cotización con «cotizar aparte»', async () => {
    const r = await dueno.herramienta('cotizacion_crear', { titulo: 'Fuera', clienteId: cliente, lineas: [{ tipo: 'lista', listaId: l190.id, cantidadMilesimas: 5_001_000 }] });
    expect(r.cuerpo.ok).toBe(false);
    expect(r.cuerpo.error.mensaje).toContain('cotizar aparte');
  });
});

describe('invariantes A y B al crear y al editar (validar-referencias.test.ts)', () => {
  it('B bloquea al crear: 190 / 150 / 400, un total igual (190 / 190 / 400), el segundo tramo (100 / 500 / 400), un total en cero; ni confirmando se salva', async () => {
    for (const [a, b, c] of [[19_000, 15_000, 40_000], [19_000, 19_000, 40_000], [10_000, 50_000, 40_000], [0, 58_000, 120_000]]) {
      const args = { nombre: `Rota ${a}/${b}/${c}`, p100Centimos: a, p1000Centimos: b, p5000Centimos: c };
      expect(codigoDe(await dueno.herramienta('lista_precio_crear', args)), `${a}/${b}/${c}`).toBe('argumentos_invalidos');
      expect(codigoDe(await dueno.herramienta('lista_precio_crear', { ...args, confirmarUnitarioNoBaja: true })), `${a}/${b}/${c} confirmado`).toBe('argumentos_invalidos');
    }
    const r = await dueno.herramienta('lista_precio_crear', { nombre: 'Rota mensaje', p100Centimos: 19_000, p1000Centimos: 15_000, p5000Centimos: 40_000 });
    expect(r.cuerpo.error.mensaje).toContain('1000 unidades');
  });

  it('A avisa y pide confirmar: 100 / 1.000 / 3.000 (P1000 = 10 × P100), 100 / 300 / 1.500 (P5000 = 5 × P1000) y el tope exacto 999.99 / 4,999.95; un centavo menos pasa limpio', async () => {
    const vectores: [number, number, number, boolean][] = [[10_000, 100_000, 300_000, true], [10_000, 30_000, 150_000, true], [10_000, 120_000, 200_000, true], [10_000, 99_999, 499_995, true], [10_000, 99_999, 499_994, false]];
    for (const [a, b, c, avisa] of vectores) {
      const args = { nombre: `Aviso ${a}/${b}/${c}`, p100Centimos: a, p1000Centimos: b, p5000Centimos: c };
      const sin = await dueno.herramienta('lista_precio_crear', args);
      if (avisa) {
        expect(codigoDe(sin), `${b}/${c} sin confirmar`).toBe('conflicto');
        expect(sin.cuerpo.error.mensaje).toContain('Confirma para guardarlo igual');
        expect((await datosDe(dueno, 'lista_precio_crear', { ...args, confirmarUnitarioNoBaja: true })).aConfirmado).toBe(true);
      } else expect(sin.cuerpo.datos.aConfirmado).toBe(false);
    }
  });

  it('el mensaje de A dice «10 veces el de 100 (1000.00)» en el primer caso', async () => {
    const r = await dueno.herramienta('lista_precio_crear', { nombre: 'Mensaje A', p100Centimos: 10_000, p1000Centimos: 100_000, p5000Centimos: 300_000 });
    expect(r.cuerpo.error.mensaje).toMatch(/10 veces/);
  });

  it('al editar rige lo mismo: B rechaza de inmediato, A pide la confirmación crítica y luego confirmarUnitarioNoBaja', async () => {
    const l = await lista('Editable', 19_000, 58_000, 120_000);
    expect(codigoDe(await dueno.herramienta('lista_precio_editar', { id: l.id, p1000Centimos: 15_000 }))).toBe('argumentos_invalidos');
    expect(codigoDe(await dueno.herramienta('lista_precio_editar', { id: l.id, p100Centimos: 5_800 }))).toBe('conflicto');
    const ok = await confirmando(dueno, 'lista_precio_editar', { id: l.id, p100Centimos: 5_800, confirmarUnitarioNoBaja: true });
    expect(ok.respuesta.cuerpo.datos).toMatchObject({ p100Centimos: 5_800, aConfirmado: true });
    const limpia = await confirmando(dueno, 'lista_precio_editar', { id: l.id, p100Centimos: 19_000 });
    expect(limpia.respuesta.cuerpo.ok).toBe(true);
  });

  it('otra empresa no ve ni consulta la lista', async () => {
    expect(codigoDe(await ajeno.herramienta('precio_consultar', { listaId: l190.id, cantidadMilesimas: 1_000_000 }))).toBe('no_encontrado');
  });
});
