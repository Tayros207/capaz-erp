import { useQuery } from '@tanstack/react-query';
import { datosOError, listarEmpresas, listarSolicitudes, type SalidaDePlataforma } from './api.ts';
import { CLAVE_EMPRESAS, CLAVE_SOLICITUDES } from './claves.ts';

export type EmpresaDeLista = SalidaDePlataforma<'plataforma_empresas_listar'>['items'][number];

/** Toda la cartera (son pocas filas): el filtrado y el orden se hacen en el navegador. */
export function useEmpresas() {
  return useQuery({ queryKey: [...CLAVE_EMPRESAS, 'lista', ''], queryFn: async () => datosOError(await listarEmpresas()).items });
}

export function useSolicitudesPendientes() {
  return useQuery({ queryKey: [...CLAVE_SOLICITUDES, 'pendiente'], queryFn: async () => datosOError(await listarSolicitudes('pendiente')).items });
}
