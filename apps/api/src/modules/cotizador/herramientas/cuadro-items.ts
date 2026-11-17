import { exito, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { aplicarAgregarItem, aplicarEditarItem, aplicarQuitarItem } from '../domain/cuadro-comandos-items.js';
import { normalizarNombre } from '../domain/lista.js';
import { MAXIMO_DE_ITEMS_DEL_CUADRO } from '@capaz/shared';
import { crearItem, itemActivoConNombre, resumenDeItems } from '../repositories/taller.repository.js';
import { MODULO } from './comun.js';
import { auditarCuadro, editarCuadro, ID_DE_COTIZACION } from './cuadro-comun.js';

// Ítems adicionales de UNA cotización (hasta 12): filas con nombre propio que suman a un factor y se escriben a mano en el cuadro directo.

const ITEM = { nombre: 'item', queSeAnota: 'Qué ítem: su id (i1, i2…) o su nombre.', ejemplo: 'Plastificado' };
const CAMPOS = [
  { nombre: 'nombre', queSeAnota: 'Nombre del ítem, único en el cuadro.', ejemplo: 'Troquelado' },
  { nombre: 'factor', queSeAnota: 'A qué factor suma: material, planchas, impresion, diseno, acabado o indirectos.', ejemplo: 'acabado' },
  { nombre: 'despuesDe', queSeAnota: 'Tras qué fila se pinta (por defecto, su factor).', ejemplo: 'acabado' },
  { nombre: 'fija', queSeAnota: 'true si cuesta lo mismo a 100 que a 5.000.', ejemplo: 'false' },
];

export const cuadroItemAgregar = definirHerramienta('cuadro_item_agregar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Agregar un ítem a este cuadro',
    paraQueSirve: 'Suma un ítem adicional (Troquelado, Encolado…) solo a esta cotización; sus importes se escriben con cuadro_fijar_costo_directo usando su id. Con guardarEnTaller también se guarda en el cuadro de la empresa para las cotizaciones nuevas.',
    cuandoUsarla: 'Cuando este trabajo lleva un cobro aparte que no está entre los ítems de la empresa.',
    campos: [ID_DE_COTIZACION, ...CAMPOS, { nombre: 'guardarEnTaller', queSeAnota: 'true para guardarlo también en el taller (pide permiso de configurar).', ejemplo: 'false' }],
    ejemploTecleado: 'agrega el ítem Troquelado en acabado',
    ejemploHablado: 'agrega troquelado como acabado',
    erroresComunes: ['Ya hay un ítem con ese nombre en el cuadro.', 'Una cotización admite hasta 12 ítems.', 'Guardarlo en el taller sin permiso de configurar.'],
    relacionadas: ['cuadro_item_editar', 'cuadro_item_quitar', 'cuadro_fijar_costo_directo', 'item_cuadro_crear'],
  },
  auditar: auditarCuadro,
  async ejecutar(args, ctx, tx) {
    if (args.guardarEnTaller && !ctx.permisos.includes('cotizador:configurar')) return rechazo('sin_permiso', 'Para guardar el ítem en el cuadro de la empresa necesitas el permiso de configurar.');
    const r = await editarCuadro(tx, ctx, args.id, (cuadro) => aplicarAgregarItem(cuadro, args));
    if (!r.ok || !args.guardarEnTaller) return r;
    // Misma regla que `item_cuadro_crear`: un nombre libre y hasta 20 ítems activos; si no cabe, el ítem queda solo en la cotización.
    const normalizado = normalizarNombre(args.nombre);
    const { activos, siguientePosicion } = await resumenDeItems(tx, ctx);
    const motivo = (await itemActivoConNombre(tx, ctx, normalizado)) ? 'Ya existe un ítem con ese nombre en el cuadro de la empresa.' : activos >= MAXIMO_DE_ITEMS_DEL_CUADRO ? `El cuadro de la empresa ya tiene ${MAXIMO_DE_ITEMS_DEL_CUADRO} ítems.` : null;
    if (motivo) return exito(r.datos, { avisos: [...r.avisos, { codigo: 'no_guardado_en_taller', mensaje: `${motivo} Quedó solo en esta cotización.`, nivel: 'comercial' }] });
    await crearItem(tx, ctx, { nombre: args.nombre, factor: args.factor, despuesDe: args.despuesDe ?? args.factor, fija: args.fija, nombreNormalizado: normalizado, posicion: siguientePosicion });
    return r;
  },
});

export const cuadroItemEditar = definirHerramienta('cuadro_item_editar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Cambiar un ítem de este cuadro',
    paraQueSirve: 'Cambia el nombre, el factor, dónde se pinta o si es fijo un ítem de esta cotización. No toca el cuadro de la empresa.',
    cuandoUsarla: 'Para corregir o renombrar un ítem de la cotización.',
    campos: [ID_DE_COTIZACION, ITEM, ...CAMPOS],
    ejemploTecleado: 'renombra el ítem Encolado a Encolado de lomo',
    ejemploHablado: 'cambia encolado por encolado de lomo',
    erroresComunes: ['Ya hay otro ítem con ese nombre.', 'El ítem no existe en este cuadro.'],
    relacionadas: ['cuadro_item_agregar', 'cuadro_item_quitar'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) => editarCuadro(tx, ctx, args.id, (cuadro) => aplicarEditarItem(cuadro, args.item, args)),
});

export const cuadroItemQuitar = definirHerramienta('cuadro_item_quitar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Quitar un ítem de este cuadro',
    paraQueSirve: 'Quita un ítem de esta cotización con lo que tenía escrito. No toca el cuadro de la empresa.',
    cuandoUsarla: 'Cuando el ítem no aplica a este trabajo.',
    campos: [ID_DE_COTIZACION, ITEM],
    ejemploTecleado: 'quita el ítem Encolado',
    ejemploHablado: 'quita el encolado',
    erroresComunes: ['El ítem no existe en este cuadro.'],
    relacionadas: ['cuadro_item_agregar', 'cuadro_item_editar'],
  },
  auditar: auditarCuadro,
  ejecutar: (args, ctx, tx) => editarCuadro(tx, ctx, args.id, (cuadro) => aplicarQuitarItem(cuadro, args.item)),
});
