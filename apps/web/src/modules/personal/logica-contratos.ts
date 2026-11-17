import type { Centimos, ContratoDeTrabajoDto, EstadoDeVacaciones, TipoDeContrato } from '@capaz/shared';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

export const ETIQUETA_DE_TIPO_DE_CONTRATO: Readonly<Record<TipoDeContrato, string>> = {
  indeterminado: 'Plazo indeterminado',
  plazo_fijo: 'Plazo fijo',
  locacion: 'Locación de servicios',
  practicas: 'Prácticas',
};

export const ETIQUETA_DE_VACACIONES: Readonly<Record<EstadoDeVacaciones, string>> = { solicitada: 'Pendiente', aprobada: 'Aprobada', rechazada: 'Rechazada', anulada: 'Anulada' };
export const TONO_DE_VACACIONES: Readonly<Record<EstadoDeVacaciones, TonoDeInsignia>> = { solicitada: 'aviso', aprobada: 'exito', rechazada: 'peligro', anulada: 'neutro' };

export const FILTROS_DE_VACACIONES = { abiertas: 'Pendientes de aprobar', aprobada: 'Aprobadas', rechazada: 'Rechazadas', anulada: 'Anuladas', todas: 'Todas' } as const;
export const FILTROS_DE_CONTRATOS = { vigentes: 'Vigentes', terminados: 'Terminados', todos: 'Todos' } as const;

/** Qué se puede hacer con unas vacaciones según su estado (quién puede lo decide el permiso). */
export const accionesDeVacaciones = (estado: EstadoDeVacaciones) => ({ resolver: estado === 'solicitada', anular: estado === 'solicitada' || estado === 'aprobada' });

/** «Hasta el 31/08/2026» o «Sin fecha de fin». */
export const textoDeVigencia = (c: Pick<ContratoDeTrabajoDto, 'fin'>): string => (c.fin ? `hasta el ${c.fin.split('-').reverse().join('/')}` : 'sin fecha de fin');

export type FormularioDeVacaciones = { colaboradorId: string; desde: string; hasta: string; motivo: string };
export type ErroresDeVacaciones = Partial<Record<'colaboradorId' | 'desde' | 'hasta', string>>;

export function validarVacaciones(f: FormularioDeVacaciones): ErroresDeVacaciones {
  const e: ErroresDeVacaciones = {};
  if (!f.colaboradorId) e.colaboradorId = 'Elige al colaborador.';
  if (!f.desde) e.desde = 'Indica el primer día.';
  if (!f.hasta) e.hasta = 'Indica el último día.';
  else if (f.desde && f.hasta < f.desde) e.hasta = 'El último día no puede ser anterior al primero.';
  return e;
}

export type FormularioDeContrato = { colaboradorId: string; tipo: TipoDeContrato; inicio: string; fin: string; remuneracion: Centimos | null; jornada: string };
export type ErroresDeContrato = Partial<Record<'colaboradorId' | 'inicio' | 'fin' | 'remuneracion' | 'jornada', string>>;

export function validarContrato(f: FormularioDeContrato): ErroresDeContrato {
  const e: ErroresDeContrato = {};
  if (!f.colaboradorId) e.colaboradorId = 'Elige al colaborador.';
  if (!f.inicio) e.inicio = 'Indica el primer día del contrato.';
  if ((f.tipo === 'plazo_fijo' || f.tipo === 'practicas') && !f.fin) e.fin = 'Este tipo de contrato necesita fecha de fin.';
  else if (f.fin && f.inicio && f.fin < f.inicio) e.fin = 'El fin no puede ser anterior al inicio.';
  if (f.remuneracion === null) e.remuneracion = 'Escribe la remuneración mensual.';
  const horas = Number(f.jornada);
  if (!Number.isInteger(horas) || horas < 1 || horas > 84) e.jornada = 'Escribe las horas por semana (1 a 84).';
  return e;
}
