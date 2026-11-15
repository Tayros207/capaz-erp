import { z } from 'zod';
import { contrato } from '../herramientas.js';

// Contratos del área «intercambio» (importar y exportar CSV): un contrato por herramienta (`entidad_accion`)
// y un esquema por evento (`entidad.hecho`). Solo el carril de esta área edita este archivo.

export const ENTIDADES_DE_INTERCAMBIO = ['clientes', 'productos'] as const;
export type EntidadDeIntercambio = (typeof ENTIDADES_DE_INTERCAMBIO)[number];

/** Límites del intercambio (el servidor limita el cuerpo JSON a 256 kB: el archivo cabe con holgura). */
export const MAX_FILAS_EXPORTAR = 5000;
export const MAX_FILAS_IMPORTAR = 1000;
export const MAX_CARACTERES_DE_ARCHIVO = 200_000;
/** Cuántos errores o duplicados detallados devuelve una importación (el total va aparte). */
export const MAX_DETALLES_DE_FILA = 100;

const entidad = z.enum(ENTIDADES_DE_INTERCAMBIO);
const separador = z.enum([',', ';']);

export const exportarCsvSchema = z.strictObject({
  entidad,
  separador: separador.default(','),
  incluirArchivados: z.boolean().default(false),
});

export const archivoCsvSchema = z.strictObject({
  entidad,
  contenido: z.string().min(1, { error: 'El archivo está vacío.' }).max(MAX_CARACTERES_DE_ARCHIVO, { error: 'El archivo es demasiado grande.' }),
  /** Sin indicar, se detecta (coma o punto y coma). */
  separador: separador.optional(),
});

/** Una fila con su motivo; la fila 1 es el encabezado. */
export const filaConMotivoSchema = z.strictObject({ fila: z.number().int(), motivo: z.string() });
export type FilaConMotivo = z.infer<typeof filaConMotivoSchema>;

const resultadoDeLectura = {
  entidad,
  separador,
  /** Filas de datos leídas (sin el encabezado). */
  total: z.number().int(),
  columnasIgnoradas: z.array(z.string()),
  errores: z.array(filaConMotivoSchema),
  erroresTotal: z.number().int(),
  /** Filas que ya existen (o repiten otra del archivo, por nombre normalizado, documento o código): se omiten. */
  duplicadas: z.array(filaConMotivoSchema),
  duplicadasTotal: z.number().int(),
};

export const contratosDeIntercambio = {
  exportar_csv: contrato(
    exportarCsvSchema,
    z.strictObject({
      entidad,
      nombreDeArchivo: z.string(),
      contenido: z.string(),
      filas: z.number().int(),
      /** `true` si había más de 5 000 y se entregaron solo las primeras. */
      truncado: z.boolean(),
    }),
  ),
  importar_csv_previsualizar: contrato(
    archivoCsvSchema,
    z.strictObject({ ...resultadoDeLectura, /** Filas válidas que se crearían. */ nuevas: z.number().int() }),
  ),
  importar_csv_aplicar: contrato(
    archivoCsvSchema,
    z.strictObject({ ...resultadoDeLectura, creadas: z.number().int(), sincronizacionId: z.string() }),
  ),
} as const;

export const eventosDeIntercambio = {} as const;
