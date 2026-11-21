import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { MAXIMO_MONTO_MINIMO_CENTIMOS } from '../monto-minimo.js';

// Contratos del área «empresa»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.

const zonaHoraria = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine(
    (v) => {
      try {
        new Intl.DateTimeFormat('es', { timeZone: v });
        return true;
      } catch {
        return false;
      }
    },
    { error: 'No es una zona horaria válida (por ejemplo, America/Lima).' },
  );
const moneda = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, { error: 'Usa el código de tres letras en mayúsculas (por ejemplo, PEN).' });
const locale = z
  .string()
  .trim()
  .max(35)
  .refine(
    (v) => {
      try {
        return Intl.getCanonicalLocales(v).length === 1;
      } catch {
        return false;
      }
    },
    { error: 'No es un idioma válido (por ejemplo, es-PE).' },
  );

/** Límites de los datos de la empresa: los mismos que las restricciones de `core.empresa_config`. */
export const LIMITES_DATOS_EMPRESA = { razonSocial: 200, direccionFiscal: 300, telefono: 50, correo: 200, pieDeDocumento: 1000, logoDataUrl: 150_000 } as const;
const PREFIJO_LOGO = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Texto opcional: vacío = borrar el dato. */
const textoOpcional = (max: number, nombre: string) =>
  z.string().trim().max(max, { error: `${nombre}: máximo ${max} caracteres.` });
const ruc = z.string().trim().regex(/^([0-9]{11})?$/, { error: 'El RUC debe tener 11 dígitos.' });
const logo = z
  .string()
  .max(LIMITES_DATOS_EMPRESA.logoDataUrl, { error: 'El logo es demasiado grande: usa una imagen más pequeña.' })
  .refine((v) => v === '' || PREFIJO_LOGO.test(v), { error: 'El logo debe ser una imagen PNG, JPEG o WebP.' });

const montoMinimo = z
  .number({ error: 'El monto mínimo va en céntimos enteros, de 0 a 10,000,000 (S/ 100,000.00).' })
  .int({ error: 'El monto mínimo va en céntimos enteros, de 0 a 10,000,000 (S/ 100,000.00).' })
  .min(0, { error: 'El monto mínimo va en céntimos enteros, de 0 a 10,000,000 (S/ 100,000.00).' })
  .max(MAXIMO_MONTO_MINIMO_CENTIMOS, { error: 'El monto mínimo va en céntimos enteros, de 0 a 10,000,000 (S/ 100,000.00).' });

export const configuracionDeEmpresaSchema = z.strictObject({
  zonaHoraria: z.string(),
  moneda: z.string(),
  locale: z.string(),
  razonSocial: z.string().nullable(),
  ruc: z.string().nullable(),
  direccionFiscal: z.string().nullable(),
  telefono: z.string().nullable(),
  correo: z.string().nullable(),
  pieDeDocumento: z.string().nullable(),
  logoDataUrl: z.string().nullable(),
  /** `null` = por defecto (S/ 40.00); `0` = aviso apagado. */
  montoMinimoCentimos: z.number().int().nullable(),
  actualizadoEn: z.iso.datetime(),
});
export type ConfiguracionDeEmpresa = z.infer<typeof configuracionDeEmpresaSchema>;

/** Solo lo que cambia: al menos un campo. En los datos de la empresa, la cadena vacía borra el dato. */
export const actualizarConfiguracionSchema = z
  .strictObject({
    zonaHoraria: zonaHoraria.optional(),
    moneda: moneda.optional(),
    locale: locale.optional(),
    razonSocial: textoOpcional(LIMITES_DATOS_EMPRESA.razonSocial, 'La razón social').optional(),
    ruc: ruc.optional(),
    direccionFiscal: textoOpcional(LIMITES_DATOS_EMPRESA.direccionFiscal, 'La dirección fiscal').optional(),
    telefono: textoOpcional(LIMITES_DATOS_EMPRESA.telefono, 'El teléfono').optional(),
    correo: textoOpcional(LIMITES_DATOS_EMPRESA.correo, 'El correo').optional(),
    pieDeDocumento: textoOpcional(LIMITES_DATOS_EMPRESA.pieDeDocumento, 'El pie de documento').optional(),
    montoMinimoCentimos: montoMinimo.nullable().optional(),
    logoDataUrl: logo.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { error: 'Indica al menos un dato que cambiar.' });
export type ActualizarConfiguracion = z.infer<typeof actualizarConfiguracionSchema>;

export const contratosDeEmpresa = {
  empresa_ver_configuracion: contrato(z.strictObject({}), configuracionDeEmpresaSchema),
  empresa_actualizar_configuracion: contrato(actualizarConfiguracionSchema, configuracionDeEmpresaSchema),
} as const;
export const eventosDeEmpresa = {} as const;
