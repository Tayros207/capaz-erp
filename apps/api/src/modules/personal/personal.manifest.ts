import type { ManifiestoDeEntrada } from '@capaz/shared';

// Colaboradores, asistencia diaria y adelantos (FICHAS-OLA-3 §4). Sin planilla. `enConstruccion` es del integrador.
export const manifiestoPersonal: ManifiestoDeEntrada = {
  codigo: 'personal',
  nombre: 'Personal',
  descripcion: 'Colaboradores, asistencia del día y adelantos.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['personal:ver', 'personal:editar', 'personal:adelantos', 'personal:anular'],
  permisosPorNivel: {
    completo: ['personal:ver', 'personal:editar', 'personal:adelantos', 'personal:anular'],
    lectura: ['personal:ver'],
  },
  secciones: [
    { id: 'colaboradores', nombre: 'Colaboradores', ruta: '/m/personal', construida: true },
    { id: 'asistencia', nombre: 'Asistencia', ruta: '/m/personal/asistencia', construida: true },
    { id: 'adelantos', nombre: 'Adelantos', ruta: '/m/personal/adelantos', construida: true },
  ],
  familia: 'personal',
  orden: 1,
  acento: 'rosa',
  icono: 'personal',
};
