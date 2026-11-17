import { centimosSchema, formatearSoles, PREFIJO_DE_PRECIOS_CAMBIARON, type AjusteDePrecio, type Centimos, type PrecioConsultadoDto } from '@capaz/shared';

// Lógica pura del ajuste de precio de una cotización, la tabla de precios y los avisos de la rápida. Los precios los
// calcula el servidor; aquí solo se arma lo que se envía y se explica lo que devuelve.

export type TipoDeAjuste = 'ninguno' | 'precio' | 'sumar' | 'restar';
export type AjusteDeFormulario = { tipo: TipoDeAjuste; centimos: Centimos | null };

export const SIN_AJUSTE: AjusteDeFormulario = { tipo: 'ninguno', centimos: null };
export const OPCIONES_DE_AJUSTE: ReadonlyArray<{ valor: TipoDeAjuste; etiqueta: string }> = [
  { valor: 'ninguno', etiqueta: 'Lista' },
  { valor: 'precio', etiqueta: 'A mano' },
  { valor: 'sumar', etiqueta: 'Sumar' },
  { valor: 'restar', etiqueta: 'Restar' },
];
export const CANTIDADES_RAPIDAS = [100, 1000, 5000] as const;

/** Un ajuste del servidor, como lo muestra el formulario: el monto negativo es «Restar» (en positivo). */
export function ajusteDeFormulario(a: AjusteDePrecio | null | undefined): AjusteDeFormulario {
  if (!a || a.tipo === 'ninguno') return SIN_AJUSTE;
  if (a.tipo === 'precio') return { tipo: 'precio', centimos: centimosSchema.parse(a.importeCentimos) };
  return { tipo: a.importeCentimos < 0 ? 'restar' : 'sumar', centimos: centimosSchema.parse(Math.abs(a.importeCentimos)) };
}

/** Lo que se envía: sin monto (o monto cero en sumar y restar) no hay ajuste. */
export function ajusteParaEnviar(f: AjusteDeFormulario): AjusteDePrecio {
  const c = f.centimos;
  if (f.tipo === 'ninguno' || c === null || c <= 0) return { tipo: 'ninguno' };
  if (f.tipo === 'precio') return { tipo: 'precio', importeCentimos: c };
  return { tipo: 'monto', importeCentimos: f.tipo === 'restar' ? -c : c };
}

/** Falta el monto, o restar deja el precio en cero o menos (`precioListaCentimos`, si ya se conoce). */
export function validarAjuste(f: AjusteDeFormulario, precioListaCentimos: number | null = null): string | undefined {
  if (f.tipo === 'ninguno') return undefined;
  if (f.centimos === null || f.centimos <= 0) return f.tipo === 'precio' ? 'Escribe el precio.' : 'Escribe el monto.';
  if (f.tipo === 'restar' && precioListaCentimos !== null && f.centimos >= precioListaCentimos) return 'El precio final debe ser mayor que cero.';
  return undefined;
}

/** «Ajustado solo para esta cotización»: la insignia de una línea con ajuste. */
export const TEXTO_DE_LINEA_AJUSTADA = 'Ajustado solo para esta cotización';
export const textoDePrecioDeLista = (centimos: number): string => `Precio de lista: ${formatearSoles(centimosSchema.parse(centimos))}`;

export function textoDeAjusteDeLinea(a: AjusteDePrecio | null): string {
  if (!a || a.tipo === 'ninguno') return '';
  const c = centimosSchema.parse(Math.abs(a.importeCentimos));
  if (a.tipo === 'precio') return `A mano: ${formatearSoles(c)}`;
  return `${a.importeCentimos < 0 ? 'Resta' : 'Suma'} ${formatearSoles(c)}`;
}

// --- Cotización rápida ---

export type AvisosDeRapida = { estimacion: boolean; cambiaPorTramos: boolean };

/** «Precio estimado entre referencias» (cantidad que no es 100, 1.000 ni 5.000) y «cambia por tramos» (modo escalón). */
export const avisosDeRapida = (p: Pick<PrecioConsultadoDto, 'estimacion' | 'escalon'>): AvisosDeRapida => ({ estimacion: p.estimacion, cambiaPorTramos: p.escalon !== null });
export const TEXTO_DE_ESTIMACION = 'Precio estimado entre referencias: tus precios fijos son 100, 1.000 y 5.000 unidades.';
export const TEXTO_DE_TRAMOS = 'El precio cambia por tramos: rige el unitario de la referencia anterior.';
export const TEXTO_DE_UNITARIO = 'Unitario informativo: manda el total del lote.';

/** ¿El rechazo de emitir es «los precios de lista cambiaron»? La pantalla pregunta si se aceptan los de hoy. */
export const pidePreciosDeHoy = (codigo: string, mensaje: string): boolean => codigo === 'conflicto' && mensaje.startsWith(PREFIJO_DE_PRECIOS_CAMBIARON);

/** El mensaje del rechazo sin el prefijo fijo: solo los avisos de cada línea. */
export const avisosDeRechazoDePrecios = (mensaje: string): string[] =>
  mensaje.slice(PREFIJO_DE_PRECIOS_CAMBIARON.length).replace(/\s*Acepta los precios de hoy para emitirla\.$/, '').split(/\.\s+(?=El precio de lista)/).map((t) => t.trim().replace(/\.$/, '')).filter((t) => t !== '');
