import { useState } from 'react';
import { formatearSoles, type AdelantoDto } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoTextarea } from '../../shared/ui/campo-textarea.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { resolverAccion } from './acciones.ts';
import { anularAdelanto } from './api.ts';
import { ETIQUETA_DE_ADELANTO, formatearDia, TONO_DE_ADELANTO } from './logica.ts';

type Props = { adelanto: AdelantoDto | null; puedeAnular: boolean; alCerrar: () => void };

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

function Contenido({ adelanto, puedeAnular, alCerrar }: { adelanto: AdelantoDto; puedeAnular: boolean; alCerrar: () => void }) {
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [enviando, setEnviando] = useState(false);

  async function anular() {
    if (!motivo.trim()) return setError('Indica el motivo de la anulación.');
    setEnviando(true);
    const r = await anularAdelanto(adelanto.id, motivo.trim());
    setEnviando(false);
    if (await resolverAccion(r, 'Adelanto anulado.')) alCerrar();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-titulo text-2xl font-semibold tabular-nums text-texto">{formatearSoles(adelanto.montoCentimos)}</span>
        <Insignia tono={TONO_DE_ADELANTO[adelanto.estado]}>{ETIQUETA_DE_ADELANTO[adelanto.estado]}</Insignia>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato etiqueta="Colaborador" valor={adelanto.colaboradorNombre} />
        <Dato etiqueta="Fecha" valor={formatearDia(adelanto.fecha)} />
        <Dato etiqueta="Motivo" valor={adelanto.motivo} />
        {adelanto.estado === 'anulado' ? <Dato etiqueta="Anulado" valor={`${adelanto.anuladoEn ? formatearFechaHora(adelanto.anuladoEn) : ''} · ${adelanto.motivoAnulacion ?? ''}`} /> : null}
      </dl>
      {anulando ? (
        <form noValidate className="flex flex-col gap-3" onSubmit={(ev) => { ev.preventDefault(); void anular(); }}>
          <CampoTextarea autoFocus etiqueta="Motivo de la anulación" filas={3} maxLength={300} value={motivo} error={error} onChange={(e) => setMotivo(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Boton variante="fantasma" onClick={() => setAnulando(false)}>Volver</Boton>
            <Boton type="submit" variante="peligro" cargando={enviando}>Continuar</Boton>
          </div>
        </form>
      ) : (
        <div className="flex justify-end gap-2">
          <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
          {puedeAnular && adelanto.estado === 'registrado' ? <Boton variante="peligro" onClick={() => setAnulando(true)}>Anular adelanto</Boton> : null}
        </div>
      )}
    </div>
  );
}

/** El detalle de un adelanto y, con permiso, su anulación (pide el motivo y después confirmar). Nunca se borra. */
export function HojaDeAdelanto({ adelanto, puedeAnular, alCerrar }: Props) {
  return (
    <HojaInferior abierto={adelanto !== null} alCerrar={alCerrar} titulo={adelanto?.codigo ?? 'Adelanto'}>
      {adelanto ? <Contenido key={`${adelanto.id}-${adelanto.estado}`} adelanto={adelanto} puedeAnular={puedeAnular} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
