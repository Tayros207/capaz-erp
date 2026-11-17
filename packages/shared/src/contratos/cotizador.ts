import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';
import { MODOS_DE_COTIZACION, vistaDelCuadroSchema } from './cotizador-cuadro-vista.js';

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
export type CondicionesDeCotizacion = z.infer<typeof condicionesSchema>;
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
  /** Nombre del producto del catálogo enlazado (nulo si la lista no tiene producto). */
  productoNombre: z.string().nullable(),
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
/** Un resultado de `cotizador_productos_buscar`: de dónde sale el precio con que se cotiza. */
export const ORIGENES_DE_PRECIO = ['lista', 'catalogo', 'sin_precio'] as const;
export const productoCotizableSchema = z.strictObject({
  productoId: z.string().nullable(),
  listaId: z.string().nullable(),
  nombre: z.string(),
  unidad: z.string(),
  origen: z.enum(ORIGENES_DE_PRECIO),
  lista: listaDePrecioSchema.optional(),
  /** Solo con `origen = 'catalogo'`: el precio del catálogo ya pasado a sin IGV. */
  precioCatalogoSinIgvMilesimas: z.number().int().optional(),
  afectoIgv: z.boolean().optional(),
});
export type ProductoCotizableDto = z.infer<typeof productoCotizableSchema>;

export const crearListaDePrecioSchema = z.strictObject({
  nombre,
  /** Sin unidad: la del producto enlazado o, si no hay, «unidad». */
  unidad: texto(20).min(1).optional(),
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
export const filaDePrecioSchema = z.strictObject({
  cantidadMilesimas: z.number().int(),
  importeCentimos: z.number().int(),
  igvCentimos: z.number().int(),
  totalCentimos: z.number().int(),
  precioUnitarioMilesimas: z.number().int(),
});
export type FilaDePrecioDto = z.infer<typeof filaDePrecioSchema>;
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
  /** Precios del lote a 100, 200, 300, 500, 1.000, 2.000, 3.000 y 5.000 con el ajuste del cliente y el redondeo (sin el ajuste de esta consulta). */
  tabla: z.array(filaDePrecioSchema),
  /** La cantidad no es una de las tres referencias (100, 1.000, 5.000): el precio es una estimación entre ellas. */
  estimacion: z.boolean(),
  /** Con modo escalón: la cantidad (en milésimas) de la referencia cuyo unitario rige; con curva, `null`. */
  escalon: z.number().int().nullable(),
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

// --- Cotizaciones (s2). Precios y totales SIN IGV; el IGV se calcula por línea. ---

export const TIPOS_DE_LINEA_DE_COTIZACION = ['lista', 'manual'] as const;
export const TIPOS_DE_EVENTO_DE_COTIZACION = ['creada', 'editada', 'emitida', 'enviada', 'aceptada', 'rechazada', 'anulada', 'nueva_version', 'vista', 'enlace_generado', 'enlace_revocado'] as const;
/** Por dónde ocurrió un evento: la pantalla, el enlace público del cliente o el sistema. */
export const CANALES_DE_EVENTO_DE_COTIZACION = ['ui', 'enlace', 'sistema'] as const;
export const FILTROS_DE_ESTADO_DE_COTIZACION = ['abiertas', ...ESTADOS_DE_COTIZACION, 'todas'] as const;
export const MAXIMO_DE_LINEAS_DE_COTIZACION = 100;
/** Cantidades de la tabla de precios de `precio_consultar`, en unidades. */
export const CANTIDADES_DE_LA_TABLA_DE_PRECIOS = [100, 200, 300, 500, 1000, 2000, 3000, 5000] as const;
/**
 * Mensajes fijos de `cotizacion_emitir` (el catálogo `codigos.ts` no tiene `motivo_requerido`: va como `conflicto` con este texto;
 * pendiente pedirlo como solicitud de cambio).
 */
export const MENSAJE_DE_MOTIVO_REQUERIDO = 'motivo_requerido: el margen está por debajo del mínimo configurado; indica el motivo para poder emitirla.';
export const PREFIJO_DE_PRECIOS_CAMBIARON = 'Los precios de lista cambiaron desde que se armó la cotización.';

const cantidadDeLinea = z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' });
const dia = z.iso.date();

/** Una línea que se anota: de la lista (el servidor calcula el precio) o manual (con precio unitario sin IGV). */
export const lineaDeCotizacionEntradaSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('lista'), listaId: z.uuid(), cantidadMilesimas: cantidadDeLinea, descripcion: texto(300).min(1).optional(), ajuste: ajusteDePrecioSchema.optional() }),
  z.strictObject({
    tipo: z.literal('manual'),
    productoId: z.uuid().nullish(),
    descripcion: texto(300).min(1, { error: 'La descripción es obligatoria.' }),
    unidad: texto(20).min(1).default('unidad'),
    cantidadMilesimas: cantidadDeLinea,
    precioUnitarioMilesimas: z.number().int().safe().min(1, { error: 'El precio debe ser mayor que cero.' }),
  }),
]);
export type LineaDeCotizacionEntrada = z.infer<typeof lineaDeCotizacionEntradaSchema>;

