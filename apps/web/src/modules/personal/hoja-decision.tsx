import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';

type Props = {
  abierto: boolean;
  titulo: string;
  etiqueta: string;
  textoBoton: string;
  peligro?: boolean;
  /** Devuelve si se aplicó: solo entonces se cierra la hoja. */
  alEnviar: (motivo: string) => Promise<boolean>;
  alCerrar: () => void;
};

function Contenido({ etiqueta, textoBoton, peligro, alEnviar, alCerrar }: Omit<Props, 'abierto' | 'titulo'>) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!texto.trim()) return setError('Escribe el motivo antes de continuar.');
    setEnviando(true);
    const hecho = await alEnviar(texto.trim());
    setEnviando(false);
    if (hecho) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <CampoTextarea etiqueta={etiqueta} filas={3} maxLength={300} value={texto} error={error} onChange={(e) => setTexto(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante={peligro ? 'peligro' : 'primario'} cargando={enviando}>{textoBoton}</Boton>
      </div>
    </form>
  );
}

/** Hoja que pide un motivo (rechazar una solicitud, anular una solicitud o una factura). */
export function HojaDeDecision({ abierto, titulo, ...resto }: Props) {
  return <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={titulo}>{abierto ? <Contenido {...resto} /> : null}</HojaInferior>;
}
