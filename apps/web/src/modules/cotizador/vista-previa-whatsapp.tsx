import { useQuery } from '@tanstack/react-query';
import type { CotizacionCompletaDto } from '@capaz/shared';
import { datosOError } from '../../shared/api/consultas.ts';
import { verConfiguracion } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { vistaPreviaDeMensaje } from './logica-enlace.ts';

/** Así le llegará el mensaje al cliente por WhatsApp (la plantilla sale de los Ajustes del Cotizador). */
export function VistaPreviaDeWhatsApp({ cotizacion, url }: { cotizacion: Pick<CotizacionCompletaDto, 'codigo' | 'clienteNombre'>; url: string | null }) {
  const config = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'configuracion'], queryFn: async () => datosOError(await verConfiguracion()), retry: false });
  if (config.isPending) return null;
  const texto = vistaPreviaDeMensaje(config.data?.mensajeWhatsapp, url, cotizacion);
  return (
    <section aria-label="Vista previa del mensaje de WhatsApp" className="flex flex-col gap-1">
      <h3 className="font-titulo font-semibold text-texto">Vista previa del mensaje</h3>
      <p className="whitespace-pre-line break-words rounded-tarjeta border border-borde bg-superficie-alta p-3 text-sm text-texto">{texto}</p>
      <p className="text-sm text-texto-suave">Cambia el texto en los Ajustes del Cotizador.</p>
    </section>
  );
}
