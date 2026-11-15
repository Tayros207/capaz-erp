// Reglas de arquitectura del repositorio (AGENTS.md, reglas 2, 7 y 11). Función pura: recibe los
// archivos y devuelve las violaciones. La prueba `arquitectura.spec.ts` la aplica al código real
// y comprueba, con archivos de ejemplo, que de verdad detecta cada violación.

export type Archivo = { ruta: string; texto: string };
export type Violacion = { regla: string; ruta: string; detalle: string };

export const MAXIMO_DE_LINEAS = 500;

const esPrueba = (ruta: string) => /\.spec\.tsx?$/.test(ruta);
/** `pruebas/`: utilidades de las pruebas de integración; pueden abrir pools y leer el entorno de pruebas. */
const esUtilidadDePrueba = (ruta: string) => ruta.startsWith('pruebas/');
const esCodigo = (ruta: string) => /\.tsx?$/.test(ruta) && !ruta.endsWith('.d.ts');

function sinComentarios(texto: string): string {
  return texto.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** Especificadores de todos los `import`, `export … from` e `import()` del texto. */
export function importsDe(texto: string): string[] {
  const codigo = sinComentarios(texto);
  const encontrados: string[] = [];
  const patrones = [
    /\b(?:import|export)\s[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const patron of patrones) for (const m of codigo.matchAll(patron)) encontrados.push(m[1]!);
  return encontrados;
}

/** Resuelve un import relativo contra la carpeta del archivo; los de paquetes se devuelven tal cual. */
export function resolver(ruta: string, especificador: string): string | null {
  if (!especificador.startsWith('.')) return null;
  const partes = ruta.split('/').slice(0, -1);
  for (const p of especificador.split('/')) {
    if (p === '..') partes.pop();
    else if (p !== '.') partes.push(p);
  }
  return partes.join('/');
}

const capaDe = (ruta: string) => ruta.split('/')[0] ?? '';
const moduloDe = (ruta: string) => (capaDe(ruta) === 'modules' ? ruta.split('/')[1] : undefined);

type Config = {
  /** Qué capas no pueden importar a cuáles. */
  prohibidas: ReadonlyArray<readonly [desde: string, hacia: string]>;
  /** Solo en el servidor: `process.env` y `pg` tienen una carpeta dueña. */
  puertasUnicas: boolean;
};

function analizar(archivos: readonly Archivo[], config: Config): Violacion[] {
  const v: Violacion[] = [];
  for (const { ruta, texto } of archivos) {
    if (!esCodigo(ruta)) continue;
    const lineas = texto.split('\n').length;
    if (lineas > MAXIMO_DE_LINEAS) {
      v.push({ regla: 'tamano', ruta, detalle: `${lineas} líneas (máximo ${MAXIMO_DE_LINEAS}).` });
    }
    if (esPrueba(ruta)) continue;

    for (const esp of importsDe(texto)) {
      const destino = resolver(ruta, esp);
      if (destino) {
        const [desde, hacia] = [capaDe(ruta), capaDe(destino)];
        if (config.prohibidas.some(([d, h]) => d === desde && h === hacia)) {
          v.push({ regla: 'capas', ruta, detalle: `«${desde}» no puede importar de «${hacia}» (${esp}).` });
        }
        const [a, b] = [moduloDe(ruta), moduloDe(destino)];
        if (a && b && a !== b) {
          v.push({ regla: 'modulos', ruta, detalle: `El módulo «${a}» no puede importar del módulo «${b}» (${esp}).` });
        }
      } else if (config.puertasUnicas && (esp === 'pg' || esp.startsWith('pg/')) && !ruta.startsWith('infra/database/') && !esUtilidadDePrueba(ruta)) {
        v.push({ regla: 'pg', ruta, detalle: 'Solo infra/database puede importar «pg».' });
      }
    }
    if (config.puertasUnicas && /\bprocess\.env\b/.test(sinComentarios(texto)) && !ruta.startsWith('infra/config/') && !esUtilidadDePrueba(ruta)) {
      v.push({ regla: 'env', ruta, detalle: 'Solo infra/config puede leer las variables de entorno.' });
    }
  }
  return v;
}

/** Servidor: `modules` no se cruzan, `core` no ve `modules`, `infra` no ve a nadie. `pruebas/` (utilidades de prueba) puede usar `pg`. */
export const analizarServidor = (archivos: readonly Archivo[]) =>
  analizar(archivos, {
    puertasUnicas: true,
    prohibidas: [
      ['core', 'modules'],
      ['infra', 'core'],
      ['infra', 'modules'],
    ],
  });

/** Web: `shared` no ve nada de arriba, `core` no ve `modules`, y los `modules` no se cruzan. */
export const analizarWeb = (archivos: readonly Archivo[]) =>
  analizar(archivos, {
    puertasUnicas: false,
    prohibidas: [
      ['core', 'modules'],
      ['shared', 'core'],
      ['shared', 'modules'],
      ['shared', 'app'],
    ],
  });
