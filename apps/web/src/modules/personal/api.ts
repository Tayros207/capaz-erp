import type { AsistenciaDto, ColaboradorDto, EntradaDe } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar, llamarConfirmando } from '../../shared/api/herramientas.ts';

// Las pantallas de personal solo hablan con el servidor por herramientas tipadas.

export const POR_PAGINA = 25;
export type FiltroDeColaboradores = NonNullable<EntradaDe<'colaboradores_listar'>['estado']>;
export type FiltroDeAdelantos = NonNullable<EntradaDe<'adelantos_listar'>['estado']>;

export function listarColaboradores(filtros: Omit<EntradaDe<'colaboradores_listar'>, 'cursor'>, cursor?: string) {
  return llamar('colaboradores_listar', { limite: POR_PAGINA, ...filtros, ...(cursor && { cursor }) });
}
export const verColaborador = (id: string) => llamar('colaborador_ver', { id });
export const crearColaborador = (args: EntradaDe<'colaborador_crear'>) => llamar('colaborador_crear', args);
export const editarColaborador = (args: EntradaDe<'colaborador_editar'>) => llamar('colaborador_editar', args);
export const archivarColaborador = (id: string) => llamar('colaborador_archivar', { id });
export const restaurarColaborador = (id: string) => llamar('colaborador_restaurar', { id });

export const marcarAsistencia = (args: EntradaDe<'asistencia_marcar'>) => llamar('asistencia_marcar', args);
export const listarAsistencias = (args: EntradaDe<'asistencias_listar'>) => llamar('asistencias_listar', args);
/** Crítica: el servidor devuelve el resumen y la persona confirma antes de corregir. */
export const corregirAsistencia = (args: EntradaDe<'asistencia_corregir'>) =>
  llamarConfirmando('asistencia_corregir', args, { titulo: 'Corregir asistencia', textoConfirmar: 'Corregir' });

export const listarAdelantos = (filtros: Omit<EntradaDe<'adelantos_listar'>, 'cursor'>, cursor?: string) =>
  llamar('adelantos_listar', { limite: POR_PAGINA, ...filtros, ...(cursor && { cursor }) });
export const registrarAdelanto = (args: EntradaDe<'adelanto_registrar'>) => llamar('adelanto_registrar', args);
export const anularAdelanto = (id: string, motivo: string) =>
  llamarConfirmando('adelanto_anular', { id, motivo }, { titulo: 'Anular adelanto', textoConfirmar: 'Anular adelanto', peligroso: true });

const PAGINAS_COMO_MAXIMO = 5;

/** Los colaboradores activos (hasta 500), para el parte del día y el selector del adelanto. */
export async function cargarActivos(): Promise<ColaboradorDto[]> {
  const items: ColaboradorDto[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < PAGINAS_COMO_MAXIMO; i++) {
    const pagina = datosOError(await listarColaboradores({ estado: 'activos', limite: 100 }, cursor));
    items.push(...pagina.items);
    if (!pagina.siguiente) break;
    cursor = pagina.siguiente;
  }
  return items;
}

/** Las asistencias marcadas de un día (hasta 500). */
export async function cargarAsistenciasDelDia(fecha: string): Promise<AsistenciaDto[]> {
  const items: AsistenciaDto[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < PAGINAS_COMO_MAXIMO; i++) {
    const pagina = datosOError(await listarAsistencias({ desde: fecha, limite: 100, ...(cursor && { cursor }) }));
    items.push(...pagina.items);
    if (!pagina.siguiente) break;
    cursor = pagina.siguiente;
  }
  return items;
}
