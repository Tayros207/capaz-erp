import { z } from 'zod';

// La vista del cuadro por partes tal como sale de una herramienta o de `cotizacion_ver`. Costos y margen viajan solo en las
// claves `interno` (nunca están presentes sin el permiso `cotizador:costos`). Dinero en céntimos enteros (regla 9); lo que no
// es un importe final (cantidades, medidas, costo unitario de una fila, porcentajes) viaja como texto decimal con punto.
// Va en su propio archivo para que `cotizador.ts` (la cotización completa) y `cotizador-cuadro.ts` (las herramientas) la
// compartan sin importarse entre sí.

export const FACTORES_DEL_CUADRO = ['material', 'planchas', 'impresion', 'diseno', 'acabado', 'indirectos'] as const;
export const ESCALAS_DEL_CUADRO = ['fija', 'por_pliego', 'por_unidad'] as const;
export const COLUMNAS_DEL_CUADRO = ['100', '1000', '5000'] as const;
export const BASES_DE_UTILIDAD_DEL_CUADRO = ['venta', 'costo'] as const;
export const SEMAFOROS = ['verde', 'ambar', 'rojo'] as const;
export const MODOS_DE_COTIZACION = ['rapida', 'cuadro'] as const;
export const PLANTILLAS_DEL_CUADRO = ['volantes', 'en_blanco'] as const;
/** Tope de filas de un cuadro: un guardarraíl contra un agente que entre en bucle agregando filas. */
export const MAXIMO_DE_FILAS_DEL_CUADRO = 60;

export const cantidadDeCuadro = z.string().regex(/^\d{1,9}(\.\d{1,3})?$/, { error: 'Cantidad inválida: hasta 3 decimales, con punto.' });
export const costoUnitarioDeCuadro = z.string().regex(/^\d{1,10}(\.\d{1,4})?$/, { error: 'Costo inválido: hasta 4 decimales, con punto.' });
export const porcentajeDeCuadro = z.string().regex(/^\d{1,4}(\.\d{1,3})?$/, { error: 'Porcentaje inválido: hasta 3 decimales, con punto.' });
export const medidaDeCuadro = z.string().regex(/^\d{1,5}(\.\d{1,2})?$/, { error: 'Medida inválida: hasta 2 decimales, con punto.' });
const conteo = z.string().regex(/^\d+$/);
const centimos = z.number().int().safe();

export const dimensionesDeCuadroSchema = z.strictObject({ anchoCm: medidaDeCuadro, altoCm: medidaDeCuadro });
export const etapaDeCuadroSchema = z.strictObject({
  nombre: z.string().trim().min(1, { error: 'Falta el nombre de la etapa.' }).max(60),
  mermaPct: porcentajeDeCuadro,
  arranque: z.string().regex(/^\d{1,6}$/, { error: 'Debe ser un número entero de hojas.' }),
});

export const trabajoDelCuadroSchema = z.strictObject({
  producto: z.string(),
  descripcion: z.string().optional(),
  cantidad: cantidadDeCuadro,
  pieza: dimensionesDeCuadroSchema.nullable(),
  tintas: z.number().int(),
  caras: z.number().int(),
  cliente: z.string(),
});

export const imposicionDelCuadroSchema = z.strictObject({
  pliegoMadre: dimensionesDeCuadroSchema.nullable(),
  pliegoMaquina: dimensionesDeCuadroSchema.nullable(),
  sangradoCm: medidaDeCuadro.nullable(),
  calleCm: medidaDeCuadro.nullable(),
  pinzaCm: medidaDeCuadro.nullable(),
  formatoMaximo: dimensionesDeCuadroSchema.nullable(),
  etapas: z.array(etapaDeCuadroSchema),
});

/** El reparto de la pieza en el pliego y los pliegos que hacen falta (el desglose de pliegos del recibo). */
export const pliegosDelCuadroSchema = z.strictObject({
  poses: conteo,
  columnas: conteo,
  filas: conteo,
  girada: z.boolean(),
  pliegosNetos: conteo,
  etapas: z.array(
    z.strictObject({ nombre: z.string(), mermaPct: z.string(), arranque: z.string(), salida: z.string(), trasPorcentaje: z.string(), entrada: z.string() }),
  ),
  pliegosDeMaquina: conteo,
  pliegosPorMadre: conteo,
  pliegosMadre: conteo,
});

export const filaDelCuadroSchema = z.strictObject({
  id: z.string(),
  /** Su posición en el cuadro: es lo que se dice («fila 3»). */
  numero: z.number().int(),
  factor: z.enum(FACTORES_DEL_CUADRO),
  descripcion: z.string(),
  cantidad: cantidadDeCuadro,
  unidad: z.string(),
  escala: z.enum(ESCALAS_DEL_CUADRO),
  /** `papel` y `planchas` las mantiene el motor hasta que se corrigen a mano. */
  automatica: z.enum(['papel', 'planchas']).nullable(),
  interno: z.strictObject({ costoUnitario: costoUnitarioDeCuadro, subtotalCentimos: centimos }).optional(),
});

