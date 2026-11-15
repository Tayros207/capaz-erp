import type { ManifiestoDeEntrada } from '@capaz/shared';

// Módulo base del ERP: caja, ingresos, egresos, deudas y abonos, con voz y bandeja de revisión.
// Por ahora solo el manifiesto (fase 4); sus pantallas y herramientas llegan con el plan del Registro.
export const manifiestoRegistro: ManifiestoDeEntrada = {
  codigo: 'registro',
  nombre: 'Registro',
  descripcion: 'Ingresos, egresos, deudas y abonos. Se dicta por voz y se aprueba con un clic.',
  version: '0.1.0',
  dependeDe: [],
  permisos: ['registro:ver', 'registro:editar', 'registro:aprobar', 'registro:reportes'],
  permisosPorNivel: {
    completo: ['registro:ver', 'registro:editar', 'registro:aprobar', 'registro:reportes'],
    lectura: ['registro:ver', 'registro:reportes'],
  },
  secciones: [],
  acento: 'esmeralda',
  icono: 'registro',
  // Decisión comercial provisional, editable como dato: toda empresa nueva recibe 30 días de prueba.
  porDefecto: { pruebaDias: 30 },
  enConstruccion: true,
};
