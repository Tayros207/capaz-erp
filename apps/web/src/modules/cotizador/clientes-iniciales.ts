import { datosOError } from '../../shared/api/consultas.ts';
import type { Opcion } from '../../shared/ui/selector-de-registro.tsx';
import { primerosClientes } from './api.ts';

/** Lo que ofrece un selector de cliente al abrirse sin haber escrito nada: los primeros por orden alfabético. */
export async function clientesIniciales(): Promise<Opcion[]> {
  const { items } = datosOError(await primerosClientes());
  return items.map((c) => ({ id: c.id, nombre: c.nombre, ...(c.documentoNumero && { detalle: c.documentoNumero }) }));
}
