import { exito, rechazo } from '@capaz/shared';
import { normalizarNombre } from '../../clientes/domain/normalizacion.js';
import { definirHerramienta } from '../../herramientas/tipos.js';
import { buscarProductos, listarProductos, verProducto } from '../repositories/productos.repository.js';
import { aProductoDto } from './producto-mapeo.js';

export const productosListar = definirHerramienta('productos_listar', {
  modulo: 'core',
  permiso: 'productos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar productos y servicios',
    paraQueSirve: 'Muestra el catálogo de tu empresa, por orden alfabético y por páginas.',
    cuandoUsarla: 'Cuando quieras recorrer el catálogo o ver los archivados.',
    campos: [
      { nombre: 'estado', queSeAnota: 'activos, archivados o todos (por defecto, activos).', ejemplo: 'activos' },
      { nombre: 'limite', queSeAnota: 'Cuántos por página, hasta 100.', ejemplo: '25' },
    ],
    ejemploTecleado: 'ver mis productos',
    ejemploHablado: 'muéstrame el catálogo',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['productos_buscar', 'productos_ver'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarProductos(tx, ctx, { limite: args.limite, cursor: args.cursor, estado: args.estado });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    return exito({ items: r.items.map(aProductoDto), siguiente: r.siguiente });
  },
});

export const productosVer = definirHerramienta('productos_ver', {
  modulo: 'core',
  permiso: 'productos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver un producto o servicio',
    paraQueSirve: 'Muestra el código, la unidad y el precio de un producto o servicio.',
    cuandoUsarla: 'Cuando necesitas sus datos completos.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador del producto.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000002' }],
    ejemploTecleado: 'ver el producto tarjetas de presentación',
    ejemploHablado: 'abre la ficha de tarjetas de presentación',
    erroresComunes: ['El producto no existe o es de otra empresa.'],
    relacionadas: ['productos_buscar', 'productos_editar'],
  },
  async ejecutar(args, ctx, tx) {
    const f = await verProducto(tx, ctx, args.id);
    return f ? exito(aProductoDto(f)) : rechazo('no_encontrado', 'No existe ese producto.');
  },
});

export const productosBuscar = definirHerramienta('productos_buscar', {
  modulo: 'core',
  permiso: 'productos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Buscar productos por parecido',
    paraQueSirve: 'Encuentra productos por el parecido de su nombre o por su código, sin importar tildes ni mayúsculas.',
    cuandoUsarla: 'Cuando alguien menciona un producto y hay que saber si ya existe.',
    campos: [
      { nombre: 'texto', queSeAnota: 'Parte del nombre o el código.', ejemplo: 'tarjeta presentacion' },
      { nombre: 'limite', queSeAnota: 'Cuántos candidatos, hasta 20 (por defecto 5).', ejemplo: '5' },
    ],
    ejemploTecleado: 'buscar producto tarjeta presentacion',
    ejemploHablado: 'busca tarjetas de presentación en el catálogo',
    erroresComunes: ['Sin resultados: prueba con menos letras o créalo.'],
    relacionadas: ['productos_crear', 'productos_ver'],
  },
  async ejecutar(args, ctx, tx) {
    const texto = normalizarNombre(args.texto);
    if (!texto) return rechazo('argumentos_invalidos', 'Escribe qué buscar.');
    const filas = await buscarProductos(tx, ctx, texto, args.limite);
    return exito({ items: filas.map((f) => ({ ...aProductoDto(f), parecido: Number(f.parecido) })) });
  },
});
