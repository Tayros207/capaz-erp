import { useState } from 'react';
import { Boton } from '../shared/ui/boton.tsx';
import { Campo } from '../shared/ui/campo.tsx';
import { HojaInferior } from '../shared/ui/hoja-inferior.tsx';
import { activarModulo } from './api.ts';
import { mensajeDeRechazo, parsearDiasDePrueba } from './logica.ts';

type Props = { abierto: boolean; empresa: string; conocidos: string[]; alCerrar: () => void; alCambiar: () => void };

function Contenido({ empresa, conocidos, alCerrar, alCambiar }: Omit<Props, 'abierto'>) {
  const [modulo, setModulo] = useState('');
  const [dias, setDias] = useState('');
  const [motivo, setMotivo] = useState('');
  const [errores, setErrores] = useState<{ modulo?: string; dias?: string }>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  async function enviar() {
    const d = parsearDiasDePrueba(dias);
    const e = { modulo: modulo.trim() ? undefined : 'Indica el módulo.', dias: 'error' in d ? d.error : undefined };
    setErrores(e);
    if (e.modulo || e.dias) return;
    setOcupado(true);
    setAviso(undefined);
    const r = await activarModulo({
      empresa,
      modulo: modulo.trim(),
      ...('dias' in d && d.dias ? { pruebaDias: d.dias } : {}),
      ...(motivo.trim() ? { motivo: motivo.trim() } : {}),
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
        <div>
          <Campo etiqueta="Código del módulo" list="modulos-conocidos" autoComplete="off" required value={modulo} error={errores.modulo} onChange={(e) => setModulo(e.target.value)} />
          <datalist id="modulos-conocidos">{conocidos.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <Campo etiqueta="Días de prueba" inputMode="numeric" value={dias} error={errores.dias} ayuda="Vacío: queda activo, sin prueba." onChange={(e) => setDias(e.target.value)} />
        <div className="sm:col-span-2">
          <Campo etiqueta="Motivo (opcional)" maxLength={300} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
        </div>
      </fieldset>
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
        <Boton type="submit" variante="primario" cargando={ocupado}>Activar módulo</Boton>
      </div>
    </form>
  );
}

export function HojaActivar({ abierto, ...resto }: Props) {
  return (
    <HojaInferior abierto={abierto} alCerrar={resto.alCerrar} titulo="Activar un módulo">
      {abierto ? <Contenido {...resto} /> : null}
    </HojaInferior>
  );
}
