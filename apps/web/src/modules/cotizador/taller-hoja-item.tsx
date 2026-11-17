import { useState } from 'react';
import type { ItemDelCuadroDto } from '@capaz/shared';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { crearItem, editarItem } from './api-taller.ts';
import { FACTORES, ITEM_VACIO, argumentosDeCreacionDeItem, argumentosDeEdicionDeItem, formularioDeItem, validarItem, type Factor, type FormularioDeItem } from './logica-taller.ts';
import { guardarEnTaller } from './taller-guardar.ts';
import { PieDeHoja } from './taller-hoja-pie.tsx';

function Contenido({ item, alCerrar }: { item: ItemDelCuadroDto | null; alCerrar: () => void }) {
  const [f, setF] = useState<FormularioDeItem>(() => (item ? formularioDeItem(item) : ITEM_VACIO));
  const [errores, setErrores] = useState<{ nombre?: string }>({});
  const [guardando, setGuardando] = useState(false);
  const poner = <K extends keyof FormularioDeItem>(k: K, v: FormularioDeItem[K]) => setF((a) => ({ ...a, [k]: v }));

  async function guardar() {
    const cerrar = await guardarEnTaller(
      { formulario: f, original: item, validar: validarItem, alErrores: setErrores, armarCreacion: argumentosDeCreacionDeItem, armarEdicion: argumentosDeEdicionDeItem, crear: crearItem, editar: editarItem, mensajes: { creado: 'Ítem creado.', editado: 'Ítem actualizado.' } },
      () => setGuardando(true),
      () => setGuardando(false),
    );
    if (cerrar) alCerrar();
  }
  const factores = FACTORES.map((x) => <option key={x.valor} value={x.valor}>{x.etiqueta}</option>);

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      <Campo etiqueta="Nombre" autoFocus maxLength={60} value={f.nombre} error={errores.nombre} onChange={(e) => poner('nombre', e.target.value)} />
      <CampoSelect etiqueta="Suma al factor" value={f.factor} onChange={(e) => poner('factor', e.target.value as Factor)}>{factores}</CampoSelect>
      <CampoSelect etiqueta="Se pinta después de" value={f.despuesDe} onChange={(e) => poner('despuesDe', e.target.value as Factor)}>{factores}</CampoSelect>
      <label className="flex min-h-(--alto-control) cursor-pointer items-center gap-3">
        <input type="checkbox" checked={f.fija} onChange={(e) => poner('fija', e.target.checked)} className="size-5 cursor-pointer accent-accion" />
        <span className="text-texto">Costo fijo: no cambia al correr el cuadro a otra cantidad</span>
      </label>
      <PieDeHoja alCerrar={alCerrar} guardando={guardando} etiqueta={item ? 'Guardar cambios' : 'Crear ítem'} />
    </form>
  );
}

/** Alta o edición de un ítem propio del cuadro. */
export function HojaDeItem({ abierto, item, alCerrar }: { abierto: boolean; item: ItemDelCuadroDto | null; alCerrar: () => void }) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={item ? 'Editar ítem del cuadro' : 'Nuevo ítem del cuadro'}>
      {abierto ? <Contenido key={item?.id ?? 'nuevo'} item={item} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
