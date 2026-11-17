import { exito, rechazo, type Aviso, type ErrorDeRespuesta, type Respuesta, type SalidaDelCuadroDto } from '@capaz/shared';
import type { ContextoDeHerramienta, DatosDeAuditoria } from '../../../core/herramientas/tipos.js';
import type { Transaccion } from '../../../infra/database/con-empresa.js';
import { evaluarBorrador, leerCuadro, validarCuadro } from '../domain/cuadro-calculo.js';
import { avisosDelCuadro } from '../domain/cuadro-vista.js';
import type { ConfiguracionEmpresa, Cuadro, ResultadoDeComando } from '../domain/cuadro-tipos.js';
import { esEditable, type EstadoDeCotizacion } from '../domain/estados.js';
import { asegurarConfiguracion } from '../repositories/configuracion.repository.js';
import { actualizarCotizacion, verCotizacion, type Cotizacion } from '../repositories/cotizaciones.repository.js';
import { versionDe, type Version } from '../repositories/versiones.repository.js';
import { alcanceDeCotizaciones, NO_EXISTE, veCostos } from './cotizacion-comun.js';
import { configuracionVigente, guardarBorrador, vistaDeVersion, type ConfiguracionVigente } from './cuadro-version.js';

// Lo que comparten las herramientas del cuadro: cargar la cotización (en borrador y por partes), aplicar un comando sobre una copia
// del cuadro, validarlo entero, recalcularlo y guardarlo. Si algo falla, no se guarda nada.

export const ID_DE_COTIZACION = { nombre: 'id', queSeAnota: 'Identificador de la cotización por partes.', ejemplo: '0192f0c4-7b1e-7000-8000-000000000020' };
export const NO_ES_POR_PARTES = 'Esta cotización no es por partes: se edita con cotizacion_editar. Para armar un cuadro, empieza una con cuadro_iniciar.';
export const SOLO_EN_BORRADOR = 'Solo se edita una cotización en borrador. Una emitida no se cambia: haz una nueva versión.';

/** Auditoría (R13): solo identificador y estado; nunca notas ni cifras del cuadro. */
export const auditarCuadro = (a: object, d: SalidaDelCuadroDto | null): DatosDeAuditoria => ({
  entidadTipo: 'cotizacion',
  entidadId: d?.cuadro.cotizacionId ?? ('id' in a && typeof a.id === 'string' ? a.id : undefined),
  resumen: d ? { version: d.cuadro.version, estado: d.cuadro.estado } : undefined,
});

type Cargada = { ok: true; c: Cotizacion; version: Version; cuadro: Cuadro } | { ok: false; error: ErrorDeRespuesta };

/** La cotización con su versión vigente y el cuadro leído; exige modo cuadro y, para editar, borrador. */
export async function cargarCuadroDe(tx: Transaccion, ctx: ContextoDeHerramienta, id: string, o: { editable: boolean }): Promise<Cargada> {
  const c = await verCotizacion(tx, ctx, id, { alcance: alcanceDeCotizaciones(ctx), bloquear: o.editable });
  if (!c) return rechazo('no_encontrado', NO_EXISTE);
  if (o.editable && !esEditable(c.estado as EstadoDeCotizacion)) return rechazo('conflicto', SOLO_EN_BORRADOR);
  const version = await versionDe(tx, ctx, c.id, c.versionActual);
  if (!version) throw new Error('La cotización no tiene su versión vigente.');
  if (version.modo !== 'cuadro') return rechazo('conflicto', NO_ES_POR_PARTES);
  const leido = leerCuadro(version.entrada);
  if (!leido.ok) return rechazo('conflicto', leido.mensaje);
  return { ok: true, c, version, cuadro: leido.cuadro };
}

/** Lo interno (margen, umbral) solo lo ve quien tiene `cotizador:costos`. */
export const avisosVisibles = (ctx: ContextoDeHerramienta, avisos: Aviso[]): Aviso[] => (veCostos(ctx) ? avisos : avisos.filter((a) => a.nivel !== 'interno'));

export type Entorno = { ctx: ContextoDeHerramienta; tx: Transaccion; config: ConfiguracionEmpresa };

/**
 * Edita el borrador con autoguardado: aplica el comando sobre una copia, pone al día las filas automáticas, valida el cuadro entero,
 * lo recalcula y guarda cuadro, líneas y totales. Devuelve la vista del cuadro recalculada.
 */
export async function editarCuadro(
  tx: Transaccion,
  ctx: ContextoDeHerramienta,
  id: string,
  mutar: (cuadro: Cuadro, entorno: Entorno) => ResultadoDeComando | Promise<ResultadoDeComando>,
): Promise<Respuesta<SalidaDelCuadroDto>> {
  await asegurarConfiguracion(tx, ctx);
  const cargada = await cargarCuadroDe(tx, ctx, id, { editable: true });
  if (!cargada.ok) return cargada;
  const vigente: ConfiguracionVigente = await configuracionVigente(tx, ctx);

  const cambio = await mutar(structuredClone(cargada.cuadro), { ctx, tx, config: vigente.motor });
  if (!cambio.ok) return rechazo(cambio.codigo, cambio.mensaje, cambio.candidatas);
  const valido = validarCuadro(cambio.cuadro);
  if (!valido.ok) return rechazo('argumentos_invalidos', valido.mensaje);
  const evaluado = evaluarBorrador(valido.cuadro, vigente.motor);
  if (!evaluado.ok) return rechazo('argumentos_invalidos', evaluado.error.mensaje);

  await guardarBorrador(tx, ctx, cargada.version, evaluado.valor, vigente);
  await actualizarCotizacion(tx, ctx, cargada.c.id, {});
  const vista = await vistaDeVersion(tx, ctx, { ...cargada.version, entrada: evaluado.valor.cuadro, emitidaEn: null, resultado: null }, veCostos(ctx));
  if (!vista.ok) return rechazo('conflicto', vista.mensaje);
  return exito({ cuadro: vista.vista, ...(cambio.linea ? { linea: cambio.linea } : {}) }, { avisos: avisosVisibles(ctx, [...avisosDelCuadro(evaluado.valor.calculado), ...cambio.avisos]) });
}
