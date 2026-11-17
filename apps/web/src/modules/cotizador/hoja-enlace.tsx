import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type { CotizacionCompletaDto, EnlaceDeCotizacionDto } from '@capaz/shared';
import { copiarEnlace } from '../../core/ajustes/usuarios/copiar-enlace.ts';
import { clienteDeConsultas } from '../../shared/api/cliente-de-consultas.ts';
import { datosOError } from '../../shared/api/consultas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { verClienteParaWhatsApp } from './api-cotizaciones.ts';
import { generarEnlace, listarEnlaces, revocarEnlace } from './api-enlaces.ts';
import { verConfiguracion } from './api.ts';
import { CLAVE_COTIZADOR } from './claves.ts';
import { enlaceDeWhatsApp } from './documento-cotizacion.ts';
import { DIAS_POR_DEFECTO, ETIQUETA_DE_ESTADO_DE_ENLACE, leerDias, mensajeConEnlace, sePuedeGenerarEnlace, textoDeVigencia, textoDeVistas, TONO_DE_ESTADO_DE_ENLACE } from './logica-enlace.ts';
import { mensajeDeRechazo } from './logica.ts';

type Props = { abierto: boolean; cotizacion: CotizacionCompletaDto; alCerrar: () => void; alCambiar: () => void };

/** Abre WhatsApp con el mensaje (plantilla de la configuración, con `{enlace}`) y el enlace recién generado. */
async function enviarEnlacePorWhatsApp(c: CotizacionCompletaDto, url: string): Promise<void> {
  if (!c.clienteId) return notificar('Esta cotización no tiene cliente.', 'error');
  const [cliente, config] = await Promise.all([verClienteParaWhatsApp(c.clienteId), verConfiguracion()]);
  if (!cliente.ok || !('datos' in cliente)) return notificar('No pudimos leer los datos del cliente.', 'error');
  const plantilla = config.ok && 'datos' in config ? datosOError(config).mensajeWhatsapp : null;
  const vinculo = enlaceDeWhatsApp(datosOError(cliente).telefono, mensajeConEnlace(plantilla, url, c));
  if (!vinculo) return notificar('El cliente no tiene un teléfono válido registrado.', 'error');
  window.open(vinculo, '_blank', 'noopener,noreferrer');
}

function EnlaceNuevo({ c, url }: { c: CotizacionCompletaDto; url: string }) {
  return (
    <section aria-label="Enlace recién generado" className="flex flex-col gap-3 rounded-control border border-borde-fuerte p-3">
      <p className="text-sm font-medium text-texto">Copia el enlace ahora: por seguridad no se vuelve a mostrar.</p>
      <Campo etiqueta="Enlace para el cliente" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
      <div className="flex flex-wrap gap-2">
        <Boton variante="primario" onClick={() => void copiarEnlace(url)}>Copiar enlace</Boton>
        <Boton onClick={() => void enviarEnlacePorWhatsApp(c, url)}>Enviar por WhatsApp</Boton>
      </div>
    </section>
  );
}

function FilaDeEnlace({ e, alRevocar }: { e: EnlaceDeCotizacionDto; alRevocar: (id: string) => Promise<void> }) {
  const [revocando, setRevocando] = useState(false);
  return (
    <li className="flex flex-col gap-1 border-b border-borde py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <Insignia tono={TONO_DE_ESTADO_DE_ENLACE[e.estado]}>{ETIQUETA_DE_ESTADO_DE_ENLACE[e.estado]}</Insignia>
        <span className="text-sm text-texto-suave">Versión {e.version} · {textoDeVigencia(e)}</span>
      </div>
      <p className="text-sm text-texto">{textoDeVistas(e.vistas, e.ultimaVistaEn)}</p>
      {e.estado === 'vigente' ? (
        <div>
          <Boton variante="fantasma" cargando={revocando} onClick={() => { setRevocando(true); void alRevocar(e.id).finally(() => setRevocando(false)); }}>Revocar</Boton>
        </div>
      ) : null}
    </li>
  );
}

function Contenido({ cotizacion: c, alCambiar }: Omit<Props, 'abierto' | 'alCerrar'>) {
  const [dias, setDias] = useState(String(DIAS_POR_DEFECTO));
  const [generando, setGenerando] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const clave = [...CLAVE_COTIZADOR, 'enlaces', c.id];
  const lista = useQuery({ queryKey: clave, queryFn: async () => datosOError(await listarEnlaces(c.id)).items });
  const diasValidos = leerDias(dias);
  const refrescar = () => clienteDeConsultas.invalidateQueries({ queryKey: clave });

  async function generar() {
    if (diasValidos === undefined) return;
    setGenerando(true);
    const r = await generarEnlace({ id: c.id, diasDeVigencia: diasValidos });
    setGenerando(false);
    if ('cancelada' in r) return;
    if (!('datos' in r)) return 'error' in r ? notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error') : undefined;
    setUrl(r.datos.url);
    alCambiar();
    await refrescar();
  }
  async function revocar(id: string) {
    const r = await revocarEnlace(id);
    if ('error' in r) return notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
    notificar('Enlace revocado.', 'exito');
    alCambiar();
    await refrescar();
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-texto">El cliente abre el enlace sin entrar al sistema, ve la cotización y puede aprobarla o rechazarla. Nunca ve costos ni márgenes.</p>
      {url ? <EnlaceNuevo c={c} url={url} /> : null}
      {sePuedeGenerarEnlace(c.estado) ? (
        <div className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Días de vigencia" inputMode="numeric" value={dias} onChange={(ev) => setDias(ev.target.value)} error={diasValidos === undefined ? 'Entre 1 y 365 días.' : undefined} className="w-32" />
          <Boton variante="primario" cargando={generando} disabled={diasValidos === undefined} onClick={() => void generar()}>Generar enlace</Boton>
        </div>
      ) : (
        <p className="text-sm text-texto-suave">Solo se genera un enlace de una cotización emitida o enviada.</p>
      )}
      <section aria-label="Enlaces de la cotización" className="flex flex-col gap-1">
        <h3 className="font-titulo font-semibold text-texto">Enlaces generados</h3>
        {lista.isPending ? <p className="text-sm text-texto-suave">Cargando…</p> : null}
        {lista.isError ? <p role="alert" className="text-sm font-medium text-peligro">No pudimos leer los enlaces.</p> : null}
        {lista.data?.length === 0 ? <EstadoVacio titulo="Aún no generaste ningún enlace" descripcion="Cuando lo hagas, aquí verás cuántas veces lo abrió el cliente." icono="caja" /> : null}
        {lista.data && lista.data.length > 0 ? <ul>{lista.data.map((e) => <FilaDeEnlace key={e.id} e={e} alRevocar={revocar} />)}</ul> : null}
      </section>
    </div>
  );
}

/** «Enlace para el cliente»: generar (con confirmación), copiar o mandar por WhatsApp, y ver o revocar los enlaces. */
export function HojaEnlace({ abierto, alCerrar, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Enlace para el cliente">
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
