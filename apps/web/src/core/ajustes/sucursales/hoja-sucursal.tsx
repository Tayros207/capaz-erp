import { useState } from 'react';
import type { SucursalDto } from '@capaz/shared';
import { Boton } from '../../../shared/ui/boton.tsx';
import { Campo } from '../../../shared/ui/campo.tsx';
import { confirmar } from '../../../shared/ui/confirmar.ts';
import { HojaInferior } from '../../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { notificar } from '../../../shared/ui/notificar.ts';
import { archivarSucursal, crearSucursal, editarSucursal, marcarPrincipal } from './api.ts';
import {
  argumentosDeCreacion,
  argumentosDeEdicion,
  formularioDesde,
  FORMULARIO_VACIO,
  mensajeDeRechazo,
  puedeArchivar,
  puedeMarcarPrincipal,
  validarSucursal,
  type ErroresDeSucursal,
  type FormularioDeSucursal,
} from './logica.ts';

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  /** Sucursal que se edita; nulo para crear una nueva. */
  sucursal: SucursalDto | null;
  puedeGestionar: boolean;
  /** Se llama tras cualquier cambio guardado, para recargar la lista. */
  alCambiar: () => void;
};

function Contenido({ sucursal, puedeGestionar, alCerrar, alCambiar }: Omit<Props, 'abierto'>) {
  const crear = sucursal === null;
  const [form, setForm] = useState<FormularioDeSucursal>(sucursal ? formularioDesde(sucursal) : FORMULARIO_VACIO);
  const [errores, setErrores] = useState<ErroresDeSucursal>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const cambiar = (c: Partial<FormularioDeSucursal>) => setForm((f) => ({ ...f, ...c }));

  async function ejecutar<T extends { ok: boolean }>(operacion: () => Promise<T | { cancelada: true }>, exito: string) {
    setOcupado(true);
    setAviso(undefined);
    const r = await operacion();
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok) {
      notificar(exito, 'exito');
      alCambiar();
      alCerrar();
    } else if ('error' in r) {
      const e = r.error as { codigo: string; mensaje: string };
      setAviso(mensajeDeRechazo(e.codigo, e.mensaje));
    }
  }

  async function guardar() {
    const e = validarSucursal(form, crear);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    if (crear) return ejecutar(() => crearSucursal(argumentosDeCreacion(form)), 'Sucursal creada.');
    const args = argumentosDeEdicion(sucursal, form);
    if (!args) return alCerrar();
    return ejecutar(() => editarSucursal(args), 'Sucursal actualizada.');
  }

  async function archivar() {
    if (!sucursal) return;
    const si = await confirmar('Archivar sucursal', `«${sucursal.nombre}» dejará de estar disponible.`, { textoConfirmar: 'Archivar', peligroso: true });
    if (si) await ejecutar(() => archivarSucursal(sucursal.id), 'Sucursal archivada.');
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(ev) => {
        ev.preventDefault();
        void guardar();
      }}
    >
      {sucursal?.esPrincipal ? <div><Insignia tono="exito">Principal</Insignia></div> : null}
      <fieldset disabled={!puedeGestionar || ocupado} className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Código" autoComplete="off" disabled={!crear} maxLength={10} value={form.codigo} error={errores.codigo} onChange={(e) => cambiar({ codigo: e.target.value })} />
        <Campo etiqueta="Nombre" required autoComplete="off" value={form.nombre} error={errores.nombre} onChange={(e) => cambiar({ nombre: e.target.value })} />
        <Campo etiqueta="Dirección" autoComplete="off" value={form.direccion} onChange={(e) => cambiar({ direccion: e.target.value })} />
        <Campo etiqueta="Teléfono" type="tel" autoComplete="off" value={form.telefono} onChange={(e) => cambiar({ telefono: e.target.value })} />
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      {puedeGestionar ? (
        <div className="flex flex-wrap justify-end gap-2">
          {sucursal && puedeMarcarPrincipal(sucursal) ? (
            <Boton disabled={ocupado} onClick={() => void ejecutar(() => marcarPrincipal(sucursal.id), 'Sucursal principal actualizada.')}>Marcar como principal</Boton>
          ) : null}
          {sucursal && puedeArchivar(sucursal) ? <Boton variante="peligro" disabled={ocupado} onClick={() => void archivar()}>Archivar</Boton> : null}
          <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
          <Boton type="submit" variante="primario" cargando={ocupado}>{crear ? 'Crear sucursal' : 'Guardar'}</Boton>
        </div>
      ) : null}
    </form>
  );
}

/** Alta y edición de una sucursal en hoja inferior (móvil primero). Se reinicia al cerrar. */
export function HojaSucursal({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={resto.sucursal ? `Sucursal ${resto.sucursal.codigo}` : 'Nueva sucursal'}>
      {abierto ? <Contenido key={resto.sucursal?.id ?? 'nueva'} {...resto} /> : null}
    </HojaInferior>
  );
}
