import { NOMBRE_DE_ESTADO_DE_ASISTENCIA, exito, rechazo, type EstadoDeAsistencia } from '@capaz/shared';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { aplicarCorreccion, aplicarMarca, comprobarCorreccion, type AsistenciaDeDia } from '../domain/asistencia.js';
import { decodificarCursorPorFecha } from '../domain/cursor.js';
import { asistenciaDelDia, guardarAsistencia, listarAsistencias } from '../repositories/asistencias.repository.js';
import { verColaborador } from '../repositories/colaboradores.repository.js';
import { COLABORADOR_ID, MODULO, NO_EXISTE_COLABORADOR, auditarAsistencia, responderAsistencia } from './comunes.js';
import { aAsistenciaDto } from './mapeo.js';

// Asistencia diaria: la marca el encargado (P3-7). La hora la pone el servidor.

type Fila = NonNullable<Awaited<ReturnType<typeof asistenciaDelDia>>>;
const aDelDia = (f: Fila | null): AsistenciaDeDia | null => (f ? { estado: f.estado as EstadoDeAsistencia, entrada: f.entrada, salida: f.salida, nota: f.nota } : null);

export const asistenciaMarcar = definirHerramienta('asistencia_marcar', {
  modulo: MODULO,
  permiso: 'personal:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Marcar la asistencia de hoy',
    paraQueSirve: 'Anota cómo está hoy un colaborador: presente, tardanza, falta, permiso o descanso. También marca la hora de entrada y de salida.',
    cuandoUsarla: 'Cada día, al llegar el equipo y al terminar la jornada. Para un día pasado se usa asistencia_corregir.',
    campos: [
      COLABORADOR_ID,
      { nombre: 'estado', queSeAnota: 'presente, tardanza, falta, permiso o descanso (opcional si marcas entrada o salida).', ejemplo: 'tardanza' },
      { nombre: 'entrada', queSeAnota: 'true para marcar la hora de entrada ahora (opcional).', ejemplo: 'true' },
      { nombre: 'salida', queSeAnota: 'true para marcar la hora de salida ahora (opcional).', ejemplo: 'true' },
      { nombre: 'nota', queSeAnota: 'Comentario breve (opcional).', ejemplo: 'Llegó 20 minutos tarde' },
    ],
    ejemploTecleado: 'Rosa Mamani llegó hoy, tardanza',
    ejemploHablado: 'marca que Rosa llegó tarde',
    erroresComunes: ['Ya se marcó la entrada o la salida de hoy.', 'La salida necesita primero la entrada.', 'Una falta, un permiso o un descanso no llevan hora.', 'El colaborador está archivado.'],
    relacionadas: ['asistencias_listar', 'asistencia_corregir', 'colaboradores_listar'],
  },
  auditar: auditarAsistencia,
  async ejecutar(args, ctx, tx) {
    const colaborador = await verColaborador(tx, ctx, args.colaboradorId);
    if (!colaborador) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
    if (colaborador.archivadoEn) return rechazo('conflicto', 'El colaborador está archivado.');
    const hoy = await hoyDeLaEmpresa(tx);
    const actual = await asistenciaDelDia(tx, ctx, colaborador.id, hoy.dia, { bloquear: true });
    const r = aplicarMarca(aDelDia(actual), { estado: args.estado, entrada: args.entrada, salida: args.salida, nota: args.nota }, new Date());
    if (!r.ok) return rechazo('conflicto', r.motivo);
    const id = await guardarAsistencia(tx, ctx, colaborador.id, hoy.dia, r.asistencia);
    return responderAsistencia(tx, ctx, id);
  },
});

const huellaDe = (f: AsistenciaDeDia | null) => hashCanonico({ estado: f?.estado ?? null, entrada: f?.entrada?.toISOString() ?? null, salida: f?.salida?.toISOString() ?? null });

