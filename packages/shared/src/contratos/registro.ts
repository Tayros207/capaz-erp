import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del área «registro» (Finanzas ligeras): un contrato por herramienta (`entidad_accion`) y un
// esquema por evento (`entidad.hecho`). Solo el carril de esta área edita este archivo.
// Dinero siempre en céntimos enteros; los días (`AAAA-MM-DD`) son el día contable de la empresa.

export const TIPOS_DE_CUENTA = ['caja', 'banco', 'billetera'] as const;
export const TIPOS_DE_MOVIMIENTO = ['ingreso', 'egreso'] as const;
export const MEDIOS_DE_PAGO = ['efectivo', 'transferencia', 'yape', 'plin', 'tarjeta', 'otro'] as const;
export const ORIGENES_DE_MOVIMIENTO = ['teclado', 'voz', 'agente', 'regla', 'conector', 'importacion', 'modulo'] as const;
export const TIPOS_DE_DEUDA = ['por_cobrar', 'por_pagar'] as const;
export const ESTADOS_DE_DEUDA = ['pendiente', 'parcial', 'pagada', 'anulada'] as const;
export const ESTADOS_DE_MOVIMIENTO = ['activo', 'anulado'] as const;
export const FILTROS_DE_MOVIMIENTOS = ['activos', 'anulados', 'todos'] as const;
export const FILTROS_DE_DEUDAS = ['abiertas', 'vencidas', 'pagadas', 'anuladas', 'todas'] as const;
/** El resumen abarca como mucho un año (bisiesto incluido). */
export const MAXIMO_DE_DIAS_DEL_RESUMEN = 366;

const texto = (max: number) => z.string().trim().max(max);
const soloId = z.strictObject({ id: z.uuid() });
const dia = z.iso.date();
const positivo = z.number().int().safe().min(1, { error: 'El monto debe ser mayor que cero.' });
const motivo = texto(300).min(1, { error: 'Indica el motivo.' });
const nombre = texto(80).min(1, { error: 'El nombre es obligatorio.' });
const algunCambio = (v: Record<string, unknown>) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined);
const SIN_CAMBIOS = { error: 'Indica al menos un dato que cambiar.' };

export const cuentaSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  tipo: z.enum(TIPOS_DE_CUENTA),
  sucursalId: z.string().nullable(),
  esPrincipal: z.boolean(),
  saldoInicialCentimos: z.number().int(),
  saldoCentimos: z.number().int(),
  archivadoEn: z.iso.datetime().nullable(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type CuentaDto = z.infer<typeof cuentaSchema>;

export const categoriaSchema = z.strictObject({
  id: z.string(),
  nombre: z.string(),
  tipo: z.enum(TIPOS_DE_MOVIMIENTO),
  archivadoEn: z.iso.datetime().nullable(),
});
export type CategoriaDto = z.infer<typeof categoriaSchema>;

export const movimientoSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  numero: z.number().int(),
  anio: z.number().int(),
  tipo: z.enum(TIPOS_DE_MOVIMIENTO),
  fecha: dia,
  montoCentimos: z.number().int(),
  cuentaId: z.string(),
  cuentaNombre: z.string(),
  categoriaId: z.string().nullable(),
  categoriaNombre: z.string().nullable(),
  contactoId: z.string().nullable(),
  contactoNombre: z.string().nullable(),
  medioDePago: z.enum(MEDIOS_DE_PAGO),
  descripcion: z.string().nullable(),
  deudaId: z.string().nullable(),
  sucursalId: z.string().nullable(),
  /** Identificador común de las dos patas de una transferencia entre cuentas; `null` si no es una pata. */
  transferenciaId: z.string().nullable(),
  origen: z.enum(ORIGENES_DE_MOVIMIENTO),
  estado: z.enum(ESTADOS_DE_MOVIMIENTO),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
});
export type MovimientoDto = z.infer<typeof movimientoSchema>;

