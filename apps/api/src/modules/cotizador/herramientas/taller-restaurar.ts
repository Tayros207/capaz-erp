import { exito, MAXIMO_DE_ITEMS_DEL_CUADRO, rechazo } from '@capaz/shared';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import {
  bloquearFormato, bloquearItem, bloquearMaquina, bloquearTarifa, formatoActivoConNombre, itemActivoConNombre, maquinaActivaConNombre, resumenDeItems,
  restaurarFormato, restaurarItem, restaurarMaquina, restaurarTarifa, tarifaActivaConNombre, verFormato,
} from '../repositories/taller.repository.js';
import { ID_DE_EJEMPLO, MODULO } from './comun.js';
import { aFormatoDto, aItemDto, aMaquinaDto, aTarifaDto, noExiste, nombreRepetido } from './taller-mapeo.js';

// Restaurar lo archivado del taller. Idempotente: lo que ya está activo se devuelve tal cual. Si otra fila activa ya usa
// el nombre, `conflicto` con esa fila como candidata (el índice único de nombre activo lo exige).

const ID = { nombre: 'id', queSeAnota: 'Identificador del registro archivado.', ejemplo: ID_DE_EJEMPLO };
const auditarComo = (tipo: string) => (_a: unknown, d: { id: string } | null) => ({ entidadTipo: tipo, entidadId: d?.id });
const ayudaDe = (titulo: string, paraQueSirve: string, ejemploTecleado: string, relacionadas: string[]) => ({
  titulo,
  paraQueSirve,
  cuandoUsarla: 'Cuando archivaste algo por error o vuelves a usarlo.',
  campos: [ID],
  ejemploTecleado,
  ejemploHablado: ejemploTecleado,
  erroresComunes: ['No existe o es de otra empresa.', 'Otro registro activo ya usa ese nombre: cámbiale el nombre o archívalo primero.'],
  relacionadas,
});

export const formatoPliegoRestaurar = definirHerramienta('formato_pliego_restaurar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: ayudaDe('Restaurar un formato de pliego', 'Vuelve a activar un formato de pliego archivado.', 'restaurar el pliego 50 × 70', ['formatos_pliego_listar', 'formato_pliego_archivar']),
  auditar: auditarComo('formato_pliego'),
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearFormato(tx, ctx, args.id);
    if (!actual) return noExiste('ese formato de pliego');
    const otra = actual.archivadoEn ? await formatoActivoConNombre(tx, ctx, actual.nombreNormalizado, actual.id) : null;
    if (otra) return nombreRepetido('un formato', otra, `${otra.anchoCm} × ${otra.altoCm} cm`);
    return exito(aFormatoDto((await restaurarFormato(tx, ctx, actual.id)) ?? actual));
  },
});

export const maquinaRestaurar = definirHerramienta('maquina_restaurar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: ayudaDe('Restaurar una máquina', 'Vuelve a activar una máquina archivada.', 'restaurar la máquina Offset 36 × 52', ['maquinas_listar', 'maquina_archivar']),
  auditar: auditarComo('maquina'),
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearMaquina(tx, ctx, args.id);
    if (!actual) return noExiste('esa máquina');
    const otra = actual.archivadoEn ? await maquinaActivaConNombre(tx, ctx, actual.nombreNormalizado, actual.id) : null;
    if (otra) return nombreRepetido('una máquina', otra, 'máquina');
    return exito(aMaquinaDto((await restaurarMaquina(tx, ctx, actual.id)) ?? actual));
  },
});

export const tarifaRestaurar = definirHerramienta('tarifa_restaurar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: ayudaDe('Restaurar una tarifa', 'Vuelve a activar una tarifa archivada. Si su formato de pliego sigue archivado, restáuralo antes.', 'restaurar la tarifa papel bond 80', ['tarifas_listar', 'tarifa_archivar']),
  auditar: auditarComo('tarifa'),
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearTarifa(tx, ctx, args.id);
    if (!actual) return noExiste('esa tarifa');
    if (actual.archivadoEn) {
      const otra = await tarifaActivaConNombre(tx, ctx, actual.nombreNormalizado, actual.id);
      if (otra) return nombreRepetido('una tarifa', otra, 'tarifa');
      const formato = actual.formatoId ? await verFormato(tx, ctx, actual.formatoId) : null;
      if (formato?.archivadoEn) return rechazo('conflicto', `El formato de pliego «${formato.nombre}» de esta tarifa está archivado: restáuralo primero.`, [{ id: formato.id, nombre: formato.nombre, detalle: 'formato de pliego' }]);
    }
    return exito(aTarifaDto((await restaurarTarifa(tx, ctx, actual.id)) ?? actual));
  },
});

export const itemCuadroRestaurar = definirHerramienta('item_cuadro_restaurar', {
  modulo: MODULO,
  permiso: 'cotizador:configurar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: ayudaDe('Restaurar un ítem del cuadro', `Vuelve a activar un ítem archivado del cuadro (hasta ${MAXIMO_DE_ITEMS_DEL_CUADRO} activos); queda al final del orden.`, 'restaurar el ítem Encolado', ['items_cuadro_listar', 'item_cuadro_archivar']),
  auditar: auditarComo('item_cuadro'),
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearItem(tx, ctx, args.id);
    if (!actual) return noExiste('ese ítem');
    if (actual.archivadoEn) {
      const otro = await itemActivoConNombre(tx, ctx, actual.nombreNormalizado, actual.id);
      if (otro) return nombreRepetido('un ítem', otro, 'ítem del cuadro');
      const { activos } = await resumenDeItems(tx, ctx);
      if (activos >= MAXIMO_DE_ITEMS_DEL_CUADRO) return rechazo('conflicto', `Ya hay ${MAXIMO_DE_ITEMS_DEL_CUADRO} ítems activos: archiva alguno para restaurar otro.`);
    }
    return exito(aItemDto((await restaurarItem(tx, ctx, actual.id)) ?? actual));
  },
});
