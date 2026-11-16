import { useId, useState, type InputHTMLAttributes } from 'react';
import { textoAMilesimas } from '../formato/milesimas.ts';
import { ContenedorDeCampo } from './campo.tsx';
import { CLASES_DE_CONTROL, descritoPor } from './campo-comun.ts';
import { unir } from './unir.ts';

export type PropsDeMilesimas = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue' | 'prefix'> & {
  etiqueta: string;
  /** Valor en milésimas enteras, o nulo si está vacío. */
  valor: number | null;
  alCambiar: (valor: number | null) => void;
  error?: string;
  ayuda?: string;
};

/** Base de `CampoCantidad` y `CampoPrecio`: texto con hasta tres decimales que entra y sale en milésimas. */
export function CampoDeMilesimas({
  etiqueta,
  valor,
  alCambiar,
  error,
  ayuda,
  id,
  className,
  onBlur,
  onFocus,
  prefijo,
  sufijo,
  textoDe,
  mensajeInvalido,
  ...resto
}: PropsDeMilesimas & {
  prefijo?: string;
  sufijo?: string;
  textoDe: (milesimas: number) => string;
  mensajeInvalido: string;
}) {
  const propio = useId();
  const idCampo = id ?? propio;
  // Mientras se escribe se conserva el texto; al salir se normaliza.
  const [borrador, setBorrador] = useState<string | null>(null);
  const texto = borrador ?? (valor === null ? '' : textoDe(valor));
  const invalido = borrador !== null && borrador.trim() !== '' && textoAMilesimas(borrador) === null;
  const mensaje = error ?? (invalido ? mensajeInvalido : undefined);
  const decoracion = 'pointer-events-none absolute inset-y-0 flex items-center text-texto-suave';

  return (
    <ContenedorDeCampo id={idCampo} etiqueta={etiqueta} error={mensaje} ayuda={ayuda}>
      <div className="relative">
        {prefijo ? (
          <span aria-hidden="true" className={unir(decoracion, 'left-3')}>
            {prefijo}
          </span>
        ) : null}
        <input
          id={idCampo}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={texto}
          aria-invalid={mensaje ? true : undefined}
          aria-describedby={descritoPor(idCampo, mensaje, ayuda)}
          className={unir(
            CLASES_DE_CONTROL,
            'text-right tabular-nums',
            prefijo ? 'pl-9' : '',
            sufijo ? 'pr-12' : '',
            mensaje ? 'border-peligro' : 'border-borde-fuerte',
            className,
          )}
          onFocus={(e) => {
            setBorrador(texto);
            onFocus?.(e);
          }}
          onChange={(e) => {
            setBorrador(e.target.value);
            const nuevo = textoAMilesimas(e.target.value);
            if (nuevo !== null || e.target.value.trim() === '') alCambiar(nuevo);
          }}
          onBlur={(e) => {
            setBorrador(null);
            onBlur?.(e);
          }}
          {...resto}
        />
        {sufijo ? (
          <span aria-hidden="true" className={unir(decoracion, 'right-3')}>
            {sufijo}
          </span>
        ) : null}
      </div>
    </ContenedorDeCampo>
  );
}
