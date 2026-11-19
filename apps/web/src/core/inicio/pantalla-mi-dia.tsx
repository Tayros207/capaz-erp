import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { Link } from 'react-router';
import { datosOError } from '../../shared/api/consultas.ts';
import { llamar } from '../../shared/api/herramientas.ts';
import { CLAVE_DATOS_DE_EMPRESA } from '../../shared/impresion/usar-datos-de-empresa.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { avisosDeFuentes, enLista, estaAlDia, fechaLarga, fuentesConFalla, fuentesRecortadas, hayMensajesDeCobro, hayPendientes, textoDeResumen, TITULO_DE_GRUPO } from './mi-dia-logica.ts';
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

/** Un módulo no respondió: el resto del panel sigue a la vista, y se dice cuál falta para no dar por bueno un «todo al día». */
function AvisoDeFalla({ modulos, reintentar }: { modulos: readonly string[]; reintentar: () => void }) {
  return (
    <div role="status" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-control border border-aviso/40 bg-aviso/10 px-3 py-2 text-sm text-texto">
      <p className="min-w-0 flex-1">No pudimos revisar {enLista(modulos)} esta vez; lo demás se muestra abajo.</p>
      <Boton variante="secundario" onClick={reintentar}>Volver a intentar</Boton>
    </div>
  );
}

/**
 * Los mensajes de cobro firman con la razón social de Ajustes › Empresa; si está vacía, salen sin el nombre de la empresa.
 * Se avisa solo si hay cobros en el panel y la persona puede ver esos datos. La clave cuelga de la de los datos de la
 * empresa: guardar en Ajustes › Empresa la invalida y el aviso desaparece.
 */
function AvisoDeRazonSocial({ hayCobros }: { hayCobros: boolean }) {
  const permisos = useYo()?.permisos ?? [];
  const puedeVer = permisos.includes('empresa:ver');
  const q = useQuery({
    queryKey: [...CLAVE_DATOS_DE_EMPRESA, 'razon-social'],
    enabled: hayCobros && puedeVer,
    staleTime: 60_000,
    queryFn: async () => datosOError(await llamar('empresa_ver_configuracion', {})).razonSocial?.trim() ?? '',
  });
  if (!hayCobros || !puedeVer || q.data === undefined || q.data !== '') return null;
  return (
    <p role="status" className="rounded-control border border-borde bg-superficie-alta px-3 py-2 text-sm text-texto">
      Tus mensajes de cobro saldrán sin el nombre de tu empresa porque falta la razón social.{' '}
      {permisos.includes('empresa:configurar') ? (
        <Link to="/ajustes/empresa" className="font-medium text-accion underline">Escríbela en Ajustes › Empresa</Link>
      ) : (
        'Pide a quien administra el sistema que la escriba en Ajustes › Empresa.'
      )}
    </p>
  );
}

/** «Mi día»: lo que hay que atender hoy, agrupado por urgencia. Solo lectura; nada se envía ni se cobra solo. */
export function PantallaMiDia({ empresa, saludo }: { empresa: string; saludo: string }) {
  const q = useQuery({ queryKey: CLAVE_MI_DIA, staleTime: 60_000, queryFn: async () => datosOError(await llamar('mi_dia_ver', {})) });
  const m = q.data;
  const resumen = m ? textoDeResumen(m.resumen) : '';
  const avisos = m ? avisosDeFuentes(m) : [];
  const fallas = m ? fuentesConFalla(m) : [];
  const recortadas = m ? fuentesRecortadas(m) : [];
  return (
    <section aria-labelledby="mi-dia" className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-sm font-medium tracking-wide text-texto-suave uppercase">{empresa}</p>
          <h1 id="mi-dia" tabIndex={-1} className="font-titulo text-3xl font-semibold text-texto focus:outline-none">Mi día</h1>
          <p className="text-texto-suave">
            {saludo}
            {m ? <> · <span className="inline-block first-letter:uppercase">{fechaLarga(m.fecha)}</span></> : null}
          </p>
          {m ? <p className="font-medium text-texto tabular-nums" aria-live="polite">{resumen || (estaAlDia(m) ? 'Todo al día' : '')}</p> : null}
          {/* Lo por aprobar de un pedido u orden que ya tiene tarjeta va como nota en ella: la Bandeja los muestra todos. */}
          {m && m.resumen.porAprobar > 0 ? <Link to="/bandeja" className="self-start rounded-chip text-sm font-medium text-accion underline">Revisar lo por aprobar en la Bandeja</Link> : null}
        </div>
        <Boton onClick={() => void q.refetch()} cargando={q.isFetching && !q.isPending} aria-label="Actualizar Mi día">
          <RefreshCw aria-hidden className="size-4" />
          Actualizar
        </Boton>
      </header>
      {q.isPending ? <Cargando /> : null}
      {q.isError && !m ? <ConError reintentar={() => void q.refetch()} reintentando={q.isFetching} /> : null}
      {q.isError && m ? <p role="alert" className="rounded-control border border-aviso/30 bg-aviso/5 px-3 py-2 text-sm text-texto">No pudimos actualizar; esto es lo último que cargó.</p> : null}
      {fallas.length > 0 ? <AvisoDeFalla modulos={fallas} reintentar={() => void q.refetch()} /> : null}
      {recortadas.length > 0 ? (
        <p role="status" className="rounded-control border border-borde bg-superficie-alta px-3 py-2 text-sm text-texto">
          Hay más de lo que cabe aquí y las cifras de arriba solo cuentan lo que se ve: {enLista(recortadas)}. Lo demás está en cada módulo.
        </p>
      ) : null}
      {m ? <AvisoDeRazonSocial hayCobros={hayMensajesDeCobro(m)} /> : null}
      {m && estaAlDia(m) ? <TodoAlDia /> : null}
      {m && !hayPendientes(m) && fallas.length > 0 ? <p className="text-sm text-texto-suave">En lo que sí pudimos revisar no hay nada pendiente.</p> : null}
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
      {avisos.length > 0 ? <p className="text-xs text-texto-suave">Sin datos de {enLista(avisos)}: no tienes acceso a {avisos.length === 1 ? 'ese módulo' : 'esos módulos'}.</p> : null}
    </section>
  );
}
