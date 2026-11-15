import { rutaSiguiente } from '../../shared/sesion/guarda.ts';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { registrarse } from './api.ts';
import { AlertaDeError, ENLACE_EN_MENU, MarcoAcceso } from './marco-acceso.tsx';
import { mensajeDeError } from './mensajes.ts';
import { LARGO_MIN_CLAVE, hayErrores, validarRegistro, type Errores } from './validacion.ts';

export function PantallaRegistro() {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [errores, setErrores] = useState<Errores<'nombre' | 'correo' | 'clave'>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const e = validarRegistro({ nombre, correo, clave });
    setErrores(e);
    setFallo(null);
    if (hayErrores(e)) return;
    setEnviando(true);
    const r = await registrarse({ nombre, correo, clave });
    if (r.ok) {
      // Al registrarse queda con sesión; la guarda lo lleva a crear su empresa (o a su inicio).
      window.location.assign(rutaSiguiente(window.location.search));
      return;
    }
    setFallo('error' in r ? mensajeDeError(r.error.codigo, 'registro') : 'No se pudo crear la cuenta.');
    setEnviando(false);
  }

  return (
    <MarcoAcceso
      titulo="Crear cuenta"
      subtitulo="Empieza con tus datos; después registras tu empresa."
      pie={<>¿Ya tienes cuenta? <Link to="/iniciar-sesion" className={ENLACE_EN_MENU}>Inicia sesión</Link></>}
    >
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <AlertaDeError mensaje={fallo} />
        <Campo etiqueta="Tu nombre" name="name" autoComplete="name" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} />
        <Campo etiqueta="Correo" type="email" name="email" autoComplete="username" inputMode="email" value={correo} onChange={(e) => setCorreo(e.target.value)} error={errores.correo} />
        <Campo
          etiqueta="Contraseña"
          type="password"
          name="password"
          autoComplete="new-password"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          error={errores.clave}
          ayuda={`Mínimo ${LARGO_MIN_CLAVE} caracteres. Puedes pegarla desde tu gestor de contraseñas.`}
        />
        <Boton type="submit" variante="primario" tamano="grande" cargando={enviando}>
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </Boton>
      </form>
    </MarcoAcceso>
  );
}
