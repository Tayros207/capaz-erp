import { puede } from '../../shared/sesion/sesion.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';

/** Qué botones de escritura se muestran (R18): módulo con escritura y el permiso del manifiesto. */
export function usePermisosCrm(): { editar: boolean; configurar: boolean } {
  const yo = useYo();
  const escribe = !!yo && puedeEscribirEn(yo, 'crm');
  return { editar: escribe && puede(yo, 'crm:editar'), configurar: escribe && puede(yo, 'crm:configurar') };
}
