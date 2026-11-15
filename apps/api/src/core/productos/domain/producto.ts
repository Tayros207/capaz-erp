import { normalizarNombre, textoOpcional } from '../../clientes/domain/normalizacion.js';

export type TipoDeProducto = 'producto' | 'servicio';

export type EntradaDeProducto = {
  codigo?: string | null;
  nombre: string;
  tipo: TipoDeProducto;
  unidad?: string;
  /** Milésimas de sol (ADR-012): entero, nunca decimal. */
  precioUnitarioMilesimas?: number;
  afectoIgv?: boolean;
  descripcion?: string | null;
};

export type DatosDeProducto = {
  codigo: string | null;
  nombre: string;
  nombreNormalizado: string;
  tipo: TipoDeProducto;
  unidad: string;
  precioUnitarioMilesimas: number;
  afectoIgv: boolean;
  descripcion: string | null;
};

export type ResultadoProducto = { ok: true; datos: DatosDeProducto } | { ok: false; campo: string; motivo: string };

const fallo = (campo: string, motivo: string): ResultadoProducto => ({ ok: false, campo, motivo });

export function prepararProducto(e: EntradaDeProducto): ResultadoProducto {
  const nombre = e.nombre.replace(/\s+/g, ' ').trim();
  if (!nombre) return fallo('nombre', 'El nombre es obligatorio.');
  const precio = e.precioUnitarioMilesimas ?? 0;
  if (!Number.isSafeInteger(precio) || precio < 0) return fallo('precioUnitarioMilesimas', 'El precio debe ser un entero de milésimas, de 0 en adelante.');
  const codigo = textoOpcional(e.codigo)?.toUpperCase() ?? null;
  if (codigo && !/^[A-Z0-9][A-Z0-9._\-/]{0,39}$/.test(codigo)) return fallo('codigo', 'El código admite letras, cifras y . _ - / (hasta 40).');
  const unidad = textoOpcional(e.unidad)?.toLowerCase() ?? 'unidad';
  return {
    ok: true,
    datos: {
      codigo,
      nombre,
      nombreNormalizado: normalizarNombre(nombre),
      tipo: e.tipo,
      unidad,
      precioUnitarioMilesimas: precio,
      afectoIgv: e.afectoIgv ?? true,
      descripcion: textoOpcional(e.descripcion),
    },
  };
}
