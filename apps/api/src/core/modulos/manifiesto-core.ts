import type { ManifiestoDeEntrada } from '@capaz/shared';

// El núcleo: siempre activo, no se contrata, no depende de nada. Sus permisos son de la empresa y
// de los clientes compartidos por todos los módulos.
export const manifiestoCore: ManifiestoDeEntrada = {
  codigo: 'core',
  nombre: 'Núcleo',
  descripcion: 'Empresa, usuarios, clientes y configuración compartidos por todos los módulos.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['clientes:ver', 'clientes:editar', 'empresa:ver', 'empresa:configurar', 'miembros:ver', 'miembros:gestionar', 'productos:ver', 'productos:editar', 'sucursales:ver', 'sucursales:gestionar', 'auditoria:ver', 'borradores:ver', 'conexiones:ver', 'conexiones:gestionar', 'automatizaciones:ver', 'automatizaciones:gestionar', 'datos:importar', 'datos:exportar'],
  permisosPorNivel: {
    completo: ['clientes:ver', 'clientes:editar', 'empresa:ver', 'empresa:configurar', 'miembros:ver', 'miembros:gestionar', 'productos:ver', 'productos:editar', 'sucursales:ver', 'sucursales:gestionar', 'auditoria:ver', 'borradores:ver', 'conexiones:ver', 'conexiones:gestionar', 'automatizaciones:ver', 'automatizaciones:gestionar', 'datos:importar', 'datos:exportar'],
    lectura: ['clientes:ver', 'empresa:ver', 'productos:ver', 'sucursales:ver', 'auditoria:ver', 'borradores:ver', 'conexiones:ver', 'automatizaciones:ver'],
  },
  secciones: [],
  familia: null,
  acento: 'gris',
  icono: 'nucleo',
};
