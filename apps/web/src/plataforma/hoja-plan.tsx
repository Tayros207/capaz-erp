import { useState } from 'react';
import type { Centimos } from '@capaz/shared';
import { centimosATexto } from '../shared/formato/soles.ts';
import { Boton } from '../shared/ui/boton.tsx';
import { Campo } from '../shared/ui/campo.tsx';
import { CampoMonto } from '../shared/ui/campo-monto.tsx';
import { CampoSelect } from '../shared/ui/campo-select.tsx';
import { HojaInferior } from '../shared/ui/hoja-inferior.tsx';
import { guardarPlan, type SalidaDePlataforma } from './api.ts';
import { listaDeCodigos, mensajeDeRechazo, PLAN_VACIO, validarPlan, type FormularioDePlan } from './logica.ts';

export type Plan = SalidaDePlataforma<'plataforma_planes_listar'>['items'][number];
type Props = { abierto: boolean; plan: Plan | null; alCerrar: () => void; alCambiar: () => void };

function desde(p: Plan | null): FormularioDePlan {
  if (!p) return PLAN_VACIO;
  return { codigo: p.codigo, nombre: p.nombre, descripcion: p.descripcion ?? '', precio: p.precioCentimos, usuarios: p.usuariosIncluidos === null ? '' : String(p.usuariosIncluidos), activo: p.activo, modulos: p.modulos.join(', ') };
}

function Contenido({ plan, alCerrar, alCambiar }: Omit<Props, 'abierto'>) {
  const [f, setF] = useState(() => desde(plan));
  const [errores, setErrores] = useState<ReturnType<typeof validarPlan>>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    const e = validarPlan(f, plan === null);
    setErrores(e);
    if (Object.keys(e).length > 0 || f.precio === null) return;
    setOcupado(true);
    setAviso(undefined);
    const r = await guardarPlan({
      codigo: f.codigo.trim(),
      nombre: f.nombre.trim(),
      descripcion: f.descripcion.trim() || null,
      precioCentimos: f.precio,
      usuariosIncluidos: f.usuarios.trim() === '' ? null : Number(f.usuarios),
      activo: f.activo,
      modulos: listaDeCodigos(f.modulos),
    });
    setOcupado(false);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      alCambiar();
      alCerrar();
    } else if ('error' in r) setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
  }

  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(ev) => { ev.preventDefault(); void enviar(); }}>
      <fieldset disabled={ocupado} className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Código" required readOnly={plan !== null} value={f.codigo} error={errores.codigo} autoComplete="off" onChange={(e) => setF({ ...f, codigo: e.target.value })} />
        <Campo etiqueta="Nombre" required value={f.nombre} error={errores.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
        <CampoMonto etiqueta="Precio" valor={f.precio} error={errores.precio} alCambiar={(precio: Centimos | null) => setF({ ...f, precio })} ayuda={f.precio === null ? undefined : `S/ ${centimosATexto(f.precio)} por periodo.`} />
        <Campo etiqueta="Usuarios incluidos" inputMode="numeric" value={f.usuarios} error={errores.usuarios} ayuda="Vacío: sin tope." onChange={(e) => setF({ ...f, usuarios: e.target.value })} />
        <div className="sm:col-span-2">
          <Campo etiqueta="Módulos incluidos" value={f.modulos} ayuda="Códigos separados por comas." onChange={(e) => setF({ ...f, modulos: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Campo etiqueta="Descripción" maxLength={500} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} />
        </div>
        <CampoSelect etiqueta="Estado" value={f.activo ? 'si' : 'no'} onChange={(e) => setF({ ...f, activo: e.target.value === 'si' })}>
          <option value="si">Activo</option>
          <option value="no">Inactivo</option>
        </CampoSelect>
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>Guardar plan</Boton>
      </div>
    </form>
  );
}

export function HojaPlan({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo={resto.plan ? `Plan ${resto.plan.nombre}` : 'Plan nuevo'}>
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
