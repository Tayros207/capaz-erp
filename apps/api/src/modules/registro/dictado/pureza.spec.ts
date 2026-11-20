import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

// Todo archivo de dictado/ que no sea prueba importa solo rutas relativas de dictado/ y zod. Excepción: interprete.ts y resolver.ts (s5b), que leen la base.
// propuesta-de-pedido arma los argumentos con @capaz/shared (soles e importe), sin leer la base.
const CON_LECTURA = ['interprete.ts', 'resolver.ts', 'propuesta-de-pedido.ts'];
const RAIZ = join(process.cwd(), 'src/modules/registro/dictado');

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return archivos(ruta);
    return n.endsWith('.ts') && !n.endsWith('.spec.ts') && !(dir === RAIZ && CON_LECTURA.includes(n)) ? [ruta] : [];
  });
}

describe('pureza de dictado/', () => {
  test('hay archivos que revisar', () => {
    expect(archivos(RAIZ).length).toBeGreaterThan(10);
  });
  test('solo importa de dictado/ (relativo) y de zod', () => {
    for (const ruta of archivos(RAIZ)) {
      const origen = readFileSync(ruta, 'utf8');
      for (const m of origen.matchAll(/^\s*(?:import|export)\b[^;]*?from\s*['"]([^'"]+)['"]/gms)) {
        const destino = m[1]!;
        if (destino === 'zod') continue;
        expect(destino.startsWith('.'), `${ruta} importa ${destino}`).toBe(true);
        expect(join(ruta, '..', destino).startsWith(RAIZ), `${ruta} sale de dictado/ con ${destino}`).toBe(true);
      }
    }
  });
});
