import type { ActualizarConfiguracion, ConfiguracionDeEmpresa } from '@capaz/shared';
import { cambiosDeZona } from './logica.ts';

// Lógica pura de los datos de la empresa (razón social, RUC, logo…): sin React ni red.

export const CAMPOS_DE_TEXTO = ['razonSocial', 'ruc', 'direccionFiscal', 'telefono', 'correo', 'pieDeDocumento'] as const;
export type CampoDeTexto = (typeof CAMPOS_DE_TEXTO)[number];

/** Límites iguales a los del servidor (`LIMITES_DATOS_EMPRESA` en `@capaz/shared`). */
export const MAXIMOS: Record<CampoDeTexto, number> = { razonSocial: 200, ruc: 11, direccionFiscal: 300, telefono: 50, correo: 200, pieDeDocumento: 1000 };
const NOMBRES: Record<CampoDeTexto, string> = {
  razonSocial: 'La razón social',
  ruc: 'El RUC',
  direccionFiscal: 'La dirección fiscal',
  telefono: 'El teléfono',
  correo: 'El correo',
  pieDeDocumento: 'El pie de documento',
};

/** Lo que se edita: texto siempre (vacío = sin dato), el logo como data URL o vacío. */
export type FormularioDeEmpresa = Record<CampoDeTexto, string> & { logoDataUrl: string; zonaHoraria: string };
export type ErroresDeEmpresa = Partial<Record<CampoDeTexto, string>>;

export function formularioDesde(c: ConfiguracionDeEmpresa): FormularioDeEmpresa {
  return {
    razonSocial: c.razonSocial ?? '',
    ruc: c.ruc ?? '',
    direccionFiscal: c.direccionFiscal ?? '',
    telefono: c.telefono ?? '',
    correo: c.correo ?? '',
    pieDeDocumento: c.pieDeDocumento ?? '',
    logoDataUrl: c.logoDataUrl ?? '',
    zonaHoraria: c.zonaHoraria,
  };
}

/** Errores por campo, con los mismos criterios del servidor. Vacío = sin errores. */
export function validarDatos(f: FormularioDeEmpresa): ErroresDeEmpresa {
  const errores: ErroresDeEmpresa = {};
  for (const k of CAMPOS_DE_TEXTO) {
    const v = f[k].trim();
    if (v.length > MAXIMOS[k]) errores[k] = `${NOMBRES[k]} admite como máximo ${MAXIMOS[k]} caracteres.`;
  }
  if (!errores.ruc && f.ruc.trim() !== '' && !/^[0-9]{11}$/.test(f.ruc.trim())) errores.ruc = 'El RUC debe tener 11 dígitos.';
  return errores;
}

/** Solo lo que cambió respecto a lo guardado (texto recortado; vacío borra), o nulo si no hay cambios. */
export function cambiosDeEmpresa(config: ConfiguracionDeEmpresa, f: FormularioDeEmpresa): ActualizarConfiguracion | null {
  const actual = formularioDesde(config);
  const cambios: Record<string, string> = { ...cambiosDeZona(actual.zonaHoraria, f.zonaHoraria) };
  for (const k of CAMPOS_DE_TEXTO) if (f[k].trim() !== actual[k]) cambios[k] = f[k].trim();
  if (f.logoDataUrl !== actual.logoDataUrl) cambios.logoDataUrl = f.logoDataUrl;
  return Object.keys(cambios).length === 0 ? null : (cambios as ActualizarConfiguracion);
}

/** Frase del cuadro de confirmación local (el servidor pone el resumen definitivo). */
export function tituloDeConfirmacion(cambios: ActualizarConfiguracion): string {
  return Object.keys(cambios).length === 1 && cambios.zonaHoraria ? 'Cambiar la zona horaria' : 'Guardar los datos de la empresa';
}
