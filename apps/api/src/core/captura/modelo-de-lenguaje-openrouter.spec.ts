import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { Transaccion } from '../../infra/database/con-empresa.js';
import type { UsoParaGuardar } from '../agente/repositorio-de-uso.js';
import { esquemaDeSalida } from './esquema-de-salida.js';
import { ModeloNulo } from './modelo-de-lenguaje.js';
import { crearModeloDeLenguaje, ModeloDeLenguajeOpenRouter, REGLAS_DE_EXTRACCION, type MotivoDeFallo } from './modelo-de-lenguaje-openrouter.js';
import type { CuentasDeUso } from './uso-de-captura.js';

// Cliente de extracción con `fetch` y cuentas falsos: nunca sale a la red ni toca la base.

const LLAVE = 'sk-or-v1-llave-que-no-debe-salir-0123456789';
const TX = {} as Transaccion;
const ESQUEMA = z.strictObject({ montoCentimos: z.number().int().positive().nullable(), nombre: z.string().max(40).nullable() });
const TEXTO = 'me pagó Rosa 80';

type Pedido = { url: string; init: RequestInit };

function respuestaJson(cuerpo: unknown, estado = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });
}

const completado = (contenido: string, extra: Record<string, unknown> = {}) => ({
  choices: [{ message: { role: 'assistant', content: contenido }, finish_reason: 'stop' }],
  usage: { prompt_tokens: 900, completion_tokens: 120, prompt_tokens_details: { cached_tokens: 0 }, cost: 0.0045 },
  ...extra,
});

function armar(responder: (p: Pedido) => Promise<Response> | Response, opciones: { presupuesto?: boolean | 'error'; registrar?: 'error'; msMaximo?: number } = {}) {
  const pedidos: Pedido[] = [];
  const usos: UsoParaGuardar[] = [];
  const avisos: Array<[MotivoDeFallo, number | undefined]> = [];
  const fetchFalso = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const p = { url: typeof url === 'string' ? url : url instanceof URL ? url.href : url.url, init: init ?? {} };
    pedidos.push(p);
    return responder(p);
  });
  const cuentas: CuentasDeUso = {
    hayPresupuesto: async () => {
      if (opciones.presupuesto === 'error') throw new Error('la base no responde');
      return opciones.presupuesto ?? true;
    },
    registrar: async (_tx, u) => {
      if (opciones.registrar === 'error') throw new Error('no se pudo insertar');
      usos.push(u);
    },
  };
  const modelo = new ModeloDeLenguajeOpenRouter({
    apiKey: LLAVE,
    modelo: 'anthropic/claude-sonnet-5.5',
    topeMensualMicrousd: 5_000_000,
    fetch: fetchFalso as unknown as typeof fetch,
    cuentas,
    ...(opciones.msMaximo ? { msMaximo: opciones.msMaximo } : {}),
    avisar: (motivo, estado) => avisos.push([motivo, estado]),
  });
  return { modelo, pedidos, usos, avisos, fetchFalso };
}

const cuerpoDe = (p: Pedido): any => JSON.parse(p.init.body as string);

