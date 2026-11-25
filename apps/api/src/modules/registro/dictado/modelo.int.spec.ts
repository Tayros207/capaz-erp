import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { z } from 'zod';
import { MODELO_DE_LENGUAJE, type ModeloDeLenguaje } from '../../../core/captura/modelo-de-lenguaje.js';
import { abrirSesion, activarModulo, crearEmpresa, type Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../../pruebas/app-de-pruebas.js';
import { diaMas, hoyDePrueba } from '../../../pruebas/fechas.js';
import { datosDe } from '../herramientas/pruebas-de-registro.js';
import { esquemaDelModelo, INSTRUCCIONES_DEL_MODELO, type ExtraccionDelModelo } from './esquema-del-modelo.js';

// «Frase → borrador» por HTTP real con captura_proponer y un MODELO FALSO (nunca sale a la red): el modelo segmenta, el intérprete
// de Finanzas resuelve los nombres a ids con sus reglas y fusiona; nada se ejecuta al proponer.

type Propuesta = { id: string; herramienta: string; resumen: string; args: any; sugerencias: any[] };
type Respuesta = { borradores: Propuesta[]; faltan: string[]; pista: string | null; interpretadoCon: 'reglas' | 'modelo' };

const NADA: ExtraccionDelModelo = {
  intencion: 'otro',
  tipo: null,
  montoCentimos: null,
  adelantoCentimos: null,
  tipoDeDeuda: null,
  contactoNombre: null,
  descripcion: null,
  fechaDicha: null,
  medioDePago: null,
  cuentaNombre: null,
  lineas: [],
  entregaDicha: null,
};
const INGRESO = 'Ingreso 500 soles, cliente Juan Pérez, flyers';
const ROSA = 'me pagó Rosa 80';
const PEDIDO = 'crea una orden de pedido: cliente juan perez descripcion: fabricacion de un troquel grafico valor de producto 180 soles deja adelanto 90 soles';
const TINTA = 'el lunes pagué 120 de tinta por yape desde el BCP';
const CARTULINA = '350 de cartulina';

/** Lo que «entiende» el modelo falso para cada frase. Sin entrada: `null`, como sin modelo. */
const respuestas = new Map<string, Partial<ExtraccionDelModelo>>([
  [INGRESO, { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 50000, contactoNombre: 'Juan Pérez', descripcion: 'flyers' }],
  [ROSA, { intencion: 'movimiento', tipo: 'ingreso', montoCentimos: 8000, contactoNombre: 'Rosa' }],
  [
    PEDIDO,
    {
      intencion: 'pedido',
      contactoNombre: 'Juan Pérez',
      adelantoCentimos: 9000,
      lineas: [{ descripcion: 'Fabricación de un troquel gráfico', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 180000 }],
    },
  ],
  [TINTA, { intencion: 'movimiento', tipo: 'egreso', montoCentimos: 12000, descripcion: 'tinta', fechaDicha: 'el lunes', medioDePago: 'yape', cuentaNombre: 'BCP' }],
  [CARTULINA, { intencion: 'movimiento', tipo: 'egreso', montoCentimos: 35000, descripcion: 'cartulina' }],
]);

let app: AppDePruebas;
let dueno: Sesion;
let llamadas: Array<{ esquema: z.ZodType; instrucciones: string; texto: string; conTx: boolean }>;
let conModelo = true;
const cli: Record<string, string> = {};
let bcp: string;

const dictar = async (texto: string, extra: Record<string, unknown> = {}): Promise<Respuesta> =>
  datosDe(dueno, 'captura_proponer', { texto, origen: 'voz', transcurridoMs: 3000, modulo: 'registro', ...extra });
const unico = (r: Respuesta): Propuesta => {
  expect(r.borradores).toHaveLength(1);
  return r.borradores[0]!;
};
/** El último lunes antes de hoy (dicho un lunes, el de la semana pasada). */
function ultimoLunes(): string {
  const dia = new Date(`${hoyDePrueba()}T12:00:00Z`).getUTCDay();
  return diaMas(-((dia - 1 + 7) % 7 || 7));
}

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  llamadas = [];
  // El modelo falso valida con el esquema que recibe, como el real.
  vi.spyOn(app.obtener<ModeloDeLenguaje>(MODELO_DE_LENGUAJE), 'extraer').mockImplementation(async (esquema, instrucciones, texto, tx) => {
    llamadas.push({ esquema, instrucciones, texto, conTx: tx !== undefined });
    const r = conModelo ? respuestas.get(texto) : undefined;
    return r === undefined ? null : esquema.parse({ ...NADA, ...r });
  });
  dueno = await abrirSesion(app, 'Dueña');
  const A = await crearEmpresa(dueno, 'Dictado con modelo');
  await activarModulo(A, 'ordenes');
  await datosDe(dueno, 'registro_iniciar', {});
  for (const n of ['Juan Pérez', 'Rosa Díaz']) cli[n] = (await datosDe(dueno, 'clientes_crear', { nombre: n })).id;
  bcp = (await datosDe(dueno, 'cuenta_crear', { nombre: 'BCP', tipo: 'banco' })).id;
});
afterAll(async () => {
  vi.restoreAllMocks();
  await app.cerrar();
});

