import { rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { textoDeCantidad } from '../domain/existencia.js';
import { actualizarArticulo, articuloDeProducto, crearArticulo, productoParaArticulo, verArticulo, type CambiosDeArticulo } from '../repositories/articulos.repository.js';
import { asegurarExistencia, existenciaTotal, sucursalParaMover } from '../repositories/existencias.repository.js';
import { CAMPO_ID, MODULO, NO_EXISTE, auditarArticulo, responderArticulo } from './comunes.js';

const CAMPO_MINIMO = { nombre: 'minimoMilesimas', queSeAnota: 'Existencia mínima en milésimas (10 unidades = 10000). Cero: sin alerta.', ejemplo: '10000' };
const CAMPO_UNIDAD = { nombre: 'unidad', queSeAnota: 'Unidad en que se cuenta (opcional; por defecto, la del producto).', ejemplo: 'kg' };

export const articuloActivar = definirHerramienta('articulo_activar', {
  modulo: MODULO,
  permiso: 'insumos:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Controlar un producto en el inventario',
    paraQueSirve: 'Pone un producto del catálogo bajo control de inventario, con su mínimo y su unidad. Si ya lo estaba, lo deja igual (o lo reactiva si estaba archivado) y aplica lo que indiques.',
    cuandoUsarla: 'Cuando empiezas a llevar la cuenta de un insumo o de un producto que guardas.',
    campos: [{ nombre: 'productoId', queSeAnota: 'Identificador del producto del catálogo.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' }, CAMPO_MINIMO, CAMPO_UNIDAD],
    ejemploTecleado: 'controlar en inventario el papel bond A4, mínimo 10 paquetes',
    ejemploHablado: 'empieza a llevar el inventario del papel bond con mínimo de diez paquetes',
    erroresComunes: ['El producto no existe.', 'El producto está archivado.'],
    relacionadas: ['articulo_editar', 'articulos_listar', 'productos_buscar'],
  },
  auditar: (a, d) => ({ ...auditarArticulo(d), resumen: { ...auditarArticulo(d).resumen, campos: Object.keys(a).sort().join(',') } }),
  async ejecutar(args, ctx, tx) {
    const producto = await productoParaArticulo(tx, ctx, args.productoId);
    if (!producto) return rechazo('argumentos_invalidos', 'El producto no existe.');
    const cambios: CambiosDeArticulo = {
      ...(args.minimoMilesimas !== undefined && { minimoMilesimas: args.minimoMilesimas }),
      ...(args.unidad !== undefined && { unidad: args.unidad }),
    };
    const existente = await articuloDeProducto(tx, ctx, args.productoId);
    if (existente) {
      if (existente.archivadoEn && producto.archivado) return rechazo('argumentos_invalidos', 'El producto está archivado.');
      if (existente.archivadoEn) cambios.archivado = false;
      if (Object.keys(cambios).length > 0) {
        await verArticulo(tx, ctx, existente.id, { bloquear: true });
        await actualizarArticulo(tx, ctx, existente.id, cambios);
      }
      return responderArticulo(tx, ctx, existente.id);
    }
    if (producto.archivado) return rechazo('argumentos_invalidos', 'El producto está archivado.');
    const id = await crearArticulo(tx, ctx, { productoId: producto.id, unidad: args.unidad ?? producto.unidad, minimoMilesimas: args.minimoMilesimas ?? 0 });
    // Otra persona lo activó a la vez: queda el suyo (activar es idempotente).
    if (!id) {
      const otro = await articuloDeProducto(tx, ctx, args.productoId);
      if (!otro) throw new Error('Choque de unicidad de artículos sin fila que lo explique.');
      return responderArticulo(tx, ctx, otro.id);
    }
    // La existencia en la principal nace en cero: así el mínimo se ve desde el primer día.
    const principal = await sucursalParaMover(tx, ctx, undefined);
    if (principal) await asegurarExistencia(tx, ctx, id, principal.id);
    return responderArticulo(tx, ctx, id);
  },
});

export const articuloEditar = definirHerramienta('articulo_editar', {
  modulo: MODULO,
  permiso: 'insumos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Cambiar el mínimo o la unidad',
    paraQueSirve: 'Cambia la existencia mínima de un artículo (la que dispara la alerta) o la unidad en que se cuenta. No mueve existencias.',
    cuandoUsarla: 'Cuando el consumo cambió y necesitas otro mínimo, o cuentas el artículo en otra unidad.',
    campos: [CAMPO_ID, CAMPO_MINIMO, CAMPO_UNIDAD],
    ejemploTecleado: 'mínimo del papel bond A4 a 15 paquetes',
    ejemploHablado: 'sube el mínimo del papel bond a quince paquetes',
    erroresComunes: ['No existe ese artículo.', 'Hay que indicar al menos un dato.'],
    relacionadas: ['articulo_ver', 'articulo_activar'],
  },
  auditar: (a, d) => ({ ...auditarArticulo(d, a.id), resumen: { ...auditarArticulo(d).resumen, campos: Object.keys(a).filter((k) => k !== 'id').sort().join(',') } }),
  async ejecutar(args, ctx, tx) {
    const actual = await verArticulo(tx, ctx, args.id, { bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    await actualizarArticulo(tx, ctx, actual.id, {
      ...(args.minimoMilesimas !== undefined && { minimoMilesimas: args.minimoMilesimas }),
      ...(args.unidad !== undefined && { unidad: args.unidad }),
    });
    return responderArticulo(tx, ctx, actual.id);
  },
});

export const articuloArchivar = definirHerramienta('articulo_archivar', {
  modulo: MODULO,
  permiso: 'insumos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Dejar de controlar un artículo',
    paraQueSirve: 'Archiva un artículo que ya no se lleva en el inventario. Solo se puede con la existencia en cero en todas las sucursales. Su historial se conserva.',
    cuandoUsarla: 'Cuando dejas de usar un insumo y ya no queda nada de él.',
    campos: [CAMPO_ID],
    ejemploTecleado: 'archivar el artículo papel cometa',
    ejemploHablado: 'ya no controles el papel cometa',
    erroresComunes: ['Todavía hay existencia: sácala o ajústala a cero primero.', 'No existe ese artículo.'],
    relacionadas: ['articulo_activar', 'existencia_ajustar'],
  },
  auditar: (a, d) => auditarArticulo(d, a.id),
  async ejecutar(args, ctx, tx) {
    const actual = await verArticulo(tx, ctx, args.id, { bloquear: true });
    if (!actual) return rechazo('no_encontrado', NO_EXISTE);
    if (!actual.archivadoEn) {
      const total = await existenciaTotal(tx, ctx, actual.id);
      if (total > 0) return rechazo('conflicto', `Todavía hay ${textoDeCantidad(total, actual.unidad)} en el inventario: sácalo o ajústalo a cero antes de archivar.`);
      await actualizarArticulo(tx, ctx, actual.id, { archivado: true });
    }
    return responderArticulo(tx, ctx, actual.id);
  },
});
