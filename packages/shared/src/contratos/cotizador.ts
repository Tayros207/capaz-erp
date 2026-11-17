import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';

// Contratos del área «cotizador»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo. Precios de la lista y de la cotización SIN IGV.
// Dinero en céntimos enteros; cantidades en milésimas enteras; porcentajes como texto decimal (interior del motor, R22).

export const MODOS_INTERMEDIOS = ['curva', 'escalon'] as const;
export const REDONDEOS_COMERCIALES = ['ninguno', '1', '5', '10'] as const;
export const BASES_DE_UTILIDAD = ['venta', 'costo'] as const;
export const ESTADOS_DE_COTIZACION = ['borrador', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada'] as const;
export const UNIDADES_SUGERIDAS = ['unidad', 'ciento', 'millar', 'pliego', 'm2', 'hora', 'juego', 'talonario'] as const;
/** La lista cotiza entre estas cantidades; fuera de ellas se cotiza aparte. */
export const CANTIDAD_MINIMA_DE_LISTA_MILESIMAS = 100_000;
export const CANTIDAD_MAXIMA_DE_LISTA_MILESIMAS = 5_000_000;
export const DIAS_PARA_REVISAR_PRECIO = 90;
/** En el corte B1 solo 18 o 0: Pedidos calcula con 18 (ver FICHAS-OLA-4 §11, punto 13). */
export const IGV_ADMITIDOS = [18, 0] as const;

const texto = (max: number) => z.string().trim().max(max);
const soloId = z.strictObject({ id: z.uuid() });
const positivo = z.number().int().safe().min(1, { error: 'El precio debe ser mayor que cero.' });
const nombre = texto(120).min(1, { error: 'El nombre es obligatorio.' });
/** Porcentajes: texto decimal (interior del motor, R22). */
const porcentaje = z.string().regex(/^\d{1,4}(\.\d{1,3})?$/, { error: 'Porcentaje inválido.' });
const porcentajeConSigno = z.string().regex(/^-?\d{1,3}(\.\d{1,3})?$/, { error: 'Porcentaje inválido.' });

export const condicionesSchema = z.strictObject({
  validezDias: z.number().int().min(1).max(365).nullable(),
  plazoEntrega: texto(300),
  formaPago: texto(300),
  tolerancia: texto(300),
  noIncluye: texto(300),
});
export const CONDICIONES_VACIAS = { validezDias: null, plazoEntrega: '', formaPago: '', tolerancia: '', noIncluye: '' } as const;

export const configuracionDeCotizadorSchema = z.strictObject({
  utilidadPct: z.string(),
  utilidadBase: z.enum(BASES_DE_UTILIDAD),
  umbralVerdePct: z.string(),
  umbralMinimoPct: z.string(),
  redondeoComercial: z.enum(REDONDEOS_COMERCIALES),
  igvPorcentaje: z.number().int(),
  condiciones: condicionesSchema,
  mensajeWhatsapp: z.string().nullable(),
  actualizadoEn: z.iso.datetime().nullable(),
});
export type ConfiguracionDeCotizadorDto = z.infer<typeof configuracionDeCotizadorSchema>;

export const listaDePrecioSchema = z.strictObject({
  id: z.string(),
  productoId: z.string().nullable(),
  nombre: z.string(),
  unidad: z.string(),
  p100Centimos: z.number().int(),
  p1000Centimos: z.number().int(),
  p5000Centimos: z.number().int(),
  modoIntermedio: z.enum(MODOS_INTERMEDIOS),
  precioMinimoCentimos: z.number().int().nullable(),
  aConfirmado: z.boolean(),
  preciosFijadosEn: z.iso.datetime(),
  /** Más de DIAS_PARA_REVISAR_PRECIO días sin fijar precios. */
  porRevisar: z.boolean(),
  archivadoEn: z.iso.datetime().nullable(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type ListaDePrecioDto = z.infer<typeof listaDePrecioSchema>;

const referencias = { p100Centimos: positivo, p1000Centimos: positivo, p5000Centimos: positivo };
export const crearListaDePrecioSchema = z.strictObject({
  nombre,
  unidad: texto(20).min(1).default('unidad'),
  productoId: z.uuid().nullish(),
  ...referencias,
  modoIntermedio: z.enum(MODOS_INTERMEDIOS).default('curva'),
  precioMinimoCentimos: positivo.nullish(),
  /** El unitario no baja con la cantidad: se guarda solo si la persona lo confirma. */
  confirmarUnitarioNoBaja: z.boolean().default(false),
});
export const editarListaDePrecioSchema = z
  .strictObject({
    id: z.uuid(),
    nombre: nombre.optional(),
    unidad: texto(20).min(1).optional(),
    productoId: z.uuid().nullish(),
    p100Centimos: positivo.optional(),
    p1000Centimos: positivo.optional(),
    p5000Centimos: positivo.optional(),
    modoIntermedio: z.enum(MODOS_INTERMEDIOS).optional(),
    precioMinimoCentimos: positivo.nullish(),
    confirmarUnitarioNoBaja: z.boolean().default(false),
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && k !== 'confirmarUnitarioNoBaja' && x !== undefined), {
    error: 'Indica al menos un dato que cambiar.',
  });

/** El ajuste de UNA cotización; nunca toca la lista. */
export const ajusteDePrecioSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('ninguno') }),
  z.strictObject({ tipo: z.literal('precio'), importeCentimos: positivo }),
  z.strictObject({ tipo: z.literal('monto'), importeCentimos: z.number().int().safe() }),
]);
export type AjusteDePrecio = z.infer<typeof ajusteDePrecioSchema>;
export const consultarPrecioSchema = z.strictObject({
  listaId: z.uuid(),
  cantidadMilesimas: z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' }),
  clienteId: z.uuid().optional(),
  ajuste: ajusteDePrecioSchema.default({ tipo: 'ninguno' }),
});
export const precioConsultadoSchema = z.strictObject({
  listaId: z.string(),
  nombre: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
  /** Lista → ajuste del cliente → redondeo comercial. Sin IGV. */
  precioListaCentimos: z.number().int(),
  /** Lo que se cobra, sin IGV (la lista con el ajuste de esta cotización). */
  importeCentimos: z.number().int(),
  igvCentimos: z.number().int(),
  totalCentimos: z.number().int(),
  precioUnitarioMilesimas: z.number().int(),
  minimoAplicado: z.boolean(),
  ajusteClientePct: z.string().nullable(),
  redondeoComercial: z.enum(REDONDEOS_COMERCIALES),
  igvPorcentaje: z.number().int(),
});
export type PrecioConsultadoDto = z.infer<typeof precioConsultadoSchema>;