describe('dictado con modelo (falso)', () => {
  it('el intérprete de Finanzas manda su esquema y sus instrucciones, con la transacción de quien dicta', async () => {
    await dictar(INGRESO);
    const ultima = llamadas.at(-1)!;
    expect(ultima).toMatchObject({ instrucciones: INSTRUCCIONES_DEL_MODELO, texto: INGRESO, conTx: true });
    expect(ultima.esquema).toBe(esquemaDelModelo);
  });

  it('«Ingreso 500 soles, cliente Juan Pérez, flyers» → movimiento con el cliente resuelto a su id', async () => {
    const r = await dictar(INGRESO);
    expect(r.interpretadoCon).toBe('modelo');
    const b = unico(r);
    expect(b.herramienta).toBe('movimiento_registrar');
    expect(b.args).toMatchObject({ tipo: 'ingreso', montoCentimos: 50000, contactoId: cli['Juan Pérez'], descripcion: 'Flyers', origen: 'voz' });
    expect(r.faltan).toEqual([]);
  });

  it('«me pagó Rosa 80» → ingreso de S/ 80.00 de Rosa Díaz, sin la frase entera como descripción', async () => {
    const r = await dictar(ROSA);
    expect(r.interpretadoCon).toBe('modelo');
    const b = unico(r);
    expect(b.args).toEqual({ tipo: 'ingreso', montoCentimos: 8000, contactoId: cli['Rosa Díaz'], origen: 'voz' });
    expect(b.resumen).toBe('Ingreso de S/ 80.00 · Rosa Díaz');
  });

  it('el pedido del dueño → pedido_crear con cliente, trabajo, valor y adelanto bien separados', async () => {
    const r = await dictar(PEDIDO);
    expect(r.interpretadoCon).toBe('modelo');
    const b = unico(r);
    expect(b.herramienta).toBe('pedido_crear');
    expect(b.args).toEqual({
      clienteId: cli['Juan Pérez'],
      entregaEl: null,
      notas: 'Adelanto dictado: S/ 90.00. Cóbralo al confirmar el pedido.',
      lineas: [{ descripcion: 'Fabricación de un troquel gráfico', unidad: 'unidad', cantidadMilesimas: 1000, precioUnitarioMilesimas: 180000 }],
    });
    expect(b.resumen).toBe('Pedido para Juan Pérez · 1 línea · S/ 180.00 · adelanto S/ 90.00');
    expect(r.faltan).toEqual(['el adelanto de S/ 90.00 se cobra al confirmar el pedido']);
  });

  it('fecha dicha, medio de pago y cuenta: el servidor resuelve la fecha y la cuenta a su id', async () => {
    const b = unico(await dictar(TINTA));
    expect(b.args).toMatchObject({ tipo: 'egreso', montoCentimos: 12000, fecha: ultimoLunes(), medioDePago: 'yape', cuentaId: bcp, descripcion: 'Tinta' });
  });

  it('lo que las reglas no saben (si entró o salió) lo completa el modelo', async () => {
    const b = unico(await dictar(CARTULINA));
    expect(b.args).toMatchObject({ tipo: 'egreso', montoCentimos: 35000, descripcion: 'Cartulina' });
  });

  it('nada se ejecuta al proponer, y al aprobar el borrador vale', async () => {
    const antes = (await datosDe(dueno, 'movimientos_listar', {})).items.length;
    const b = unico(await dictar(TINTA));
    expect((await datosDe(dueno, 'movimientos_listar', {})).items.length).toBe(antes);
    const ap = await dueno.herramienta('borrador_aprobar', { id: b.id });
    expect(ap.estado).toBe(200);
    expect((await datosDe(dueno, 'movimientos_listar', {})).items.length).toBe(antes + 1);
  });

  it('sin modelo (null) siguen funcionando las reglas y lo dice `interpretadoCon`', async () => {
    conModelo = false;
    try {
      const r = await dictar(INGRESO);
      expect(r.interpretadoCon).toBe('reglas');
      expect(unico(r).args).toMatchObject({ tipo: 'ingreso', montoCentimos: 50000, contactoId: cli['Juan Pérez'], descripcion: 'Flyers' });
      const p = unico(await dictar(PEDIDO));
      expect(p.args.lineas.map((l: any) => l.precioUnitarioMilesimas)).toEqual([180000]);
      expect(p.args.notas).toBe('Adelanto dictado: S/ 90.00. Cóbralo al confirmar el pedido.');
      const c = await dictar(CARTULINA);
      expect(c.borradores).toEqual([]);
      expect(c.faltan).toEqual(['si entró o salió']);
    } finally {
      conModelo = true;
    }
  });
});
