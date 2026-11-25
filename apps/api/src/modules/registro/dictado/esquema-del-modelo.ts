// REGLA NUEVA (A2): lo que el modelo debe extraer de un dictado de Finanzas o de un pedido, y cómo. Puro: solo zod.
// El modelo SEGMENTA; no decide ids, no calcula fechas y no ejecuta nada. Todo campo es `nullable` (salida estricta); un texto
// vacío se trata como null al fusionar. Dinero en céntimos enteros y cantidades/precios por unidad en milésimas (regla 9).
import { z } from 'zod';

/** Los medios de pago de `movimiento_registrar` (MEDIOS_DE_PAGO de @capaz/shared; una prueba vigila que sigan iguales). */
export const MEDIOS_DICTABLES = ['efectivo', 'transferencia', 'yape', 'plin', 'tarjeta', 'otro'] as const;
export type MedioDictado = (typeof MEDIOS_DICTABLES)[number];

const TOPE = 10_000_000_000_000;

const lineaDelModelo = z.strictObject({
  descripcion: z.string().max(200),
  unidad: z.enum(['unidad', 'millar', 'docena']),
  cantidadMilesimas: z.number().int().positive().max(TOPE),
  precioUnitarioMilesimas: z.number().int().nonnegative().max(TOPE).nullable(),
});
export type LineaDelModelo = z.infer<typeof lineaDelModelo>;

export const esquemaDelModelo = z.strictObject({
  intencion: z.enum(['movimiento', 'abono', 'deuda', 'pedido', 'otro']),
  tipo: z.enum(['ingreso', 'egreso']).nullable(),
  montoCentimos: z.number().int().positive().max(TOPE).nullable(),
  adelantoCentimos: z.number().int().positive().max(TOPE).nullable(),
  tipoDeDeuda: z.enum(['por_cobrar', 'por_pagar']).nullable(),
  contactoNombre: z.string().max(120).nullable(),
  descripcion: z.string().max(200).nullable(),
  fechaDicha: z.string().max(60).nullable(),
  medioDePago: z.enum(MEDIOS_DICTABLES).nullable(),
  cuentaNombre: z.string().max(80).nullable(),
  lineas: z.array(lineaDelModelo).max(30),
  entregaDicha: z.string().max(60).nullable(),
});
export type ExtraccionDelModelo = z.infer<typeof esquemaDelModelo>;

/** Lo que llega en `EntradaDeInterprete.extraccion`, otra vez validado (el tipo es `unknown`). `null` si no sirve. */
export function leerExtraccionDelModelo(x: unknown): ExtraccionDelModelo | null {
  if (x === null || x === undefined) return null;
  const r = esquemaDelModelo.safeParse(x);
  return r.success ? r.data : null;
}

export const INSTRUCCIONES_DEL_MODELO = `Lees lo que dicta o escribe la persona que lleva el negocio (una imprenta pequeña en Perú; moneda: soles, S/) y lo separas en los campos del esquema para rellenar un formulario que ella revisará.

intencion:
- "movimiento": dinero que YA entró o salió (cobré, me pagó, vendí, ingreso, pagué, compré, gasté, egreso).
- "abono": un pago a cuenta de una deuda que ya existe (abona, amortiza, «a cuenta de su deuda»).
- "deuda": algo que queda pendiente de cobrar o de pagar (me quedó debiendo, le debo, «contrato de 240 con adelanto de 100»).
- "pedido": una orden o pedido de trabajo para un cliente, con uno o más trabajos y su precio.
- "otro": cualquier otra cosa (saludos, preguntas, proformas o cotizaciones).

tipo: "ingreso" si entra dinero al negocio, "egreso" si sale. null si no se sabe.
tipoDeDeuda: "por_cobrar" (le deben al negocio) o "por_pagar" (el negocio debe). null si no es deuda ni abono.

Dinero en CÉNTIMOS enteros (S/ 1 = 100): «500 soles» -> 50000; «45.50» -> 4550; «mil quinientos» -> 150000; «ochenta» -> 8000.
- montoCentimos: el total del movimiento, de la deuda o del abono. En un pedido va null (el dinero va en las líneas).
- adelantoCentimos: lo que se pagó a cuenta al encargar («adelanto», «a cuenta», «dejó 90»). null si no se dijo.

contactoNombre: el nombre del cliente o del proveedor tal como se dijo, sin «cliente», «proveedor», «señor», «señora», «don» ni «doña». null si no se dijo.
descripcion: el concepto en pocas palabras (qué se vendió, compró, pagó o hizo), sin el nombre ni el monto. null si no se dijo.
fechaDicha: la fecha del movimiento COPIADA tal como se dijo («ayer», «anteayer», «el lunes», «el 15 de octubre», «hace 3 días»). No la calcules. null si no se dijo.
medioDePago: "efectivo", "transferencia" (también depósito), "yape", "plin", "tarjeta" u "otro". null si no se dijo.
cuentaNombre: la cuenta, caja o banco que se nombró («caja chica», «BCP»). null si no se nombró.

lineas (solo en pedidos; en lo demás, lista vacía): un elemento por cada trabajo.
- unidad: "millar" si se cuenta por millares, "docena" si por docenas; si no, "unidad".
- cantidadMilesimas: la cantidad en esa unidad × 1000 («500 tarjetas» -> 500000; «un millar» -> 1000; «2 docenas» -> 2000).
- precioUnitarioMilesimas: el precio de UNA unidad de esa unidad, en soles × 1000 («a 0.365 cada una» -> 365; «el millar a 240» -> 240000). null si no se dijo el precio.
- Si solo se dijo el valor del trabajo entero («un banner de 90», «fabricación de un troquel, valor 180»): unidad "unidad", cantidadMilesimas 1000 y ese valor × 1000 como precio.
- descripcion: el trabajo, sin cantidad, precio, cliente, adelanto ni etiquetas como «descripción:» o «valor:».
entregaDicha: la fecha de entrega del pedido COPIADA tal como se dijo («para el viernes», «mañana», «en 3 días»). null si no se dijo.`;
