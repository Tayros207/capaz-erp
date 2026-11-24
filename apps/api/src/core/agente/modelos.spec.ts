import { afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOGO_DE_MODELOS, CONTEXTO_MINIMO, catalogoConPrecios, configuracionDe, validarEleccion } from './modelos.js';
import { leerModelosDeOpenRouter, MS_DE_VIDA_DE_LA_LISTA, PreciosDeModelos, type ModeloVivo } from './precios-de-modelos.js';

const vivo = (id: string, o: Partial<ModeloVivo> = {}): ModeloVivo => ({ id, entradaMicrousdPorMillon: 270_000, salidaMicrousdPorMillon: 1_100_000, contexto: 1_000_000, admiteHerramientas: true, ...o });
const FLASH = 'deepseek/deepseek-v4.1-flash-1017';

describe('leerModelosDeOpenRouter', () => {
  const respuesta = { data: [
    { id: FLASH, pricing: { prompt: '0.00000027', completion: '0.0000011' }, context_length: 1_000_000, supported_parameters: ['tools', 'temperature'] },
    { id: 'otro/sin-herramientas', pricing: { prompt: '0.000001', completion: '0.000002' }, context_length: 8000, supported_parameters: ['temperature'] },
    { id: 'openrouter/auto', pricing: { prompt: '-1', completion: '-1' }, supported_parameters: ['tools'] },
    { id: 'gratis/modelo', pricing: { prompt: '0', completion: '0' }, context_length: 200_000, supported_parameters: ['tools'] },
    { id: 'no es un id', pricing: {} },
    'basura', null, { sin: 'id' },
  ] };

  it('convierte el precio por token a millonésimas de dólar por millón de tokens, enteras', () => {
    const lista = leerModelosDeOpenRouter(respuesta);
    expect(lista.find((m) => m.id === FLASH)).toEqual({ id: FLASH, entradaMicrousdPorMillon: 270_000, salidaMicrousdPorMillon: 1_100_000, contexto: 1_000_000, admiteHerramientas: true });
    for (const m of lista) expect(Number.isInteger(m.entradaMicrousdPorMillon ?? 0)).toBe(true);
  });

  it('un modelo gratis tiene precio cero, no «sin precio»', () => {
    expect(leerModelosDeOpenRouter(respuesta).find((m) => m.id === 'gratis/modelo')).toMatchObject({ entradaMicrousdPorMillon: 0, salidaMicrousdPorMillon: 0 });
  });

  it('sabe quién admite herramientas', () => {
    expect(leerModelosDeOpenRouter(respuesta).find((m) => m.id === 'otro/sin-herramientas')?.admiteHerramientas).toBe(false);
  });

  it('salta los modelos «router» de precio negativo, los ids raros y las filas que no son objetos', () => {
    const ids = leerModelosDeOpenRouter(respuesta).map((m) => m.id);
    expect(ids).toEqual([FLASH, 'otro/sin-herramientas', 'gratis/modelo']);
  });

  it('una respuesta que no es la esperada da una lista vacía en lugar de romper', () => {
    expect(leerModelosDeOpenRouter(null)).toEqual([]);
    expect(leerModelosDeOpenRouter({ data: 'x' })).toEqual([]);
    expect(leerModelosDeOpenRouter([])).toEqual([]);
  });
});

