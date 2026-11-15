import { useState, type FormEvent } from 'react';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { cerrarSesion, crearEmpresa } from './api.ts';
import { AlertaDeError, MarcoAcceso } from './marco-acceso.tsx';
import { mensajeDeError } from './mensajes.ts';
import { LARGO_MAX_EMPRESA, hayErrores, validarEmpresa, type Errores } from './validacion.ts';

export function PantallaNuevaEmpresa() {
  const yo = useYo();
  const [nombre, setNombre] = useState('');
  const [errores, setErrores] = useState<Errores<'nombre'>>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function salir() {
    await cerrarSesion();
    window.location.assign('/');
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    const e = validarEmpresa(nombre);
    setErrores(e);
    setFallo(null);
    if (hayErrores(e)) return;
    setEnviando(true);
    const r = await crearEmpresa(nombre);
    if (r.ok) {
      window.location.assign('/inicio');
      return;
    }
    setFallo('error' in r ? mensajeDeError(r.error.codigo, 'empresa') : 'No se pudo crear la empresa.');
    setEnviando(false);
  }

  const pie = <button type="button" onClick={salir} className="font-semibold underline underline-offset-2">Cerrar sesión</button>;

  if (yo && !yo.puedeCrearEmpresas) {
    return (
      <MarcoAcceso titulo="Tu empresa" pie={pie}>
        <p className="text-texto">Tu cuenta aún no tiene empresa: acepta una invitación o pide a Capaz que la cree.</p>
      </MarcoAcceso>
    );
  }

  return (
    <MarcoAcceso titulo="Registra tu empresa" subtitulo="Será el espacio donde trabaja tu equipo. Podrás cambiar el nombre después." pie={pie}>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <AlertaDeError mensaje={fallo} />
        <Campo etiqueta="Nombre de la empresa" name="organization" autoComplete="organization" maxLength={LARGO_MAX_EMPRESA} value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} />
        <Boton type="submit" variante="primario" tamano="grande" cargando={enviando}>
          {enviando ? 'Creando…' : 'Crear empresa'}
        </Boton>
      </form>
    </MarcoAcceso>
  );
}
