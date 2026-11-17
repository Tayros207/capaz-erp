import type { EntradaDe } from '@capaz/shared';
import { llamar } from '../../shared/api/herramientas.ts';

// Contratos de trabajo y vacaciones (0028).

export const POR_PAGINA_DE_CONTRATOS = 25;

export const crearContrato = (args: EntradaDe<'contrato_crear'>) => llamar('contrato_crear', args);
export const terminarContrato = (args: EntradaDe<'contrato_terminar'>) => llamar('contrato_terminar', args);
export const listarContratos = (args: EntradaDe<'contratos_listar'>) => llamar('contratos_listar', args);

export const solicitarVacaciones = (args: EntradaDe<'vacaciones_solicitar'>) => llamar('vacaciones_solicitar', args);
export const resolverVacaciones = (args: EntradaDe<'vacaciones_resolver'>) => llamar('vacaciones_resolver', args);
export const anularVacaciones = (args: EntradaDe<'vacaciones_anular'>) => llamar('vacaciones_anular', args);
export const listarVacaciones = (args: EntradaDe<'vacaciones_listar'>) => llamar('vacaciones_listar', args);
export const verSaldoDeVacaciones = (colaboradorId: string) => llamar('vacaciones_saldo', { colaboradorId });
/** Colaboradores activos para elegirlos en los formularios. */
export const colaboradoresActivos = () => llamar('colaboradores_listar', { estado: 'activos', limite: 100 });
