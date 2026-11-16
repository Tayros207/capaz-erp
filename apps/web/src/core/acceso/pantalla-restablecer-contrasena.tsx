import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { restablecerContrasena } from './api.ts';
import { AlertaDeError, ENLACE, MarcoAcceso } from './marco-acceso.tsx';
import { mensajeDeError } from './mensajes.ts';
import { hayErrores, leerEnlaceDeRestablecer, validarNuevaClave, type EnlaceDeRestablecer, type Errores } from './validacion.ts';

const SIN_SESION = 'Inicia sesión con tu contraseña nueva.';

/** Pantalla pública: el enlace que genera la consola trae el token de un solo uso en `?token=`. */
export function PantallaRestablecerContrasena() {
  // El token se lee una vez y se saca de la dirección: no queda en el historial ni se comparte al copiar la URL.
  const [enlace] = useState<EnlaceDeRestablecer>(() => leerEnlaceDeRestablecer(window.location.search));
  const [token] = useState(() => (enlace.estado === 'valido' ? enlace.token : ''));
  useEffect(() => {
    if (window.location.search) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const [clave, setClave] = useState('');
  const [repetir, setRepetir] = useState('');
  const [errores, setErrores] = useState<Errores<'clave' | 'repetir'>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hecho, setHecho] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const e = validarNuevaClave({ clave, repetir });
    setErrores(e);
    setFallo(null);
    if (hayErrores(e)) return;
    setEnviando(true);
    const r = await restablecerContrasena({ token, clave });
    if (r.ok) {
      setHecho(true);
      return;
    }
    setFallo('error' in r ? mensajeDeError(r.error.codigo, 'restablecer') : 'No se pudo cambiar la contraseña.');
    setEnviando(false);
  }

  if (hecho) {
    return (
      <MarcoAcceso titulo="Contraseña cambiada" subtitulo="Ya puedes entrar con tu contraseña nueva.">
        <p role="status" className="mb-4 text-texto">{SIN_SESION}</p>
        <Link to="/iniciar-sesion" className={ENLACE}>Ir a iniciar sesión</Link>
      </MarcoAcceso>
    );
  }

  if (enlace.estado === 'invalido') {
    return (
      <MarcoAcceso titulo="Enlace no válido" pie={<Link to="/iniciar-sesion" className="font-semibold text-menu-texto underline underline-offset-2">Volver a iniciar sesión</Link>}>
        <p role="alert" className="text-texto">
          Este enlace ya se usó, venció o no es correcto. Pide a Capaz que te genere uno nuevo; cada enlace sirve una sola vez y dura una hora.
        </p>
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso titulo="Nueva contraseña" subtitulo="Elige una contraseña de 10 a 128 caracteres." pie={<Link to="/iniciar-sesion" className="font-semibold text-menu-texto underline underline-offset-2">Volver a iniciar sesión</Link>}>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <AlertaDeError mensaje={fallo} />
        <Campo etiqueta="Contraseña nueva" type="password" name="new-password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} error={errores.clave} />
        <Campo etiqueta="Repite la contraseña" type="password" name="repeat-password" autoComplete="new-password" value={repetir} onChange={(e) => setRepetir(e.target.value)} error={errores.repetir} />
        <Boton type="submit" variante="primario" tamano="grande" cargando={enviando}>
          {enviando ? 'Guardando…' : 'Cambiar contraseña'}
        </Boton>
      </form>
    </MarcoAcceso>
  );
}
