import { useQuery } from '@tanstack/react-query';
import type { DeudaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { listarDeudas, verCliente } from './api.ts';
import { CLAVE_REGISTRO } from './claves.ts';

export const PAGINAS_MAXIMAS = 10;
const POR_PAGINA_DEL_ESTADO = 100;

/** Recorre `deudas_listar` filtrada por cliente hasta `PAGINAS_MAXIMAS`; `truncado` avisa si quedó más. */
async function deudasDelCliente(contactoId: string, estado: 'abiertas' | 'pagadas'): Promise<{ items: DeudaDto[]; truncado: boolean }> {
  const items: DeudaDto[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < PAGINAS_MAXIMAS; i++) {
    const p = datosOError(await listarDeudas({ tipo: 'por_cobrar', estado, contactoId, limite: POR_PAGINA_DEL_ESTADO, ...(cursor ? { cursor } : {}) }));
    items.push(...p.items);
    if (!p.siguiente) return { items, truncado: false };
    cursor = p.siguiente;
  }
  return { items, truncado: true };
}

/** Datos del estado de cuenta: cliente, deudas abiertas y (si se piden) las pagadas. */
export function useEstadoDeCuenta(contactoId: string, conPagadas: boolean) {
  const cliente = useQuery({ queryKey: [...CLAVE_REGISTRO, 'cliente', contactoId], queryFn: async () => datosOError(await verCliente(contactoId)) });
  const abiertas = useQuery({ queryKey: [...CLAVE_REGISTRO, 'estado-cuenta', contactoId, 'abiertas'], queryFn: () => deudasDelCliente(contactoId, 'abiertas') });
  const pagadas = useQuery({ queryKey: [...CLAVE_REGISTRO, 'estado-cuenta', contactoId, 'pagadas'], queryFn: () => deudasDelCliente(contactoId, 'pagadas'), enabled: conPagadas });
  return { cliente, abiertas, pagadas };
}
