import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { mensajeDeZod, OPCIONES_EN_ESPANOL } from './errores-de-zod.js';

describe('mensajeDeZod', () => {
  it('junta los problemas con su ruta, en español', () => {
    const r = z.strictObject({ texto: z.string(), n: z.number() }).safeParse({ n: 'x', otro: 1 }, OPCIONES_EN_ESPANOL);
    expect(r.success).toBe(false);
    const mensaje = mensajeDeZod((r as { error: z.ZodError }).error);
    expect(mensaje).toContain('texto');
    expect(mensaje).toContain(' · ');
  });
  it('sin ruta, solo el mensaje', () => {
    const r = z.string().safeParse(1, OPCIONES_EN_ESPANOL);
    expect(mensajeDeZod((r as { error: z.ZodError }).error)).toMatch(/^Entrada inválida/);
  });
});
