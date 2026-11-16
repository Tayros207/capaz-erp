import { useId, type TextareaHTMLAttributes } from 'react';
import { ContenedorDeCampo } from './campo.tsx';
import { descritoPor } from './campo-comun.ts';
import { unir } from './unir.ts';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  etiqueta: string;
  error?: string;
  ayuda?: string;
  filas?: number;
};

/** Texto de varias líneas, con etiqueta, ayuda y error asociados como el resto de campos. */
export function CampoTextarea({ etiqueta, error, ayuda, filas = 4, id, className, ...resto }: Props) {
  const propio = useId();
  const idCampo = id ?? propio;
  return (
    <ContenedorDeCampo id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <textarea
        id={idCampo}
        rows={filas}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(idCampo, error, ayuda)}
        className={unir(
          'min-h-(--alto-control) w-full resize-y rounded-control border bg-superficie px-3 py-2 text-texto ' +
            'placeholder:text-texto-suave disabled:cursor-not-allowed disabled:opacity-60',
          error ? 'border-peligro' : 'border-borde-fuerte',
          className,
        )}
        {...resto}
      />
    </ContenedorDeCampo>
  );
}
