import {
  crearClienteSchema,
  crearProductoSchema,
  type ArgsDe,
  type EntidadDeIntercambio,
} from '@capaz/shared';
import { mensajeDeZod, OPCIONES_EN_ESPANOL } from '../herramientas/errores-de-zod.js';
import { prepararCliente, type EntradaDeCliente } from '../clientes/domain/cliente.js';
import { normalizarNombre } from '../clientes/domain/normalizacion.js';
import { prepararProducto, type EntradaDeProducto } from '../productos/domain/producto.js';

// Mapas de columnas por entidad: encabezado del archivo → campo, y fila → argumentos de la herramienta
// `*_crear` (que vuelve a validar todo con el dominio de S3: aquí solo se detecta el error con su fila).

/** Encabezado comparable: sin tildes, en minúsculas y solo letras y cifras («Número de documento» = `numerodedocumento`). */
export const claveDeEncabezado = (t: string): string => normalizarNombre(t).replace(/[^a-z0-9]/g, '');

type Mapa = Record<string, readonly string[]>;

/** Campo → encabezados aceptados (ya en forma comparable). El primero es el que escribe la exportación. */
const MAPA_CLIENTES: Mapa = {
  tipo: ['tipo'],
  clase: ['clase'],
  nombre: ['nombre', 'razonsocial', 'nombreorazonsocial'],
  documentoTipo: ['tipodedocumento', 'documentotipo', 'tipodocumento'],
  documentoNumero: ['numerodedocumento', 'documentonumero', 'numerodocumento', 'documento', 'nrodocumento'],
  telefono: ['telefono', 'celular'],
  correo: ['correo', 'email', 'correoelectronico'],
  direccion: ['direccion'],
  notas: ['notas', 'nota', 'observaciones'],
};

const MAPA_PRODUCTOS: Mapa = {
  codigo: ['codigo', 'sku'],
  nombre: ['nombre', 'producto', 'descripcioncorta'],
  tipo: ['tipo'],
  unidad: ['unidad', 'unidaddemedida'],
  precio: ['precio', 'preciounitario', 'preciosoles'],
  afectoIgv: ['afectoaigv', 'afectoigv', 'igv'],
  descripcion: ['descripcion', 'detalle'],
};

export const MAPAS: Record<EntidadDeIntercambio, Mapa> = { clientes: MAPA_CLIENTES, productos: MAPA_PRODUCTOS };

/** Encabezados que escribe la exportación y que la importación reconoce tal cual. */
export const ENCABEZADOS_DE_EXPORTACION: Record<EntidadDeIntercambio, readonly string[]> = {
  clientes: ['tipo', 'clase', 'nombre', 'tipo de documento', 'numero de documento', 'telefono', 'correo', 'direccion', 'notas'],
  productos: ['codigo', 'nombre', 'tipo', 'unidad', 'precio', 'afecto a igv', 'descripcion'],
};

export type Columnas = { indices: Record<string, number>; ignoradas: string[] } | { error: string };

/** Relaciona el encabezado del archivo con los campos de la entidad. Falta `nombre` o se repite un campo: error de archivo. */
export function mapearColumnas(entidad: EntidadDeIntercambio, encabezado: readonly string[]): Columnas {
  const mapa = MAPAS[entidad];
  const indices: Record<string, number> = {};
  const ignoradas: string[] = [];
  for (const [i, bruto] of encabezado.entries()) {
    const clave = claveDeEncabezado(bruto);
    const campo = Object.keys(mapa).find((c) => mapa[c]!.includes(clave));
    if (!campo) {
      if (bruto.trim()) ignoradas.push(bruto.trim());
    } else if (campo in indices) {
      return { error: `La columna «${bruto.trim()}» repite el campo «${campo}».` };
    } else indices[campo] = i;
  }
  if (!('nombre' in indices)) return { error: 'Falta la columna «nombre» en el encabezado.' };
  return { indices, ignoradas };
}

const celda = (celdas: readonly string[], indices: Record<string, number>, campo: string): string | undefined => {
  const i = indices[campo];
  const v = i === undefined ? undefined : celdas[i]?.trim();
  return v ? v : undefined;
};

/** Clave de duplicado de una fila ya validada. */
export type ClaveDeFila = { nombre: string; documento?: string; codigo?: string };

