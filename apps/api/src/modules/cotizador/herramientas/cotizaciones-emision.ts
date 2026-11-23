import { formatearSoles, MENSAJE_DE_MOTIVO_REQUERIDO, PREFIJO_DE_PRECIOS_CAMBIARON, rechazo, type CondicionesDeCotizacion, type ErrorDeRespuesta } from '@capaz/shared';
import { siguienteNumero } from '../../../core/correlativos/siguiente-numero.js';
import { hoyDeLaEmpresa } from '../../../core/empresas/hoy.js';
import { emitir } from '../../../core/eventos/emisor.js';
import { hashCanonico } from '../../../core/herramientas/confirmacion.js';
import { definirHerramienta, type ContextoDeHerramienta } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { CONFIGURACION_POR_DEFECTO } from '../domain/configuracion.js';
import { CLAVE_DE_CORRELATIVO, codigoDeCotizacion, fusionarCondiciones, sumarDias } from '../domain/cotizacion.js';
import { comprobarPaso, type EstadoDeCotizacion } from '../domain/estados.js';
import { conFotoDeLista } from '../domain/lineas.js';
import { margenBajoElMinimo, margenDe } from '../domain/margen.js';
import { leerConfiguracion } from '../repositories/configuracion.repository.js';
import { actualizarCotizacion, clienteVigente, crearCotizacion, verCotizacion, type Cotizacion } from '../repositories/cotizaciones.repository.js';
import { actualizarVersion, copiarLineas, crearVersion, lineasDe, marcarVersionEmitida, registrarEvento, reemplazarLineas, versionDe, type Version } from '../repositories/versiones.repository.js';
import { MODULO } from './comun.js';
import { copiarCuadroSiAplica, emitirCuadro, prepararCuadroParaEmitir, type CuadroPorEmitir } from './cuadro-emision.js';
import { alcanceDeCotizaciones, auditarCotizacion, CAMPO_ID, NO_EXISTE, responderCotizacion, type Calculo } from './cotizacion-comun.js';
import { datosConPreciosDeHoy, preciosDeHoy } from './cotizacion-precios.js';

// Emitir (crítica: da el número y congela la versión), nueva versión y duplicar.

type Preparada =
  | { ok: true; c: Cotizacion; version: Version; lineas: number; clienteNombre: string; condicionesDeEmpresa: CondicionesDeCotizacion; margenBajo: boolean; totales: { subtotalCentimos: number; totalCentimos: number }; cuadro: CuadroPorEmitir | null; precios: Calculo | null; avisos: string[] }
  | { ok: false; error: ErrorDeRespuesta };

