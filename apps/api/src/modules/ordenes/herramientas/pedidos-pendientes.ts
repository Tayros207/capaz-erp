import { exito, limitarTarjetas, MAXIMO_DE_TARJETAS, type TarjetaDePendiente } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { tarjetasDePedidos } from '../domain/pendientes.js';
import { esAdministrador } from '../domain/correccion.js';
import { candidatosDeRecompra, MAXIMO_DE_TARJETAS_DE_RECOMPRA, tarjetasDeRecompra } from '../domain/recompra.js';
import { pedidosEnCurso } from '../repositories/pendientes.repository.js';
import { clientesConHistorial, nombreDeLaEmpresa } from '../repositories/recompra.repository.js';
import { MODULO, alcanceDePedidos } from './comunes.js';

/** Las tarjetas (máximo 15) y cuántos candidatos hay de más que no entran, para que `total` cuente los de antes del tope. */
async function tarjetasDeRecompraDe(tx: Transaccion, dia: string): Promise<{ tarjetas: TarjetaDePendiente[]; recortadas: number }> {
  const clientes = await clientesConHistorial(tx, dia);
  if (clientes.length === 0) return { tarjetas: [], recortadas: 0 };
  const candidatos = candidatosDeRecompra(clientes, dia).length;
  return { tarjetas: tarjetasDeRecompra(clientes, dia, await nombreDeLaEmpresa(tx)), recortadas: Math.max(0, candidatos - MAXIMO_DE_TARJETAS_DE_RECOMPRA) };
}

export const ordenesPendientes = definirHerramienta('ordenes_pendientes', {
  modulo: MODULO,
  permiso: 'ordenes:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Pendientes de pedidos (Mi día)',
    paraQueSirve: 'Lista las entregas de hoy, de mañana y atrasadas, con la pregunta «¿ya está listo?» o «¿ya se entregó?», los pedidos que siguen sin adelanto desde que se confirmaron y, solo con alcance «todos», los clientes que compraban seguido y tardan el doble de lo habitual en volver (con un mensaje de WhatsApp listo que se abre a mano).',
    cuandoUsarla: 'La usa el panel «Mi día»; también sirve para repasar qué hay que entregar.',
    campos: [{ nombre: 'fecha', queSeAnota: 'El día que se toma como hoy (AAAA-MM-DD); por defecto, hoy.', ejemplo: '2026-11-18' }],
    ejemploTecleado: 'qué entregas tengo hoy',
    ejemploHablado: 'qué pedidos hay que entregar hoy y mañana',
    erroresComunes: ['Con alcance «propios» solo salen tus pedidos y no salen los avisos de recompra.', 'Un pedido sin fecha de entrega solo aparece si no tiene adelanto.'],
    relacionadas: ['pedidos_listar', 'pedido_cambiar_estado'],
  },
  auditar: (_a, d) => ({ ...(d && { resumen: { tarjetas: d.tarjetas.length, total: d.total } }) }),
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const dia = args.fecha ?? hoy.dia;
    const pedidos = await pedidosEnCurso(tx, ctx, alcanceDePedidos(ctx), hoy.zona, dia);
    // La recompra son datos de toda la empresa: solo con alcance «todos» y para dueño o administrador.
    const recompra = alcanceDePedidos(ctx) === 'todos' && esAdministrador(ctx.rol) ? await tarjetasDeRecompraDe(tx, dia) : { tarjetas: [], recortadas: 0 };
    // Las tarjetas de recompra van al final en el orden en que salieron (venta de 12 meses, luego días sin comprar): no se reordenan por fecha.
    const limitadas = limitarTarjetas(tarjetasDePedidos(pedidos, dia), MAXIMO_DE_TARJETAS - recompra.tarjetas.length);
    return exito({ fecha: dia, tarjetas: [...limitadas.tarjetas, ...recompra.tarjetas], total: limitadas.total + recompra.tarjetas.length + recompra.recortadas, anotaciones: [] });
  },
});
