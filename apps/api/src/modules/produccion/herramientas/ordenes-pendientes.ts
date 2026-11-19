import { exito, limitarTarjetas } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { anotacionesDeOrdenes, tarjetasDeOrdenes } from '../domain/pendientes.js';
import { ordenesPorEntregar } from '../repositories/pendientes.repository.js';
import { MODULO } from './comunes.js';

export const produccionPendientes = definirHerramienta('produccion_pendientes', {
  modulo: MODULO,
  permiso: 'produccion:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Pendientes de producción (Mi día)',
    paraQueSirve: 'Lista las órdenes de trabajo atrasadas, las que vencen hoy o mañana y pregunta si ya están listas o entregadas, diciendo si el trabajo ya está pagado.',
    cuandoUsarla: 'La usa el panel «Mi día»; también sirve para repasar qué sale hoy del taller.',
    campos: [{ nombre: 'fecha', queSeAnota: 'El día que se toma como hoy (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-11-18' }],
    ejemploTecleado: 'qué trabajos vencen hoy',
    ejemploHablado: 'qué órdenes del taller están atrasadas',
    erroresComunes: ['Una orden sin fecha de entrega no aparece.'],
    relacionadas: ['produccion_ordenes_listar', 'produccion_orden_estado'],
  },
  auditar: (_a, d) => ({ ...(d && { resumen: { tarjetas: d.tarjetas.length, total: d.total } }) }),
  async ejecutar(args, ctx, tx) {
    const dia = args.fecha ?? (await hoyDeLaEmpresa(tx)).dia;
    const ordenes = await ordenesPorEntregar(tx, ctx, dia);
    const { tarjetas, total } = limitarTarjetas(tarjetasDeOrdenes(ordenes, dia));
    // Pagado o saldo solo de las órdenes que salen en el panel.
    const visibles = new Set(tarjetas.map((t) => t.entidad.id));
    return exito({ fecha: dia, tarjetas, total, anotaciones: anotacionesDeOrdenes(ordenes, dia).filter((a) => visibles.has(a.entidad.id)) });
  },
});
