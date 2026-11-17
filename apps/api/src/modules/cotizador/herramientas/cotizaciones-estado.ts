import { formatearSoles, rechazo, type ErrorDeRespuesta } from '@capaz/shared';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta } from '../../../core/herramientas/tipos.js';
import { codigoDeCotizacion, elegirPosiciones, lineaParaEvento } from '../domain/cotizacion.js';
import { comprobarPaso, type EstadoDeCotizacion, type PasoDeCotizacion } from '../domain/estados.js';
import { totalesDe } from '../domain/lineas.js';
import { actualizarCotizacion, verCotizacion, type Cotizacion } from '../repositories/cotizaciones.repository.js';
import { lineasDe, registrarEvento, versionDe, type Version } from '../repositories/versiones.repository.js';
import { MODULO } from './comun.js';
import { alcanceDeCotizaciones, auditarCotizacion, CAMPO_ID, NO_EXISTE, responderCotizacion } from './cotizacion-comun.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import type { ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';

// Los pasos de una cotización ya emitida: enviada, aceptada, rechazada y anulada (crítica). Cada paso deja su fila
// en el historial y, si cambia algo para otros módulos, su evento, en la misma transacción.

type Bloqueada = { ok: true; c: Cotizacion; version: Version; estado: EstadoDeCotizacion; codigo: string } | { ok: false; error: ErrorDeRespuesta };

/** Toma la cotización (bloqueada si `bloquear`) y comprueba que el paso se puede dar desde su estado. */
async function tomarPara(tx: Transaccion, ctx: ContextoDeHerramienta, id: string, paso: PasoDeCotizacion, bloquear = true): Promise<Bloqueada> {
  const c = await verCotizacion(tx, ctx, id, { alcance: alcanceDeCotizaciones(ctx), bloquear });
  if (!c) return rechazo('no_encontrado', NO_EXISTE);
  const estado = c.estado as EstadoDeCotizacion;
  const p = comprobarPaso(estado, paso);
  if (!p.ok) return rechazo('conflicto', p.motivo);
  const version = await versionDe(tx, ctx, c.id, c.versionActual);
  if (!version) throw new Error('La cotización no tiene su versión vigente.');
  return { ok: true, c, version, estado, codigo: codigoDeCotizacion(c.numero, c.anio, c.versionActual) };
}

export const cotizacionMarcarEnviada = definirHerramienta('cotizacion_marcar_enviada', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Marcar una cotización como enviada',
    paraQueSirve: 'Anota que la cotización emitida ya se le entregó al cliente.',
    cuandoUsarla: 'Después de mandarla por WhatsApp, correo o en mano.',
    campos: [CAMPO_ID],
    ejemploTecleado: 'marcar como enviada la cotización de Imprenta Sol',
    ejemploHablado: 'ya le mandé la cotización a Imprenta Sol',
    erroresComunes: ['Solo se marca como enviada una cotización emitida.'],
    relacionadas: ['cotizacion_aceptar', 'cotizacion_rechazar'],
  },
  auditar: auditarCotizacion,
  async ejecutar(args, ctx, tx) {
    const t = await tomarPara(tx, ctx, args.id, 'enviar');
    if (!t.ok) return t;
    await actualizarCotizacion(tx, ctx, t.c.id, { estado: 'enviada' });
    await registrarEvento(tx, ctx, t.c.id, t.version.version, { tipo: 'enviada' });
    return responderCotizacion(tx, ctx, t.c.id);
  },
});

export const cotizacionAceptar = definirHerramienta('cotizacion_aceptar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Aceptar una cotización',
    paraQueSirve: 'Anota que el cliente aceptó. Sin indicar líneas se aceptan todas; en una cotización por opciones hay que indicar cuáles. Avisa al módulo de pedidos para que proponga el pedido.',
    cuandoUsarla: 'Cuando el cliente confirma que va con la cotización.',
    campos: [CAMPO_ID, { nombre: 'posiciones', queSeAnota: 'Posiciones (desde 0) de las líneas aceptadas; opcional salvo en cotizaciones por opciones.', ejemplo: '[0, 2]' }],
    ejemploTecleado: 'el cliente aceptó la cotización de Imprenta Sol',
    ejemploHablado: 'Imprenta Sol aceptó la cotización',
    erroresComunes: ['La cotización ya fue aceptada.', 'Solo se acepta una cotización emitida o enviada.', 'Esta cotización es por opciones: indica cuáles acepta el cliente.'],
    relacionadas: ['cotizacion_rechazar', 'cotizacion_anular'],
  },
  auditar: auditarCotizacion,
  async ejecutar(args, ctx, tx) {
    const t = await tomarPara(tx, ctx, args.id, 'aceptar');
    if (!t.ok) return t;
    const lineas = await lineasDe(tx, ctx, t.version.id);
    const e = elegirPosiciones({ posiciones: args.posiciones, conOpciones: t.version.conOpciones, existentes: lineas.map((l) => l.posicion) });
    if (!e.ok) return rechazo(args.posiciones === undefined ? 'argumentos_invalidos' : 'conflicto', e.motivo);
    const elegidas = lineas.filter((l) => e.posiciones.includes(l.posicion));
    const totales = totalesDe(elegidas);
    await actualizarCotizacion(tx, ctx, t.c.id, { estado: 'aceptada', aceptadaEn: new Date(), lineasAceptadas: e.posiciones, totalAceptadoCentimos: totales.totalCentimos });
    await registrarEvento(tx, ctx, t.c.id, t.version.version, { tipo: 'aceptada', datos: { posiciones: e.posiciones } });
    await emitir(tx, 'cotizacion.aceptada', {
      id: t.c.id,
      codigo: t.codigo,
      version: t.version.version,
      clienteId: t.c.clienteId!,
      igvPorcentaje: t.version.igvPorcentaje,
      ...totales,
      lineas: elegidas.map((l) => lineaParaEvento(l, t.version.igvPorcentaje)),
    });
    return responderCotizacion(tx, ctx, t.c.id);
  },
});

