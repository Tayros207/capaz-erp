import type { GuiaDto } from '@capaz/shared';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { ETIQUETA_DE_ESTADO_DE_GUIA, TONO_DE_ESTADO_DE_GUIA } from './guias.ts';
import { formatearDia } from './logica.ts';

/** Columnas de una guía en la lista y en la ficha del pedido. */
export const COLUMNAS_DE_GUIAS: Array<Columna<GuiaDto>> = [
  { id: 'codigo', titulo: 'Guía', principal: true, celda: (g) => g.codigo },
  { id: 'cliente', titulo: 'Cliente', celda: (g) => g.destinatarioNombre },
  { id: 'traslado', titulo: 'Traslado', celda: (g) => formatearDia(g.fechaTraslado) },
  { id: 'pedidos', titulo: 'Pedidos', celda: (g) => g.pedidos.map((p) => p.codigo).join(', ') || '—' },
  { id: 'estado', titulo: 'Estado', celda: (g) => <Insignia tono={TONO_DE_ESTADO_DE_GUIA[g.estado]}>{ETIQUETA_DE_ESTADO_DE_GUIA[g.estado]}</Insignia> },
];
