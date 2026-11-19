import type { Candidata, ClienteDto, Yo } from '@capaz/shared';
import { puede } from '../../shared/sesion/sesion.ts';
import type { Opcion } from '../../shared/ui/logica-selector.ts';

/** Cliente como opción de selector: el detalle es su documento o, si no tiene, su teléfono (distingue homónimos). */
export function opcionDeCliente(c: Pick<ClienteDto, 'id' | 'nombre' | 'documentoNumero' | 'telefono'>): Opcion {
  const detalle = c.documentoNumero ?? c.telefono;
  return detalle ? { id: c.id, nombre: c.nombre, detalle } : { id: c.id, nombre: c.nombre };
}

export function opcionDeCandidata(c: Candidata): Opcion {
  return c.detalle ? { id: c.id, nombre: c.nombre, detalle: c.detalle } : { id: c.id, nombre: c.nombre };
}

/** Crear clientes exige `clientes:editar` (el servidor lo da a quien escribe en algún módulo). */
export function puedeCrearClientes(yo: Yo | null): boolean {
  return !!yo && puede(yo, 'clientes:editar');
}

export function ayudaDelSelectorDeCliente(puedeCrear: boolean): string {
  return puedeCrear ? 'Escribe el nombre y elige uno de la lista. Si no está, pulsa «Nuevo cliente».' : 'Escribe el nombre y elige uno de la lista.';
}
