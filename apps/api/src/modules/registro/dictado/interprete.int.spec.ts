import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { abrirSesion, agregarMiembro, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../../pruebas/base-de-pruebas.js';
import { codigoDe, datosDe, diaMas, HOY } from '../herramientas/pruebas-de-registro.js';

// «Frase → borrador» por HTTP real con captura_proponer: veinte casos de la ficha de s5b. Proponer no escribe en el negocio.

type Propuesta = { id: string; herramienta: string; resumen: string; args: any; sugerencias: any[] };
type Respuesta = { borradores: Propuesta[]; faltan: string[]; pista: string | null };

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let vendedor: Sesion;
let A: string;
const cli: Record<string, string> = {};
const deudas: Record<string, string> = {};
const caso: Record<number, Respuesta> = {};
let antes: { movimientos: number; deudas: number };

const contar = (tabla: string) => comoEmpresa(appPool, A, async (c) => Number((await c.query(`select count(*)::int as n from registro.${tabla}`)).rows[0].n));
const dictar = async (s: Sesion, texto: string, extra: Record<string, unknown> = {}): Promise<Respuesta> =>
  datosDe(s, 'captura_proponer', { texto, origen: 'voz', transcurridoMs: 3000, modulo: 'registro', ...extra });
const unico = (n: number): Propuesta => {
  expect(caso[n]!.borradores).toHaveLength(1);
  return caso[n]!.borradores[0]!;
};
const aprobar = (id: string) => dueno.herramienta('borrador_aprobar', { id });

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  [dueno, vendedor] = await Promise.all(['Dueña', 'Vendedora'].map((n) => abrirSesion(app, n)));
  A = await crearEmpresa(dueno, 'Dictado A');
  await agregarMiembro(app, A, vendedor, { modulo: 'registro', nivel: 'completo', alcance: 'propios' });
  await datosDe(dueno, 'registro_iniciar', {});
  for (const n of ['Juan Pérez', 'Cristina Neira', 'Comercial Pacheco', 'Rosa Díaz', 'Rosa Diez']) cli[n] = (await datosDe(dueno, 'clientes_crear', { nombre: n })).id;
  const deuda = async (c: string, total: number, fecha: string) =>
    (await datosDe(dueno, 'deuda_crear', { tipo: 'por_cobrar', contactoId: cli[c], concepto: 'Trabajo', totalCentimos: total, fecha })).id as string;
  deudas.juan = await deuda('Juan Pérez', 30_000, diaMas(-5));
  deudas.cristina1 = await deuda('Cristina Neira', 20_000, diaMas(-10));
  deudas.cristina2 = await deuda('Cristina Neira', 15_000, diaMas(-3));
  antes = { movimientos: await contar('movimientos'), deudas: await contar('deudas') };

  const frases: Array<[number, string, Record<string, unknown>?]> = [
    [1, 'Ingreso 500 soles, cliente Juan Pérez, flyers'],
    [2, 'egreso 45.50 tinta negra'],
    [3, 'ingreso de mil quinientos soles'],
    [4, 'le compré a Comercial Pacheco unas cartulinas y me salieron 350 soles'],
    [5, 'pagué el recibo de luz 180 soles ayer'],
    [6, 'me pagó la señora Rosa 80 soles'],
    [7, 'Ingreso 200 soles, cliente Wilfredo, volantes'],
    [8, 'Juan Pérez abona 100 soles de su deuda'],
    [9, 'Cristina Neira abona 50 de su deuda'],
    [10, 'Comercial Pacheco abona 100 de su deuda'],
    [11, 'Juan Pérez abona 900 de su deuda'],
    [12, 'Contrato 240, adelanto 100, cliente Cristina Neira'],
    [13, 'contrato 100 adelanto 100 cliente Cristina Neira'],
    [14, 'Cristina Neira me quedó debiendo 240'],
    [15, 'le debo a Comercial Pacheco 500 de papel'],
    [16, 'Contrato 300, adelanto 50, cliente Mateo'],
    [171, '350 de cartulina'],
    [172, '350 de cartulina', { modo: 'egreso' }],
    [181, 'Hazle una proforma a Juan por 500 tarjetas a 180 soles'],
    [182, 'hola que tal'],
    [19, 'Ingreso 500 soles, cliente Juan Pérez, flyers', { origen: 'texto' }],
  ];
  for (const [n, texto, extra] of frases) caso[n] = await dictar(dueno, texto, extra);
});
afterAll(async () => {
  const filas = Object.entries(caso).map(([n, r]) => `${n} · ${r.borradores.map((b) => `${b.herramienta} ${JSON.stringify(b.args)} [${b.resumen}]`).join(' + ') || 'sin borrador'} · faltan=${JSON.stringify(r.faltan)} · pista=${r.pista ? 'sí' : 'no'} · sugerencias=${JSON.stringify(r.borradores.flatMap((b) => b.sugerencias.map((s) => s.opciones.length)))}`);
  console.log(`TABLA DE FRASES\n${filas.join('\n')}`);
  await app.cerrar();
  await appPool.end();
});

