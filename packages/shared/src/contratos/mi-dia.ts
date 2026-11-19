import { z } from 'zod';
import { contrato } from '../herramientas.js';

// «Mi día»: el panel de cada mañana. Cada módulo aporta `<modulo>_pendientes` (solo lectura, sin mover nada) con el mismo
// contrato; el núcleo las descubre por sufijo, las junta con los borradores por aprobar y entrega `mi_dia_ver`, ya
// agrupado y ordenado. Nada se envía ni se cobra solo: las tarjetas solo llevan a la ficha o proponen una acción de un clic.

export const URGENCIAS_DE_MI_DIA = ['atrasado', 'hoy', 'manana', 'pronto', 'info'] as const;
export type UrgenciaDeMiDia = (typeof URGENCIAS_DE_MI_DIA)[number];

/** De qué se trata la tarjeta (para el icono y para que el núcleo decida dónde cae). */
export const GRUPOS_DE_TARJETA = ['entrega', 'adelanto', 'cobro', 'seguimiento', 'inventario', 'aprobacion'] as const;
export type GrupoDeTarjeta = (typeof GRUPOS_DE_TARJETA)[number];

export const TIPOS_DE_ENTIDAD_DE_MI_DIA = ['pedido', 'orden_trabajo', 'cotizacion', 'cliente', 'articulo', 'oportunidad', 'deuda', 'borrador'] as const;
export type TipoDeEntidadDeMiDia = (typeof TIPOS_DE_ENTIDAD_DE_MI_DIA)[number];

export const TONOS_DE_NOTA = ['neutro', 'exito', 'aviso', 'peligro', 'info'] as const;
export const MAXIMO_DE_TARJETAS = 50;
export const MAXIMO_DE_ANOTACIONES = 200;
/** Días sin respuesta a una cotización antes de recordarla; un pedido sin adelanto se recuerda desde el día que se confirma. */
export const DIAS_SIN_RESPUESTA_DE_COTIZACION = 3;

const dia = z.iso.date();

export const accionDeTarjetaSchema = z.strictObject({
  etiqueta: z.string().min(1).max(60),
  /** Herramienta que ejecuta la pantalla con un clic; el servidor vuelve a validar permisos al llamarla. */
  herramienta: z.string().min(1).max(100),
  args: z.record(z.string(), z.unknown()),
});
export type AccionDeTarjeta = z.infer<typeof accionDeTarjetaSchema>;

export const mensajeDeCobroSchema = z.strictObject({
  texto: z.string(),
  /** `https://wa.me/51…?text=…`; `null` si el cliente no tiene teléfono (queda el texto para copiar). */
  enlaceWhatsapp: z.string().nullable(),
});
export type MensajeDeCobro = z.infer<typeof mensajeDeCobroSchema>;

export const tarjetaDePendienteSchema = z.strictObject({
  /** Única en todo el panel; sirve de llave de la tarjeta. */
  clave: z.string().min(1).max(200),
  grupo: z.enum(GRUPOS_DE_TARJETA),
  urgencia: z.enum(URGENCIAS_DE_MI_DIA),
  titulo: z.string(),
  detalle: z.string(),
  fecha: dia.nullable(),
  montoCentimos: z.number().int().safe().nullable(),
  cliente: z.strictObject({ id: z.string(), nombre: z.string(), telefono: z.string().nullable() }).nullable(),
  entidad: z.strictObject({ tipo: z.enum(TIPOS_DE_ENTIDAD_DE_MI_DIA), id: z.string(), codigo: z.string() }),
  acciones: z.array(accionDeTarjetaSchema).max(2),
  mensaje: mensajeDeCobroSchema.nullable(),
  /** Solo en «a quién cobrar»: lo vencido por antigüedad y el más antiguo, en días. */
  cobro: z
    .strictObject({
      tramo0a30Centimos: z.number().int(),
      tramo31a60Centimos: z.number().int(),
      tramo61masCentimos: z.number().int(),
      diasMasAntiguo: z.number().int(),
      deudas: z.number().int(),
    })
    .nullable()
    .default(null),
});
export type TarjetaDePendiente = z.infer<typeof tarjetaDePendienteSchema>;

export const anotacionSchema = z.strictObject({
  entidad: z.strictObject({ tipo: z.enum(TIPOS_DE_ENTIDAD_DE_MI_DIA), id: z.string() }),
  texto: z.string().min(1).max(120),
  tono: z.enum(TONOS_DE_NOTA),
  /** La deuda de esa entidad ya está saldada. */
  pagado: z.boolean().optional(),
  /** Ya entró algún pago (adelanto o abono) a la deuda de esa entidad. */
  conAdelanto: z.boolean().optional(),
});
export type Anotacion = z.infer<typeof anotacionSchema>;