describe('PreciosDeModelos', () => {
  afterEach(() => vi.useRealTimers());
  const ok = () => new Response(JSON.stringify({ data: [{ id: FLASH, pricing: { prompt: '0.00000027', completion: '0.0000011' }, supported_parameters: ['tools'] }] }), { status: 200 });

  it('deshabilitado, no sale a la red nunca', async () => {
    const f = vi.fn<typeof fetch>(async () => ok());
    expect(await new PreciosDeModelos({ habilitado: false, fetch: f }).vivos()).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('guarda la lista una hora: la segunda lectura no vuelve a consultar', async () => {
    const f = vi.fn<typeof fetch>(async () => ok());
    let t = 1_000;
    const p = new PreciosDeModelos({ habilitado: true, fetch: f, ahora: () => t });
    await p.vivos();
    t += MS_DE_VIDA_DE_LA_LISTA - 1;
    await p.vivos();
    expect(f).toHaveBeenCalledTimes(1);
    t += 2;
    await p.vivos();
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('un fallo NO se guarda: el siguiente intento vuelve a consultar', async () => {
    const f = vi.fn<typeof fetch>().mockRejectedValueOnce(new Error('red caída')).mockImplementation(async () => ok());
    const p = new PreciosDeModelos({ habilitado: true, fetch: f });
    expect(await p.vivos()).toBeNull();
    expect(await p.vivos()).toHaveLength(1);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('un estado HTTP de error o una lista vacía dan null y no se guardan', async () => {
    const f = vi.fn<typeof fetch>().mockImplementationOnce(async () => new Response('x', { status: 500 })).mockImplementationOnce(async () => new Response('{"data":[]}', { status: 200 }));
    const p = new PreciosDeModelos({ habilitado: true, fetch: f });
    expect(await p.vivos()).toBeNull();
    expect(await p.vivos()).toBeNull();
  });
});

describe('validarEleccion', () => {
  it('un id con forma rara se rechaza', () => {
    expect(validarEleccion('sin barra', null).ok).toBe(false);
    expect(validarEleccion(42, null).ok).toBe(false);
  });
  it('uno del catálogo se acepta aunque el proveedor no conteste', () => {
    expect(validarEleccion(FLASH, null)).toEqual({ ok: true });
  });
  it('si el proveedor contestó y ya no lista el modelo, se rechaza', () => {
    const r = validarEleccion(FLASH, [vivo('otro/modelo')]);
    expect(r).toMatchObject({ ok: false });
  });
  it('un modelo que no admite herramientas se rechaza: sería un chat que finge operar', () => {
    const r = validarEleccion(FLASH, [vivo(FLASH, { admiteHerramientas: false })]);
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('herramientas') });
  });
  it('uno fuera del catálogo exige poder comprobarlo y tener contexto suficiente', () => {
    expect(validarEleccion('nuevo/modelo', null)).toMatchObject({ ok: false, error: expect.stringContaining('No se pudo comprobar') });
    expect(validarEleccion('nuevo/modelo', [vivo('nuevo/modelo', { contexto: CONTEXTO_MINIMO - 1 })])).toMatchObject({ ok: false, error: expect.stringContaining('contexto') });
    expect(validarEleccion('nuevo/modelo', [vivo('nuevo/modelo', { contexto: CONTEXTO_MINIMO })])).toEqual({ ok: true });
  });
});

describe('catalogoConPrecios y configuracionDe', () => {
  it('sin la lista del proveedor sale el catálogo sin precios y todo figura disponible', () => {
    const c = catalogoConPrecios(null);
    expect(c).toHaveLength(CATALOGO_DE_MODELOS.length);
    expect(c.every((m) => m.disponible && m.entradaMicrousdPorMillon === null)).toBe(true);
  });
  it('con la lista trae precios y marca no disponible lo que el proveedor ya no ofrece', () => {
    const c = catalogoConPrecios([vivo(FLASH)]);
    expect(c.find((m) => m.id === FLASH)).toMatchObject({ disponible: true, entradaMicrousdPorMillon: 270_000, salidaMicrousdPorMillon: 1_100_000 });
    expect(c.find((m) => m.id === 'anthropic/claude-opus-5.5')).toMatchObject({ disponible: false, entradaMicrousdPorMillon: null });
  });
  it('sin fila, rige lo del despliegue; con fila, lo que eligió la empresa', () => {
    const base = { AGENTE_MODELO: 'a/b', AGENTE_TOPE_MENSUAL_USD: 5 };
    expect(configuracionDe(base, null, 12)).toEqual({ modelo: null, modeloEfectivo: 'a/b', topeMensualMicrousd: null, topeEfectivoMicrousd: 5_000_000, escrituraDirecta: true, dineroDirecto: true, topePorOperacionCentimos: 100_000, internet: false, gastoDelMesMicrousd: 12 });
    expect(configuracionDe(base, { modelo: 'c/d', topeMensualMicrousd: 0, escrituraDirecta: true, dineroDirecto: true, topePorOperacionCentimos: null, internet: false }, 0)).toMatchObject({ modelo: 'c/d', modeloEfectivo: 'c/d', topeEfectivoMicrousd: 0, escrituraDirecta: true });
  });
  it('un tope de 2,5 dólares se vuelve 2.500.000 enteros, sin decimales de dinero', () => {
    expect(configuracionDe({ AGENTE_MODELO: 'a/b', AGENTE_TOPE_MENSUAL_USD: 2.5 }, null, 0).topeEfectivoMicrousd).toBe(2_500_000);
  });
});
