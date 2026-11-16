import { useQuery } from '@tanstack/react-query';
import { datosOError } from '../../shared/api/consultas.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { listarCuentas } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';

// Ganchos compartidos por las pantallas del módulo.

/** Si la persona puede registrar movimientos y deudas (acceso de escritura al módulo y permiso de editar). */
export function usePuedeEditar(permiso = 'registro:editar'): boolean {
  const yo = useYo();
  return !!yo && puedeEscribirEn(yo, 'registro') && puede(yo, permiso);
}

/** Las cuentas vivas del módulo, compartidas por todas sus pantallas. */
export function useCuentas() {
  return useQuery({ queryKey: [...CLAVE_REGISTRO, 'cuentas'], queryFn: async () => datosOError(await listarCuentas()) });
}
