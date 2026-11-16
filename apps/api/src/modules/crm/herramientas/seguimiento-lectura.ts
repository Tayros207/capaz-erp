import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { decodificarCursor } from '../domain/cursor.js';
import { listarActividades } from '../repositories/actividades.repository.js';
import { cifrasDeCrm } from '../repositories/resumen.repository.js';
import { MODULO, propios } from './comunes.js';
import { aActividadDto } from './mapeo.js';

// Lecturas de seguimiento: actividades y resumen del embudo.

export const actividadesListar = definirHerramienta('actividades_listar', {
  modulo: MODULO,
  permiso: 'crm:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar actividades',
    paraQueSirve: 'Muestra las actividades de seguimiento: pendientes, vencidas, hechas o todas, de una oportunidad o de todas.',
    cuandoUsarla: 'Al empezar el día, para ver qué llamadas y tareas tocan.',
    campos: [
      { nombre: 'estado', queSeAnota: 'pendientes, vencidas, hechas o todas (por defecto, pendientes).', ejemplo: 'vencidas' },
      { nombre: 'oportunidadId', queSeAnota: 'Solo las de una oportunidad (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
    ],
    ejemploTecleado: 'ver actividades vencidas',
    ejemploHablado: 'qué seguimientos tengo atrasados',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['actividad_completar', 'actividad_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor ? decodificarCursor(args.cursor) : null;
    if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const { dia } = await hoyDeLaEmpresa(tx);
    const r = await listarActividades(tx, ctx, args, dia, cursor, propios(ctx));
    return exito({ items: r.items.map((a) => aActividadDto(a, dia)), siguiente: r.siguiente });
  },
});

export const crmResumen = definirHerramienta('crm_resumen', {
  modulo: MODULO,
  permiso: 'crm:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Resumen del embudo',
    paraQueSirve: 'Cuenta las oportunidades abiertas por etapa con su monto, las ganadas y perdidas en un período y las actividades vencidas.',
    cuandoUsarla: 'Para saber cómo van las ventas de la semana o del mes.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día del período.', ejemplo: '2026-11-01' },
      { nombre: 'hasta', queSeAnota: 'Último día del período.', ejemplo: '2026-11-30' },
    ],
    ejemploTecleado: 'resumen del crm de noviembre',
    ejemploHablado: 'cómo van las ventas este mes',
    erroresComunes: ['«desde» no puede ser posterior a «hasta».', 'Con acceso solo a tus propios registros no se ve el resumen.'],
    relacionadas: ['oportunidades_listar'],
  },
  async ejecutar(args, ctx, tx) {
    if (propios(ctx)) return rechazo('sin_permiso', 'Tu acceso es solo a tus propios registros.');
    const { zona, dia } = await hoyDeLaEmpresa(tx);
    const cifras = await cifrasDeCrm(tx, ctx, { desde: args.desde, hasta: args.hasta, zona, hoy: dia });
    return exito({ desde: args.desde, hasta: args.hasta, ...cifras });
  },
});
