import { exito, rechazo } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { decodificarCursorDeLista } from '../domain/cursor.js';
import { corteParaRevisar, normalizarNombre } from '../domain/lista.js';
import { listarListas, verLista } from '../repositories/listas.repository.js';
import { ID_DE_EJEMPLO, MODULO } from './comun.js';
import { listaADto, listasADto } from './listas-respuesta.js';

// Lecturas de la lista de precios. Orden por (nombre normalizado, id).

export const listasPrecioListar = definirHerramienta('listas_precio_listar', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar la lista de precios',
    paraQueSirve: 'Muestra los productos con precio por cantidad (100, 1.000 y 5.000), ordenados por nombre, por páginas.',
    cuandoUsarla: 'Para elegir con qué producto cotizar o revisar qué precios llevan mucho tiempo sin actualizarse.',
    campos: [
      { nombre: 'buscar', queSeAnota: 'Parte del nombre (opcional).', ejemplo: 'volantes' },
      { nombre: 'estado', queSeAnota: 'activas, archivadas o todas (por defecto, activas).', ejemplo: 'activas' },
      { nombre: 'productoId', queSeAnota: 'Solo la lista de ese producto del catálogo (opcional).', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'soloSinProducto', queSeAnota: 'true para ver solo las listas que aún no están enlazadas a un producto.', ejemplo: 'false' },
      { nombre: 'soloPorRevisar', queSeAnota: 'true para ver solo los precios con más de 90 días sin fijar.', ejemplo: 'false' },
    ],
    ejemploTecleado: 'ver los precios por revisar',
    ejemploHablado: 'qué precios hace mucho que no actualizo',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['lista_precio_ver', 'lista_precio_crear', 'precio_consultar'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor ? decodificarCursorDeLista(args.cursor) : null;
    if (args.cursor && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const hoy = await hoyDeLaEmpresa(tx);
    const buscar = args.buscar ? normalizarNombre(args.buscar) : '';
    const r = await listarListas(tx, ctx, {
      ...(buscar && { buscar }),
      ...(args.productoId && { productoId: args.productoId }),
      soloSinProducto: args.soloSinProducto,
      estado: args.estado,
      porRevisarAntesDe: args.soloPorRevisar ? corteParaRevisar(hoy.dia) : null,
      zona: hoy.zona,
      cursor,
      limite: args.limite,
    });
    return exito({ items: await listasADto(tx, ctx, r.items, hoy), siguiente: r.siguiente });
  },
});

export const listaPrecioVer = definirHerramienta('lista_precio_ver', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver un producto de la lista',
    paraQueSirve: 'Muestra los tres precios de referencia, el modo entre cantidades, el precio mínimo y desde cuándo se fijaron.',
    cuandoUsarla: 'Antes de editar un precio o de cotizar con él.',
    campos: [{ nombre: 'id', queSeAnota: 'Identificador de la lista.', ejemplo: ID_DE_EJEMPLO }],
    ejemploTecleado: 'ver los precios de Volantes A5',
    ejemploHablado: 'cuánto cuestan los volantes a cinco',
    erroresComunes: ['La lista no existe o es de otra empresa.'],
    relacionadas: ['listas_precio_listar', 'lista_precio_editar'],
  },
  async ejecutar(args, ctx, tx) {
    const f = await verLista(tx, ctx, args.id);
    return f ? exito(await listaADto(tx, ctx, f, await hoyDeLaEmpresa(tx))) : rechazo('no_encontrado', 'No existe esa lista de precios.');
  },
});
