import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { perderOportunidad } from './api.ts';
import { useEscribir } from './acciones.ts';

type Props = { oportunidad: { id: string; titulo: string } | null; alCerrar: () => void };

/** Pide el motivo y marca la oportunidad como perdida. */
export function HojaPerdida({ oportunidad, alCerrar }: Props) {
  const escribir = useEscribir();
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  function cerrar() {
    setMotivo('');
    setError(undefined);
    alCerrar();
  }

  async function guardar() {
    if (!oportunidad) return;
    if (!motivo.trim()) {
      setError('Indica el motivo.');
      return;
    }
    setEnviando(true);
    const r = await escribir(perderOportunidad(oportunidad.id, motivo.trim()), 'Oportunidad marcada como perdida.');
    setEnviando(false);
    if (r) cerrar();
  }

  return (
    <HojaInferior abierto={oportunidad !== null} alCerrar={cerrar} titulo={`Perdida: ${oportunidad?.titulo ?? ''}`}>
      <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
        <CampoTextarea etiqueta="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} error={error} filas={3} maxLength={300} />
        <Boton variante="peligro" type="submit" cargando={enviando}>Marcar como perdida</Boton>
      </form>
    </HojaInferior>
  );
}