export const ajusteDeClienteSchema = z.strictObject({
  clienteId: z.string(),
  clienteNombre: z.string(),
  porcentaje: z.string(),
  nota: z.string().nullable(),
  actualizadoEn: z.iso.datetime(),
});
export type AjusteDeClienteDto = z.infer<typeof ajusteDeClienteSchema>;

const configurarSchema = z
  .strictObject({
    utilidadPct: porcentaje.optional(),
    utilidadBase: z.enum(BASES_DE_UTILIDAD).optional(),
    umbralVerdePct: porcentaje.optional(),
    umbralMinimoPct: porcentaje.optional(),
    redondeoComercial: z.enum(REDONDEOS_COMERCIALES).optional(),
    igvPorcentaje: z.union([z.literal(18), z.literal(0)]).optional(),
    condiciones: condicionesSchema.optional(),
    mensajeWhatsapp: texto(500).nullable().optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

export const contratosDeCotizador = {
  cotizador_iniciar: contrato(z.strictObject({}), z.strictObject({ configuracionCreada: z.boolean() })),
  cotizador_configuracion_ver: contrato(z.strictObject({}), configuracionDeCotizadorSchema),
  cotizador_configurar: contrato(configurarSchema, configuracionDeCotizadorSchema),
  listas_precio_listar: contrato(
    z.strictObject({
      ...paginaSchema.shape,
      buscar: texto(100).optional(),
      estado: z.enum(['activas', 'archivadas', 'todas']).default('activas'),
      soloPorRevisar: z.boolean().default(false),
    }),
    listadoSchema(listaDePrecioSchema),
  ),
  lista_precio_ver: contrato(soloId, listaDePrecioSchema),
  lista_precio_crear: contrato(crearListaDePrecioSchema, listaDePrecioSchema),
  lista_precio_editar: contrato(editarListaDePrecioSchema, listaDePrecioSchema),
  lista_precio_archivar: contrato(soloId, listaDePrecioSchema),
  precio_consultar: contrato(consultarPrecioSchema, precioConsultadoSchema),
  ajustes_cliente_listar: contrato(z.strictObject({}), listadoSchema(ajusteDeClienteSchema)),
  ajuste_cliente_fijar: contrato(
    z.strictObject({ clienteId: z.uuid(), porcentaje: porcentajeConSigno.nullable(), nota: texto(200).nullable().optional() }),
    z.strictObject({ clienteId: z.string(), ajuste: ajusteDeClienteSchema.nullable() }),
  ),
} as const;

const lineaAceptadaSchema = z.strictObject({
  productoId: z.string().nullable(),
  descripcion: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
  precioUnitarioMilesimas: z.number().int(),
  afectoIgv: z.boolean(),
});
export const eventosDeCotizador = {
  'cotizacion.emitida': z.strictObject({
    id: z.string(),
    codigo: z.string(),
    version: z.number().int(),
    clienteId: z.string(),
    totalCentimos: z.number().int(),
  }),
  'cotizacion.aceptada': z.strictObject({
    id: z.string(),
    codigo: z.string(),
    version: z.number().int(),
    clienteId: z.string(),
    igvPorcentaje: z.number().int(),
    subtotalCentimos: z.number().int(),
    igvCentimos: z.number().int(),
    totalCentimos: z.number().int(),
    /** Ya en el formato de una línea de pedido: precios CON IGV (D17). */
    lineas: z.array(lineaAceptadaSchema).min(1).max(100),
  }),
  'cotizacion.rechazada': z.strictObject({ id: z.string(), codigo: z.string(), version: z.number().int(), clienteId: z.string() }),
  'cotizacion.anulada': z.strictObject({ id: z.string(), codigo: z.string(), estadoAnterior: z.enum(ESTADOS_DE_COTIZACION) }),
} as const;
