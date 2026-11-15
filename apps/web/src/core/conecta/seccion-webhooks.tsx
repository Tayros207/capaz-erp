import { useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { WebhookSaliente } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { datosOError, listarWebhooks } from './api.ts';
import { CLAVE_WEBHOOKS } from './claves.ts';
import { EnviosDeWebhook } from './envios-de-webhook.tsx';
import { HojaSecreto, type SecretoMostrado } from './hoja-secreto.tsx';
import { HojaWebhook, type WebhookElegido } from './hoja-webhook.tsx';
import { fechaHora } from './logica.ts';

const COLUMNAS: Array<Columna<WebhookSaliente>> = [
  { id: 'nombre', titulo: 'Nombre', principal: true, celda: (w) => w.nombre },
  { id: 'url', titulo: 'Dirección', celda: (w) => <span className="break-all">{w.url}</span> },
  { id: 'eventos', titulo: 'Eventos', celda: (w) => w.eventos.join(', ') },
  { id: 'estado', titulo: 'Estado', celda: (w) => (w.activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia tono="neutro">En pausa</Insignia>) },
  { id: 'ultimo', titulo: 'Último envío', celda: (w) => fechaHora(w.ultimoEnvioEn) },
  { id: 'error', titulo: 'Último error', celda: (w) => <span className="break-words">{w.ultimoError ?? '—'}</span> },
];

export function SeccionWebhooks({ puedeGestionar }: { puedeGestionar: boolean }) {
  const [elegido, setElegido] = useState<WebhookElegido>(null);
  const [secreto, setSecreto] = useState<SecretoMostrado | null>(null);
  const lista = useInfiniteQuery({
    queryKey: CLAVE_WEBHOOKS,
    queryFn: async ({ pageParam }) => datosOError(await listarWebhooks(pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 flex-1 text-texto-suave">Capaz avisa a tu sistema cuando ocurre un evento y firma cada envío con un secreto que ves una sola vez.</p>
          {puedeGestionar ? <Boton variante="primario" icono="mas" onClick={() => setElegido('nuevo')}>Nuevo webhook</Boton> : null}
        </div>
        {lista.isPending ? (
          <div aria-busy="true" aria-label="Cargando webhooks" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>
        ) : lista.isError ? (
          <EstadoVacio titulo="No pudimos cargar los webhooks" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
        ) : (
          <>
            <Lista etiqueta="Webhooks de salida" columnas={COLUMNAS} filas={filas} clave={(w) => w.id} onAbrir={setElegido} vacio={<EstadoVacio titulo="Todavía no hay webhooks" descripcion="Crea uno para que otro sistema se entere de lo que pasa en tu empresa." icono="caja" />} />
            <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
          </>
        )}
      </section>
      <section className="flex flex-col gap-3" aria-labelledby="titulo-envios">
        <h2 id="titulo-envios" className="font-titulo text-lg font-semibold">Envíos recientes</h2>
        <EnviosDeWebhook puedeGestionar={puedeGestionar} />
      </section>
      <HojaWebhook elegido={elegido} puedeGestionar={puedeGestionar} alCerrar={() => setElegido(null)} alMostrarSecreto={setSecreto} />
      <HojaSecreto secreto={secreto} alCerrar={() => setSecreto(null)} />
    </div>
  );
}