describe('proponer no escribe', () => {
  it('después de proponer los casos no hay movimientos ni deudas nuevos', async () => {
    expect(await contar('movimientos')).toBe(antes.movimientos);
    expect(await contar('deudas')).toBe(antes.deudas);
  });
});

describe('movimientos', () => {
  it('1 · ingreso con cliente: origen voz; al aprobar nace el movimiento con origen voz', async () => {
    const b = unico(1);
    expect(b.herramienta).toBe('movimiento_registrar');
    expect(b.args).toMatchObject({ tipo: 'ingreso', montoCentimos: 50_000, contactoId: cli['Juan Pérez'], origen: 'voz' });
    expect(b.resumen).toBe('Ingreso de S/ 500.00 · Juan Pérez · Flyers');
    const r = await aprobar(b.id);
    expect(r.estado).toBe(200);
    expect(r.cuerpo.datos.resultado.datos ?? r.cuerpo.datos).toBeTruthy();
    const mov = (await datosDe(dueno, 'movimientos_listar', { contactoId: cli['Juan Pérez'] })).items;
    expect(mov[0]).toMatchObject({ origen: 'voz', montoCentimos: 50_000, tipo: 'ingreso' });
  });

  it('2 · egreso sin cliente: categoría «Compras»', async () => {
    const b = unico(2);
    expect(b.herramienta).toBe('movimiento_registrar');
    expect(b.args).toMatchObject({ tipo: 'egreso', montoCentimos: 4_550 });
    expect(b.args.contactoId).toBeUndefined();
    const cat = (await datosDe(dueno, 'categorias_listar', { tipo: 'egreso' })).items.find((c: any) => c.nombre === 'Compras');
    expect(b.args.categoriaId).toBe(cat.id);
  });

  it('3 · «mil quinientos soles» sin cliente', () => {
    const b = unico(3);
    expect(b.args).toMatchObject({ tipo: 'ingreso', montoCentimos: 150_000 });
    expect(b.args.contactoId).toBeUndefined();
  });

  it('4 · compra a un proveedor conocido', async () => {
    const b = unico(4);
    expect(b.args).toMatchObject({ tipo: 'egreso', montoCentimos: 35_000, contactoId: cli['Comercial Pacheco'] });
    const cat = (await datosDe(dueno, 'categorias_listar', { tipo: 'egreso' })).items.find((c: any) => c.nombre === 'Compras');
    expect(b.args.categoriaId).toBe(cat.id);
  });

  it('5 · recibo de luz ayer: «Servicios» y la fecha de ayer de la empresa', async () => {
    const b = unico(5);
    expect(b.args).toMatchObject({ tipo: 'egreso', montoCentimos: 18_000, fecha: diaMas(-1, HOY.dia) });
    const cat = (await datosDe(dueno, 'categorias_listar', { tipo: 'egreso' })).items.find((c: any) => c.nombre === 'Servicios');
    expect(b.args.categoriaId).toBe(cat.id);
    expect(b.args.contactoId).toBeUndefined();
    expect(b.args.descripcion ?? '').not.toMatch(/·\s*Recibo/i);
    expect(b.sugerencias).toEqual([]);
  });

  it('6 · «la señora Rosa»: sin contacto y con dos opciones', () => {
    const b = unico(6);
    expect(b.args).toMatchObject({ tipo: 'ingreso', montoCentimos: 8_000 });
    expect(b.args.contactoId).toBeUndefined();
    expect(b.sugerencias).toHaveLength(1);
    expect(b.args.descripcion ?? '').not.toContain('· Rosa');
    expect(b.sugerencias[0].opciones.map((o: any) => o.id).sort()).toEqual([cli['Rosa Díaz'], cli['Rosa Diez']].sort());
  });

  it('7 · cliente desconocido: sin contacto, descripción con «· Wilfredo» y sugerencia sin opciones', () => {
    const b = unico(7);
    expect(b.args).toMatchObject({ tipo: 'ingreso', montoCentimos: 20_000 });
    expect(b.args.contactoId).toBeUndefined();
    expect(b.args.descripcion).toMatch(/ · Wilfredo$/);
    expect(b.sugerencias).toEqual([expect.objectContaining({ campo: 'contactoId', texto: 'Wilfredo', opciones: [] })]);
  });
});

