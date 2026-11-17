import { useState } from 'react';
import { Boton } from '../../../shared/ui/boton.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { confirmar } from '../../../shared/ui/confirmar.ts';
import { HojaInferior } from '../../../shared/ui/hoja-inferior.tsx';
import type { Factor } from '../logica-taller.ts';
import { quitarFila } from './api-cuadro.ts';
import { enviarFila } from './enviar-fila.ts';
import { ElegirTarifa } from './elegir-tarifa.tsx';
import { CamposDeFila } from './campos-de-fila.tsx';
import type { Fila } from './logica-cuadro.ts';
import { FILA_VACIA, argumentosDeQuitarFila, formularioDeFila, validarFila, type ErroresDeFila, type FormularioDeFila } from './logica-cuadro-filas.ts';
import type { ContextoDelCuadro } from './use-cuadro.ts';

export type FilaEnHoja = { fila: Fila } | { factor: Factor };
type Props = { ctx: ContextoDelCuadro; en: FilaEnHoja; alCerrar: () => void };

function Contenido({ ctx, en, alCerrar }: Props) {
  const existente = 'fila' in en ? en.fila : null;
  const [f, setF] = useState<FormularioDeFila>(existente ? formularioDeFila(existente) : { ...FILA_VACIA, factor: 'factor' in en ? en.factor : 'acabado' });
  const [aMano, setAMano] = useState(false);
  const [errores, setErrores] = useState<ErroresDeFila>({});
  const [ocupado, setOcupado] = useState(false);
  const cambiar = (p: Partial<FormularioDeFila>) => setF((a) => ({ ...a, ...p }));

  async function guardar() {
    const e = validarFila(f, aMano || existente !== null, ctx.costos);
    if (existente) delete e.tarifa;
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setOcupado(true);
    const hecho = await enviarFila(ctx, existente, f, aMano);
    setOcupado(false);
    if (hecho) alCerrar();
  }
  async function quitar() {
    if (!existente || !(await confirmar('Quitar la fila', `Se quitará «${existente.descripcion}» del cuadro.`, { textoConfirmar: 'Quitar', peligroso: true }))) return;
    if (await ctx.aplicar(quitarFila(argumentosDeQuitarFila(ctx.id, existente)))) alCerrar();
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      {existente ? null : (
        <>
          {ctx.costos ? (
            <CampoSelect etiqueta="Cómo agregarla" value={aMano ? 'mano' : 'tarifa'} onChange={(e) => setAMano(e.target.value === 'mano')}>
              <option value="tarifa">Desde una tarifa del taller</option>
              <option value="mano">La escribo a mano</option>
            </CampoSelect>
          ) : null}
          {aMano ? null : <ElegirTarifa factor={f.factor} tarifa={f.tarifa} error={errores.tarifa} conCosto={ctx.costos} alElegirFactor={(x) => setF((a) => ({ ...a, factor: x, tarifa: null }))} alElegir={(t) => cambiar({ tarifa: t })} />}
        </>
      )}
      <CamposDeFila f={f} errores={errores} cambiar={cambiar} conCosto={ctx.costos} conDescripcion={aMano || existente !== null} conFactor={aMano || existente !== null} />
      <div className="flex flex-wrap justify-end gap-2">
        {existente ? <Boton variante="peligro" onClick={() => void quitar()}>Quitar fila</Boton> : null}
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>{existente ? 'Guardar fila' : 'Agregar fila'}</Boton>
      </div>
    </form>
  );
}

/** Hoja para agregar una fila (desde una tarifa o a mano) o editar y quitar una existente. `en` nulo = cerrada. */
export function HojaDeFila({ en, ...resto }: Omit<Props, 'en'> & { en: FilaEnHoja | null }) {
  const clave = en === null ? 'cerrada' : 'fila' in en ? en.fila.id : `nueva-${en.factor}`;
  return (
    <HojaInferior abierto={en !== null} alCerrar={resto.alCerrar} titulo={en && 'fila' in en ? 'Editar fila' : 'Agregar fila'}>
      {en ? <Contenido key={clave} en={en} {...resto} /> : null}
    </HojaInferior>
  );
}
