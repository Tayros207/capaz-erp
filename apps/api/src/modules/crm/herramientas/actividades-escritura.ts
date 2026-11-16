import { exito, rechazo } from '@capaz/shared';
import { textoOpcional } from '../../../core/clientes/domain/normalizacion.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { bloquearActividad, insertarActividad, marcarHecha, verActividad } from '../repositories/actividades.repository.js';
import { bloquearOportunidad, tocarOportunidad } from '../repositories/oportunidades.repository.js';
import { MODULO, NO_EXISTE_OPORTUNIDAD, problemaDeReferencias, propios } from './comunes.js';
import { aActividadDto } from './mapeo.js';

// Actividades de seguimiento. Toda escritura marca la oportunidad (`ultima_actividad_en`, regla 5).

const ID_DE_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';
const auditarActividad = (_a: unknown, d: { id: string } | null) => ({ entidadTipo: 'actividad', entidadId: d?.id });

async function actividadDto(tx: Transaccion, ctx: ContextoDeHerramienta, id: string) {
  const fila = await verActividad(tx, ctx, id, false);
  if (!fila) throw new Error('La actividad recién escrita no se pudo releer.');
  return aActividadDto(fila, (await hoyDeLaEmpresa(tx)).dia);
}

export const actividadCrear = definirHerramienta('actividad_crear', {
  modulo: MODULO,
  permiso: 'crm:editar',
  criticidad: 'normal',
  idempotente: true,
  ayuda: {
    titulo: 'Anotar una actividad',
    paraQueSirve: 'Agrega a una oportunidad una llamada, reunión, mensaje, tarea o nota, con fecha de vencimiento si hay que hacerla.',
    cuandoUsarla: 'Cuando quedas en llamar, enviar algo o visitar al cliente.',
    campos: [
      { nombre: 'oportunidadId', queSeAnota: 'La oportunidad.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'tipo', queSeAnota: 'llamada, reunion, mensaje, tarea o nota.', ejemplo: 'llamada' },
      { nombre: 'asunto', queSeAnota: 'Qué hay que hacer, en pocas palabras.', ejemplo: 'Confirmar medidas del banner' },
      { nombre: 'venceEl', queSeAnota: 'Día en que vence (opcional).', ejemplo: '2026-11-20' },
    ],
    ejemploTecleado: 'llamar a Imprenta Sol el 20 para confirmar medidas',
    ejemploHablado: 'recuérdame llamar a Imprenta Sol el veinte para confirmar las medidas',
    erroresComunes: ['La oportunidad no existe o no está a tu cargo.', 'El responsable debe ser una persona de tu empresa.'],
    relacionadas: ['actividad_completar', 'actividades_listar'],
  },
  auditar: auditarActividad,
  async ejecutar(args, ctx, tx) {
    const oportunidad = await bloquearOportunidad(tx, ctx, args.oportunidadId, propios(ctx));
    if (!oportunidad) return NO_EXISTE_OPORTUNIDAD();
    const ref = await problemaDeReferencias(tx, ctx, { responsableId: args.responsableId });
    if (ref) return ref;
    const fila = await insertarActividad(tx, ctx, {
      oportunidadId: oportunidad.id,
      tipo: args.tipo,
      asunto: args.asunto,
      nota: textoOpcional(args.nota),
      venceEl: args.venceEl ?? null,
      responsableId: textoOpcional(args.responsableId),
    });
    await tocarOportunidad(tx, ctx, oportunidad.id);
    return exito(await actividadDto(tx, ctx, fila.id));
  },
});

export const actividadCompletar = definirHerramienta('actividad_completar', {
  modulo: MODULO,
  permiso: 'crm:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Marcar una actividad como hecha',
    paraQueSirve: 'Da por hecha una actividad y, si quieres, anota cómo te fue.',
    cuandoUsarla: 'Después de llamar, reunirte o enviar lo prometido.',
    campos: [
      { nombre: 'id', queSeAnota: 'Identificador de la actividad.', ejemplo: ID_DE_EJEMPLO },
      { nombre: 'nota', queSeAnota: 'Cómo resultó (opcional).', ejemplo: 'Confirmó 3 banners de 2 x 1 m' },
    ],
    ejemploTecleado: 'hecha la llamada a Imprenta Sol: confirmó 3 banners',
    ejemploHablado: 'ya llamé a Imprenta Sol, confirmó tres banners',
    erroresComunes: ['Esa actividad ya está hecha.'],
    relacionadas: ['actividades_listar'],
  },
  auditar: auditarActividad,
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearActividad(tx, ctx, args.id, propios(ctx));
    if (!actual) return rechazo('no_encontrado', 'No existe esa actividad.');
    if (actual.hechaEn) return rechazo('conflicto', 'Esa actividad ya está hecha.');
    await marcarHecha(tx, ctx, actual.id, args.nota === undefined ? undefined : textoOpcional(args.nota));
    await tocarOportunidad(tx, ctx, actual.oportunidadId);
    return exito(await actividadDto(tx, ctx, actual.id));
  },
});
