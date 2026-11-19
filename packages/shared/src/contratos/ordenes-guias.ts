import { z } from 'zod';
import { contrato } from '../herramientas.js';
import { listadoSchema, paginaSchema } from '../listado.js';
import { ESTADOS_DE_PEDIDO, type EstadoDePedido } from './ordenes.js';

// Guías de remisión del módulo «ordenes» (control interno, sin valor tributario). Un contrato por herramienta y un
// esquema por evento. `ordenes.ts` no importa este archivo.

export const SERIE_DE_GUIA = 'G001';
export const ESTADOS_DE_GUIA = ['emitida', 'anulada'] as const;
export type EstadoDeGuia = (typeof ESTADOS_DE_GUIA)[number];
export const FILTROS_DE_ESTADO_DE_GUIA = ['todas', ...ESTADOS_DE_GUIA] as const;
export const MOTIVOS_DE_TRASLADO = ['venta', 'entrega_de_trabajo', 'traslado_entre_locales', 'otro'] as const;
export type MotivoDeTraslado = (typeof MOTIVOS_DE_TRASLADO)[number];
export const MODALIDADES_DE_TRASLADO = ['privado', 'publico'] as const;
export type ModalidadDeTraslado = (typeof MODALIDADES_DE_TRASLADO)[number];
/** Estados del pedido en los que se puede emitir una guía. */
export const ESTADOS_DE_PEDIDO_PARA_GUIA = ['listo', 'entregado'] as const satisfies readonly EstadoDePedido[];
export const MAXIMO_DE_LINEAS_DE_GUIA = 200;
export const MAXIMO_DE_PEDIDOS_POR_GUIA = 20;
export const MAXIMO_DE_CANDIDATOS_PARA_GUIA = 50;
export const DIAS_DE_CANDIDATOS_ENTREGADOS = 30;

const texto = (max: number) => z.string().trim().max(max);
const opcional = (max: number) => texto(max).nullish();
const cantidad = z.number().int().safe().min(1, { error: 'La cantidad debe ser mayor que cero.' });

export const lineaDeGuiaDeEntradaSchema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('pedido'), pedidoLineaId: z.uuid(), cantidadMilesimas: cantidad }),
  z.strictObject({
    tipo: z.literal('libre'),
    descripcion: texto(300).min(1, { error: 'Escribe la descripción.' }),
    unidad: texto(20).optional(),
    cantidadMilesimas: cantidad,
  }),
]);
export type LineaDeGuiaDeEntrada = z.infer<typeof lineaDeGuiaDeEntradaSchema>;

export const emitirGuiaSchema = z
  .strictObject({
    clienteId: z.uuid(),
    fechaTraslado: z.iso.date(),
    destinatarioDocumento: opcional(40),
    puntoPartida: texto(300).min(1, { error: 'Indica el punto de partida.' }),
    puntoLlegada: texto(300).min(1, { error: 'Indica el punto de llegada.' }),
    motivo: z.enum(MOTIVOS_DE_TRASLADO),
    motivoDetalle: opcional(120),
    modalidad: z.enum(MODALIDADES_DE_TRASLADO),
    transportista: opcional(200),
    conductor: opcional(120),
    licencia: opcional(30),
    placa: opcional(15),
    bultos: opcional(60),
    observaciones: opcional(1000),
    lineas: z
      .array(lineaDeGuiaDeEntradaSchema)
      .min(1, { error: 'Agrega al menos una línea.' })
      .max(MAXIMO_DE_LINEAS_DE_GUIA, { error: 'Una guía admite hasta 200 líneas.' }),
  })
  .refine((v) => v.motivo !== 'otro' || !!v.motivoDetalle, { error: 'Con el motivo «Otro», indica cuál.', path: ['motivoDetalle'] })
  .refine((v) => v.modalidad !== 'publico' || !!v.transportista, {
    error: 'Con transporte público, indica la empresa transportista.',
    path: ['transportista'],
  });

export const prepararGuiaSchema = z
  .strictObject({
    pedidoIds: z.array(z.uuid()).max(MAXIMO_DE_PEDIDOS_POR_GUIA, { error: 'Una guía lleva hasta 20 pedidos.' }).default([]),
    clienteId: z.uuid().optional(),
  })
  .refine((v) => v.pedidoIds.length > 0 || v.clienteId !== undefined, { error: 'Indica los pedidos o el cliente.' });

export const listarGuiasSchema = z.strictObject({
  ...paginaSchema.shape,
  estado: z.enum(FILTROS_DE_ESTADO_DE_GUIA).default('todas'),
  clienteId: z.uuid().optional(),
  pedidoId: z.uuid().optional(),
});

