import { describe, expect, it } from 'vitest';
import { completarArgumentos } from './registrar-resultado.js';

const ID = '0192f3a0-7b1c-7c11-8a2d-5e6f7a8b9c01';

describe('completarArgumentos · origen de un documento', () => {
  it('un origen inventado por el modelo no viaja: evitaría crear el siguiente pedido', () => {
    expect(completarArgumentos('pedido_crear', { clienteId: ID, origenTipo: 'chat', origenId: 'chat-asistente' }, 'texto')).toEqual({ clienteId: ID });
  });
  it('un origen con id de verdad se respeta', () => {
    const a = { clienteId: ID, origenTipo: 'cotizacion', origenId: ID };
    expect(completarArgumentos('pedido_crear', a, 'texto')).toBe(a);
  });
  it('sin la pareja completa no se toca (transferir entre cuentas usa «origenId» para otra cosa)', () => {
    const a = { origenId: 'x', destinoId: 'y' };
    expect(completarArgumentos('cuentas_transferir', a, 'texto')).toBe(a);
  });
});
