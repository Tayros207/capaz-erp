import { exito, formatearSoles, rechazo, type ArgsDe, type Borrador, type Respuesta, type VentaCorregidaDto, type PedidoCorregidoDto, type AjusteDeDeudaDto, type DeudaDto } from '@capaz/shared';
import { conPuntoDeGuardado, type Transaccion } from '../../infra/database/con-empresa.js';
import { alcanceDe } from '../modulos/alcance.js';
import type { EjecutorDeHerramientas } from '../herramientas/ejecutor.js';
import { hashCanonico } from '../herramientas/confirmacion.js';
import { conAbonadoVerificado } from '../herramientas/contexto-verificado.js';
import type { ContextoDeHerramienta, ResultadoDeResumen } from '../herramientas/tipos.js';

// `venta_corregir`: corrige un pedido confirmado y, en la MISMA transacción y con UNA sola confirmación, ajusta su deuda.
// El núcleo no importa módulos: llama a `pedido_corregir`, `deudas_listar`, `deuda_ajustar` y `borrador_corregir` por nombre con
// `ejecutarDentro` y el contexto de la persona (mismos permisos, alcance y auditoría que si los pidiera a mano). Bloqueo siempre
// en el mismo orden: pedido (lo toma `pedido_corregir`) y después deuda (la toma `deuda_ajustar`). Si algo falla, todo se revierte.
// Sin acceso a Registro: se corrige el pedido y el ajuste de la deuda queda como borrador propuesto por el consumidor de respaldo (R5).

type Args = ArgsDe<'venta_corregir'>;
const ORIGEN = 'pedido';

const puede = (ctx: ContextoDeHerramienta, modulo: string, permiso: string, escribir: boolean): boolean => {
  const a = ctx.modulos.find((m) => m.codigo === modulo);
  return Boolean(a?.puedeEntrar && (!escribir || a.puedeEscribir) && ctx.permisos.includes(permiso));
};

const datosDe = <T>(r: Respuesta<unknown>): T | null => (r.ok && 'datos' in r ? (r.datos as T) : null);

/** Dueño o administrador: corrigen sin el tope del trabajador (la misma regla que `pedido_corregir` y `core/modulos/acceso.ts`). */
const administra = (ctx: ContextoDeHerramienta): boolean => ctx.rol === 'owner' || ctx.rol === 'admin';

async function deudaVivaDelPedido(ejecutor: EjecutorDeHerramientas, tx: Transaccion, ctx: ContextoDeHerramienta, pedidoId: string): Promise<DeudaDto | null> {
  const r = await ejecutor.ejecutarDentro(tx, 'deudas_listar', { tipo: 'por_cobrar', estado: 'todas', origenTipo: ORIGEN, origenId: pedidoId, limite: 10 }, { ctx });
  return datosDe<{ items: DeudaDto[] }>(r)?.items.find((d) => d.estado !== 'anulada') ?? null;
}

/** Un borrador `deuda_crear` todavía pendiente de este pedido (la deuda aún no existe): se actualiza con el total nuevo. */
async function actualizarBorradorDeDeuda(ejecutor: EjecutorDeHerramientas, tx: Transaccion, ctx: ContextoDeHerramienta, pedidoId: string, cambios: { total: number; venceEn?: string | null; contactoId?: string }): Promise<string | null> {
  if (!puede(ctx, 'core', 'borradores:ver', false) || !puede(ctx, 'registro', 'registro:editar', true)) return null;
  const r = await ejecutor.ejecutarDentro(tx, 'borradores_listar', { estado: 'pendiente', modulo: 'registro', limite: 50 }, { ctx });
  const b = datosDe<{ items: Borrador[] }>(r)?.items.find((x) => x.herramienta === 'deuda_crear' && x.origenRef === `${ORIGEN}:${pedidoId}`);
  if (!b) return null;
  const args = {
    ...(b.args as Record<string, unknown>),
    totalCentimos: cambios.total,
    ...(cambios.venceEn !== undefined && cambios.venceEn !== null && { venceEn: cambios.venceEn }),
    // Si el pedido cambió de cliente, la deuda debe nacer a nombre del cliente nuevo.
    ...(cambios.contactoId && { contactoId: cambios.contactoId }),
  };
  const c = await ejecutor.ejecutarDentro(tx, 'borrador_corregir', { id: b.id, args }, { ctx });
  return c.ok ? b.id : null;
}

type Ajustada = { deuda: DeudaDto; ajuste: AjusteDeDeudaDto | null; aFavorCentimos: number };
type AjusteDeLaViva = { ajustada: Ajustada | null; pendiente: boolean } | { rechazo: Respuesta<VentaCorregidaDto> };

/**
 * Ajusta la deuda viva al pedido corregido (`deuda_ajustar`, con la deuda bloqueada después del pedido). Si ya cuadra y no cambian
 * ni el vencimiento ni el cliente, no hace nada. Quien no puede escribir en Finanzas lo deja pendiente (borrador del respaldo R5).
 */
