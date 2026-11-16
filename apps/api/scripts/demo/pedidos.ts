import { diasAtras } from './azar.ts';
import { contar, escribible, seccion, sumarDias, type Ctx } from './contexto.ts';

const RUTA = ['en_proceso', 'listo', 'entregado'] as const;

/** Pedidos en todas las etapas (algunos atrasados) con líneas de productos reales de la empresa. */
export async function sembrarPedidos(c: Ctx): Promise<void> {
  if (!escribible(c, 'ordenes')) return;
  await seccion(c, 'pedidos', async () => {
    if ((await contar(c, 'ordenes.pedidos')) > 0) return;
    for (let i = 0; i < 26; i++) {
      const fecha = diasAtras(c.az.int(4, 125));
      const lineas = Array.from({ length: c.az.int(1, 4) }, () => ({ productoId: c.az.pick(c.productos).id as string, cantidadMilesimas: c.az.int(1, 40) * 1000 }));
      const pedido = await c.s.herramienta('pedido_crear', {
        clienteId: c.az.pick(c.clientes).id,
        fecha,
        entregaEl: sumarDias(fecha, c.az.int(3, 25)),
        sucursalId: c.sucursales[0]?.id ?? null,
        lineas,
        notas: c.az.chance(0.25) ? 'Entregar en horario de oficina' : null,
      });
      const suerte = c.az.next();
      if (suerte < 0.1) continue; // se queda en borrador
      await c.s.herramienta('pedido_confirmar', { id: pedido.id });
      if (suerte >= 0.93) {
        await c.s.herramienta('pedido_cancelar', { id: pedido.id, motivo: 'El cliente desistió del pedido' });
        continue;
      }
      const hasta = suerte < 0.25 ? 0 : suerte < 0.5 ? 1 : suerte < 0.62 ? 2 : 3;
      for (const estado of RUTA.slice(0, hasta)) await c.s.herramienta('pedido_cambiar_estado', { id: pedido.id, estado });
    }
  });
}
