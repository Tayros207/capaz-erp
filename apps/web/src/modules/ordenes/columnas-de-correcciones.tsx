import { Link } from 'react-router';
import type { CorreccionConAjusteDto } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { textoDeAjuste } from './filtros-de-correcciones.ts';
import { textoDeDelta, textoDeMotivo, tonoDeDelta } from './huella-de-correccion.ts';

/** La huella global: pedido (enlace), versión, quién, cuándo, motivo, antes → después, delta y ajuste de deuda. */
export const COLUMNAS_DE_CORRECCIONES: Array<Columna<CorreccionConAjusteDto>> = [
  { id: 'pedido', titulo: 'Pedido', principal: true, celda: (c) => <Link to={`/m/ordenes/${c.pedido.id}`} className="font-medium text-accion underline">{c.pedido.codigo}</Link> },
  { id: 'version', titulo: 'Versión', celda: (c) => `v${c.versionAnterior} → v${c.version}` },
  { id: 'quien', titulo: 'Quién', celda: (c) => c.usuarioNombre ?? 'Alguien que ya no está' },
  { id: 'cuando', titulo: 'Cuándo', celda: (c) => formatearFechaHora(c.creadoEn) },
  { id: 'motivo', titulo: 'Motivo', celda: (c) => textoDeMotivo(c.motivoCodigo, c.motivoTexto) },
  { id: 'cambio', titulo: 'Antes → después', celda: (c) => <span className="break-words">{c.resumen}</span> },
  { id: 'delta', titulo: 'Diferencia', alinear: 'derecha', celda: (c) => <Insignia tono={tonoDeDelta(c.deltaCentimos)}>{textoDeDelta(c.deltaCentimos)}</Insignia> },
  { id: 'deuda', titulo: 'Deuda', celda: (c) => textoDeAjuste(c.ajuste) },
];
