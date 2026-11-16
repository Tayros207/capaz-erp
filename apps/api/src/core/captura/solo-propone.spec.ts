import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// R19: la captura y los intérpretes solo leen y proponen; nunca ejecutan ni escriben.

const RAIZ = new URL('../../', import.meta.url).pathname; // src/
const PROHIBIDO = ['EjecutorDeHerramientas', 'ejecutarDentro', 'emitir(', '.insert(', '.update(', '.delete('];

function archivos(dir: string): string[] {
  let lista: string[];
  try {
    lista = readdirSync(dir);
  } catch {
    return [];
  }
  return lista.flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return ruta.endsWith('.ts') && !ruta.endsWith('.spec.ts') ? [ruta] : [];
  });
}

const dictados = readdirSync(join(RAIZ, 'modules')).flatMap((m) => archivos(join(RAIZ, 'modules', m, 'dictado')));
const objetivo = [...archivos(join(RAIZ, 'core/captura')), ...dictados];

describe('R19 · la captura solo propone', () => {
  it('vigila archivos', () => expect(objetivo.length).toBeGreaterThan(5));
  it.each(objetivo.map((f) => [relative(RAIZ, f), f] as const))('%s no ejecuta ni escribe', (_n, f) => {
    const texto = readFileSync(f, 'utf8');
    for (const p of PROHIBIDO) expect(texto, `«${p}» en ${f}`).not.toContain(p);
  });
});
