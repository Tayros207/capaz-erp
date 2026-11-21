import { Navigate, type RouteObject } from 'react-router';
import { isValidElement } from 'react';
import { describe, expect, it } from 'vitest';
import { EstadoVacio } from '../shared/ui/estado-vacio.tsx';

// Prueba de estructura y de humo de las rutas de cada área: salvo acceso e inicio (que se quedan en el arranque),
// toda pantalla carga diferido, y cada `lazy` resuelve a un elemento válido.
const modulos = import.meta.glob<{ rutas: RouteObject[] }>(
  ['../core/**/rutas.tsx', '../modules/*/rutas.tsx', '../plataforma/rutas.tsx'],
  { eager: true },
);
const ESTATICAS = ['../core/acceso/rutas.tsx', '../core/inicio/rutas.tsx'];
const diferidas = Object.entries(modulos).filter(([archivo]) => !ESTATICAS.includes(archivo));

/** Aplana las rutas con sus hijas, anotando de qué archivo vienen. */
function aplanar(archivo: string, rutas: RouteObject[], salida: { archivo: string; ruta: RouteObject }[] = []) {
  for (const ruta of rutas) {
    salida.push({ archivo, ruta });
    if (ruta.children) aplanar(archivo, ruta.children, salida);
  }
  return salida;
}

const todas = diferidas.flatMap(([archivo, m]) => aplanar(archivo, m.rutas));
const esEstaticaPermitida = (ruta: RouteObject): boolean =>
  isValidElement(ruta.element) && (ruta.element.type === Navigate || ruta.element.type === EstadoVacio);

describe('rutas de las áreas diferidas', () => {
  it('encuentra todas las áreas', () => {
    expect(diferidas.length).toBeGreaterThanOrEqual(20);
  });

  it('toda ruta tiene `lazy` o es una redirección o un vacío (que se quedan en el arranque)', () => {
    const sueltas = todas.filter(({ ruta }) => !ruta.lazy && !esEstaticaPermitida(ruta)).map(({ archivo, ruta }) => `${archivo}: ${ruta.path ?? '(index)'}`);
    expect(sueltas).toEqual([]);
  });

  it('ninguna ruta mezcla `lazy` con `element` o `Component` (react-router ignoraría el de `lazy`)', () => {
    const mezcladas = todas.filter(({ ruta }) => ruta.lazy && (ruta.element || ruta.Component)).map(({ archivo, ruta }) => `${archivo}: ${ruta.path}`);
    expect(mezcladas).toEqual([]);
  });

  it('cada `lazy` resuelve a un elemento válido', { timeout: 120_000 }, async () => {
    for (const { archivo, ruta } of todas) {
      if (typeof ruta.lazy !== 'function') continue;
      const resuelto = (await ruta.lazy()) as { element?: unknown };
      expect(isValidElement(resuelto.element), `${archivo}: ${ruta.path}`).toBe(true);
    }
  });
});
