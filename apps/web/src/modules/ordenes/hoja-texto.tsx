import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';

type Props = {
  abierto: boolean;
  titulo: string;
  etiqueta: string;
  textoEnviar: string;
  maximo: number;
  peligroso?: boolean;
  /** Devuelve si se aplicó: solo entonces se cierra la hoja. */
  alEnviar: (texto: string) => Promise<boolean>;
  alCerrar: () => void;
};

function Contenido({ etiqueta, textoEnviar, maximo, peligroso, alEnviar, alCerrar }: Omit<Props, 'abierto' | 'titulo'>) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!texto.trim()) {
      setError('Escribe algo antes de continuar.');
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
      <CampoTextarea etiqueta={etiqueta} filas={3} maxLength={maximo} value={texto} error={error} onChange={(e) => setTexto(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante={peligroso ? 'peligro' : 'primario'} cargando={enviando}>{textoEnviar}</Boton>
      </div>
    </form>
  );
}

/** Hoja con un solo texto obligatorio: la nota del historial o el motivo de la cancelación. */
export function HojaTexto({ abierto, titulo, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={titulo}>
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
