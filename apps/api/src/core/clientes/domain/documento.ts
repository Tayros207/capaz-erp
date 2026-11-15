export const TIPOS_DE_DOCUMENTO = ['dni', 'ruc', 'ce', 'pasaporte', 'otro'] as const;
export type TipoDeDocumento = (typeof TIPOS_DE_DOCUMENTO)[number];

export type ResultadoDocumento = { ok: true; numero: string } | { ok: false; motivo: string };

/** Valida y normaliza (sin espacios, en mayúsculas) un documento según su tipo: DNI 8 dígitos, RUC 11 dígitos. */
export function validarDocumento(tipo: TipoDeDocumento, numero: string): ResultadoDocumento {
  const n = numero.replace(/\s+/g, '').toUpperCase();
  switch (tipo) {
    case 'dni':
      return /^\d{8}$/.test(n) ? { ok: true, numero: n } : { ok: false, motivo: 'El DNI tiene 8 dígitos.' };
    case 'ruc':
      return /^\d{11}$/.test(n) ? { ok: true, numero: n } : { ok: false, motivo: 'El RUC tiene 11 dígitos.' };
    case 'ce':
      return /^[A-Z0-9]{9,12}$/.test(n) ? { ok: true, numero: n } : { ok: false, motivo: 'El carné de extranjería tiene de 9 a 12 caracteres.' };
    case 'pasaporte':
      return /^[A-Z0-9]{6,12}$/.test(n) ? { ok: true, numero: n } : { ok: false, motivo: 'El pasaporte tiene de 6 a 12 caracteres.' };
    case 'otro':
      return /^[A-Z0-9\-]{1,20}$/.test(n) ? { ok: true, numero: n } : { ok: false, motivo: 'El documento tiene hasta 20 letras, cifras o guiones.' };
  }
}
