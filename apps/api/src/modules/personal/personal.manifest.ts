import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo en construcción: solo su manifiesto, para que el menú y la contratación ya lo conozcan.
export const manifiestoPersonal: ManifiestoDeEntrada = {
  codigo: 'personal',
  nombre: 'Personal',
  descripcion: 'Personas del equipo, asistencia y pagos.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['personal:ver', 'personal:editar'],
  permisosPorNivel: {
    completo: ['personal:ver', 'personal:editar'],
    lectura: ['personal:ver'],
  },
  secciones: [],
  familia: 'personal',
  orden: 1,
  acento: 'rosa',
  icono: 'personal',
  enConstruccion: true,
};