export const deudaSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  numero: z.number().int(),
  anio: z.number().int(),
  tipo: z.enum(TIPOS_DE_DEUDA),
  contactoId: z.string(),
  contactoNombre: z.string(),
  concepto: z.string(),
  totalCentimos: z.number().int(),
  abonadoCentimos: z.number().int(),
  saldoCentimos: z.number().int(),
  fecha: dia,
  venceEn: dia.nullable(),
  /** Abierta (`pendiente` o `parcial`) y con `venceEn` anterior al día de hoy de la empresa. */
  vencida: z.boolean(),
  estado: z.enum(ESTADOS_DE_DEUDA),
  origenTipo: z.string().nullable(),
  origenId: z.string().nullable(),
  sucursalId: z.string().nullable(),
  notas: z.string().nullable(),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type DeudaDto = z.infer<typeof deudaSchema>;

export const deudaConAbonosSchema = z.strictObject({ ...deudaSchema.shape, abonos: z.array(movimientoSchema) });
export type DeudaConAbonosDto = z.infer<typeof deudaConAbonosSchema>;

export const crearCuentaSchema = z.strictObject({
  nombre,
  tipo: z.enum(TIPOS_DE_CUENTA),
  sucursalId: z.uuid().nullish(),
  saldoInicialCentimos: z.number().int().safe().default(0),
});
export const editarCuentaSchema = z
  .strictObject({ id: z.uuid(), nombre: nombre.optional(), tipo: z.enum(TIPOS_DE_CUENTA).optional(), sucursalId: z.uuid().nullish() })
  .refine(algunCambio, SIN_CAMBIOS);

export const registrarMovimientoSchema = z.strictObject({
  tipo: z.enum(TIPOS_DE_MOVIMIENTO),
  montoCentimos: positivo,
  fecha: dia.optional(),
  cuentaId: z.uuid().optional(),
  categoriaId: z.uuid().nullish(),
  contactoId: z.uuid().nullish(),
  medioDePago: z.enum(MEDIOS_DE_PAGO).default('efectivo'),
  descripcion: texto(500).nullish(),
  sucursalId: z.uuid().nullish(),
  origen: z.enum(ORIGENES_DE_MOVIMIENTO).default('teclado'),
  origenRef: texto(200).optional(),
});

export const transferirCuentasSchema = z.strictObject({
  origenId: z.uuid(),
  destinoId: z.uuid(),
  montoCentimos: positivo,
  fecha: dia.optional(),
  nota: texto(500).nullish(),
});
export const transferenciaSchema = z.strictObject({ transferenciaId: z.string(), egreso: movimientoSchema, ingreso: movimientoSchema });
export type TransferenciaDto = z.infer<typeof transferenciaSchema>;

/** Categoría reservada de las dos patas de una transferencia: no se crea, edita, archiva ni se usa a mano. */
export const NOMBRE_DE_CATEGORIA_DE_TRANSFERENCIA = 'Transferencia';

export const listarMovimientosSchema = z.strictObject({
  ...paginaSchema.shape,
  desde: dia.optional(),
  hasta: dia.optional(),
  tipo: z.enum(TIPOS_DE_MOVIMIENTO).optional(),
  cuentaId: z.uuid().optional(),
  categoriaId: z.uuid().optional(),
  contactoId: z.uuid().optional(),
  deudaId: z.uuid().optional(),
  estado: z.enum(FILTROS_DE_MOVIMIENTOS).default('activos'),
});

export const crearDeudaSchema = z
  .strictObject({
    tipo: z.enum(TIPOS_DE_DEUDA),
    contactoId: z.uuid(),
    concepto: texto(200).min(1, { error: 'Indica el concepto.' }),
    totalCentimos: positivo,
    fecha: dia.optional(),
    venceEn: dia.nullish(),
    sucursalId: z.uuid().nullish(),
    notas: texto(2000).nullish(),
    origenTipo: texto(40).min(1).optional(),
    origenId: texto(100).min(1).optional(),
  })
  .refine((v) => (v.origenTipo === undefined) === (v.origenId === undefined), { error: 'El origen se indica completo (tipo e identificador) o no se indica.' });
