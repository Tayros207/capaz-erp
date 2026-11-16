import type { AccesoDeModulo, Yo } from '@capaz/shared';

/** El acceso de esta persona al módulo, o nulo si el módulo no existe o no puede entrar. */
export function accesoA(yo: Yo | null | undefined, codigo: string): AccesoDeModulo | null {
  const modulo = yo?.modulos.find((m) => m.codigo === codigo);
  return modulo && modulo.acceso.puedeEntrar ? modulo.acceso : null;
}

/** Si puede crear y cambiar datos en el módulo (acceso completo, no solo lectura). */
export function puedeEscribirEn(yo: Yo | null | undefined, codigo: string): boolean {
  return accesoA(yo, codigo)?.puedeEscribir ?? false;
}

/** Las secciones ya construidas del módulo, en su orden; vacío si no puede entrar. */
export function seccionesDe(yo: Yo | null | undefined, codigo: string) {
  if (!accesoA(yo, codigo)) return [];
  return yo?.modulos.find((m) => m.codigo === codigo)?.secciones.filter((s) => s.construida) ?? [];
}
