import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar } from '../../shared/api/herramientas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { avisosDeFuentes, fechaLarga, hayPendientes, textoDeResumen, TITULO_DE_GRUPO } from './mi-dia-logica.ts';
import { TarjetaDeMiDiaVista } from './tarjeta-mi-dia.tsx';
import { CLAVE_MI_DIA } from './use-accion-de-mi-dia.ts';

function Cargando() {
  return (
    <div aria-busy="true" aria-live="polite" className="flex flex-col gap-3">
      <span className="sr-only">Cargando tu día…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2 rounded-tarjeta border border-borde bg-superficie p-4 shadow-tarjeta">
          <Esqueleto className="h-5 w-24" />
          <Esqueleto className="h-5 w-2/3" />
          <Esqueleto className="h-4 w-1/2" />
        </div>
      ))}
    </div>
  );
}

function ConError({ reintentar, reintentando }: { reintentar: () => void; reintentando: boolean }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-tarjeta border border-peligro/30 bg-peligro/5 p-5">
      <p className="font-semibold text-texto">No pudimos cargar tu día.</p>
      <p className="text-sm text-texto-suave">Puede ser la conexión. No se perdió nada: tus módulos siguen abajo.</p>
      <Boton onClick={reintentar} cargando={reintentando}>Intentar de nuevo</Boton>
    </div>
  );
}

function TodoAlDia() {
  return (
    <div className="flex flex-col items-center gap-2 rounded-tarjeta border border-exito/25 bg-exito/5 px-4 py-10 text-center">
      <CheckCircle2 aria-hidden className="size-10 text-exito" />
      <h2 className="font-titulo text-xl font-semibold text-texto">Todo al día</h2>
      <p className="max-w-sm text-sm text-texto-suave">No hay entregas, cobros ni seguimientos pendientes para hoy. Buen momento para adelantar lo que viene.</p>
    </div>
  );
}

/** «Mi día»: lo que hay que atender hoy, agrupado por urgencia. Solo lectura; nada se envía ni se cobra solo. */
export function PantallaMiDia({ empresa, saludo }: { empresa: string; saludo: string }) {
  const q = useQuery({ queryKey: CLAVE_MI_DIA, staleTime: 60_000, queryFn: async () => datosOError(await llamar('mi_dia_ver', {})) });
  const m = q.data;
  const resumen = m ? textoDeResumen(m.resumen) : '';
  const avisos = m ? avisosDeFuentes(m) : [];
  return (
    <section aria-labelledby="mi-dia" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-medium tracking-wide text-texto-suave uppercase">{empresa}</p>
          <h1 id="mi-dia" className="font-titulo text-3xl font-semibold text-texto">Mi día</h1>
          <p className="text-texto-suave">
            {saludo}
            {m ? <> · <span className="inline-block first-letter:uppercase">{fechaLarga(m.fecha)}</span></> : null}
          </p>
          {m ? <p className="font-medium text-texto tabular-nums" aria-live="polite">{resumen || (hayPendientes(m) ? '' : 'Todo al día')}</p> : null}
        </div>
        <Boton onClick={() => void q.refetch()} cargando={q.isFetching && !q.isPending} aria-label="Actualizar Mi día">
          <RefreshCw aria-hidden className="size-4" />
          Actualizar
        </Boton>
      </header>
      {q.isPending ? <Cargando /> : null}
      {q.isError && !m ? <ConError reintentar={() => void q.refetch()} reintentando={q.isFetching} /> : null}
      {q.isError && m ? <p role="alert" className="rounded-control border border-aviso/30 bg-aviso/5 px-3 py-2 text-sm text-texto">No pudimos actualizar; esto es lo último que cargó.</p> : null}
      {m && !hayPendientes(m) ? <TodoAlDia /> : null}
      {m?.grupos.map((g) => (
        <section key={g.clave} aria-labelledby={`mi-dia-${g.clave}`} className="flex flex-col gap-2">
          <h2 id={`mi-dia-${g.clave}`} className="flex items-center gap-2 font-titulo text-sm font-semibold tracking-wide text-texto-suave uppercase">
            {TITULO_DE_GRUPO[g.clave]}
            <span className="rounded-chip bg-superficie-alta px-1.5 py-0.5 text-xs text-texto tabular-nums">{g.tarjetas.length}</span>
          </h2>
          <ul className="grid list-none gap-3 p-0 md:grid-cols-2">
            {g.tarjetas.map((t) => <li key={t.clave} className="min-w-0"><TarjetaDeMiDiaVista t={t} /></li>)}
          </ul>
        </section>
      ))}
      {avisos.length > 0 ? <p className="text-xs text-texto-suave">Sin datos de: {avisos.join(' · ')}.</p> : null}
    </section>
  );
}