const impuestoSchema = z.strictObject({ nombre: z.string(), pct: z.string(), montoCentimos: centimos });
/** Lo que sabe el cliente de un precio: nada de costos ni margen. */
export const precioComercialSchema = z.strictObject({
  precioCentimos: centimos,
  /** Informativo: el total del lote es el que manda. En milésimas de sol. */
  unitarioMilesimas: centimos.nullable(),
  impuesto: impuestoSchema.nullable(),
  totalConImpuestoCentimos: centimos,
});
const porFactor = z.record(z.enum(FACTORES_DEL_CUADRO), centimos);
/** Costo, utilidad y margen: solo con `cotizador:costos`. */
export const costosDelPrecioSchema = z.strictObject({
  costoCentimos: centimos,
  /** Utilidad bruta en céntimos (precio − costo): negativa si se vende con pérdida. */
  utilidadCentimos: centimos,
  precioSugeridoCentimos: centimos,
  margenPct: z.string().nullable(),
  semaforo: z.enum(SEMAFOROS).nullable(),
  porFactorCentimos: porFactor,
});

const celdaSchema = z.strictObject({
  valorCentimos: centimos.nullable(),
  origen: z.enum(['mano', 'detalle', 'deducida', 'vacia', 'no_calculable']),
  delDetalleCentimos: centimos.nullable(),
  motivo: z.string().nullable(),
  desde: z.enum(COLUMNAS_DEL_CUADRO).optional(),
});
const porColumna = <T extends z.ZodType>(e: T) => z.strictObject({ '100': e, '1000': e, '5000': e });
const filaDirectaSchema = z.strictObject({
  clave: z.string(),
  nombre: z.string(),
  esItem: z.boolean(),
  factor: z.enum(FACTORES_DEL_CUADRO),
  fija: z.boolean(),
  celdas: porColumna(celdaSchema),
});
const hallazgoSchema = z.strictObject({ codigo: z.string(), mensaje: z.string() });
const columnaSchema = z.strictObject({
  cantidad: z.enum(COLUMNAS_DEL_CUADRO),
  esBase: z.boolean(),
  seEnvia: z.boolean(),
  completa: z.boolean(),
  motivo: z.string().nullable(),
  comercial: precioComercialSchema.nullable(),
  interno: costosDelPrecioSchema
    .extend({ utilidadPct: z.string(), utilidadDeColumna: z.boolean(), baseDeUtilidad: z.enum(BASES_DE_UTILIDAD_DEL_CUADRO), equivalentePct: z.string() })
    .optional(),
});
export const directoDelCuadroSchema = z.strictObject({
  /** La columna de la cantidad del trabajo; `null` si esa cantidad no es una de las tres. */
  base: z.enum(COLUMNAS_DEL_CUADRO).nullable(),
  columnas: porColumna(columnaSchema),
  /** Invariantes A y B de los tres totales; `null` si no hay nada que evaluar. */
  coherencia: z.strictObject({ bloqueos: z.array(hallazgoSchema), avisos: z.array(hallazgoSchema) }).nullable(),
  interno: z.strictObject({ filas: z.array(filaDirectaSchema) }).optional(),
});

export const vistaDelCuadroSchema = z.strictObject({
  cotizacionId: z.string(),
  version: z.number().int(),
  estado: z.enum(['borrador', 'emitida']),
  trabajo: trabajoDelCuadroSchema,
  imposicion: z.strictObject({
    parametros: imposicionDelCuadroSchema,
    calculada: pliegosDelCuadroSchema.nullable(),
    /** Los datos que faltan para calcularla, con el nombre con que se dicen. */
    faltantes: z.array(z.string()),
    /** Por qué no se pudo calcular aunque estén todos los datos (la pieza no cabe, merma imposible…). */
    problema: z.string().nullable(),
  }),
  lineas: z.array(filaDelCuadroSchema),
  precioFinalCentimos: centimos.nullable(),
  moneda: z.string(),
  /** El precio que rige (el de la cantidad base); `null` si el cuadro aún no se puede calcular. */
  comercial: precioComercialSchema.nullable(),
  directo: directoDelCuadroSchema,
  interno: z.strictObject({ utilidad: z.strictObject({ pct: z.string(), base: z.enum(BASES_DE_UTILIDAD_DEL_CUADRO) }), costos: costosDelPrecioSchema.nullable() }).optional(),
});
export type VistaDelCuadroDto = z.infer<typeof vistaDelCuadroSchema>;
