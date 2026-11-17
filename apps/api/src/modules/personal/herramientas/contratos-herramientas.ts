import { exito, rechazo, type ContratoDeTrabajoDto, type Respuesta, type TipoDeContrato } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { comprobarContrato } from '../domain/vacaciones.js';
import { verColaborador } from '../repositories/colaboradores.repository.js';
import { crearContrato, listarContratos, terminarContrato, verContrato, type Contrato } from '../repositories/contratos.repository.js';
import { COLABORADOR_ID, ID_DE_EJEMPLO, MODULO, NO_EXISTE_COLABORADOR } from './comunes.js';

// Contratos de trabajo. La remuneración es dato sensible: la auditoría guarda ids, tipo y estado, nunca montos.

const NO_EXISTE = 'No existe ese contrato.';
const ID = { nombre: 'id', queSeAnota: 'Identificador del contrato.', ejemplo: ID_DE_EJEMPLO };

export const aContratoDto = (c: Contrato): ContratoDeTrabajoDto => ({
  id: c.id,
  colaboradorId: c.colaboradorId,
  colaboradorNombre: c.colaboradorNombre,
  tipo: c.tipo as TipoDeContrato,
  inicio: c.inicio,
  fin: c.fin,
  remuneracionMensualCentimos: c.remuneracionMensualCentimos,
  jornadaHorasSemana: c.jornadaHorasSemana,
  estado: c.estado as ContratoDeTrabajoDto['estado'],
  terminadoEn: c.terminadoEn,
  motivoTermino: c.motivoTermino,
  creadoEn: c.creadoEn.toISOString(),
});

const auditar = (_a: unknown, d: ContratoDeTrabajoDto | null) => ({ entidadTipo: 'contrato_de_trabajo', entidadId: d?.id, ...(d && { resumen: { tipo: d.tipo, estado: d.estado } }) });

async function responder(tx: Transaccion, ctx: ContextoDeHerramienta, id: string): Promise<Respuesta<ContratoDeTrabajoDto>> {
  const c = await verContrato(tx, ctx, id);
  return c ? exito(aContratoDto(c)) : rechazo('no_encontrado', NO_EXISTE);
}

export const contratoCrear = definirHerramienta('contrato_crear', {
  modulo: MODULO,
  permiso: 'personal:contratos',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Registrar un contrato de trabajo',
    paraQueSirve: 'Anota el vínculo de un colaborador con la empresa: tipo de contrato, fechas, remuneración mensual y jornada. Solo puede haber un contrato vigente por colaborador.',
    cuandoUsarla: 'Cuando alguien ingresa, cambia de condiciones o se renueva su contrato.',
    campos: [
      COLABORADOR_ID,
      { nombre: 'tipo', queSeAnota: 'indeterminado, plazo_fijo, locacion o practicas.', ejemplo: 'plazo_fijo' },
      { nombre: 'inicio', queSeAnota: 'Primer día del contrato (AAAA-MM-DD).', ejemplo: '2026-03-01' },
      { nombre: 'fin', queSeAnota: 'Último día; obligatorio en plazo fijo y prácticas.', ejemplo: '2026-08-31' },
      { nombre: 'remuneracionMensualCentimos', queSeAnota: 'Remuneración mensual en céntimos.', ejemplo: '150000' },
    ],
    ejemploTecleado: 'contrato a plazo fijo para Luis Paz del 1 de marzo al 31 de agosto, 1500 soles al mes',
    ejemploHablado: 'registra el contrato de Luis Paz por seis meses con mil quinientos soles',
    erroresComunes: ['Ese colaborador ya tiene un contrato vigente: termínalo antes de registrar otro.', 'Un plazo fijo o unas prácticas necesitan fecha de fin.', 'El fin no puede ser anterior al inicio.'],
    relacionadas: ['contrato_terminar', 'contratos_listar', 'colaborador_ver'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const colaborador = await verColaborador(tx, ctx, args.colaboradorId);
    if (!colaborador) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
    if (colaborador.archivadoEn) return rechazo('conflicto', 'El colaborador está archivado: restáuralo para registrarle un contrato.');
    const fin = args.fin ?? null;
    const c = comprobarContrato({ tipo: args.tipo, inicio: args.inicio, fin });
    if (!c.ok) return rechazo('argumentos_invalidos', c.motivo);
    const id = await crearContrato(tx, ctx, { colaboradorId: args.colaboradorId, tipo: args.tipo, inicio: args.inicio, fin, remuneracionMensualCentimos: args.remuneracionMensualCentimos, jornadaHorasSemana: args.jornadaHorasSemana });
    if (!id) return rechazo('conflicto', 'Ese colaborador ya tiene un contrato vigente: termínalo antes de registrar otro.');
    return responder(tx, ctx, id);
  },
});

