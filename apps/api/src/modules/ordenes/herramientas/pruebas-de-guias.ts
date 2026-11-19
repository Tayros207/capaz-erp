import type { Sesion } from '../../../core/herramientas/http-de-pruebas.js';
import { confirmarCritica, crearBorrador, datos, linea } from './pruebas-de-pedidos.js';

// Ayudantes de las pruebas por HTTP de guías de remisión (solo los importan los `*.int.spec.ts` de esta carpeta).

export const TRASLADO_BASE = {
  fechaTraslado: '2099-01-10',
  puntoPartida: 'Av. Lima 100',
  puntoLlegada: 'Jr. Cusco 200',
  motivo: 'venta',
  modalidad: 'privado',
} as const;

/** Crea un pedido con esas líneas `[descripción, soles, cantidad]`, lo confirma y lo deja en «listo». Devuelve `pedido_ver`. */
export async function pedidoListo(s: Sesion, clienteId: string, lineas: ReadonlyArray<readonly [string, number, number]> = [['Tarjetas', 10, 5]]): Promise<any> {
  const p = await crearBorrador(s, clienteId, { lineas: lineas.map(([d, soles, c]) => linea(d, soles, c)) });
  datos(await s.herramienta('pedido_confirmar', { id: p.id }));
  datos(await s.herramienta('pedido_cambiar_estado', { id: p.id, estado: 'listo' }));
  return datos(await s.herramienta('pedido_ver', { id: p.id }));
}

/** Una línea de guía que toma `milesimas` de la línea `posicion` (0 por defecto) del pedido. */
export const deLaGuia = (pedido: any, milesimas: number, posicion = 0) => ({
  tipo: 'pedido' as const,
  pedidoLineaId: pedido.detalle[posicion].id as string,
  cantidadMilesimas: milesimas,
});

export const libre = (descripcion: string, milesimas = 1000, unidad?: string) => ({ tipo: 'libre' as const, descripcion, cantidadMilesimas: milesimas, ...(unidad && { unidad }) });

/** Emite una guía con el traslado base y devuelve la respuesta cruda. */
export const emitirGuia = (s: Sesion, clienteId: string, lineas: unknown[], extra: Record<string, unknown> = {}, opciones?: { clave?: string }) =>
  s.herramienta('guia_emitir', { clienteId, ...TRASLADO_BASE, lineas, ...extra }, opciones);

export { confirmarCritica };
