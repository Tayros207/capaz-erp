import { describe, expect, it } from 'vitest';
import { crearColaEnSerie } from './cola.ts';

describe('cola en serie', () => {
  it('ejecuta las tareas una tras otra, en el orden en que llegaron', async () => {
    const enSerie = crearColaEnSerie();
    const registro: string[] = [];
    const lenta = enSerie(async () => {
      registro.push('a:inicio');
      await new Promise((r) => setTimeout(r, 15));
      registro.push('a:fin');
    });
    const rapida = enSerie(async () => {
      registro.push('b:inicio');
    });
    await Promise.all([lenta, rapida]);
    expect(registro).toEqual(['a:inicio', 'a:fin', 'b:inicio']);
  });

  it('una tarea que falla no detiene a las siguientes', async () => {
    const enSerie = crearColaEnSerie();
    const mala = enSerie(() => Promise.reject(new Error('x')));
    const buena = enSerie(async () => 7);
    await expect(mala).rejects.toThrow('x');
    await expect(buena).resolves.toBe(7);
  });
});