export const asistenciaCorregir = definirHerramienta('asistencia_corregir', {
  modulo: MODULO,
  permiso: 'personal:editar',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Corregir la asistencia de un día pasado',
    paraQueSirve: 'Cambia el estado de asistencia de un día que ya pasó (o lo crea si nadie lo marcó) y deja el motivo anotado.',
    cuandoUsarla: 'Cuando se marcó mal un día anterior o se olvidó marcarlo. La asistencia de hoy se marca, no se corrige.',
    campos: [
      COLABORADOR_ID,
      { nombre: 'fecha', queSeAnota: 'Día a corregir (AAAA-MM-DD), anterior a hoy.', ejemplo: '2026-03-09' },
      { nombre: 'estado', queSeAnota: 'presente, tardanza, falta, permiso o descanso.', ejemplo: 'permiso' },
      { nombre: 'motivo', queSeAnota: 'Por qué se corrige.', ejemplo: 'Presentó su cita médica' },
    ],
    ejemploTecleado: 'corregir la asistencia de Rosa del 9 de marzo a permiso: presentó su cita médica',
    ejemploHablado: 'el nueve Rosa tenía permiso, corrígelo',
    erroresComunes: ['La asistencia de hoy se marca, no se corrige.', 'No se puede registrar un día futuro.', 'El día cambió mientras confirmabas: vuelve a pedir la corrección.'],
    relacionadas: ['asistencia_marcar', 'asistencias_listar'],
  },
  auditar: auditarAsistencia,
  async resumir(args, ctx, tx) {
    const colaborador = await verColaborador(tx, ctx, args.colaboradorId);
    if (!colaborador) return { ok: false, error: { codigo: 'no_encontrado', mensaje: NO_EXISTE_COLABORADOR } };
    const hoy = await hoyDeLaEmpresa(tx);
    const regla = comprobarCorreccion(args.fecha, hoy.dia);
    if (!regla.ok) return { ok: false, error: { codigo: 'conflicto', mensaje: regla.motivo } };
    const actual = aDelDia(await asistenciaDelDia(tx, ctx, colaborador.id, args.fecha));
    const de = actual ? NOMBRE_DE_ESTADO_DE_ASISTENCIA[actual.estado].toLowerCase() : 'sin marca';
    return {
      ok: true,
      resumen: {
        resumen: `Se cambiará la asistencia del ${args.fecha} de «${de}» a «${NOMBRE_DE_ESTADO_DE_ASISTENCIA[args.estado].toLowerCase()}».`,
        huella: huellaDe(actual),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const colaborador = await verColaborador(tx, ctx, args.colaboradorId);
    if (!colaborador) return rechazo('no_encontrado', NO_EXISTE_COLABORADOR);
    const hoy = await hoyDeLaEmpresa(tx);
    const regla = comprobarCorreccion(args.fecha, hoy.dia);
    if (!regla.ok) return rechazo('conflicto', regla.motivo);
    const actual = aDelDia(await asistenciaDelDia(tx, ctx, colaborador.id, args.fecha, { bloquear: true }));
    const id = await guardarAsistencia(tx, ctx, colaborador.id, args.fecha, aplicarCorreccion(actual, args.estado, args.motivo));
    return responderAsistencia(tx, ctx, id);
  },
});

export const asistenciasListar = definirHerramienta('asistencias_listar', {
  modulo: MODULO,
  permiso: 'personal:ver',
  criticidad: 'lectura',
  ayuda: {
    titulo: 'Listar asistencias',
    paraQueSirve: 'Muestra las asistencias marcadas de un día o de un rango de días, de la más reciente a la más antigua. Solo aparecen quienes tienen marca.',
    cuandoUsarla: 'Cuando quieres ver quién vino hoy, quién faltó esta semana o cómo viene una persona.',
    campos: [
      { nombre: 'desde', queSeAnota: 'Primer día (o el único, si no indicas hasta).', ejemplo: '2026-03-10' },
      { nombre: 'hasta', queSeAnota: 'Último día del rango (opcional).', ejemplo: '2026-03-16' },
      { nombre: 'colaboradorId', queSeAnota: 'Solo las de esa persona (opcional).', ejemplo: '0192f0c4-7b1e-7000-8000-000000000001' },
    ],
    ejemploTecleado: 'asistencia de hoy',
    ejemploHablado: 'quién vino hoy',
    erroresComunes: ['El período empieza antes de terminar.', 'El cursor de la página no es válido: vuelve a empezar desde la primera.'],
    relacionadas: ['asistencia_marcar', 'colaboradores_listar'],
  },
  async ejecutar(args, ctx, tx) {
    const cursor = args.cursor === undefined ? null : decodificarCursorPorFecha(args.cursor);
    if (args.cursor !== undefined && !cursor) return rechazo('argumentos_invalidos', 'El cursor no es válido.');
    const r = await listarAsistencias(tx, ctx, { limite: args.limite, cursor, desde: args.desde, hasta: args.hasta, colaboradorId: args.colaboradorId });
    return exito({ items: r.items.map(aAsistenciaDto), siguiente: r.siguiente });
  },
});
