import { exito, rechazo } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { HerramientaRegistrada } from '../herramientas/tipos.js';
import { conAyuda, frenoPorFallos, MAXIMO_DE_FALLOS_SEGUIDOS } from './ayuda-para-corregir.js';
import type { EstadoDelTurno } from './tipos-del-turno.js';

const h = { nombre: 'pedido_editar', entrada: z.strictObject({ id: z.string(), conIgv: z.boolean().optional() }) } as unknown as HerramientaRegistrada;
const estado = () => ({ fallosDeArgumentos: new Map<string, number>() }) as EstadoDelTurno;
const malo = rechazo('argumentos_invalidos', 'Falta el id.');
const errorDe = (r: ReturnType<typeof conAyuda>) => (r as unknown as { error: Record<string, unknown> }).error;

describe('conAyuda', () => {
  it('el primer fallo dice lo que llegó y trae el esquema; los siguientes ya no lo repiten (cuesta tokens)', () => {
    const e = estado();
    const primero = errorDe(conAyuda(e, h, { conIgv: false }, malo));
    expect(primero.recibido).toEqual(['conIgv']);
    expect(primero.argumentosEsperados).toMatchObject({ type: 'object', required: ['id'] });
    expect(errorDe(conAyuda(e, h, {}, malo))).not.toHaveProperty('argumentosEsperados');
  });

  it('si una lista llegó como texto cortado, lo dice con su nombre', () => {
    const r = errorDe(conAyuda(estado(), h, { id: 'p', lineas: '[{"descripcion": "FAB' }, malo));
    expect(r.pista).toContain('«lineas» llegó como TEXTO');
  });

  it('otro tipo de rechazo y el éxito salen igual', () => {
    const sinPermiso = rechazo('sin_permiso', 'No.');
    expect(conAyuda(estado(), h, {}, sinPermiso)).toBe(sinPermiso);
    const bien = exito({ id: 'x' });
    expect(conAyuda(estado(), h, {}, bien)).toBe(bien);
  });
});

describe('frenoPorFallos', () => {
  it('corta al llegar al máximo de fallos seguidos de ESA herramienta', () => {
    const e = estado();
    for (let i = 0; i < MAXIMO_DE_FALLOS_SEGUIDOS; i += 1) {
      expect(frenoPorFallos(e, h.nombre)).toBeNull();
      conAyuda(e, h, {}, malo);
    }
    expect(frenoPorFallos(e, h.nombre)).toMatchObject({ ok: false, error: { codigo: 'conflicto' } });
    expect(frenoPorFallos(e, 'otra')).toBeNull();
  });

  it('un éxito reinicia la cuenta', () => {
    const e = estado();
    conAyuda(e, h, {}, malo);
    conAyuda(e, h, {}, exito({}));
    expect(e.fallosDeArgumentos.size).toBe(0);
  });
});
