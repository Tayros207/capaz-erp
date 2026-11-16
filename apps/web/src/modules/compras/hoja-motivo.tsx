import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';

type Props = {
  abierto: boolean;
  /** Devuelve si se aplicó: solo entonces se cierra la hoja. */
  alEnviar: (motivo: string) => Promise<boolean>;
  alCerrar: () => void;
};

function Contenido({ alEnviar, alCerrar }: Omit<Props, 'abierto'>) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!texto.trim()) {
      setError('Escribe el motivo antes de continuar.');
      return;
    }
    setEnviando(true);
    const hecho = await alEnviar(texto.trim());
    setEnviando(false);
    if (hecho) alCerrar();
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        void enviar();
      }}
    >
      <CampoTextarea etiqueta="Motivo de la cancelación" filas={3} maxLength={300} value={texto} error={error} onChange={(e) => setTexto(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante="peligro" cargando={enviando}>Continuar</Boton>
      </div>
    </form>
  );
}

/** Hoja para el motivo de la cancelación; después el servidor pide confirmar su resumen. */
export function HojaMotivo({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Cancelar orden de compra">
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
