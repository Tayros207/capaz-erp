import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';

type Props = { abierto: boolean; avisos: readonly string[]; alAceptar: () => Promise<boolean>; alCerrar: () => void };

function Contenido({ avisos, alAceptar, alCerrar }: Omit<Props, 'abierto'>) {
  const [enviando, setEnviando] = useState(false);
  async function aceptar() {
    setEnviando(true);
    const hecho = await alAceptar();
    setEnviando(false);
    if (hecho) alCerrar();
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-texto">Los precios de lista cambiaron desde que armaste esta cotización. Si la emites, se usan los de hoy:</p>
      <ul className="list-disc pl-5 text-sm text-texto">{avisos.map((a) => <li key={a} className="break-words">{a}</li>)}</ul>
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>No emitir</Boton>
        <Boton variante="primario" cargando={enviando} onClick={() => void aceptar()}>Emitir con los precios de hoy</Boton>
      </div>
    </div>
  );
}

/** Emitir con precios de lista distintos a los guardados exige aceptarlos: la persona ve cuánto cambió cada uno. */
export function HojaPreciosDeHoy({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Los precios cambiaron">
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
