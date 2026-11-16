import { exito } from '@capaz/shared';
import { emitir } from '../../../core/eventos/emisor.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { primeraAbierta } from '../domain/etapas.js';
import { codigoDeOportunidad, problemaParaCerrar, problemaParaReabrir, type EstadoDeOportunidad } from '../domain/oportunidad.js';
import { asegurarCatalogos, comoViva, etapaDeCierre, listarEtapas } from '../repositories/etapas.repository.js';
import { actualizarOportunidad, bloquearOportunidad, type Oportunidad } from '../repositories/oportunidades.repository.js';
import { auditarOportunidad, desdeProblema, MODULO, NO_EXISTE_OPORTUNIDAD, oportunidadDto, propios, type Rechazo } from './comunes.js';

// Cierre y reapertura (FICHAS-OLA-2 §5.2 regla 4): mueven a la etapa de cierre, fijan `estado` y `cerrada_en`.

const ID_DE_EJEMPLO = '0192f0c4-7b1e-7000-8000-000000000001';
const campoId = { nombre: 'id', queSeAnota: 'Identificador de la oportunidad.', ejemplo: ID_DE_EJEMPLO };

/** Bloquea la oportunidad a su alcance y la cierra como `tipo`. Devuelve la fila anterior o el rechazo. */
async function cerrar(
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  id: string,
  tipo: 'ganada' | 'perdida',
  motivo: string | null,
): Promise<{ rechazo: Rechazo } | { actual: Oportunidad }> {
  const actual = await bloquearOportunidad(tx, ctx, id, propios(ctx));
  if (!actual) return { rechazo: NO_EXISTE_OPORTUNIDAD() };
  const p = problemaParaCerrar(actual.estado as EstadoDeOportunidad);
  if (p) return { rechazo: desdeProblema(p) };
  await asegurarCatalogos(tx, ctx);
  const etapa = await etapaDeCierre(tx, ctx, tipo);
  if (!etapa) throw new Error(`Falta la etapa de cierre «${tipo}».`);
  await actualizarOportunidad(tx, ctx, id, { etapaId: etapa.id, estado: tipo, motivoPerdida: motivo, cerrada: true });
  return { actual };
}

export const oportunidadGanar = definirHerramienta('oportunidad_ganar', {
  modulo: MODULO,
  permiso: 'crm:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Marcar una oportunidad como ganada',
    paraQueSirve: 'Cierra la oportunidad como venta lograda y la pasa a la etapa de cierre ganada.',
    cuandoUsarla: 'Cuando el cliente aceptó y el trabajo va.',
    campos: [campoId],
    ejemploTecleado: 'ganada la OPO-2026-0001',
    ejemploHablado: 'ganamos la oportunidad uno',
    erroresComunes: ['La oportunidad ya está cerrada: reábrela primero.'],
    relacionadas: ['oportunidad_reabrir', 'oportunidad_perder'],
  },
  auditar: auditarOportunidad,
  async ejecutar(args, ctx, tx) {
    const r = await cerrar(tx, ctx, args.id, 'ganada', null);
    if ('rechazo' in r) return r.rechazo;
    const { actual: o } = r;
    const codigo = codigoDeOportunidad(o.anio, o.numero);
    await emitir(tx, 'oportunidad.ganada', { id: o.id, codigo, titulo: o.titulo, clienteId: o.clienteId, montoEstimadoCentimos: o.montoEstimadoCentimos });
    return exito(await oportunidadDto(tx, ctx, o.id));
  },
});

export const oportunidadPerder = definirHerramienta('oportunidad_perder', {
  modulo: MODULO,
  permiso: 'crm:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Marcar una oportunidad como perdida',
    paraQueSirve: 'Cierra la oportunidad como venta no lograda, con el motivo, y la pasa a la etapa de cierre perdida.',
    cuandoUsarla: 'Cuando el cliente dijo que no o dejó de responder.',
    campos: [campoId, { nombre: 'motivo', queSeAnota: 'Por qué se perdió, hasta 300 letras.', ejemplo: 'Eligió otro proveedor por precio' }],
    ejemploTecleado: 'perdida la OPO-2026-0001 porque eligió otro proveedor',
    ejemploHablado: 'perdimos la oportunidad uno, se fue con otro proveedor',
    erroresComunes: ['Falta el motivo.', 'La oportunidad ya está cerrada: reábrela primero.'],
    relacionadas: ['oportunidad_reabrir', 'oportunidad_ganar'],
  },
  auditar: auditarOportunidad,
  async ejecutar(args, ctx, tx) {
    const r = await cerrar(tx, ctx, args.id, 'perdida', args.motivo);
    if ('rechazo' in r) return r.rechazo;
    const { actual: o } = r;
    await emitir(tx, 'oportunidad.perdida', { id: o.id, codigo: codigoDeOportunidad(o.anio, o.numero), clienteId: o.clienteId });
    return exito(await oportunidadDto(tx, ctx, o.id));
  },
});

export const oportunidadReabrir = definirHerramienta('oportunidad_reabrir', {
  modulo: MODULO,
  permiso: 'crm:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Reabrir una oportunidad',
    paraQueSirve: 'Vuelve a abrir una oportunidad ganada o perdida: entra en la primera etapa abierta y se borra el motivo de pérdida.',
    cuandoUsarla: 'Cuando se cerró por error o el cliente volvió a escribir.',
    campos: [campoId],
    ejemploTecleado: 'reabrir la OPO-2026-0001',
    ejemploHablado: 'vuelve a abrir la oportunidad uno',
    erroresComunes: ['La oportunidad ya está abierta.'],
    relacionadas: ['oportunidad_mover'],
  },
  auditar: auditarOportunidad,
  async ejecutar(args, ctx, tx) {
    const actual = await bloquearOportunidad(tx, ctx, args.id, propios(ctx));
    if (!actual) return NO_EXISTE_OPORTUNIDAD();
    const p = problemaParaReabrir(actual.estado as EstadoDeOportunidad);
    if (p) return desdeProblema(p);
    await asegurarCatalogos(tx, ctx);
    const primera = primeraAbierta((await listarEtapas(tx, ctx)).map(comoViva));
    if (!primera) throw new Error('No hay etapas abiertas para reabrir.');
    await actualizarOportunidad(tx, ctx, actual.id, { etapaId: primera.id, estado: 'abierta', motivoPerdida: null, cerrada: false });
    return exito(await oportunidadDto(tx, ctx, actual.id));
  },
});
