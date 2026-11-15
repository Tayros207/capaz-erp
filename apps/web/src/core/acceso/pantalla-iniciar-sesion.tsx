import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { iniciarSesion } from './api.ts';
import { AlertaDeError, ENLACE_EN_MENU, MarcoAcceso } from './marco-acceso.tsx';
import { mensajeDeError } from './mensajes.ts';
import { hayErrores, validarInicio, type Errores } from './validacion.ts';

export function PantallaIniciarSesion() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [errores, setErrores] = useState<Errores<'correo' | 'clave'>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const e = validarInicio({ correo, clave });
    setErrores(e);
    setFallo(null);
    if (hayErrores(e)) return;
    setEnviando(true);
    const r = await iniciarSesion({ correo, clave });
    if (r.ok) {
      // Recarga completa: la ruta raíz vuelve a pedir «yo» y la guarda decide el destino.
      window.location.assign('/');
      return;
    }
    setFallo('error' in r ? mensajeDeError(r.error.codigo, 'iniciar') : 'No se pudo iniciar sesión.');
    setEnviando(false);
  }

  return (
    <MarcoAcceso
      titulo="Iniciar sesión"
      subtitulo="Entra a la cuenta de tu negocio."
      pie={<>¿Aún no tienes cuenta? <Link to="/registro" className={ENLACE_EN_MENU}>Créala aquí</Link></>}
    >
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <AlertaDeError mensaje={fallo} />
        <Campo etiqueta="Correo" type="email" name="email" autoComplete="username" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} error={errores.correo} />
        <Campo etiqueta="Contraseña" type="password" name="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} error={errores.clave} />
        <Boton type="submit" variante="primario" tamano="grande" cargando={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Boton>
      </form>
    </MarcoAcceso>
  );
}
