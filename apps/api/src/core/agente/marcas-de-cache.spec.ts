import { describe, expect, it } from 'vitest';
import { conMarcasDeCache } from './marcas-de-cache.js';
import type { MensajeDeModelo } from './modelo-de-chat.js';

const mensajes: MensajeDeModelo[] = [
  { role: 'system', content: 'FIJO' },
  { role: 'system', content: 'VARIABLE' },
  { role: 'user', content: 'hola' },
  { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'x', arguments: '{}' } }] },
  { role: 'tool', tool_call_id: 'c1', content: '{"ok":true}' },
];

describe('conMarcasDeCache', () => {
  it('con Anthropic marca el bloque fijo y el último mensaje, y nada más', () => {
    const r = conMarcasDeCache('anthropic/claude-sonnet-5.5', mensajes);
    expect(r[0]).toMatchObject({ role: 'system', content: [{ type: 'text', text: 'FIJO', cache_control: { type: 'ephemeral' } }] });
    expect(r[1]).toEqual(mensajes[1]);
    expect(r[2]).toEqual(mensajes[2]);
    expect(r[3]).toEqual(mensajes[3]);
    expect(r[4]).toMatchObject({ role: 'tool', tool_call_id: 'c1', content: [{ type: 'text', text: '{"ok":true}', cache_control: { type: 'ephemeral' } }] });
  });
  it('con otros modelos no cambia nada (ellos cachean el prefijo solos)', () => {
    expect(conMarcasDeCache('deepseek/deepseek-v4.1-flash-1017', mensajes)).toBe(mensajes);
  });
  it('no toca los mensajes de origen ni los vacíos', () => {
    const copia = JSON.stringify(mensajes);
    conMarcasDeCache('anthropic/claude-haiku-5.5', mensajes);
    expect(JSON.stringify(mensajes)).toBe(copia);
    expect(conMarcasDeCache('anthropic/x', [])).toEqual([]);
    const r = conMarcasDeCache('anthropic/x', [{ role: 'user', content: '' }]);
    expect(r[0]).toEqual({ role: 'user', content: '' });
  });
});