export type FilaValida<N extends 'clientes_crear' | 'productos_crear'> = { args: ArgsDe<N>; clave: ClaveDeFila };
export type ResultadoDeFila<N extends 'clientes_crear' | 'productos_crear'> = { ok: true; valor: FilaValida<N> } | { ok: false; motivo: string };

const minusculas = (v: string | undefined) => v?.toLowerCase();

export function filaDeCliente(celdas: readonly string[], indices: Record<string, number>): ResultadoDeFila<'clientes_crear'> {
  const g = (c: string) => celda(celdas, indices, c);
  const crudo = {
    tipo: minusculas(g('tipo')),
    clase: minusculas(g('clase')),
    nombre: g('nombre'),
    documentoTipo: minusculas(g('documentoTipo')),
    documentoNumero: g('documentoNumero'),
    telefono: g('telefono'),
    correo: g('correo'),
    direccion: g('direccion'),
    notas: g('notas'),
  };
  const parseo = crearClienteSchema.safeParse(Object.fromEntries(Object.entries(crudo).filter(([, v]) => v !== undefined)), OPCIONES_EN_ESPANOL);
  if (!parseo.success) return { ok: false, motivo: mensajeDeZod(parseo.error) };
  const args = parseo.data;
  // Igual que `clientes_crear`: sin clase, un RUC es empresa y lo demás persona.
  const entrada: EntradaDeCliente = { ...args, clase: args.clase ?? (args.documentoTipo === 'ruc' ? 'empresa' : 'persona') };
  const p = prepararCliente(entrada);
  if (!p.ok) return { ok: false, motivo: p.motivo };
  const documento = p.datos.documentoNumero ? `${p.datos.documentoTipo}:${p.datos.documentoNumero}` : undefined;
  return { ok: true, valor: { args, clave: { nombre: p.datos.nombreNormalizado, ...(documento && { documento }) } } };
}

/** «25», «25.5», «25,50» o «25.125» (hasta tres decimales) a milésimas de sol, sin pasar por decimales binarios. */
export function milesimasDeTexto(t: string): number | null {
  const m = /^(\d{1,9})(?:[.,](\d{1,3}))?$/.exec(t.trim());
  if (!m) return null;
  return Number(m[1]) * 1000 + Number((m[2] ?? '').padEnd(3, '0'));
}

/** Milésimas a soles con al menos dos decimales: 25000 → «25.00», 25125 → «25.125». */
export function textoDeMilesimas(m: number): string {
  const enteros = Math.floor(m / 1000);
  const resto = String(m % 1000).padStart(3, '0');
  return `${enteros}.${resto.endsWith('0') ? resto.slice(0, 2) : resto}`;
}

const SI = new Set(['si', 'sí', 's', '1', 'true', 'verdadero']);
const NO = new Set(['no', 'n', '0', 'false', 'falso']);

export function filaDeProducto(celdas: readonly string[], indices: Record<string, number>): ResultadoDeFila<'productos_crear'> {
  const g = (c: string) => celda(celdas, indices, c);
  const precioTexto = g('precio');
  const precio = precioTexto === undefined ? undefined : milesimasDeTexto(precioTexto);
  if (precio === null) return { ok: false, motivo: 'precio: usa un número en soles, por ejemplo 25 o 25.50 (hasta tres decimales).' };
  const igvTexto = minusculas(g('afectoIgv'));
  if (igvTexto !== undefined && !SI.has(igvTexto) && !NO.has(igvTexto)) return { ok: false, motivo: 'afecto a IGV: escribe si o no.' };
  const crudo = {
    codigo: g('codigo'),
    nombre: g('nombre'),
    tipo: minusculas(g('tipo')),
    unidad: g('unidad'),
    precioUnitarioMilesimas: precio,
    afectoIgv: igvTexto === undefined ? undefined : SI.has(igvTexto),
    descripcion: g('descripcion'),
  };
  const parseo = crearProductoSchema.safeParse(Object.fromEntries(Object.entries(crudo).filter(([, v]) => v !== undefined)), OPCIONES_EN_ESPANOL);
  if (!parseo.success) return { ok: false, motivo: mensajeDeZod(parseo.error) };
  const p = prepararProducto(parseo.data as EntradaDeProducto);
  if (!p.ok) return { ok: false, motivo: p.motivo };
  return { ok: true, valor: { args: parseo.data, clave: { nombre: p.datos.nombreNormalizado, ...(p.datos.codigo && { codigo: p.datos.codigo }) } } };
}
