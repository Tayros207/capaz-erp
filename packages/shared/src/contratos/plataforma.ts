import { z } from 'zod';
import { centimosSchema } from '../dinero.js';
import { contrato } from '../herramientas.js';

// Contratos del área «plataforma»: la consola del operador (Datayros). Viven en `CONTRATOS_DE_PLATAFORMA`,
// no en `CONTRATOS`: se ejecutan por `POST /api/v1/plataforma/herramientas/:nombre` con el rol de
// plataforma. La empresa sobre la que se actúa va en `empresa` (el nombre `empresaId` está reservado
// a la sesión). Aquí no hay datos de negocio de ninguna empresa: solo contratos y cifras agregadas.
// Solo el carril de esta área edita este archivo.

export const ESTADOS_DE_MODULO = ['prueba', 'activo', 'suspendido', 'baja'] as const;
export const ESTADOS_DE_CUENTA = ['activa', 'prueba', 'pausada', 'baja'] as const;
export const ESTADOS_DE_SOLICITUD = ['pendiente', 'atendida', 'descartada'] as const;

const idDeEmpresa = z.string().trim().min(1, { error: 'Indica la empresa.' }).max(100);
const codigoDeModulo = z.string().trim().min(1, { error: 'Indica el módulo.' }).max(60);
const motivo = z.string().trim().min(1).max(300).optional();
const fecha = z.iso.datetime({ offset: true });

export const moduloDeEmpresaSchema = z.strictObject({
  modulo: z.string(),
  nombre: z.string(),
  estado: z.enum(ESTADOS_DE_MODULO),
  altaEn: fecha,
  pruebaHasta: fecha.nullable(),
  bajaEn: fecha.nullable(),
  motivo: z.string().nullable(),
  plan: z.string().nullable(),
  precioAcordadoCentimos: centimosSchema.nullable(),
  vigenteHasta: fecha.nullable(),
  maxUsuarios: z.number().int().nullable(),
});
export type ModuloDeEmpresaDto = z.infer<typeof moduloDeEmpresaSchema>;

export const eventoDeContratoSchema = z.strictObject({
  modulo: z.string(),
  evento: z.string(),
  estadoAnterior: z.string().nullable(),
  estadoNuevo: z.string(),
  motivo: z.string().nullable(),
  actor: z.string().nullable(),
  creadoEn: fecha,
});

export const eventoDeCuentaSchema = z.strictObject({
  evento: z.string(),
  estadoAnterior: z.string().nullable(),
  estadoNuevo: z.string(),
  motivo: z.string().nullable(),
  actor: z.string().nullable(),
  creadoEn: fecha,
});

export const empresaResumidaSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  altaEn: fecha,
  miembros: z.number().int(),
  /** Estado de la cuenta entera (sin fila de cuenta cuenta como activa). */
  estadoCuenta: z.enum(ESTADOS_DE_CUENTA),
  modulos: z.array(
    z.strictObject({
      modulo: z.string(),
      /** Nombre visible del módulo (el código solo para identificarlo). */
      nombre: z.string(),
      estado: z.enum(ESTADOS_DE_MODULO),
      pruebaHasta: fecha.nullable(),
      vigenteHasta: fecha.nullable(),
    }),
  ),
});

export const empresaFichaSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  altaEn: fecha,
  miembros: z.number().int(),
  /** Última vez que la empresa hizo algo (solo la fecha; nunca qué). */
  ultimaActividadEn: fecha.nullable(),
  estadoCuenta: z.enum(ESTADOS_DE_CUENTA),
  motivoCuenta: z.string().nullable(),
  /** Últimos 50 cambios de estado de la cuenta, del más nuevo al más antiguo. */
  eventosDeCuenta: z.array(eventoDeCuentaSchema),
  modulos: z.array(moduloDeEmpresaSchema),
  historial: z.array(eventoDeContratoSchema),
});

/** Estado de la cuenta de una empresa tras un cambio. */
export const cuentaDeEmpresaSchema = z.strictObject({
  empresa: z.string(),
  estadoCuenta: z.enum(ESTADOS_DE_CUENTA),
  motivoCuenta: z.string().nullable(),
  cambiadoEn: fecha,
});

export const moduloDelCatalogoSchema = z.strictObject({
  codigo: z.string(),
  nombre: z.string(),
  familia: z.string(),
  descripcion: z.string(),
  enConstruccion: z.boolean(),
  porDefecto: z.boolean(),
  dependeDe: z.array(z.string()),
});