export const listarDeudasSchema = z.strictObject({
  ...paginaSchema.shape,
  tipo: z.enum(TIPOS_DE_DEUDA),
  estado: z.enum(FILTROS_DE_DEUDAS).default('abiertas'),
  contactoId: z.uuid().optional(),
});
export const editarDeudaSchema = z
  .strictObject({ id: z.uuid(), concepto: texto(200).min(1, { error: 'Indica el concepto.' }).optional(), venceEn: dia.nullish(), notas: texto(2000).nullish() })
  .refine(algunCambio, SIN_CAMBIOS);
export const abonarDeudaSchema = z.strictObject({
  id: z.uuid(),
  montoCentimos: positivo,
  fecha: dia.optional(),
  cuentaId: z.uuid().optional(),
  medioDePago: z.enum(MEDIOS_DE_PAGO).default('efectivo'),
  descripcion: texto(500).nullish(),
  origen: z.enum(ORIGENES_DE_MOVIMIENTO).default('teclado'),
});

export const crearDeudaConAdelantoSchema = z
  .strictObject({
    tipo: z.enum(TIPOS_DE_DEUDA),
    contactoId: z.uuid(),
    concepto: texto(200).min(1, { error: 'Indica el concepto.' }),
    totalCentimos: positivo,
    adelantoCentimos: positivo,
    fecha: dia.optional(),
    venceEn: dia.nullish(),
    cuentaId: z.uuid().optional(),
    medioDePago: z.enum(MEDIOS_DE_PAGO).default('efectivo'),
    sucursalId: z.uuid().nullish(),
    notas: texto(2000).nullish(),
    origen: z.enum(ORIGENES_DE_MOVIMIENTO).default('teclado'),
    /** De dónde nace la deuda (p. ej. una orden de producción), para que el módulo de origen la encuentre después. */
    origenTipo: texto(40).min(1).optional(),
    origenId: texto(100).min(1).optional(),
  })
  .refine((v) => v.adelantoCentimos < v.totalCentimos, { error: 'El adelanto debe ser menor que el total.' })
  .refine((v) => (v.origenTipo === undefined) === (v.origenId === undefined), { error: 'El origen se indica completo (tipo e identificador) o no se indica.' });

export const cajaDelDiaSchema = z.strictObject({
  fecha: dia,
  cuentas: z.array(
    z.strictObject({
      cuentaId: z.string(),
      nombre: z.string(),
      saldoInicialCentimos: z.number().int(),
      ingresosCentimos: z.number().int(),
      egresosCentimos: z.number().int(),
      /** Entradas menos salidas por transferencias entre cuentas del día: no son ingresos ni egresos, pero mueven el saldo. */
      transferenciasNetasCentimos: z.number().int(),
      saldoFinalCentimos: z.number().int(),
      movimientos: z.number().int(),
    }),
  ),
  totalIngresosCentimos: z.number().int(),
  totalEgresosCentimos: z.number().int(),
});
export type CajaDelDiaDto = z.infer<typeof cajaDelDiaSchema>;

const DIA_EN_MS = 86_400_000;
/** Días entre dos fechas `AAAA-MM-DD` (las dos incluidas). Las fechas ISO se comparan en UTC: sin zonas. */
export const diasDelRango = (desde: string, hasta: string): number => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_EN_MS) + 1;

export const pedirResumenSchema = z
  .strictObject({ desde: dia, hasta: dia })
  .refine((v) => v.hasta >= v.desde, { error: 'La fecha final no puede ser anterior a la inicial.' })
  .refine((v) => v.hasta < v.desde || diasDelRango(v.desde, v.hasta) <= MAXIMO_DE_DIAS_DEL_RESUMEN, { error: `El resumen abarca como máximo ${MAXIMO_DE_DIAS_DEL_RESUMEN} días.` });
export const resumenDeRegistroSchema = z.strictObject({
  desde: dia,
  hasta: dia,
  ingresosCentimos: z.number().int(),
  egresosCentimos: z.number().int(),
  netoCentimos: z.number().int(),
  porCobrarCentimos: z.number().int(),
  porPagarCentimos: z.number().int(),
  vencidasPorCobrar: z.number().int(),
  vencidasPorCobrarCentimos: z.number().int(),
  vencidasPorPagar: z.number().int(),
  porCategoria: z.array(z.strictObject({ categoriaId: z.string().nullable(), nombre: z.string(), tipo: z.enum(TIPOS_DE_MOVIMIENTO), totalCentimos: z.number().int() })),
});
export type ResumenDeRegistroDto = z.infer<typeof resumenDeRegistroSchema>;

