import { formatearSoles, MAXIMO_MONTO_MINIMO_CENTIMOS, MONTO_MINIMO_POR_TRABAJO_CENTIMOS, type ActualizarConfiguracion, type ConfiguracionDeEmpresa } from '@capaz/shared';
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

/** Cómo se maneja el aviso de monto mínimo: el de fábrica, uno propio o ninguno. */
export type ModoDeMontoMinimo = 'defecto' | 'personalizado' | 'apagado';

/** Lo que se edita: texto siempre (vacío = sin dato), el logo como data URL o vacío, y el monto mínimo en céntimos. */
export type FormularioDeEmpresa = Record<CampoDeTexto, string> & {
  logoDataUrl: string;
  zonaHoraria: string;
  montoMinimoModo: ModoDeMontoMinimo;
  /** Solo cuenta en modo «personalizado». */
  montoMinimoCentimos: number | null;
};
export type ErroresDeEmpresa = Partial<Record<CampoDeTexto | 'montoMinimo', string>>;

/** `null` = por defecto, `0` = apagado, otro valor = personalizado. */
export const modoDeMontoMinimo = (valor: number | null): ModoDeMontoMinimo => (valor === null ? 'defecto' : valor === 0 ? 'apagado' : 'personalizado');

/** El valor que se guarda según el formulario (`null` por defecto, `0` apagado). */
export function montoMinimoDelFormulario(f: Pick<FormularioDeEmpresa, 'montoMinimoModo' | 'montoMinimoCentimos'>): number | null {
  if (f.montoMinimoModo === 'defecto') return null;
  return f.montoMinimoModo === 'apagado' ? 0 : f.montoMinimoCentimos;
}

/** Al pasar a «personalizado» se parte del mínimo de fábrica (o del último valor escrito), nunca de un campo vacío. */
export function conModoDeMontoMinimo(f: FormularioDeEmpresa, modo: ModoDeMontoMinimo): FormularioDeEmpresa {
  return { ...f, montoMinimoModo: modo, montoMinimoCentimos: modo === 'personalizado' ? (f.montoMinimoCentimos ?? MONTO_MINIMO_POR_TRABAJO_CENTIMOS) : f.montoMinimoCentimos };
}

/** Frase para el modo lectura de la sección. */
export function textoDeMontoMinimo(valor: number | null): string {
  if (valor === null) return `${formatearSoles(MONTO_MINIMO_POR_TRABAJO_CENTIMOS)} (el de siempre)`;
  return valor === 0 ? 'Apagado: no se avisa' : formatearSoles(valor);
}

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
    montoMinimoModo: modoDeMontoMinimo(c.montoMinimoCentimos),
    montoMinimoCentimos: c.montoMinimoCentimos !== null && c.montoMinimoCentimos > 0 ? c.montoMinimoCentimos : null,
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
  if (f.montoMinimoModo === 'personalizado') {
    const v = f.montoMinimoCentimos;
    if (v === null) errores.montoMinimo = 'Escribe el monto mínimo.';
    else if (!Number.isSafeInteger(v) || v <= 0) errores.montoMinimo = 'Escribe un monto mayor que cero. Para no avisar nunca, elige «Apagado».';
    else if (v > MAXIMO_MONTO_MINIMO_CENTIMOS) errores.montoMinimo = `El monto mínimo no puede pasar de ${formatearSoles(MAXIMO_MONTO_MINIMO_CENTIMOS)}.`;
  }
  return errores;
}

/** Solo lo que cambió respecto a lo guardado (texto recortado; vacío borra), o nulo si no hay cambios. */
export function cambiosDeEmpresa(config: ConfiguracionDeEmpresa, f: FormularioDeEmpresa): ActualizarConfiguracion | null {
  const actual = formularioDesde(config);
  const cambios: Record<string, string | number | null> = { ...cambiosDeZona(actual.zonaHoraria, f.zonaHoraria) };
  for (const k of CAMPOS_DE_TEXTO) if (f[k].trim() !== actual[k]) cambios[k] = f[k].trim();
  if (f.logoDataUrl !== actual.logoDataUrl) cambios.logoDataUrl = f.logoDataUrl;
  const minimo = montoMinimoDelFormulario(f);
  if (minimo !== config.montoMinimoCentimos) cambios.montoMinimoCentimos = minimo;
  return Object.keys(cambios).length === 0 ? null : (cambios as ActualizarConfiguracion);
}

/** Frase del cuadro de confirmación local (el servidor pone el resumen definitivo). */
export function tituloDeConfirmacion(cambios: ActualizarConfiguracion): string {
  return Object.keys(cambios).length === 1 && cambios.zonaHoraria ? 'Cambiar la zona horaria' : 'Guardar los datos de la empresa';
}
