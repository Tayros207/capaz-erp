import { rechazo, type ErrorDeRespuesta, type FormatoDePliegoDto, type ItemDelCuadroDto, type MaquinaDelTallerDto, type TarifaDelTallerDto } from '@capaz/shared';
import type { Valido } from '../domain/taller.js';
import type { EtapaGuardada, FormatoDePliego, ItemDelCuadro, Maquina, Tarifa } from '../repositories/taller.repository.js';

// Fila → DTO del taller. Las medidas y los costos pasan como texto, tal como los devuelve la base.

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export const aFormatoDto = (f: FormatoDePliego): FormatoDePliegoDto => ({
  id: f.id,
  nombre: f.nombre,
  anchoCm: f.anchoCm,
  altoCm: f.altoCm,
  tipo: f.tipo as FormatoDePliegoDto['tipo'],
  archivadoEn: iso(f.archivadoEn),
  creadoEn: f.creadoEn.toISOString(),
  actualizadoEn: f.actualizadoEn.toISOString(),
});

export const aMaquinaDto = (m: Maquina): MaquinaDelTallerDto => ({
  id: m.id,
  nombre: m.nombre,
  formatoMaxAnchoCm: m.formatoMaxAnchoCm,
  formatoMaxAltoCm: m.formatoMaxAltoCm,
  pinzaCm: m.pinzaCm,
  sangradoCm: m.sangradoCm,
  calleCm: m.calleCm,
  etapas: (m.etapas as EtapaGuardada[]).map((e) => ({ nombre: e.nombre, mermaPct: e.mermaPct, arranque: e.arranque })),
  archivadoEn: iso(m.archivadoEn),
  creadoEn: m.creadoEn.toISOString(),
  actualizadoEn: m.actualizadoEn.toISOString(),
});

export const aTarifaDto = (t: Tarifa): TarifaDelTallerDto => ({
  id: t.id,
  factor: t.factor as TarifaDelTallerDto['factor'],
  nombre: t.nombre,
  unidad: t.unidad,
  costoUnitario: t.costoUnitario,
  escalaPorDefecto: t.escalaPorDefecto as TarifaDelTallerDto['escalaPorDefecto'],
  formatoId: t.formatoId,
  articuloId: t.articuloId,
  archivadoEn: iso(t.archivadoEn),
  creadoEn: t.creadoEn.toISOString(),
  actualizadoEn: t.actualizadoEn.toISOString(),
});

export const aItemDto = (i: ItemDelCuadro): ItemDelCuadroDto => ({
  id: i.id,
  nombre: i.nombre,
  factor: i.factor as ItemDelCuadroDto['factor'],
  despuesDe: i.despuesDe as ItemDelCuadroDto['despuesDe'],
  posicion: i.posicion,
  fija: i.fija,
  archivadoEn: iso(i.archivadoEn),
  creadoEn: i.creadoEn.toISOString(),
  actualizadoEn: i.actualizadoEn.toISOString(),
});

/** Un choque de nombre: `conflicto` con la fila existente como candidata. */
export const nombreRepetido = (tipo: string, f: { id: string; nombre: string }, detalle: string): { ok: false; error: ErrorDeRespuesta } =>
  rechazo('conflicto', `Ya existe ${tipo} llamado «${f.nombre}».`, [{ id: f.id, nombre: f.nombre, detalle }]);

export const noExiste = (que: string): { ok: false; error: ErrorDeRespuesta } => rechazo('no_encontrado', `No existe ${que}.`);
export const archivadaNoSeEdita = (que: string): { ok: false; error: ErrorDeRespuesta } => rechazo('conflicto', `${que} archivado no se edita.`);

/** Un rechazo de las reglas puras como respuesta de herramienta, o `null` si todo está bien. */
export const rechazoSiMalo = (v: Valido): { ok: false; error: ErrorDeRespuesta } | null => (v.ok ? null : rechazo(v.codigo, v.mensaje));
