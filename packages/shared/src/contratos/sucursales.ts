import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema } from '../listado.js';

// Contratos del área «sucursales»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.

const texto = (max: number) => z.string().trim().max(max);

export const sucursalSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  nombre: z.string(),
  direccion: z.string().nullable(),
  telefono: z.string().nullable(),
  esPrincipal: z.boolean(),
  archivadoEn: z.iso.datetime().nullable(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type SucursalDto = z.infer<typeof sucursalSchema>;

const soloId = z.strictObject({ id: z.uuid() });

export const contratosDeSucursales = {
  // Una empresa tiene pocas sucursales: la lista viene entera y `siguiente` es siempre nulo.
  sucursales_listar: contrato(z.strictObject({ incluirArchivadas: z.boolean().default(false) }), listadoSchema(sucursalSchema)),
  sucursal_crear: contrato(
    z.strictObject({
      codigo: texto(10).min(1, { error: 'El código es obligatorio.' }),
      nombre: texto(120).min(1, { error: 'El nombre es obligatorio.' }),
      direccion: texto(300).nullish(),
      telefono: texto(40).nullish(),
    }),
    sucursalSchema,
  ),
  sucursal_editar: contrato(
    z
      .strictObject({
        id: z.uuid(),
        nombre: texto(120).min(1).optional(),
        direccion: texto(300).nullish(),
        telefono: texto(40).nullish(),
      })
      .refine((v) => v.nombre !== undefined || v.direccion !== undefined || v.telefono !== undefined, { error: 'Indica al menos un dato que cambiar.' }),
    sucursalSchema,
  ),
  sucursal_archivar: contrato(soloId, sucursalSchema),
  sucursal_marcar_principal: contrato(soloId, sucursalSchema),
} as const;
export const eventosDeSucursales = {} as const;
