import { useId, type SelectHTMLAttributes } from 'react';
import { ContenedorDeCampo } from './campo.tsx';
import { CLASES_DE_CONTROL, descritoPor } from './campo-comun.ts';
import { unir } from './unir.ts';

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta: string;
  error?: string;
  ayuda?: string;
};

/** Selector nativo: accesible y táctil sin trabajo extra. Las opciones van como `<option>`. */
export function CampoSelect({ etiqueta, error, ayuda, id, className, children, ...resto }: Props) {
  const propio = useId();
  const idCampo = id ?? propio;
  return (
    <ContenedorDeCampo id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <select
        id={idCampo}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(idCampo, error, ayuda)}
        className={unir(CLASES_DE_CONTROL, error ? 'border-peligro' : 'border-borde-fuerte', className)}
        {...resto}
      >
        {children}
      </select>
    </ContenedorDeCampo>
  );
}
