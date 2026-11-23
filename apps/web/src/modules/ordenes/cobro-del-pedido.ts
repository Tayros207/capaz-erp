import { ORIGEN_DE_PEDIDO, abonoLlego, type ArgsDeDeuda, type DeudaDelAdelanto, type MedioDePago, type PedidoConfirmado, type Res, type ResultadoDelAdelanto } from './adelanto.ts';

// Lógica pura de «Confirmar» con el bloque Pago: confirma el pedido, crea la deuda por cobrar y cobra lo que se eligió.
// Las llamadas a Finanzas entran inyectadas (`DependenciasDelCobro`), así se prueba cada fallo parcial. Nunca lanza.
//   · «Pagó todo»     → deuda por el total + abono del total (queda pagada).
//   · «Deja adelanto» → deuda con adelanto en UNA sola operación de Finanzas (no puede quedar la deuda sin su abono).
//   · «Sin pago»      → solo la deuda por el total, para que el cobro no se pierda.

type DatosDeCobro = { medio: MedioDePago; cuentaId: string | null };
export type PagoAlConfirmar =
  | { modo: 'ninguno'; venceEn: string | null }
  | ({ modo: 'todo' } & DatosDeCobro)
  | ({ modo: 'adelanto'; montoCentimos: number; venceEn: string | null } & DatosDeCobro);

export type ArgsDeDeudaConAdelanto = ArgsDeDeuda & { adelantoCentimos: number } & DatosDeCobro;

export type DependenciasDelCobro = {
  confirmar: () => Promise<Res<PedidoConfirmado>>;
  crearDeuda: (args: ArgsDeDeuda) => Promise<Res<DeudaDelAdelanto>>;
  /** Deuda y adelanto en una sola operación. Devuelve la deuda ya con el adelanto abonado. */
  crearDeudaConAdelanto: (args: ArgsDeDeudaConAdelanto) => Promise<Res<DeudaDelAdelanto>>;
  /** La deuda viva del pedido (por origen), o nulo si no hay. */
  buscarDeuda: (pedidoId: string, clienteId: string) => Promise<Res<DeudaDelAdelanto | null>>;
  abonar: (deudaId: string, montoCentimos: number, medio: MedioDePago, cuentaId: string | null) => Promise<Res<unknown>>;
};

/** Mismo desenlace que el adelanto de la ficha: así el aviso y el enlace a la deuda sirven para los dos. */
export type ResultadoDelCobro = ResultadoDelAdelanto;

type Contexto = { dep: DependenciasDelCobro; p: PedidoConfirmado; formato: (centimos: number) => string };
type Obtenida = { deuda: DeudaDelAdelanto; reutilizada: boolean } | { error: string; incierto: boolean };

const CODIGOS_AMBIGUOS = new Set(['conflicto', 'sin_conexion']);

const argsDeDeuda = (p: PedidoConfirmado, venceEn: string | null): ArgsDeDeuda => ({
  contactoId: p.clienteId,
  concepto: `Pedido ${p.codigo}`,
  totalCentimos: p.totalCentimos,
  origenTipo: ORIGEN_DE_PEDIDO,
  origenId: p.id,
  ...(venceEn && { venceEn }),
});

/**
 * Crea la deuda (con `crear`) o, si la respuesta se perdió o ya existía, reutiliza la que tenga el pedido.
 * `incierto`: no se pudo ni crearla ni comprobar si ya estaba, así que no se sabe qué quedó hecho.
 */
async function obtenerDeuda(c: Contexto, crear: () => Promise<Res<DeudaDelAdelanto>>): Promise<Obtenida> {
  const creada = await crear();
  if (creada.ok) return { deuda: creada.datos, reutilizada: false };
  if (!CODIGOS_AMBIGUOS.has(creada.codigo)) return { error: creada.mensaje, incierto: false };
  const previa = await c.dep.buscarDeuda(c.p.id, c.p.clienteId);
  if (previa.ok && previa.datos) return { deuda: previa.datos, reutilizada: true };
  return { error: creada.mensaje, incierto: !previa.ok };
}

