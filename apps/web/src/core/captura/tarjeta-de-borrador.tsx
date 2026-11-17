import { useRef, useState } from 'react';
import type { CapturaPropuesta } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { aprobarBorrador, corregirBorrador, descartarBorrador } from '../bandeja/api.ts';
import { mensajeDeRechazo, mensajeDeRechazoAlAprobar, titularDeHerramienta } from '../bandeja/logica.ts';
import { comoArgs, sinCambios, type ArgsEditables } from './logica-tarjeta.ts';
import { FormularioDeudaAbonar } from './tarjetas/formulario-deuda-abonar.tsx';
import { FormularioDeudaCrear } from './tarjetas/formulario-deuda-crear.tsx';
import { FormularioGenerico } from './tarjetas/formulario-generico.tsx';
import { FormularioMovimiento } from './tarjetas/formulario-movimiento.tsx';
import type { PropsDeFormulario } from './tarjetas/tipos.ts';

export type PropuestaDeCaptura = CapturaPropuesta['borradores'][number];
export type Resolucion = 'aprobado' | 'descartado' | 'despues';

function Formulario({ herramienta, ...props }: PropsDeFormulario & { herramienta: string }) {
  switch (herramienta) {
    case 'movimiento_registrar':
      return <FormularioMovimiento {...props} />;
    case 'deuda_abonar':
      return <FormularioDeudaAbonar {...props} />;
    case 'deuda_crear':
      return <FormularioDeudaCrear {...props} conAdelanto={false} />;
    case 'deuda_crear_con_adelanto':
      return <FormularioDeudaCrear {...props} conAdelanto />;
    default:
      return <FormularioGenerico {...props} />;
  }
}

type Props = { propuesta: PropuestaDeCaptura; alResolver: (id: string, resolucion: Resolucion) => void };

/** Un borrador propuesto: se revisa con nombres (no identificadores) y se aprueba, se deja para después o se descarta. */
export function TarjetaDeBorrador({ propuesta, alResolver }: Props) {
  const [args, setArgs] = useState<ArgsEditables>(() => comoArgs(propuesta.args));
  // Lo último que el servidor tiene guardado: tras corregir, la siguiente comparación parte de ahí.
  const guardado = useRef<ArgsEditables>(comoArgs(propuesta.args));
  const [invalido, setInvalido] = useState(false);
  const [ocupado, setOcupado] = useState<null | 'aprobar' | 'descartar'>(null);
  const [fallo, setFallo] = useState('');
  const enCurso = useRef(false);

  async function aprobar() {
    if (enCurso.current || invalido) return;
    enCurso.current = true;
    setOcupado('aprobar');
    setFallo('');
    try {
      // Sin cambios no se corrige: `borrador_corregir` marcaría «corregido» y falsearía la medición.
      if (!sinCambios(guardado.current, args)) {
        const c = await corregirBorrador(propuesta.id, args);
        if (!(c.ok && 'datos' in c)) {
          if ('error' in c) setFallo(mensajeDeRechazo(c.error.codigo, c.error.mensaje));
          return;
        }
        guardado.current = args;
      }
      const r = await aprobarBorrador(propuesta.id, propuesta.resumen || titularDeHerramienta(propuesta.herramienta));
      if ('cancelada' in r) return;
      if (r.ok && 'datos' in r) alResolver(propuesta.id, 'aprobado');
      else if ('error' in r) setFallo(mensajeDeRechazoAlAprobar(r.error.codigo, r.error.mensaje));
      else setFallo('El servidor pidió una confirmación que no se pudo completar. El borrador sigue pendiente.');
    } finally {
      enCurso.current = false;
      setOcupado(null);
    }
  }

  async function descartar() {
    if (enCurso.current) return;
    enCurso.current = true;
    setOcupado('descartar');
    setFallo('');
    try {
      const r = await descartarBorrador(propuesta.id, 'Dictado descartado');
      if (r.ok && 'datos' in r) alResolver(propuesta.id, 'descartado');
      else if ('error' in r) setFallo(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    } finally {
      enCurso.current = false;
      setOcupado(null);
    }
  }

  return (
    <article aria-label={propuesta.resumen} className="flex flex-col gap-4 rounded-tarjeta border border-borde bg-superficie p-4">
      <header className="flex flex-col gap-0.5">
        <p className="text-sm text-texto-suave">{titularDeHerramienta(propuesta.herramienta)}</p>
        <h3 className="font-titulo text-base font-semibold text-texto">{propuesta.resumen}</h3>
      </header>
      <Formulario herramienta={propuesta.herramienta} args={args} sugerencias={propuesta.sugerencias} alCambiar={setArgs} alInvalidar={setInvalido} deshabilitado={ocupado !== null} />
      {fallo ? <p role="alert" className="rounded-control border border-peligro/40 bg-peligro/10 p-3 text-sm font-medium text-peligro">{fallo}</p> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Boton variante="primario" tamano="grande" icono="check" cargando={ocupado === 'aprobar'} disabled={ocupado !== null || invalido} onClick={() => void aprobar()}>Aprobar</Boton>
        <Boton tamano="grande" disabled={ocupado !== null} onClick={() => alResolver(propuesta.id, 'despues')}>Después</Boton>
        <Boton variante="peligro" tamano="grande" cargando={ocupado === 'descartar'} disabled={ocupado !== null} onClick={() => void descartar()}>Descartar</Boton>
      </div>
    </article>
  );
}
