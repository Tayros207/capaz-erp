import { InsigniaDeEstado } from '../../shared/ui/entidades.tsx';
import { ETIQUETA_DE_ESTADO, estaVencida, type EstadoDeCotizacion } from './logica-cotizaciones.ts';

/**
 * El color sale del estado compartido: «Aceptada» o «Anulada» se ven igual que en Pedidos y Deudas.
 * Con `validaHasta`, una emitida o enviada ya pasada de fecha se muestra «Vencida» (solo en pantalla).
 */
export function InsigniaDeCotizacion({ estado, validaHasta }: { estado: EstadoDeCotizacion; validaHasta?: string | null }) {
  const vencida = estaVencida({ estado, validaHasta: validaHasta ?? null });
  return <InsigniaDeEstado estado={vencida ? 'Vencida' : ETIQUETA_DE_ESTADO[estado]} />;
}