export const contratoTerminar = definirHerramienta('contrato_terminar', {
  modulo: MODULO,
  permiso: 'personal:contratos',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Terminar un contrato de trabajo',
    paraQueSirve: 'Cierra el contrato vigente con su fecha y motivo. Queda en el historial del colaborador.',
    cuandoUsarla: 'Cuando el vínculo termina o va a ser reemplazado por otro contrato.',
    campos: [ID, { nombre: 'fecha', queSeAnota: 'Día en que termina (por defecto, hoy).', ejemplo: '2026-08-31' }, { nombre: 'motivo', queSeAnota: 'Por qué termina.', ejemplo: 'Fin del plazo' }],
    ejemploTecleado: 'terminar el contrato de Luis Paz, fin del plazo',
    ejemploHablado: 'cierra el contrato de Luis Paz, se acabó el plazo',
    erroresComunes: ['Solo se termina un contrato vigente.', 'Indica el motivo.', 'La fecha de término no puede ser anterior al inicio del contrato.'],
    relacionadas: ['contrato_crear', 'contratos_listar'],
  },
  auditar,
  async ejecutar(args, ctx, tx) {
    const c = await verContrato(tx, ctx, args.id, { bloquear: true });
    if (!c) return rechazo('no_encontrado', NO_EXISTE);
    if (c.estado !== 'vigente') return rechazo('conflicto', 'Solo se termina un contrato vigente.');
    const fecha = args.fecha ?? (await hoyDeLaEmpresa(tx)).dia;
    if (fecha < c.inicio) return rechazo('argumentos_invalidos', 'La fecha de término no puede ser anterior al inicio del contrato.');
    await terminarContrato(tx, ctx, c.id, fecha, args.motivo);
    return responder(tx, ctx, c.id);
  },
});

export const contratosListar = definirHerramienta('contratos_listar', {
  modulo: MODULO,
  permiso: 'personal:contratos',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar los contratos de trabajo',
    paraQueSirve: 'Muestra los contratos, los más recientes primero y por páginas. Por defecto, los vigentes; se puede filtrar por colaborador.',
    cuandoUsarla: 'Para ver quién tiene contrato vigente o el historial de un colaborador.',
    campos: [{ nombre: 'estado', queSeAnota: 'vigentes, terminados o todos.', ejemplo: 'vigentes' }, { nombre: 'colaboradorId', queSeAnota: 'Solo de este colaborador (opcional).', ejemplo: ID_DE_EJEMPLO }],
    ejemploTecleado: 'contratos vigentes',
    ejemploHablado: 'quién tiene contrato vigente',
    erroresComunes: ['Los contratos llevan la remuneración: solo los ven quienes tienen el permiso de contratos.'],
    relacionadas: ['contrato_crear', 'contrato_terminar'],
  },
  async ejecutar(args, ctx, tx) {
    const r = await listarContratos(tx, ctx, { limite: args.limite, cursor: args.cursor, estado: args.estado, colaboradorId: args.colaboradorId });
    if (r === 'cursor_invalido') return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    return exito({ items: r.items.map(aContratoDto), siguiente: r.siguiente });
  },
});
