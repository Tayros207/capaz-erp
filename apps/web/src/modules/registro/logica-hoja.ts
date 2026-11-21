import type { CategoriaDto } from '@capaz/shared';
import { ETIQUETA_DE_MEDIO, formatearDia, formularioInicial, siguienteFormulario, type ErroresDeMovimiento, type FormularioDeMovimiento, type TipoDeMovimiento } from './logica.ts';
import { filaDeProductoVacia } from './logica-lineas.ts';

// Lo que sabe la hoja de «Nuevo ingreso / Nuevo egreso» y «Editar»: las preguntas, el resumen de «Más datos», qué falta para
// guardar y la última categoría usada. Texto sencillo; sin React ni red.

/** La hoja arranca con UNA fila de producto lista para elegir. */
export const formularioParaCaptura = (tipo: TipoDeMovimiento, hoy: string, cuentas: Parameters<typeof formularioInicial>[2]): FormularioDeMovimiento => ({
  ...formularioInicial(tipo, hoy, cuentas),
  productos: [filaDeProductoVacia('n1')],
});

/** Tras guardar: vacío, con una fila de producto lista; se conserva lo que casi siempre se repite (fecha, cuenta, medio y categoría). */
export const siguienteParaCaptura = (f: FormularioDeMovimiento): FormularioDeMovimiento => ({
  ...siguienteFormulario(f),
  categoriaId: f.categoriaId,
  productos: [filaDeProductoVacia('n1')],
});

export type Preguntas = { persona: string; personaPlaceholder: string; productos: string; categoria: string };

export const preguntasDe = (tipo: TipoDeMovimiento): Preguntas =>
  tipo === 'ingreso'
    ? { persona: '¿Quién es el cliente?', personaPlaceholder: 'Ej: Turrones Kerico', productos: '¿Qué vendiste?', categoria: '¿Qué vendiste? (categoría)' }
    : { persona: '¿A quién le compraste?', personaPlaceholder: 'Ej: Papelera Lima', productos: '¿Qué compraste?', categoria: '¿En qué gastaste? (categoría)' };

/** El texto del botón principal. */
export function textoDelBoton(f: Pick<FormularioDeMovimiento, 'tipo' | 'conAdelanto'>): string {
  if (f.conAdelanto) return 'Registrar con adelanto';
  return f.tipo === 'ingreso' ? 'Registrar ingreso' : 'Registrar egreso';
}

type Resumible = Pick<FormularioDeMovimiento, 'fecha' | 'medioDePago' | 'descripcion'>;

/** «Hoy · Caja · Efectivo»: lo que quedó por defecto, para verlo sin abrir «Más datos». */
export function resumenDeMasDatos(f: Resumible, hoy: string, cuentaNombre: string | null, categoriaNombre: string | null): string {
  const partes = [f.fecha === hoy ? 'Hoy' : formatearDia(f.fecha), cuentaNombre ?? 'Sin cuenta', ETIQUETA_DE_MEDIO[f.medioDePago]];
  if (categoriaNombre) partes.push(categoriaNombre);
  if (f.descripcion.trim()) partes.push('con nota');
  return partes.join(' · ');
}

/** «Más datos» nace abierto si ahí hay algo distinto de lo habitual (otra fecha, otro medio, una nota) o un error. */
export function masDatosNaceAbierto(f: Resumible, hoy: string, errores: ErroresDeMovimiento): boolean {
  return f.fecha !== hoy || f.medioDePago !== 'efectivo' || f.descripcion.trim() !== '' || Boolean(errores.fecha || errores.descripcion || errores.cuentaId);
}

/** Los campos de la hoja, en el orden en que se leen: el primero con error es el que se señala. */
export const CAMPOS_EN_ORDEN = ['contacto', 'productos', 'monto', 'adelanto', 'venceEn', 'fecha', 'descripcion', 'cuentaId'] as const;
export type CampoDeHoja = (typeof CAMPOS_EN_ORDEN)[number];
export const CAMPOS_DE_MAS_DATOS: readonly CampoDeHoja[] = ['fecha', 'descripcion', 'cuentaId'];

/** Qué falta primero y en qué campo, para la pista junto al botón y para llevar el foco ahí. `null` si está completo. */
export function primeraPista(e: ErroresDeMovimiento): { campo: CampoDeHoja; texto: string } | null {
  for (const campo of CAMPOS_EN_ORDEN) {
    const texto = e[campo];
    if (texto) return { campo, texto };
  }
  return null;
}

// La última categoría usada de cada tipo se recuerda en este navegador para ofrecerla ya elegida (solo una comodidad: si no hay
// almacenamiento, simplemente no se recuerda).
const claveDeCategoria = (tipo: TipoDeMovimiento): string => `capaz.registro.categoria.${tipo}`;

export function ultimaCategoriaUsada(tipo: TipoDeMovimiento, categorias: readonly CategoriaDto[]): string {
  try {
    const id = window.localStorage.getItem(claveDeCategoria(tipo));
    return id && categorias.some((c) => c.id === id) ? id : '';
  } catch {
    return '';
  }
}

export function recordarCategoria(tipo: TipoDeMovimiento, categoriaId: string): void {
  try {
    if (categoriaId) window.localStorage.setItem(claveDeCategoria(tipo), categoriaId);
  } catch {
    /* sin almacenamiento: no se recuerda */
  }
}