async function ajustarDeudaViva(ejecutor: EjecutorDeHerramientas, tx: Transaccion, ctx: ContextoDeHerramienta, args: Args, viva: DeudaDto, c: PedidoCorregidoDto): Promise<AjusteDeLaViva> {
  const { pedido, correccion } = c;
  const entrega = correccion.datos.find((d) => d.campo === 'entregaEl');
  const cliente = correccion.datos.find((d) => d.campo === 'clienteId');
  const venceEn = entrega && viva.venceEn === entrega.antes ? entrega.despues : undefined;
  const ver = datosDe<{ aFavorCentimos: number }>(await ejecutor.ejecutarDentro(tx, 'deuda_ver', { id: viva.id }, { ctx }));
  const aFavorAntes = ver?.aFavorCentimos ?? 0;
  const cuadra = viva.totalCentimos === Math.max(pedido.totalCentimos, viva.abonadoCentimos) && ver?.aFavorCentimos === Math.max(0, viva.abonadoCentimos - pedido.totalCentimos);
  if (cuadra && venceEn === undefined && !cliente) return { ajustada: null, pendiente: false };
  if (!puede(ctx, 'registro', 'registro:editar', true)) return { ajustada: null, pendiente: true };
  const ra = await ejecutor.ejecutarDentro(
    tx,
    'deuda_ajustar',
    {
      id: viva.id,
      nuevoTotalCentimos: pedido.totalCentimos,
      motivoCodigo: args.motivoCodigo,
      ...(args.motivoTexto && { motivoTexto: args.motivoTexto }),
      origenRef: `${ORIGEN}:${pedido.id}:v${pedido.version}`,
      ...(venceEn !== undefined && { venceEn }),
      ...(cliente?.despues && { contactoId: cliente.despues }),
    },
    { ctx },
  );
  const ajustada = datosDe<Ajustada>(ra);
  if (!ajustada) return { rechazo: ra as Respuesta<VentaCorregidaDto> };
  // Con la deuda ya bloqueada: si entre tanto entró un abono, el excedente pudo crecer. Un trabajador no lo deja crecer.
  if (!administra(ctx) && ajustada.aFavorCentimos > aFavorAntes) {
    const mensaje = `Con lo que el cliente ya pagó (${formatearSoles(ajustada.deuda.abonadoCentimos)}) quedaría ${formatearSoles(ajustada.aFavorCentimos)} a su favor: esto lo aprueba el dueño o un administrador.`;
    return { rechazo: rechazo('requiere_aprobacion', mensaje) };
  }
  return { ajustada, pendiente: false };
}

/** Hace todo (también lo usa la simulación del resumen: allí se deshace con un punto de guardado). */
export async function aplicarVentaCorregida(ejecutor: EjecutorDeHerramientas, tx: Transaccion, ctx: ContextoDeHerramienta, args: Args): Promise<Respuesta<VentaCorregidaDto>> {
  const veRegistro = puede(ctx, 'registro', 'registro:ver', false);
  const viva = veRegistro ? await deudaVivaDelPedido(ejecutor, tx, ctx, args.id) : null;
  // Sin acceso a Registro no se sabe lo abonado: `pedido_corregir` no dejará cambiar el cliente ni calculará el excedente. Con
  // alcance «propios», una deuda creada por otra persona no aparece: no verla no quiere decir que no tenga abonos.
  const sabeQueNoHayDeuda = veRegistro && alcanceDe(ctx, 'registro') === 'todos';
  const abonado = viva ? viva.abonadoCentimos : sabeQueNoHayDeuda ? 0 : null;
  // Lo abonado viaja en el contexto, no en los argumentos: así nadie puede inventarlo llamando a `pedido_corregir` directamente.
  const rp = await ejecutor.ejecutarDentro(tx, 'pedido_corregir', args, { ctx: abonado === null ? ctx : conAbonadoVerificado(ctx, abonado) });
  const corregido = datosDe<PedidoCorregidoDto>(rp);
  if (!corregido) return rp as Respuesta<VentaCorregidaDto>;
  const { pedido, correccion } = corregido;
  const avisos = [...corregido.avisos];
  let ajustada: Ajustada | null = null;
  let ajustePendiente = !veRegistro;
  let borradorActualizadoId: string | null = null;
  if (viva) {
    const r = await ajustarDeudaViva(ejecutor, tx, ctx, args, viva, corregido);
    if ('rechazo' in r) return r.rechazo;
    ({ ajustada } = r);
    ajustePendiente = r.pendiente;
  } else if (veRegistro) {
    const entrega = correccion.datos.find((d) => d.campo === 'entregaEl');
    const cliente = correccion.datos.find((d) => d.campo === 'clienteId');
    borradorActualizadoId = await actualizarBorradorDeDeuda(ejecutor, tx, ctx, pedido.id, { total: pedido.totalCentimos, venceEn: entrega?.despues, ...(cliente?.despues && { contactoId: cliente.despues }) });
    if (!sabeQueNoHayDeuda && !borradorActualizadoId) avisos.push('Si este pedido tiene una deuda que tú no ves, quien lleva Finanzas recibirá su ajuste como borrador.');
  }
  if (ajustePendiente) avisos.push('El ajuste de la deuda queda como borrador para quien lleva Finanzas: lo revisa y lo aprueba.');
  const d = ajustada?.deuda ?? viva;
  return exito({
    pedido,
    correccion,
    avisos,
    deuda: d ? { id: d.id, codigo: d.codigo, totalCentimos: d.totalCentimos, abonadoCentimos: d.abonadoCentimos, saldoCentimos: d.saldoCentimos, estado: d.estado } : null,
    ajuste: ajustada?.ajuste ?? null,
    aFavorCentimos: ajustada?.aFavorCentimos ?? correccion.aFavorCentimos ?? 0,
    ajustePendiente,
    borradorActualizadoId,
  });
}

