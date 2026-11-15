import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Boton } from '../../shared/ui/boton.tsx';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { AlertaDeError, ENLACE, MarcoAcceso } from '../acceso/marco-acceso.tsx';
import { aceptarInvitacion, verInvitacion } from './api.ts';
import { mensajeDeRechazo, veredictoDeAceptar, type DetalleDeInvitacion } from './logica.ts';

type Carga = { fase: 'cargando' } | { fase: 'error'; mensaje: string } | { fase: 'lista'; detalle: DetalleDeInvitacion };

const ROL: Record<string, string> = { owner: 'propietario', admin: 'administrador', member: 'miembro' };

export function PantallaInvitacion() {
  const { id = '' } = useParams();
  const yo = useYo();
  const [carga, setCarga] = useState<Carga>({ fase: 'cargando' });
  const [fallo, setFallo] = useState<string | null>(null);
  const [aceptando, setAceptando] = useState(false);

  useEffect(() => {
    let vigente = true;
    void verInvitacion(id).then((r) => {
      if (!vigente) return;
      if (r.ok && 'datos' in r) setCarga({ fase: 'lista', detalle: r.datos });
      else setCarga({ fase: 'error', mensaje: 'error' in r ? mensajeDeRechazo(r.error.codigo, r.error.mensaje) : 'No se pudo leer la invitación.' });
    });
    return () => {
      vigente = false;
    };
  }, [id]);

  async function aceptar(detalle: DetalleDeInvitacion) {
    setAceptando(true);
    setFallo(null);
    const r = await aceptarInvitacion(detalle);
    if (r.ok) {
      // Recarga completa: la ruta raíz vuelve a pedir «yo» con la empresa nueva.
      window.location.assign('/');
      return;
    }
    setFallo('error' in r ? mensajeDeRechazo(r.error.codigo, r.error.mensaje) : 'No se pudo aceptar la invitación.');
    setAceptando(false);
  }

  return (
    <MarcoAcceso titulo="Invitación a Capaz" subtitulo="Únete a la empresa que te invitó.">
      {carga.fase === 'cargando' ? <Esqueleto className="h-24 w-full" /> : null}
      {carga.fase === 'error' ? (
        <div className="flex flex-col gap-4">
          <AlertaDeError mensaje={carga.mensaje} />
          {yo ? null : <p className="text-sm text-texto-suave">Para ver la invitación, <Link to="/iniciar-sesion" className={ENLACE}>inicia sesión</Link> o <Link to="/registro" className={ENLACE}>crea tu cuenta</Link> con el correo al que se envió.</p>}
        </div>
      ) : null}
      {carga.fase === 'lista' ? <Detalle detalle={carga.detalle} correo={yo?.usuario.correo ?? null} fallo={fallo} aceptando={aceptando} alAceptar={() => void aceptar(carga.detalle)} /> : null}
    </MarcoAcceso>
  );
}

function Detalle({ detalle, correo, fallo, aceptando, alAceptar }: { detalle: DetalleDeInvitacion; correo: string | null; fallo: string | null; aceptando: boolean; alAceptar: () => void }) {
  const [ahora] = useState(() => new Date());
  const veredicto = veredictoDeAceptar(detalle, correo, ahora);
  return (
    <div className="flex flex-col gap-4">
      <p>
        Te invitaron a <strong>{detalle.empresa}</strong> como {ROL[detalle.rol] ?? detalle.rol}. La invitación es para <strong>{detalle.correo}</strong>.
      </p>
      <AlertaDeError mensaje={fallo ?? (veredicto.puede ? null : veredicto.motivo)} />
      {correo ? (
        <Boton variante="primario" tamano="grande" cargando={aceptando} disabled={!veredicto.puede} onClick={alAceptar}>
          {aceptando ? 'Aceptando…' : 'Aceptar invitación'}
        </Boton>
      ) : (
        <p className="text-sm text-texto-suave">Inicia sesión o crea tu cuenta con ese correo y vuelve a abrir este enlace.</p>
      )}
    </div>
  );
}
