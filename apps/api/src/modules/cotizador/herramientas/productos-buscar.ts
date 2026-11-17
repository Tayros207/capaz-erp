import { exito, rechazo, type ProductoCotizableDto } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { precioDeCatalogoSinIgv } from '../domain/catalogo.js';
import { CONFIGURACION_POR_DEFECTO } from '../domain/configuracion.js';
import { normalizarNombre } from '../domain/lista.js';
import { buscarProductosParaCotizar, listasActivasDeProductos, listasSinProductoPorNombre, type ProductoDeCatalogo } from '../repositories/catalogo.repository.js';
import { leerConfiguracion } from '../repositories/configuracion.repository.js';
import { MODULO } from './comun.js';
import { listasADto } from './listas-respuesta.js';

// Un solo buscador para cotizar: el catálogo manda y la lista de precios es una capa de precios por escala sobre el producto.
// Orden: con lista (de producto o heredada), luego con precio de catálogo, luego sin precio. Cada grupo conserva el parecido.

const RANGO = { lista: 0, catalogo: 1, sin_precio: 2 } as const;

function deProducto(p: ProductoDeCatalogo, lista: ProductoCotizableDto['lista'] | undefined, igv: number): ProductoCotizableDto {
  const base = { productoId: p.id, nombre: p.nombre, afectoIgv: p.afectoIgv };
  if (lista) return { ...base, listaId: lista.id, unidad: lista.unidad, origen: 'lista', lista };
  if (p.precioUnitarioMilesimas > 0) {
    return { ...base, listaId: null, unidad: p.unidad, origen: 'catalogo', precioCatalogoSinIgvMilesimas: precioDeCatalogoSinIgv(p.precioUnitarioMilesimas, p.afectoIgv, igv) };
  }
  return { ...base, listaId: null, unidad: p.unidad, origen: 'sin_precio' };
}

export const cotizadorProductosBuscar = definirHerramienta('cotizador_productos_buscar', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Buscar qué cotizar',
    paraQueSirve: 'Busca en el catálogo de productos y en las listas de precios heredadas, y dice con qué precio se cotiza cada resultado: por escala, del catálogo o sin precio.',
    cuandoUsarla: 'Al empezar una cotización: elegir el producto sin importar si ya tiene lista de precios.',
    campos: [
      { nombre: 'texto', queSeAnota: 'Parte del nombre o el código del producto.', ejemplo: 'volantes' },
      { nombre: 'limite', queSeAnota: 'Cuántos resultados, hasta 20 (por defecto 8).', ejemplo: '8' },
    ],
    ejemploTecleado: 'buscar volantes para cotizar',
    ejemploHablado: 'qué tengo para cotizar de volantes',
    erroresComunes: ['Sin resultados: prueba con menos letras o crea el producto en el catálogo.'],
    relacionadas: ['listas_precio_listar', 'precio_consultar', 'cotizacion_crear'],
  },
  async ejecutar(args, ctx, tx) {
    const texto = normalizarNombre(args.texto);
    if (!texto) return rechazo('argumentos_invalidos', 'Escribe qué buscar.');
    const igv = (await leerConfiguracion(tx, ctx))?.igvPorcentaje ?? CONFIGURACION_POR_DEFECTO.igvPorcentaje;
    const encontrados = await buscarProductosParaCotizar(tx, ctx, texto, args.limite);
    const conLista = await listasActivasDeProductos(tx, ctx, encontrados.map((p) => p.id));
    const sueltas = await listasSinProductoPorNombre(tx, ctx, texto, args.limite);
    const hoy = await hoyDeLaEmpresa(tx);
    const dtos = await listasADto(tx, ctx, [...conLista.values(), ...sueltas], hoy);
    const dtoDe = new Map(dtos.map((d) => [d.id, d]));
    const deProductos = encontrados.map((p) => deProducto(p, dtoDe.get(conLista.get(p.id)?.id ?? ''), igv));
    const deListas = sueltas.flatMap((f): ProductoCotizableDto[] => {
      const d = dtoDe.get(f.id);
      return d ? [{ productoId: null, listaId: d.id, nombre: d.nombre, unidad: d.unidad, origen: 'lista', lista: d }] : [];
    });
    const items = [...deListas, ...deProductos].map((x, i) => ({ x, i })).sort((a, b) => RANGO[a.x.origen] - RANGO[b.x.origen] || a.i - b.i).map((e) => e.x);
    return exito({ items: items.slice(0, args.limite) });
  },
});
