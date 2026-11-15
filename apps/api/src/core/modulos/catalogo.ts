import { manifiestoDeModuloSchema, type AccesoDeModulo, type ManifiestoDeEntrada, type ManifiestoDeModulo } from '@capaz/shared';
import { accesoAModulo, permisosEfectivos, type Asignacion, type Contratacion } from './acceso.js';

export const MANIFIESTOS = Symbol('MANIFIESTOS');

export class CatalogoInvalido extends Error {
  constructor(readonly problemas: readonly string[]) {
    super(`Catálogo de módulos inválido:\n${problemas.map((p) => `  - ${p}`).join('\n')}`);
    this.name = 'CatalogoInvalido';
  }
}

/**
 * Valida los manifiestos al arrancar (el servidor no arranca si fallan): forma de cada uno, códigos
 * únicos, dependencias que existen, sin ciclos, y cada permiso en un solo módulo.
 */
export function validarCatalogo(entradas: readonly ManifiestoDeEntrada[]): ManifiestoDeModulo[] {
  const problemas: string[] = [];
  const manifiestos: ManifiestoDeModulo[] = [];

  for (const entrada of entradas) {
    const r = manifiestoDeModuloSchema.safeParse(entrada);
    if (r.success) manifiestos.push(r.data);
    else for (const i of r.error.issues) problemas.push(`«${entrada.codigo}»: ${i.message}`);
  }

  const codigos = new Set<string>();
  for (const m of manifiestos) {
    if (codigos.has(m.codigo)) problemas.push(`Código repetido: «${m.codigo}».`);
    codigos.add(m.codigo);
  }
  if (!codigos.has('core')) problemas.push('Falta el módulo «core».');

  for (const m of manifiestos) {
    for (const d of m.dependeDe) {
      if (d === 'core') problemas.push(`«${m.codigo}» no declara «core»: es implícito.`);
      else if (!codigos.has(d)) problemas.push(`«${m.codigo}» depende de «${d}», que no existe.`);
    }
  }

  const duenos = new Map<string, string>();
  for (const m of manifiestos) {
    for (const p of m.permisos) {
      const otro = duenos.get(p);
      if (otro && otro !== m.codigo) problemas.push(`El permiso «${p}» está en «${otro}» y en «${m.codigo}».`);
      duenos.set(p, m.codigo);
    }
  }

  const ciclo = buscarCiclo(manifiestos);
  if (ciclo) problemas.push(`Ciclo de dependencias: ${ciclo.join(' → ')}.`);

  if (problemas.length) throw new CatalogoInvalido(problemas);
  return manifiestos;
}

function buscarCiclo(manifiestos: readonly ManifiestoDeModulo[]): string[] | null {
  const deps = new Map(manifiestos.map((m) => [m.codigo, m.dependeDe]));
  const estado = new Map<string, 'visitando' | 'listo'>();
  const camino: string[] = [];
  const visitar = (c: string): string[] | null => {
    if (estado.get(c) === 'listo') return null;
    if (estado.get(c) === 'visitando') return [...camino.slice(camino.indexOf(c)), c];
    estado.set(c, 'visitando');
    camino.push(c);
    for (const d of deps.get(c) ?? []) {
      const r = visitar(d);
      if (r) return r;
    }
    camino.pop();
    estado.set(c, 'listo');
    return null;
  };
  for (const m of manifiestos) {
    const r = visitar(m.codigo);
    if (r) return r;
  }
  return null;
}

/** Los módulos del sistema, ya validados, con lo que se calcula sobre ellos. */
export class CatalogoDeModulos {
  readonly manifiestos: readonly ManifiestoDeModulo[];

  constructor(entradas: readonly ManifiestoDeEntrada[]) {
    this.manifiestos = validarCatalogo(entradas);
  }

  porCodigo(codigo: string): ManifiestoDeModulo | undefined {
    return this.manifiestos.find((m) => m.codigo === codigo);
  }

  /** Lo que se contrata: todo menos el núcleo. */
  contratables(): readonly ManifiestoDeModulo[] {
    return this.manifiestos.filter((m) => m.codigo !== 'core');
  }

  porDefecto(): readonly (ManifiestoDeModulo & { porDefecto: NonNullable<ManifiestoDeModulo['porDefecto']> })[] {
    return this.contratables().filter((m): m is ManifiestoDeModulo & { porDefecto: NonNullable<ManifiestoDeModulo['porDefecto']> } => !!m.porDefecto);
  }

  accesos(entrada: { rol: string | null; contratos: readonly Contratacion[]; asignaciones: readonly Asignacion[]; ahora?: Date }): AccesoDeModulo[] {
    return this.manifiestos.map((m) =>
      accesoAModulo({
        manifiesto: m,
        rol: entrada.rol,
        contratacion: entrada.contratos.find((c) => c.modulo === m.codigo),
        asignacion: entrada.asignaciones.find((a) => a.modulo === m.codigo),
        ahora: entrada.ahora,
      }),
    );
  }

  permisos(accesos: readonly AccesoDeModulo[]): string[] {
    return permisosEfectivos(this.manifiestos, accesos);
  }
}
