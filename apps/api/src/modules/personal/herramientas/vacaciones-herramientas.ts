import { exito, rechazo, type EstadoDeVacaciones, type Respuesta, type VacacionesDto } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { diasInclusive, saldoDeVacaciones, seSolapan } from '../domain/vacaciones.js';
import { verColaborador } from '../repositories/colaboradores.repository.js';
import { cambiarEstadoDeVacaciones, crearVacaciones, diasDeVacaciones, listarVacaciones, rangosOcupados, verVacaciones, type Vacaciones } from '../repositories/contratos.repository.js';
import { COLABORADOR_ID, ID_DE_EJEMPLO, MODULO, NO_EXISTE_COLABORADOR } from './comunes.js';

// Solicitudes de vacaciones. Datos personales: la auditoría y los eventos llevan ids y estados, nunca nombres ni motivos.

const NO_EXISTE = 'No existe esa solicitud de vacaciones.';
const ID = { nombre: 'id', queSeAnota: 'Identificador de la solicitud de vacaciones.', ejemplo: ID_DE_EJEMPLO };

export const aVacacionesDto = (v: Vacaciones): VacacionesDto => ({
  id: v.id,
  colaboradorId: v.colaboradorId,
  colaboradorNombre: v.colaboradorNombre,
  desde: v.desde,
  hasta: v.hasta,
  dias: v.dias,
  estado: v.estado as EstadoDeVacaciones,
  motivo: v.motivo,
  resueltoPor: v.resueltoPor,
  resueltoEn: v.resueltoEn?.toISOString() ?? null,
  motivoResolucion: v.motivoResolucion,
  creadoEn: v.creadoEn.toISOString(),
});

const auditar = (_a: unknown, d: VacacionesDto | null) => ({ entidadTipo: 'vacaciones', entidadId: d?.id, ...(d && { resumen: { estado: d.estado, dias: d.dias } }) });