const referenciaDePedido = z.strictObject({ id: z.string(), codigo: z.string() });

export const guiaSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  serie: z.string(),
  numero: z.number().int(),
  estado: z.enum(ESTADOS_DE_GUIA),
  clienteId: z.string(),
  destinatarioNombre: z.string(),
  destinatarioDocumento: z.string().nullable(),
  fechaEmision: z.iso.date(),
  fechaTraslado: z.iso.date(),
  puntoPartida: z.string(),
  puntoLlegada: z.string(),
  motivo: z.enum(MOTIVOS_DE_TRASLADO),
  motivoDetalle: z.string().nullable(),
  modalidad: z.enum(MODALIDADES_DE_TRASLADO),
  transportista: z.string().nullable(),
  conductor: z.string().nullable(),
  licencia: z.string().nullable(),
  placa: z.string().nullable(),
  bultos: z.string().nullable(),
  observaciones: z.string().nullable(),
  pedidos: z.array(referenciaDePedido),
  lineas: z.number().int(),
  anuladoEn: z.iso.datetime().nullable(),
  motivoAnulacion: z.string().nullable(),
  creadoPor: z.string(),
  creadoEn: z.iso.datetime(),
});
export type GuiaDto = z.infer<typeof guiaSchema>;

export const lineaDeGuiaSchema = z.strictObject({
  id: z.string(),
  posicion: z.number().int(),
  pedidoId: z.string().nullable(),
  pedidoCodigo: z.string().nullable(),
  pedidoLineaId: z.string().nullable(),
  productoId: z.string().nullable(),
  descripcion: z.string(),
  unidad: z.string(),
  cantidadMilesimas: z.number().int(),
});
export type LineaDeGuiaDto = z.infer<typeof lineaDeGuiaSchema>;

export const guiaCompletaSchema = z.strictObject({
  ...guiaSchema.shape,
  anuladoPor: z.string().nullable(),
  anuladoPorNombre: z.string().nullable(),
  creadoPorNombre: z.string().nullable(),
  detalle: z.array(lineaDeGuiaSchema),
});
export type GuiaCompletaDto = z.infer<typeof guiaCompletaSchema>;

export const lineaPorEnviarSchema = z.strictObject({
  pedidoLineaId: z.string(),
  posicion: z.number().int(),
  productoId: z.string().nullable(),
  descripcion: z.string(),
  unidad: z.string(),
  pedidaMilesimas: z.number().int(),
  enviadaMilesimas: z.number().int(),
  pendienteMilesimas: z.number().int(),
});
export type LineaPorEnviarDto = z.infer<typeof lineaPorEnviarSchema>;

export const pedidoParaGuiaSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  estado: z.enum(ESTADOS_DE_PEDIDO),
  fecha: z.iso.date(),
  entregaEl: z.iso.date().nullable(),
  lineas: z.array(lineaPorEnviarSchema),
});
export type PedidoParaGuiaDto = z.infer<typeof pedidoParaGuiaSchema>;

export const candidatoParaGuiaSchema = z.strictObject({
  id: z.string(),
  codigo: z.string(),
  estado: z.enum(ESTADOS_DE_PEDIDO),
  fecha: z.iso.date(),
  entregaEl: z.iso.date().nullable(),
  lineasPendientes: z.number().int(),
});
export type CandidatoParaGuiaDto = z.infer<typeof candidatoParaGuiaSchema>;

export const preparacionDeGuiaSchema = z.strictObject({
  cliente: z.strictObject({ id: z.string(), nombre: z.string(), documento: z.string().nullable(), direccion: z.string().nullable() }),
  pedidos: z.array(pedidoParaGuiaSchema),
  candidatos: z.array(candidatoParaGuiaSchema),
});
export type PreparacionDeGuiaDto = z.infer<typeof preparacionDeGuiaSchema>;

export const contratosDeGuias = {
  guia_preparar: contrato(prepararGuiaSchema, preparacionDeGuiaSchema),
  guia_emitir: contrato(emitirGuiaSchema, guiaCompletaSchema),
  guia_ver: contrato(z.strictObject({ id: z.uuid() }), guiaCompletaSchema),
  guias_listar: contrato(listarGuiasSchema, listadoSchema(guiaSchema)),
  guia_anular: contrato(z.strictObject({ id: z.uuid(), motivo: texto(300).min(1, { error: 'Indica el motivo.' }) }), guiaCompletaSchema),
} as const;

export const eventosDeGuias = {
  'guia.emitida': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), pedidoIds: z.array(z.string()), lineas: z.number().int() }),
  'guia.anulada': z.strictObject({ id: z.string(), codigo: z.string(), clienteId: z.string(), pedidoIds: z.array(z.string()) }),
} as const;
