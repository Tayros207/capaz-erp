import type { PedidoCompletoDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar } from '../../shared/api/herramientas.ts';
import type { AccionDeMenu } from '../../shared/ui/datos/menu-de-acciones.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { TITULO_DE_DOCUMENTO, documentosDisponibles, enlaceDeWhatsApp, mensajeDeWhatsApp } from './documentos.ts';

/** Entradas «Imprimir …» del menú de la ficha: una por documento que el estado permite. */
export function accionesDeImpresion(p: Pick<PedidoCompletoDto, 'id' | 'estado'>, ir: (ruta: string) => void): AccionDeMenu[] {
  // Confirmado o posterior: la nota de pedido (la constancia del cliente) va primero y la proforma al final.
  const tipos = documentosDisponibles(p.estado).sort((a, b) => Number(a === 'proforma' && p.estado !== 'borrador') - Number(b === 'proforma' && p.estado !== 'borrador'));
  return tipos.map((tipo) => ({ etiqueta: `Imprimir ${TITULO_DE_DOCUMENTO[tipo].toLowerCase()}`, onSeleccionar: () => ir(`/m/ordenes/${p.id}/${tipo}`) }));
}

/**
 * Abre WhatsApp con el mensaje armado (el documento lo adjunta la persona desde el PDF). Pide el
 * teléfono del cliente por `clientes_ver`; sin teléfono avisa. Sin servicios externos desde el servidor.
 */
export async function enviarPorWhatsApp(p: Pick<PedidoCompletoDto, 'clienteId' | 'codigo' | 'clienteNombre' | 'totalCentimos' | 'estado'>): Promise<void> {
  const r = await llamar('clientes_ver', { id: p.clienteId });
  if (!r.ok || !('datos' in r)) {
    notificar('No pudimos leer los datos del cliente.', 'error');
    return;
  }
  const enlace = enlaceDeWhatsApp(datosOError(r).telefono, mensajeDeWhatsApp(p));
  if (!enlace) {
    notificar('El cliente no tiene un teléfono válido registrado.', 'error');
    return;
  }
  window.open(enlace, '_blank', 'noopener,noreferrer');
}