describe('ModeloDeLenguajeOpenRouter', () => {
  it('respuesta válida: devuelve lo validado, pide salida estricta y privacidad, y registra el uso de captura', async () => {
    const { modelo, pedidos, usos, avisos } = armar(() => respuestaJson(completado('{"montoCentimos":8000,"nombre":"Rosa"}')));
    expect(await modelo.extraer(ESQUEMA, 'Separa monto y nombre.', TEXTO, TX)).toEqual({ montoCentimos: 8000, nombre: 'Rosa' });
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]!.url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((pedidos[0]!.init.headers as Record<string, string>).Authorization).toBe(`Bearer ${LLAVE}`);
    const c = cuerpoDe(pedidos[0]!);
    expect(c).toMatchObject({
      model: 'anthropic/claude-sonnet-5.5',
      stream: false,
      max_tokens: 2000,
      reasoning: { effort: 'low' },
      provider: { data_collection: 'deny', zdr: true, require_parameters: true },
      response_format: { type: 'json_schema', json_schema: { name: 'extraccion', strict: true } },
    });
    expect(c.response_format.json_schema.schema).toEqual(esquemaDeSalida(ESQUEMA));
    // El texto dictado va solo, como dato del usuario; las reglas y las instrucciones, en el sistema.
    expect(c.messages).toEqual([
      { role: 'system', content: `${REGLAS_DE_EXTRACCION}\n\nSepara monto y nombre.` },
      { role: 'user', content: TEXTO },
    ]);
    expect(usos).toEqual([
      expect.objectContaining({ origen: 'captura', modelo: 'anthropic/claude-sonnet-5.5', tokensEntrada: 900, tokensSalida: 120, tokensCache: 0, costoMicrousd: 4500, rondas: 1, resultado: 'ok' }),
    ]);
    expect(usos[0]!.turnoId).toMatch(/^[0-9a-f-]{36}$/);
    expect(avisos).toEqual([]);
  });

  it('un modelo que no es de Anthropic va sin razonamiento', async () => {
    const { pedidos } = armar(() => respuestaJson(completado('{"montoCentimos":null,"nombre":null}')));
    const otro = new ModeloDeLenguajeOpenRouter({
      apiKey: LLAVE,
      modelo: 'deepseek/deepseek-v4.1-flash-1017',
      topeMensualMicrousd: 1,
      fetch: (async (u: string, i: RequestInit) => {
        pedidos.push({ url: u, init: i });
        return respuestaJson(completado('{"montoCentimos":null,"nombre":null}'));
      }) as unknown as typeof fetch,
      cuentas: { hayPresupuesto: async () => true, registrar: async () => undefined },
    });
    expect(await otro.extraer(ESQUEMA, 'x', TEXTO, TX)).toEqual({ montoCentimos: null, nombre: null });
    expect(cuerpoDe(pedidos[0]!).reasoning).toEqual({ effort: 'none' });
  });

  it('acepta el JSON envuelto entre ```', async () => {
    const { modelo } = armar(() => respuestaJson(completado('```json\n{"montoCentimos":8000,"nombre":null}\n```')));
    expect(await modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toEqual({ montoCentimos: 8000, nombre: null });
  });

  it('JSON roto: null, aviso y el uso se registra como error (lo gastado cuenta para el tope)', async () => {
    const { modelo, usos, avisos } = armar(() => respuestaJson(completado('{"montoCentimos": 80')));
    expect(await modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toBeNull();
    expect(avisos).toEqual([['respuesta_ilegible', undefined]]);
    expect(usos).toEqual([expect.objectContaining({ resultado: 'error', costoMicrousd: 4500 })]);
  });

  it('respuesta que no cumple el esquema: null (decimales, campos de más o tipos equivocados)', async () => {
    for (const contenido of ['{"montoCentimos":80.5,"nombre":"Rosa"}', '{"montoCentimos":8000,"nombre":"Rosa","contactoId":"x"}', '{"montoCentimos":"8000","nombre":null}', '[]']) {
      const { modelo, avisos } = armar(() => respuestaJson(completado(contenido)));
      expect(await modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toBeNull();
      expect(avisos.map(([m]) => m)).toEqual(['no_cumple_el_esquema']);
    }
  });

  it('respuesta cortada por largo o sin contenido: null', async () => {
    const cortada = armar(() => respuestaJson({ choices: [{ message: { content: '{"montoCentimos":' }, finish_reason: 'length' }] }));
    expect(await cortada.modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toBeNull();
    expect(cortada.avisos).toEqual([['cortada', undefined]]);
    expect(cortada.usos).toEqual([]);
    const vacia = armar(() => respuestaJson({ choices: [] }));
    expect(await vacia.modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toBeNull();
    expect(vacia.avisos).toEqual([['respuesta_ilegible', undefined]]);
  });

  it('errores HTTP 400, 402, 429 y 503: null con el estado, sin registrar uso ni reintentar', async () => {
    for (const estado of [400, 402, 429, 503]) {
      const { modelo, avisos, usos, fetchFalso } = armar(() => respuestaJson({ error: { message: `fallo con ${LLAVE}` } }, estado));
      expect(await modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toBeNull();
      expect(avisos).toEqual([['http', estado]]);
      expect(usos).toEqual([]);
      expect(fetchFalso).toHaveBeenCalledTimes(1);
    }
  });

  it('tiempo agotado: corta la espera y devuelve null', async () => {
    const colgado = (p: Pedido) =>
      new Promise<Response>((_, rechazar) => {
        p.init.signal?.addEventListener('abort', () => rechazar(p.init.signal!.reason));
      });
    const { modelo, avisos } = armar(colgado, { msMaximo: 30 });
    const inicio = Date.now();
    expect(await modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toBeNull();
    expect(Date.now() - inicio).toBeLessThan(2000);
    expect(avisos).toEqual([['tiempo_agotado', undefined]]);
  });

  it('fallo de red: null', async () => {
    const { modelo, avisos } = armar(() => Promise.reject(new TypeError(`fetch failed (${LLAVE})`)));
    expect(await modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toBeNull();
    expect(avisos).toEqual([['red', undefined]]);
  });

  it('tope alcanzado o gasto ilegible: no llama al modelo y devuelve null', async () => {
    const sinTope = armar(() => respuestaJson(completado('{"montoCentimos":1,"nombre":null}')), { presupuesto: false });
    expect(await sinTope.modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toBeNull();
    expect(sinTope.fetchFalso).not.toHaveBeenCalled();
    expect(sinTope.avisos).toEqual([['sin_presupuesto', undefined]]);
    const ilegible = armar(() => respuestaJson(completado('{"montoCentimos":1,"nombre":null}')), { presupuesto: 'error' });
    expect(await ilegible.modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toBeNull();
    expect(ilegible.fetchFalso).not.toHaveBeenCalled();
    expect(ilegible.avisos).toEqual([['presupuesto_ilegible', undefined]]);
  });

  it('si no se puede registrar el uso, la extracción válida igual se devuelve', async () => {
    const { modelo, avisos } = armar(() => respuestaJson(completado('{"montoCentimos":8000,"nombre":"Rosa"}')), { registrar: 'error' });
    expect(await modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toEqual({ montoCentimos: 8000, nombre: 'Rosa' });
    expect(avisos).toEqual([['uso_no_registrado', undefined]]);
  });

  it('sin `usage` del proveedor no se registra nada', async () => {
    const { modelo, usos } = armar(() => respuestaJson({ choices: [{ message: { content: '{"montoCentimos":8000,"nombre":null}' }, finish_reason: 'stop' }] }));
    expect(await modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).toEqual({ montoCentimos: 8000, nombre: null });
    expect(usos).toEqual([]);
  });

  it('la llave nunca aparece en avisos, consola ni errores, falle como falle', async () => {
    const consola = [vi.spyOn(console, 'log'), vi.spyOn(console, 'warn'), vi.spyOn(console, 'error')];
    const registrados: unknown[] = [];
    const casos = [
      () => respuestaJson({ error: { message: LLAVE } }, 401),
      () => Promise.reject(new Error(LLAVE)),
      () => respuestaJson(completado(`{"x":"${LLAVE}"}`)),
      () => new Response(`no es json ${LLAVE}`, { status: 200 }),
    ];
    for (const responder of casos) {
      const { modelo, avisos } = armar(responder);
      await expect(modelo.extraer(ESQUEMA, 'x', TEXTO, TX)).resolves.toBeNull();
      registrados.push(...avisos);
    }
    const logger = { warn: vi.fn((...a: unknown[]) => registrados.push(a)) };
    const real = crearModeloDeLenguaje({ AGENTE_PROVEEDOR: 'openrouter', OPENROUTER_API_KEY: LLAVE, CAPTURA_MODELO: 'anthropic/claude-sonnet-5.5', AGENTE_TOPE_MENSUAL_USD: 5 }, logger);
    // Sin red: el presupuesto se lee de la base y aquí no hay base, así que corta antes de llamar.
    await expect(real.extraer(ESQUEMA, 'x', TEXTO, TX)).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    for (const espia of consola) registrados.push(...espia.mock.calls);
    expect(JSON.stringify(registrados)).not.toContain(LLAVE);
    for (const espia of consola) espia.mockRestore();
  });
});

describe('crearModeloDeLenguaje', () => {
  const base = { OPENROUTER_API_KEY: LLAVE, CAPTURA_MODELO: 'anthropic/claude-sonnet-5.5', AGENTE_TOPE_MENSUAL_USD: 5 };
  it('solo con el proveedor openrouter y su llave sale a la red; si no, ModeloNulo', () => {
    expect(crearModeloDeLenguaje({ ...base, AGENTE_PROVEEDOR: 'openrouter' })).toBeInstanceOf(ModeloDeLenguajeOpenRouter);
    expect(crearModeloDeLenguaje({ ...base, AGENTE_PROVEEDOR: 'apagado' })).toBeInstanceOf(ModeloNulo);
    expect(crearModeloDeLenguaje({ ...base, AGENTE_PROVEEDOR: 'simulado' })).toBeInstanceOf(ModeloNulo);
    expect(crearModeloDeLenguaje({ ...base, AGENTE_PROVEEDOR: 'openrouter', OPENROUTER_API_KEY: undefined })).toBeInstanceOf(ModeloNulo);
  });
});

describe('esquemaDeSalida', () => {
  it('cierra los objetos, exige todos los campos y quita lo que el modo estricto no admite', () => {
    const e = z.strictObject({
      monto: z.number().int().positive().max(10).nullable(),
      format: z.string().max(3).nullable(),
      lineas: z.array(z.object({ descripcion: z.string().min(1), precio: z.number().int().nullable() })).max(5),
    });
    expect(esquemaDeSalida(e)).toEqual({
      type: 'object',
      properties: {
        monto: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
        // Un CAMPO llamado «format» no se borra: solo la palabra clave.
        format: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        lineas: {
          type: 'array',
          items: {
            type: 'object',
            properties: { descripcion: { type: 'string' }, precio: { anyOf: [{ type: 'integer' }, { type: 'null' }] } },
            required: ['descripcion', 'precio'],
            additionalProperties: false,
          },
        },
      },
      required: ['monto', 'format', 'lineas'],
      additionalProperties: false,
    });
  });
});
