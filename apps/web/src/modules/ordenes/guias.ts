import { formatoDeHoja, type FormatoDeHoja } from '../../shared/impresion/logica-impresion.ts';
import type { GuiaCompletaDto, EstadoDeGuia, MotivoDeTraslado, ModalidadDeTraslado } from '@capaz/shared';
import { formatearCantidad } from '../../shared/formato/milesimas.ts';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';
import { formatearDia } from './logica.ts';

// Lógica pura de la guía de remisión: etiquetas, datos de traslado y lo que se imprime. Sin React ni red.

export const ETIQUETA_DE_MOTIVO: Readonly<Record<MotivoDeTraslado, string>> = {
  venta: 'Venta',
  entrega_de_trabajo: 'Entrega de trabajo terminado',
  traslado_entre_locales: 'Traslado a otro local',
  otro: 'Otro',
};

export const ETIQUETA_DE_MODALIDAD: Readonly<Record<ModalidadDeTraslado, string>> = {
  privado: 'Transporte privado (propio)',
  publico: 'Transporte público (tercero)',
};

export const ETIQUETA_DE_ESTADO_DE_GUIA: Readonly<Record<EstadoDeGuia, string>> = { emitida: 'Emitida', anulada: 'Anulada' };
export const TONO_DE_ESTADO_DE_GUIA: Readonly<Record<EstadoDeGuia, TonoDeInsignia>> = { emitida: 'exito', anulada: 'peligro' };

export const AVISO_DE_GUIA = 'Guía de entrega interna, sin valor tributario';

/** Los datos del traslado como se escriben en el formulario: todo texto, salvo motivo y modalidad. */
export type DatosDeTraslado = {
  fechaTraslado: string;
  destinatarioDocumento: string;
  puntoPartida: string;
  puntoLlegada: string;
  motivo: MotivoDeTraslado;
  motivoDetalle: string;
  modalidad: ModalidadDeTraslado;
  transportista: string;
  conductor: string;
  licencia: string;
  placa: string;
  bultos: string;
  observaciones: string;
};

/** Valores de partida: hoy, venta, transporte propio, la dirección fiscal como partida y el cliente como llegada. */
export function trasladoInicial(
  hoy: string,
  empresa: { direccionFiscal?: string | null } | null | undefined,
  cliente: { documento?: string | null; direccion?: string | null } | null | undefined,
): DatosDeTraslado {
  return {
    fechaTraslado: hoy,
    destinatarioDocumento: cliente?.documento ?? '',
    puntoPartida: empresa?.direccionFiscal ?? '',
    puntoLlegada: cliente?.direccion ?? '',
    motivo: 'venta',
    motivoDetalle: '',
    modalidad: 'privado',
    transportista: '',
    conductor: '',
    licencia: '',
    placa: '',
    bultos: '',
    observaciones: '',
  };
}

export type LineaParaImprimir = { pedido: string | null; descripcion: string; unidad: string; cantidadMilesimas: number };

/** Todo lo que lleva la hoja: sirve igual para la vista previa (sin código) y para la guía guardada. */
export type GuiaParaImprimir = {
  codigo: string | null;
  estado: EstadoDeGuia;
  destinatarioNombre: string;
  fechaEmision: string;
  pedidos: string[];
  traslado: DatosDeTraslado;
  lineas: LineaParaImprimir[];
  anulacion: { en: string; motivo: string } | null;
};

export function guiaParaImprimirDesde(g: GuiaCompletaDto): GuiaParaImprimir {
  return {
    codigo: g.codigo,
    estado: g.estado,
    destinatarioNombre: g.destinatarioNombre,
    fechaEmision: g.fechaEmision,
    pedidos: g.pedidos.map((p) => p.codigo),
    traslado: {
      fechaTraslado: g.fechaTraslado,
      destinatarioDocumento: g.destinatarioDocumento ?? '',
      puntoPartida: g.puntoPartida,
      puntoLlegada: g.puntoLlegada,
      motivo: g.motivo,
      motivoDetalle: g.motivoDetalle ?? '',
      modalidad: g.modalidad,
      transportista: g.transportista ?? '',
      conductor: g.conductor ?? '',
      licencia: g.licencia ?? '',
      placa: g.placa ?? '',
      bultos: g.bultos ?? '',
      observaciones: g.observaciones ?? '',
    },
    lineas: [...g.detalle]
      .sort((a, b) => a.posicion - b.posicion)
      .map((l) => ({ pedido: l.pedidoCodigo, descripcion: l.descripcion, unidad: l.unidad, cantidadMilesimas: l.cantidadMilesimas })),
    anulacion: g.anuladoEn ? { en: g.anuladoEn, motivo: g.motivoAnulacion ?? '' } : null,
  };
}

/** «Guía de remisión G001-000007», con «— ANULADA» si está anulada y «(por emitir)» en la vista previa. */
export function tituloDeGuia(g: Pick<GuiaParaImprimir, 'codigo' | 'estado'>): string {
  if (!g.codigo) return 'Guía de remisión (por emitir)';
  return `Guía de remisión ${g.codigo}${g.estado === 'anulada' ? ' — ANULADA' : ''}`;
}

export function paresDeDestinatario(g: GuiaParaImprimir): Array<{ etiqueta: string; valor: string }> {
  return [
    { etiqueta: 'Cliente', valor: g.destinatarioNombre },
    { etiqueta: 'Documento', valor: g.traslado.destinatarioDocumento },
    { etiqueta: 'Pedidos', valor: g.pedidos.join(', ') },
    { etiqueta: 'Fecha de emisión', valor: formatearDia(g.fechaEmision) },
  ];
}

/** Pares del bloque de traslado. Con transporte privado no hay empresa transportista. */
export function paresDeTraslado(t: DatosDeTraslado): Array<{ etiqueta: string; valor: string }> {
  const motivo = t.motivo === 'otro' && t.motivoDetalle ? `${ETIQUETA_DE_MOTIVO.otro}: ${t.motivoDetalle}` : ETIQUETA_DE_MOTIVO[t.motivo];
  return [
    { etiqueta: 'Inicio del traslado', valor: t.fechaTraslado ? formatearDia(t.fechaTraslado) : '' },
    { etiqueta: 'Motivo del traslado', valor: motivo },
    { etiqueta: 'Punto de partida', valor: t.puntoPartida },
    { etiqueta: 'Punto de llegada', valor: t.puntoLlegada },
    { etiqueta: 'Modalidad', valor: ETIQUETA_DE_MODALIDAD[t.modalidad] },
    ...(t.modalidad === 'publico' ? [{ etiqueta: 'Empresa transportista', valor: t.transportista }] : []),
    { etiqueta: 'Conductor', valor: [t.conductor, t.licencia ? `Licencia ${t.licencia}` : ''].filter(Boolean).join(' · ') },
    { etiqueta: 'Placa del vehículo', valor: t.placa },
  ];
}

export type FilaDeGuia = { n: number; pedido: string; descripcion: string; cantidad: string };

export const filasDeGuia = (lineas: readonly LineaParaImprimir[]): FilaDeGuia[] =>
  lineas.map((l, i) => ({ n: i + 1, pedido: l.pedido ?? '—', descripcion: l.descripcion, cantidad: formatearCantidad(l.cantidadMilesimas, l.unidad) }));

/** Una guía de pocas líneas sale en un cuarto de hoja (A6), una mediana en media hoja (A5) y una larga en A4. */
export const formatoDeGuia = (lineas: number): FormatoDeHoja => formatoDeHoja('sin-precios', lineas);
