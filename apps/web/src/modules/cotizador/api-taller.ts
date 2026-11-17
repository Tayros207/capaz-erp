import type { EntradaDe } from '@capaz/shared';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

// Las pantallas del taller solo hablan con el servidor por herramientas tipadas. Ningún costo se calcula aquí.

export const POR_PAGINA_DEL_TALLER = 50;
export type EstadoDelTaller = NonNullable<EntradaDe<'tarifas_listar'>['estado']>;

export const listarTarifas = (filtros: Omit<EntradaDe<'tarifas_listar'>, 'cursor' | 'limite'>, cursor?: string) =>
  llamar('tarifas_listar', { limite: POR_PAGINA_DEL_TALLER, ...filtros, ...(cursor && { cursor }) });
export const crearTarifa = (args: EntradaDe<'tarifa_crear'>) => llamar('tarifa_crear', args);
/** Crítica: el servidor devuelve «Cambiarás el costo de «X»: 0.45 → 0.52» y la persona confirma. */
export const editarTarifa = (args: EntradaDe<'tarifa_editar'>) => llamarConfirmando('tarifa_editar', args, { titulo: 'Cambiar la tarifa', textoConfirmar: 'Guardar cambios' });
export const archivarTarifa = (id: string) => llamar('tarifa_archivar', { id });
export const restaurarTarifa = (id: string) => llamar('tarifa_restaurar', { id });

export const listarMaquinas = (filtros: Omit<EntradaDe<'maquinas_listar'>, 'cursor' | 'limite'>, cursor?: string) =>
  llamar('maquinas_listar', { limite: POR_PAGINA_DEL_TALLER, ...filtros, ...(cursor && { cursor }) });
export const crearMaquina = (args: EntradaDe<'maquina_crear'>) => llamar('maquina_crear', args);
export const editarMaquina = (args: EntradaDe<'maquina_editar'>) => llamar('maquina_editar', args);
export const archivarMaquina = (id: string) => llamar('maquina_archivar', { id });
export const restaurarMaquina = (id: string) => llamar('maquina_restaurar', { id });

export const listarFormatos = (filtros: Omit<EntradaDe<'formatos_pliego_listar'>, 'cursor' | 'limite'>, cursor?: string) =>
  llamar('formatos_pliego_listar', { limite: POR_PAGINA_DEL_TALLER, ...filtros, ...(cursor && { cursor }) });
export const crearFormato = (args: EntradaDe<'formato_pliego_crear'>) => llamar('formato_pliego_crear', args);
export const editarFormato = (args: EntradaDe<'formato_pliego_editar'>) => llamar('formato_pliego_editar', args);
export const archivarFormato = (id: string) => llamar('formato_pliego_archivar', { id });
export const restaurarFormato = (id: string) => llamar('formato_pliego_restaurar', { id });

export const listarItems = (estado: EstadoDelTaller) => llamar('items_cuadro_listar', { estado });
export const crearItem = (args: EntradaDe<'item_cuadro_crear'>) => llamar('item_cuadro_crear', args);
export const editarItem = (args: EntradaDe<'item_cuadro_editar'>) => llamar('item_cuadro_editar', args);
export const archivarItem = (id: string) => llamar('item_cuadro_archivar', { id });
export const restaurarItem = (id: string) => llamar('item_cuadro_restaurar', { id });
export const reordenarItems = (ids: string[]) => llamar('items_cuadro_reordenar', { ids });

export const sembrarTaller = () => llamar('taller_sembrar', {});
