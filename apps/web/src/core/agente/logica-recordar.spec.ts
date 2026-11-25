import { describe, expect, it } from 'vitest';
import { CLAVE_DE_CONVERSACION_RECORDADA, HORAS_PARA_RECORDAR, leerConversacionRecordada, olvidarConversacion, recordarConversacion } from './logica-recordar.ts';

const ID = '3f2b8c1e-5d4a-4e7b-9c6d-1a2b3c4d5e6f';
const HORA = 3_600_000;

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v), removeItem: (k: string) => void datos.delete(k), datos };
}

describe('recordar la conversación', () => {
  it('lo que se guarda se vuelve a leer mientras sea reciente', () => {
    const a = almacenFalso();
    recordarConversacion(a, ID, 1_000);
    expect(leerConversacionRecordada(a, 1_000 + HORA)).toBe(ID);
    expect(leerConversacionRecordada(a, 1_000 + HORAS_PARA_RECORDAR * HORA)).toBe(ID);
  });
  it('pasado el plazo se empieza una conversación nueva', () => {
    const a = almacenFalso();
    recordarConversacion(a, ID, 0);
    expect(leerConversacionRecordada(a, (HORAS_PARA_RECORDAR + 1) * HORA)).toBeNull();
  });
  it('olvidar la quita (una conversación nueva no reabre la vieja al recargar)', () => {
    const a = almacenFalso();
    recordarConversacion(a, ID, 0);
    olvidarConversacion(a);
    expect(leerConversacionRecordada(a, 1)).toBeNull();
  });
  it('lo raro guardado no se cree: JSON roto, sin forma de id, fecha futura o tipos equivocados', () => {
    for (const crudo of ['no es json', 'null', '"texto"', JSON.stringify({ id: '../../admin', en: 0 }), JSON.stringify({ id: ID }), JSON.stringify({ id: ID, en: 'ayer' }), JSON.stringify({ id: ID, en: 10 * HORA })]) {
      expect(leerConversacionRecordada(almacenFalso({ [CLAVE_DE_CONVERSACION_RECORDADA]: crudo }), 0), crudo).toBeNull();
    }
  });
  it('un id que no tiene forma de id no se guarda', () => {
    const a = almacenFalso();
    recordarConversacion(a, 'cualquier cosa', 0);
    expect(a.datos.size).toBe(0);
  });
  it('sin almacenamiento, o con uno que lanza, no rompe nada', () => {
    const roto = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => { throw new Error('bloqueado'); } };
    expect(leerConversacionRecordada(null, 0)).toBeNull();
    expect(leerConversacionRecordada(roto, 0)).toBeNull();
    expect(() => { recordarConversacion(roto, ID, 0); olvidarConversacion(roto); recordarConversacion(null, ID, 0); }).not.toThrow();
  });
});
