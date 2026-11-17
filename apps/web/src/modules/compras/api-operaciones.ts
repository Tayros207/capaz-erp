import type { EntradaDe } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

// Solicitudes de compra y facturas del proveedor (0026).

export const POR_PAGINA_DE_OPERACIONES = 25;

export const crearSolicitud = (args: EntradaDe<'solicitud_crear'>) => llamar('solicitud_crear', args);
export const verSolicitud = (id: string) => llamar('solicitud_ver', { id });
export const listarSolicitudes = (args: EntradaDe<'solicitudes_listar'>) => llamar('solicitudes_listar', args);
export const enviarSolicitud = (id: string) => llamar('solicitud_enviar', { id });
export const resolverSolicitud = (args: EntradaDe<'solicitud_resolver'>) => llamar('solicitud_resolver', args);
export const convertirSolicitud = (args: EntradaDe<'solicitud_convertir'>) => llamar('solicitud_convertir', args);
export const anularSolicitud = (args: EntradaDe<'solicitud_anular'>) => llamar('solicitud_anular', args);

export const registrarFactura = (args: EntradaDe<'factura_registrar'>) => llamar('factura_registrar', args);
export const anularFactura = (args: EntradaDe<'factura_anular'>) => llamar('factura_anular', args);
export const listarFacturas = (args: EntradaDe<'facturas_listar'>) => llamar('facturas_listar', args);
/** Órdenes del proveedor para elegir a cuál corresponde la factura. */
export const ordenesDeProveedor = (proveedorId: string) => llamar('compras_listar', { estado: 'todas', proveedorId, limite: 50 });
