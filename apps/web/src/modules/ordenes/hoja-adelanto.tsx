import { useState } from 'react';
import { Link } from 'react-router';
import { centimosSchema, type Centimos } from '@capaz/shared';
import { formatearSoles } from '../../shared/formato/soles.ts';
import { notificar } from '../../shared/ui/notificar.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { ETIQUETA_DE_MEDIO, sugerirAdelanto, validarAdelanto, type MedioDePago, type ResultadoDelAdelanto } from './adelanto.ts';

type Props = {
  abierto: boolean;
  totalCentimos: number;
  /** Confirma (y cobra el adelanto si se marcó). `null` si no se pudo ni empezar (p. ej. el borrador no se guardó). */
  alAceptar: (adelanto: { montoCentimos: number; medio: MedioDePago } | null) => Promise<ResultadoDelAdelanto | null>;
  alCerrar: () => void;
};

/** Solo se muestra cuando algo quedó a medias: lo completo se cierra con un aviso. */
function Resultado({ r, alCerrar }: { r: ResultadoDelAdelanto; alCerrar: () => void }) {
  const deuda = 'deuda' in r ? r.deuda : null;
  return (
    <div className="flex flex-col gap-4">
      <p role={r.estado === 'completo' ? 'status' : 'alert'} className={r.estado === 'completo' ? 'text-texto' : 'font-medium text-peligro'}>{r.mensaje}</p>
      <div className="flex flex-wrap justify-end gap-2">
        {deuda ? <Link to={`/m/registro/deudas/${deuda.id}`} className="inline-flex min-h-(--alto-control) items-center rounded-control px-3 font-medium text-accion underline">Ver la deuda {deuda.codigo}</Link> : null}
        <Boton variante="primario" onClick={alCerrar}>Listo</Boton>
      </div>
    </div>
  );
}

function Formulario({ totalCentimos, alAceptar, alCerrar, alTerminar }: Omit<Props, 'abierto'> & { alTerminar: (r: ResultadoDelAdelanto) => void }) {
  const [cobrar, setCobrar] = useState(false);
  const [monto, setMonto] = useState<Centimos | null>(() => centimosSchema.parse(sugerirAdelanto(totalCentimos)));
  const [medio, setMedio] = useState<MedioDePago>('efectivo');
  const [enviando, setEnviando] = useState(false);
  const error = cobrar ? validarAdelanto(monto, totalCentimos) : null;

  async function enviar() {
    if (error) return;
    setEnviando(true);
    const r = await alAceptar(cobrar && monto !== null ? { montoCentimos: monto, medio } : null);
    setEnviando(false);
    if (r && r.estado !== 'completo') alTerminar(r);
    else {
      if (r) notificar(r.mensaje, 'exito');
      alCerrar();
    }
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <label className="flex min-h-(--alto-control) cursor-pointer items-center gap-3">
        <input type="checkbox" checked={cobrar} onChange={(e) => setCobrar(e.target.checked)} className="size-5 cursor-pointer accent-accion" />
        <span className="font-medium text-texto">Cobrar adelanto ahora</span>
      </label>
      {cobrar ? (
        <div className="flex flex-col gap-3">
          <CampoMonto etiqueta="Monto del adelanto" valor={monto} alCambiar={setMonto} error={error ?? undefined} ayuda={`Sugerido: el 50 % de ${formatearSoles(totalCentimos)}.`} />
          <CampoSelect etiqueta="Medio de pago" value={medio} onChange={(e) => setMedio(e.target.value as MedioDePago)}>
            {(Object.keys(ETIQUETA_DE_MEDIO) as MedioDePago[]).map((m) => <option key={m} value={m}>{ETIQUETA_DE_MEDIO[m]}</option>)}
          </CampoSelect>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Volver</Boton>
        <Boton type="submit" variante="primario" cargando={enviando} disabled={!!error}>{cobrar ? 'Confirmar y cobrar adelanto' : 'Confirmar pedido'}</Boton>
      </div>
    </form>
  );
}

/** Hoja de confirmación con la casilla opcional «Cobrar adelanto ahora». */
export function HojaAdelanto({ abierto, ...resto }: Props) {
  const [resultado, setResultado] = useState<ResultadoDelAdelanto | null>(null);
  const cerrar = () => { setResultado(null); resto.alCerrar(); };
  return (
    <HojaInferior abierto={abierto} alCerrar={cerrar} titulo="Confirmar pedido">
      {!abierto ? null : resultado ? <Resultado r={resultado} alCerrar={cerrar} /> : <Formulario {...resto} alCerrar={cerrar} alTerminar={setResultado} />}
    </HojaInferior>
  );
}
