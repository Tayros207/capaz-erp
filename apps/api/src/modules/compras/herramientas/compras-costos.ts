import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { agruparCostos, recortarArticulos, resolverPeriodoDeCostos } from '../domain/costos.js';
import { lineasParaCostos } from '../repositories/costos.repository.js';
import { MODULO, alcanceDeCompras } from './comunes.js';

export const comprasCostosPorArticulo = definirHerramienta('compras_costos_por_articulo', {
  modulo: MODULO,
  permiso: 'compras:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Comparar costos de compra por artículo',
    paraQueSirve: 'Muestra, por artículo, lo último que pagaste, la mediana, el mínimo y el máximo, cuánto subió o bajó el último costo y qué proveedor es más barato. Cuenta las órdenes enviadas o recibidas; los costos incluyen IGV.',
    cuandoUsarla: 'Cuando vas a comprar y quieres saber si el precio que te dan es justo o si otro proveedor te vende más barato.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día del período (opcional; por defecto, un año atrás).', ejemplo: '2026-01-01' },
      { nombre: 'hasta', queSeAnota: 'Último día del período (opcional; por defecto, hoy).', ejemplo: '2026-11-20' },
      { nombre: 'productoId', queSeAnota: 'Solo ese producto (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000010' },
      { nombre: 'proveedorId', queSeAnota: 'Solo lo comprado a ese proveedor (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
      { nombre: 'buscar', queSeAnota: 'Parte de la descripción del artículo (opcional).', ejemplo: 'bond' },
    ],
    ejemploTecleado: 'comparar costos de papel bond',
    ejemploHablado: 'cuánto pagamos por el papel bond y quién nos lo da más barato',
    erroresComunes: ['El período empieza antes de terminar.', 'El período abarca como máximo 2 años.', 'Si hay más de 5,000 líneas o 200 artículos, solo se muestra lo más reciente.'],
    relacionadas: ['compras_listar', 'compras_resumen'],
  },
  async ejecutar(args, ctx, tx) {
    const hoy = await hoyDeLaEmpresa(tx);
    const periodo = resolverPeriodoDeCostos(args, hoy.dia);
    if ('error' in periodo) return rechazo('argumentos_invalidos', periodo.error);
    const { lineas, truncado } = await lineasParaCostos(tx, ctx, alcanceDeCompras(ctx), { ...periodo, productoId: args.productoId, proveedorId: args.proveedorId, buscar: args.buscar?.trim() || undefined });
    const recortados = recortarArticulos(agruparCostos(lineas));
    return exito({ ...periodo, articulos: recortados.articulos, truncado: truncado || recortados.truncado });
  },
});