const lineasDeEntrada = z.array(lineaDeCotizacionEntradaSchema).min(1, { error: 'Agrega al menos una línea.' }).max(MAXIMO_DE_LINEAS_DE_COTIZACION);
const costo = z.number().int().safe().min(0, { error: 'El costo no puede ser negativo.' });
const titulo = texto(200).min(1, { error: 'El título es obligatorio.' });

export const lineaDeCotizacionSchema = z.strictObject({
  posicion: z.number().int(),
  tipo: z.enum(TIPOS_DE_LINEA_DE_COTIZACION),
  productoId: z.string().nullable(),
  listaId: z.string().nullable(),
  descripcion: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
  /** Sin IGV; informativo. El que manda es el importe. */
  precioUnitarioMilesimas: z.number().int(),
  importeCentimos: z.number().int(),
  igvCentimos: z.number().int(),
  totalCentimos: z.number().int(),
  /** Solo en líneas de lista: el precio de lista (sin IGV) antes del ajuste de esta cotización; `null` en una manual. */
  precioListaCentimos: z.number().int().nullable(),
  /** Solo en líneas de lista: el ajuste de esta cotización (`null` = sin ajuste). */
  ajuste: ajusteDePrecioSchema.nullable(),
});

/** Lo que muestra una lista de cotizaciones: la versión vigente, sin sus líneas. */
export const cotizacionSchema = z.strictObject({
  id: z.string(),
  /** «Borrador» mientras no tenga número; después «COT-2026-0001» y, desde la segunda versión, «COT-2026-0001 v2». */
  codigo: z.string(),
  numero: z.number().int().nullable(),
  anio: z.number().int().nullable(),
  titulo: z.string(),
  estado: z.enum(ESTADOS_DE_COTIZACION),
  clienteId: z.string().nullable(),
  clienteNombre: z.string().nullable(),
  versionActual: z.number().int(),
  conOpciones: z.boolean(),
  igvPorcentaje: z.number().int(),
  subtotalCentimos: z.number().int(),
  igvCentimos: z.number().int(),
  totalCentimos: z.number().int(),
  validaHasta: z.iso.date().nullable(),
  cantidadDeLineas: z.number().int(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
  actualizadoEn: z.iso.datetime(),
});
export type CotizacionDto = z.infer<typeof cotizacionSchema>;

export const versionDeCotizacionSchema = z.strictObject({
  version: z.number().int(),
  subtotalCentimos: z.number().int(),
  totalCentimos: z.number().int(),
  emitidaEn: z.iso.datetime().nullable(),
});
export const eventoDeCotizacionSchema = z.strictObject({
  tipo: z.enum(TIPOS_DE_EVENTO_DE_COTIZACION),
  version: z.number().int(),
  motivo: z.string().nullable(),
  /** Nulo cuando el evento lo produjo el cliente desde el enlace público. */
  usuarioId: z.string().nullable(),
  canal: z.enum(CANALES_DE_EVENTO_DE_COTIZACION),
  /** Lo que se anotó en el evento, en texto (la nota o las opciones elegidas); `null` si no hay. */
  detalle: z.string().nullable(),
  creadoEn: z.iso.datetime(),
});

/** La cotización con la versión pedida (por defecto la vigente), sus líneas, versiones e historial. */
export const cotizacionCompletaSchema = cotizacionSchema.extend({
  /** La versión cuyas líneas y totales se muestran. */
  version: z.number().int(),
  /** `rapida` (lista de precios o líneas manuales) o `cuadro` (por partes, con el motor de costeo). */
  modo: z.enum(MODOS_DE_COTIZACION),
  /** La vista del cuadro (solo en modo `cuadro`); costos y margen únicamente con `cotizador:costos`. */
  cuadro: vistaDelCuadroSchema.nullable(),
  notas: z.string().nullable(),
  observaciones: z.string().nullable(),
  condiciones: condicionesSchema,
  /** Solo para quien tiene `cotizador:costos`; para los demás son `null`. */
  costoCentimos: z.number().int().nullable(),
  margenPct: z.string().nullable(),
  motivoMargenBajo: z.string().nullable(),
  emitidaEn: z.iso.datetime().nullable(),
  lineas: z.array(lineaDeCotizacionSchema),
  /** Posiciones de las líneas que aceptó el cliente. */
  lineasAceptadas: z.array(z.number().int()).nullable(),
  totalAceptadoCentimos: z.number().int().nullable(),
  aceptadaEn: z.iso.datetime().nullable(),
  motivoRechazo: z.string().nullable(),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
  versiones: z.array(versionDeCotizacionSchema),
  /** Lo más reciente primero. */
  historial: z.array(eventoDeCotizacionSchema),
  /** Avisos de la operación (p. ej. «el precio de lista de X cambió»); vacío casi siempre. */
  avisos: z.array(z.string()),
});
export type CotizacionCompletaDto = z.infer<typeof cotizacionCompletaSchema>;

export const resumenDeCotizadorSchema = z.strictObject({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  /** Cotizaciones creadas en el período, por estado actual. */
  porEstado: z.array(z.strictObject({ estado: z.enum(ESTADOS_DE_COTIZACION), cantidad: z.number().int(), totalCentimos: z.number().int() })),
  /** Aceptadas en el período y lo aceptado (con IGV). */
  aceptadas: z.strictObject({ cantidad: z.number().int(), totalCentimos: z.number().int() }),
  /** Emitidas o enviadas cuya validez ya pasó. */
  vencidas: z.number().int(),
});

const crearCotizacionSchema = z.strictObject({
  titulo,
  clienteId: z.uuid().nullish(),
  lineas: lineasDeEntrada,
  conOpciones: z.boolean().default(false),
  notas: texto(1000).nullish(),
  observaciones: texto(1000).nullish(),
  condiciones: condicionesSchema.partial().optional(),
  costoCentimos: costo.nullish(),
});
const editarCotizacionSchema = z
  .strictObject({
    id: z.uuid(),
    titulo: titulo.optional(),
    clienteId: z.uuid().nullish(),
    lineas: lineasDeEntrada.optional(),
    conOpciones: z.boolean().optional(),
    notas: texto(1000).nullish(),
    observaciones: texto(1000).nullish(),
    condiciones: condicionesSchema.partial().optional(),
    costoCentimos: costo.nullish(),
  })
  .refine((v) => Object.entries(v).some(([k, x]) => k !== 'id' && x !== undefined), { error: 'Indica al menos un dato que cambiar.' });

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
      /** Solo la lista de este producto del catálogo. */
      productoId: z.uuid().optional(),
      /** Solo las listas sin producto (las heredadas), para enlazarlas al catálogo. */
      soloSinProducto: z.boolean().default(false),
    }),
    listadoSchema(listaDePrecioSchema),
  ),
  cotizador_productos_buscar: contrato(
    z.strictObject({ texto: texto(120).min(1, { error: 'Escribe qué buscar.' }), limite: z.number().int().min(1).max(20).default(8) }),
    z.strictObject({ items: z.array(productoCotizableSchema) }),
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
  cotizacion_crear: contrato(crearCotizacionSchema, cotizacionCompletaSchema),
  cotizacion_editar: contrato(editarCotizacionSchema, cotizacionCompletaSchema),
  cotizacion_ver: contrato(z.strictObject({ id: z.uuid(), version: z.number().int().min(1).optional() }), cotizacionCompletaSchema),
  cotizaciones_listar: contrato(
    z.strictObject({
      ...paginaSchema.shape,
      estado: z.enum(FILTROS_DE_ESTADO_DE_COTIZACION).default('todas'),
      clienteId: z.uuid().optional(),
      buscar: texto(100).optional(),
    }),
    listadoSchema(cotizacionSchema),
  ),
  cotizacion_emitir: contrato(
    z.strictObject({ id: z.uuid(), motivoMargenBajo: texto(300).min(1).optional(), aceptarPreciosDeHoy: z.boolean().optional() }),
    cotizacionCompletaSchema,
  ),
  cotizacion_nueva_version: contrato(soloId, cotizacionCompletaSchema),
  cotizacion_duplicar: contrato(soloId, cotizacionCompletaSchema),
  cotizacion_marcar_enviada: contrato(soloId, cotizacionCompletaSchema),
  cotizacion_aceptar: contrato(
    z.strictObject({ id: z.uuid(), posiciones: z.array(z.number().int().min(0)).min(1).max(MAXIMO_DE_LINEAS_DE_COTIZACION).optional() }),
    cotizacionCompletaSchema,
  ),
  cotizacion_rechazar: contrato(z.strictObject({ id: z.uuid(), motivo: texto(300).nullish() }), cotizacionCompletaSchema),
  cotizacion_anular: contrato(z.strictObject({ id: z.uuid(), motivo: texto(300).min(1, { error: 'Indica el motivo.' }) }), cotizacionCompletaSchema),
  cotizador_resumen: contrato(
    z.strictObject({ desde: dia, hasta: dia }).refine((v) => v.desde <= v.hasta, { error: 'El período empieza antes de terminar.' }),
    resumenDeCotizadorSchema,
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
