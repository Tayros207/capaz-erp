import { z } from 'zod';
import { contrato } from '../herramientas.js';

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

export const configuracionDeEmpresaSchema = z.strictObject({
  zonaHoraria: z.string(),
  moneda: z.string(),
  locale: z.string(),
  actualizadoEn: z.iso.datetime(),
});
export type ConfiguracionDeEmpresa = z.infer<typeof configuracionDeEmpresaSchema>;

/** Solo lo que cambia: al menos un campo. */
export const actualizarConfiguracionSchema = z
  .strictObject({
    zonaHoraria: zonaHoraria.optional(),
    moneda: moneda.optional(),
    locale: locale.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { error: 'Indica al menos un dato que cambiar.' });
export type ActualizarConfiguracion = z.infer<typeof actualizarConfiguracionSchema>;

export const contratosDeEmpresa = {
  empresa_ver_configuracion: contrato(z.strictObject({}), configuracionDeEmpresaSchema),
  empresa_actualizar_configuracion: contrato(actualizarConfiguracionSchema, configuracionDeEmpresaSchema),
} as const;
export const eventosDeEmpresa = {} as const;
