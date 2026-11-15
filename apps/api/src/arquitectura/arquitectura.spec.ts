import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { analizarServidor, analizarWeb, importsDe, MAXIMO_DE_LINEAS, type Archivo } from './reglas.js';

function leer(raiz: string): Archivo[] {
  const salida: Archivo[] = [];
  const recorrer = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const completa = join(dir, e.name);
      if (e.isDirectory()) recorrer(completa);
      else if (/\.tsx?$/.test(e.name)) {
        salida.push({ ruta: relative(raiz, completa).split(sep).join('/'), texto: readFileSync(completa, 'utf8') });
      }
    }
  };
  recorrer(raiz);
  return salida;
}

const ejemplo = (ruta: string, texto: string): Archivo => ({ ruta, texto });

describe('el código real respeta las reglas', () => {
  it('servidor (apps/api/src)', () => {
    expect(analizarServidor(leer(join(import.meta.dirname, '..')))).toEqual([]);
  });

  it('web (apps/web/src)', () => {
    expect(analizarWeb(leer(join(import.meta.dirname, '../../../web/src')))).toEqual([]);
  });
});

describe('las reglas detectan violaciones de ejemplo', () => {
  it('un módulo que importa de otro', () => {
    const v = analizarServidor([ejemplo('modules/registro/a.ts', "import { x } from '../cotizador/b.js';")]);
    expect(v.map((x) => x.regla)).toEqual(['modulos']);
  });

  it('core que importa de modules', () => {
    const v = analizarServidor([ejemplo('core/auth/a.ts', "import { x } from '../../modules/registro/b.js';")]);
    expect(v.some((x) => x.regla === 'capas')).toBe(true);
  });

  it('infra que importa de core', () => {
    const v = analizarServidor([ejemplo('infra/http/a.ts', "import { x } from '../../core/b.js';")]);
    expect(v.some((x) => x.regla === 'capas')).toBe(true);
  });

  it('process.env fuera de infra/config, pero no en comentarios', () => {
    expect(analizarServidor([ejemplo('core/a.ts', 'const p = process.env.PORT;')]).map((x) => x.regla)).toEqual(['env']);
    expect(analizarServidor([ejemplo('core/a.ts', '// usa process.env más abajo\nconst x = 1;')])).toEqual([]);
    expect(analizarServidor([ejemplo('infra/config/a.ts', 'const p = process.env;')])).toEqual([]);
  });

  it('pg fuera de infra/database', () => {
    expect(analizarServidor([ejemplo('core/a.ts', "import pg from 'pg';")]).map((x) => x.regla)).toEqual(['pg']);
    expect(analizarServidor([ejemplo('infra/database/a.ts', "import pg from 'pg';")])).toEqual([]);
  });

  it('un archivo de más de 500 líneas, también si es una prueba', () => {
    const largo = 'const a = 1;\n'.repeat(MAXIMO_DE_LINEAS + 1);
    expect(analizarServidor([ejemplo('core/a.ts', largo)]).map((x) => x.regla)).toEqual(['tamano']);
    expect(analizarServidor([ejemplo('core/a.spec.ts', largo)]).map((x) => x.regla)).toEqual(['tamano']);
  });

  it('en la web, shared no puede importar de core', () => {
    const v = analizarWeb([ejemplo('shared/ui/a.tsx', "import { x } from '../../core/b';")]);
    expect(v.some((x) => x.regla === 'capas')).toBe(true);
  });

  it('no da falsos positivos con imports legítimos', () => {
    const buenos = [
      ejemplo('core/auth/a.ts', "import { x } from '../../infra/database/db.js';"),
      ejemplo('modules/registro/a.ts', "import { x } from '../../core/auth/a.js';\nimport { y } from './b.js';"),
      ejemplo('infra/http/a.ts', "import { x } from '../logger/l.js';\nimport { z } from '@capaz/shared';"),
    ];
    expect(analizarServidor(buenos)).toEqual([]);
  });
});

describe('importsDe', () => {
  it('lee imports, reexportaciones, efectos e import dinámico', () => {
    const t = `import a from './a.js';\nimport { b } from "./b.js";\nexport * from './c.js';\nimport './d.js';\nconst e = await import('./e.js');\n// import x from './comentado.js';`;
    expect(importsDe(t)).toEqual(['./a.js', './b.js', './c.js', './d.js', './e.js']);
  });
});
