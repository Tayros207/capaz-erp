import { TIPOS_DE_DOCUMENTO, validarDocumento, type TipoDeDocumento } from './documento.js';
import { normalizarNombre, normalizarTelefono, textoOpcional } from './normalizacion.js';

export type TipoDeCliente = 'cliente' | 'proveedor' | 'ambos';
export type ClaseDeCliente = 'persona' | 'empresa';

/** Lo que llega para crear o editar (ya con la forma validada por el contrato). */
export type EntradaDeCliente = {
  tipo?: TipoDeCliente;
  clase: ClaseDeCliente;
  nombre: string;
  documentoTipo?: TipoDeDocumento | null;
  documentoNumero?: string | null;
  telefono?: string | null;
  correo?: string | null;
  direccion?: string | null;
  notas?: string | null;
};

/** Datos listos para guardar: normalizados. */
export type DatosDeCliente = {
  tipo: TipoDeCliente;
  clase: ClaseDeCliente;
  nombre: string;
  nombreNormalizado: string;
  documentoTipo: TipoDeDocumento | null;
  documentoNumero: string | null;
  telefono: string | null;
  correo: string | null;
  direccion: string | null;
  notas: string | null;
};

export type ResultadoCliente = { ok: true; datos: DatosDeCliente } | { ok: false; campo: string; motivo: string };

const fallo = (campo: string, motivo: string): ResultadoCliente => ({ ok: false, campo, motivo });

/** Normaliza y valida un cliente completo. Un RUC solo es válido para una empresa. */
export function prepararCliente(e: EntradaDeCliente): ResultadoCliente {
  const nombre = e.nombre.replace(/\s+/g, ' ').trim();
  if (!nombre) return fallo('nombre', 'El nombre es obligatorio.');
  const nombreNormalizado = normalizarNombre(nombre);

  const tipoDoc = e.documentoTipo ?? null;
  const numDoc = textoOpcional(e.documentoNumero);
  let documentoNumero: string | null = null;
  if (numDoc !== null) {
    if (!tipoDoc || !TIPOS_DE_DOCUMENTO.includes(tipoDoc)) return fallo('documentoTipo', 'Indica el tipo de documento.');
    const v = validarDocumento(tipoDoc, numDoc);
    if (!v.ok) return fallo('documentoNumero', v.motivo);
    documentoNumero = v.numero;
  }
  if (numDoc === null && tipoDoc) return fallo('documentoNumero', 'Indica el número de documento.');

  const telefono = normalizarTelefono(e.telefono);
  if (telefono === undefined) return fallo('telefono', 'El teléfono no es válido.');

  const correo = textoOpcional(e.correo)?.toLowerCase() ?? null;
  if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return fallo('correo', 'El correo no es válido.');

  return {
    ok: true,
    datos: {
      tipo: e.tipo ?? 'cliente',
      clase: e.clase,
      nombre,
      nombreNormalizado,
      documentoTipo: documentoNumero ? tipoDoc : null,
      documentoNumero,
      telefono,
      correo,
      direccion: textoOpcional(e.direccion),
      notas: textoOpcional(e.notas),
    },
  };
}
