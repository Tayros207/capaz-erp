import { InsigniaDeEstado } from '../../shared/ui/entidades.tsx';
import { ETIQUETA_DE_ESTADO, type EstadoDeCotizacion } from './logica-cotizaciones.ts';

/** El color sale del estado compartido: «Aceptada» o «Anulada» se ven igual que en Pedidos y Deudas. */
export function InsigniaDeCotizacion({ estado }: { estado: EstadoDeCotizacion }) {
  return <InsigniaDeEstado estado={ETIQUETA_DE_ESTADO[estado]} />;
}