class Simulado extends Error {}

/** Corre `fn` y deshace TODO lo que escribió (punto de guardado): sirve para mostrar qué pasaría sin cambiar nada. */
async function simular<T>(tx: Transaccion, fn: (punto: Transaccion) => Promise<T>): Promise<T> {
  let salida: T | undefined;
  try {
    await conPuntoDeGuardado(tx, async (punto) => {
      salida = await fn(punto);
      throw new Simulado();
    });
  } catch (e) {
    if (!(e instanceof Simulado)) throw e;
  }
  return salida as T;
}

const soles = (milesimas: number): string => `S/ ${(milesimas / 1000).toFixed(3).replace(/(\.\d\d)0$/, '$1')}`;
const cantidad = (milesimas: number): string => String(milesimas / 1000);

/** Lo que se le muestra a la persona antes de confirmar. */
export function textoDeResumen(v: VentaCorregidaDto): string {
  const c = v.correccion;
  const lineas = c.lineas.map((l) => {
    const antes = l.antes ? `${cantidad(l.antes.cantidadMilesimas)} × ${soles(l.antes.precioUnitarioMilesimas)}${l.antes.afectoIgv ? '' : ' (sin IGV)'}` : 'no estaba';
    const despues = l.despues ? `${cantidad(l.despues.cantidadMilesimas)} × ${soles(l.despues.precioUnitarioMilesimas)}${l.despues.afectoIgv ? '' : ' (sin IGV)'}` : 'se quita';
    return `«${l.descripcion}»: ${antes} → ${despues}`;
  });
  const partes = [
    `Corregirás el pedido ${v.pedido.codigo} (versión ${c.versionAnterior} → ${c.versionNueva}); la versión ${c.versionAnterior} queda guardada.`,
    ...(lineas.length ? [`Líneas: ${lineas.join('; ')}.`] : []),
    ...(c.datos.length ? [`Cambia también: ${c.datos.map((d) => ({ entregaEl: 'la entrega', notas: 'las notas', clienteId: 'el cliente' })[d.campo]).join(', ')}.`] : []),
    `Total: ${formatearSoles(c.totalAnteriorCentimos)} → ${formatearSoles(c.totalNuevoCentimos)} (${c.deltaCentimos >= 0 ? '+' : '−'}${formatearSoles(Math.abs(c.deltaCentimos))}).`,
  ];
  if (v.deuda) {
    partes.push(`Ya pagó ${formatearSoles(v.deuda.abonadoCentimos)}; falta ${formatearSoles(v.deuda.saldoCentimos)}${v.aFavorCentimos > 0 ? `; a favor del cliente ${formatearSoles(v.aFavorCentimos)} (no se devuelve)` : ''}.`);
    if (v.ajuste) partes.push(`La deuda ${v.deuda.codigo} se ajusta ${v.ajuste.montoCentimos >= 0 ? '+' : '−'}${formatearSoles(Math.abs(v.ajuste.montoCentimos))}.`);
  }
  partes.push(...v.avisos);
  return partes.join(' ');
}

/** Calcula el resumen simulando la corrección completa; los rechazos (umbral, guías, estado) salen ya aquí. */
export async function resumirVentaCorregida(ejecutor: EjecutorDeHerramientas, tx: Transaccion, ctx: ContextoDeHerramienta, args: Args): Promise<ResultadoDeResumen> {
  const r = await simular(tx, (punto) => aplicarVentaCorregida(ejecutor, punto, ctx, args));
  const v = datosDe<VentaCorregidaDto>(r);
  if (!v) return 'error' in r ? { ok: false, error: r.error } : rechazoInterno();
  return {
    ok: true,
    resumen: {
      resumen: textoDeResumen(v),
      huella: hashCanonico({
        version: v.correccion.versionAnterior,
        total: [v.correccion.totalAnteriorCentimos, v.correccion.totalNuevoCentimos],
        deuda: v.deuda && [v.deuda.id, v.deuda.totalCentimos, v.deuda.abonadoCentimos, v.deuda.estado],
        aFavor: v.aFavorCentimos,
        pendiente: v.ajustePendiente,
        lineas: v.correccion.lineas,
      }),
    },
  };
}

const rechazoInterno = (): ResultadoDeResumen => {
  const e = rechazo('error_interno', 'No se pudo calcular el resumen de la corrección.');
  return { ok: false, error: e.error };
};
