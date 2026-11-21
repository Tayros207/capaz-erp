// Presupuesto de carga de la web: mide, sobre `dist/`, cuánto JS baja al abrir la app (el «inicial») y cuánto
// más baja al entrar a cada área diferida. Falla (código 1) si se pasa de los topes.
// Uso: `pnpm --filter web build && pnpm --filter web presupuesto`. Node ejecuta el `.ts` directamente (sin dependencias).
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

// Topes en kB comprimidos con gzip (nodo): la medición tras dividir por rutas (2026-11-21: inicial 243,2 y peor área 69,7)
// más un 5 %. Subirlos es una decisión consciente: quien los sube explica por qué en su informe. `null` = solo medir.
const TOPE_INICIAL_KB: number | null = 256;
const TOPE_RUTA_KB: number | null = 74;

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const kb = (bytes: number): number => Math.round((bytes / 1000) * 10) / 10; // kB de 1000 bytes, como informa Vite

const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const inicialesDelHtml = [
  ...[...html.matchAll(/<script[^>]*type="module"[^>]*src="\/([^"]+\.js)"/g)].map((m) => m[1]!),
  ...[...html.matchAll(/<link[^>]*rel="modulepreload"[^>]*href="\/([^"]+\.js)"/g)].map((m) => m[1]!),
];

/** Importaciones estáticas de un trozo (`from "./x.js"` e `import "./x.js"`). Los `import("…")` no cuentan. */
function importacionesEstaticas(archivo: string): string[] {
  const codigo = readFileSync(join(DIST, archivo), 'utf8');
  const hallados = [...codigo.matchAll(/(?:\bfrom|\bimport)\s*["']\.\/([^"']+\.js)["']/g)].map((m) => `assets/${m[1]}`);
  return [...new Set(hallados)];
}

const todos = readdirSync(join(DIST, 'assets')).filter((f) => f.endsWith('.js')).map((f) => `assets/${f}`);
const gz = new Map<string, number>();
const bruto = new Map<string, number>();
for (const archivo of todos) {
  const buffer = readFileSync(join(DIST, archivo));
  bruto.set(archivo, buffer.length);
  gz.set(archivo, gzipSync(buffer).length);
}

// Inicial = lo que el HTML pide + todo lo que esos trozos importan de forma estática (cierre transitivo).
const inicial = new Set<string>();
const porVisitar = [...inicialesDelHtml];
while (porVisitar.length > 0) {
  const actual = porVisitar.pop()!;
  if (inicial.has(actual)) continue;
  inicial.add(actual);
  porVisitar.push(...importacionesEstaticas(actual));
}

const suma = (archivos: Iterable<string>, medida: Map<string, number>): number => {
  let total = 0;
  for (const a of archivos) total += medida.get(a) ?? 0;
  return total;
};

const inicialGz = kb(suma(inicial, gz));
console.log(`JS inicial: ${inicial.size} archivos, ${inicialGz} kB gzip (${kb(suma(inicial, bruto))} kB sin comprimir)`);

// Por cada trozo que no es inicial: él más lo que importa de forma estática y no es inicial.
let peorRuta = { archivo: '', gzKb: 0 };
let masPesado = { archivo: '', gzKb: 0, brutoKb: 0 };
for (const archivo of todos) {
  const pesoPropio = kb(gz.get(archivo) ?? 0);
  if (pesoPropio > masPesado.gzKb) masPesado = { archivo, gzKb: pesoPropio, brutoKb: kb(bruto.get(archivo) ?? 0) };
  if (inicial.has(archivo)) continue;
  const cierre = new Set<string>();
  const pendientes = [archivo];
  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    if (cierre.has(actual) || inicial.has(actual)) continue;
    cierre.add(actual);
    pendientes.push(...importacionesEstaticas(actual));
  }
  const total = kb(suma(cierre, gz));
  if (total > peorRuta.gzKb) peorRuta = { archivo, gzKb: total };
}

console.log(`Trozo más pesado: ${masPesado.archivo} (${masPesado.gzKb} kB gzip, ${masPesado.brutoKb} kB sin comprimir)`);
console.log(`Total de trozos JS: ${todos.length}`);
console.log(`Peor área diferida (trozo + sus comunes no iniciales): ${peorRuta.archivo || '—'} = ${peorRuta.gzKb} kB gzip`);

const fallos: string[] = [];
if (TOPE_INICIAL_KB !== null && inicialGz > TOPE_INICIAL_KB) fallos.push(`JS inicial ${inicialGz} kB > tope ${TOPE_INICIAL_KB} kB`);
if (TOPE_RUTA_KB !== null && peorRuta.gzKb > TOPE_RUTA_KB) fallos.push(`Peor área ${peorRuta.gzKb} kB > tope ${TOPE_RUTA_KB} kB`);
if (fallos.length > 0) {
  for (const f of fallos) console.error(`PRESUPUESTO EXCEDIDO: ${f}`);
  process.exitCode = 1;
}
