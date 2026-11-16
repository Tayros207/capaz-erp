import { useState } from 'react';
import type { EstadoDeAsistencia } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { resolverAccion } from './acciones.ts';
import { corregirAsistencia } from './api.ts';
import { ETIQUETA_DE_ESTADO, formatearDia } from './logica.ts';

export type CorreccionPedida = { colaboradorId: string; nombre: string; fecha: string; estado: EstadoDeAsistencia };
type Props = { correccion: CorreccionPedida | null; alCerrar: () => void };

function Contenido({ correccion, alCerrar }: { correccion: CorreccionPedida; alCerrar: () => void }) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (!motivo.trim()) return setError('Indica el motivo de la corrección.');
    setEnviando(true);
    const r = await corregirAsistencia({ colaboradorId: correccion.colaboradorId, fecha: correccion.fecha, estado: correccion.estado, motivo: motivo.trim() });
    setEnviando(false);
    if (await resolverAccion(r, 'Asistencia corregida.')) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <p className="text-texto">
        <span className="font-medium">{correccion.nombre}</span> el {formatearDia(correccion.fecha)}: <span className="font-medium">{ETIQUETA_DE_ESTADO[correccion.estado]}</span>.
        Un día pasado se corrige con motivo y queda anotado.
      </p>
      <CampoTextarea autoFocus etiqueta="Motivo de la corrección" filas={3} maxLength={300} value={motivo} error={error} onChange={(e) => setMotivo(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante="primario" cargando={enviando}>Continuar</Boton>
      </div>
    </form>
  );
}

/** Corrección de la asistencia de un día pasado: pide el motivo y después el servidor pide confirmar. */
export function HojaDeCorreccion({ correccion, alCerrar }: Props) {
  return (
    <HojaInferior abierto={correccion !== null} alCerrar={alCerrar} titulo="Corregir asistencia">
      {correccion ? <Contenido key={`${correccion.colaboradorId}-${correccion.fecha}-${correccion.estado}`} correccion={correccion} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
