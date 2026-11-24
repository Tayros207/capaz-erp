import { describe, expect, it } from 'vitest';
import { LIMITE_DE_TURNOS_POR_DIA, LIMITE_DE_TURNOS_POR_MINUTO, SEGUNDOS_PARA_DAR_POR_MUERTO, decidirReintento, rechazoPorLimites, rechazoPrevio } from './reglas-de-entrada.js';
import { CATALOGO_DE_MODELOS, buscarModelo, esIdDeModelo, modeloEfectivo, modoDeEscritura } from './modelos.js';
import type { TurnoAbierto } from './repositorio.js';

const previo = (o: Partial<Extract<TurnoAbierto, { tipo: 'existente' }>> = {}): Extract<TurnoAbierto, { tipo: 'existente' }> => ({
  tipo: 'existente', conversacionId: 'c', mensajeAgenteId: 'm', estado: 'en_curso', contenido: '', metadatos: {}, edadSegundos: 5, ...o,
});

describe('rechazoPrevio', () => {
  it('con el proveedor apagado no se llama a nadie', () => {
    expect(rechazoPrevio({ proveedor: 'apagado', puedeEntrarAAlgunModulo: true })).toMatchObject({ motivo: 'apagado' });
  });
  it('sin ningún módulo al que entrar, tampoco', () => {
    expect(rechazoPrevio({ proveedor: 'openrouter', puedeEntrarAAlgunModulo: false })).toMatchObject({ motivo: 'apagado' });
  });
  it('con proveedor y módulos, sigue', () => {
    expect(rechazoPrevio({ proveedor: 'simulado', puedeEntrarAAlgunModulo: true })).toBeNull();
    expect(rechazoPrevio({ proveedor: 'openrouter', puedeEntrarAAlgunModulo: true })).toBeNull();
  });
});

describe('rechazoPorLimites', () => {
  const ok = { gastoMicrousd: 0, topeMicrousd: 5_000_000, turnosUltimoMinuto: 0, turnosUltimoDia: 0 };
  it('bajo el tope y el ritmo, sigue', () => expect(rechazoPorLimites(ok)).toBeNull());
  it('al llegar al tope del mes, se detiene (incluso exacto)', () => {
    expect(rechazoPorLimites({ ...ok, gastoMicrousd: 5_000_000 })).toMatchObject({ motivo: 'tope_mensual', mensaje: 'Se alcanzó el tope de uso de este mes.' });
    expect(rechazoPorLimites({ ...ok, gastoMicrousd: 4_999_999 })).toBeNull();
  });
  it('con tope cero el asistente queda detenido para esa empresa', () => {
    expect(rechazoPorLimites({ ...ok, topeMicrousd: 0 })).toMatchObject({ motivo: 'tope_mensual' });
  });
  it('el séptimo turno del minuto se rechaza; el sexto todavía pasa', () => {
    expect(rechazoPorLimites({ ...ok, turnosUltimoMinuto: LIMITE_DE_TURNOS_POR_MINUTO - 1 })).toBeNull();
    expect(rechazoPorLimites({ ...ok, turnosUltimoMinuto: LIMITE_DE_TURNOS_POR_MINUTO })).toMatchObject({ motivo: 'limite_de_ritmo' });
  });
  it('el límite diario también', () => {
    expect(rechazoPorLimites({ ...ok, turnosUltimoDia: LIMITE_DE_TURNOS_POR_DIA })).toMatchObject({ motivo: 'limite_de_ritmo' });
  });
  it('el tope se revisa antes que el ritmo', () => {
    expect(rechazoPorLimites({ ...ok, gastoMicrousd: 9_999_999, turnosUltimoMinuto: 99 })?.motivo).toBe('tope_mensual');
  });
});

describe('decidirReintento', () => {
  it('un turno terminado se entrega guardado, sin volver a llamar al modelo', () => {
    expect(decidirReintento(previo({ estado: 'completo' }))).toBe('responder_guardado');
  });
  it('uno en curso y reciente se rechaza: no se corren dos a la vez', () => {
    expect(decidirReintento(previo({ estado: 'en_curso', edadSegundos: SEGUNDOS_PARA_DAR_POR_MUERTO - 1 }))).toBe('turno_en_curso');
  });
  it('uno en curso pero viejo se da por muerto y, sin haber hecho nada, se retoma', () => {
    expect(decidirReintento(previo({ estado: 'en_curso', edadSegundos: SEGUNDOS_PARA_DAR_POR_MUERTO }))).toBe('retomar');
  });
  it('si ya hizo acciones NO se repite: se cierra como interrumpido', () => {
    expect(decidirReintento(previo({ estado: 'interrumpido', metadatos: { acciones: [{ titulo: 'Crear pedido' }] } }))).toBe('interrumpir');
    expect(decidirReintento(previo({ estado: 'en_curso', edadSegundos: 999, metadatos: { acciones: [{ titulo: 'x' }] } }))).toBe('interrumpir');
  });
  it('si ya propuso borradores tampoco se repite', () => {
    expect(decidirReintento(previo({ estado: 'error', metadatos: { borradores: [{ id: 'b1' }] } }))).toBe('interrumpir');
  });
  it('uno con error o interrumpido sin haber hecho nada se retoma', () => {
    expect(decidirReintento(previo({ estado: 'error' }))).toBe('retomar');
    expect(decidirReintento(previo({ estado: 'interrumpido', metadatos: { acciones: [], borradores: [] } }))).toBe('retomar');
  });
});

describe('catálogo de modelos', () => {
  it('todos los ids tienen la forma proveedor/nombre y no se repiten', () => {
    for (const m of CATALOGO_DE_MODELOS) expect(esIdDeModelo(m.id), m.id).toBe(true);
    expect(new Set(CATALOGO_DE_MODELOS.map((m) => m.id)).size).toBe(CATALOGO_DE_MODELOS.length);
  });
  it('arranca con DeepSeek V4.1 Flash, marcado experimental y sin evaluar', () => {
    expect(buscarModelo('deepseek/deepseek-v4.1-flash-1017')).toMatchObject({ nivel: 'experimental', privacidad: 'revisar', evaluado: false });
  });
  it('ningún modelo viene evaluado de fábrica: se anota solo tras correr el banco', () => {
    expect(CATALOGO_DE_MODELOS.filter((m) => m.evaluado)).toEqual([]);
  });
  it('el modelo efectivo es el elegido o, si no, el del despliegue', () => {
    expect(modeloEfectivo({ AGENTE_MODELO: 'a/b' }, null)).toBe('a/b');
    expect(modeloEfectivo({ AGENTE_MODELO: 'a/b' }, 'c/d')).toBe('c/d');
    expect(modeloEfectivo({ AGENTE_MODELO: 'a/b' }, 'sin barra')).toBe('a/b');
  });
  it('el modo depende solo del freno de la empresa: un modelo sin evaluar también actúa (decisión de Moisés, 2026-11-24)', () => {
    expect(modoDeEscritura('deepseek/deepseek-v4.1-flash-1017', true)).toBe('directa');
    expect(modoDeEscritura('otro/modelo', true)).toBe('directa');
    expect(modoDeEscritura('otro/modelo', false)).toBe('borradores');
  });
});
