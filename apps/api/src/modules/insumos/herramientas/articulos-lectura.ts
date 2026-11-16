import { exito, rechazo } from '@capaz/shared';
import { normalizarNombre } from '../../../core/clientes/domain/normalizacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { existenciasDeArticulos, listarArticulos } from '../repositories/articulos.repository.js';
import { CAMPO_ID, CURSOR_INVALIDO, MODULO, responderArticulo } from './comunes.js';
import { aArticuloDto } from './mapeo.js';

export const articuloVer = definirHerramienta('articulo_ver', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver un artículo del inventario',
    paraQueSirve: 'Muestra un artículo con su mínimo, su último costo y lo que hay en cada sucursal, y si está bajo el mínimo.',
    cuandoUsarla: 'Cuando quieres saber cuánto queda de algo y dónde.',
    campos: [CAMPO_ID],
    ejemploTecleado: 'cuánto papel bond A4 hay',
    ejemploHablado: 'cuánto papel bond nos queda',
    erroresComunes: ['No existe ese artículo.'],
    relacionadas: ['articulos_listar', 'existencias_movimientos_listar'],
  },
  ejecutar: (args, ctx, tx) => responderArticulo(tx, ctx, args.id),
});

export const articulosListar = definirHerramienta('articulos_listar', {
  modulo: MODULO,
  permiso: 'insumos:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar los artículos del inventario',
    paraQueSirve: 'Muestra los artículos en orden alfabético, con su existencia total y por sucursal, por páginas.',
    cuandoUsarla: 'Cuando quieres revisar qué controlas, buscar un artículo o ver solo los que están bajo el mínimo.',
    campos: [
      { nombre: 'buscar', queSeAnota: 'Parte del nombre o el código exacto del producto (opcional).', ejemplo: 'papel' },
      { nombre: 'estado', queSeAnota: 'activos, archivados o todos.', ejemplo: 'activos' },
      { nombre: 'soloBajoMinimo', queSeAnota: 'Solo los que están bajo el mínimo en alguna sucursal.', ejemplo: 'true' },
    ],
    ejemploTecleado: 'artículos bajo el mínimo',
    ejemploHablado: 'qué insumos se están acabando',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['articulo_ver', 'articulo_activar', 'existencias_listar'],
  },
  async ejecutar(args, ctx, tx) {
    const buscarNormalizado = args.buscar ? normalizarNombre(args.buscar) : undefined;
    const r = await listarArticulos(tx, ctx, { ...args, buscarNormalizado });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', CURSOR_INVALIDO);
    const existencias = await existenciasDeArticulos(tx, ctx, r.items.map((a) => a.id));
    return exito({ items: r.items.map((a) => aArticuloDto(a, existencias.get(a.id) ?? [])), siguiente: r.siguiente });
  },
});
