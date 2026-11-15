import { useState } from 'react';
import type { Regla } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { guardarRegla } from './api.ts';
import { argumentosDeGuardado, mensajeDeRechazo, type ErroresDeRegla, type FormularioDeRegla } from './logica.ts';
import { PasoAcciones, PasoCondiciones, PasoDisparador, PasoModo, Tarjeta } from './pasos-de-regla.tsx';

type Props = {
  inicial: FormularioDeRegla;
  reglaId?: string;
  soloLectura: boolean;
  alGuardar: (regla: Regla) => void;
  alCambiar?: (form: FormularioDeRegla) => void;
};

/** Formulario guiado en cuatro pasos: disparador, condiciones, acciones y modo. */
export function FormularioRegla({ inicial, reglaId, soloLectura, alGuardar, alCambiar }: Props) {
  const [form, setForm] = useState(inicial);
  const [errores, setErrores] = useState<ErroresDeRegla>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  const poner = (parte: Partial<FormularioDeRegla>) => {
    const nuevo = { ...form, ...parte };
    setForm(nuevo);
    alCambiar?.(nuevo);
  };

  async function guardar() {
    const r = argumentosDeGuardado(form, reglaId);
    setErrores(r.ok ? {} : r.errores);
    if (!r.ok) return;
    setOcupado(true);
    setAviso(undefined);
    const resp = await guardarRegla(r.args as Parameters<typeof guardarRegla>[0]);
    setOcupado(false);
    if (resp.ok && 'datos' in resp) alGuardar(resp.datos);
    else if ('error' in resp) setAviso(mensajeDeRechazo(resp.error.codigo, resp.error.mensaje));
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
      <fieldset disabled={ocupado || soloLectura} className="flex min-w-0 flex-col gap-4">
        <Tarjeta numero={0} titulo="Nombre" ayuda="Cómo reconocerás la regla en la lista.">
          <Campo etiqueta="Nombre de la regla" value={form.nombre} error={errores.nombre} autoComplete="off" onChange={(e) => poner({ nombre: e.target.value })} />
          <Campo etiqueta="Descripción (opcional)" value={form.descripcion} autoComplete="off" onChange={(e) => poner({ descripcion: e.target.value })} />
        </Tarjeta>
        <PasoDisparador form={form} errores={errores} poner={poner} />
        <PasoCondiciones form={form} errores={errores} poner={poner} />
        <PasoAcciones form={form} errores={errores} poner={poner} />
        <PasoModo form={form} errores={errores} poner={poner} />
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      {soloLectura ? null : (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-borde bg-fondo py-3">
          <Boton type="submit" variante="primario" cargando={ocupado}>Guardar regla</Boton>
        </div>
      )}
    </form>
  );
}
