import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health.js';

describe('healthResponseSchema', () => {
  it('acepta una respuesta válida', () => {
    const r = healthResponseSchema.safeParse({
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
    });
    expect(r.success).toBe(true);
  });

  it('rechaza un estado de base desconocido', () => {
    const r = healthResponseSchema.safeParse({
      status: 'ok',
      database: 'maybe',
      timestamp: new Date().toISOString(),
    });
    expect(r.success).toBe(false);
  });

  it('rechaza campos de más (contrato estricto)', () => {
    const r = healthResponseSchema.safeParse({
      status: 'ok',
      database: 'up',
      timestamp: new Date().toISOString(),
      secreto: 'x',
    });
    expect(r.success).toBe(false);
  });
});
