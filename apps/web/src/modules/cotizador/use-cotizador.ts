import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';

/** Qué puede hacer esta persona en el Cotizador: escribir exige acceso completo al módulo y el permiso. */
export function usePermisosDelCotizador(): { editar: boolean; configurar: boolean } {
  const yo = useYo();
  const escribe = !!yo && puedeEscribirEn(yo, 'cotizador');
  return { editar: escribe && puede(yo, 'cotizador:editar'), configurar: escribe && puede(yo, 'cotizador:configurar') };
}