export const entradaDePendientesSchema = z.strictObject({ fecha: dia.optional() });
export const salidaDePendientesSchema = z.strictObject({
  fecha: dia,
  tarjetas: z.array(tarjetaDePendienteSchema).max(MAXIMO_DE_TARJETAS),
  anotaciones: z.array(anotacionSchema).max(MAXIMO_DE_ANOTACIONES).default([]),
  /** Cuántas habría sin el tope de tarjetas. */
  total: z.number().int().nonnegative(),
});
export type SalidaDePendientes = z.infer<typeof salidaDePendientesSchema>;

// --- el composer `mi_dia_ver` ---

export const GRUPOS_DE_MI_DIA = ['atrasado', 'hoy', 'manana', 'por_cobrar', 'por_aprobar', 'mas_adelante'] as const;
export type GrupoDeMiDia = (typeof GRUPOS_DE_MI_DIA)[number];

export const notaDeTarjetaSchema = z.strictObject({ texto: z.string(), tono: z.enum(TONOS_DE_NOTA) });
export const tarjetaDeMiDiaSchema = z.strictObject({ ...tarjetaDePendienteSchema.shape, modulo: z.string(), notas: z.array(notaDeTarjetaSchema) });
export type TarjetaDeMiDia = z.infer<typeof tarjetaDeMiDiaSchema>;

export const resumenDeMiDiaSchema = z.strictObject({
  entregasDeHoy: z.number().int(),
  entregasAtrasadas: z.number().int(),
  porCobrarVencidoCentimos: z.number().int(),
  porAprobar: z.number().int(),
});
export type ResumenDeMiDia = z.infer<typeof resumenDeMiDiaSchema>;

export const miDiaSchema = z.strictObject({
  fecha: dia,
  resumen: resumenDeMiDiaSchema,
  grupos: z.array(z.strictObject({ clave: z.enum(GRUPOS_DE_MI_DIA), tarjetas: z.array(tarjetaDeMiDiaSchema) })),
  total: z.number().int(),
  /** Qué módulos aportaron y cuáles no («sin acceso», «no se pudo consultar»). */
  fuentesConsultadas: z.array(z.strictObject({ modulo: z.string(), incluida: z.boolean(), aviso: z.string().nullable() })),
});
export type MiDiaDto = z.infer<typeof miDiaSchema>;

export const contratosDeMiDia = {
  mi_dia_ver: contrato(entradaDePendientesSchema, miDiaSchema),
  ordenes_pendientes: contrato(entradaDePendientesSchema, salidaDePendientesSchema),
  produccion_pendientes: contrato(entradaDePendientesSchema, salidaDePendientesSchema),
  registro_pendientes: contrato(entradaDePendientesSchema, salidaDePendientesSchema),
  cotizador_pendientes: contrato(entradaDePendientesSchema, salidaDePendientesSchema),
  insumos_pendientes: contrato(entradaDePendientesSchema, salidaDePendientesSchema),
  crm_pendientes: contrato(entradaDePendientesSchema, salidaDePendientesSchema),
} as const;

// --- ayudas puras para quien arma tarjetas ---

const MS_POR_DIA = 86_400_000;
/** Días entre dos días `AAAA-MM-DD` (positivo si `hasta` es posterior). */
export const diasEntreDias = (desde: string, hasta: string): number => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / MS_POR_DIA);
/** Suma `n` días a un día `AAAA-MM-DD`. */
export const sumarDias = (dia: string, n: number): string => new Date(Date.parse(`${dia}T00:00:00Z`) + n * MS_POR_DIA).toISOString().slice(0, 10);

/** Antes de hoy: atrasado; hoy; mañana; más adelante: pronto. */
export function urgenciaDeFecha(fecha: string, hoy: string): UrgenciaDeMiDia {
  const d = diasEntreDias(hoy, fecha);
  return d < 0 ? 'atrasado' : d === 0 ? 'hoy' : d === 1 ? 'manana' : 'pronto';
}

const ORDEN_DE_URGENCIA: Record<UrgenciaDeMiDia, number> = { atrasado: 0, hoy: 1, manana: 2, pronto: 3, info: 4 };
export const ordenDeUrgencia = (u: UrgenciaDeMiDia): number => ORDEN_DE_URGENCIA[u];

/** Ordena por urgencia y fecha (lo más antiguo primero), corta al tope y dice cuántas había. */
export function limitarTarjetas<T extends Pick<TarjetaDePendiente, 'urgencia' | 'fecha' | 'clave'>>(tarjetas: readonly T[], tope = MAXIMO_DE_TARJETAS): { tarjetas: T[]; total: number } {
  const ordenadas = [...tarjetas].sort(
    (a, b) => ORDEN_DE_URGENCIA[a.urgencia] - ORDEN_DE_URGENCIA[b.urgencia] || (a.fecha ?? '9999').localeCompare(b.fecha ?? '9999') || a.clave.localeCompare(b.clave),
  );
  return { tarjetas: ordenadas.slice(0, tope), total: ordenadas.length };
}
