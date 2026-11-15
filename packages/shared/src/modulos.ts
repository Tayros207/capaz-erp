import { z } from 'zod';

// Manifiesto de módulo (ARQUITECTURA-DE-MODULOS) y el acceso calculado de una persona a un módulo.
// Los permisos son cadenas `recurso:accion`; cada permiso pertenece a un solo módulo.

export const PERMISO = /^[a-z][a-z_]*:[a-z][a-z_]*$/;
const permisoSchema = z.string().regex(PERMISO, 'Un permiso es «recurso:accion», en minúsculas.');

export const manifiestoDeModuloSchema = z
  .strictObject({
    codigo: z.string().regex(/^[a-z][a-z_]*$/),
    nombre: z.string().min(2),
    descripcion: z.string().min(2),
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    dependeDe: z.array(z.string()),
    permisos: z.array(permisoSchema),
    permisosPorNivel: z.strictObject({ completo: z.array(permisoSchema), lectura: z.array(permisoSchema) }),
    secciones: z.array(z.strictObject({ id: z.string(), nombre: z.string(), ruta: z.string(), construida: z.boolean() })),
    acento: z.enum(['esmeralda', 'cian', 'ambar', 'rosa', 'gris']),
    icono: z.string(),
    /** Toda empresa nueva lo recibe. `pruebaDias` nulo = activo sin prueba. */
    porDefecto: z.strictObject({ pruebaDias: z.number().int().positive().nullable() }).optional(),
    /** Aún sin pantallas: se ve como «en construcción». */
    enConstruccion: z.boolean().default(false),
  })
  .superRefine((m, ctx) => {
    const todos = new Set(m.permisos);
    for (const nivel of ['completo', 'lectura'] as const) {
      for (const p of m.permisosPorNivel[nivel]) {
        if (!todos.has(p)) ctx.addIssue({ code: 'custom', message: `«${p}» (nivel ${nivel}) no está declarado en permisos.` });
      }
    }
    const completo = new Set(m.permisosPorNivel.completo);
    for (const p of m.permisosPorNivel.lectura) {
      if (!completo.has(p)) ctx.addIssue({ code: 'custom', message: `«${p}» está en lectura pero no en completo.` });
    }
    if (m.dependeDe.includes(m.codigo)) ctx.addIssue({ code: 'custom', message: 'Un módulo no depende de sí mismo.' });
  });
export type ManifiestoDeModulo = z.infer<typeof manifiestoDeModuloSchema>;
export type ManifiestoDeEntrada = z.input<typeof manifiestoDeModuloSchema>;

export const ESTADOS_DE_CONTRATACION = ['prueba', 'activo', 'suspendido', 'baja'] as const;
export type EstadoDeContratacion = (typeof ESTADOS_DE_CONTRATACION)[number];

export const MOTIVOS_DE_ACCESO = [
  'activo',
  'prueba',
  'baja_solo_lectura',
  'suspendido',
  'no_contratado',
  'sin_asignar',
] as const;
export type MotivoDeAcceso = (typeof MOTIVOS_DE_ACCESO)[number];

export const accesoDeModuloSchema = z.strictObject({
  codigo: z.string(),
  motivo: z.enum(MOTIVOS_DE_ACCESO),
  /** Se muestra la tarjeta (para entrar, para «Solicitar» o para «pide a tu administrador»). */
  visible: z.boolean(),
  puedeEntrar: z.boolean(),
  puedeEscribir: z.boolean(),
  nivel: z.enum(['completo', 'lectura']).nullable(),
  alcance: z.enum(['todos', 'propios']),
  diasDePrueba: z.number().int().nonnegative().nullable(),
});
export type AccesoDeModulo = z.infer<typeof accesoDeModuloSchema>;
