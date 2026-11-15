import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { WebhookEnvio } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CargarMas } from '../../shared/ui/datos/cargar-mas.tsx';
import { Lista } from '../../shared/ui/datos/lista.tsx';
import type { Columna } from '../../shared/ui/datos/lista-tipos.ts';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { datosOError, listarEnvios, reintentarEnvio } from './api.ts';
import { CLAVE_ENVIOS } from './claves.ts';
import { ETIQUETA_DE_ESTADO_DE_ENVIO, fechaHora, TONO_DE_ESTADO_DE_ENVIO } from './logica.ts';

type Estado = 'pendiente' | 'enviado' | 'fallido';

/** Historial de envíos (de todos los webhooks o de uno) con «Reintentar» en los fallidos. */
export function EnviosDeWebhook({ webhookId, puedeGestionar }: { webhookId?: string; puedeGestionar: boolean }) {
  const consultas = useQueryClient();
  const [estado, setEstado] = useState<Estado | ''>('');
  const [reintentando, setReintentando] = useState<string | null>(null);
  const lista = useInfiniteQuery({
    queryKey: [...CLAVE_ENVIOS, webhookId ?? 'todos', estado],
    queryFn: async ({ pageParam }) => datosOError(await listarEnvios({ webhookId, estado: estado || undefined }, pageParam)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (p) => p.siguiente ?? undefined,
  });
  const filas = lista.data?.pages.flatMap((p) => p.items) ?? [];

  async function reintentar(e: WebhookEnvio) {
    setReintentando(e.id);
    const r = await reintentarEnvio(e.id);
    setReintentando(null);
    if (r.ok && 'datos' in r) {
      await consultas.invalidateQueries({ queryKey: CLAVE_ENVIOS });
      notificar('El envío se puso en cola otra vez.', 'exito');
    } else if ('error' in r) notificar(r.error.mensaje, 'error');
  }

  const columnas: Array<Columna<WebhookEnvio>> = [
    { id: 'tipo', titulo: 'Evento', principal: true, celda: (e) => e.tipo },
    { id: 'estado', titulo: 'Estado', celda: (e) => <Insignia tono={TONO_DE_ESTADO_DE_ENVIO[e.estado]}>{ETIQUETA_DE_ESTADO_DE_ENVIO[e.estado]}</Insignia> },
    { id: 'intentos', titulo: 'Intentos', alinear: 'derecha', celda: (e) => e.intentos },
    { id: 'http', titulo: 'Respuesta', celda: (e) => e.codigoHttp ?? '—' },
    { id: 'cuando', titulo: 'Creado', celda: (e) => fechaHora(e.creadoEn) },
    { id: 'error', titulo: 'Error', celda: (e) => <span className="break-words">{e.ultimoError ?? '—'}</span> },
    {
      id: 'acciones',
      titulo: 'Acciones',
      celda: (e) => (puedeGestionar && e.estado === 'fallido' ? <Boton cargando={reintentando === e.id} onClick={() => void reintentar(e)}>Reintentar</Boton> : '—'),
    },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="sm:max-w-56">
        <CampoSelect etiqueta="Estado del envío" value={estado} onChange={(e) => setEstado(e.target.value as Estado | '')}>
          <option value="">Todos</option>
          <option value="pendiente">Pendientes</option>
          <option value="enviado">Enviados</option>
          <option value="fallido">Fallidos</option>
        </CampoSelect>
      </div>
      {lista.isPending ? (
        <div aria-busy="true" aria-label="Cargando envíos" className="flex flex-col gap-2"><Esqueleto className="h-12" /><Esqueleto className="h-12" /></div>
      ) : lista.isError ? (
        <EstadoVacio titulo="No pudimos cargar los envíos" descripcion={lista.error.message} icono="caja" accion={<Boton onClick={() => void lista.refetch()}>Reintentar</Boton>} />
      ) : (
        <>
          <Lista etiqueta="Envíos de webhooks" columnas={columnas} filas={filas} clave={(e) => e.id} vacio={<EstadoVacio titulo="Sin envíos" descripcion="Cuando ocurra un evento suscrito, el envío aparecerá aquí." icono="caja" />} />
          <CargarMas cursor={lista.hasNextPage ? (lista.data?.pages.at(-1)?.siguiente ?? null) : null} cargando={lista.isFetchingNextPage} onCargar={() => void lista.fetchNextPage()} resumen={`Mostrando ${filas.length}`} />
        </>
      )}
    </div>
  );
}
