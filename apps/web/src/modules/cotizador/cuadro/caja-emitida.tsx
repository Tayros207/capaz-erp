import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { datosOError } from '../../../shared/api/consultas.ts';
import { Boton } from '../../../shared/ui/boton.tsx';
import { refrescarCotizador } from '../acciones.ts';
import { nuevaVersion, verCotizacion } from '../api-cotizaciones.ts';
import { CLAVE_COTIZADOR } from '../claves.ts';
import { HojaEnlace } from '../hoja-enlace.tsx';
import { rutaDeDocumento, rutaDeFicha } from '../logica-cotizaciones.ts';
import { notificar } from '../../../shared/ui/notificar.ts';
import { RUTA_DE_CUADRO_NUEVO } from './logica-cuadro.ts';
import type { ContextoDelCuadro } from './use-cuadro.ts';

/** Tras emitir: el código y los accesos a imprimir, al enlace para el cliente y a la ficha; y volver a cotizar o empezar otra. */
export function CajaEmitida({ id, emitir, editar }: Pick<ContextoDelCuadro, 'id' | 'emitir'> & { editar: boolean }) {
  const navegar = useNavigate();
  const [enlace, setEnlace] = useState(false);
  const q = useQuery({ queryKey: [...CLAVE_COTIZADOR, 'cuadro-emitida', id], queryFn: async () => datosOError(await verCotizacion(id)), retry: false });

  async function volverACotizar() {
    const r = await nuevaVersion(id);
    if (r.ok && 'datos' in r) { notificar('Nueva versión creada como borrador.', 'exito'); await refrescarCotizador(); } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }
  return (
    <section aria-label="Cotización emitida" className="flex flex-col gap-3 rounded-tarjeta border border-exito/40 bg-exito/5 p-4">
      <h2 className="font-titulo text-lg font-semibold text-texto">Cotización emitida</h2>
      {q.data ? <p className="text-texto-suave">Código {q.data.codigo} · versión {q.data.version}</p> : q.isError ? <p role="alert" className="text-sm font-medium text-peligro">{q.error.message}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" onClick={() => void navegar(rutaDeDocumento(id))}>Imprimir cotización</Boton>
        {emitir && q.data ? <Boton variante="secundario" onClick={() => setEnlace(true)}>Enlace para el cliente</Boton> : null}
        <Link to={rutaDeFicha(id)} className="inline-flex min-h-(--alto-control) items-center rounded-control border border-borde bg-superficie px-3.5 text-sm font-medium text-texto hover:border-borde-fuerte">Ver la ficha</Link>
      </div>
      {editar ? (
        <div className="flex flex-wrap gap-2">
          <Boton variante="fantasma" onClick={() => void volverACotizar()}>Volver a cotizar</Boton>
          <Boton variante="fantasma" onClick={() => void navegar(RUTA_DE_CUADRO_NUEVO)}>Nueva cotización</Boton>
        </div>
      ) : null}
      {q.data ? <HojaEnlace abierto={enlace} cotizacion={q.data} alCambiar={() => undefined} alCerrar={() => setEnlace(false)} /> : null}
    </section>
  );
}
