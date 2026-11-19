import { exito, limitarTarjetas } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { tarjetasDePedidos } from '../domain/pendientes.js';
import { pedidosEnCurso } from '../repositories/pendientes.repository.js';
import { MODULO, alcanceDePedidos } from './comunes.js';

export const ordenesPendientes = definirHerramienta('ordenes_pendientes', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Pendientes de pedidos (Mi día)',
    paraQueSirve: 'Lista las entregas de hoy, de mañana y atrasadas, con la pregunta «¿ya está listo?» o «¿ya se entregó?», y los pedidos que siguen sin adelanto desde que se confirmaron.',
    cuandoUsarla: 'La usa el panel «Mi día»; también sirve para repasar qué hay que entregar.',
    campos: [{ nombre: 'fecha', queSeAnota: 'El día que se toma como hoy (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-11-18' }],
    ejemploTecleado: 'qué entregas tengo hoy',
    ejemploHablado: 'qué pedidos hay que entregar hoy y mañana',
    erroresComunes: ['Con alcance «propios» solo salen tus pedidos.', 'Un pedido sin fecha de entrega solo aparece si no tiene adelanto.'],
    relacionadas: ['pedidos_listar', 'pedido_cambiar_estado'],
  },
  auditar: (_a, d) => ({ ...(d && { resumen: { tarjetas: d.tarjetas.length, total: d.total } }) }),
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const dia = args.fecha ?? hoy.dia;
    const pedidos = await pedidosEnCurso(tx, ctx, alcanceDePedidos(ctx), hoy.zona, dia);
    return exito({ fecha: dia, ...limitarTarjetas(tarjetasDePedidos(pedidos, dia)), anotaciones: [] });
  },
});
