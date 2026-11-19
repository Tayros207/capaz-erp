import { exito, limitarTarjetas } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { tarjetasDeActividades } from '../domain/pendientes.js';
import { actividadesPorHacer } from '../repositories/pendientes.repository.js';
import { MODULO, propios } from './comunes.js';

export const crmPendientes = definirHerramienta('crm_pendientes', {
  modulo: MODULO,
  permiso: 'crm:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Pendientes de seguimiento (Mi día)',
    paraQueSirve: 'Lista las actividades de seguimiento sin hacer que ya vencieron o vencen hoy o mañana, de oportunidades abiertas.',
    cuandoUsarla: 'La usa el panel «Mi día»; también sirve para saber a quién llamar hoy.',
    campos: [{ nombre: 'fecha', queSeAnota: 'El día que se toma como hoy (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-11-18' }],
    ejemploTecleado: 'qué actividades tengo vencidas',
    ejemploHablado: 'a quién tengo que llamar hoy',
    erroresComunes: ['Con alcance «propios» solo salen tus actividades.', 'Una actividad sin fecha de vencimiento no aparece.'],
    relacionadas: ['actividades_listar', 'actividad_completar'],
  },
  auditar: (_a, d) => ({ ...(d && { resumen: { tarjetas: d.tarjetas.length, total: d.total } }) }),
  async ejecutar(args, ctx, tx) {
    const dia = args.fecha ?? (await hoyDeLaEmpresa(tx)).dia;
    const filas = await actividadesPorHacer(tx, ctx, dia, propios(ctx));
    return exito({ fecha: dia, ...limitarTarjetas(tarjetasDeActividades(filas, dia)), anotaciones: [] });
  },
});
