import { exito, rechazo, type CategoriaDeProductoDto, type ProductoFichaDto, type UnidadDeProductoDto } from '@capaz/shared';
import { normalizarNombre, textoOpcional } from '../../clientes/domain/normalizacion.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import {
  archivarCategoria,
  eliminarUnidad,
  esDescendiente,
  guardarCategoria,
  guardarFicha,
  guardarUnidad,
  listarCategorias,
  listarUnidades,
  porNombreNormalizado,
  productoConCodigo,
  verCategoria,
  verFicha,
  type Categoria,
  type CambiosDeFicha,
  type FichaDeProducto,
  type UnidadDeProducto,
} from '../repositories/maestros-productos.repository.js';
import { verProducto } from '../repositories/productos.repository.js';

// Categorías, ficha de catálogo y unidades de los productos (0025).

const ID_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';
const NO_EXISTE = 'No existe ese producto.';

const aCategoriaDto = (f: Categoria): CategoriaDeProductoDto => ({
  id: f.id,
  nombre: f.nombre,
  padreId: f.padreId,
  archivadoEn: f.archivadoEn?.toISOString() ?? null,
});

const aUnidadDto = (f: UnidadDeProducto): UnidadDeProductoDto => ({
  id: f.id,
  productoId: f.productoId,
  unidad: f.unidad,
  factorMilesimas: f.factorMilesimas,
  paraCompra: f.paraCompra,
  paraVenta: f.paraVenta,
});

async function aFichaDto(tx: Parameters<typeof verCategoria>[0], ctx: Parameters<typeof verCategoria>[1], productoId: string, f: FichaDeProducto | null): Promise<ProductoFichaDto> {
  const categoria = f?.categoriaId ? await verCategoria(tx, ctx, f.categoriaId) : null;
  return {
    productoId,
    categoriaId: f?.categoriaId ?? null,
    categoriaNombre: categoria?.nombre ?? null,
    marca: f?.marca ?? null,
    sku: f?.sku ?? null,
    codigoBarras: f?.codigoBarras ?? null,
    costoMilesimas: f?.costoMilesimas ?? null,
    pesoGramos: f?.pesoGramos == null ? null : Number(f.pesoGramos),
    altoMm: f?.altoMm ?? null,
    anchoMm: f?.anchoMm ?? null,
    largoMm: f?.largoMm ?? null,
    vendible: f?.vendible ?? true,
    comprable: f?.comprable ?? true,
    actualizadoEn: f?.actualizadoEn.toISOString() ?? null,
  };
}

export const categoriasProductoListar = definirHerramienta('categorias_producto_listar', {
  modulo: 'core',
  permiso: 'productos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las categorías de producto',
    paraQueSirve: 'Muestra las categorías con las que ordenas tu catálogo, con su categoría madre si la tienen.',
    cuandoUsarla: 'Cuando quieres clasificar productos o filtrar el catálogo.',
    campos: [{ nombre: 'incluirArchivadas', queSeAnota: 'true para ver también las archivadas.', ejemplo: 'false' }],
    ejemploTecleado: 'ver las categorías de productos',
    ejemploHablado: 'qué categorías de productos tengo',
    erroresComunes: ['Si no ves una categoría, puede estar archivada.'],
    relacionadas: ['categorias_producto_guardar', 'productos_ficha_guardar'],
  },
  async ejecutar(args, ctx, tx) {
    return exito({ items: (await listarCategorias(tx, ctx, args.incluirArchivadas)).map(aCategoriaDto) });
  },
});

