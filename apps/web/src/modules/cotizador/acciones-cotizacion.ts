import type { CotizacionCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { puedeEscribirEn } from '../../shared/sesion/acceso.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { verClienteParaWhatsApp } from './api-cotizaciones.ts';
import { verConfiguracion } from './api.ts';
import { enlaceDeWhatsApp, mensajeDeWhatsApp } from './documento-cotizacion.ts';
import type { PermisosDeCotizacion } from './logica-cotizaciones.ts';

export function usePermisosDeCotizaciones(): PermisosDeCotizacion {
  const yo = useYo();
  const escribe = !!yo && puedeEscribirEn(yo, 'cotizador');
  return { editar: escribe && puede(yo, 'cotizador:editar'), emitir: escribe && puede(yo, 'cotizador:emitir'), costos: !!yo && puede(yo, 'cotizador:costos') };
}

/** Abre WhatsApp con el mensaje armado; el PDF lo adjunta la persona («Guardar como PDF» del navegador). */
export async function enviarPorWhatsApp(c: Pick<CotizacionCompletaDto, 'clienteId' | 'codigo' | 'clienteNombre' | 'totalCentimos' | 'conOpciones'>): Promise<void> {
  if (!c.clienteId) {
    notificar('Esta cotización no tiene cliente.', 'error');
    return;
  }
  const [cliente, config] = await Promise.all([verClienteParaWhatsApp(c.clienteId), verConfiguracion()]);
  if (!cliente.ok || !('datos' in cliente)) {
    notificar('No pudimos leer los datos del cliente.', 'error');
    return;
  }
  const plantilla = config.ok && 'datos' in config ? datosOError(config).mensajeWhatsapp : null;
  const enlace = enlaceDeWhatsApp(datosOError(cliente).telefono, mensajeDeWhatsApp(c, plantilla));
  if (!enlace) {
    notificar('El cliente no tiene un teléfono válido registrado.', 'error');
    return;
  }
  window.open(enlace, '_blank', 'noopener,noreferrer');
}
