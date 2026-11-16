import { exito, rechazo, type AdelantoDto, type AsistenciaDto, type ColaboradorCompletoDto, type Respuesta } from '@capaz/shared';
import type { ContextoDeHerramienta, DatosDeAuditoria } from '../../../core/herramientas/tipos.js';
import { alcanceDe } from '../../../core/modulos/alcance.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { ultimosAdelantos, verAdelanto } from '../repositories/adelantos.repository.js';
import { ultimasAsistencias, verAsistencia } from '../repositories/asistencias.repository.js';
import { esMiembro, sucursalVigente, verColaborador } from '../repositories/colaboradores.repository.js';
import { aAdelantoDto, aAsistenciaDto, aColaboradorCompleto } from './mapeo.js';

// Lo que comparten las herramientas del módulo. El acceso al módulo, el permiso y el «solo lectura» los resuelve el
// ejecutor (R2): aquí solo va el alcance «propios» (R4), que depende de cada fila.

export const MODULO = 'personal';
export const NO_EXISTE_COLABORADOR = 'No existe ese colaborador.';
export const NO_EXISTE_ADELANTO = 'No existe ese adelanto.';
export const ID_DE_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';
export const ID = { nombre: 'id', queSeAnota: 'Identificador del colaborador.', ejemplo: ID_DE_EJEMPLO };
export const COLABORADOR_ID = { nombre: 'colaboradorId', queSeAnota: 'Identificador del colaborador.', ejemplo: ID_DE_EJEMPLO };

/** Con alcance «propios», el usuario dueño de los adelantos que se pueden ver y cambiar; `null` si ve todo. */
export const propietarioDe = (ctx: ContextoDeHerramienta): string | null => (alcanceDe(ctx, MODULO) === 'propios' ? ctx.usuarioId : null);

/** Auditoría (R13): solo identificadores, estados y cifras. Nunca nombres, documentos, teléfonos ni notas. */
export const auditarColaborador = (_a: unknown, d: ColaboradorCompletoDto | null): DatosDeAuditoria => ({
  entidadTipo: 'colaborador',
  entidadId: d?.id,
  ...(d && { resumen: { archivado: d.archivado } }),
});
export const auditarAsistencia = (_a: unknown, d: AsistenciaDto | null): DatosDeAuditoria => ({
  entidadTipo: 'asistencia',
  entidadId: d?.id,
  ...(d && { resumen: { fecha: d.fecha, estado: d.estado } }),
});
export const auditarAdelanto = (_a: unknown, d: AdelantoDto | null): DatosDeAuditoria => ({
  entidadTipo: 'adelanto',
  entidadId: d?.id,
  ...(d && { resumen: { codigo: d.codigo, estado: d.estado, montoCentimos: d.montoCentimos } }),
});

const EN_FICHA = { asistencias: 31, adelantos: 20 } as const;

/** La ficha del colaborador con sus últimas asistencias y adelantos, como la devuelve toda herramienta de colaboradores. */
export async function responderColaborador(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<ColaboradorCompletoDto>> {
  const colaborador = await verColaborador(tx, ctx, id);
  if (!colaborador) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
  const asistencias = await ultimasAsistencias(tx, ctx, id, EN_FICHA.asistencias);
  const adelantos = await ultimosAdelantos(tx, ctx, id, EN_FICHA.adelantos, propietarioDe(ctx));
  return exito(aColaboradorCompleto(colaborador, asistencias, adelantos));
}

export async function responderAsistencia(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<AsistenciaDto>> {
  const fila = await verAsistencia(tx, ctx, id);
  if (!fila) throw new Error('La asistencia guardada no se pudo leer.');
  return exito(aAsistenciaDto(fila));
}

export async function responderAdelanto(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<AdelantoDto>> {
  const fila = await verAdelanto(tx, ctx, id, propietarioDe(ctx));
  if (!fila) return rechazo('no_encontrado', NO_EXISTE_ADELANTO);
  return exito(aAdelantoDto(fila));
}

/** Comprueba lo que el colaborador cita del núcleo (solo lo que llega). Devuelve el motivo del rechazo o `null`. */
export async function comprobarReferencias(tx: Transaccion, ctx: ContextoDeHerramienta, r: { sucursalId?: string | null; cuentaId?: string | null }): Promise<string | null> {
  if (r.sucursalId && !(await sucursalVigente(tx, ctx, r.sucursalId))) return 'La sucursal no existe o está archivada.';
  if (r.cuentaId && !(await esMiembro(tx, r.cuentaId))) return 'Esa cuenta no es de una persona de la empresa.';
  return null;
}