export const cotizacionRechazar = definirHerramienta('cotizacion_rechazar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Rechazar una cotización',
    paraQueSirve: 'Anota que el cliente no aceptó, con el motivo si lo dio. Se puede volver a cotizar con una nueva versión.',
    cuandoUsarla: 'Cuando el cliente dice que no o que ya no lo necesita.',
    campos: [CAMPO_ID, { nombre: 'motivo', queSeAnota: 'Por qué no aceptó (opcional).', ejemplo: 'Encontró un precio menor' }],
    ejemploTecleado: 'Imprenta Sol rechazó la cotización: precio alto',
    ejemploHablado: 'Imprenta Sol no aceptó la cotización, le pareció cara',
    erroresComunes: ['La cotización ya fue rechazada.', 'Solo se rechaza una cotización emitida o enviada.'],
    relacionadas: ['cotizacion_nueva_version', 'cotizacion_aceptar'],
  },
  auditar: auditarCotizacion,
  async ejecutar(args, ctx, tx) {
    const t = await tomarPara(tx, ctx, args.id, 'rechazar');
    if (!t.ok) return t;
    const motivo = args.motivo || null;
    await actualizarCotizacion(tx, ctx, t.c.id, { estado: 'rechazada', motivoRechazo: motivo });
    await registrarEvento(tx, ctx, t.c.id, t.version.version, { tipo: 'rechazada', motivo });
    // La carga del evento no lleva el motivo: es un texto libre del cliente (R13).
    await emitir(tx, 'cotizacion.rechazada', { id: t.c.id, codigo: t.codigo, version: t.version.version, clienteId: t.c.clienteId! });
    return responderCotizacion(tx, ctx, t.c.id);
  },
});

export const cotizacionAnular = definirHerramienta('cotizacion_anular', {
  modulo: MODULO,
  permiso: 'cotizador:emitir',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Anular una cotización',
    paraQueSirve: 'Anula una cotización en cualquier estado (menos una ya anulada) y guarda el motivo. No se borra y, si ya tenía número, lo conserva.',
    cuandoUsarla: 'Cuando la cotización se hizo por error o ya no corresponde, incluso si el cliente la había aceptado.',
    campos: [CAMPO_ID, { nombre: 'motivo', queSeAnota: 'Por qué se anula.', ejemplo: 'Se emitió con el cliente equivocado' }],
    ejemploTecleado: 'anular la cotización COT-2026-0001 porque se emitió al cliente equivocado',
    ejemploHablado: 'anula la cotización uno, era para otro cliente',
    erroresComunes: ['La cotización ya está anulada.', 'La cotización cambió mientras confirmabas: vuelve a pedir la anulación.'],
    relacionadas: ['cotizacion_ver', 'cotizacion_nueva_version'],
  },
  auditar: auditarCotizacion,
  async resumir(args, ctx, tx) {
    const t = await tomarPara(tx, ctx, args.id, 'anular', false);
    if (!t.ok) return t;
    const total = formatearSoles(t.version.totalCentimos);
    const cual = t.c.numero === null ? `el borrador «${t.c.titulo}»` : `la cotización ${t.codigo} (${t.estado})`;
    return {
      ok: true,
      resumen: {
        resumen: `Se anulará ${cual} por ${total}. No se puede deshacer.`,
        huella: hashCanonico({ estado: t.estado, version: t.c.versionActual, totalCentimos: t.version.totalCentimos }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const t = await tomarPara(tx, ctx, args.id, 'anular');
    if (!t.ok) return t;
    await actualizarCotizacion(tx, ctx, t.c.id, { estado: 'anulada', anuladoEn: new Date(), anuladoPor: ctx.usuarioId, motivoAnulacion: args.motivo });
    await registrarEvento(tx, ctx, t.c.id, t.version.version, { tipo: 'anulada', motivo: args.motivo, datos: { estadoAnterior: t.estado } });
    // Solo una cotización que ya tenía número interesa a otros módulos; anular un borrador sin número no emite.
    if (t.c.numero !== null) await emitir(tx, 'cotizacion.anulada', { id: t.c.id, codigo: t.codigo, estadoAnterior: t.estado });
    return responderCotizacion(tx, ctx, t.c.id);
  },
});
