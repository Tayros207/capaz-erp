import { z } from 'zod';
import { contrato } from '../herramientas.js';

// Contratos del área «reportes»: un contrato por herramienta (`entidad_accion`) y un esquema por evento
// (`entidad.hecho`). Solo el carril de esta área edita este archivo.

/** El panel abarca como mucho un año (bisiesto incluido). */
export const MAXIMO_DE_DIAS_DEL_PANEL = 366;

const DIA_EN_MS = 86_400_000;
const diasEntre = (desde: string, hasta: string): number =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_EN_MS) + 1;

export const periodoDelPanelSchema = z
  .strictObject({ desde: z.iso.date(), hasta: z.iso.date() })
  .refine((v) => v.desde <= v.hasta, { error: 'El período empieza antes de terminar.', path: ['hasta'] })
  .refine((v) => v.hasta < v.desde || diasEntre(v.desde, v.hasta) <= MAXIMO_DE_DIAS_DEL_PANEL, {
    error: `El período abarca como máximo ${MAXIMO_DE_DIAS_DEL_PANEL} días.`,
    path: ['hasta'],
  });

export const TIPOS_DE_INDICADOR = ['cantidad', 'dinero'] as const;
export type TipoDeIndicador = (typeof TIPOS_DE_INDICADOR)[number];

/** Una cifra del panel. `dinero` va en céntimos; `cantidad`, en unidades. */
export const indicadorSchema = z.strictObject({
  id: z.string(),
  etiqueta: z.string(),
  tipo: z.enum(TIPOS_DE_INDICADOR),
  valor: z.number().int(),
});
export type IndicadorDto = z.infer<typeof indicadorSchema>;

/** Una serie en el tiempo que un módulo entregó en su resumen (campo opcional `serie`). */
export const serieDelPanelSchema = z.strictObject({
  id: z.string(),
  etiqueta: z.string(),
  tipo: z.enum(TIPOS_DE_INDICADOR),
  puntos: z.array(z.strictObject({ fecha: z.iso.date(), valor: z.number().int() })),
});
export type SerieDelPanelDto = z.infer<typeof serieDelPanelSchema>;

export const bloqueDelPanelSchema = z.strictObject({
  modulo: z.string(),
  nombre: z.string(),
  /** El módulo está en baja: se ve, pero no se escribe en él. */
  soloLectura: z.boolean(),
  indicadores: z.array(indicadorSchema),
  series: z.array(serieDelPanelSchema),
});
export type BloqueDelPanelDto = z.infer<typeof bloqueDelPanelSchema>;

export const panelSchema = z.strictObject({
  desde: z.iso.date(),
  hasta: z.iso.date(),
  bloques: z.array(bloqueDelPanelSchema),
});
export type PanelDto = z.infer<typeof panelSchema>;

export const exportacionDelPanelSchema = z.strictObject({
  nombreDeArchivo: z.string(),
  /** Texto del CSV, con BOM, finales `\r\n` y celdas protegidas contra fórmulas. */
  contenido: z.string(),
  filas: z.number().int(),
});
export type ExportacionDelPanelDto = z.infer<typeof exportacionDelPanelSchema>;

export const contratosDeReportes = {
  reportes_panel: contrato(periodoDelPanelSchema, panelSchema),
  reportes_exportar_csv: contrato(periodoDelPanelSchema, exportacionDelPanelSchema),
} as const;
export const eventosDeReportes = {} as const;
