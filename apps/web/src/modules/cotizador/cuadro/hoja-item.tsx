import { useState } from 'react';
import { Boton } from '../../../shared/ui/boton.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { confirmar } from '../../../shared/ui/confirmar.ts';
import { HojaInferior } from '../../../shared/ui/hoja-inferior.tsx';
import { FACTORES, type Factor } from '../logica-taller.ts';
import { agregarItem, editarItem, quitarItem } from './api-cuadro.ts';
import type { FilaDirecta } from './logica-cuadro.ts';
import { ITEM_NUEVO, argumentosDeItemEditado, argumentosDeItemNuevo, argumentosDeItemQuitado, formularioDeItemDelCuadro, validarItemDelCuadro, type FormularioDeItemDelCuadro } from './logica-cuadro-precio.ts';
import type { ContextoDelCuadro } from './use-cuadro.ts';

export type ItemEnHoja = { nuevo: true } | { fila: FilaDirecta };
type Props = { ctx: ContextoDelCuadro; item: ItemEnHoja; alCerrar: () => void };

function Contenido({ ctx, item, alCerrar }: Props) {
  const existente = 'fila' in item ? item.fila : null;
  const [f, setF] = useState<FormularioDeItemDelCuadro>(existente ? formularioDeItemDelCuadro(existente) : ITEM_NUEVO);
  const [error, setError] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const puedeGuardarEnTaller = ctx.configurar && !existente;

  async function guardar() {
    const e = validarItemDelCuadro(f);
    setError(e.nombre);
    if (e.nombre) return;
    setOcupado(true);
    const hecho = await ctx.aplicar(existente ? editarItem(argumentosDeItemEditado(ctx.id, existente, f)) : agregarItem(argumentosDeItemNuevo(ctx.id, f)));
    setOcupado(false);
    if (hecho) alCerrar();
  }
  async function quitar() {
    if (!existente || !(await confirmar('Quitar el ítem', `Se quitará «${existente.nombre}» de esta cotización.`, { textoConfirmar: 'Quitar', peligroso: true }))) return;
    if (await ctx.aplicar(quitarItem(argumentosDeItemQuitado(ctx.id, existente)))) alCerrar();
  }
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      <Campo etiqueta="Nombre del ítem" maxLength={60} value={f.nombre} error={error} onChange={(e) => setF((a) => ({ ...a, nombre: e.target.value }))} />
      <CampoSelect etiqueta="Factor" value={f.factor} onChange={(e) => setF((a) => ({ ...a, factor: e.target.value as Factor }))}>
        {FACTORES.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>)}
      </CampoSelect>
      <label className="flex min-h-(--alto-control) items-center gap-2 text-texto">
        <input type="checkbox" className="size-5 accent-accion" checked={f.fija} onChange={(e) => setF((a) => ({ ...a, fija: e.target.checked }))} />
        Fila fija (no cambia con la cantidad)
      </label>
      {puedeGuardarEnTaller ? (
        <label className="flex min-h-(--alto-control) items-center gap-2 text-texto">
          <input type="checkbox" className="size-5 accent-accion" checked={f.guardarEnTaller} onChange={(e) => setF((a) => ({ ...a, guardarEnTaller: e.target.checked }))} />
          Guardar también en el cuadro de mi empresa
        </label>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        {existente ? <Boton variante="peligro" onClick={() => void quitar()}>Quitar ítem</Boton> : null}
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>{existente ? 'Guardar ítem' : 'Agregar ítem'}</Boton>
      </div>
    </form>
  );
}

/** Hoja para agregar un ítem a la cotización (y, si se puede, al cuadro de la empresa), editarlo o quitarlo. */
export function HojaDeItem({ item, ...resto }: Omit<Props, 'item'> & { item: ItemEnHoja | null }) {
  return (
    <HojaInferior abierto={item !== null} alCerrar={resto.alCerrar} titulo={item && 'fila' in item ? 'Editar ítem' : 'Agregar ítem'}>
      {item ? <Contenido key={'fila' in item ? item.fila.clave : 'nuevo'} item={item} {...resto} /> : null}
    </HojaInferior>
  );
}
