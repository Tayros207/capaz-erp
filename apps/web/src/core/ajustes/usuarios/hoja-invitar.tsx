import { useState } from 'react';
import type { Invitacion } from '@capaz/shared';
import { Boton } from '../../../shared/ui/boton.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../../shared/ui/hoja-inferior.tsx';
import { invitar } from './api.ts';
import { copiarEnlace } from './copiar-enlace.ts';
import { enlaceAbsoluto, etiquetaDeRol, mensajeDeRechazo, validarCorreo } from './logica.ts';

type Props = { abierto: boolean; alCerrar: () => void; alCambiar: () => void };

function Contenido({ alCerrar, alCambiar }: Omit<Props, 'abierto'>) {
  const [correo, setCorreo] = useState('');
  const [rol, setRol] = useState<'member' | 'admin'>('member');
  const [error, setError] = useState<string | undefined>();
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const [creada, setCreada] = useState<Invitacion | null>(null);

  async function enviar() {
    const e = validarCorreo(correo);
    setError(e);
    if (e) return;
    setOcupado(true);
    setAviso(undefined);
    const r = await invitar({ correo: correo.trim(), rol });
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      setCreada(r.datos);
      alCambiar();
    } else if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  if (creada) {
    const enlace = enlaceAbsoluto(creada.ruta, window.location.origin);
    return (
      <div className="flex flex-col gap-3">
        <p>Invitación creada para <strong>{creada.correo}</strong> como {etiquetaDeRol(creada.rol).toLowerCase()}. No se envía ningún correo: copia el enlace y envíaselo.</p>
        <Campo etiqueta="Enlace de invitación" readOnly value={enlace} onFocus={(e) => e.currentTarget.select()} />
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="primario" onClick={() => void copiarEnlace(enlace)}>Copiar enlace</Boton>
          <Boton variante="fantasma" onClick={alCerrar}>Listo</Boton>
        </div>
      </div>
    );
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Correo de la persona" type="email" inputMode="email" autoComplete="off" required value={correo} error={error} onChange={(e) => setCorreo(e.target.value)} />
        <CampoSelect etiqueta="Rol" value={rol} onChange={(e) => setRol(e.target.value as 'member' | 'admin')}>
          <option value="member">Miembro</option>
          <option value="admin">Administrador</option>
        </CampoSelect>
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>Crear invitación</Boton>
      </div>
    </form>
  );
}

export function HojaInvitar({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Invitar a una persona">
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
