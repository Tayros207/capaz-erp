import { useState } from 'react';
import { DESTINOS_DEL_ADELANTO, formatearSoles } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';

type Destino = (typeof DESTINOS_DEL_ADELANTO)[number];
type Props = {
  abierto: boolean;
  codigo: string;
  adelantoCentimos: number;
  /** Devuelve si se aplicó: solo entonces se cierra la hoja. */
  alEnviar: (motivo: string, destino: Destino | undefined) => Promise<boolean>;
  alCerrar: () => void;
};

const TEXTO_DE_DESTINO: Record<Destino, string> = { devuelto: 'Se lo devolví', retenido: 'Me lo quedo, ya gasté en el trabajo' };

function Contenido({ adelantoCentimos, alEnviar, alCerrar }: Omit<Props, 'abierto' | 'codigo'>) {
  const [motivo, setMotivo] = useState('');
  const [destino, setDestino] = useState<Destino | ''>('');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!motivo.trim()) return setError('Escribe el motivo antes de continuar.');
    if (adelantoCentimos > 0 && !destino) return setError('Di si se devolvió el adelanto o si te lo quedas.');
    setEnviando(true);
    const hecho = await alEnviar(motivo.trim(), destino || undefined);
    setEnviando(false);
    if (hecho) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      {adelantoCentimos > 0 ? (
        <CampoSelect etiqueta={`El cliente ya dejó ${formatearSoles(adelantoCentimos)} a cuenta`} value={destino} onChange={(e) => setDestino(e.target.value as Destino | '')}>
          <option value="">¿Qué pasó con ese adelanto?</option>
          {DESTINOS_DEL_ADELANTO.map((d) => <option key={d} value={d}>{TEXTO_DE_DESTINO[d]}</option>)}
        </CampoSelect>
      ) : null}
      <CampoTextarea etiqueta="Motivo de la anulación" filas={3} maxLength={300} value={motivo} error={error} onChange={(e) => setMotivo(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Mejor no cancelo</Boton>
        <Boton type="submit" variante="peligro" cargando={enviando}>Sí, anular</Boton>
      </div>
    </form>
  );
}

/** Hoja para anular una orden: el motivo y, si hay adelanto, qué se hizo con él. */
export function HojaDeAnular({ abierto, codigo, ...resto }: Props) {
  return <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={`Anular ${codigo}`}>{abierto ? <Contenido {...resto} /> : null}</HojaInferior>;
}
