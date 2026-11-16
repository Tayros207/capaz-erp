import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { validarMotivo } from './logica.ts';

type Props = {
  abierto: boolean;
  titulo: string;
  textoEnviar: string;
  /** Devuelve si se aplicó: solo entonces se cierra la hoja (la confirmación de dos pasos va dentro). */
  alEnviar: (motivo: string) => Promise<boolean>;
  alCerrar: () => void;
};

function Contenido({ textoEnviar, alEnviar, alCerrar }: Omit<Props, 'abierto' | 'titulo'>) {
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    const e = validarMotivo(texto);
    setError(e);
    if (e) return;
    setEnviando(true);
    const hecho = await alEnviar(texto.trim());
    setEnviando(false);
    if (hecho) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <CampoTextarea etiqueta="Motivo de la anulación" filas={3} maxLength={300} autoFocus value={texto} error={error} onChange={(e) => setTexto(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante="peligro" cargando={enviando}>{textoEnviar}</Boton>
      </div>
    </form>
  );
}

/** Pide el motivo de una anulación; el servidor devuelve después el resumen que la persona confirma. */
export function HojaMotivo({ abierto, titulo, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={titulo}>
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
