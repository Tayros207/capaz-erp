import type { ModeloDelCatalogo } from '@capaz/shared';
import { precioPorMillon } from './logica-uso.ts';

const NIVEL: Record<ModeloDelCatalogo['nivel'], string> = { recomendado: 'Recomendado', equilibrado: 'Equilibrado', economico: 'Económico', premium: 'Premium', experimental: 'Experimental' };

/** Las etiquetas honestas de un modelo: lo que cuesta, si se evaluó y si hay que revisar su privacidad. */
export function etiquetasDeModelo(m: ModeloDelCatalogo): string[] {
  return [
    NIVEL[m.nivel],
    precioPorMillon(m.entradaMicrousdPorMillon) ? `entrada ${precioPorMillon(m.entradaMicrousdPorMillon)}` : null,
    precioPorMillon(m.salidaMicrousdPorMillon) ? `salida ${precioPorMillon(m.salidaMicrousdPorMillon)}` : null,
    m.evaluado ? null : 'Sin evaluar',
    m.privacidad === 'revisar' ? 'Revisar privacidad' : null,
    m.disponible ? null : 'No disponible hoy',
  ].filter((x): x is string => x !== null);
}
