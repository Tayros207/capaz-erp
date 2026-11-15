import { useState } from 'react';
import type { Centimos, ModuloDeEmpresaDto } from '@capaz/shared';
import { Boton } from '../shared/ui/boton.tsx';
import { Campo } from '../shared/ui/campo.tsx';
import { CampoMonto } from '../shared/ui/campo-monto.tsx';
import { HojaInferior } from '../shared/ui/hoja-inferior.tsx';
import { fijarContrato } from './api.ts';
import { argumentosDeContrato, formularioDeContrato, mensajeDeRechazo } from './logica.ts';

type Props = { empresa: string; modulo: ModuloDeEmpresaDto | null; alCerrar: () => void; alCambiar: () => void };

function Contenido({ empresa, modulo, alCerrar, alCambiar }: Props & { modulo: ModuloDeEmpresaDto }) {
  const original = formularioDeContrato(modulo);
  const [f, setF] = useState(original);
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    const args = argumentosDeContrato(f, original);
    if (args === null) return setAviso('No cambiaste ningún dato del contrato.');
    if ('error' in args) return setAviso(args.error);
    setOcupado(true);
    setAviso(undefined);
    const r = await fijarContrato({ empresa, modulo: modulo.modulo, ...args });
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
        <Campo etiqueta="Plan" value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })} />
        <CampoMonto etiqueta="Precio acordado" valor={f.precio} alCambiar={(precio: Centimos | null) => setF({ ...f, precio })} ayuda="Vacío: sin precio acordado." />
        <Campo etiqueta="Vigente hasta" type="date" value={f.vigenteHasta} onChange={(e) => setF({ ...f, vigenteHasta: e.target.value })} ayuda="Vacío: sin vencimiento." />
        <Campo etiqueta="Máximo de usuarios" inputMode="numeric" value={f.maxUsuarios} onChange={(e) => setF({ ...f, maxUsuarios: e.target.value })} ayuda="Vacío: sin tope." />
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>Fijar contrato</Boton>
      </div>
    </form>
  );
}

export function HojaContrato(props: Props) {
  const { modulo } = props;
  return (
    <HojaInferior abierto={modulo !== null} alCerrar={props.alCerrar} titulo={modulo ? `Contrato de ${modulo.nombre}` : 'Contrato'}>
      {modulo ? <Contenido key={modulo.modulo} {...props} modulo={modulo} /> : null}
    </HojaInferior>
  );
}
