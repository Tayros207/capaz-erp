import { exito, MAXIMO_DE_ITEMS_DEL_CUADRO, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { normalizarNombre } from '../domain/lista.js';
import { validarItem, type DatosDeItem } from '../domain/taller.js';
import { archivarItem, bloquearItem, crearItem, editarItem, fijarPosiciones, itemActivoConNombre, listarItems, resumenDeItems } from '../repositories/taller.repository.js';
import { ID_DE_EJEMPLO, MODULO } from './comun.js';
import { aItemDto, archivadaNoSeEdita, noExiste, nombreRepetido, rechazoSiMalo } from './taller-mapeo.js';

// Ítems propios del cuadro (Plastificado, Encolado…): suman a un factor, se pintan tras otra fila y van en orden.

const QUE = 'ese ítem';
const auditar = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'item_cuadro', entidadId: d?.id });
const ID = { nombre: 'id', queSeAnota: 'Identificador del ítem.', ejemplo: ID_DE_EJEMPLO };
const CAMPOS = [
  { nombre: 'nombre', queSeAnota: 'Cómo se llama el ítem.', ejemplo: 'Plastificado' },
  { nombre: 'factor', queSeAnota: 'A qué factor suma: material, planchas, impresion, diseno, acabado o indirectos.', ejemplo: 'acabado' },
  { nombre: 'despuesDe', queSeAnota: 'Tras qué fila base se pinta (por defecto, su propio factor).', ejemplo: 'acabado' },
  { nombre: 'fija', queSeAnota: 'true si su costo no cambia al correr el cuadro a otra cantidad.', ejemplo: 'false' },
];
const repetido = (o: { id: string; nombre: string }) => nombreRepetido('un ítem', o, 'ítem del cuadro');

export const itemsCuadroListar = definirHerramienta('items_cuadro_listar', {
  modulo: MODULO,
  permiso: 'cotizador:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar los ítems del cuadro',
    paraQueSirve: 'Muestra los ítems propios con los que nace un cuadro de costos, en su orden.',
    cuandoUsarla: 'Para revisar o reordenar los ítems que el taller cobra aparte.',
    campos: [{ nombre: 'estado', queSeAnota: 'activas, archivadas o todas (por defecto, activas).', ejemplo: 'activas' }],
    ejemploTecleado: 'ver los ítems del cuadro',
    ejemploHablado: 'qué acabados tengo en el cuadro',
    erroresComunes: ['Si no aparece ninguno, el taller está vacío: carga los valores de ejemplo o crea uno.'],
    relacionadas: ['item_cuadro_crear', 'items_cuadro_reordenar'],
  },
  async ejecutar(args, ctx, tx) {
    return exito({ items: (await listarItems(tx, ctx, args.estado)).map(aItemDto), siguiente: null });
  },
});

export const itemCuadroCrear = definirHerramienta('item_cuadro_crear', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Crear un ítem del cuadro',
    paraQueSirve: `Agrega un ítem propio (hasta ${MAXIMO_DE_ITEMS_DEL_CUADRO}) con el que nacerá cada cuadro de costos nuevo. Va al final del orden.`,
    cuandoUsarla: 'Cuando cobras aparte un acabado o servicio que se repite (troquelado, encolado…).',
    campos: CAMPOS,
    ejemploTecleado: 'crear ítem Troquelado en acabado',
    ejemploHablado: 'agrega troquelado como acabado',
    erroresComunes: ['Ya existe un ítem con ese nombre.', `Ya hay ${MAXIMO_DE_ITEMS_DEL_CUADRO} ítems activos: archiva alguno.`],
    relacionadas: ['items_cuadro_listar', 'item_cuadro_editar', 'items_cuadro_reordenar'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const datos: DatosDeItem = { nombre: args.nombre, factor: args.factor, despuesDe: args.despuesDe ?? args.factor, fija: args.fija };
    const malo = rechazoSiMalo(validarItem(datos));
    if (malo) return malo;
    const normalizado = normalizarNombre(datos.nombre);
    const otro = await itemActivoConNombre(tx, ctx, normalizado);
    if (otro) return repetido(otro);
    const { activos, siguientePosicion } = await resumenDeItems(tx, ctx);
    if (activos >= MAXIMO_DE_ITEMS_DEL_CUADRO) return rechazo('conflicto', `Ya hay ${MAXIMO_DE_ITEMS_DEL_CUADRO} ítems activos: archiva alguno para agregar otro.`);
    const r = await crearItem(tx, ctx, { ...datos, nombreNormalizado: normalizado, posicion: siguientePosicion });
    return r.creada ? exito(aItemDto(r.fila)) : repetido(r.existente);
  },
});

