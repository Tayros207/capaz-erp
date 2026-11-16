import { diasAtras } from './azar.ts';
import { AYER, contar, escribible, minFecha, seccion, sumarDias, type Ctx } from './contexto.ts';

/** Insumos (artículos con existencias y mínimos, algunos bajo el mínimo) y compras en todos los estados. */
export async function sembrarInsumos(c: Ctx): Promise<void> {
  if (!escribible(c, 'insumos')) return;
  await seccion(c, 'insumos', async () => {
    if ((await contar(c, 'insumos.articulos')) > 0) return;
    const elegidos = c.az.mezclar(c.productos.filter((p) => p.tipo === 'producto')).slice(0, 32);
    const articulos: any[] = [];
    for (const p of elegidos) articulos.push(await c.s.herramienta('articulo_activar', { productoId: p.id, minimoMilesimas: c.az.int(5, 40) * 1000 }));
    const costo = (a: any) => Math.max(100, Math.round((c.productos.find((p) => p.id === a.productoId)?.precioUnitarioMilesimas ?? 10_000) * (0.5 + c.az.next() * 0.25)));
    await c.s.herramienta('existencias_recibir', {
      origenTipo: 'demo',
      origenId: 'carga-inicial',
      motivo: 'Inventario inicial de demostración',
      lineas: articulos.map((a) => ({ articuloId: a.id, cantidadMilesimas: c.az.int(30, 400) * 1000, costoUnitarioMilesimas: costo(a) })),
    });
    for (const a of c.az.mezclar(articulos).slice(0, 14)) {
      await c.s.herramienta('existencia_mover', { articuloId: a.id, tipo: 'salida', cantidadMilesimas: c.az.int(2, 25) * 1000, motivo: 'Consumo del mes' });
    }
    for (const a of c.az.mezclar(articulos).slice(0, 8)) {
      await c.s.herramienta('existencia_ajustar', { articuloId: a.id, existenciaNuevaMilesimas: c.az.int(0, 3) * 1000, motivo: 'Conteo físico: faltante' });
    }
    const segunda = c.sucursales.find((s) => !s.esPrincipal);
    if (segunda) {
      for (const a of articulos.slice(0, 10)) {
        await c.s.herramienta('existencia_mover', { articuloId: a.id, sucursalId: segunda.id, tipo: 'entrada', cantidadMilesimas: c.az.int(5, 60) * 1000, costoUnitarioMilesimas: costo(a), motivo: 'Stock de la segunda sucursal' });
      }
    }
  });
}

export async function sembrarCompras(c: Ctx): Promise<void> {
  if (!escribible(c, 'compras')) return;
  await seccion(c, 'compras', async () => {
    if ((await contar(c, 'compras.ordenes')) > 0) return;
    const comprables = c.productos.filter((p) => p.tipo === 'producto');
    for (let i = 0; i < 14; i++) {
      const fecha = diasAtras(c.az.int(3, 110));
      const lineas = Array.from({ length: c.az.int(1, 4) }, () => {
        const p = c.az.pick(comprables);
        return { productoId: p.id as string, cantidadMilesimas: c.az.int(10, 200) * 1000, costoUnitarioMilesimas: Math.max(100, Math.round(p.precioUnitarioMilesimas * (0.5 + c.az.next() * 0.25))) };
      });
      const compra = await c.s.herramienta('compra_crear', { proveedorId: c.az.pick(c.proveedores).id, fecha, entregaEl: sumarDias(fecha, c.az.int(4, 20)), sucursalId: c.sucursales[0]?.id ?? null, lineas });
      const suerte = c.az.next();
      if (suerte < 0.18) continue; // borrador
      await c.s.herramienta('compra_enviar', { id: compra.id });
      if (suerte < 0.42) continue; // enviada, aún sin recibir (algunas ya atrasadas)
      if (suerte >= 0.9) {
        await c.s.herramienta('compra_cancelar', { id: compra.id, motivo: 'El proveedor no tenía stock' });
        continue;
      }
      const completa = suerte < 0.75;
      const ver = await c.s.herramienta('compra_ver', { id: compra.id });
      await c.s.herramienta('compra_recibir', {
        id: compra.id,
        fecha: minFecha(sumarDias(fecha, c.az.int(2, 10)), AYER()),
        nota: completa ? 'Recepción conforme' : 'Entrega parcial; falta completar',
        lineas: ver.detalle.map((l: any) => ({ ordenLineaId: l.id, cantidadMilesimas: completa ? l.cantidadMilesimas : Math.max(1, Math.floor(l.cantidadMilesimas / 2)) })),
      });
    }
  });
}