describe('abonos', () => {
  it('8 · abono a la deuda de Juan: al aprobar, saldo 200.00 y movimiento con origen voz', async () => {
    const b = unico(8);
    expect(b.herramienta).toBe('deuda_abonar');
    expect(b.args).toEqual({ id: deudas.juan, montoCentimos: 10_000, origen: 'voz' });
    expect(caso[8]!.faltan).toEqual([]);
    expect((await aprobar(b.id)).estado).toBe(200);
    const d = await datosDe(dueno, 'deuda_ver', { id: deudas.juan });
    expect(d).toMatchObject({ saldoCentimos: 20_000, estado: 'parcial' });
    expect(d.abonos[0]).toMatchObject({ origen: 'voz', montoCentimos: 10_000 });
  });

  it('9 · dos deudas abiertas: la más antigua y una sugerencia con las dos', () => {
    const b = unico(9);
    expect(b.herramienta).toBe('deuda_abonar');
    expect(b.args).toMatchObject({ id: deudas.cristina1, montoCentimos: 5_000 });
    expect(b.sugerencias).toEqual([expect.objectContaining({ campo: 'id', texto: '2 deudas abiertas' })]);
    expect(b.sugerencias[0].opciones.map((o: any) => o.id)).toEqual([deudas.cristina1, deudas.cristina2]);
    expect(b.sugerencias[0].opciones[0].detalle).toBe('Saldo S/ 200.00');
  });

  it('10 · sin deudas: movimiento simple y aviso', () => {
    const b = unico(10);
    expect(b.herramienta).toBe('movimiento_registrar');
    expect(b.args).toMatchObject({ tipo: 'ingreso', montoCentimos: 10_000, contactoId: cli['Comercial Pacheco'] });
    expect(caso[10]!.faltan[0]).toContain('no tiene deudas abiertas');
  });

  it('11 · monto mayor que el saldo: se propone igual, avisa y aprobar da conflicto con el borrador pendiente', async () => {
    const b = unico(11);
    expect(b.herramienta).toBe('deuda_abonar');
    expect(b.args).toMatchObject({ id: deudas.juan, montoCentimos: 90_000 });
    expect(caso[11]!.faltan[0]).toContain('supera el saldo');
    expect(codigoDe(await aprobar(b.id))).toBe('conflicto');
    expect((await datosDe(dueno, 'borrador_ver', { id: b.id })).estado).toBe('pendiente');
  });
});

