import { useState } from 'react';
import type { Miembro, ModuloDeYo, RolDeMiembro } from '@capaz/shared';
import { Boton } from '../../../shared/ui/boton.tsx';
import { CampoSelect } from '../../../shared/ui/campo-select.tsx';
import { HojaInferior } from '../../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../../shared/ui/insignia.tsx';
import { notificar } from '../../../shared/ui/notificar.ts';
import { asignarModulo, cambiarRol, quitarMiembro } from './api.ts';
import {
  alcanceActual,
  argumentosDeAsignacion,
  entraATodo,
  ETIQUETA_DE_NIVEL,
  etiquetaDeRol,
  mensajeDeRechazo,
  nivelActual,
  puedeQuitar,
  rolesAsignables,
  type NivelDeModulo,
} from './logica.ts';

type Props = {
  miembro: Miembro | null;
  /** Rol de quien mira la pantalla y su identificador. */
  miRol: string;
  miId: string;
  modulos: readonly ModuloDeYo[];
  puedeGestionar: boolean;
  alCerrar: () => void;
  alCambiar: () => void;
};

type Resultado = { ok: boolean } | { cancelada: true };

function Contenido({ miembro, miRol, miId, modulos, puedeGestionar, alCerrar, alCambiar }: Props & { miembro: Miembro }) {
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);
  const roles = puedeGestionar ? rolesAsignables(miRol, miembro) : [];
  const [rol, setRol] = useState<string>(miembro.rol);

  async function ejecutar(operacion: () => Promise<Resultado>, exito: string, cerrar = false) {
    setOcupado(true);
    setAviso(undefined);
    const r = await operacion();
    setOcupado(false);
    if ('cancelada' in r) return false;
    if (r.ok) {
      notificar(exito, 'exito');
      alCambiar();
      if (cerrar) alCerrar();
      return true;
    }
    const e = (r as { error?: { codigo: string; mensaje: string } }).error;
    setAviso(e ? mensajeDeRechazo(e.codigo, e.mensaje) : 'No se pudo completar la operación.');
    return false;
  }

  const guardarRol = async () => {
    if (!(await ejecutar(() => cambiarRol(miembro.personaId, rol as RolDeMiembro), 'Rol actualizado.'))) setRol(miembro.rol);
  };

  const asignar = (modulo: string, nivel: NivelDeModulo, alcance: 'todos' | 'propios') =>
    ejecutar(() => asignarModulo(argumentosDeAsignacion(miembro.personaId, modulo, nivel, alcance)), 'Acceso actualizado.');

  return (
    <div className="flex flex-col gap-5">
      <p className="text-texto-suave">{miembro.correo}</p>

      <section className="flex flex-col gap-2" aria-label="Rol">
        <h3 className="font-titulo font-semibold">Rol</h3>
        {roles.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <CampoSelect etiqueta="Rol en la empresa" value={rol} disabled={ocupado} onChange={(e) => setRol(e.target.value)}>
                {roles.map((r) => <option key={r} value={r}>{etiquetaDeRol(r)}</option>)}
              </CampoSelect>
            </div>
            <Boton variante="primario" cargando={ocupado} disabled={rol === miembro.rol} onClick={() => void guardarRol()}>Cambiar rol</Boton>
          </div>
        ) : (
          <div><Insignia tono="info">{etiquetaDeRol(miembro.rol)}</Insignia></div>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-label="Módulos">
        <h3 className="font-titulo font-semibold">Acceso por módulo</h3>
        {entraATodo(miembro.rol) ? (
          <p className="text-texto-suave">Propietarios y administradores entran a todos los módulos contratados; no necesitan asignación.</p>
        ) : modulos.length === 0 ? (
          <p className="text-texto-suave">La empresa no tiene módulos contratados para asignar.</p>
        ) : (
          modulos.map((m) => {
            const nivel = nivelActual(miembro, m.codigo);
            const alcance = alcanceActual(miembro, m.codigo);
            return (
              <div key={m.codigo} className="grid gap-2 sm:grid-cols-2">
                <CampoSelect etiqueta={m.nombre} value={nivel} disabled={!puedeGestionar || ocupado} onChange={(e) => void asignar(m.codigo, e.target.value as NivelDeModulo, alcance)}>
                  {(Object.keys(ETIQUETA_DE_NIVEL) as NivelDeModulo[]).map((n) => <option key={n} value={n}>{ETIQUETA_DE_NIVEL[n]}</option>)}
                </CampoSelect>
                {nivel !== 'sin_acceso' ? (
                  <CampoSelect etiqueta="Qué registros ve" value={alcance} disabled={!puedeGestionar || ocupado} onChange={(e) => void asignar(m.codigo, nivel, e.target.value as 'todos' | 'propios')}>
                    <option value="todos">Todos</option>
                    <option value="propios">Solo los que registra</option>
                  </CampoSelect>
                ) : null}
              </div>
            );
          })
        )}
      </section>

      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {puedeGestionar && puedeQuitar(miRol, miembro, miId) ? (
          <Boton variante="peligro" disabled={ocupado} onClick={() => void ejecutar(() => quitarMiembro(miembro.personaId), 'Persona quitada de la empresa.', true)}>Quitar de la empresa</Boton>
        ) : null}
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
      </div>
    </div>
  );
}

/** Rol, acceso por módulo y baja de un miembro, en hoja inferior. Se reinicia al cerrar. */
export function HojaMiembro(props: Props) {
  const { miembro } = props;
  return (
    <HojaInferior abierto={miembro !== null} alCerrar={props.alCerrar} titulo={miembro ? miembro.nombre : 'Persona'}>
      {miembro ? <Contenido key={miembro.personaId} {...props} miembro={miembro} /> : null}
    </HojaInferior>
  );
}