export const contratosDeRegistro = {
  registro_iniciar: contrato(z.strictObject({}), z.strictObject({ cuentasCreadas: z.number().int(), categoriasCreadas: z.number().int() })),
  cuentas_listar: contrato(z.strictObject({ incluirArchivadas: z.boolean().default(false) }), listadoSchema(cuentaSchema)),
  cuenta_crear: contrato(crearCuentaSchema, cuentaSchema),
  cuenta_editar: contrato(editarCuentaSchema, cuentaSchema),
  cuenta_archivar: contrato(soloId, cuentaSchema),
  cuenta_marcar_principal: contrato(soloId, cuentaSchema),
  categorias_listar: contrato(z.strictObject({ tipo: z.enum(TIPOS_DE_MOVIMIENTO).optional(), incluirArchivadas: z.boolean().default(false) }), listadoSchema(categoriaSchema)),
  categoria_crear: contrato(z.strictObject({ nombre, tipo: z.enum(TIPOS_DE_MOVIMIENTO) }), categoriaSchema),
  categoria_editar: contrato(z.strictObject({ id: z.uuid(), nombre }), categoriaSchema),
  categoria_archivar: contrato(soloId, categoriaSchema),
  movimiento_registrar: contrato(registrarMovimientoSchema, movimientoSchema),
  movimiento_ver: contrato(soloId, movimientoSchema),
  movimientos_listar: contrato(listarMovimientosSchema, listadoSchema(movimientoSchema)),
  cuentas_transferir: contrato(transferirCuentasSchema, transferenciaSchema),
  movimiento_anular: contrato(z.strictObject({ id: z.uuid(), motivo }), movimientoSchema),
  deuda_crear: contrato(crearDeudaSchema, deudaSchema),
  deuda_ver: contrato(soloId, deudaConAbonosSchema),
  deudas_listar: contrato(listarDeudasSchema, listadoSchema(deudaSchema)),
  deuda_editar: contrato(editarDeudaSchema, deudaSchema),
  deuda_abonar: contrato(abonarDeudaSchema, z.strictObject({ deuda: deudaSchema, movimiento: movimientoSchema })),
  deuda_crear_con_adelanto: contrato(crearDeudaConAdelantoSchema, z.strictObject({ deuda: deudaSchema, movimiento: movimientoSchema })),
  deuda_anular: contrato(z.strictObject({ id: z.uuid(), motivo }), deudaSchema),
  caja_del_dia: contrato(z.strictObject({ fecha: dia.optional(), cuentaId: z.uuid().optional() }), cajaDelDiaSchema),
  registro_resumen: contrato(pedirResumenSchema, resumenDeRegistroSchema),
} as const;

export const eventosDeRegistro = {
  'movimiento.registrado': z.strictObject({ id: z.string(), codigo: z.string(), tipo: z.enum(['ingreso', 'egreso']), montoCentimos: z.number().int(), fecha: z.iso.date(), cuentaId: z.string(), contactoId: z.string().nullable(), deudaId: z.string().nullable() }),
  'movimiento.anulado': z.strictObject({ id: z.string(), codigo: z.string(), deudaId: z.string().nullable() }),
  'deuda.creada': z.strictObject({ id: z.string(), codigo: z.string(), tipo: z.enum(['por_cobrar', 'por_pagar']), contactoId: z.string(), totalCentimos: z.number().int(), venceEn: z.iso.date().nullable(), origenTipo: z.string().nullable(), origenId: z.string().nullable() }),
  'deuda.abonada': z.strictObject({ id: z.string(), codigo: z.string(), movimientoId: z.string(), montoCentimos: z.number().int(), saldoCentimos: z.number().int() }),
  'deuda.pagada': z.strictObject({ id: z.string(), codigo: z.string(), tipo: z.enum(['por_cobrar', 'por_pagar']), contactoId: z.string(), totalCentimos: z.number().int() }),
  'deuda.anulada': z.strictObject({ id: z.string(), codigo: z.string() }),
} as const;