const completo = (p: PedidoConfirmado, deuda: DeudaDelAdelanto, mensaje: string): ResultadoDelCobro => ({ estado: 'completo', pedidoCodigo: p.codigo, deuda, mensaje });

function sinDeuda(p: PedidoConfirmado, o: { error: string; incierto: boolean }, siFalta: string): ResultadoDelCobro {
  const hecho = `El pedido ${p.codigo} quedó confirmado, pero no se pudo crear su deuda por cobrar: ${o.error}`;
  const falta = o.incierto ? 'No pudimos comprobar si se creó: revisa Por cobrar antes de repetirlo.' : siFalta;
  return { estado: 'sin_deuda', pedidoCodigo: p.codigo, mensaje: `${hecho} ${falta}`.replace(/\s+/g, ' ') };
}

type Abono = { montoCentimos: number; medio: MedioDePago; cuentaId: string | null; que: string; exito: (d: DeudaDelAdelanto) => string };

/** Registra el abono en la deuda, avisando con claridad qué quedó hecho y qué falta. */
async function abonar(c: Contexto, deuda: DeudaDelAdelanto, reutilizada: boolean, a: Abono): Promise<ResultadoDelCobro> {
  const { p, dep, formato } = c;
  const monto = formato(a.montoCentimos);
  if (reutilizada && deuda.abonadoCentimos >= a.montoCentimos) {
    return completo(p, deuda, `Pedido ${p.codigo} confirmado. Su deuda ya tenía ${formato(deuda.abonadoCentimos)} abonados: no se registró ${a.que} otra vez.`);
  }
  if (a.montoCentimos > deuda.saldoCentimos) {
    return { estado: 'sin_abono', pedidoCodigo: p.codigo, deuda, mensaje: `Pedido ${p.codigo} confirmado y su deuda ${deuda.codigo} lista, pero ${a.que} de ${monto} supera el saldo (${formato(deuda.saldoCentimos)}). Regístralo desde Por cobrar.` };
  }
  const r = await dep.abonar(deuda.id, a.montoCentimos, a.medio, a.cuentaId);
  const llego = r.ok ? true : await abonoLlego(dep, p, deuda.abonadoCentimos, a.montoCentimos);
  if (llego) {
    const ahora = { ...deuda, abonadoCentimos: deuda.abonadoCentimos + a.montoCentimos, saldoCentimos: deuda.saldoCentimos - a.montoCentimos };
    return completo(p, ahora, a.exito(ahora));
  }
  const hecho = `El pedido ${p.codigo} quedó confirmado y su deuda ${deuda.codigo} está creada.`;
  const causa = r.ok ? '' : ` ${r.mensaje}`;
  const falta = llego === null ? `No pudimos comprobar si ${a.que} de ${monto} se registró: revisa la deuda antes de repetirlo.` : `Falta ${a.que} de ${monto}: regístralo desde Por cobrar.`;
  return { estado: 'sin_abono', pedidoCodigo: p.codigo, deuda, mensaje: `${hecho}${causa} ${falta}`.replace(/\s+/g, ' ') };
}

const SI_FALTA_EL_COBRO = 'No se cobró nada: regístralo desde Por cobrar.';

async function pagoCompleto(c: Contexto, pago: DatosDeCobro): Promise<ResultadoDelCobro> {
  const o = await obtenerDeuda(c, () => c.dep.crearDeuda(argsDeDeuda(c.p, null)));
  if ('error' in o) return sinDeuda(c.p, o, SI_FALTA_EL_COBRO);
  const total = c.p.totalCentimos;
  return abonar(c, o.deuda, o.reutilizada, { montoCentimos: total, medio: pago.medio, cuentaId: pago.cuentaId, que: 'el cobro', exito: () => `Pedido ${c.p.codigo} confirmado y cobrado por completo (${c.formato(total)}).` });
}

