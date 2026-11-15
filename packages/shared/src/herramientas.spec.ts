import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ARGUMENTOS_DE_CONTEXTO, ayudaSchema, contrato, cuerpoDeHerramientaSchema } from './herramientas.js';

const ayuda = {
  titulo: 'Crear',
  paraQueSirve: 'Crea algo',
  cuandoUsarla: 'Cuando haga falta',
  campos: [{ nombre: 'nombre', queSeAnota: 'El nombre', ejemplo: 'Ana' }],
  ejemploTecleado: 'crear Ana',
  ejemploHablado: 'crea a Ana',
  erroresComunes: ['Nombre vacío'],
  relacionadas: [],
};

describe('ayudaSchema', () => {
  it('acepta una ayuda completa', () => expect(ayudaSchema.safeParse(ayuda).success).toBe(true));
  it('exige al menos un error común', () => expect(ayudaSchema.safeParse({ ...ayuda, erroresComunes: [] }).success).toBe(false));
  it('rechaza textos vacíos y campos de más', () => {
    expect(ayudaSchema.safeParse({ ...ayuda, titulo: '  ' }).success).toBe(false);
    expect(ayudaSchema.safeParse({ ...ayuda, extra: 1 }).success).toBe(false);
  });
});

describe('contrato y cuerpo', () => {
  it('contrato devuelve entrada y salida', () => {
    const e = z.strictObject({});
    const s = z.strictObject({ id: z.string() });
    expect(contrato(e, s)).toEqual({ entrada: e, salida: s });
  });
  it('el cuerpo acepta args y confirmación, nada más', () => {
    expect(cuerpoDeHerramientaSchema.safeParse({}).success).toBe(true);
    expect(cuerpoDeHerramientaSchema.safeParse({ args: { a: 1 }, confirmacion: 't' }).success).toBe(true);
    expect(cuerpoDeHerramientaSchema.safeParse({ confirmacion: '' }).success).toBe(false);
    expect(cuerpoDeHerramientaSchema.safeParse({ empresaId: 'x' }).success).toBe(false);
  });
  it('lista los argumentos de contexto prohibidos', () => {
    expect(ARGUMENTOS_DE_CONTEXTO).toContain('empresaId');
    expect(ARGUMENTOS_DE_CONTEXTO).toContain('tenant_id');
  });
});
