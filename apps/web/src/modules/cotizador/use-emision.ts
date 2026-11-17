import { useState } from 'react';
import { notificar } from '../../shared/ui/notificar.ts';
import { resolverAccion } from './acciones.ts';
import { emitirCotizacion } from './api-cotizaciones.ts';
import { mensajeDeRechazo } from './logica.ts';
import { argumentosDeEmision, pideMotivoDeMargen } from './logica-cotizaciones.ts';
import { avisosDeRechazoDePrecios, pidePreciosDeHoy } from './logica-precio.ts';

type Pregunta = 'margen' | 'precios';

/**
 * Emitir desde la ficha. El servidor puede devolver dos preguntas: «¿por qué con este margen?» (pide el motivo) y «los
 * precios de lista cambiaron» (pide aceptarlos). Cada respuesta abre su hoja y la emisión se reintenta con lo contestado.
 */
export function useEmision(id: string, preguntar: (p: Pregunta) => void) {
  const [avisos, setAvisos] = useState<string[]>([]);
  const [preciosAceptados, setPreciosAceptados] = useState(false);

  async function intentar(motivo: string | undefined, aceptar: boolean): Promise<boolean> {
    const r = await emitirCotizacion(argumentosDeEmision(id, motivo, aceptar));
    if ('error' in r) {
      const { codigo, mensaje } = r.error;
      if (!motivo && pideMotivoDeMargen(codigo, mensaje)) preguntar('margen');
      else if (!aceptar && pidePreciosDeHoy(codigo, mensaje)) { setAvisos(avisosDeRechazoDePrecios(mensaje)); preguntar('precios'); }
      else notificar(mensajeDeRechazo(codigo, mensaje), 'error');
      return false;
    }
    return resolverAccion(Promise.resolve(r), aceptar ? 'Cotización emitida con los precios de hoy.' : 'Cotización emitida.');
  }

  return {
    avisos,
    emitir: () => intentar(undefined, false),
    emitirConMotivo: (motivo: string) => intentar(motivo, preciosAceptados),
    aceptarPreciosDeHoy: () => { setPreciosAceptados(true); return intentar(undefined, true); },
  };
}
