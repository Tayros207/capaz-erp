import { useState } from 'react';
import { centimosSchema, type Centimos } from '@capaz/shared';
import { Boton } from '../../../shared/ui/boton.tsx';
import { CampoMonto } from '../../../shared/ui/campo-monto.tsx';
import { HojaInferior } from '../../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { fijarCostoDirecto } from './api-cuadro.ts';
import { ETIQUETA_DE_COLUMNA, LEYENDA_DE_ORIGEN, textoDeImporte, type Columna, type FilaDirecta } from './logica-cuadro.ts';
import { argumentosDeCelda } from './logica-cuadro-precio.ts';
import type { ContextoDelCuadro } from './use-cuadro.ts';

export type CeldaEnHoja = { fila: FilaDirecta; columna: Columna };
type Props = { ctx: ContextoDelCuadro; celda: CeldaEnHoja; alCerrar: () => void };

function Contenido({ ctx, celda, alCerrar }: Props) {
  const c = celda.fila.celdas[celda.columna];
  const [valor, setValor] = useState<Centimos | null>(c.valorCentimos === null ? null : centimosSchema.parse(c.valorCentimos));
  const [ocupado, setOcupado] = useState(false);
  const leyenda = LEYENDA_DE_ORIGEN[c.origen];

  async function enviar(importe: number | null) {
    setOcupado(true);
    const hecho = await ctx.aplicar(fijarCostoDirecto(argumentosDeCelda(ctx.id, celda.fila, celda.columna, importe)));
    setOcupado(false);
    if (hecho) alCerrar();
  }
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void enviar(valor); }}>
      <div className="flex flex-wrap items-center gap-2"><Insignia tono={leyenda.tono}>{leyenda.marca}</Insignia><span className="text-sm text-texto-suave">{leyenda.frase}</span></div>
      {c.delDetalleCentimos !== null ? <p className="text-sm text-texto-suave">Según el cuadro por factor: {textoDeImporte(c.delDetalleCentimos)}.</p> : null}
      {c.desde ? <p className="text-sm text-texto-suave">Deducido desde la cantidad {ETIQUETA_DE_COLUMNA[c.desde]}.</p> : null}
      {c.motivo ? <p role="status" className="text-sm font-medium text-aviso">{c.motivo}</p> : null}
      <CampoMonto etiqueta={`Costo de «${celda.fila.nombre}» para ${ETIQUETA_DE_COLUMNA[celda.columna]}`} valor={valor} alCambiar={setValor} ayuda="Sin IGV. Déjalo vacío para volver al valor calculado." />
      <div className="flex flex-wrap justify-end gap-2">
        {c.origen === 'mano' ? <Boton variante="secundario" onClick={() => void enviar(null)}>Quitar el valor a mano</Boton> : null}
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado} disabled={valor === null}>Guardar</Boton>
      </div>
    </form>
  );
}

/** Hoja para escribir a mano una celda del cuadro directo. `celda` nula = cerrada. */
export function HojaDeCelda({ celda, ...resto }: Omit<Props, 'celda'> & { celda: CeldaEnHoja | null }) {
  return (
    <HojaInferior abierto={celda !== null} alCerrar={resto.alCerrar} titulo="Costo de la celda">
      {celda ? <Contenido key={`${celda.fila.clave}-${celda.columna}`} celda={celda} {...resto} /> : null}
    </HojaInferior>
  );
}
