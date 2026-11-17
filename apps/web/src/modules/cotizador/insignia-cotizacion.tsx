import { Insignia } from '../../shared/ui/insignia.tsx';
import { ETIQUETA_DE_ESTADO, TONO_DE_ESTADO, type EstadoDeCotizacion } from './logica-cotizaciones.ts';

export function InsigniaDeCotizacion({ estado }: { estado: EstadoDeCotizacion }) {
  return <Insignia tono={TONO_DE_ESTADO[estado]}>{ETIQUETA_DE_ESTADO[estado]}</Insignia>;
}