export const categoriasProductoGuardar = definirHerramienta('categorias_producto_guardar', {
  modulo: 'core',
  permiso: 'productos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Guardar una categoría de producto',
    paraQueSirve: 'Crea una categoría o corrige una existente; puede colgar de otra categoría madre.',
    cuandoUsarla: 'Cuando ordenas el catálogo por rubros, por ejemplo «Papelería» y dentro «Papel bond».',
    campos: [
      { nombre: 'nombre', queSeAnota: 'Nombre de la categoría.', ejemplo: 'Papel bond' },
      { nombre: 'padreId', queSeAnota: 'Categoría madre (opcional).', ejemplo: ID_EJEMPLO },
      { nombre: 'id', queSeAnota: 'Solo para corregir una existente.', ejemplo: ID_EJEMPLO },
    ],
    ejemploTecleado: 'crear categoría Papel bond dentro de Papelería',
    ejemploHablado: 'crea la categoría papel bond',
    erroresComunes: ['Ya existe una categoría con ese nombre.', 'Una categoría no puede colgar de sí misma ni de una hija suya.'],
    relacionadas: ['categorias_producto_listar', 'categorias_producto_archivar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'categoria_producto', entidadId: d?.id ?? a.id }),
  async ejecutar(args, ctx, tx) {
    const nombre = args.nombre.replace(/\s+/g, ' ').trim();
    const nombreNormalizado = normalizarNombre(nombre);
    const padreId = args.padreId ?? null;
    if (args.id && !(await verCategoria(tx, ctx, args.id))) return rechazo('no_encontrado', 'No existe esa categoría.');
    if (padreId) {
      if (!(await verCategoria(tx, ctx, padreId))) return rechazo('no_encontrado', 'No existe la categoría madre.');
      if (args.id && (await esDescendiente(tx, ctx, args.id, padreId))) {
        return rechazo('argumentos_invalidos', 'Una categoría no puede colgar de sí misma ni de una hija suya.');
      }
    }
    const igual = await porNombreNormalizado(tx, ctx, nombreNormalizado);
    if (igual && igual.id !== args.id) return rechazo('conflicto', `Ya existe la categoría «${igual.nombre}».`);
    const f = await guardarCategoria(tx, ctx, args.id, { nombre, nombreNormalizado, padreId });
    return f ? exito(aCategoriaDto(f)) : rechazo('no_encontrado', 'No existe esa categoría.');
  },
});

export const categoriasProductoArchivar = definirHerramienta('categorias_producto_archivar', {
  modulo: 'core',
  permiso: 'productos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar una categoría de producto',
    paraQueSirve: 'Oculta la categoría de las listas sin quitársela a los productos que ya la tienen.',
    cuandoUsarla: 'Cuando ya no usas ese rubro.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador de la categoría.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'archivar la categoría Papel bond',
    ejemploHablado: 'archiva papel bond',
    erroresComunes: ['La categoría no existe o es de otra empresa.'],
    relacionadas: ['categorias_producto_listar'],
  },
  auditar: (a) => ({ entidadTipo: 'categoria_producto', entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    const f = await archivarCategoria(tx, ctx, args.id);
    return f ? exito(aCategoriaDto(f)) : rechazo('no_encontrado', 'No existe esa categoría.');
  },
});

export const productosFichaVer = definirHerramienta('productos_ficha_ver', {
  modulo: 'core',
  permiso: 'productos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver la ficha de catálogo de un producto',
    paraQueSirve: 'Muestra categoría, marca, SKU, código de barras, costo, peso y medidas de un producto.',
    cuandoUsarla: 'Cuando necesitas los datos logísticos o de compra de un producto.',
    campos: [{ nombre: 'productoId', queSeAnota: 'Identificador del producto.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'ver la ficha del producto Papel bond A4',
    ejemploHablado: 'qué marca y qué SKU tiene el papel bond A4',
    erroresComunes: ['El producto no existe o es de otra empresa.'],
    relacionadas: ['productos_ficha_guardar', 'productos_ver'],
  },
  async ejecutar(args, ctx, tx) {
    if (!(await verProducto(tx, ctx, args.productoId))) return rechazo('no_encontrado', NO_EXISTE);
    return exito(await aFichaDto(tx, ctx, args.productoId, await verFicha(tx, ctx, args.productoId)));
  },
});

export const productosFichaGuardar = definirHerramienta('productos_ficha_guardar', {
  modulo: 'core',
  permiso: 'productos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Guardar la ficha de catálogo de un producto',
    paraQueSirve: 'Anota categoría, marca, SKU, código de barras, costo, peso, medidas y si se vende o se compra. Envías solo lo que cambia.',
    cuandoUsarla: 'Cuando das de alta un producto o completas sus datos para compras e inventario.',
    campos: [
      { nombre: 'productoId', queSeAnota: 'Identificador del producto.', ejemplo: ID_EJEMPLO },
      { nombre: 'sku', queSeAnota: 'Código interno único (opcional).', ejemplo: 'PAP-A4-75' },
      { nombre: 'costoMilesimas', queSeAnota: 'Costo en milésimas de sol.', ejemplo: '12500' },
      { nombre: 'pesoGramos', queSeAnota: 'Peso en gramos.', ejemplo: '2500' },
    ],
    ejemploTecleado: 'al papel bond A4 ponle marca Chamex, SKU PAP-A4-75 y costo 12.50',
    ejemploHablado: 'el papel bond A4 es marca Chamex con SKU PAP A4 75',
    erroresComunes: ['Hay que indicar al menos un dato.', 'Otro producto ya usa ese SKU o código de barras.'],
    relacionadas: ['productos_ficha_ver', 'categorias_producto_listar'],
  },
  auditar: (a) => ({ entidadTipo: 'producto', entidadId: a.productoId, resumen: { campos: Object.keys(a).filter((k) => k !== 'productoId').sort().join(',') } }),
  async ejecutar(args, ctx, tx) {
    if (!(await verProducto(tx, ctx, args.productoId))) return rechazo('no_encontrado', NO_EXISTE);
    const { productoId, pesoGramos, ...resto } = args;
    const cambios: CambiosDeFicha = Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== undefined));
    for (const campo of ['marca', 'sku', 'codigoBarras'] as const) {
      if (typeof cambios[campo] === 'string') cambios[campo] = textoOpcional(cambios[campo]);
    }
    if (pesoGramos !== undefined) cambios.pesoGramos = pesoGramos === null ? null : pesoGramos.toFixed(3);
    if (cambios.categoriaId && !(await verCategoria(tx, ctx, cambios.categoriaId))) return rechazo('no_encontrado', 'No existe esa categoría.');
    for (const [campo, etiqueta] of [['sku', 'SKU'], ['codigoBarras', 'código de barras']] as const) {
      const valor = cambios[campo];
      if (valor && (await productoConCodigo(tx, ctx, campo, valor, productoId))) return rechazo('conflicto', `Otro producto ya usa ese ${etiqueta}.`);
    }
    const f = await guardarFicha(tx, ctx, productoId, cambios);
    return exito(await aFichaDto(tx, ctx, productoId, f));
  },
});