export const vencimientoSchema = z.strictObject({
  empresa: z.string(),
  empresaNombre: z.string(),
  modulo: z.string(),
  moduloNombre: z.string(),
  tipo: z.enum(['prueba', 'contrato']),
  fecha,
  diasRestantes: z.number().int(),
  precioAcordadoCentimos: centimosSchema.nullable(),
});

export const ingresoPorEmpresaSchema = z.strictObject({
  empresa: z.string(),
  empresaNombre: z.string(),
  vencimientos: z.number().int(),
  ingresoMensualAcordadoCentimos: centimosSchema,
});

export const aplicadoEnAltaSchema = z.strictObject({
  modulo: z.string(),
  nombre: z.string(),
  estado: z.enum(['activo', 'prueba']),
  pruebaHasta: fecha.nullable(),
  /** Verdadero si no se pidió: se activó porque otro módulo lo necesita. */
  porDependencia: z.boolean(),
});

const motivoDeCuenta = z.string().trim().min(5, { error: 'El motivo debe tener al menos 5 caracteres.' }).max(300);

/** Estado de un módulo de una empresa tras un cambio. */
export const contratoDeModuloSchema = z.strictObject({
  empresa: z.string(),
  modulo: z.string(),
  estado: z.enum(ESTADOS_DE_MODULO),
  pruebaHasta: fecha.nullable(),
  plan: z.string().nullable(),
  precioAcordadoCentimos: centimosSchema.nullable(),
  vigenteHasta: fecha.nullable(),
  maxUsuarios: z.number().int().nullable(),
});

export const planSchema = z.strictObject({
  codigo: z.string(),
  nombre: z.string(),
  descripcion: z.string().nullable(),
  precioCentimos: centimosSchema,
  usuariosIncluidos: z.number().int().nullable(),
  activo: z.boolean(),
  modulos: z.array(z.string()),
});

export const solicitudSchema = z.strictObject({
  id: z.string(),
  empresa: z.string(),
  empresaNombre: z.string().nullable(),
  modulo: z.string(),
  usuarioId: z.string(),
  nota: z.string().nullable(),
  estado: z.enum(ESTADOS_DE_SOLICITUD),
  creadoEn: fecha,
  atendidoEn: fecha.nullable(),
});

const entradaDeModulo = z.strictObject({ empresa: idDeEmpresa, modulo: codigoDeModulo, motivo });