export const itemCuadroEditar = definirHerramienta('item_cuadro_editar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Cambiar un ítem del cuadro',
    paraQueSirve: 'Cambia el nombre, el factor, dónde se pinta o si es fijo. Los cuadros ya abiertos no cambian.',
    cuandoUsarla: 'Cuando corriges o renombras un ítem.',
    campos: [ID, ...CAMPOS],
    ejemploTecleado: 'renombrar el ítem Encolado a Encolado de lomo',
    ejemploHablado: 'cambia encolado por encolado de lomo',
    erroresComunes: ['Hay que indicar al menos un dato.', 'Un ítem archivado no se edita.', 'Ya existe un ítem con ese nombre.'],
    relacionadas: ['items_cuadro_listar', 'item_cuadro_archivar'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearItem(tx, ctx, args.id);
    if (!actual) return noExiste(QUE);
    if (actual.archivadoEn) return archivadaNoSeEdita('Un ítem');
    const nuevo: DatosDeItem = {
      nombre: args.nombre ?? actual.nombre,
      factor: args.factor ?? (actual.factor as DatosDeItem['factor']),
      despuesDe: args.despuesDe ?? (actual.despuesDe as DatosDeItem['despuesDe']),
      fija: args.fija ?? actual.fija,
    };
    const malo = rechazoSiMalo(validarItem(nuevo));
    if (malo) return malo;
    const normalizado = normalizarNombre(nuevo.nombre);
    const otro = await itemActivoConNombre(tx, ctx, normalizado, actual.id);
    if (otro) return repetido(otro);
    return exito(aItemDto(await editarItem(tx, ctx, actual.id, { ...nuevo, nombreNormalizado: normalizado })));
  },
});

export const itemCuadroArchivar = definirHerramienta('item_cuadro_archivar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Archivar un ítem del cuadro',
    paraQueSirve: 'Quita un ítem de los cuadros nuevos. Los cuadros ya armados se conservan.',
    cuandoUsarla: 'Cuando dejas de cobrar ese servicio aparte.',
    campos: [ID],
    ejemploTecleado: 'archivar el ítem Encolado',
    ejemploHablado: 'ya no cobro encolado aparte',
    erroresComunes: ['El ítem no existe o es de otra empresa.'],
    relacionadas: ['items_cuadro_listar', 'item_cuadro_crear'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const i = await archivarItem(tx, ctx, args.id);
    return i ? exito(aItemDto(i)) : noExiste(QUE);
  },
});

export const itemsCuadroReordenar = definirHerramienta('items_cuadro_reordenar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Reordenar los ítems del cuadro',
    paraQueSirve: 'Fija el orden de los ítems: el primero de la lista queda arriba. Los que no nombres siguen después, en su orden.',
    cuandoUsarla: 'Cuando quieres que un ítem aparezca antes que otro en los cuadros nuevos.',
    campos: [{ nombre: 'ids', queSeAnota: 'Identificadores de los ítems en el orden que quieres.', ejemplo: `["${ID_DE_EJEMPLO}"]` }],
    ejemploTecleado: 'poner Encolado antes de Plastificado',
    ejemploHablado: 'sube encolado arriba de plastificado',
    erroresComunes: ['Uno de los ítems no existe o está archivado.', 'Hay ítems repetidos en el orden.'],
    relacionadas: ['items_cuadro_listar', 'item_cuadro_editar'],
  },
  auditar: () => ({ entidadTipo: 'item_cuadro' }),
  async ejecutar(args, ctx, tx) {
    const activos = await listarItems(tx, ctx, 'activas');
    const vivos = new Set(activos.map((i) => i.id));
    if (args.ids.some((id) => !vivos.has(id))) return rechazo('no_encontrado', 'Uno de los ítems no existe o está archivado.');
    const nombrados = new Set(args.ids);
    await fijarPosiciones(tx, ctx, [...args.ids, ...activos.filter((i) => !nombrados.has(i.id)).map((i) => i.id)]);
    return exito({ items: (await listarItems(tx, ctx, 'activas')).map(aItemDto), siguiente: null });
  },
});
