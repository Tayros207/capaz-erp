import { useState } from 'react';
import { Boton } from '../shared/ui/boton.tsx';
import { Campo } from '../shared/ui/campo.tsx';
import { HojaInferior } from '../shared/ui/hoja-inferior.tsx';
import { crearEmpresa } from './api.ts';
import { mensajeDeRechazo, validarEmpresa } from './logica.ts';

type Props = { abierto: boolean; alCerrar: () => void; alCambiar: () => void };

function Contenido({ alCerrar, alCambiar }: Omit<Props, 'abierto'>) {
  const [nombre, setNombre] = useState('');
  const [correo, setCorreo] = useState('');
  const [errores, setErrores] = useState<{ nombre?: string; correo?: string }>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const [creada, setCreada] = useState<string | null>(null);

  async function enviar() {
    const e = validarEmpresa(nombre, correo);
    setErrores(e);
    if (e.nombre || e.correo) return;
    setOcupado(true);
    setAviso(undefined);
    const r = await crearEmpresa({ nombre: nombre.trim(), correoDelDueno: correo.trim() });
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      setCreada(r.datos.nombre);
      alCambiar();
    } else if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  if (creada) {
    return (
      <div className="flex flex-col gap-3">
        <p>Empresa <strong>{creada}</strong> creada. Si la persona dueña aún no tiene cuenta, genera un enlace de restablecimiento desde la lista.</p>
        <div className="flex justify-end">
          <Boton variante="primario" onClick={alCerrar}>Listo</Boton>
        </div>
      </div>
    );
  }
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre de la empresa" required value={nombre} error={errores.nombre} onChange={(e) => setNombre(e.target.value)} />
        <Campo etiqueta="Correo de la persona dueña" type="email" inputMode="email" autoComplete="off" required value={correo} error={errores.correo} onChange={(e) => setCorreo(e.target.value)} />
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>Crear empresa</Boton>
      </div>
    </form>
  );
}

export function HojaEmpresaNueva({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Crear empresa">
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