describe('deudas', () => {
  it('12 · contrato con adelanto: al aprobar, deuda parcial', async () => {
    const b = unico(12);
    expect(b.herramienta).toBe('deuda_crear_con_adelanto');
    expect(b.args).toMatchObject({ tipo: 'por_cobrar', totalCentimos: 24_000, adelantoCentimos: 10_000, contactoId: cli['Cristina Neira'], origen: 'voz' });
    const r = await aprobar(b.id);
    expect(r.estado).toBe(200);
    const lista = (await datosDe(dueno, 'deudas_listar', { tipo: 'por_cobrar', contactoId: cli['Cristina Neira'] })).items;
    expect(lista.find((d: any) => d.totalCentimos === 24_000)).toMatchObject({ estado: 'parcial', saldoCentimos: 14_000 });
  });

  it('13 · adelanto igual al total: no es deuda_crear_con_adelanto', () => {
    expect(caso[13]!.borradores.map((b) => b.herramienta)).not.toContain('deuda_crear_con_adelanto');
  });

  it('14 · «me quedó debiendo»: deuda por cobrar', () => {
    const b = unico(14);
    expect(b.herramienta).toBe('deuda_crear');
    expect(b.args).toMatchObject({ tipo: 'por_cobrar', totalCentimos: 24_000, contactoId: cli['Cristina Neira'] });
  });

  it('15 · «le debo a…»: deuda por pagar', () => {
    const b = unico(15);
    expect(b.herramienta).toBe('deuda_crear');
    expect(b.args).toMatchObject({ tipo: 'por_pagar', totalCentimos: 50_000, contactoId: cli['Comercial Pacheco'] });
  });

  it('16 · cliente nuevo: sin contactoId, faltan lo avisa; tras crearlo y corregir, aprobar funciona y queda corregido', async () => {
    const b = unico(16);
    expect(b.herramienta).toBe('deuda_crear_con_adelanto');
    expect(b.args).toMatchObject({ totalCentimos: 30_000, adelantoCentimos: 5_000 });
    expect(b.args.contactoId).toBeUndefined();
    expect(caso[16]!.faltan).toContain('cliente nuevo: «Mateo»');
    const mateo = (await datosDe(dueno, 'clientes_crear', { nombre: 'Mateo' })).id;
    await datosDe(dueno, 'borrador_corregir', { id: b.id, args: { ...b.args, contactoId: mateo } });
    const r = await aprobar(b.id);
    expect(r.estado).toBe(200);
    expect(r.cuerpo.datos.borrador).toMatchObject({ estado: 'aprobado', corregido: true });
  });
});

describe('sin propuesta y orígenes', () => {
  it('17 · sin modo: pregunta si entró o salió; con modo egreso: movimiento', () => {
    expect(caso[171]).toMatchObject({ borradores: [], faltan: ['si entró o salió'] });
    const b = unico(172);
    expect(b.args).toMatchObject({ tipo: 'egreso', montoCentimos: 35_000 });
  });

  it('18 · proforma y saludo: sin borrador y con pista', () => {
    for (const n of [181, 182]) {
      expect(caso[n]!.borradores).toEqual([]);
      expect(caso[n]!.pista).toBeTruthy();
    }
  });

  it('19 · origen «texto»: borrador de texto y movimiento con origen «teclado»', async () => {
    const b = unico(19);
    expect(b.args.origen).toBe('teclado');
    expect(await datosDe(dueno, 'borrador_ver', { id: b.id })).toMatchObject({ origen: 'texto' });
  });

  it('20 · un member con alcance «propios» no ve la deuda ajena: movimiento con aviso', async () => {
    const r = await dictar(vendedor, 'Juan Pérez abona 100 soles de su deuda');
    expect(r.borradores).toHaveLength(1);
    expect(r.borradores[0]!.herramienta).toBe('movimiento_registrar');
    expect(r.faltan[0]).toContain('no tiene deudas abiertas');
    caso[20] = r;
  });
});