export const contratosDePlataforma = {
  plataforma_empresas_listar: contrato(
    z.strictObject({ texto: z.string().trim().max(100).optional() }),
    z.strictObject({ items: z.array(empresaResumidaSchema) }),
  ),
  plataforma_empresas_ver: contrato(z.strictObject({ empresa: idDeEmpresa }), empresaFichaSchema),
  plataforma_empresas_crear: contrato(
    z.strictObject({
      nombre: z.string().trim().min(2, { error: 'El nombre de la empresa es muy corto.' }).max(120),
      correoDelDueno: z.string().trim().toLowerCase().pipe(z.email({ error: 'El correo no es válido.' })),
      /** Código de un plan existente y activo: sus módulos se activan y quedan con ese plan. */
      plan: z.string().trim().min(1).max(60).optional(),
      /** Módulos a dar, además del plan. Sin plan ni módulos se dan los módulos por defecto. */
      modulos: z
        .array(
          z.strictObject({
            codigo: codigoDeModulo,
            pruebaDias: z.number().int().min(1, { error: 'Mínimo 1 día.' }).max(365, { error: 'Máximo 365 días.' }).optional(),
          }),
        )
        .max(50)
        .optional(),
    }),
    z.strictObject({
      id: z.string(),
      nombre: z.string(),
      modulosActivados: z.array(z.string()),
      plan: z.string().nullable(),
      estadoCuenta: z.enum(ESTADOS_DE_CUENTA),
      modulos: z.array(aplicadoEnAltaSchema),
    }),
  ),
  plataforma_cuenta_pausar: contrato(z.strictObject({ empresa: idDeEmpresa, motivo: motivoDeCuenta }), cuentaDeEmpresaSchema),
  plataforma_cuenta_dar_de_baja: contrato(z.strictObject({ empresa: idDeEmpresa, motivo: motivoDeCuenta }), cuentaDeEmpresaSchema),
  plataforma_cuenta_reactivar: contrato(z.strictObject({ empresa: idDeEmpresa, motivo }), cuentaDeEmpresaSchema),
  plataforma_modulos_listar: contrato(z.strictObject({}), z.strictObject({ items: z.array(moduloDelCatalogoSchema) })),
  /** Solo contratos y cifras: nunca datos de negocio de la empresa. */
  plataforma_vencimientos_listar: contrato(
    z.strictObject({ dias: z.number().int().min(1, { error: 'Mínimo 1 día.' }).max(90, { error: 'Máximo 90 días.' }).default(14) }),
    z.strictObject({
      dias: z.number().int(),
      items: z.array(vencimientoSchema),
      porEmpresa: z.array(ingresoPorEmpresaSchema),
      /** Suma de lo acordado por las empresas con vencimientos en el plazo. */
      ingresoMensualAcordadoCentimos: centimosSchema,
    }),
  ),
  plataforma_modulo_activar: contrato(
    z.strictObject({
      empresa: idDeEmpresa,
      modulo: codigoDeModulo,
      /** Sin días queda activo; con días queda en prueba hasta esa fecha. */
      pruebaDias: z.number().int().min(1, { error: 'Mínimo 1 día.' }).max(365, { error: 'Máximo 365 días.' }).optional(),
      motivo,
    }),
    contratoDeModuloSchema,
  ),
  plataforma_modulo_suspender: contrato(entradaDeModulo, contratoDeModuloSchema),
  plataforma_modulo_dar_de_baja: contrato(entradaDeModulo, contratoDeModuloSchema),
  plataforma_modulo_reactivar: contrato(entradaDeModulo, contratoDeModuloSchema),
  /** Lo que no se manda no cambia; `null` borra el valor. */
  plataforma_contrato_fijar: contrato(
    z
      .strictObject({
        empresa: idDeEmpresa,
        modulo: codigoDeModulo,
        plan: z.string().trim().min(1).max(60).nullable().optional(),
        precioAcordadoCentimos: centimosSchema.min(0, { error: 'El precio no puede ser negativo.' }).nullable().optional(),
        vigenteHasta: fecha.nullable().optional(),
        maxUsuarios: z.number().int().min(1, { error: 'Mínimo 1 usuario.' }).max(100_000).nullable().optional(),
      })
      .refine((a) => ['plan', 'precioAcordadoCentimos', 'vigenteHasta', 'maxUsuarios'].some((k) => k in a && (a as Record<string, unknown>)[k] !== undefined), {
        error: 'Indica al menos un dato del contrato.',
      }),
    contratoDeModuloSchema,
  ),
  plataforma_planes_listar: contrato(z.strictObject({}), z.strictObject({ items: z.array(planSchema) })),
  plataforma_planes_guardar: contrato(
    z.strictObject({
      codigo: z.string().trim().regex(/^[a-z][a-z0-9_]{1,40}$/, { error: 'El código usa minúsculas, números y guion bajo.' }),
      nombre: z.string().trim().min(1, { error: 'El nombre es obligatorio.' }).max(120),
      descripcion: z.string().trim().max(500).nullish(),
      precioCentimos: centimosSchema.min(0, { error: 'El precio no puede ser negativo.' }),
      usuariosIncluidos: z.number().int().min(1).max(100_000).nullish(),
      activo: z.boolean().default(true),
      modulos: z.array(codigoDeModulo).max(50).default([]),
    }),
    planSchema,
  ),
  plataforma_solicitudes_listar: contrato(
    z.strictObject({ estado: z.enum([...ESTADOS_DE_SOLICITUD, 'todas']).default('pendiente') }),
    z.strictObject({ items: z.array(solicitudSchema) }),
  ),
  plataforma_solicitud_atender: contrato(
    z.strictObject({ id: z.uuid({ error: 'La solicitud no es válida.' }), resultado: z.enum(['atendida', 'descartada']) }),
    solicitudSchema,
  ),
  /** Devuelve el enlace de un solo uso UNA vez: no queda guardado ni en la auditoría. */
  plataforma_restablecer_contrasena: contrato(
    z.strictObject({ correo: z.string().trim().toLowerCase().pipe(z.email({ error: 'El correo no es válido.' })) }),
    z.strictObject({ enlace: z.string(), venceEn: fecha }),
  ),
} as const;

export const eventosDePlataforma = {} as const;
