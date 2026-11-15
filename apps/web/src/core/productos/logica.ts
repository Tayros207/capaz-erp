import type { EntradaDe, ProductoDto } from '@capaz/shared';

// Lógica pura de las pantallas de Productos: precio en milésimas de sol (ADR-012), formulario y argumentos.

export type TipoDeProducto = 'producto' | 'servicio';

export type FormularioDeProducto = {
  codigo: string;
  nombre: string;
  tipo: TipoDeProducto;
  unidad: string;
  /** Lo que escribe la persona, en soles: «12.50». */
  precio: string;
  afectoIgv: boolean;
  descripcion: string;
};
export type ErroresDeProducto = Partial<Record<keyof FormularioDeProducto, string>>;

export const ETIQUETA_DE_TIPO: Record<TipoDeProducto, string> = { producto: 'Producto', servicio: 'Servicio' };

export const FORMULARIO_VACIO: FormularioDeProducto = { codigo: '', nombre: '', tipo: 'producto', unidad: '', precio: '', afectoIgv: true, descripcion: '' };

const PRECIO = /^\d+(\.\d{1,3})?$/;

/** «S/ 1,234.5» → 1234500 milésimas; nulo si no es un precio válido (hasta 3 decimales, sin negativos). Vacío es nulo. */
export function textoAMilesimas(texto: string): number | null {
  const limpio = texto.replace(/^\s*S\/\.?\s*/i, '').replace(/,/g, '').trim();
  if (!PRECIO.test(limpio)) return null;
  const [enteros = '0', decimales = ''] = limpio.split('.');
  const valor = Number(enteros) * 1000 + Number(decimales.padEnd(3, '0'));
  return Number.isSafeInteger(valor) ? valor : null;
}

/** 12500 → «12.50»; 12505 → «12.505» (se muestran los tres decimales solo si hacen falta). */
export function milesimasATexto(milesimas: number): string {
  const enteros = Math.trunc(milesimas / 1000);
  const decimales = String(milesimas % 1000).padStart(3, '0');
  const conComas = enteros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${conComas}.${decimales.endsWith('0') ? decimales.slice(0, 2) : decimales}`;
}

export const formatearPrecio = (milesimas: number): string => `S/ ${milesimasATexto(milesimas)}`;

export function formularioDesde(p: ProductoDto): FormularioDeProducto {
  return {
    codigo: p.codigo ?? '',
    nombre: p.nombre,
    tipo: p.tipo,
    unidad: p.unidad,
    precio: milesimasATexto(p.precioUnitarioMilesimas).replace(/,/g, ''),
    afectoIgv: p.afectoIgv,
    descripcion: p.descripcion ?? '',
  };
}

export function validarProducto(f: FormularioDeProducto): ErroresDeProducto {
  const e: ErroresDeProducto = {};
  if (!f.nombre.trim()) e.nombre = 'El nombre es obligatorio.';
  if (f.precio.trim() && textoAMilesimas(f.precio) === null) e.precio = 'Escribe un precio válido, por ejemplo 12.50.';
  return e;
}

const vacioANulo = (t: string): string | null => (t.trim() === '' ? null : t.trim());

/** Argumentos de `productos_crear`: lo vacío se omite. */
export function argumentosDeCreacion(f: FormularioDeProducto): EntradaDe<'productos_crear'> {
  const args: EntradaDe<'productos_crear'> = { tipo: f.tipo, nombre: f.nombre.trim(), afectoIgv: f.afectoIgv };
  if (f.codigo.trim()) args.codigo = f.codigo.trim();
  if (f.unidad.trim()) args.unidad = f.unidad.trim();
  if (f.descripcion.trim()) args.descripcion = f.descripcion.trim();
  const precio = textoAMilesimas(f.precio);
  if (precio !== null) args.precioUnitarioMilesimas = precio;
  return args;
}

/** Argumentos de `productos_editar`: solo lo que cambió (`null` borra código y descripción). Nulo si nada cambió. */
export function argumentosDeEdicion(original: ProductoDto, f: FormularioDeProducto): EntradaDe<'productos_editar'> | null {
  const antes = formularioDesde(original);
  const args: EntradaDe<'productos_editar'> = { id: original.id };
  let cambio = false;
  const marcar = () => {
    cambio = true;
  };
  if (f.nombre.trim() !== antes.nombre) {
    args.nombre = f.nombre.trim();
    marcar();
  }
  if (f.tipo !== antes.tipo) {
    args.tipo = f.tipo;
    marcar();
  }
  if (f.codigo.trim() !== antes.codigo) {
    args.codigo = vacioANulo(f.codigo);
    marcar();
  }
  if (f.unidad.trim() !== antes.unidad && f.unidad.trim()) {
    args.unidad = f.unidad.trim();
    marcar();
  }
  if (f.descripcion.trim() !== antes.descripcion) {
    args.descripcion = vacioANulo(f.descripcion);
    marcar();
  }
  if (f.afectoIgv !== antes.afectoIgv) {
    args.afectoIgv = f.afectoIgv;
    marcar();
  }
  const precio = textoAMilesimas(f.precio);
  if (precio !== null && precio !== original.precioUnitarioMilesimas) {
    args.precioUnitarioMilesimas = precio;
    marcar();
  }
  return cambio ? args : null;
}

export function mensajeDeRechazo(codigo: string, mensaje: string): string {
  if (codigo === 'conflicto') return mensaje || 'Ya existe un producto con esos datos.';
  if (codigo === 'sin_permiso') return 'No tienes permiso para modificar productos.';
  if (codigo === 'sin_conexion') return 'No hay conexión con el servidor. Inténtalo de nuevo.';
  return mensaje;
}
