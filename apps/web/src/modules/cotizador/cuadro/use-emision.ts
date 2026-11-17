import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { refrescarCotizador } from '../acciones.ts';
import { emitirCotizacion } from '../api-cotizaciones.ts';
import { mensajeDeRechazo } from '../logica.ts';
import { argumentosDeEmision, pideMotivoDeMargen } from '../logica-cotizaciones.ts';
import { notificar } from '../../../shared/ui/notificar.ts';
import { pideMotivoAntesDeEmitir } from './logica-cuadro.ts';
import { claveDelCuadro, type ContextoDelCuadro } from './use-cuadro.ts';

/**
 * Emitir en dos pasos: con el semáforo en rojo primero se pide el motivo; después el servidor pide su confirmación.
 * Si el servidor exige el motivo aunque la pantalla no lo supiera (sin permiso de costos), también se abre la hoja.
 */
export function useEmision(ctx: Pick<ContextoDelCuadro, 'id' | 'vista'>) {
  const cliente = useQueryClient();
  const [pidiendoMotivo, setPidiendoMotivo] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function emitir(motivo?: string): Promise<boolean> {
    const r = await emitirCotizacion(argumentosDeEmision(ctx.id, motivo));
    if ('cancelada' in r) return false;
    if (r.ok && 'datos' in r) {
      if (r.datos.cuadro) cliente.setQueryData(claveDelCuadro(ctx.id), r.datos.cuadro);
      notificar('Cotización emitida.', 'exito');
      await refrescarCotizador();
      return true;
    }
    if (!('error' in r)) return false;
    if (!motivo && pideMotivoDeMargen(r.error.codigo, r.error.mensaje)) setPidiendoMotivo(true);
    else notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
    return false;
  }
  async function pedir() {
    if (pideMotivoAntesDeEmitir(ctx.vista)) return setPidiendoMotivo(true);
    setOcupado(true);
    await emitir();
    setOcupado(false);
  }
  return { pedir, emitir, ocupado, pidiendoMotivo, cerrarMotivo: () => setPidiendoMotivo(false) };
}
