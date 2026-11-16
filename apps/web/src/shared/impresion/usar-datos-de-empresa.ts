import { useQuery } from '@tanstack/react-query';
import { clienteDeConsultas } from '../api/cliente-de-consultas.ts';
import { datosOError } from '../api/consultas.ts';
import { llamar } from '../api/herramientas.ts';
import type { DatosDeEmpresaImpresion } from './hoja-imprimible.tsx';
import { normalizarEmpresa } from './logica-impresion.ts';

/** Clave de la consulta global: la pantalla «Empresa» puede invalidarla al guardar. */
export const CLAVE_DATOS_DE_EMPRESA = ['empresa', 'datos-para-imprimir'] as const;

/** Consulta los datos de la empresa por `empresa_ver_configuracion`; el logo solo pasa si es un data URL de imagen. */
async function consultarDatosDeEmpresa(): Promise<DatosDeEmpresaImpresion> {
  const c = datosOError(await llamar('empresa_ver_configuracion', {}));
  return normalizarEmpresa({
    razonSocial: c.razonSocial,
    ruc: c.ruc,
    direccionFiscal: c.direccionFiscal,
    telefono: c.telefono,
    correo: c.correo,
    pieDeDocumento: c.pieDeDocumento,
    logoDataUrl: c.logoDataUrl,
  });
}

/** Refresca la caché después de cambiar los datos de la empresa. */
export const refrescarDatosDeEmpresa = () => clienteDeConsultas.invalidateQueries({ queryKey: CLAVE_DATOS_DE_EMPRESA });

/**
 * Datos de la empresa para el encabezado y el pie de los documentos. Con caché: varios documentos
 * abiertos comparten una sola consulta. Mientras carga o si falla, `datos` es `undefined` (la hoja
 * se imprime sin encabezado de empresa en vez de bloquearse).
 */
export function useDatosDeEmpresaParaImprimir() {
  const q = useQuery({ queryKey: CLAVE_DATOS_DE_EMPRESA, queryFn: consultarDatosDeEmpresa, staleTime: 5 * 60_000 });
  return { datos: q.data, cargando: q.isPending, error: q.error };
}
