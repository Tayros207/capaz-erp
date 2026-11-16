import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { normalizarNombre } from '../domain/catalogos.js';
import { archivarCategoria, crearCategoria, listarCategorias, renombrarCategoria, type Categoria } from '../repositories/categorias.repository.js';
import { ID_DE_EJEMPLO, MODULO } from './comun.js';
import { aCategoriaDto } from './mapeo.js';

// Catálogo de categorías de ingreso y de egreso. No tienen alcance «propios».

const NO_EXISTE = 'No existe esa categoría.';
const ID = { nombre: 'id', queSeAnota: 'Identificador de la categoría.', ejemplo: ID_DE_EJEMPLO };
const AUDITAR = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'categoria', entidadId: d?.id });
const repetida = (c: Categoria) => rechazo('conflicto', `Ya existe la categoría «${c.nombre}» de ${c.tipo}s.`, [{ id: c.id, nombre: c.nombre, detalle: c.tipo }]);

export const categoriasListar = definirHerramienta('categorias_listar', {
  modulo: MODULO,
  permiso: 'registro:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar categorías',
    paraQueSirve: 'Muestra las categorías con las que se clasifican los ingresos y los egresos.',
    cuandoUsarla: 'Para elegir la categoría de un movimiento o revisar cuáles existen.',
    campos: [
      { nombre: 'tipo', queSeAnota: 'ingreso o egreso (opcional: sin él, las dos).', ejemplo: 'egreso' },
      { nombre: 'incluirArchivadas', queSeAnota: 'true para ver también las archivadas.', ejemplo: 'false' },
    ],
    ejemploTecleado: 'ver categorías de egreso',
    ejemploHablado: 'qué categorías de gasto tengo',
    erroresComunes: ['Si la lista sale vacía, el módulo todavía no se preparó: usa «registro_iniciar».'],
    relacionadas: ['categoria_crear', 'registro_iniciar'],
  },
  async ejecutar(args, ctx, tx) {
    const filas = await listarCategorias(tx, ctx, args);
    return exito({ items: filas.map(aCategoriaDto), siguiente: null });
  },
});

export const categoriaCrear = definirHerramienta('categoria_crear', {
  modulo: MODULO,
  permiso: 'registro:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Crear una categoría',
    paraQueSirve: 'Agrega una categoría para clasificar ingresos o egresos.',
    cuandoUsarla: 'Cuando un tipo de ingreso o de gasto se repite y quieres verlo aparte en los resúmenes.',
    campos: [
      { nombre: 'nombre', queSeAnota: 'Nombre de la categoría.', ejemplo: 'Alquiler' },
      { nombre: 'tipo', queSeAnota: 'ingreso o egreso.', ejemplo: 'egreso' },
    ],
    ejemploTecleado: 'crear categoría de egreso Alquiler',
    ejemploHablado: 'agrega la categoría de gasto alquiler',
    erroresComunes: ['Ya existe una categoría con ese nombre en ese tipo.'],
    relacionadas: ['categorias_listar', 'categoria_editar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const r = await crearCategoria(tx, ctx, { nombre: args.nombre, nombreNormalizado: normalizarNombre(args.nombre), tipo: args.tipo });
    return r.creada ? exito(aCategoriaDto(r.categoria)) : repetida(r.existente);
  },
});

export const categoriaEditar = definirHerramienta('categoria_editar', {
  modulo: MODULO,
  permiso: 'registro:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Renombrar una categoría',
    paraQueSirve: 'Cambia el nombre de una categoría. El tipo no cambia.',
    cuandoUsarla: 'Para corregir o aclarar el nombre de una categoría.',
    campos: [ID, { nombre: 'nombre', queSeAnota: 'Nombre nuevo.', ejemplo: 'Alquiler del local' }],
    ejemploTecleado: 'renombrar la categoría Alquiler a Alquiler del local',
    ejemploHablado: 'la categoría alquiler ahora se llama alquiler del local',
    erroresComunes: ['Otra categoría del mismo tipo ya usa ese nombre.'],
    relacionadas: ['categorias_listar', 'categoria_archivar'],
  },
  auditar: (a) => ({ entidadTipo: 'categoria', entidadId: a.id }),
  async ejecutar(args, ctx, tx) {
    const r = await renombrarCategoria(tx, ctx, args.id, { nombre: args.nombre, nombreNormalizado: normalizarNombre(args.nombre) });
    if (!r) return rechazo('no_encontrado', NO_EXISTE);
    return 'existente' in r ? repetida(r.existente) : exito(aCategoriaDto(r.categoria));
  },
});

export const categoriaArchivar = definirHerramienta('categoria_archivar', {
  modulo: MODULO,
  permiso: 'registro:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar una categoría',
    paraQueSirve: 'Oculta una categoría que ya no se usa. Los movimientos que la tienen la conservan.',
    cuandoUsarla: 'Cuando una categoría dejó de tener sentido para tu negocio.',
    campos: [ID],
    ejemploTecleado: 'archivar la categoría Alquiler del local',
    ejemploHablado: 'ya no uso la categoría alquiler del local',
    erroresComunes: ['La categoría no existe o es de otra empresa.'],
    relacionadas: ['categorias_listar'],
  },
  auditar: AUDITAR,
  async ejecutar(args, ctx, tx) {
    const f = await archivarCategoria(tx, ctx, args.id);
    return f ? exito(aCategoriaDto(f)) : rechazo('no_encontrado', NO_EXISTE);
  },
});
