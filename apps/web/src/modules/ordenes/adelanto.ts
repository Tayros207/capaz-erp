import { MEDIOS_DE_PAGO } from '@capaz/shared';

// Lógica pura de «Confirmar y cobrar adelanto»: sin React ni red. Las llamadas al servidor entran
// inyectadas (`DependenciasDelAdelanto`) para poder probar cada fallo parcial.

export type MedioDePago = (typeof MEDIOS_DE_PAGO)[number];
export const ETIQUETA_DE_MEDIO: Readonly<Record<MedioDePago, string>> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  yape: 'Yape',
  plin: 'Plin',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

export const ORIGEN_DE_PEDIDO = 'pedido';

/** El 50 % del total, redondeado al céntimo (nunca más que el total). */
export const sugerirAdelanto = (totalCentimos: number): number => (totalCentimos > 0 ? Math.min(totalCentimos, Math.round(totalCentimos / 2)) : 0);

/** La casilla solo se ofrece a quien escribe en Finanzas, con cliente y total mayor que cero. */
export const sePuedeCobrarAdelanto = (a: { puedeEscribirEnRegistro: boolean; clienteId: string | null | undefined; totalCentimos: number | null }): boolean =>
  a.puedeEscribirEnRegistro && !!a.clienteId && (a.totalCentimos ?? 0) > 0;

/** Mensaje de error del monto, o nulo si sirve. */
export function validarAdelanto(monto: number | null, totalCentimos: number): string | null {
  if (monto === null || !Number.isSafeInteger(monto) || monto <= 0) return 'Escribe el monto del adelanto.';
  if (monto > totalCentimos) return 'El adelanto no puede ser mayor que el total del pedido.';
  return null;
}

// ── Orquestación ───────────────────────────────────────────────────────────

export type Res<T> = { ok: true; datos: T } | { ok: false; codigo: string; mensaje: string };
export type PedidoConfirmado = { id: string; codigo: string; clienteId: string; totalCentimos: number };
export type DeudaDelAdelanto = { id: string; codigo: string; totalCentimos: number; abonadoCentimos: number; saldoCentimos: number };
export type ArgsDeDeuda = { contactoId: string; concepto: string; totalCentimos: number; origenTipo: typeof ORIGEN_DE_PEDIDO; origenId: string };

export type DependenciasDelAdelanto = {
  confirmar: () => Promise<Res<PedidoConfirmado>>;
  crearDeuda: (args: ArgsDeDeuda) => Promise<Res<DeudaDelAdelanto>>;
  /** La deuda viva del pedido (por origen), o nulo si no hay. */
  buscarDeuda: (pedidoId: string, clienteId: string) => Promise<Res<DeudaDelAdelanto | null>>;
  abonar: (deudaId: string, montoCentimos: number, medio: MedioDePago) => Promise<Res<unknown>>;
};

export type ResultadoDelAdelanto =
  | { estado: 'sin_confirmar'; mensaje: string }
  | { estado: 'sin_deuda'; mensaje: string; pedidoCodigo: string }
  | { estado: 'sin_abono'; mensaje: string; pedidoCodigo: string; deuda: DeudaDelAdelanto }
  | { estado: 'completo'; mensaje: string; pedidoCodigo: string; deuda: DeudaDelAdelanto };

const CODIGOS_AMBIGUOS = new Set(['conflicto', 'sin_conexion']);

/** Busca la deuda del pedido; nulo si no se pudo saber o no existe. */
async function deudaExistente(dep: DependenciasDelAdelanto, p: PedidoConfirmado): Promise<DeudaDelAdelanto | null> {
  const r = await dep.buscarDeuda(p.id, p.clienteId);
  return r.ok ? r.datos : null;
}

/** Obtiene la deuda del pedido: la crea o, si ya existe (o la respuesta se perdió), reutiliza la existente. */
async function obtenerDeuda(dep: DependenciasDelAdelanto, p: PedidoConfirmado): Promise<{ deuda: DeudaDelAdelanto; reutilizada: boolean } | { error: string }> {
  const creada = await dep.crearDeuda({ contactoId: p.clienteId, concepto: `Pedido ${p.codigo}`, totalCentimos: p.totalCentimos, origenTipo: ORIGEN_DE_PEDIDO, origenId: p.id });
  if (creada.ok) return { deuda: creada.datos, reutilizada: false };
  if (CODIGOS_AMBIGUOS.has(creada.codigo)) {
    const previa = await deudaExistente(dep, p);
    if (previa) return { deuda: previa, reutilizada: true };
  }
  return { error: creada.mensaje };
}


