import { TIPOS_DE_DOCUMENTO_DE_COLABORADOR } from '@capaz/shared';
import { validarDocumento, type TipoDeDocumento } from '../../../core/clientes/domain/documento.js';
import { normalizarNombre, normalizarTelefono, textoOpcional } from '../../../core/clientes/domain/normalizacion.js';

// Reglas puras del colaborador: normalizar y validar sus datos. Sin base ni framework.
// Nombre, documento y teléfono son datos personales: nunca van a eventos ni a la auditoría.

export type EntradaDeColaborador = {
  nombre: string;
  documentoTipo?: string | null;
  documentoNumero?: string | null;
  telefono?: string | null;
  cargo?: string | null;
  cuentaId?: string | null;
  fechaIngreso?: string | null;
  sucursalId?: string | null;
};

export type DatosDeColaborador = {
  nombre: string;
  nombreNormalizado: string;
  documentoTipo: string | null;
  documentoNumero: string | null;
  telefono: string | null;
  cargo: string | null;
  cuentaId: string | null;
  fechaIngreso: string | null;
  sucursalId: string | null;
};

export type ResultadoColaborador = { ok: true; datos: DatosDeColaborador } | { ok: false; campo: string; motivo: string };

const fallo = (campo: string, motivo: string): ResultadoColaborador => ({ ok: false, campo, motivo });

/** Normaliza y valida un colaborador completo. Documento y tipo van juntos o ninguno. */
export function prepararColaborador(e: EntradaDeColaborador): ResultadoColaborador {
  const nombre = e.nombre.replace(/\s+/g, ' ').trim();
  if (!nombre) return fallo('nombre', 'El nombre es obligatorio.');
  const tipo = e.documentoTipo ?? null;
  const numero = textoOpcional(e.documentoNumero);
  let documentoNumero: string | null = null;
  if (numero !== null) {
    if (!tipo || !(TIPOS_DE_DOCUMENTO_DE_COLABORADOR as readonly string[]).includes(tipo)) return fallo('documentoTipo', 'Indica el tipo de documento.');
    const v = validarDocumento(tipo as TipoDeDocumento, numero);
    if (!v.ok) return fallo('documentoNumero', v.motivo);
    documentoNumero = v.numero;
  } else if (tipo) {
    return fallo('documentoNumero', 'Indica el número de documento.');
  }
  const telefono = normalizarTelefono(e.telefono);
  if (telefono === undefined) return fallo('telefono', 'El teléfono no es válido.');
  return {
    ok: true,
    datos: {
      nombre,
      nombreNormalizado: normalizarNombre(nombre),
      documentoTipo: documentoNumero ? tipo : null,
      documentoNumero,
      telefono,
      cargo: textoOpcional(e.cargo),
      cuentaId: textoOpcional(e.cuentaId),
      fechaIngreso: e.fechaIngreso ?? null,
      sucursalId: e.sucursalId ?? null,
    },
  };
}

/** Lo que cambia en una edición: `undefined` no toca el dato y `null` lo borra. */
export type CambiosDeColaborador = Partial<EntradaDeColaborador>;

/** Aplica los cambios sobre el colaborador actual y valida el resultado completo. */
export function aplicarCambios(actual: DatosDeColaborador, c: CambiosDeColaborador): ResultadoColaborador {
  const pick = <K extends keyof CambiosDeColaborador>(k: K, previo: EntradaDeColaborador[K]) => (c[k] !== undefined ? c[k] : previo);
  return prepararColaborador({
    nombre: c.nombre ?? actual.nombre,
    documentoTipo: pick('documentoTipo', actual.documentoTipo),
    documentoNumero: pick('documentoNumero', actual.documentoNumero),
    telefono: pick('telefono', actual.telefono),
    cargo: pick('cargo', actual.cargo),
    cuentaId: pick('cuentaId', actual.cuentaId),
    fechaIngreso: pick('fechaIngreso', actual.fechaIngreso),
    sucursalId: pick('sucursalId', actual.sucursalId),
  });
}
