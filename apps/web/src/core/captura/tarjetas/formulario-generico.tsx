import { useState } from 'react';
import { argumentosCorregidos, formularioDeCorreccion } from '../../bandeja/logica.ts';
import { FormularioCorreccion } from '../../bandeja/formulario-correccion.tsx';
import type { PropsDeFormulario } from './tipos.ts';

/** Herramienta sin tarjeta propia: el formulario genérico de la bandeja, campo por campo. */
export function FormularioGenerico({ args, alCambiar, alInvalidar, deshabilitado }: PropsDeFormulario) {
  const [original] = useState(args);
  const [valores, setValores] = useState(() => formularioDeCorreccion(args));
  const [errores, setErrores] = useState<Record<string, string>>({});

  function cambiar(clave: string, valor: string) {
    const nuevos = { ...valores, [clave]: valor };
    setValores(nuevos);
    const r = argumentosCorregidos(original, nuevos);
    if (r.ok) {
      setErrores({});
      alInvalidar(false);
      alCambiar(r.args);
    } else {
      setErrores(r.errores);
      alInvalidar(true);
    }
  }

  return (
    <fieldset disabled={deshabilitado}>
      <FormularioCorreccion original={original} valores={valores} errores={errores} alCambiar={cambiar} />
    </fieldset>
  );
}
