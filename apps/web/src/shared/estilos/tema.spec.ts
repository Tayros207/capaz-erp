import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import {
  CLAVE_DE_TEMA,
  SCRIPT_DE_TEMA,
  aplicarTema,
  guardarPreferencia,
  leerPreferencia,
  resolverTema,
} from './tema.ts';

const almacen = (inicial?: string) => {
  const datos = new Map<string, string>(inicial ? [[CLAVE_DE_TEMA, inicial]] : []);
  return { getItem: (k: string) => datos.get(k) ?? null, setItem: (k: string, v: string) => void datos.set(k, v) };
};

describe('preferencia de tema', () => {
  it('lee claro y oscuro; todo lo demás es sistema', () => {
    expect(leerPreferencia(almacen('claro'))).toBe('claro');
    expect(leerPreferencia(almacen('oscuro'))).toBe('oscuro');
    expect(leerPreferencia(almacen('otra'))).toBe('sistema');
    expect(leerPreferencia(almacen())).toBe('sistema');
    expect(leerPreferencia(null)).toBe('sistema');
  });

  it('no falla si el almacén lanza (modo privado)', () => {
    const roto = {
      getItem: () => {
        throw new Error('bloqueado');
      },
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    expect(leerPreferencia(roto)).toBe('sistema');
    expect(() => guardarPreferencia(roto, 'oscuro')).not.toThrow();
  });

  it('guarda y vuelve a leer', () => {
    const a = almacen();
    guardarPreferencia(a, 'oscuro');
    expect(leerPreferencia(a)).toBe('oscuro');
  });

  it('resuelve sistema según la preferencia del sistema', () => {
    expect(resolverTema('sistema', true)).toBe('oscuro');
    expect(resolverTema('sistema', false)).toBe('claro');
    expect(resolverTema('claro', true)).toBe('claro');
    expect(resolverTema('oscuro', false)).toBe('oscuro');
  });

  it('aplica el tema en data-tema', () => {
    const raiz = { dataset: {} as Record<string, string | undefined> };
    aplicarTema(raiz, 'oscuro');
    expect(raiz.dataset.tema).toBe('oscuro');
  });
});

describe('script anti-parpadeo', () => {
  it('index.html lleva exactamente SCRIPT_DE_TEMA', () => {
    expect(html).toContain(`<script>${SCRIPT_DE_TEMA}</script>`);
  });

  function correr(guardada: string | null, sistemaOscuro: boolean, falla = false) {
    const documento = { documentElement: { dataset: {} as Record<string, string | undefined> } };
    const localStorage = {
      getItem: () => {
        if (falla) throw new Error('bloqueado');
        return guardada;
      },
    };
    const matchMedia = () => ({ matches: sistemaOscuro });
    new Function('localStorage', 'matchMedia', 'document', SCRIPT_DE_TEMA)(localStorage, matchMedia, documento);
    return documento.documentElement.dataset.tema;
  }

  it('respeta lo guardado y, sin nada, el sistema', () => {
    expect(correr('claro', true)).toBe('claro');
    expect(correr('oscuro', false)).toBe('oscuro');
    expect(correr(null, true)).toBe('oscuro');
    expect(correr('sistema', false)).toBe('claro');
  });

  it('cae a claro si el almacén falla', () => {
    expect(correr(null, true, true)).toBe('claro');
  });
});