export const productosUnidadesListar = definirHerramienta('productos_unidades_listar', {
  modulo: 'core',
  permiso: 'productos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las unidades de un producto',
    paraQueSirve: 'Muestra las otras unidades en que se compra o se vende un producto y cuántas unidades base trae cada una.',
    cuandoUsarla: 'Cuando compras por caja y vendes por unidad, por ejemplo.',
    campos: [{ nombre: 'productoId', queSeAnota: 'Identificador del producto.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'unidades del papel bond A4',
    ejemploHablado: 'en qué unidades manejo el papel bond',
    erroresComunes: ['El producto no existe o es de otra empresa.'],
    relacionadas: ['productos_unidad_guardar'],
  },
  async ejecutar(args, ctx, tx) {
    if (!(await verProducto(tx, ctx, args.productoId))) return rechazo('no_encontrado', NO_EXISTE);
    return exito({ items: (await listarUnidades(tx, ctx, args.productoId)).map(aUnidadDto) });
  },
});

export const productosUnidadGuardar = definirHerramienta('productos_unidad_guardar', {
  modulo: 'core',
  permiso: 'productos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Guardar una unidad de un producto',
    paraQueSirve: 'Define otra unidad (caja, paquete, millar) y cuántas unidades base equivale. Si ya existe, actualiza su equivalencia.',
    cuandoUsarla: 'Cuando compras o vendes en una presentación distinta de la unidad base.',
    campos: [
      { nombre: 'productoId', queSeAnota: 'Identificador del producto.', ejemplo: ID_EJEMPLO },
      { nombre: 'unidad', queSeAnota: 'Nombre de la unidad.', ejemplo: 'caja' },
      { nombre: 'factorMilesimas', queSeAnota: 'Unidades base por cada una, en milésimas (12 → 12000).', ejemplo: '12000' },
    ],
    ejemploTecleado: 'el papel bond A4 viene en caja de 12 unidades',
    ejemploHablado: 'una caja de papel bond trae doce unidades',
    erroresComunes: ['La equivalencia debe ser mayor que cero.', 'La unidad es la misma que la unidad base del producto.'],
    relacionadas: ['productos_unidades_listar', 'productos_unidad_eliminar'],
  },
  auditar: (a, d) => ({ entidadTipo: 'producto_unidad', entidadId: d?.id }),
  async ejecutar(args, ctx, tx) {
    const producto = await verProducto(tx, ctx, args.productoId);
    if (!producto) return rechazo('no_encontrado', NO_EXISTE);
    const unidad = args.unidad.replace(/\s+/g, ' ').trim().toLowerCase();
    if (unidad === producto.unidad.trim().toLowerCase()) return rechazo('argumentos_invalidos', 'Esa es la unidad base del producto.');
    return exito(aUnidadDto(await guardarUnidad(tx, ctx, { productoId: args.productoId, unidad, factorMilesimas: args.factorMilesimas, paraCompra: args.paraCompra, paraVenta: args.paraVenta })));
  },
});

export const productosUnidadEliminar = definirHerramienta('productos_unidad_eliminar', {
  modulo: 'core',
  permiso: 'productos:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Quitar una unidad de un producto',
    paraQueSirve: 'Borra una unidad alternativa de un producto.',
    cuandoUsarla: 'Cuando esa presentación ya no se maneja o se cargó por error.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador de la unidad.', ejemplo: ID_EJEMPLO }],
    ejemploTecleado: 'quitar la unidad caja del papel bond A4',
    ejemploHablado: 'borra la caja de papel bond',
    erroresComunes: ['La unidad no existe o es de otra empresa.'],
    relacionadas: ['productos_unidades_listar'],
  },
  auditar: (a) => ({ entidadTipo: 'producto_unidad', entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    return (await eliminarUnidad(tx, ctx, args.id)) ? exito({ id: args.id }) : rechazo('no_encontrado', 'No existe esa unidad.');
  },
});

export const HERRAMIENTAS_DE_PRODUCTOS_AMPLIADOS = [
  categoriasProductoListar,
  categoriasProductoGuardar,
  categoriasProductoArchivar,
  productosFichaVer,
  productosFichaGuardar,
  productosUnidadesListar,
  productosUnidadGuardar,
  productosUnidadEliminar,
];
