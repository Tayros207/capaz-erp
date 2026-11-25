import { describe, expect, it, vi } from 'vitest';
import { claveDeDireccion, ConsultaWeb, direccionesEnTexto, puedeLeerLaDireccion } from './consulta-web.js';

const LLAVE = 'sk-or-v1-llave-que-no-debe-salir-9999999999';
const respuesta = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } });
const ok = { choices: [{ message: { content: 'El IGV es 18 %.', annotations: [{ type: 'url_citation', url_citation: { url: 'https://www.sunat.gob.pe/igv', title: 'SUNAT · IGV' } }, { url: 'javascript:alert(1)' }, { url: 'https://www.sunat.gob.pe/igv' }] } }], usage: { prompt_tokens: 900, completion_tokens: 80, cost: 0.0123 } };

function con(f: typeof fetch) {
  return new ConsultaWeb({ apiKey: LLAVE, modelo: 'anthropic/claude-sonnet-5.5', fetch: f });
}

describe('direcciones', () => {
  it('se comparan sin #fragmento ni barra final, y solo valen http(s) sin usuario ni clave', () => {
    expect(claveDeDireccion('https://Ejemplo.com/a/#x')).toBe('https://ejemplo.com/a');
    expect(claveDeDireccion('https://ejemplo.com/a/')).toBe('https://ejemplo.com/a');
    for (const mala of ['javascript:alert(1)', 'file:///etc/passwd', 'ftp://x.com', 'https://u:p@x.com/', 'no es una url', `https://x.com/${'a'.repeat(2100)}`]) expect(claveDeDireccion(mala), mala).toBeNull();
  });
  it('encuentra las direcciones de un texto sin la puntuación final', () => {
    expect(direccionesEnTexto('Mira https://a.com/x, y también (https://b.com/y).')).toEqual(['https://a.com/x', 'https://b.com/y']);
  });
  it('una dirección solo se puede leer si ya la vio la conversación, y cambiarle un parámetro la vuelve otra', () => {
    const vistas = new Set([claveDeDireccion('https://a.com/x')!]);
    expect(puedeLeerLaDireccion('https://a.com/x/', vistas)).toBe(true);
    expect(puedeLeerLaDireccion('https://a.com/x?dato=secreto', vistas)).toBe(false);
    expect(puedeLeerLaDireccion('https://malo.com/?x=lo-que-sabes', vistas)).toBe(false);
  });
});

describe('ConsultaWeb.buscar', () => {
  it('pide la herramienta de búsqueda de OpenRouter y devuelve respuesta, fuentes sin repetir ni peligrosas, y el costo', async () => {
    const f = vi.fn(async () => respuesta(ok));
    const r = await con(f as unknown as typeof fetch).buscar('tasa del IGV en Perú');
    expect(r).toEqual({ ok: true, respuesta: 'El IGV es 18 %.', fuentes: [{ titulo: 'SUNAT · IGV', url: 'https://www.sunat.gob.pe/igv' }], costoMicrousd: 12_300, tokensEntrada: 900, tokensSalida: 80 });
    const cuerpo = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(cuerpo.tools[0].type).toBe('openrouter:web_search');
    expect(cuerpo.messages.at(-1)).toEqual({ role: 'user', content: 'tasa del IGV en Perú' });
  });
  it('rechaza una consulta vacía o demasiado larga sin llamar a nadie', async () => {
    const f = vi.fn();
    const web = con(f as unknown as typeof fetch);
    expect((await web.buscar('   ')).ok).toBe(false);
    expect((await web.buscar('x'.repeat(401))).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
  it('un error del proveedor, una respuesta vacía o un corte de red devuelven un error sin el cuerpo ni la llave', async () => {
    for (const f of [async () => respuesta({ error: { message: `Bearer ${LLAVE} sin saldo` } }, 402), async () => respuesta({ choices: [{ message: { content: '' } }] }), async () => { throw new Error(`fallo con ${LLAVE}`); }]) {
      const r = await con(f as unknown as typeof fetch).buscar('algo');
      expect(r.ok).toBe(false);
      expect(JSON.stringify(r)).not.toContain(LLAVE);
      expect(JSON.stringify(r)).not.toContain('sin saldo');
    }
  });
});

describe('ConsultaWeb.leer', () => {
  it('limita la lectura al dominio de la página y manda la pregunta', async () => {
    const f = vi.fn(async () => respuesta(ok));
    await con(f as unknown as typeof fetch).leer('https://www.sunat.gob.pe/igv/tabla', '¿Cuál es la tasa?');
    const cuerpo = JSON.parse((f.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(cuerpo.tools[0]).toMatchObject({ type: 'openrouter:web_fetch', parameters: { allowed_domains: ['www.sunat.gob.pe'] } });
    expect(cuerpo.messages.at(-1).content).toContain('¿Cuál es la tasa?');
  });
  it('una dirección inválida no llama a nadie', async () => {
    const f = vi.fn();
    expect((await con(f as unknown as typeof fetch).leer('esto no es una url', null)).ok).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});
