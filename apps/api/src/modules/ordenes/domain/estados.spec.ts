import { describe, expect, it } from 'vitest';
import { ESTADOS_DE_PEDIDO, type EstadoDePedido } from '@capaz/shared';
import { comprobarAvance, comprobarCancelacion, comprobarConfirmacion, esEditable, estaAtrasado, mensajeDePasoInvalido } from './estados.js';

// La tabla completa, escrita aparte de la implementación: cada par (de, a) dice si se permite.
const AVANCES_ESPERADOS: Record<EstadoDePedido, EstadoDePedido[]> = {
  borrador: [],
  confirmado: ['en_proceso', 'listo', 'entregado'],
  en_proceso: ['listo', 'entregado', 'confirmado'],
  listo: ['entregado', 'en_proceso'],
  entregado: [],
  cancelado: [],
};

describe('pasos de un pedido', () => {
  it('pedido_cambiar_estado: los 36 pares de la tabla', () => {
    for (const de of ESTADOS_DE_PEDIDO) {
      for (const a of ESTADOS_DE_PEDIDO) {
        expect(comprobarAvance(de, a).ok, `${de} → ${a}`).toBe(AVANCES_ESPERADOS[de].includes(a));
      }
    }
  });

  it('nunca se avanza al mismo estado, a borrador ni a cancelado', () => {
    for (const de of ESTADOS_DE_PEDIDO) {
      expect(comprobarAvance(de, de).ok).toBe(false);
      expect(comprobarAvance(de, 'borrador').ok).toBe(false);
      expect(comprobarAvance(de, 'cancelado').ok).toBe(false);
    }
  });

  it('confirmar solo desde borrador', () => {
    for (const de of ESTADOS_DE_PEDIDO) expect(comprobarConfirmacion(de).ok).toBe(de === 'borrador');
  });

  it('cancelar desde borrador, confirmado, en proceso o listo; nunca desde entregado ni cancelado', () => {
    const cancelables = ['borrador', 'confirmado', 'en_proceso', 'listo'];
    for (const de of ESTADOS_DE_PEDIDO) expect(comprobarCancelacion(de).ok).toBe(cancelables.includes(de));
  });

  it('el rechazo nombra los dos estados', () => {
    expect(comprobarAvance('entregado', 'en_proceso')).toEqual({ ok: false, motivo: 'Un pedido «entregado» no puede pasar a «en proceso».' });
    expect(comprobarConfirmacion('confirmado')).toEqual({ ok: false, motivo: 'Un pedido «confirmado» no puede pasar a «confirmado».' });
    expect(mensajeDePasoInvalido('cancelado', 'cancelado')).toBe('Un pedido «cancelado» no puede pasar a «cancelado».');
  });

  it('solo el borrador se edita', () => {
    for (const e of ESTADOS_DE_PEDIDO) expect(esEditable(e)).toBe(e === 'borrador');
  });
});

describe('estaAtrasado', () => {
  it('en curso con entrega anterior a hoy', () => {
    expect(estaAtrasado('confirmado', '2026-03-09', '2026-03-10')).toBe(true);
    expect(estaAtrasado('en_proceso', '2026-03-09', '2026-03-10')).toBe(true);
    expect(estaAtrasado('listo', '2025-12-31', '2026-01-01')).toBe(true);
  });
  it('hoy no es atraso, ni sin fecha, ni borrador, entregado o cancelado', () => {
    expect(estaAtrasado('confirmado', '2026-03-10', '2026-03-10')).toBe(false);
    expect(estaAtrasado('confirmado', null, '2026-03-10')).toBe(false);
    expect(estaAtrasado('borrador', '2026-03-01', '2026-03-10')).toBe(false);
    expect(estaAtrasado('entregado', '2026-03-01', '2026-03-10')).toBe(false);
    expect(estaAtrasado('cancelado', '2026-03-01', '2026-03-10')).toBe(false);
  });
});
