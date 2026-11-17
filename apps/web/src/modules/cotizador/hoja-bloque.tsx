import { useState } from 'react';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { refrescarCotizador } from './acciones.ts';
import { ajustarListasEnBloque } from './api.ts';
import { BLOQUE_VACIO, argumentosDeBloque, mensajeDeBloqueAplicado, mensajeDeRechazo, pideConfirmarUnitario, validarBloque, type FormularioDeBloque } from './logica.ts';

type Props = { abierto: boolean; alCerrar: () => void };

function Contenido({ alCerrar }: { alCerrar: () => void }) {
  const [f, setF] = useState<FormularioDeBloque>(BLOQUE_VACIO);
  const [errores, setErrores] = useState<{ busqueda?: string; porcentaje?: string }>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [pideConfirmar, setPideConfirmar] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [enCurso, setEnCurso] = useState(false);

  /** «Ver el cambio»: el servidor arma el resumen (cuántas listas y ejemplos) y la persona confirma o desiste. */
  async function verElCambio() {
    const e = validarBloque(f);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setAviso(undefined);
    setEnCurso(true);
    const args = argumentosDeBloque(f, confirmar);
    const r = await ajustarListasEnBloque(args);
    setEnCurso(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      notificar(mensajeDeBloqueAplicado(r.datos.cambiadas, r.datos.porcentaje), 'exito');
      await refrescarCotizador();
      alCerrar();
    } else if ('error' in r) {
      setPideConfirmar(pideConfirmarUnitario(r.error.codigo, r.error.mensaje));
      setConfirmar(false);
      setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
    }
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); ev.stopPropagation(); void verElCambio(); }}>
      <p className="text-sm text-texto-suave">Sube o baja un porcentaje los precios de varias listas a la vez. Antes de aplicar verás cuántas cambian y algunos ejemplos. Las cotizaciones ya emitidas no cambian.</p>
      <Campo
        etiqueta="Listas que contienen"
        autoFocus
        maxLength={80}
        value={f.busqueda}
        error={errores.busqueda}
        placeholder="couché (vacío: todas las activas)"
        onChange={(e) => { setF((a) => ({ ...a, busqueda: e.target.value })); setPideConfirmar(false); }}
      />
      <Campo
        etiqueta="Porcentaje"
        inputMode="decimal"
        autoComplete="off"
        value={f.porcentaje}
        error={errores.porcentaje}
        placeholder="8 o -5"
        ayuda="Positivo sube, negativo baja. De -90 a 300."
        onChange={(e) => { setF((a) => ({ ...a, porcentaje: e.target.value })); setPideConfirmar(false); }}
      />
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      {pideConfirmar ? (
        <label className="flex min-h-(--alto-control) cursor-pointer items-center gap-3">
          <input type="checkbox" checked={confirmar} onChange={(e) => setConfirmar(e.target.checked)} className="size-5 cursor-pointer accent-accion" />
          <span className="font-medium text-texto">Guardar igual, estoy de acuerdo</span>
        </label>
      ) : null}
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={enCurso} disabled={pideConfirmar && !confirmar}>Ver el cambio</Boton>
      </div>
    </form>
  );
}

/** Subir o bajar precios en bloque: búsqueda por nombre, porcentaje y vista previa antes de confirmar. */
export function HojaDeBloque({ abierto, alCerrar }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={alCerrar} titulo="Cambiar precios en bloque">
      {abierto ? <Contenido alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
