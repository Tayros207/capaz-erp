import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Conector } from '@capaz/shared';
import { Boton } from '../../shared/ui/boton.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { HojaInferior } from '../../shared/ui/hoja-inferior.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { configurarConexion, datosOError, desactivarConexion, verConexion } from './api.ts';
import { CLAVE_CONECTORES, CLAVE_CONEXION } from './claves.ts';
import { FilasDeCampos } from './filas-de-campos.tsx';
import { ETIQUETA_DE_ESTADO_DE_CONEXION, fechaHora, filasDeObjeto, objetoDeFilas, TONO_DE_ESTADO_DE_CONEXION, type FilaDeCampo } from './logica.ts';

type Props = { conector: Conector | null; puedeGestionar: boolean; alCerrar: () => void };

function Contenido({ conector, puedeGestionar, alCerrar }: Props & { conector: Conector }) {
  const consultas = useQueryClient();
  const existe = conector.estado !== null;
  const conexion = useQuery({
    queryKey: [...CLAVE_CONEXION, conector.codigo],
    queryFn: async () => datosOError(await verConexion(conector.codigo)),
    enabled: existe,
  });
  const [config, setConfig] = useState<FilaDeCampo[] | null>(null);
  // Las credenciales viven solo aquí y se borran al guardar o al cerrar la hoja.
  const [credenciales, setCredenciales] = useState<FilaDeCampo[]>([]);
  const [aviso, setAviso] = useState<string | undefined>();
  const [ocupado, setOcupado] = useState(false);

  const filasDeConfig = config ?? (conexion.data ? filasDeObjeto(conexion.data.configuracion) : []);
  const editable = puedeGestionar && conector.moduloActivo;

  async function guardar() {
    const c = objetoDeFilas(filasDeConfig);
    const k = objetoDeFilas(credenciales);
    const error = !c.ok ? c.error : !k.ok ? k.error : undefined;
    if (error || !c.ok || !k.ok) return setAviso(error);
    setOcupado(true);
    setAviso(undefined);
    const r = await configurarConexion({ conector: conector.codigo, configuracion: c.datos, ...(Object.keys(k.datos).length ? { credenciales: k.datos } : {}) });
    setOcupado(false);
    setCredenciales([]);
    if ('cancelada' in r) return;
    if (r.ok && 'datos' in r) {
      await consultas.invalidateQueries({ queryKey: ['conecta'] });
      notificar('Conexión guardada.', 'exito');
      alCerrar();
    } else if ('error' in r) setAviso(r.error.mensaje);
  }

  async function desactivar() {
    if (!(await confirmar('Desactivar la conexión', `«${conector.nombre}» dejará de funcionar hasta que la vuelvas a configurar.`, { textoConfirmar: 'Desactivar', peligroso: true }))) return;
    setOcupado(true);
    const r = await desactivarConexion(conector.codigo);
    setOcupado(false);
    if (r.ok && 'datos' in r) {
      await consultas.invalidateQueries({ queryKey: CLAVE_CONECTORES });
      await consultas.invalidateQueries({ queryKey: CLAVE_CONEXION });
      notificar('Conexión desactivada.', 'exito');
      alCerrar();
    } else if ('error' in r) setAviso(r.error.mensaje);
  }

  const datos = conexion.data;
  return (
    <form noValidate className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void guardar(); }}>
      {conector.descripcion ? <p>{conector.descripcion}</p> : null}
      <p className="text-sm text-texto-suave">Versión {conector.version}. {!conector.moduloActivo ? 'Este conector no está incluido en tu plan: pídelo a tu administrador.' : ''}</p>
      {existe && conexion.isPending ? <p role="status">Cargando la conexión…</p> : null}
      {existe && conexion.isError ? <p role="alert" className="text-sm font-medium text-peligro">{conexion.error.message}</p> : null}
      {datos ? (
        <dl className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-3 gap-y-1 text-sm">
          <dt className="text-texto-suave">Estado</dt>
          <dd><Insignia tono={TONO_DE_ESTADO_DE_CONEXION[datos.estado]}>{ETIQUETA_DE_ESTADO_DE_CONEXION[datos.estado]}</Insignia></dd>
          <dt className="text-texto-suave">Credenciales</dt>
          <dd>{datos.credencialesConfiguradas ? 'Configuradas (no se muestran)' : 'Sin configurar'}</dd>
          <dt className="text-texto-suave">Último uso</dt>
          <dd>{fechaHora(datos.ultimoUsoEn)}</dd>
          {datos.ultimoError ? (<><dt className="text-texto-suave">Último error</dt><dd className="break-words text-peligro">{datos.ultimoError}</dd></>) : null}
        </dl>
      ) : null}

      {editable ? (
        <fieldset disabled={ocupado} className="flex min-w-0 flex-col gap-4">
          <section className="flex flex-col gap-2">
            <h3 className="font-titulo font-semibold">Configuración</h3>
            <FilasDeCampos filas={filasDeConfig} alCambiar={setConfig} etiquetaDeAgregar="Agregar campo" />
          </section>
          {conector.autenticacion !== 'ninguna' ? (
            <section className="flex flex-col gap-2">
              <h3 className="font-titulo font-semibold">Credenciales</h3>
              <p className="text-sm text-texto-suave">Se cifran al guardar y no se vuelven a mostrar. Déjalas vacías para conservar las actuales.</p>
              <FilasDeCampos secreto filas={credenciales} alCambiar={setCredenciales} etiquetaDeAgregar="Agregar credencial" />
            </section>
          ) : null}
        </fieldset>
      ) : null}
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}</p> : null}
      <div className="flex flex-wrap justify-end gap-2">
        {editable && existe && datos?.estado !== 'desactivada' ? <Boton variante="peligro" disabled={ocupado} onClick={() => void desactivar()}>Desactivar</Boton> : null}
        <Boton variante="fantasma" onClick={alCerrar}>Cerrar</Boton>
        {editable ? <Boton type="submit" variante="primario" cargando={ocupado}>Guardar conexión</Boton> : null}
      </div>
    </form>
  );
}

export function HojaConexion({ conector, puedeGestionar, alCerrar }: Props) {
  return (
    <HojaInferior abierto={conector !== null} alCerrar={alCerrar} titulo={conector ? `Conexión · ${conector.nombre}` : 'Conexión'}>
      {conector ? <Contenido key={conector.codigo} conector={conector} puedeGestionar={puedeGestionar} alCerrar={alCerrar} /> : null}
    </HojaInferior>
  );
}
