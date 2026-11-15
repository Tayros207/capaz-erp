import type { MenuDeYo } from './menu.ts';

/** Migas de pan de la ruta actual según el menú: «Familia > Módulo», «Ajustes > Empresa» o el destino del núcleo. */
export function migasDeRuta(menu: MenuDeYo, ruta: string): string[] {
  const dentro = (base: string | null) => base !== null && (ruta === base || ruta.startsWith(`${base}/`));
  for (const i of menu.nucleo) if (dentro(i.ruta)) return [i.nombre];
  for (const i of menu.ajustes) if (dentro(i.ruta)) return ['Ajustes', i.nombre];
  for (const f of menu.familias) for (const i of f.items) if (dentro(i.ruta)) return [f.nombre, i.nombre];
  return [];
}
