import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { alcanceDe } from '../../../core/modulos/alcance.js';
import { resumenDePersonal } from '../repositories/resumen.repository.js';
import { MODULO } from './comunes.js';

export const personalResumen = definirHerramienta('personal_resumen', {
  modulo: MODULO,
  permiso: 'personal:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Resumen de personal',
    paraQueSirve: 'Cuenta al equipo activo, cuántos faltan por marcar hoy, las asistencias del período por estado y lo adelantado (sin contar lo anulado).',
    cuandoUsarla: 'Cuando quieres saber cómo va el mes sin recorrer las listas.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día del período.', ejemplo: '2026-03-01' },
      { nombre: 'hasta', queSeAnota: 'Último día del período.', ejemplo: '2026-03-31' },
    ],
    ejemploTecleado: 'resumen de personal de marzo',
    ejemploHablado: 'cómo va el personal este mes',
    erroresComunes: ['Tu acceso es solo a tus propios registros: el resumen es de toda la empresa.', 'El período empieza antes de terminar.'],
    relacionadas: ['asistencias_listar', 'adelantos_listar'],
  },
  async ejecutar(args, ctx, tx) {
    if (alcanceDe(ctx, MODULO) === 'propios') return rechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.');
    const hoy = await hoyDeLaEmpresa(tx);
    const r = await resumenDePersonal(tx, { desde: args.desde, hasta: args.hasta, hoy: hoy.dia });
    return exito({ desde: args.desde, hasta: args.hasta, ...r });
  },
});