/** Lo que exige emitir; lo comparten `resumir` (antes de confirmar) y `ejecutar`. Solo lee. */
async function prepararEmision(tx: Transaccion, ctx: ContextoDeHerramienta, id: string, args: { motivoMargenBajo?: string | undefined; aceptarPreciosDeHoy?: boolean | undefined }, bloquear: boolean): Promise<Preparada> {
  const c = await verCotizacion(tx, ctx, id, { alcance: alcanceDeCotizaciones(ctx), bloquear });
  if (!c) return rechazo('no_encontrado', NO_EXISTE);
  const paso = comprobarPaso(c.estado as EstadoDeCotizacion, 'emitir');
  if (!paso.ok) return rechazo('conflicto', paso.motivo);
  const version = await versionDe(tx, ctx, c.id, c.versionActual);
  if (!version) throw new Error('La cotización no tiene su versión vigente.');
  // Por partes: se valida el cuadro entero y las líneas salen de él (se generan al emitir); si no, ya están guardadas.
  const porEmitir = version.modo === 'cuadro' ? await prepararCuadroParaEmitir(tx, ctx, version) : null;
  if (porEmitir && !porEmitir.ok) return porEmitir;
  const cuadro = porEmitir?.valor ?? null;
  const guardadas = cuadro ? [] : await lineasDe(tx, ctx, version.id);
  const lineas = cuadro ? cuadro.emision.lineas.length : guardadas.length;
  if (lineas === 0) return rechazo('conflicto', 'Agrega al menos una línea antes de emitir la cotización.');
  if (!c.clienteId) return rechazo('conflicto', 'Elige el cliente antes de emitir la cotización.');
  const cliente = await clienteVigente(tx, ctx, c.clienteId);
  if (!cliente) return rechazo('conflicto', 'El cliente no existe o está archivado.');
  // Precios al día: si la lista cambió desde que se armó, no se emite sin que la persona lo acepte.
  const hoy = await preciosDeHoy(tx, ctx, version, c.clienteId, guardadas);
  if (hoy.calculo && hoy.avisos.length > 0 && !args.aceptarPreciosDeHoy) {
    return rechazo('conflicto', `${PREFIJO_DE_PRECIOS_CAMBIARON} ${hoy.avisos.join('. ')}. Acepta los precios de hoy para emitirla.`);
  }
  const config = await leerConfiguracion(tx, ctx);
  const umbral = config?.umbralMinimoPct ?? CONFIGURACION_POR_DEFECTO.umbralMinimoPct;
  const precios = hoy.calculo;
  const margenPct = precios ? margenDe(precios.totales.subtotalCentimos, version.costoCentimos) : version.margenPct;
  const margenBajo = cuadro ? cuadro.emision.hayRojo : margenPct !== null && margenBajoElMinimo(margenPct, umbral);
  if (margenBajo && !args.motivoMargenBajo) return rechazo('conflicto', MENSAJE_DE_MOTIVO_REQUERIDO);
  const totales = cuadro ? cuadro.emision.totales : (precios?.totales ?? version);
  const condicionesDeEmpresa = (config?.condiciones as CondicionesDeCotizacion | undefined) ?? CONFIGURACION_POR_DEFECTO.condiciones;
  return { ok: true, c, version, lineas, clienteNombre: cliente.nombre, condicionesDeEmpresa, margenBajo, totales: { subtotalCentimos: totales.subtotalCentimos, totalCentimos: totales.totalCentimos }, cuadro, precios, avisos: hoy.calculo ? hoy.avisos : [] };
}

/** Antes de congelar: las líneas de lista con los precios de hoy y la foto de la lista que los dio (en `detalle`). */
async function congelarPrecios(tx: Transaccion, ctx: ContextoDeHerramienta, version: Version, calculo: Calculo): Promise<void> {
  await reemplazarLineas(tx, ctx, version.id, conFotoDeLista(calculo.lineas, calculo.listas));
  await actualizarVersion(tx, ctx, version.id, { ...calculo.totales, margenPct: margenDe(calculo.totales.subtotalCentimos, version.costoCentimos) });
}

