import { useQuery } from '@tanstack/react-query';
import { datosOError } from '../../shared/api/consultas.ts';
import { CLAVE_CRM, iniciarCrm, listarEtapas } from './api.ts';
import { usePermisosCrm } from './permisos.ts';

/**
 * Etapas vivas del embudo. La primera vez, quien puede escribir prepara el CRM (`crm_iniciar`, que no
 * cambia nada si ya hay etapas); quien solo lee ve la lista tal como está.
 */
export function useEtapas() {
  const { editar } = usePermisosCrm();
  return useQuery({
    queryKey: [...CLAVE_CRM, 'etapas', editar],
    queryFn: async () => {
      const etapas = datosOError(await listarEtapas()).items;
      if (etapas.length > 0 || !editar) return etapas;
      datosOError(await iniciarCrm());
      return datosOError(await listarEtapas()).items;
    },
  });
}
