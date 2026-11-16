import { useState } from 'react';
import type { ColaboradorDto } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { Campo } from '../../shared/ui/campo.tsx';
import { CampoSelect } from '../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { resolverAccion } from './acciones.ts';
import { crearColaborador, editarColaborador } from './api.ts';
import {
  argumentosDeCreacion, argumentosDeEdicion, COLABORADOR_VACIO, diaEnZona, formularioDeColaborador, TIPOS_DE_DOCUMENTO, validarColaborador,
  type ErroresDeColaborador, type FormularioDeColaborador,
} from './logica.ts';

type Props = {
  abierto: boolean;
  /** Con un colaborador, la hoja lo edita; sin él, crea uno nuevo. */
  colaborador?: ColaboradorDto;
  alCerrar: () => void;
  /** Recibe el id del colaborador creado. */
  alCrear?: (id: string) => void;
};

function Contenido({ colaborador, alCerrar, alCrear }: Omit<Props, 'abierto'>) {
  const [hoy] = useState(() => diaEnZona(new Date()));
  const [form, setForm] = useState<FormularioDeColaborador>(() => (colaborador ? formularioDeColaborador(colaborador) : COLABORADOR_VACIO));
  const [errores, setErrores] = useState<ErroresDeColaborador>({});
  const [guardando, setGuardando] = useState(false);
  const cambiar = (c: Partial<FormularioDeColaborador>) => setForm((f) => ({ ...f, ...c }));
  const campo = (k: keyof FormularioDeColaborador) => ({ value: form[k], error: errores[k], onChange: (e: { target: { value: string } }) => cambiar({ [k]: e.target.value }) });

  async function guardar() {
    const e = validarColaborador(form, hoy);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    const cambios = colaborador ? argumentosDeEdicion(colaborador, form) : null;
    if (colaborador && !cambios) return alCerrar();
    setGuardando(true);
    const r = colaborador && cambios ? await editarColaborador(cambios) : await crearColaborador(argumentosDeCreacion(form));
    setGuardando(false);
    if (await resolverAccion(r, colaborador ? 'Cambios guardados.' : 'Colaborador creado.')) {
      if (!colaborador && r.ok && 'datos' in r) alCrear?.(r.datos.id);
      alCerrar();
    }
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }}>
      <Campo etiqueta="Nombre completo" autoFocus autoComplete="off" maxLength={120} {...campo('nombre')} />
      <div className="grid gap-3 sm:grid-cols-2">
        <CampoSelect etiqueta="Tipo de documento" {...campo('documentoTipo')}>
          <option value="">Sin documento</option>
          {TIPOS_DE_DOCUMENTO.map((t) => <option key={t.valor} value={t.valor}>{t.texto}</option>)}
        </CampoSelect>
        <Campo etiqueta="Número de documento" inputMode="numeric" autoComplete="off" maxLength={20} {...campo('documentoNumero')} />
        <Campo etiqueta="Teléfono (opcional)" type="tel" autoComplete="off" maxLength={30} {...campo('telefono')} />
        <Campo etiqueta="Cargo (opcional)" autoComplete="off" maxLength={80} {...campo('cargo')} />
        <Campo etiqueta="Fecha de ingreso (opcional)" type="date" max={hoy} {...campo('fechaIngreso')} />
      </div>
      <div className="flex justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        <Boton type="submit" variante="primario" cargando={guardando}>{colaborador ? 'Guardar cambios' : 'Crear colaborador'}</Boton>
      </div>
    </form>
  );
}

/** Alta o edición de un colaborador en una hoja inferior. Captura tecleada. */
export function HojaDeColaborador({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={resto.colaborador ? 'Editar colaborador' : 'Nuevo colaborador'}>
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
