// Comandos sobre las filas del cuadro: agregar (de una tarifa o a mano), editar un dato y quitar.
import { z } from 'zod';
import type { ReferenciaDeFila } from '@capaz/shared';
import { costoUnitarioSchema, cantidadSchema } from './motor/base/esquemas-decimales.js';
import { ESCALAS, FACTORES } from './motor/base/dominio.js';
import { ESCALA_POR_DEFECTO, UNIDAD_POR_DEFECTO } from './motor/costeo/constantes/factores.js';
import { MAX_LINEAS } from './motor/costeo/tipos/borrador.js';
import { lineaSchema } from './motor/costeo/tipos/cotizacion.js';
import type { Cuadro, Linea, ResultadoDeComando } from './cuadro-tipos.js';
import { avisoDeFilaManual, candidataDeLinea, insertarLinea, resolverLinea, soltarSiEsAutomatica } from './cuadro-filas.js';
import { rechazarCuadro } from './cuadro-tipos.js';

type Factor = (typeof FACTORES)[number];
type Escala = (typeof ESCALAS)[number];

/** Lo que se copia de una tarifa del taller al agregarla: el costo se COPIA, cambiar la tarifa después no reescribe el cuadro. */
export type TarifaCopiada = { factor: Factor; nombre: string; unidad: string; costoUnitario: string; escalaPorDefecto: Escala };

export type DatosDeLinea = {
  tarifa?: TarifaCopiada | undefined;
  factor?: Factor | undefined;
  descripcion?: string | undefined;
  cantidad: string;
  unidad?: string | undefined;
  costoUnitario?: string | undefined;
  escala?: Escala | undefined;
};

function nuevaLinea(id: string, a: DatosDeLinea): Linea {
  const t = a.tarifa;
  const factor = (a.factor ?? t?.factor) as Factor;
  return {
    id,
    factor,
    descripcion: (a.descripcion ?? t?.nombre) as string,
    cantidad: a.cantidad,
    unidad: a.unidad ?? t?.unidad ?? UNIDAD_POR_DEFECTO[factor],
    costoUnitario: (a.costoUnitario ?? t?.costoUnitario) as string,
    escala: a.escala ?? t?.escalaPorDefecto ?? ESCALA_POR_DEFECTO[factor],
  };
}

export function aplicarAgregarLinea(cuadro: Cuadro, a: DatosDeLinea): ResultadoDeComando {
  if (cuadro.lineas.length >= MAX_LINEAS) return rechazarCuadro('conflicto', `El cuadro admite hasta ${MAX_LINEAS} filas: quita alguna antes de agregar otra.`);
  const id = `l${cuadro.siguienteLinea}`;
  cuadro.lineas = insertarLinea(cuadro.lineas, nuevaLinea(id, a));
  cuadro.siguienteLinea += 1;
  const indice = cuadro.lineas.findIndex((l) => l.id === id);
  const linea = cuadro.lineas[indice];
  return { ok: true, cuadro, avisos: [], ...(linea ? { linea: candidataDeLinea(linea, indice + 1) } : {}) };
}

export const CAMPOS_DE_FILA = ['descripcion', 'cantidad', 'unidad', 'costoUnitario', 'escala', 'factor'] as const;
export type CampoDeFila = (typeof CAMPOS_DE_FILA)[number];

// Cada campo se valida con el mismo esquema que la fila; `valor` siempre llega como texto.
const ESQUEMA_DE_CAMPO = {
  descripcion: lineaSchema.shape.descripcion,
  cantidad: cantidadSchema,
  unidad: lineaSchema.shape.unidad,
  costoUnitario: costoUnitarioSchema,
  escala: z.enum(ESCALAS),
  factor: z.enum(FACTORES),
} satisfies Record<CampoDeFila, z.ZodType>;

export function aplicarEditarLinea(cuadro: Cuadro, ref: ReferenciaDeFila, campo: CampoDeFila, valor: string): ResultadoDeComando {
  const r = resolverLinea(cuadro.lineas, ref);
  if (!r.ok) return r;
  const valido = ESQUEMA_DE_CAMPO[campo].safeParse(valor);
  if (!valido.success) return rechazarCuadro('argumentos_invalidos', `${campo}: ${valido.error.issues[0]?.message ?? 'valor inválido'}`);
  const editada = { ...r.linea, [campo]: valido.data } as Linea;
  const avisos = [];
  if (campo === 'cantidad' || campo === 'factor') {
    const cual = soltarSiEsAutomatica(cuadro, editada.id);
    if (cual) avisos.push(avisoDeFilaManual(editada.descripcion, cual));
  }
  const sinLaFila = cuadro.lineas.filter((l) => l.id !== editada.id);
  cuadro.lineas = campo === 'factor' ? insertarLinea(sinLaFila, editada) : cuadro.lineas.map((l) => (l.id === editada.id ? editada : l));
  const indice = cuadro.lineas.findIndex((l) => l.id === editada.id);
  return { ok: true, cuadro, avisos, linea: candidataDeLinea(editada, indice + 1) };
}

export function aplicarQuitarLinea(cuadro: Cuadro, ref: ReferenciaDeFila): ResultadoDeComando {
  const r = resolverLinea(cuadro.lineas, ref);
  if (!r.ok) return r;
  const quitada = candidataDeLinea(r.linea, r.indice + 1);
  const avisos = [];
  const cual = soltarSiEsAutomatica(cuadro, r.linea.id);
  if (cual) avisos.push(avisoDeFilaManual(r.linea.descripcion, cual));
  cuadro.lineas = cuadro.lineas.filter((l) => l.id !== r.linea.id);
  return { ok: true, cuadro, avisos, linea: quitada };
}

/** Lo que cambia el costo de una fila: sin el permiso de costos no se escribe a mano (copiar el de una tarifa sí). */
export const escribeCostoAMano = (a: { costoUnitario?: string | undefined }): boolean => a.costoUnitario !== undefined;
