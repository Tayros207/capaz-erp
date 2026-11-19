import type { DetalleDeEventoDePedido, EntradaDe, PedidoDto } from '@capaz/shared';
import { lineasDeHuellaDeCorreccion } from './huella-de-correccion.ts';
import { formatearDia } from './logica.ts';

// Lógica pura de «Editar datos» de un pedido confirmado: qué se envía, qué se valida y cómo se lee la huella en el historial.

export type FormularioDeDatos = { entregaEl: string; responsableId: string; notas: string; motivo: string };
export type ErroresDeDatos = Partial<Record<keyof FormularioDeDatos, string>>;
export const MAXIMO_DE_MOTIVO = 300;
export const MAXIMO_DE_NOTAS = 4000;

type Base = Pick<PedidoDto, 'entregaEl' | 'responsableId' | 'notas' | 'fecha'>;

export const formularioDeDatosDesde = (p: Base): FormularioDeDatos => ({ entregaEl: p.entregaEl ?? '', responsableId: p.responsableId ?? '', notas: p.notas ?? '', motivo: '' });

export type ArgumentosDeDatos = Omit<EntradaDe<'pedido_editar_datos'>, 'id'>;

/** Solo lo que cambió respecto del pedido; vacío quita el valor. `null` si no hay nada que enviar. */
export function cambiosDeFormulario(p: Base, f: FormularioDeDatos): ArgumentosDeDatos | null {
  const args: ArgumentosDeDatos = {};
  if (f.entregaEl !== (p.entregaEl ?? '')) args.entregaEl = f.entregaEl || null;
  if (f.responsableId !== (p.responsableId ?? '')) args.responsableId = f.responsableId || null;
  if (f.notas.trim() !== (p.notas ?? '')) args.notas = f.notas.trim() || null;
  if (Object.keys(args).length === 0) return null;
  if (f.motivo.trim()) args.motivo = f.motivo.trim();
  return args;
}

/** Los mismos límites que el servidor, para avisar antes de enviar. */
export function validarDatos(p: Base, f: FormularioDeDatos): ErroresDeDatos {
  const e: ErroresDeDatos = {};
  if (f.entregaEl && f.entregaEl < p.fecha) e.entregaEl = `La entrega no puede ser anterior a la fecha del pedido (${formatearDia(p.fecha)}).`;
  if (f.notas.length > MAXIMO_DE_NOTAS) e.notas = `Las notas admiten hasta ${MAXIMO_DE_NOTAS} caracteres.`;
  if (f.motivo.length > MAXIMO_DE_MOTIVO) e.motivo = `El motivo admite hasta ${MAXIMO_DE_MOTIVO} caracteres.`;
  return e;
}

const NOMBRE_DE_CAMPO = { entregaEl: 'Entrega', responsableId: 'Responsable', notas: 'Notas' } as const;
const RECORTE = 80;
const recortar = (t: string) => (t.length > RECORTE ? `${t.slice(0, RECORTE)}…` : t);

function valorLegible(campo: keyof typeof NOMBRE_DE_CAMPO, valor: string | null, etiqueta: string | null | undefined): string {
  if (valor === null) return campo === 'responsableId' ? 'sin responsable' : '—';
  if (campo === 'entregaEl') return formatearDia(valor);
  if (campo === 'responsableId') return etiqueta ?? 'alguien que ya no está en la empresa';
  return recortar(valor);
}

/** Una línea por campo cambiado, «Entrega: 10/03/2026 → 15/03/2026», y el motivo al final si lo hay. */
export function lineasDeHuella(d: DetalleDeEventoDePedido | null): string[] {
  if (!d) return [];
  if (d.correccion) return lineasDeHuellaDeCorreccion(d.correccion);
  const lineas = d.cambios.map((c) => `${NOMBRE_DE_CAMPO[c.campo]}: ${valorLegible(c.campo, c.antes, c.antesEtiqueta)} → ${valorLegible(c.campo, c.despues, c.despuesEtiqueta)}`);
  return d.motivo ? [...lineas, `Motivo: ${d.motivo}`] : lineas;
}
