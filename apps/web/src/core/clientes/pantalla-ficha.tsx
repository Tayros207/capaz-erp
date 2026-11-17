import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router';
import type { Candidata, ClienteDto } from '@capaz/shared';
import { formatearFechaHora } from '../../shared/formato/fechas.ts';
import { puede } from '../../shared/sesion/sesion.ts';
import { useYo } from '../../shared/sesion/use-yo.ts';
import { Boton } from '../../shared/ui/boton.tsx';
import { confirmar } from '../../shared/ui/confirmar.ts';
import { EncabezadoDePagina } from '../../shared/ui/datos/encabezado-de-pagina.tsx';
import { Ficha } from '../../shared/ui/datos/ficha.tsx';
import { useFicha } from '../../shared/ui/datos/use-ficha.ts';
import { Esqueleto } from '../../shared/ui/esqueleto.tsx';
import { EstadoVacio } from '../../shared/ui/estado-vacio.tsx';
import { Insignia } from '../../shared/ui/insignia.tsx';
import { notificar } from '../../shared/ui/notificar.ts';
import { archivarCliente, datosOError, editarCliente, restaurarCliente, verCliente } from './api.ts';
import { CLAVE_CLIENTES } from './claves.ts';
import { FormularioCliente } from './formulario-cliente.tsx';
import { SeccionesAmpliadasDeCliente } from './secciones-ampliadas.tsx';
import { Extensiones } from '../../shared/ui/extensiones.tsx';
import {
  argumentosDeEdicion,
  ETIQUETA_DE_CLASE,
  ETIQUETA_DE_TIPO,
  formularioDesde,
  mensajeDeRechazo,
  textoDeDocumento,
  validarCliente,
  type ErroresDeCliente,
  type FormularioDeCliente,
} from './logica.ts';

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-sm text-texto-suave">{etiqueta}</dt>
      <dd className="break-words font-medium text-texto">{valor || '—'}</dd>
    </div>
  );
}

function Lectura({ c }: { c: ClienteDto }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      <Dato etiqueta="Tipo" valor={ETIQUETA_DE_TIPO[c.tipo]} />
      <Dato etiqueta="Clase" valor={ETIQUETA_DE_CLASE[c.clase]} />
      <Dato etiqueta="Documento" valor={textoDeDocumento(c)} />
      <Dato etiqueta="Teléfono" valor={c.telefono ?? ''} />
      <Dato etiqueta="Correo" valor={c.correo ?? ''} />
      <Dato etiqueta="Dirección" valor={c.direccion ?? ''} />
      <Dato etiqueta="Notas" valor={c.notas ?? ''} />
      <Dato etiqueta="Última modificación" valor={formatearFechaHora(c.actualizadoEn)} />
    </dl>
  );
}

function Contenido({ cliente }: { cliente: ClienteDto }) {
  const yo = useYo();
  const consultas = useQueryClient();
  const { estado, enviar } = useFicha();
  const [form, setForm] = useState<FormularioDeCliente>(() => formularioDesde(cliente));
  const [errores, setErrores] = useState<ErroresDeCliente>({});
  const [aviso, setAviso] = useState<string | undefined>();
  const [candidatas, setCandidatas] = useState<Candidata[]>([]);
  const puedeEditar = !!yo && puede(yo, 'clientes:editar');
  const archivado = cliente.archivadoEn !== null;

  const refrescar = () => consultas.invalidateQueries({ queryKey: CLAVE_CLIENTES });

  async function guardar() {
    const e = validarCliente(form);
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    const args = argumentosDeEdicion(cliente, form);
    if (!args) {
      enviar('descartar');
      return;
    }
    enviar('guardar');
    setAviso(undefined);
    const r = await editarCliente(args);
    if (r.ok && 'datos' in r) {
      enviar('guardado');
      notificar('Cliente actualizado.', 'exito');
      await refrescar();
      return;
    }
    enviar('fallo');
    if ('error' in r) {
      setAviso(mensajeDeRechazo(r.error.codigo, r.error.mensaje));
      setCandidatas(r.error.candidatas ?? []);
    }
  }

  async function alternarArchivo() {
    if (!archivado && !(await confirmar('Archivar cliente', `«${cliente.nombre}» dejará de aparecer entre los activos. Se puede restaurar.`, { textoConfirmar: 'Archivar', peligroso: true }))) return;
    const r = await (archivado ? restaurarCliente(cliente.id) : archivarCliente(cliente.id));
    if (r.ok) {
      notificar(archivado ? 'Cliente restaurado.' : 'Cliente archivado.', 'exito');
      await refrescar();
    } else if ('error' in r) notificar(mensajeDeRechazo(r.error.codigo, r.error.mensaje), 'error');
  }

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoDePagina
        titulo={cliente.nombre}
        migas={[{ texto: 'Clientes', a: '/clientes' }, { texto: cliente.nombre }]}
        accionesSecundarias={
          <>
            {archivado ? <Insignia tono="neutro">Archivado</Insignia> : null}
            {puedeEditar ? <Boton variante={archivado ? 'secundario' : 'peligro'} onClick={() => void alternarArchivo()}>{archivado ? 'Restaurar' : 'Archivar'}</Boton> : null}
          </>
        }
      />
      {aviso ? <p role="alert" className="text-sm font-medium text-peligro">{aviso}{candidatas.length ? `: ${candidatas.map((c) => c.nombre).join(', ')}` : ''}</p> : null}
      <Ficha
        estado={estado}
        soloLectura={!puedeEditar || archivado}
        onEditar={() => {
          setForm(formularioDesde(cliente));
          enviar('editar');
        }}
        onGuardar={() => void guardar()}
        onDescartar={() => {
          enviar('descartar');
          setErrores({});
          setAviso(undefined);
        }}
        secciones={[
          {
            id: 'datos',
            titulo: 'Datos del cliente',
            lectura: <Lectura c={cliente} />,
            edicion: (
              <FormularioCliente
                valor={form}
                errores={errores}
                alCambiar={(c) => {
                  setForm((f) => ({ ...f, ...c }));
                  enviar('cambio');
                }}
              />
            ),
          },
        ]}
      />
      <SeccionesAmpliadasDeCliente clienteId={cliente.id} puedeEditar={puedeEditar && !archivado} />
      <Extensiones punto="ficha-cliente" clienteId={cliente.id} />
    </div>
  );
}

export function PantallaFichaCliente() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: [...CLAVE_CLIENTES, 'ficha', id], queryFn: async () => datosOError(await verCliente(id)) });
  if (consulta.isPending) {
    return (
      <div aria-busy="true" aria-label="Cargando cliente" className="flex flex-col gap-2">
        <Esqueleto className="h-8 w-1/2" />
        <Esqueleto className="h-40" />
      </div>
    );
  }
  if (consulta.isError) {
    return <EstadoVacio titulo="No encontramos este cliente" descripcion={consulta.error.message} icono="usuario" />;
  }
  // `key` reinicia el estado de edición cuando los datos cambian por el servidor.
  return <Contenido key={`${consulta.data.id}-${consulta.data.actualizadoEn}`} cliente={consulta.data} />;
}
