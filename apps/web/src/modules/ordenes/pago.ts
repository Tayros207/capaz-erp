import { sugerirAdelanto, type MedioDePago } from './adelanto.ts';
import type { PagoAlConfirmar } from './cobro-del-pedido.ts';

// Lógica pura del bloque «Pago» de «Nuevo pedido»: las tres opciones, el monto de cada una, las
// validaciones y los textos. Sin React ni red. El pedido decide cómo se paga; Finanzas guarda la deuda y el dinero.

export type ModoDePago = 'todo' | 'adelanto' | 'ninguno';

export const OPCIONES_DE_PAGO: readonly { modo: ModoDePago; titulo: string; consecuencia: string }[] = [
  { modo: 'todo', titulo: 'Pagó todo', consecuencia: 'Se anota el cobro completo.' },
  { modo: 'adelanto', titulo: 'Deja adelanto', consecuencia: 'Se cobra el adelanto y el resto queda por cobrar.' },
  { modo: 'ninguno', titulo: 'Sin pago', consecuencia: 'No se cobra nada hoy; queda todo por cobrar.' },
];

export const PREGUNTA_DE_PAGO = '¿Cómo paga el cliente?';
export const PISTA_SIN_DATOS = 'Elige un cliente y agrega productos para definir el pago.';

const TEXTO_DEL_BOTON: Readonly<Record<ModoDePago, string>> = {
  todo: 'Confirmar y cobrar todo',
  adelanto: 'Confirmar y cobrar adelanto',
  ninguno: 'Confirmar, queda por cobrar',
};

/** El texto de «Confirmar» según el pago elegido; sin pago que definir, el de siempre. */
export const textoDeConfirmar = (modo: ModoDePago | null | undefined): string => (modo ? TEXTO_DEL_BOTON[modo] : 'Confirmar pedido');

/** Lo que la persona fue marcando en el bloque. */
export type PagoDeHoja = {
  /** `null` mientras nadie elija: confirmar pide elegir, nunca se asume un pago. */
  modo: ModoDePago | null;
  /** Solo «Deja adelanto»: hasta que alguien escriba el monto vale el 50 % sugerido del total vigente. */
  tocado: boolean;
  montoCentimos: number | null;
  medio: MedioDePago;
  /** La cuenta elegida; `null` mientras nadie la elija (vale la principal). */
  cuentaId: string | null;
  /** Día en que vence lo que queda por cobrar (`AAAA-MM-DD`); vacío si no hay. */
  venceEn: string;
};

export const PAGO_INICIAL: PagoDeHoja = { modo: null, tocado: false, montoCentimos: null, medio: 'efectivo', cuentaId: null, venceEn: '' };

export type CuentaParaCobrar = { id: string; nombre: string; esPrincipal: boolean };

/** El bloque se puede usar con cliente y total mayor que cero; antes se ve apagado, con su pista. */
export const puedeDefinirPago = (a: { clienteId: string | null | undefined; totalCentimos: number }): boolean => !!a.clienteId && a.totalCentimos > 0;

/** Lo que se cobra hoy: todo el total, el adelanto (el escrito o el 50 % sugerido) o nada. `null` si falta definirlo. */
export function montoDePago(pago: PagoDeHoja, totalCentimos: number): number | null {
  if (pago.modo === 'todo') return totalCentimos;
  if (pago.modo === 'ninguno') return 0;
  if (pago.modo === 'adelanto') return pago.tocado ? pago.montoCentimos : sugerirAdelanto(totalCentimos);
  return null;
}

/** Cuánto queda por cobrar tras el pago de hoy; `null` si el pago aún no es válido. */
export function saldoDePago(pago: PagoDeHoja, totalCentimos: number): number | null {
  if (pago.modo === 'todo') return 0;
  if (pago.modo === 'ninguno') return totalCentimos;
  const monto = montoDePago(pago, totalCentimos);
  return pago.modo === 'adelanto' && monto !== null && !errorDeMonto(monto, totalCentimos) ? totalCentimos - monto : null;
}

/** El adelanto es mayor que cero y menor que el total (si cubre todo, es «Pagó todo»). */
export function errorDeMonto(monto: number | null, totalCentimos: number): string | null {
  if (monto === null || !Number.isSafeInteger(monto) || monto <= 0) return 'Escribe el monto del adelanto.';
  if (monto >= totalCentimos) return 'El adelanto debe ser menor que el total. Si pagó todo, elige «Pagó todo».';
  return null;
}

export const errorDeVencimiento = (venceEn: string, hoy: string): string | null => (venceEn && venceEn < hoy ? 'El vencimiento no puede ser anterior a hoy.' : null);

/** La cuenta donde entra el dinero: la elegida; si no, la principal; si no hay principal, la única que exista. */
export function cuentaDeCobro(elegida: string | null, cuentas: readonly CuentaParaCobrar[] | null): string | null {
  if (elegida && (cuentas === null || cuentas.some((c) => c.id === elegida))) return elegida;
  const por = cuentas?.find((c) => c.esPrincipal) ?? (cuentas?.length === 1 ? cuentas[0] : undefined);
  return por?.id ?? null;
}

export type ErroresDePago = Partial<Record<'modo' | 'monto' | 'cuenta' | 'venceEn', string>>;

/** Los errores del pago. Con las cuentas sin cargar no se objeta la cuenta: el servidor usa la principal. */
export function validarPago(pago: PagoDeHoja, ctx: { totalCentimos: number; hoy: string; cuentas: readonly CuentaParaCobrar[] | null }): ErroresDePago {
  const e: ErroresDePago = {};
  if (!pago.modo) return { modo: 'Elige cómo paga el cliente.' };
  if (pago.modo === 'adelanto') {
    const monto = errorDeMonto(montoDePago(pago, ctx.totalCentimos), ctx.totalCentimos);
    if (monto) e.monto = monto;
  }
  if (pago.modo !== 'ninguno' && ctx.cuentas !== null && cuentaDeCobro(pago.cuentaId, ctx.cuentas) === null) {
    e.cuenta = ctx.cuentas.length === 0 ? 'No hay cuentas donde anotar el cobro. Crea una en Registro.' : 'Elige la cuenta donde entra el dinero.';
  }
  const vence = pago.modo === 'todo' ? null : errorDeVencimiento(pago.venceEn, ctx.hoy);
  if (vence) e.venceEn = vence;
  return e;
}

/** Antes de confirmar solo se muestran los errores que se corrigen al escribir; los demás, al intentar confirmar. */
export const erroresEnVivo = (e: ErroresDePago): ErroresDePago => ({ ...(e.monto && { monto: e.monto }), ...(e.venceEn && { venceEn: e.venceEn }) });

/** El pago ya validado, como lo recibe el flujo de confirmación. `null` si no hay modo. */
export function pagoAlConfirmar(pago: PagoDeHoja, totalCentimos: number, cuentas: readonly CuentaParaCobrar[] | null): PagoAlConfirmar | null {
  const venceEn = pago.venceEn || null;
  const cobro = { medio: pago.medio, cuentaId: cuentaDeCobro(pago.cuentaId, cuentas) };
  if (pago.modo === 'ninguno') return { modo: 'ninguno', venceEn };
  if (pago.modo === 'todo') return { modo: 'todo', ...cobro };
  if (pago.modo === 'adelanto') return { modo: 'adelanto', montoCentimos: montoDePago(pago, totalCentimos) ?? 0, venceEn, ...cobro };
  return null;
}
