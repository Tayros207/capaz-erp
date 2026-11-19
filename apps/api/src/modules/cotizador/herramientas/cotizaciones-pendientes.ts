import { exito, limitarTarjetas } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { tarjetasDeCotizaciones } from '../domain/pendientes.js';
import { cotizacionesSinRespuesta } from '../repositories/pendientes.repository.js';
import { alcanceDeCotizaciones } from './cotizacion-comun.js';
import { MODULO } from './comun.js';

export const cotizadorPendientes = definirHerramienta('cotizador_pendientes', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Pendientes de cotizaciones (Mi día)',
    paraQueSirve: 'Lista las cotizaciones emitidas o enviadas que llevan 3 días o más sin respuesta, o que están por vencer o ya vencieron, para hacerles seguimiento.',
    cuandoUsarla: 'La usa el panel «Mi día»; también sirve para saber a quién llamar por una cotización.',
    campos: [{ nombre: 'fecha', queSeAnota: 'El día que se toma como hoy (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-11-18' }],
    ejemploTecleado: 'qué cotizaciones están sin respuesta',
    ejemploHablado: 'a quién tengo que llamar por una cotización',
    erroresComunes: ['Una cotización enviada cuenta los días desde que se marcó enviada.', 'Con alcance «propios» solo salen las cotizaciones que tú creaste.'],
    relacionadas: ['cotizaciones_listar', 'cotizacion_marcar_enviada'],
  },
  auditar: (_a, d) => ({ ...(d && { resumen: { tarjetas: d.tarjetas.length, total: d.total } }) }),
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const dia = args.fecha ?? hoy.dia;
    const cotizaciones = await cotizacionesSinRespuesta(tx, ctx, alcanceDeCotizaciones(ctx), hoy.zona);
    return exito({ fecha: dia, ...limitarTarjetas(tarjetasDeCotizaciones(cotizaciones, dia)), anotaciones: [] });
  },
});
