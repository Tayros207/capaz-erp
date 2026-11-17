import type { EntradaDe } from '@capaz/shared';

export type PlantillaDelCuadro = NonNullable<EntradaDe<'cuadro_iniciar'>['plantilla']>;
export const ETIQUETA_DE_PLANTILLA: Readonly<Record<PlantillaDelCuadro, string>> = {
  volantes: 'Volantes (con las filas habituales)',
  en_blanco: 'En blanco',
};

export function argumentosDeInicio(f: { plantilla: PlantillaDelCuadro; titulo: string; clienteId: string | null }): EntradaDe<'cuadro_iniciar'> {
  return { plantilla: f.plantilla, ...(f.titulo.trim() && { titulo: f.titulo.trim() }), ...(f.clienteId && { clienteId: f.clienteId }) };
}