export const cotizacionEmitir = definirHerramienta('cotizacion_emitir', {
  modulo: MODULO,
  permiso: 'cotizador:emitir',
  criticidad: 'critica',
  ayuda: {
    titulo: 'Emitir una cotización',
    paraQueSirve: 'Da el número a la cotización (la primera vez), guarda una foto del cliente, de las condiciones y del IGV, fija hasta cuándo vale y congela la versión: ya no se edita.',
    cuandoUsarla: 'Cuando la cotización está lista para entregarse al cliente.',
    campos: [CAMPO_ID, { nombre: 'motivoMargenBajo', queSeAnota: 'Por qué se emite con el margen por debajo del mínimo (solo si hace falta).', ejemplo: 'Cliente grande, pedido recurrente' },
      { nombre: 'aceptarPreciosDeHoy', queSeAnota: 'true para emitir con los precios de lista de hoy cuando cambiaron desde que se armó la cotización.', ejemplo: 'true' },
    ],
    ejemploTecleado: 'emitir la cotización de Imprenta Sol',
    ejemploHablado: 'emite la cotización de Imprenta Sol',
    erroresComunes: ['Elige el cliente antes de emitir la cotización.', 'Solo se emite una cotización en borrador.', 'El margen está por debajo del mínimo: indica el motivo.', 'La cotización cambió mientras confirmabas: vuelve a pedir la emisión.', 'Los precios de lista cambiaron: acepta los precios de hoy para emitir.'],
    relacionadas: ['cotizacion_editar', 'cotizacion_marcar_enviada', 'cotizacion_nueva_version'],
  },
  auditar: auditarCotizacion,
  async resumir(args, ctx, tx) {
    const p = await prepararEmision(tx, ctx, args.id, args, false);
    if (!p.ok) return p;
    const cual = p.c.numero === null ? `el borrador «${p.c.titulo}»` : `la cotización ${codigoDeCotizacion(p.c.numero, p.c.anio, p.version.version)}`;
    return {
      ok: true,
      resumen: {
        resumen: `Se emitirá ${cual} por ${formatearSoles(p.totales.totalCentimos)}${p.version.igvPorcentaje > 0 ? ' (con IGV)' : ''}. Una vez emitida no se edita: para cambiarla harás una nueva versión.${p.avisos.length > 0 ? ' Los precios se actualizaron con los de hoy.' : ''}`,
        huella: hashCanonico({ estado: p.c.estado, version: p.version.version, subtotalCentimos: p.totales.subtotalCentimos, totalCentimos: p.totales.totalCentimos, lineas: p.lineas }),
      },
    };
  },
  async ejecutar(args, ctx, tx) {
    const p = await prepararEmision(tx, ctx, args.id, args, true);
    if (!p.ok) return p;
    const { c, version } = p;
    const hoy = await hoyDeLaEmpresa(tx);
    const condiciones = fusionarCondiciones(p.condicionesDeEmpresa, version.condiciones as Partial<CondicionesDeCotizacion>);
    const motivo = p.margenBajo ? (args.motivoMargenBajo ?? null) : null;
    if (p.cuadro) await emitirCuadro(tx, ctx, version, p.cuadro, { condiciones, motivoMargenBajo: motivo });
    else {
      if (p.precios) await congelarPrecios(tx, ctx, version, p.precios);
      await marcarVersionEmitida(tx, ctx, version.id, { condiciones, motivoMargenBajo: motivo });
    }
    // El número se toma al final y solo la primera vez: si algo falla antes o después, la transacción lo devuelve (sin huecos).
    const numerar = c.numero === null ? { numero: await siguienteNumero(tx, CLAVE_DE_CORRELATIVO, { anio: hoy.anio }), anio: hoy.anio } : { numero: c.numero, anio: c.anio! };
    await actualizarCotizacion(tx, ctx, c.id, {
      estado: 'emitida',
      ...numerar,
      clienteNombre: p.clienteNombre,
      validaHasta: condiciones.validezDias ? sumarDias(hoy.dia, condiciones.validezDias) : null,
    });
    await registrarEvento(tx, ctx, c.id, version.version, { tipo: 'emitida', motivo });
    await emitir(tx, 'cotizacion.emitida', {
      id: c.id,
      codigo: codigoDeCotizacion(numerar.numero, numerar.anio, version.version),
      version: version.version,
      clienteId: c.clienteId!,
      totalCentimos: p.totales.totalCentimos,
    });
    return responderCotizacion(tx, ctx, c.id);
  },
});

