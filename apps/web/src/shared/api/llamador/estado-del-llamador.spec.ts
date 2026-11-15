import { describe, expect, it } from 'vitest';
import { ESTADO_INICIAL_DEL_LLAMADOR, reducirEstadoDelLlamador as r, textoDelIndicador } from './estado-del-llamador.ts';

describe('estado del llamador', () => {
  it('sube al salir una llamada y baja al terminar, recordando cómo terminó la última', () => {
    let e = r(ESTADO_INICIAL_DEL_LLAMADOR, { tipo: 'salio' });
    e = r(e, { tipo: 'salio' });
    expect(e.enVuelo).toBe(2);
    e = r(e, { tipo: 'termino', ok: true });
    expect(e).toEqual({ enVuelo: 1, ultimoResultado: 'ok', terminadas: 1 });
    e = r(e, { tipo: 'termino', ok: false });
    expect(e).toEqual({ enVuelo: 0, ultimoResultado: 'error', terminadas: 2 });
  });

  it('nunca baja de cero', () => {
    expect(r(ESTADO_INICIAL_DEL_LLAMADOR, { tipo: 'termino', ok: true }).enVuelo).toBe(0);
  });

  it('distingue la caída de red de un rechazo', () => {
    expect(r(ESTADO_INICIAL_DEL_LLAMADOR, { tipo: 'termino', ok: false, sinConexion: true }).ultimoResultado).toBe('sin_conexion');
  });

  it('el texto del indicador sigue Guardando, Guardado y Sin conexión', () => {
    const salio = r(ESTADO_INICIAL_DEL_LLAMADOR, { tipo: 'salio' });
    expect(textoDelIndicador(salio, false)).toBe('Guardando…');
    const ok = r(salio, { tipo: 'termino', ok: true });
    expect(textoDelIndicador(ok, true)).toBe('Guardado');
    expect(textoDelIndicador(ok, false)).toBeNull();
    expect(textoDelIndicador(r(salio, { tipo: 'termino', ok: false, sinConexion: true }), false)).toBe('Sin conexión');
    expect(textoDelIndicador(r(salio, { tipo: 'termino', ok: false }), true)).toBeNull();
  });
});
