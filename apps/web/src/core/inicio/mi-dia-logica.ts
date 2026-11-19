import { formatearSoles, type GrupoDeMiDia, type MiDiaDto, type ResumenDeMiDia, type TarjetaDeMiDia, type UrgenciaDeMiDia } from '@capaz/shared';
import type { TonoDeInsignia } from '../../shared/ui/insignia.tsx';

// Lógica pura de «Mi día»: títulos, textos del encabezado, color de cada urgencia y la actualización optimista al
// ejecutar una acción de un clic. Sin React, sin red.

export const TITULO_DE_GRUPO: Record<GrupoDeMiDia, string> = {
  atrasado: 'Atrasado',
  hoy: 'Hoy',
  manana: 'Mañana',
  por_cobrar: 'Por cobrar',
  por_aprobar: 'Por aprobar',
  mas_adelante: 'Más adelante',
};

export const ETIQUETA_DE_URGENCIA: Record<UrgenciaDeMiDia, string> = { atrasado: 'Atrasado', hoy: 'Hoy', manana: 'Mañana', pronto: 'Pronto', info: 'Aviso' };
/** El color sale del significado (peligro, aviso, info…), nunca solo del color: la insignia siempre lleva texto. */
export const TONO_DE_URGENCIA: Record<UrgenciaDeMiDia, TonoDeInsignia> = { atrasado: 'peligro', hoy: 'aviso', manana: 'info', pronto: 'neutro', info: 'neutro' };
/** Franja de color a la izquierda de la tarjeta (clases completas para que Tailwind las vea). */
export const FRANJA_DE_URGENCIA: Record<UrgenciaDeMiDia, string> = { atrasado: 'border-l-peligro', hoy: 'border-l-aviso', manana: 'border-l-info', pronto: 'border-l-borde-fuerte', info: 'border-l-borde-fuerte' };

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** «3 entregas hoy · S/ 4,200.00 por cobrar vencido · 2 por aprobar»; vacío si no hay nada que decir. */
export function textoDeResumen(r: ResumenDeMiDia): string {
  const partes = [
    r.entregasAtrasadas > 0 ? plural(r.entregasAtrasadas, 'entrega atrasada', 'entregas atrasadas') : '',
    r.entregasDeHoy > 0 ? plural(r.entregasDeHoy, 'entrega hoy', 'entregas hoy') : '',
    r.porCobrarVencidoCentimos > 0 ? `${formatearSoles(r.porCobrarVencidoCentimos)} por cobrar vencido` : '',
    r.porAprobar > 0 ? `${r.porAprobar} por aprobar` : '',
  ];
  return partes.filter(Boolean).join(' · ');
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** «miércoles 18 de noviembre» para un día `AAAA-MM-DD` (calendario, sin zona). */
export function fechaLarga(dia: string): string {
  const f = new Date(`${dia}T12:00:00Z`);
  if (Number.isNaN(f.getTime())) return dia;
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${MESES[f.getUTCMonth()]}`;
}

export const hayPendientes = (m: MiDiaDto): boolean => m.total > 0;

/** Como se llaman en el menú (los manifiestos de cada módulo); los borradores viven en la Bandeja. */
const NOMBRE_DE_FUENTE: Record<string, string> = { ordenes: 'Pedidos', produccion: 'Producción', registro: 'Registro', cotizador: 'Cotizador', insumos: 'Inventario', crm: 'CRM', borradores: 'Bandeja' };
const nombreDeFuente = (modulo: string) => NOMBRE_DE_FUENTE[modulo] ?? modulo;
const esSinAcceso = (f: MiDiaDto['fuentesConsultadas'][number]) => f.aviso === 'sin acceso';

/** Los módulos a los que la persona no tiene acceso, para el pie («Sin datos de Registro y CRM»). Es normal, no es un error. */
export function avisosDeFuentes(m: MiDiaDto): string[] {
  return m.fuentesConsultadas.filter((f) => !f.incluida && esSinAcceso(f)).map((f) => nombreDeFuente(f.modulo));
}

/** Los módulos que sí debían aportar y fallaron: el resto del panel se muestra igual, con un aviso visible. */
export function fuentesConFalla(m: MiDiaDto): string[] {
  return m.fuentesConsultadas.filter((f) => !f.incluida && !esSinAcceso(f)).map((f) => nombreDeFuente(f.modulo));
}

/** Los módulos que tenían más de lo que cabe en el panel: «Pedidos (se muestran 50 de 1,234)». */
export function fuentesRecortadas(m: MiDiaDto): string[] {
  return m.fuentesConsultadas.filter((f) => f.incluida && f.aviso).map((f) => `${nombreDeFuente(f.modulo)} (${f.aviso})`);
}

/** «Todo al día» solo si no hay nada pendiente y ningún módulo falló (si falló, no sabemos si está al día). */
export const estaAlDia = (m: MiDiaDto): boolean => !hayPendientes(m) && fuentesConFalla(m).length === 0;

/** Una lista legible: «Registro», «Registro y CRM», «Pedidos, Registro y CRM». */
export function enLista(nombres: readonly string[]): string {
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}`;
}

/** Sin la tarjeta que se acaba de resolver, y con el resumen y el total al día (actualización optimista). */
export function sinTarjeta(m: MiDiaDto, clave: string): MiDiaDto {
  const quitada = m.grupos.flatMap((g) => g.tarjetas).find((t) => t.clave === clave);
  if (!quitada) return m;
  const grupos = m.grupos.map((g) => ({ ...g, tarjetas: g.tarjetas.filter((t) => t.clave !== clave) })).filter((g) => g.tarjetas.length > 0);
  const r = m.resumen;
  const resumen: ResumenDeMiDia = {
    entregasDeHoy: r.entregasDeHoy - (quitada.grupo === 'entrega' && quitada.urgencia === 'hoy' ? 1 : 0),
    entregasAtrasadas: r.entregasAtrasadas - (quitada.grupo === 'entrega' && quitada.urgencia === 'atrasado' ? 1 : 0),
    porCobrarVencidoCentimos: r.porCobrarVencidoCentimos - (quitada.grupo === 'cobro' ? (quitada.montoCentimos ?? 0) : 0),
    porAprobar: r.porAprobar - (quitada.grupo === 'aprobacion' ? 1 : 0),
  };
  return { ...m, grupos, resumen, total: m.total - 1 };
}

/** La frase que confirma una acción: «Anotado: ya se entregó · PED-A-2026-0007». */
export const avisoDeAccion = (etiqueta: string, t: Pick<TarjetaDeMiDia, 'entidad'>): string =>
  `Anotado: ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)} · ${t.entidad.codigo}`;

/** El enlace de WhatsApp de una tarjeta de cobro, solo si de verdad es de `wa.me` (nunca otra dirección); si no, `null`. */
export function enlaceDeWhatsapp(t: Pick<TarjetaDeMiDia, 'mensaje'>): string | null {
  const enlace = t.mensaje?.enlaceWhatsapp ?? null;
  return enlace && /^https:\/\/wa\.me\/\d{8,15}\?text=/.test(enlace) ? enlace : null;
}

/** ¿Hay algún mensaje de cobro en el panel? (para avisar si salen sin el nombre de la empresa). */
export const hayMensajesDeCobro = (m: MiDiaDto): boolean => m.grupos.some((g) => g.tarjetas.some((t) => t.mensaje !== null));
