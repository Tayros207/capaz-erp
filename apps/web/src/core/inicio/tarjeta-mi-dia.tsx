import { ArrowUpRight, Copy, MessageCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { formatearSoles, type TarjetaDeMiDia } from '@capaz/shared';
import { ChipDeCliente } from '../../shared/ui/entidades.tsx';
import { rutaDeEntidad } from '../../shared/ui/entidades-logica.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { unir } from '../../shared/ui/unir.ts';
import { copiarTexto } from '../conecta/navegador.ts';
import { enlaceDeWhatsapp, ETIQUETA_DE_URGENCIA, FRANJA_DE_URGENCIA, textoSinWhatsapp, TONO_DE_URGENCIA } from './mi-dia-logica.ts';
import { useAccionDeMiDia } from './use-accion-de-mi-dia.ts';

const BOTON_ENLACE =
  'inline-flex min-h-(--alto-control) items-center justify-center gap-2 rounded-control border border-borde bg-superficie px-3.5 text-sm font-medium text-texto shadow-sutil transition-[background-color,border-color] duration-150 hover:border-borde-fuerte hover:bg-superficie-alta';

function Tramos({ t }: { t: NonNullable<TarjetaDeMiDia['cobro']> }) {
  // Los mismos cortes que «Antigüedad de saldos» (1-30 y 31-60; 61-90 y más de 90 van juntos aquí).
  const filas: Array<[string, number]> = [['1-30 días', t.tramo0a30Centimos], ['31-60 días', t.tramo31a60Centimos], ['61+ días', t.tramo61masCentimos]];
  return (
    <dl className="grid grid-cols-3 gap-2 text-xs">
      {filas.map(([rotulo, monto]) => (
        // Un tramo en cero se distingue por el borde punteado, no bajando la opacidad: el texto debe seguir legible (contraste).
        <div key={rotulo} className={unir('rounded-control border border-borde px-2 py-1.5', monto > 0 ? 'bg-superficie-alta' : 'border-dashed')}>
          <dt className="text-texto-suave">{rotulo}</dt>
          <dd className={unir('tabular-nums', monto > 0 ? 'font-medium text-texto' : 'text-texto-suave')}>{formatearSoles(monto)}</dd>
        </div>
      ))}
    </dl>
  );
}

function MensajeDeCobro({ t }: { t: TarjetaDeMiDia }) {
  const m = t.mensaje;
  if (!m) return null;
  const whatsapp = enlaceDeWhatsapp(t);
  return (
    <div className="flex flex-col gap-2">
      <details className="group rounded-control border border-borde bg-fondo px-3 py-2 text-sm">
        <summary className="cursor-pointer rounded-chip font-medium text-texto-suave select-none hover:text-texto">{t.grupo === 'recompra' ? 'Ver el mensaje' : 'Ver el mensaje de cobro'}</summary>
        <p className="mt-2 whitespace-pre-line text-texto">{m.texto}</p>
      </details>
      <div className="flex flex-wrap gap-2">
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={BOTON_ENLACE} aria-label={`WhatsApp a ${t.cliente?.nombre ?? 'el cliente'} (se abre en una pestaña nueva; no se envía solo)`}>
            <MessageCircle aria-hidden className="size-4" />
            WhatsApp
          </a>
        ) : null}
        <Boton onClick={() => void copiarTexto(m.texto, 'Mensaje copiado')}>
          <Copy aria-hidden className="size-4" />
          Copiar mensaje
        </Boton>
      </div>
      {whatsapp ? null : (
        <p className="text-xs text-texto-suave">
          {textoSinWhatsapp(t.grupo)}
          {t.grupo === 'recompra' ? <>{' '}<Link to={rutaDeEntidad(t.entidad.tipo, t.entidad.id)} className="font-medium text-accion underline">Abrir su ficha</Link></> : null}
        </p>
      )}
    </div>
  );
}

/** Una tarjeta de «Mi día»: qué es, cuándo, cuánto, de quién; la ficha, la acción de un clic y, en cobros, el mensaje. */
/** A dónde va el foco cuando la tarjeta sale de la lista: la tarjeta vecina o, si no hay, el título «Mi día». */
function destinoDeFoco(desde: HTMLElement): HTMLElement | null {
  const li = desde.closest('li');
  return (li?.nextElementSibling ?? li?.previousElementSibling)?.querySelector<HTMLElement>('h3 a') ?? document.getElementById('mi-dia');
}

export function TarjetaDeMiDiaVista({ t }: { t: TarjetaDeMiDia }) {
  const accion = useAccionDeMiDia(t);
  // Con una acción de un clic la tarjeta desaparece (optimista) y con ella el botón enfocado: el foco pasa a la vecina
  // para que quien usa teclado o lector de pantalla no vuelva al inicio de la página.
  const foco = useRef<HTMLElement | null>(null);
  useEffect(
    () => () => {
      const destino = foco.current;
      if (destino?.isConnected && (document.activeElement === null || document.activeElement === document.body)) destino.focus();
    },
    [],
  );
  const ruta = rutaDeEntidad(t.entidad.tipo, t.entidad.id);
  return (
    <article
      aria-label={t.titulo}
      className={unir('flex h-full flex-col gap-3 rounded-tarjeta border border-l-4 border-borde bg-superficie p-4 shadow-tarjeta', FRANJA_DE_URGENCIA[t.urgencia], accion.isPending && 'opacity-60')}
    >
      <header className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <Insignia tono={TONO_DE_URGENCIA[t.urgencia]}>{ETIQUETA_DE_URGENCIA[t.urgencia]}</Insignia>
          {t.notas.map((n, i) => <Insignia key={`${i}-${n.texto}`} tono={n.tono}>{n.texto}</Insignia>)}
          {t.montoCentimos !== null ? <span className="ml-auto font-titulo text-base font-semibold text-texto tabular-nums">{formatearSoles(t.montoCentimos)}</span> : null}
        </div>
        <h3 className="font-semibold text-texto">
          <Link to={ruta} className="rounded-chip hover:text-accion hover:underline">{t.titulo}</Link>
        </h3>
        <p className="text-sm text-texto-suave">{t.detalle}</p>
        {t.cliente && t.entidad.tipo !== 'cliente' ? <ChipDeCliente id={t.cliente.id} nombre={t.cliente.nombre} className="self-start" /> : null}
      </header>
      {t.cobro ? <Tramos t={t.cobro} /> : null}
      <MensajeDeCobro t={t} />
      <footer className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        {t.acciones.map((a, i) => (
          <Boton key={a.etiqueta} variante={i === 0 ? 'primario' : 'secundario'} cargando={accion.isPending && accion.variables?.etiqueta === a.etiqueta} disabled={accion.isPending} onClick={(e) => { foco.current = destinoDeFoco(e.currentTarget); accion.mutate(a); }}>
            {a.etiqueta}
          </Boton>
        ))}
        <Link to={ruta} className="ml-auto inline-flex min-h-(--alto-control) items-center gap-1 rounded-control px-2 text-sm font-medium text-accion hover:underline">
          Abrir <ArrowUpRight aria-hidden className="size-4" />
          <span className="sr-only">{t.titulo}</span>
        </Link>
      </footer>
    </article>
  );
}
