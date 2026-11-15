import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { validarMotivo } from './logica.ts';

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  alDescartar: (motivo: string) => void;
  descartando: boolean;
  errorDelServidor?: string;
};

export function HojaDescartar({ abierto, alCerrar, alDescartar, descartando, errorDelServidor }: Props) {
  const [motivo, setMotivo] = useState('');
  const [intento, setIntento] = useState(false);
  const error = intento ? validarMotivo(motivo) : undefined;

  function enviar() {
    setIntento(true);
    if (validarMotivo(motivo)) return;
    alDescartar(motivo.trim());
  }

  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Descartar borrador">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <Campo etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} error={error ?? errorDelServidor} maxLength={500} autoComplete="off" ayuda="Queda registrado junto al borrador." />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Boton variante="fantasma" onClick={alCerrar} disabled={descartando}>Cancelar</Boton>
          <Boton type="submit" variante="peligro" cargando={descartando}>Descartar</Boton>
        </div>
      </form>
    </HojaInferior>
  );
}
