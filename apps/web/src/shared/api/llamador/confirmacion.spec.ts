import { describe, expect, it, vi } from 'vitest';
import type { Respuesta } from '@capaz/shared';
import { ejecutarConConfirmacion } from './confirmacion.ts';

const pide = (token: string): Respuesta<unknown> => ({
  ok: false,
  requiereConfirmacion: { resumen: 'Cambiar la zona horaria', token, venceEn: '2026-11-15T10:05:00.000Z' },
});
const exito: Respuesta<unknown> = { ok: true, datos: { listo: true }, avisos: [] };
const vencida: Respuesta<unknown> = { ok: false, error: { codigo: 'confirmacion_vencida', mensaje: 'Venció.' } };

describe('confirmación en dos pasos', () => {
  it('pide, muestra el resumen y reenvía el token', async () => {
    const llamada = vi.fn(async (c?: string) => (c === undefined ? pide('t1') : exito));
    const preguntar = vi.fn(async () => true);
    expect(await ejecutarConConfirmacion(llamada, preguntar)).toEqual(exito);
    expect(preguntar).toHaveBeenCalledWith('Cambiar la zona horaria', false);
    expect(llamada.mock.calls).toEqual([[], ['t1']]);
  });

  it('si la persona cancela, no se envía el token', async () => {
    const llamada = vi.fn(async () => pide('t1'));
    expect(await ejecutarConConfirmacion(llamada, async () => false)).toEqual({ cancelada: true });
    expect(llamada).toHaveBeenCalledTimes(1);
  });

  it('si el token venció, lo vuelve a pedir y pregunta de nuevo', async () => {
    const respuestas = [pide('t1'), vencida, pide('t2'), exito];
    const llamada = vi.fn(async () => respuestas.shift()!);
    const preguntar = vi.fn(async () => true);
    expect(await ejecutarConConfirmacion(llamada, preguntar)).toEqual(exito);
    expect(preguntar).toHaveBeenNthCalledWith(2, 'Cambiar la zona horaria', true);
  });

  it('se rinde tras vencer demasiadas veces', async () => {
    const llamada = vi.fn(async (c?: string) => (c === undefined ? pide('t') : vencida));
    const r = await ejecutarConConfirmacion(llamada, async () => true);
    expect(r).toMatchObject({ ok: false, error: { codigo: 'confirmacion_vencida' } });
  });

  it('un rechazo cualquiera pasa tal cual', async () => {
    const no: Respuesta<unknown> = { ok: false, error: { codigo: 'sin_permiso', mensaje: 'No.' } };
    expect(await ejecutarConConfirmacion(async () => no, async () => true)).toEqual(no);
  });
});
