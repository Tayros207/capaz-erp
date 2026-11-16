import type { EntradaDe } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

// Llamadas a las herramientas de `crm` (todas pasan por `ejecutar()` en el servidor).

export const POR_PAGINA = 25;
/** Clave raíz de las consultas del módulo (para invalidar tras escribir). */
export const CLAVE_CRM = ['crm'] as const;

export const iniciarCrm = () => llamar('crm_iniciar', {});
export const listarEtapas = (incluirArchivadas = false) => llamar('etapas_listar', { incluirArchivadas });
export const crearEtapa = (nombre: string) => llamar('etapa_crear', { nombre });
export const renombrarEtapa = (id: string, nombre: string) => llamar('etapa_editar', { id, nombre });
export const ordenarEtapas = (ids: string[]) => llamar('etapas_ordenar', { ids });
export const archivarEtapa = (id: string) => llamar('etapa_archivar', { id });

export const listarOportunidades = (args: EntradaDe<'oportunidades_listar'>) => llamar('oportunidades_listar', args);
export const verOportunidad = (id: string) => llamar('oportunidad_ver', { id });
export const crearOportunidad = (args: EntradaDe<'oportunidad_crear'>) => llamar('oportunidad_crear', args);
export const editarOportunidad = (args: EntradaDe<'oportunidad_editar'>) => llamar('oportunidad_editar', args);
export const moverOportunidad = (id: string, etapaId: string) => llamar('oportunidad_mover', { id, etapaId });
export const ganarOportunidad = (id: string) => llamar('oportunidad_ganar', { id });
export const perderOportunidad = (id: string, motivo: string) => llamar('oportunidad_perder', { id, motivo });
export const reabrirOportunidad = (id: string) => llamar('oportunidad_reabrir', { id });

export const listarActividades = (args: EntradaDe<'actividades_listar'>) => llamar('actividades_listar', args);
export const crearActividad = (args: EntradaDe<'actividad_crear'>) => llamar('actividad_crear', args);
export const completarActividad = (id: string) => llamar('actividad_completar', { id });

export const buscarClientes = (texto: string) => llamar('clientes_buscar', { texto, limite: 10 });
