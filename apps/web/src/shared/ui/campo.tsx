import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { CLASES_DE_CONTROL, descritoPor } from './campo-comun.ts';
import { unir } from './unir.ts';

/** Rodea un control con su etiqueta, ayuda y error, todo asociado por `id` y `aria-describedby`. */
export function ContenedorDeCampo({
  id,
  etiqueta,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-texto">
        {etiqueta}
      </label>
      {children}
      {ayuda && !error ? (
        <p id={`${id}-ayuda`} className="text-sm text-texto-suave">
          {ayuda}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm font-medium text-peligro">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type Props = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  error?: string;
  ayuda?: string;
};

export function Campo({ etiqueta, error, ayuda, id, className, ...resto }: Props) {
  const propio = useId();
  const idCampo = id ?? propio;
  return (
    <ContenedorDeCampo id={idCampo} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <input
        id={idCampo}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor(idCampo, error, ayuda)}
        className={unir(CLASES_DE_CONTROL, error ? 'border-peligro' : 'border-borde-fuerte', className)}
        {...resto}
      />
    </ContenedorDeCampo>
  );
}
