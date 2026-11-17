import type { EnlaceDeCotizacionDto } from '@capaz/shared';
import { formatearFecha, formatearFechaHora } from '../../shared/formato/fechas.ts';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

// Lógica pura de la hoja «Enlace para el cliente».

export const MARCA_DE_ENLACE = '{enlace}';
export const DIAS_POR_DEFECTO = 30;

/** Se puede generar un enlace de una cotización que ya salió del borrador y no está anulada. */
export const sePuedeGenerarEnlace = (estado: string): boolean => estado === 'emitida' || estado === 'enviada';

/**
 * El mensaje de WhatsApp con el enlace. Con la plantilla de la configuración se reemplaza cada `{enlace}`; si la
 * plantilla no lo trae, el enlace va al final en su propia línea. Sin plantilla, un mensaje por defecto.
 */
export function mensajeConEnlace(plantilla: string | null | undefined, enlace: string, c: { codigo: string; clienteNombre: string | null }): string {
  const base = plantilla?.trim();
  if (base) return base.includes(MARCA_DE_ENLACE) ? base.split(MARCA_DE_ENLACE).join(enlace) : `${base}\n${enlace}`;
  const saludo = c.clienteNombre ? `Hola ${c.clienteNombre}, ` : 'Hola, ';
  return `${saludo}aquí está tu cotización ${c.codigo}. Puedes verla, aprobarla o rechazarla desde este enlace:\n${enlace}`;
}

export const ETIQUETA_DE_ESTADO_DE_ENLACE: Readonly<Record<EnlaceDeCotizacionDto['estado'], string>> = { vigente: 'Vigente', vencido: 'Vencido', revocado: 'Revocado' };
export const TONO_DE_ESTADO_DE_ENLACE: Readonly<Record<EnlaceDeCotizacionDto['estado'], TonoDeInsignia>> = { vigente: 'exito', vencido: 'neutro', revocado: 'peligro' };

export const textoDeVistas = (vistas: number, ultima: string | null): string =>
  vistas === 0 ? 'Aún no la abrió' : `${vistas} ${vistas === 1 ? 'vez' : 'veces'} · última ${ultima ? formatearFechaHora(ultima) : '—'}`;

export const textoDeVigencia = (e: Pick<EnlaceDeCotizacionDto, 'estado' | 'venceEn' | 'revocadoEn'>): string =>
  e.estado === 'revocado' && e.revocadoEn ? `Revocado el ${formatearFecha(e.revocadoEn)}` : `${e.estado === 'vencido' ? 'Venció' : 'Vence'} el ${formatearFecha(e.venceEn)}`;

/** Los días de vigencia como número entre 1 y 365; si no sirve, `undefined`. */
export function leerDias(texto: string): number | undefined {
  if (!/^\d{1,3}$/.test(texto.trim())) return undefined;
  const n = Number(texto);
  return n >= 1 && n <= 365 ? n : undefined;
}