/** Tras un fallo del abono: ¿llegó igual? Se mira cuánto lleva abonado la deuda. */
async function abonoLlego(dep: DependenciasDelAdelanto, p: PedidoConfirmado, antes: number, monto: number): Promise<boolean | null> {
  const r = await dep.buscarDeuda(p.id, p.clienteId);
  if (!r.ok || !r.datos) return null;
  return r.datos.abonadoCentimos >= antes + monto;
}

export type ParametrosDelAdelanto = { montoCentimos: number; medio: MedioDePago; formato: (centimos: number) => string };

/** Registra el abono, avisando con claridad qué quedó hecho y qué falta. */
async function cobrar(dep: DependenciasDelAdelanto, p: PedidoConfirmado, deuda: DeudaDelAdelanto, reutilizada: boolean, a: ParametrosDelAdelanto): Promise<ResultadoDelAdelanto> {
  const monto = a.formato(a.montoCentimos);
  if (reutilizada && deuda.abonadoCentimos >= a.montoCentimos) {
    return { estado: 'completo', pedidoCodigo: p.codigo, deuda, mensaje: `Pedido ${p.codigo} confirmado. Su deuda ya tenía ${a.formato(deuda.abonadoCentimos)} abonados: no se registró otro adelanto.` };
  }
  if (a.montoCentimos > deuda.saldoCentimos) {
    return { estado: 'sin_abono', pedidoCodigo: p.codigo, deuda, mensaje: `Pedido ${p.codigo} confirmado y su deuda ${deuda.codigo} lista, pero el adelanto de ${monto} supera el saldo (${a.formato(deuda.saldoCentimos)}). Registra el abono desde Por cobrar.` };
  }
  const r = await dep.abonar(deuda.id, a.montoCentimos, a.medio);
  const llego = r.ok ? true : await abonoLlego(dep, p, deuda.abonadoCentimos, a.montoCentimos);
  if (llego) return { estado: 'completo', pedidoCodigo: p.codigo, deuda, mensaje: `Pedido ${p.codigo} confirmado y adelanto de ${monto} cobrado.` };
  const hecho = `El pedido ${p.codigo} quedó confirmado y su deuda ${deuda.codigo} está creada.`;
  const causa = r.ok ? '' : ` ${r.mensaje}`;
  const falta = llego === null ? `No pudimos comprobar si el adelanto de ${monto} se registró: revisa la deuda antes de repetirlo.` : `Falta el adelanto de ${monto}: regístralo desde Por cobrar.`;
  return { estado: 'sin_abono', pedidoCodigo: p.codigo, deuda, mensaje: `${hecho}${causa} ${falta}`.replace(/\s+/g, ' ') };
}

/**
 * Confirma el pedido, crea (o reutiliza) su deuda y registra el adelanto, en ese orden. Si un paso
 * falla no se hacen los siguientes, y el resultado dice qué quedó hecho. Nunca lanza.
 */
export async function confirmarYCobrar(dep: DependenciasDelAdelanto, a: ParametrosDelAdelanto): Promise<ResultadoDelAdelanto> {
  const confirmado = await dep.confirmar();
  if (!confirmado.ok) return { estado: 'sin_confirmar', mensaje: `No se confirmó el pedido: ${confirmado.mensaje} No se cobró nada.` };
  const p = confirmado.datos;
  if (p.totalCentimos <= 0 || validarAdelanto(a.montoCentimos, p.totalCentimos)) {
    return { estado: 'sin_deuda', pedidoCodigo: p.codigo, mensaje: `Pedido ${p.codigo} confirmado, pero el adelanto no coincide con el total final (${a.formato(p.totalCentimos)}). No se cobró nada: regístralo desde Por cobrar.` };
  }
  const obtenida = await obtenerDeuda(dep, p);
  if ('error' in obtenida) {
    return { estado: 'sin_deuda', pedidoCodigo: p.codigo, mensaje: `El pedido ${p.codigo} quedó confirmado, pero no se pudo crear su deuda: ${obtenida.error} No se cobró nada.` };
  }
  return cobrar(dep, p, obtenida.deuda, obtenida.reutilizada, a);
}