export const cotizacionNuevaVersion = definirHerramienta('cotizacion_nueva_version', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Hacer una nueva versión',
    paraQueSirve: 'Vuelve a abrir una cotización emitida, enviada o rechazada como borrador: crea la versión siguiente, copia de la actual con los precios de lista de hoy, para corregirla. Conserva el número; la versión anterior queda tal cual.',
    cuandoUsarla: 'Cuando el cliente pide cambios o el precio hay que ajustarlo.',
    campos: [CAMPO_ID],
    ejemploTecleado: 'nueva versión de la cotización de Imprenta Sol',
    ejemploHablado: 'hazle otra versión a la cotización de Imprenta Sol',
    erroresComunes: ['Solo se hace una nueva versión de una cotización emitida, enviada o rechazada.'],
    relacionadas: ['cotizacion_editar', 'cotizacion_emitir', 'cotizacion_ver'],
  },
  auditar: auditarCotizacion,
  async ejecutar(args, ctx, tx) {
    const c = await verCotizacion(tx, ctx, args.id, { alcance: alcanceDeCotizaciones(ctx), bloquear: true });
    if (!c) return rechazo('no_encontrado', NO_EXISTE);
    const paso = comprobarPaso(c.estado as EstadoDeCotizacion, 'nueva_version');
    if (!paso.ok) return rechazo('conflicto', paso.motivo);
    const actual = await versionDe(tx, ctx, c.id, c.versionActual);
    if (!actual) throw new Error('La cotización no tiene su versión vigente.');
    const siguiente = actual.version + 1;
    const hoy = await preciosDeHoy(tx, ctx, actual, c.clienteId);
    const nueva = await crearVersion(tx, ctx, c.id, siguiente, datosConPreciosDeHoy(actual, hoy));
    if (hoy.calculo) await reemplazarLineas(tx, ctx, nueva, hoy.calculo.lineas);
    else await copiarLineas(tx, ctx, actual.id, nueva);
    await copiarCuadroSiAplica(tx, ctx, actual, nueva, c.id, siguiente);
    await actualizarCotizacion(tx, ctx, c.id, { estado: 'borrador', versionActual: siguiente, validaHasta: null, motivoRechazo: null });
    await registrarEvento(tx, ctx, c.id, siguiente, { tipo: 'nueva_version', datos: { desde: actual.version } });
    return responderCotizacion(tx, ctx, c.id, undefined, hoy.avisos);
  },
});

export const cotizacionDuplicar = definirHerramienta('cotizacion_duplicar', {
  modulo: MODULO,
  permiso: 'cotizador:editar',
  criticidad: 'normal',
  ayuda: {
    titulo: 'Duplicar una cotización',
    paraQueSirve: 'Crea una cotización nueva en borrador, sin número, con las mismas líneas, cliente, condiciones y notas que la actual. Los precios de lista se recalculan con los de hoy y la respuesta avisa de los que cambiaron.',
    cuandoUsarla: 'Cuando una cotización sirve de base para otra al mismo cliente o a uno parecido.',
    campos: [CAMPO_ID],
    ejemploTecleado: 'duplicar la cotización de Imprenta Sol',
    ejemploHablado: 'haz una copia de la cotización de Imprenta Sol',
    erroresComunes: ['La cotización no existe, es de otra empresa o no está a tu cargo.'],
    relacionadas: ['cotizacion_editar', 'cotizacion_ver'],
  },
  auditar: auditarCotizacion,
  async ejecutar(args, ctx, tx) {
    const c = await verCotizacion(tx, ctx, args.id, { alcance: alcanceDeCotizaciones(ctx) });
    if (!c) return rechazo('no_encontrado', NO_EXISTE);
    const actual = await versionDe(tx, ctx, c.id, c.versionActual);
    if (!actual) throw new Error('La cotización no tiene su versión vigente.');
    const id = await crearCotizacion(tx, ctx, { titulo: c.titulo, clienteId: c.clienteId, notas: c.notas });
    const hoy = await preciosDeHoy(tx, ctx, actual, c.clienteId);
    const nueva = await crearVersion(tx, ctx, id, 1, datosConPreciosDeHoy(actual, hoy));
    if (hoy.calculo) await reemplazarLineas(tx, ctx, nueva, hoy.calculo.lineas);
    else await copiarLineas(tx, ctx, actual.id, nueva);
    await copiarCuadroSiAplica(tx, ctx, actual, nueva, id, 1);
    await registrarEvento(tx, ctx, id, 1, { tipo: 'creada', datos: { duplicadaDe: c.id } });
    return responderCotizacion(tx, ctx, id, undefined, hoy.avisos);
  },
});
