import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type pg from 'pg';
import { z } from 'zod';
import { abrirSesion, crearEmpresa, type Sesion } from '../herramientas/http-de-pruebas.js';
import { levantarApp, type AppDePruebas } from '../../pruebas/app-de-pruebas.js';
import { abrirPool, comoEmpresa } from '../../pruebas/base-de-pruebas.js';
import { MODELO_DE_LENGUAJE, type ModeloDeLenguaje } from './modelo-de-lenguaje.js';
import { ModeloDeLenguajeOpenRouter } from './modelo-de-lenguaje-openrouter.js';
import { RegistroDeInterpretes } from './registro-de-interpretes.js';
import type { InterpreteDeCaptura } from './tipos.js';

// El cliente de OpenRouter de verdad, con un `fetch` FALSO (nunca sale a la red), contra la base real: el tope mensual se lee de
// `core.uso` de la empresa y el costo de cada extracción queda ahí con origen `captura`. Si el modelo no responde, siguen las reglas.

const LLAVE = 'sk-or-v1-falsa-de-prueba-0000000000000000';
const MODELO = 'anthropic/claude-sonnet-5.5';

let app: AppDePruebas;
let appPool: pg.Pool;
let dueno: Sesion;
let A: string;
let responder: () => Response;
const pedidos: Array<{ cuerpo: any; autorizacion: string | undefined }> = [];
let tope = 5_000_000;

const interprete: InterpreteDeCaptura = {
  modulo: 'registro',
  esquemaParaModelo: z.strictObject({ montoCentimos: z.number().int().positive().nullable() }),
  instrucciones: 'Extrae el monto en céntimos.',
  async interpretar(_tx, _ctx, e) {
    const monto = (e.extraccion as { montoCentimos: number | null } | null)?.montoCentimos ?? 100;
    return { propuestas: [{ herramienta: 'movimiento_registrar', args: { tipo: 'ingreso', montoCentimos: monto, origen: 'voz' }, resumen: 'Ingreso' }], faltan: [], pista: null };
  },
};

const fetchFalso = (async (_url: string, init: RequestInit) => {
  pedidos.push({ cuerpo: JSON.parse(init.body as string), autorizacion: (init.headers as Record<string, string>).Authorization });
  return responder();
}) as unknown as typeof fetch;

const completado = (contenido: string) =>
  new Response(
    JSON.stringify({
      choices: [{ message: { role: 'assistant', content: contenido }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 900, completion_tokens: 120, prompt_tokens_details: { cached_tokens: 0 }, cost: 0.0045 },
    }),
    { status: 200 },
  );

const dictar = async (texto: string) => {
  const r = await dueno.herramienta('captura_proponer', { texto, origen: 'voz', transcurridoMs: 2000, modulo: 'registro' });
  if (r.estado !== 200) throw new Error(`Se esperaba 200: ${JSON.stringify(r.cuerpo)}`);
  return r.cuerpo.datos;
};
const usos = () => comoEmpresa(appPool, A, async (c) => (await c.query(`select * from core.uso where origen = 'captura' order by creado_en`)).rows);

beforeAll(async () => {
  app = await levantarApp({ alta: 'abierta' });
  appPool = abrirPool('app');
  app.obtener(RegistroDeInterpretes).fijar(interprete);
  // El modelo de verdad (sin base propia: usa la transacción de quien dicta), con el tope que diga cada prueba.
  vi.spyOn(app.obtener<ModeloDeLenguaje>(MODELO_DE_LENGUAJE), 'extraer').mockImplementation((esquema, instrucciones, texto, tx) =>
    new ModeloDeLenguajeOpenRouter({ apiKey: LLAVE, modelo: MODELO, topeMensualMicrousd: tope, fetch: fetchFalso }).extraer(esquema, instrucciones, texto, tx),
  );
  dueno = await abrirSesion(app, 'Dueña');
  A = await crearEmpresa(dueno, 'Extracción con OpenRouter');
  const r = await dueno.herramienta('registro_iniciar', {});
  expect(r.estado).toBe(200);
});
afterAll(async () => {
  vi.restoreAllMocks();
  await app.cerrar();
  await appPool.end();
});

describe('extracción con OpenRouter (fetch falso, base real)', () => {
  it('usa lo extraído, dice «modelo» y deja el uso de captura con su costo', async () => {
    responder = () => completado('{"montoCentimos":8000}');
    const d = await dictar('me pagó Rosa 80');
    expect(d.interpretadoCon).toBe('modelo');
    expect(d.borradores[0].args).toMatchObject({ montoCentimos: 8000 });
    expect(pedidos.at(-1)!.autorizacion).toBe(`Bearer ${LLAVE}`);
    expect(pedidos.at(-1)!.cuerpo.messages[1]).toEqual({ role: 'user', content: 'me pagó Rosa 80' });
    const filas = await usos();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ origen: 'captura', modelo: MODELO, tokens_entrada: 900, tokens_salida: 120, rondas: 1, resultado: 'ok', usuario_id: dueno.usuarioId });
    expect(Number(filas[0].costo_microusd)).toBe(4500);
  });

  it('una respuesta que no cumple el esquema: siguen las reglas, pero lo gastado se anota', async () => {
    responder = () => completado('{"montoCentimos":"ochenta"}');
    const d = await dictar('me pagó Rosa 80');
    expect(d.interpretadoCon).toBe('reglas');
    expect(d.borradores[0].args).toMatchObject({ montoCentimos: 100 });
    expect((await usos()).map((u: any) => u.resultado)).toEqual(['ok', 'error']);
  });

  it('el proveedor falla (429): siguen las reglas, el borrador se propone igual y no se anota uso', async () => {
    responder = () => new Response(JSON.stringify({ error: { message: 'rate limited' } }), { status: 429 });
    const d = await dictar('me pagó Rosa 80');
    expect(d.interpretadoCon).toBe('reglas');
    expect(d.borradores).toHaveLength(1);
    expect(await usos()).toHaveLength(2);
  });

  it('con el tope del mes alcanzado no se llama al modelo', async () => {
    const antes = pedidos.length;
    tope = 9000; // ya se gastaron 9000 millonésimas
    try {
      responder = () => completado('{"montoCentimos":8000}');
      const d = await dictar('me pagó Rosa 80');
      expect(d.interpretadoCon).toBe('reglas');
      expect(d.borradores[0].args).toMatchObject({ montoCentimos: 100 });
      expect(pedidos.length).toBe(antes);
    } finally {
      tope = 5_000_000;
    }
  });
});
