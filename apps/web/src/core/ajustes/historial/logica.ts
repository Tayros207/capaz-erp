import type { EventoDeAuditoria } from '@capaz/shared';

// Lógica pura de la pantalla «Historial»: textos y tonos. Sin React ni red.

const ACCIONES: Record<string, string> = {
  empresa_actualizar_configuracion: 'Cambió la configuración de la empresa',
  empresa_ver_configuracion: 'Consultó la configuración de la empresa',
  modulo_solicitar: 'Solicitó un módulo',
  auditoria_listar: 'Consultó el historial',
};

/** Nombre legible de la herramienta; las que no conocemos salen con su nombre sin guiones bajos. */
export function textoDeAccion(herramienta: string): string {
  return ACCIONES[herramienta] ?? herramienta.replaceAll('_', ' ');
}

export type TonoDeResultado = 'exito' | 'aviso' | 'peligro';

export const RESULTADOS: Record<EventoDeAuditoria['resultado'], { texto: string; tono: TonoDeResultado }> = {
  ok: { texto: 'Hecho', tono: 'exito' },
  pendiente_confirmacion: { texto: 'Esperó confirmación', tono: 'aviso' },
  rechazada: { texto: 'Rechazada', tono: 'peligro' },
};

/** El texto que la herramienta declaró seguro mostrar (`resumen.resumen`); vacío si no declaró ninguno. */
export function detalleDeEvento(evento: Pick<EventoDeAuditoria, 'resumen' | 'codigo'>): string {
  const texto = evento.resumen['resumen'];
  if (typeof texto === 'string' && texto.trim() !== '') return texto;
  return evento.codigo ?? '';
}

export type FiltrosDeHistorial = { herramienta: string; resultado: '' | EventoDeAuditoria['resultado'] };

/** Los argumentos de `auditoria_listar` según los filtros (los vacíos no se envían). */
export function argumentosDeListado(filtros: FiltrosDeHistorial, cursor?: string) {
  return {
    limite: 25,
    ...(cursor ? { cursor } : {}),
    ...(filtros.herramienta.trim() ? { herramienta: filtros.herramienta.trim() } : {}),
    ...(filtros.resultado ? { resultado: filtros.resultado } : {}),
  };
}
