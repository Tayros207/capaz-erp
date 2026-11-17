import { ESTADOS_DE_COTIZACION } from '@capaz/shared';
import { describe, expect, it } from 'vitest';
import { comprobarPaso, esEditable, ESTADO_DESTINO, PASOS_PERMITIDOS, type PasoDeCotizacion } from './estados.js';

const PASOS = Object.keys(PASOS_PERMITIDOS) as PasoDeCotizacion[];

describe('tabla de estados', () => {
  it('cada paso solo vale desde los estados de la ficha', () => {
    const permitidos = (p: PasoDeCotizacion) => ESTADOS_DE_COTIZACION.filter((e) => comprobarPaso(e, p).ok);
    expect(permitidos('emitir')).toEqual(['borrador']);
    expect(permitidos('enviar')).toEqual(['emitida']);
    expect(permitidos('aceptar')).toEqual(['emitida', 'enviada']);
    expect(permitidos('rechazar')).toEqual(['emitida', 'enviada']);
    expect(permitidos('nueva_version')).toEqual(['emitida', 'enviada', 'rechazada']);
    expect(permitidos('anular')).toEqual(['borrador', 'emitida', 'enviada', 'aceptada', 'rechazada']);
  });

  it('una anulada no admite ningún paso, con un motivo en español', () => {
    for (const p of PASOS) {
      const r = comprobarPaso('anulada', p);
      expect(r.ok, p).toBe(false);
      if (!r.ok) expect(r.motivo.length).toBeGreaterThan(10);
    }
  });

  it('aceptar o rechazar dos veces dice que ya se hizo', () => {
    expect(comprobarPaso('aceptada', 'aceptar')).toEqual({ ok: false, motivo: 'La cotización ya fue aceptada.' });
    expect(comprobarPaso('rechazada', 'rechazar')).toEqual({ ok: false, motivo: 'La cotización ya fue rechazada.' });
  });

  it('solo el borrador se edita; nueva versión vuelve a borrador', () => {
    expect(ESTADOS_DE_COTIZACION.filter(esEditable)).toEqual(['borrador']);
    expect(ESTADO_DESTINO.nueva_version).toBe('borrador');
    expect(ESTADO_DESTINO.anular).toBe('anulada');
  });
});