async function responder(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<VacacionesDto>> {
  const v = await verVacaciones(tx, ctx, id);
  return v ? exito(aVacacionesDto(v)) : rechazo('no_encontrado', NO_EXISTE);
}

export const vacacionesSolicitar = definirHerramienta('vacaciones_solicitar', {
  modulo: MODULO,
  permiso: 'personal:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Solicitar vacaciones',
    paraQueSirve: 'Registra una solicitud de vacaciones de un colaborador entre dos fechas (días corridos). Queda pendiente hasta que alguien con permiso la apruebe; no puede cruzarse con otras vacaciones del mismo colaborador.',
    cuandoUsarla: 'Cuando un colaborador pide días de descanso.',
    campos: [COLABORADOR_ID, { nombre: 'desde', queSeAnota: 'Primer día (AAAA-MM-DD).', ejemplo: '2026-07-01' }, { nombre: 'hasta', queSeAnota: 'Último día, incluido.', ejemplo: '2026-07-15' }, { nombre: 'motivo', queSeAnota: 'Nota (opcional).', ejemplo: 'Viaje familiar' }],
    ejemploTecleado: 'vacaciones de Luis Paz del 1 al 15 de julio',
    ejemploHablado: 'Luis Paz pide vacaciones del primero al quince de julio',
    erroresComunes: ['La fecha final no puede ser anterior a la inicial.', 'Esas fechas se cruzan con otras vacaciones del colaborador.', 'El colaborador está archivado.'],
    relacionadas: ['vacaciones_resolver', 'vacaciones_saldo', 'vacaciones_listar'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const colaborador = await verColaborador(tx, ctx, args.colaboradorId);
    if (!colaborador) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
    if (colaborador.archivadoEn) return rechazo('conflicto', 'El colaborador está archivado.');
    if (args.hasta < args.desde) return rechazo('argumentos_invalidos', 'La fecha final no puede ser anterior a la inicial.');
    if ((await rangosOcupados(tx, ctx, args.colaboradorId)).some((r) => seSolapan(r, args))) return rechazo('conflicto', 'Esas fechas se cruzan con otras vacaciones del colaborador.');
    const id = await crearVacaciones(tx, ctx, { colaboradorId: args.colaboradorId, desde: args.desde, hasta: args.hasta, dias: diasInclusive(args.desde, args.hasta), motivo: args.motivo || null });
    return responder(tx, ctx, id);
  },
});

export const vacacionesResolver = definirHerramienta('vacaciones_resolver', {
  modulo: MODULO,
  permiso: 'personal:aprobar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Aprobar o rechazar vacaciones',
    paraQueSirve: 'Resuelve una solicitud pendiente. Al aprobarla, sus días se descuentan del saldo; si se rechaza, hay que decir el motivo.',
    cuandoUsarla: 'Cuando quien autoriza revisa las solicitudes de vacaciones.',
    campos: [ID, { nombre: 'decision', queSeAnota: 'aprobar o rechazar.', ejemplo: 'aprobar' }, { nombre: 'motivo', queSeAnota: 'Por qué se rechaza (obligatorio al rechazar).', ejemplo: 'Cierre de mes' }],
    ejemploTecleado: 'aprobar las vacaciones de Luis Paz',
    ejemploHablado: 'aprueba las vacaciones de Luis Paz',
    erroresComunes: ['Solo se resuelve una solicitud pendiente.', 'Indica el motivo del rechazo.', 'No tienes permiso para aprobar vacaciones.'],
    relacionadas: ['vacaciones_solicitar', 'vacaciones_saldo'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const v = await verVacaciones(tx, ctx, args.id, { bloquear: true });
    if (!v) return rechazo('no_encontrado', NO_EXISTE);
    if (v.estado !== 'solicitada') return rechazo('conflicto', 'Solo se resuelve una solicitud pendiente.');
    await cambiarEstadoDeVacaciones(tx, ctx, v.id, { estado: args.decision === 'aprobar' ? 'aprobada' : 'rechazada', resuelta: true, resueltoPor: ctx.usuarioId, motivoResolucion: args.motivo || null });
    await emitir(tx, 'vacaciones.resuelta', { id: v.id, decision: args.decision });
    return responder(tx, ctx, v.id);
  },
});

export const vacacionesAnular = definirHerramienta('vacaciones_anular', {
  modulo: MODULO,
  permiso: 'personal:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Anular unas vacaciones',
    paraQueSirve: 'Descarta una solicitud pendiente o unas vacaciones aprobadas que no se tomarán; los días vuelven al saldo.',
    cuandoUsarla: 'Cuando el colaborador desiste o cambia de fechas.',
    campos: [ID, { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'Cambio de fechas' }],
    ejemploTecleado: 'anular las vacaciones de Luis Paz, cambia de fechas',
    ejemploHablado: 'anula esas vacaciones',
    erroresComunes: ['Solo se anula una solicitud pendiente o aprobada.', 'Indica el motivo.'],
    relacionadas: ['vacaciones_solicitar', 'vacaciones_saldo'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const v = await verVacaciones(tx, ctx, args.id, { bloquear: true });
    if (!v) return rechazo('no_encontrado', NO_EXISTE);
    if (v.estado !== 'solicitada' && v.estado !== 'aprobada') return rechazo('conflicto', 'Solo se anula una solicitud pendiente o aprobada.');
    await cambiarEstadoDeVacaciones(tx, ctx, v.id, { estado: 'anulada', motivoResolucion: args.motivo });
    return responder(tx, ctx, v.id);
  },
});

export const vacacionesListar = definirHerramienta('vacaciones_listar', {
  modulo: MODULO,
  permiso: 'personal:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar las solicitudes de vacaciones',
    paraQueSirve: 'Muestra las solicitudes, las más recientes primero y por páginas. Por defecto, las pendientes de aprobar.',
    cuandoUsarla: 'Para ver quién espera aprobación o quién está de vacaciones.',
    campos: [{ nombre: 'estado', queSeAnota: 'abiertas (pendientes), solicitada, aprobada, rechazada, anulada o todas.', ejemplo: 'aprobada' }, { nombre: 'colaboradorId', queSeAnota: 'Solo de este colaborador (opcional).', ejemplo: ID_DE_EJEMPLO }],
    ejemploTecleado: 'vacaciones pendientes de aprobar',
    ejemploHablado: 'qué vacaciones esperan aprobación',
    erroresComunes: ['El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['vacaciones_resolver', 'vacaciones_saldo'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarVacaciones(tx, ctx, { limite: args.limite, cursor: args.cursor, estado: args.estado, colaboradorId: args.colaboradorId });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    return exito({ items: r.items.map(aVacacionesDto), siguiente: r.siguiente });
  },
});

export const vacacionesSaldo = definirHerramienta('vacaciones_saldo', {
  modulo: MODULO,
  permiso: 'personal:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Ver el saldo de vacaciones',
    paraQueSirve: 'Calcula los días devengados por antigüedad (30 al año, 2,5 por mes completo), los ya aprobados, los pendientes de aprobar y el saldo. Es una referencia; no reemplaza el cálculo laboral oficial.',
    cuandoUsarla: 'Antes de aprobar unas vacaciones o para planificar descansos.',
    campos: [COLABORADOR_ID, { nombre: 'fecha', queSeAnota: 'Día de corte (por defecto, hoy).', ejemplo: '2026-07-01' }],
    ejemploTecleado: 'saldo de vacaciones de Luis Paz',
    ejemploHablado: 'cuántos días de vacaciones le quedan a Luis Paz',
    erroresComunes: ['Sin fecha de ingreso en la ficha del colaborador no hay días devengados.'],
    relacionadas: ['vacaciones_solicitar', 'colaborador_editar'],
  },
  async ejecutar(args, ctx, tx) {
    const colaborador = await verColaborador(tx, ctx, args.colaboradorId);
    if (!colaborador) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
    const corte = args.fecha ?? (await hoyDeLaEmpresa(tx)).dia;
    const dias = await diasDeVacaciones(tx, ctx, args.colaboradorId);
    const s = saldoDeVacaciones({ fechaIngreso: colaborador.fechaIngreso, corte, aprobadasDias: dias.aprobadas, solicitadasDias: dias.solicitadas });
    return exito({ colaboradorId: args.colaboradorId, fechaIngreso: colaborador.fechaIngreso, corte, ...s });
  },
});
