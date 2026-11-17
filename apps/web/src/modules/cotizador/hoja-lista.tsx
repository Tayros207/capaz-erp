import { useState } from 'react';
import type { ListaDePrecioDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoMonto } from '../../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { refrescarCotizador } from './acciones.ts';
import { crearLista, editarLista } from './api.ts';
import {
  ETIQUETA_DE_MODO, LISTA_VACIA, REFERENCIAS, argumentosDeCreacionDeLista, argumentosDeEdicionDeLista, formularioDeLista, mensajeDeRechazo,
  pideConfirmarUnitario, unitarioDeReferencia, validarLista, type ErroresDeLista, type FormularioDeLista, type ModoIntermedio,
} from './logica.ts';

type Props = { abierto: boolean; lista: ListaDePrecioDto | null; alCerrar: () => void };

function Contenido({ lista, alCerrar }: { lista: ListaDePrecioDto | null; alCerrar: () => void }) {
  const [f, setF] = useState<FormularioDeLista>(lista ? formularioDeLista(lista) : LISTA_VACIA);
  const [errores, setErrores] = useState<ErroresDeLista>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [confirmar, setConfirmar] = useState(false);
  const [pideConfirmar, setPideConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    const e = validarLista(f);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setAviso(undefined);
    let r;
    if (lista) {
      const args = argumentosDeEdicionDeLista(lista, f, confirmar);
      if (!args) {
        notificar('No cambiaste nada.', 'info');
        alCerrar();
        return;
      }
      setGuardando(true);
      r = await editarLista(args);
    } else {
      setGuardando(true);
      r = await crearLista(argumentosDeCreacionDeLista(f, confirmar));
    }
    setGuardando(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      notificar(lista ? 'Lista actualizada.' : 'Lista creada.', 'exito');
      await refrescarCotizador();
      alCerrar();
    } else if ('error' in r) {
      setPideConfirmar(pideConfirmarUnitario(r.error.codigo, r.error.mensaje));
      setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void guardar(); }}>
      <Campo etiqueta="Nombre" autoFocus maxLength={120} value={f.nombre} error={errores.nombre} onChange={(e) => setF((a) => ({ ...a, nombre: e.target.value }))} />
      <Campo etiqueta="Unidad" maxLength={20} value={f.unidad} error={errores.unidad} ayuda="Por ejemplo: unidad, millar, pliego." onChange={(e) => setF((a) => ({ ...a, unidad: e.target.value }))} />
      <p className="text-sm text-texto-suave">Escribe el precio total, sin IGV, de cada cantidad. Al lado ves lo que sale por unidad.</p>
      {REFERENCIAS.map((r) => (
        <div key={r.clave} className="grid grid-cols-[1fr_auto] items-end gap-3">
          <CampoMonto etiqueta={`Precio de ${r.etiqueta}`} valor={f[r.clave]} error={errores[r.clave]} alCambiar={(v) => setF((a) => ({ ...a, [r.clave]: v }))} />
          <p className="min-h-(--alto-control) pb-2 text-sm tabular-nums text-texto-suave" aria-label={`Por unidad con ${r.etiqueta}`}>
            <span className="block">Por unidad</span>
            <span className="font-medium text-texto">{unitarioDeReferencia(f[r.clave], r.cantidad)}</span>
          </p>
        </div>
      ))}
      <CampoSelect etiqueta="Entre una cantidad y otra" value={f.modo} onChange={(e) => setF((a) => ({ ...a, modo: e.target.value as ModoIntermedio }))}>
        {(Object.keys(ETIQUETA_DE_MODO) as ModoIntermedio[]).map((m) => <option key={m} value={m}>{ETIQUETA_DE_MODO[m]}</option>)}
      </CampoSelect>
      <CampoMonto etiqueta="Precio mínimo (opcional)" valor={f.minimo} error={errores.minimo} ayuda="Ninguna cotización de esta lista baja de este precio." alCambiar={(v) => setF((a) => ({ ...a, minimo: v }))} />
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      {pideConfirmar ? (
        <label className="flex min-h-(--alto-control) cursor-pointer items-center gap-3">
          <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} className="size-5 cursor-pointer accent-accion" />
          <span className="font-medium text-texto">Guardar igual, estoy de acuerdo</span>
        </label>
      ) : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando} disabled={pideConfirmar && !confirmar}>{lista ? 'Guardar cambios' : 'Crear lista'}</Boton>
      </div>
    </form>
  );
}

/** Alta o edición de una lista de precios con sus tres precios de referencia. */
export function HojaDeLista({ abierto, lista, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo={lista ? 'Editar lista de precios' : 'Nueva lista de precios'}>
      {abierto ? <Contenido key={lista?.id ?? 'nueva'} lista={lista} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
