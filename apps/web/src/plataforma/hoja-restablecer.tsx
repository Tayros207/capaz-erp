import { useState } from 'react';
import { formatearFechaHora } from '../shared/formato/fechas.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { Campo } from '../shared/ui/campo.tsx';
import { HojaInferior } from '../shared/ui/hoja-inferior.tsx';
import { notificar } from '../shared/ui/notificar.ts';
import { restablecerContrasena } from './api.ts';
import { mensajeDeRechazo, validarCorreo } from './logica.ts';

type Props = { abierto: boolean; alCerrar: () => void };

async function copiar(enlace: string) {
  try {
    await navigator.clipboard.writeText(enlace);
    notificar('Enlace copiado.', 'exito');
  } catch {
    notificar('No se pudo copiar solo: selecciona el enlace y cópialo.', 'aviso');
  }
}

function Contenido({ alCerrar }: { alCerrar: () => void }) {
  const [correo, setCorreo] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const [generado, setGenerado] = useState<{ enlace: string; venceEn: string } | null>(null);

  async function enviar() {
    const e = validarCorreo(correo);
    setError(e);
    if (e) return;
    setOcupado(true);
    setAviso(undefined);
    const r = await restablecerContrasena(correo.trim());
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) setGenerado(r.datos);
    else if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  if (generado) {
    return (
      <div className="flex flex-col gap-3">
        <p>Enlace de un solo uso, válido hasta {formatearFechaHora(generado.venceEn)}. <strong>Se muestra una sola vez</strong>: no queda guardado. Cópialo y envíaselo a la persona.</p>
        <Campo etiqueta="Enlace de restablecimiento" readOnly value={generado.enlace} onFocus={(e) => e.currentTarget.select()} />
        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="primario" onClick={() => void copiar(generado.enlace)}>Copiar enlace</Boton>
          <Boton variante="fantasma" onClick={alCerrar}>Listo</Boton>
        </div>
      </div>
    );
  }
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <fieldset disabled={ocupado} className="flex flex-col gap-3">
        <Campo etiqueta="Correo de la cuenta" type="email" inputMode="email" autoComplete="off" required value={correo} error={error} onChange={(e) => setCorreo(e.target.value)} />
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>Generar enlace</Boton>
      </div>
    </form>
  );
}

export function HojaRestablecer({ abierto, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Restablecer contraseña">
      {abierto ? <Contenido alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
