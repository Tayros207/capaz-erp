import type { EventoDeAuditoria, Respuesta } from '@capaz/shared';
import { llamar } from '../../../shared/api/herramientas.ts';
import { argumentosDeListado } from './logica.ts';

export type PaginaDeHistorial = { items: EventoDeAuditoria[]; siguiente: string | null };

/** Cargador de la ruta: la primera página, sin filtros. */
export function cargarHistorial(): Promise<Respuesta<PaginaDeHistorial>> {
  return llamar('auditoria_listar', argumentosDeListado({ herramienta: '', resultado: '' }));
}
