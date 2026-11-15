import { useId, useState, type InputHTMLAttributes } from 'react';
import type { Centimos } from '@capaz/shared';
import { centimosATexto, textoACentimos } from '../formato/soles.ts';
import { ContenedorDeCampo } from './campo.tsx';
import { CLASES_DE_CONTROL, descritoPor } from './campo-comun.ts';
import { unir } from './unir.ts';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'defaultValue'> & {
  etiqueta: string;
  /** Valor en céntimos enteros (regla 9), o nulo si está vacío. */
  valor: Centimos | null;
  alCambiar: (valor: Centimos | null) => void;
  error?: string;
  ayuda?: string;
};

/** Monto en soles. Quien escribe usa soles; el valor que entra y sale es siempre en céntimos. */
export function CampoMonto({ etiqueta, valor, alCambiar, error, ayuda, id, className, onBlur, onFocus, ...resto }: Props) {
  const propio = useId();
  const idCampo = id ?? propio;
  // Mientras se escribe se conserva el texto; al salir se normaliza a `1,234.50`.
  const [borrador, setBorrador] = useState<string | null>(null);
  const texto = borrador ?? (valor === null ? '' : centimosATexto(valor));
  const invalido = borrador !== null && borrador.trim() !== '' && textoACentimos(borrador) === null;
  const mensaje = error ?? (invalido ? 'Escribe un monto válido, por ejemplo 1,234.50.' : undefined);

  return (
    <ContenedorDeCampo id={idCampo} etiqueta={etiqueta} error={mensaje} ayuda={ayuda}>
      <div className="relative">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-texto-suave">
          S/
        </span>
        <input
          id={idCampo}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={texto}
          aria-invalid={mensaje ? true : undefined}
          aria-describedby={descritoPor(idCampo, mensaje, ayuda)}
          className={unir(CLASES_DE_CONTROL, 'pl-9 text-right tabular-nums', mensaje ? 'border-peligro' : 'border-borde-fuerte', className)}
          onFocus={(e) => {
            setBorrador(texto);
            onFocus?.(e);
          }}
          onChange={(e) => {
            setBorrador(e.target.value);
            const nuevo = textoACentimos(e.target.value);
            if (nuevo !== null || e.target.value.trim() === '') alCambiar(nuevo);
          }}
          onBlur={(e) => {
            setBorrador(null);
            onBlur?.(e);
          }}
          {...resto}
        />
      </div>
    </ContenedorDeCampo>
  );
}
