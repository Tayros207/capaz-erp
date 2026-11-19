import { diasEntreDias, urgenciaDeFecha, type TarjetaDePendiente } from '@capaz/shared';
import { codigoDeOportunidad } from './oportunidad.js';

// «Mi día» de CRM: puro. Las actividades de seguimiento sin hacer que vencieron o vencen hoy o mañana.

export type ActividadPendiente = {
  id: string;
  tipo: string;
  asunto: string;
  venceEl: string;
  oportunidadId: string;
  oportunidadNumero: number;
  oportunidadAnio: number;
  oportunidadTitulo: string;
  clienteId: string;
  clienteNombre: string;
  clienteTelefono: string | null;
};

const ROTULO: Record<string, string> = { llamada: 'Llamar', reunion: 'Reunión', mensaje: 'Mensaje', tarea: 'Tarea', nota: 'Nota' };

export function tarjetasDeActividades(actividades: readonly ActividadPendiente[], hoy: string): TarjetaDePendiente[] {
  return actividades.map((a) => {
    const d = diasEntreDias(hoy, a.venceEl);
    const cuando = d < 0 ? `Vencida hace ${-d} ${d === -1 ? 'día' : 'días'}` : d === 0 ? 'Vence hoy' : 'Vence mañana';
    const codigo = codigoDeOportunidad(a.oportunidadAnio, a.oportunidadNumero);
    return {
      clave: `actividad:${a.id}`,
      grupo: 'seguimiento' as const,
      urgencia: urgenciaDeFecha(a.venceEl, hoy),
      titulo: `${ROTULO[a.tipo] ?? 'Actividad'}: ${a.asunto}`,
      detalle: `${cuando} · ${a.clienteNombre} · ${a.oportunidadTitulo}`,
      fecha: a.venceEl,
      montoCentimos: null,
      cliente: { id: a.clienteId, nombre: a.clienteNombre, telefono: a.clienteTelefono },
      entidad: { tipo: 'oportunidad' as const, id: a.oportunidadId, codigo },
      acciones: [{ etiqueta: 'Ya la hice', herramienta: 'actividad_completar', args: { id: a.id } }],
      mensaje: null,
      cobro: null,
    };
  });
}