async function pagoConAdelanto(c: Contexto, pago: Extract<PagoAlConfirmar, { modo: 'adelanto' }>): Promise<ResultadoDelCobro> {
  const { montoCentimos: adelanto, venceEn, ...cobro } = pago;
  const o = await obtenerDeuda(c, () => c.dep.crearDeudaConAdelanto({ ...argsDeDeuda(c.p, venceEn), adelantoCentimos: adelanto, medio: cobro.medio, cuentaId: cobro.cuentaId }));
  if ('error' in o) return sinDeuda(c.p, o, SI_FALTA_EL_COBRO);
  const exito = (d: DeudaDelAdelanto) => `Pedido ${c.p.codigo} confirmado y adelanto de ${c.formato(adelanto)} cobrado. Saldo por cobrar: ${c.formato(d.saldoCentimos)}.`;
  // Creada con su adelanto en un solo paso: no queda nada por abonar. Reutilizada (se perdió la respuesta), se comprueba.
  if (!o.reutilizada) return completo(c.p, o.deuda, exito(o.deuda));
  return abonar(c, o.deuda, true, { montoCentimos: adelanto, medio: cobro.medio, cuentaId: cobro.cuentaId, que: 'el adelanto', exito });
}

async function sinCobro(c: Contexto, venceEn: string | null): Promise<ResultadoDelCobro> {
  const o = await obtenerDeuda(c, () => c.dep.crearDeuda(argsDeDeuda(c.p, venceEn)));
  if ('error' in o) return sinDeuda(c.p, o, 'Créala desde Por cobrar para no perder el cobro.');
  return completo(c.p, o.deuda, `Pedido ${c.p.codigo} confirmado. No se cobró nada hoy: queda por cobrar ${c.formato(o.deuda.saldoCentimos)}.`);
}

/** Lo elegido no encaja con el total que confirmó el servidor: se explica y no se cobra nada. */
function desajusteConElTotal(pago: PagoAlConfirmar, p: PedidoConfirmado, formato: (c: number) => string): string | null {
  const total = formato(p.totalCentimos);
  if (p.totalCentimos <= 0) return `Pedido ${p.codigo} confirmado, pero su total final es ${total}: no hay nada que cobrar.`;
  if (pago.modo === 'adelanto' && (pago.montoCentimos <= 0 || pago.montoCentimos >= p.totalCentimos)) {
    return `Pedido ${p.codigo} confirmado, pero el adelanto no coincide con el total final (${total}). No se cobró nada: regístralo desde Por cobrar.`;
  }
  return null;
}

/**
 * Confirma el pedido y, según el pago, crea su deuda y cobra, en ese orden. Si un paso falla no se hacen los siguientes
 * y el resultado dice qué quedó hecho. El cobro de «Pagó todo» es el total que confirmó el servidor.
 */
export async function confirmarYCobrarPedido(dep: DependenciasDelCobro, pago: PagoAlConfirmar, formato: (centimos: number) => string): Promise<ResultadoDelCobro> {
  const confirmado = await dep.confirmar();
  if (!confirmado.ok) {
    return { estado: 'sin_confirmar', mensaje: `No se confirmó el pedido: ${confirmado.mensaje}${pago.modo === 'ninguno' ? '' : ' No se cobró nada.'}` };
  }
  const p = confirmado.datos;
  const desajuste = desajusteConElTotal(pago, p, formato);
  if (desajuste) return { estado: 'sin_deuda', pedidoCodigo: p.codigo, mensaje: desajuste };
  const c: Contexto = { dep, p, formato };
  if (pago.modo === 'ninguno') return sinCobro(c, pago.venceEn);
  if (pago.modo === 'adelanto') return pagoConAdelanto(c, pago);
  return pagoCompleto(c, pago);
}
