import { describe, expect, it } from 'vitest';
import { ESTADOS_DE_COMPRA, type EstadoDeCompra } from '@capaz/shared';
import { comprobarCancelacion, comprobarEnvio, comprobarRecepcion, esEditable, estaAtrasada, mensajeDePasoInvalido } from './estados.js';

const permitidos = (f: (e: EstadoDeCompra) => { ok: boolean }) => ESTADOS_DE_COMPRA.filter((e) => f(e).ok);

describe('pasos de una orden de compra', () => {
  it('solo un borrador se envía', () => {
    expect(permitidos(comprobarEnvio)).toEqual(['borrador']);
    expect(comprobarEnvio('enviada')).toEqual({ ok: false, motivo: 'Una orden «enviada» no puede pasar a «enviada».' });
  });

  it('se recibe sobre una enviada o recibida en parte; un borrador primero se envía', () => {
    expect(permitidos(comprobarRecepcion)).toEqual(['enviada', 'recibida_parcial']);
    expect(comprobarRecepcion('borrador')).toMatchObject({ ok: false, motivo: expect.stringMatching(/Primero envía la orden/) });
    expect(comprobarRecepcion('recibida')).toEqual({ ok: false, motivo: 'Una orden «recibida» ya no recibe mercadería.' });
    expect(comprobarRecepcion('cancelada')).toMatchObject({ ok: false });
  });

  it('se cancela solo en borrador o enviada y sin recepciones', () => {
    expect(permitidos((e) => comprobarCancelacion(e, 0))).toEqual(['borrador', 'enviada']);
    expect(permitidos((e) => comprobarCancelacion(e, 1))).toEqual([]);
    expect(comprobarCancelacion('enviada', 2)).toEqual({ ok: false, motivo: 'La orden ya tiene recepciones: no se puede cancelar.' });
    expect(comprobarCancelacion('recibida_parcial', 0)).toEqual({ ok: false, motivo: mensajeDePasoInvalido('recibida_parcial', 'cancelada') });
    expect(mensajeDePasoInvalido('recibida_parcial', 'cancelada')).toBe('Una orden «recibida en parte» no puede pasar a «cancelada».');
  });

  it('solo se edita en borrador', () => {
    expect(ESTADOS_DE_COMPRA.filter(esEditable)).toEqual(['borrador']);
  });
});

describe('estaAtrasada', () => {
  it('por recibir y con entrega anterior a hoy', () => {
    expect(estaAtrasada('enviada', '2026-03-09', '2026-03-10')).toBe(true);
    expect(estaAtrasada('recibida_parcial', '2026-03-09', '2026-03-10')).toBe(true);
    expect(estaAtrasada('enviada', '2026-03-10', '2026-03-10')).toBe(false);
    expect(estaAtrasada('enviada', null, '2026-03-10')).toBe(false);
    for (const e of ['borrador', 'recibida', 'cancelada'] as const) expect(estaAtrasada(e, '2020-01-01', '2026-03-10')).toBe(false);
  });
});
