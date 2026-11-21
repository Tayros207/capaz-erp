import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { MAX_CARACTERES_DE_ARCHIVO, MAX_DETALLES_DE_FILA, filaConMotivoSchema } from './intercambio.js';

// Importador del historial de pedidos (módulo «ordenes»): trabajos de años anteriores que entran ya entregados, con
// serie propia y sin tocar eventos, deudas ni los números de las series reales. `ordenes.ts` no importa este archivo.

export const SERIE_DE_HISTORIAL = 'HIST';
export const ORIGEN_DE_HISTORIAL = 'importacion';
export const CORTE_DE_HISTORIAL_POR_DEFECTO = '2022-01-01';
export const CLIENTE_DE_HISTORIAL_SIN_NOMBRE = 'Clientes varios (historial)';
export const MAX_CLIENTES_NUEVOS_POR_HISTORIAL = 200;

export const importarHistorialSchema = z.strictObject({
  contenido: z.string().min(1, { error: 'El archivo está vacío.' }).max(MAX_CARACTERES_DE_ARCHIVO, { error: 'El archivo es demasiado grande.' }),
  /** Sin indicar, se detecta (coma o punto y coma). */
  separador: z.enum([',', ';']).optional(),
  /** Los trabajos anteriores a este día se omiten (no son error). */
  desde: z.iso
    .date({ error: 'La fecha de corte debe ir como AAAA-MM-DD.' })
    .refine((d) => d >= '1900-01-01', { error: 'La fecha de corte no puede ser anterior a 1900.' })
    .default(CORTE_DE_HISTORIAL_POR_DEFECTO),
  crearClientesFaltantes: z.boolean().default(false),
});

const resultadoComun = {
  separador: z.enum([',', ';']),
  /** Filas de datos leídas (sin el encabezado). */
  total: z.number().int(),
  /** Filas anteriores a la fecha de corte: se omiten sin error. */
  omitidasPorFecha: z.number().int(),
  columnasIgnoradas: z.array(z.string()),
  errores: z.array(filaConMotivoSchema).max(MAX_DETALLES_DE_FILA),
  erroresTotal: z.number().int(),
  /** Filas que ya se importaron antes: se omiten. */
  duplicadas: z.array(filaConMotivoSchema).max(MAX_DETALLES_DE_FILA),
  duplicadasTotal: z.number().int(),
  clientesPorCrear: z.array(z.string()).max(MAX_DETALLES_DE_FILA),
  clientesPorCrearTotal: z.number().int(),
  totalCentimos: z.number().int(),
  primeraFecha: z.iso.date().nullable(),
  ultimaFecha: z.iso.date().nullable(),
};

export const contratosDeOrdenesImportacion = {
  pedidos_importar_historial_previsualizar: contrato(importarHistorialSchema, z.strictObject({ ...resultadoComun, /** Trabajos que se crearían. */ nuevas: z.number().int() })),
  pedidos_importar_historial: contrato(importarHistorialSchema, z.strictObject({ ...resultadoComun, creadas: z.number().int(), clientesCreados: z.number().int() })),
} as const;

export const eventosDeOrdenesImportacion = {} as const;
