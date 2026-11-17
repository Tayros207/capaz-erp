import type { EntradaDe } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

// Ficha comercial, contactos y direcciones de un cliente o proveedor (0025).

export const verComercial = (clienteId: string) => llamar('clientes_comercial_ver', { clienteId });
export const guardarComercial = (args: EntradaDe<'clientes_comercial_guardar'>) => llamar('clientes_comercial_guardar', args);
export const listarContactos = (clienteId: string) => llamar('clientes_contactos_listar', { clienteId });
export const guardarContacto = (args: EntradaDe<'clientes_contacto_guardar'>) => llamar('clientes_contacto_guardar', args);
export const eliminarContacto = (id: string) => llamar('clientes_contacto_eliminar', { id });
export const listarDirecciones = (clienteId: string) => llamar('clientes_direcciones_listar', { clienteId });
export const guardarDireccion = (args: EntradaDe<'clientes_direccion_guardar'>) => llamar('clientes_direccion_guardar', args);
export const eliminarDireccion = (id: string) => llamar('clientes_direccion_eliminar', { id });
