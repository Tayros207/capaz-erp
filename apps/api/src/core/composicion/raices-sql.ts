import { sql, type AnyColumn, type SQL } from 'drizzle-orm';

/**
 * Prefiltro SQL de «precios anteriores»: la descripción (sin tildes, b/v, s/z y h muda plegadas igual que
 * `plegarParaBuscar` de `@capaz/shared`) tiene alguna palabra que EMPIEZA con una de las raíces. No decide parecidos:
 * solo evita traer toda la tabla; el núcleo puntúa después. Las raíces ya vienen validadas (`[a-z0-9]{2,20}`).
 */
export function coincideConRaices(columna: AnyColumn, raices: readonly string[] | undefined): SQL | undefined {
  if (!raices?.length) return undefined;
  const patron = `(^|[^a-z0-9])(${raices.join('|')})`;
  return sql`translate(lower(${columna}), 'áéíóúüñvwzh', 'aeiouunbbs') ~ ${patron}`;
}
